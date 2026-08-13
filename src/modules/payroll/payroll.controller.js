/**
 * payroll.controller.js — Monthly salary run and payslips
 *
 * Pulls the month's attendance, computes each person's pay, and lets it be
 * adjusted before paying. Marking a payslip paid recovers any advance and books
 * the salary as an expense, so payroll never has to be re-entered elsewhere.
 */

import Router from '../../core/router.js';
import Store  from '../../core/store.js';
import Toast  from '../../components/Toast.js';
import Icon   from '../../utils/icons.js';
import PayrollService, { monthKey, monthLabel } from './payroll.service.js';
import { formatCurrency, formatCurrencyShort, initials, avatarColor } from '../../utils/formatters.js';
import { PAYMENT_METHODS, SALARY_TYPE_MAP } from '../../utils/constants.js';

const money = (v) => formatCurrency(v);
const esc   = (s) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const PayrollPage = {
  _month: monthKey(), _staff: [], _rows: [], _runs: [], _advances: [],

  async init() {
    window.PayrollPage = this;
    Router.render(`
      <div class="page-header">
        <div class="page-header-left"><h1>Payroll</h1><p id="pr-sub">Loading…</p></div>
        <div class="page-header-actions">
          <input id="pr-month" class="input" type="month" value="${this._month}" style="width:150px;" onchange="PayrollPage.setMonth(this.value)" />
          <a href="#/attendance" class="btn btn-secondary btn-sm">${Icon.clipboard(14)} Attendance</a>
          <button class="btn btn-primary btn-sm" onclick="PayrollPage.payAll()">Pay all pending</button>
        </div>
      </div>
      <div id="pr-metrics" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;margin-bottom:16px;"></div>
      <div class="card" id="pr-body"><div style="padding:40px;text-align:center;"><div class="spinner-sm"></div></div></div>
      <div id="pr-modal"></div>
    `);

    if (!(await PayrollService.waitForCompany())) {
      document.getElementById('pr-body').innerHTML = `<div class="empty-state"><h3>No company selected</h3><p>Set up your company in Settings first.</p></div>`;
      return;
    }
    await this._load();
  },

  setMonth(m) { if (m) { this._month = m; this._load(); } },

  async _load() {
    const body = document.getElementById('pr-body');
    if (body) body.innerHTML = `<div style="padding:40px;text-align:center;"><div class="spinner-sm"></div></div>`;

    this._staff = await PayrollService.listStaff().catch(() => []);
    if (this._staff.length === 0) {
      body.innerHTML = `<div class="empty-state">
        <div class="empty-state-icon">${Icon.users(24)}</div><h3>No active staff</h3>
        <p>Add your team to run payroll.</p><a href="#/staff" class="btn btn-primary">Add staff</a>
      </div>`;
      return;
    }

    const [records, runs, advances] = await Promise.all([
      PayrollService.getMonthAll(this._staff.map(s => s.id), this._month),
      PayrollService.listRuns(this._month).catch(() => []),
      PayrollService.listAdvances().catch(() => []),
    ]);
    this._runs = runs;
    this._advances = advances;

    // Build one editable row per staff member, seeded from any saved payslip
    this._rows = this._staff.map(s => {
      const summary = PayrollService.summariseMonth(records[s.id], this._month);
      const saved   = runs.find(r => r.staffId === s.id);
      const advOut  = PayrollService.outstandingAdvance(advances.filter(a => a.staffId === s.id));
      const inputs  = {
        advanceOutstanding: advOut,
        // Default to recovering the whole advance, capped by what is earned
        recoverAdvance: saved ? Number(saved.advanceRecovered) || 0 : advOut,
        bonus:          saved ? Number(saved.bonus) || 0 : 0,
        otherDeduction: saved ? Number(saved.otherDeduction) || 0 : 0,
      };
      return {
        staff: s, summary, inputs, saved: saved || null,
        breakdown: PayrollService.computeSalary(s, summary, inputs),
      };
    });

    this._render();
  },

  _recompute(i) {
    const r = this._rows[i];
    r.breakdown = PayrollService.computeSalary(r.staff, r.summary, r.inputs);
  },

  _render() {
    const sub = document.getElementById('pr-sub');
    if (sub) sub.textContent = `${monthLabel(this._month)} · ${this._staff.length} staff`;

    const pending = this._rows.filter(r => r.saved?.status !== 'paid');
    const paid    = this._rows.filter(r => r.saved?.status === 'paid');
    const netTotal   = this._rows.reduce((s, r) => s + r.breakdown.net, 0);
    const paidTotal  = paid.reduce((s, r) => s + (Number(r.saved.net) || 0), 0);
    const advTotal   = this._rows.reduce((s, r) => s + r.breakdown.advanceRecovered, 0);

    const card = (label, value, sub2, tone) => `
      <div class="metric-card">
        <div class="metric-label">${label}</div>
        <div class="metric-value" ${tone ? `style="color:${tone};"` : ''}>${value}</div>
        ${sub2 ? `<div class="metric-subtext">${sub2}</div>` : ''}
      </div>`;

    document.getElementById('pr-metrics').innerHTML =
      card('Net payable', formatCurrencyShort(netTotal), `${this._rows.length} staff`) +
      card('Already paid', formatCurrencyShort(paidTotal), `${paid.length} payslips`, 'var(--color-success)') +
      card('Still pending', formatCurrencyShort(netTotal - paidTotal), `${pending.length} staff`, pending.length ? 'var(--color-warning)' : null) +
      card('Advance recovery', formatCurrencyShort(advTotal), 'Deducted this month');

    document.getElementById('pr-body').innerHTML = `
      <div class="table-wrapper">
        <table class="data-table">
          <thead><tr>
            <th>Staff</th><th>Worked</th><th class="text-right">Earned</th>
            <th class="text-right">Bonus</th><th class="text-right">Advance</th>
            <th class="text-right">Other ded.</th><th class="text-right">Net pay</th>
            <th>Status</th><th></th>
          </tr></thead>
          <tbody>
            ${this._rows.map((r, i) => this._rowHTML(r, i)).join('')}
          </tbody>
        </table>
      </div>`;
  },

  _rowHTML(r, i) {
    const s = r.staff, b = r.breakdown;
    const col = avatarColor(s.name || '');
    const isPaid = r.saved?.status === 'paid';
    const t = SALARY_TYPE_MAP[b.salaryType];

    return `<tr style="${isPaid ? 'opacity:0.78;' : ''}">
      <td>
        <div class="table-entity">
          <div class="table-entity-avatar" style="background:${col.bg};color:${col.text};">${esc(initials(s.name || '?'))}</div>
          <div><div class="table-entity-name">${esc(s.name || '—')}</div>
          <div class="table-entity-sub">${money(b.rate)} / ${esc(t?.unit || 'month')}</div></div>
        </div>
      </td>
      <td class="muted">${esc(b.workedLabel)}${b.otHours > 0 && b.otPay > 0 ? `<br><span style="font-size:10.5px;color:var(--color-info);">+${b.otHours}h OT</span>` : ''}</td>
      <td class="col-amount">${money(b.base + b.otPay)}</td>
      <td class="col-amount">
        ${isPaid ? money(b.bonus) : `<input class="pr-mini" type="number" step="0.01" value="${b.bonus || ''}" placeholder="0" onchange="PayrollPage.setInput(${i},'bonus',this.value)" onfocus="this.select()" />`}
      </td>
      <td class="col-amount">
        ${isPaid ? money(b.advanceRecovered) : `<input class="pr-mini" type="number" step="0.01" value="${b.advanceRecovered || ''}" placeholder="0" max="${b.advanceOutstanding}" onchange="PayrollPage.setInput(${i},'recoverAdvance',this.value)" onfocus="this.select()" title="Outstanding: ${money(b.advanceOutstanding)}" />`}
        ${b.advanceOutstanding > 0 ? `<div style="font-size:10px;color:var(--text-tertiary);">of ${money(b.advanceOutstanding)}</div>` : ''}
      </td>
      <td class="col-amount">
        ${isPaid ? money(b.otherDeduction) : `<input class="pr-mini" type="number" step="0.01" value="${b.otherDeduction || ''}" placeholder="0" onchange="PayrollPage.setInput(${i},'otherDeduction',this.value)" onfocus="this.select()" />`}
      </td>
      <td class="col-amount"><strong style="font-size:13.5px;">${money(b.net)}</strong></td>
      <td>${isPaid ? `<span class="badge badge-success badge-dot">Paid</span>` : `<span class="badge badge-neutral badge-dot">Pending</span>`}</td>
      <td class="col-actions"><div class="row-actions">
        <button class="btn btn-ghost btn-sm" onclick="PayrollPage.slip(${i})">Payslip</button>
        ${isPaid ? '' : `<button class="btn btn-primary btn-sm" onclick="PayrollPage.pay(${i})">Pay</button>`}
      </div></td>
    </tr>`;
  },

  setInput(i, field, value) {
    const r = this._rows[i];
    if (!r) return;
    let v = parseFloat(value) || 0;
    if (field === 'recoverAdvance') v = Math.min(v, r.inputs.advanceOutstanding);
    r.inputs[field] = Math.max(0, v);
    this._recompute(i);
    this._render();
  },

  // ── PAY ──────────────────────────────────────────────────────────────────
  async pay(i) {
    const r = this._rows[i];
    if (!r) return;
    if (!confirm(`Pay ${money(r.breakdown.net)} to ${r.staff.name} for ${monthLabel(this._month)}?\n\nThis records the payslip and books the salary as an expense.`)) return;
    try {
      await PayrollService.savePayslip({
        staff: r.staff, month: this._month, breakdown: r.breakdown,
        status: 'paid', paymentMethod: r.staff.paymentMethod || 'cash',
      });
      Toast.success(`${r.staff.name} paid ${money(r.breakdown.net)}`);
      await this._load();
    } catch (e) { Toast.error('Failed: ' + e.message); }
  },

  async payAll() {
    const pending = this._rows.filter(r => r.saved?.status !== 'paid');
    if (pending.length === 0) { Toast.info('Everyone is already paid for this month'); return; }
    const total = pending.reduce((s, r) => s + r.breakdown.net, 0);
    if (!confirm(`Pay ${pending.length} staff a total of ${money(total)} for ${monthLabel(this._month)}?`)) return;

    Toast.info('Recording payslips…');
    let ok = 0;
    for (const r of pending) {
      try {
        await PayrollService.savePayslip({
          staff: r.staff, month: this._month, breakdown: r.breakdown,
          status: 'paid', paymentMethod: r.staff.paymentMethod || 'cash',
        });
        ok++;
      } catch (e) { Toast.error(`${r.staff.name}: ${e.message}`); }
    }
    Toast.success(`${ok} payslip${ok === 1 ? '' : 's'} recorded`);
    await this._load();
  },

  // ── PAYSLIP ──────────────────────────────────────────────────────────────
  slip(i) {
    const r = this._rows[i];
    if (!r) return;
    const b = r.breakdown, s = r.staff;
    const co = Store.get('company') || {};

    const row = (l, v, cls = '') => `<div class="slip-row ${cls}"><span>${l}</span><span>${v}</span></div>`;

    document.getElementById('pr-modal').innerHTML = `
      <div class="modal-overlay" onclick="if(event.target===this)PayrollPage.closeModal()" style="z-index:400;">
        <div class="modal" style="max-width:460px;width:100%;">
          <div class="modal-header">
            <h3 style="margin:0;font-size:15px;font-weight:700;">Payslip</h3>
            <button class="modal-close" onclick="PayrollPage.closeModal()">${Icon.x(15)}</button>
          </div>
          <div class="modal-body" id="slip-print">
            <div style="text-align:center;padding-bottom:12px;border-bottom:1px solid var(--border-subtle);margin-bottom:12px;">
              <div style="font-size:16px;font-weight:700;">${esc(co.name || 'Company')}</div>
              <div style="font-size:12px;color:var(--text-tertiary);">Payslip for ${esc(monthLabel(this._month))}</div>
            </div>
            <div style="display:flex;justify-content:space-between;margin-bottom:12px;">
              <div>
                <div style="font-size:14px;font-weight:700;">${esc(s.name)}</div>
                <div style="font-size:12px;color:var(--text-tertiary);">${esc(s.role || '')}</div>
              </div>
              <div style="text-align:right;font-size:12px;color:var(--text-tertiary);">
                ${esc(b.workedLabel)}<br>${money(b.rate)} / ${esc(SALARY_TYPE_MAP[b.salaryType]?.unit || 'month')}
              </div>
            </div>
            <div class="slip-block">
              ${row('Basic earnings', money(b.base))}
              ${b.otPay > 0 ? row(`Overtime (${b.otHours}h @ ${money(b.otRate)})`, money(b.otPay)) : ''}
              ${b.bonus > 0 ? row('Bonus', money(b.bonus)) : ''}
              ${row('Gross', money(b.gross), 'strong')}
            </div>
            <div class="slip-block">
              ${b.advanceRecovered > 0 ? row('Advance recovered', '−' + money(b.advanceRecovered)) : ''}
              ${b.otherDeduction > 0 ? row('Other deductions', '−' + money(b.otherDeduction)) : ''}
              ${row('Total deductions', '−' + money(b.totalDeduction), 'strong')}
            </div>
            <div class="slip-net">
              <span>Net pay</span><strong>${money(b.net)}</strong>
            </div>
            ${b.advanceOutstanding - b.advanceRecovered > 0
              ? `<p style="font-size:11.5px;color:var(--text-tertiary);margin-top:10px;">Advance still outstanding: ${money(b.advanceOutstanding - b.advanceRecovered)}</p>` : ''}
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" onclick="PayrollPage.closeModal()">Close</button>
            ${s.phone ? `<button class="btn btn-secondary" onclick="PayrollPage.whatsapp(${i})">${Icon.send(13)} WhatsApp</button>` : ''}
            <button class="btn btn-primary" onclick="window.print()">${Icon.printer(13)} Print</button>
          </div>
        </div>
      </div>`;
  },

  /** Sends the payslip summary as text — most staff read it on WhatsApp, not email. */
  whatsapp(i) {
    const r = this._rows[i];
    if (!r?.staff?.phone) return;
    const b = r.breakdown;
    const co = Store.get('company') || {};
    const msg = [
      `*${co.name || 'Payslip'}*`,
      `Payslip — ${monthLabel(this._month)}`,
      ``,
      `Name: ${r.staff.name}`,
      `Worked: ${b.workedLabel}`,
      `Earnings: ${money(b.base)}`,
      b.otPay > 0 ? `Overtime: ${money(b.otPay)}` : null,
      b.bonus > 0 ? `Bonus: ${money(b.bonus)}` : null,
      `Gross: ${money(b.gross)}`,
      b.totalDeduction > 0 ? `Deductions: ${money(b.totalDeduction)}` : null,
      ``,
      `*Net pay: ${money(b.net)}*`,
    ].filter(Boolean).join('\n');

    const phone = String(r.staff.phone).replace(/\D/g, '');
    const to = phone.length === 10 ? '91' + phone : phone;
    window.open(`https://wa.me/${to}?text=${encodeURIComponent(msg)}`, '_blank');
  },

  closeModal() { const m = document.getElementById('pr-modal'); if (m) m.innerHTML = ''; },
};

export default PayrollPage;
