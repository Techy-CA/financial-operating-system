/**
 * staff.controller.js — Staff master and advances
 */

import Router from '../../core/router.js';
import Toast  from '../../components/Toast.js';
import Icon   from '../../utils/icons.js';
import PayrollService from './payroll.service.js';
import { formatCurrency, formatCurrencyShort, formatDate, formatPhone, initials, avatarColor } from '../../utils/formatters.js';
import { SALARY_TYPES, SALARY_TYPE_MAP, PAYMENT_METHODS } from '../../utils/constants.js';

const money = (v) => formatCurrency(v);
const esc   = (s) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const StaffPage = {
  _staff: [], _advances: [], _showInactive: false, _editing: null,

  async init() {
    window.StaffPage = this;
    Router.render(`
      <div class="page-header">
        <div class="page-header-left"><h1>Staff</h1><p id="st-count">Loading…</p></div>
        <div class="page-header-actions">
          <a href="#/attendance" class="btn btn-secondary btn-sm">${Icon.clipboard(14)} Attendance</a>
          <button class="btn btn-primary btn-sm" onclick="StaffPage.openForm()">+ Add staff</button>
        </div>
      </div>
      <div id="st-metrics" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;margin-bottom:16px;"></div>
      <div class="page-toolbar">
        <div class="input-wrapper" style="max-width:280px;">
          <input class="input" id="st-search" type="search" placeholder="Name or phone…" autocomplete="off" />
        </div>
        <div class="page-toolbar-right">
          <label style="display:flex;align-items:center;gap:6px;font-size:12.5px;color:var(--text-secondary);cursor:pointer;">
            <input type="checkbox" id="st-inactive" onchange="StaffPage.toggleInactive(this.checked)" /> Show inactive
          </label>
        </div>
      </div>
      <div class="card" id="st-table"><div style="padding:40px;text-align:center;"><div class="spinner-sm"></div></div></div>
      <div id="st-modal"></div>
    `);

    document.getElementById('st-search')?.addEventListener('input', () => this._filter());

    if (!(await PayrollService.waitForCompany())) {
      document.getElementById('st-table').innerHTML = `<div class="empty-state"><h3>No company selected</h3><p>Set up your company in Settings first.</p></div>`;
      return;
    }
    await this._load();
  },

  async _load() {
    const [staff, advances] = await Promise.all([
      PayrollService.listStaff(true).catch(() => []),
      PayrollService.listAdvances().catch(() => []),
    ]);
    this._staff = staff;
    this._advances = advances;
    this._renderMetrics();
    this._filter();
  },

  toggleInactive(v) { this._showInactive = v; this._filter(); },

  _renderMetrics() {
    const active = this._staff.filter(s => s.isActive !== false);
    const monthly = active.reduce((sum, s) => {
      const t = s.salaryType || 'monthly';
      // Daily/hourly staff have no fixed monthly commitment — only count fixed salaries
      return sum + (t === 'monthly' ? (parseFloat(s.salary) || 0) : 0);
    }, 0);
    const outstanding = PayrollService.outstandingAdvance(this._advances);

    const card = (label, value, sub, tone) => `
      <div class="metric-card">
        <div class="metric-label">${label}</div>
        <div class="metric-value" ${tone ? `style="color:${tone};"` : ''}>${value}</div>
        ${sub ? `<div class="metric-subtext">${sub}</div>` : ''}
      </div>`;

    document.getElementById('st-metrics').innerHTML =
      card('Active staff', active.length, `${this._staff.length - active.length} inactive`) +
      card('Fixed monthly salary', formatCurrencyShort(monthly), 'Monthly-paid staff') +
      card('Advances outstanding', formatCurrencyShort(outstanding), 'To recover from salary', outstanding > 0 ? 'var(--color-warning)' : null);
  },

  _filter() {
    const q = (document.getElementById('st-search')?.value || '').toLowerCase().trim();
    let list = this._showInactive ? this._staff : this._staff.filter(s => s.isActive !== false);
    if (q) list = list.filter(s => `${s.name} ${s.phone} ${s.role}`.toLowerCase().includes(q));
    this._renderTable(list);
    const c = document.getElementById('st-count');
    if (c) c.textContent = `${this._staff.filter(s => s.isActive !== false).length} active staff`;
  },

  _renderTable(list) {
    const wrap = document.getElementById('st-table');
    if (!wrap) return;
    if (list.length === 0) {
      wrap.innerHTML = `<div class="empty-state">
        <div class="empty-state-icon">${Icon.users(24)}</div>
        <h3>${this._staff.length === 0 ? 'No staff yet' : 'No results'}</h3>
        <p>${this._staff.length === 0 ? 'Add your team to track attendance, advances and salary.' : 'Try a different search.'}</p>
        ${this._staff.length === 0 ? `<button class="btn btn-primary" onclick="StaffPage.openForm()">Add first staff member</button>` : ''}
      </div>`;
      return;
    }

    wrap.innerHTML = `<div class="table-wrapper"><table class="data-table">
      <thead><tr><th>Name</th><th>Role</th><th>Phone</th><th>Salary</th><th class="text-right">Advance due</th><th>Status</th><th></th></tr></thead>
      <tbody>
        ${list.map(s => {
          const col = avatarColor(s.name || '');
          const adv = PayrollService.outstandingAdvance(this._advances.filter(a => a.staffId === s.id));
          const t   = SALARY_TYPE_MAP[s.salaryType || 'monthly'];
          return `<tr>
            <td>
              <div class="table-entity">
                <div class="table-entity-avatar" style="background:${col.bg};color:${col.text};">${esc(initials(s.name || '?'))}</div>
                <div><div class="table-entity-name">${esc(s.name || '—')}</div>
                ${s.joinDate ? `<div class="table-entity-sub">Joined ${formatDate(s.joinDate, 'short')}</div>` : ''}</div>
              </div>
            </td>
            <td class="muted">${esc(s.role || '—')}</td>
            <td class="muted">${s.phone ? formatPhone(s.phone) : '—'}</td>
            <td><strong>${money(s.salary)}</strong><span class="muted" style="font-size:11px;"> /${esc(t?.unit || 'month')}</span></td>
            <td class="col-amount" style="${adv > 0 ? 'color:var(--color-warning);font-weight:600;' : ''}">${adv > 0 ? money(adv) : '—'}</td>
            <td><span class="badge ${s.isActive === false ? 'badge-neutral' : 'badge-success'} badge-dot">${s.isActive === false ? 'Inactive' : 'Active'}</span></td>
            <td class="col-actions"><div class="row-actions">
              <button class="btn btn-secondary btn-sm" onclick="StaffPage.openAdvance('${s.id}')">Advance</button>
              <button class="btn btn-ghost btn-icon btn-sm" onclick="StaffPage.openForm('${s.id}')" title="Edit">${Icon.edit(14)}</button>
              ${s.isActive === false
                ? `<button class="btn btn-ghost btn-sm" onclick="StaffPage.reactivate('${s.id}')">Restore</button>`
                : `<button class="btn btn-ghost btn-icon btn-sm" style="color:var(--color-danger);" onclick="StaffPage.deactivate('${s.id}','${esc(s.name || '')}')" title="Deactivate">${Icon.x(14)}</button>`}
            </div></td>
          </tr>`;
        }).join('')}
      </tbody>
    </table></div>`;
  },

  // ── STAFF FORM ───────────────────────────────────────────────────────────
  openForm(id) {
    const s = id ? this._staff.find(x => x.id === id) : null;
    this._editing = id || null;

    this._modal(id ? 'Edit staff' : 'Add staff', `
      <div class="modal-body">
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Name *</label>
            <input id="sf-name" class="input" value="${esc(s?.name || '')}" placeholder="Full name" />
          </div>
          <div class="form-group">
            <label class="form-label">Role</label>
            <input id="sf-role" class="input" value="${esc(s?.role || '')}" placeholder="Helper, driver, sales…" />
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Phone</label>
            <input id="sf-phone" class="input" value="${esc(s?.phone || '')}" placeholder="10-digit mobile" />
          </div>
          <div class="form-group">
            <label class="form-label">Joining date</label>
            <input id="sf-join" class="input" type="date" value="${esc(s?.joinDate || new Date().toISOString().split('T')[0])}" />
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Salary type *</label>
            <select id="sf-type" class="select">
              ${SALARY_TYPES.map(t => `<option value="${t.id}" ${(s?.salaryType || 'monthly') === t.id ? 'selected' : ''}>${esc(t.label)}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Rate *</label>
            <input id="sf-salary" class="input" type="number" step="0.01" value="${s?.salary || ''}" placeholder="Amount per month / day / hour" />
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Overtime rate per hour</label>
            <input id="sf-ot" class="input" type="number" step="0.01" value="${s?.otRate || ''}" placeholder="Leave blank to auto-derive" />
            <span class="form-hint">Blank means day rate ÷ 8 for monthly staff.</span>
          </div>
          <div class="form-group">
            <label class="form-label">Payment method</label>
            <select id="sf-method" class="select">
              ${PAYMENT_METHODS.map(m => `<option value="${m.id}" ${s?.paymentMethod === m.id ? 'selected' : ''}>${esc(m.label)}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Notes</label>
          <input id="sf-notes" class="input" value="${esc(s?.notes || '')}" placeholder="Aadhaar, bank account, anything useful" />
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="StaffPage.closeModal()">Cancel</button>
        <button class="btn btn-primary" id="sf-save" onclick="StaffPage.save()">${id ? 'Save changes' : 'Add staff'}</button>
      </div>`, 560);
    document.getElementById('sf-name')?.focus();
  },

  async save() {
    const name   = document.getElementById('sf-name')?.value?.trim();
    const salary = parseFloat(document.getElementById('sf-salary')?.value) || 0;
    if (!name)     { Toast.error('Name is required'); return; }
    if (salary <= 0) { Toast.error('Enter a salary rate'); return; }

    const btn = document.getElementById('sf-save');
    btn.disabled = true; btn.textContent = 'Saving…';
    try {
      await PayrollService.saveStaff(this._editing, {
        name,
        role:       document.getElementById('sf-role')?.value?.trim() || null,
        phone:      document.getElementById('sf-phone')?.value?.trim() || null,
        joinDate:   document.getElementById('sf-join')?.value || null,
        salaryType: document.getElementById('sf-type')?.value || 'monthly',
        salary,
        otRate:     parseFloat(document.getElementById('sf-ot')?.value) || 0,
        paymentMethod: document.getElementById('sf-method')?.value || 'cash',
        notes:      document.getElementById('sf-notes')?.value?.trim() || null,
        isActive:   true,
      });
      this.closeModal();
      Toast.success(`${name} saved`);
      await this._load();
    } catch (e) {
      Toast.error('Save failed: ' + e.message);
      btn.disabled = false; btn.textContent = 'Save';
    }
  },

  async deactivate(id, name) {
    if (!confirm(`Mark ${name} as inactive?\n\nTheir attendance and past payslips are kept.`)) return;
    try { await PayrollService.deactivateStaff(id); Toast.success(`${name} marked inactive`); await this._load(); }
    catch (e) { Toast.error(e.message); }
  },

  async reactivate(id) {
    try { await PayrollService.reactivateStaff(id); Toast.success('Staff restored'); await this._load(); }
    catch (e) { Toast.error(e.message); }
  },

  // ── ADVANCES ─────────────────────────────────────────────────────────────
  openAdvance(staffId) {
    const s    = this._staff.find(x => x.id === staffId);
    const rows = this._advances.filter(a => a.staffId === staffId);
    const due  = PayrollService.outstandingAdvance(rows);

    this._modal(`Advance — ${esc(s?.name || '')}`, `
      <div class="modal-body">
        <div style="display:flex;justify-content:space-between;padding:10px 12px;background:${due > 0 ? 'var(--color-warning-light)' : 'var(--bg-subtle)'};border-radius:var(--radius-lg);margin-bottom:14px;">
          <span style="font-size:12.5px;color:var(--text-secondary);">Outstanding to recover</span>
          <strong style="font-size:15px;">${money(due)}</strong>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">New advance amount</label>
            <input id="ad-amt" class="input" type="number" step="0.01" placeholder="0.00" />
          </div>
          <div class="form-group">
            <label class="form-label">Date</label>
            <input id="ad-date" class="input" type="date" value="${new Date().toISOString().split('T')[0]}" />
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Reason</label>
          <input id="ad-notes" class="input" placeholder="Festival advance, medical…" />
        </div>
        ${rows.length ? `
          <h4 style="font-size:12px;text-transform:uppercase;letter-spacing:0.5px;color:var(--text-tertiary);margin:16px 0 6px;">History</h4>
          <table class="data-table" style="font-size:12.5px;">
            <thead><tr><th>Date</th><th>Reason</th><th class="text-right">Given</th><th class="text-right">Recovered</th></tr></thead>
            <tbody>${rows.map(a => `
              <tr><td>${formatDate(a.date, 'short')}</td><td class="muted">${esc(a.notes || '—')}</td>
              <td class="col-amount">${money(a.amount)}</td>
              <td class="col-amount" style="color:var(--color-success);">${money(a.recovered)}</td></tr>`).join('')}
            </tbody>
          </table>` : ''}
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="StaffPage.closeModal()">Close</button>
        <button class="btn btn-primary" onclick="StaffPage.saveAdvance('${staffId}')">Give advance</button>
      </div>`, 540);
  },

  async saveAdvance(staffId) {
    const amt = parseFloat(document.getElementById('ad-amt')?.value) || 0;
    if (amt <= 0) { Toast.error('Enter an amount'); return; }
    const s = this._staff.find(x => x.id === staffId);
    try {
      await PayrollService.giveAdvance({
        staffId, staffName: s?.name || '',
        amount: amt,
        date:   document.getElementById('ad-date')?.value,
        notes:  document.getElementById('ad-notes')?.value,
      });
      this.closeModal();
      Toast.success(`${money(amt)} advance recorded — it will be recovered at payroll`);
      await this._load();
    } catch (e) { Toast.error(e.message); }
  },

  // ── MODAL ────────────────────────────────────────────────────────────────
  _modal(title, body, width = 480) {
    document.getElementById('st-modal').innerHTML = `
      <div class="modal-overlay" onclick="if(event.target===this)StaffPage.closeModal()" style="z-index:400;">
        <div class="modal" style="max-width:${width}px;width:100%;">
          <div class="modal-header">
            <h3 style="margin:0;font-size:15px;font-weight:700;">${title}</h3>
            <button class="modal-close" onclick="StaffPage.closeModal()">${Icon.x(15)}</button>
          </div>
          ${body}
        </div>
      </div>`;
  },

  closeModal() { const m = document.getElementById('st-modal'); if (m) m.innerHTML = ''; },
};

export default StaffPage;
