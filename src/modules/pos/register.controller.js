/**
 * register.controller.js — Shift open, day close and Z-report
 *
 * The drawer is reconciled here: opening float, tender mix, cash pulled out
 * mid-shift, then a denomination count that produces the over/short figure.
 * Closed shifts stay readable so a day can be audited later.
 */

import Router from '../../core/router.js';
import Store  from '../../core/store.js';
import Toast  from '../../components/Toast.js';
import Icon   from '../../utils/icons.js';
import PosService from './pos.service.js';
import { formatCurrency, formatDate } from '../../utils/formatters.js';
import { POS_TENDERS, CASH_DENOMINATIONS, REGISTER_STATUS_BADGE } from '../../utils/constants.js';

const money = (v) => formatCurrency(v);
const esc   = (s) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const RegisterPage = {
  _open: null, _history: [], _counts: {}, _viewing: null,

  async init() {
    window.RegisterPage = this;
    Router.render(`
      <div class="page-header">
        <div class="page-header-left"><h1>Register</h1><p>Shift takings and day close</p></div>
        <div class="page-header-actions"><a href="#/pos" class="btn btn-primary btn-sm">${Icon.creditCard(14)} Back to counter</a></div>
      </div>
      <div id="reg-body"><div class="card" style="padding:40px;text-align:center;"><div class="spinner-sm"></div></div></div>
    `);

    if (!(await PosService.waitForCompany())) {
      document.getElementById('reg-body').innerHTML = `<div class="empty-state"><h3>No company selected</h3><p>Set up your company in Settings first.</p></div>`;
      return;
    }

    await this._load();
  },

  async _load() {
    try {
      const [open, history] = await Promise.all([
        PosService.getOpenRegister().catch(() => null),
        PosService.listRegisters().catch(() => []),
      ]);
      this._open    = open;
      this._history = history.filter(r => r.status === 'closed');
    } catch (e) {
      Toast.error(e.message);
    }
    this._render();
  },

  _render() {
    const el = document.getElementById('reg-body');
    if (!el) return;
    el.innerHTML = (this._open ? this._openShiftHTML() : this._closedShiftHTML()) + this._historyHTML();
    if (this._open) this._loadLiveSummary();
  },

  // ── NO SHIFT ─────────────────────────────────────────────────────────────
  _closedShiftHTML() {
    return `
      <div class="card" style="margin-bottom:16px;">
        <div class="card-body" style="text-align:center;padding:32px 20px;">
          <div class="empty-state-icon" style="margin:0 auto 12px;">${Icon.wallet(26)}</div>
          <h3 style="margin:0 0 4px;font-size:16px;">No shift is open</h3>
          <p style="color:var(--text-tertiary);font-size:13px;margin:0 0 18px;">
            Open a shift so the day's sales are grouped and the drawer can be counted at close.
          </p>
          <div style="max-width:260px;margin:0 auto;text-align:left;">
            <div class="form-group">
              <label class="form-label">Opening cash in drawer</label>
              <input id="reg-opening" class="input" type="number" step="0.01" value="0" onfocus="this.select()" />
              <span class="form-hint">The float you start the counter with.</span>
            </div>
            <button class="btn btn-primary" style="width:100%;" onclick="RegisterPage.openShift()">Open shift</button>
          </div>
        </div>
      </div>`;
  },

  async openShift() {
    const opening = parseFloat(document.getElementById('reg-opening')?.value) || 0;
    try {
      await PosService.openRegister({ openingCash: opening });
      Toast.success('Shift opened');
      await this._load();
    } catch (e) { Toast.error(e.message); }
  },

  // ── OPEN SHIFT ───────────────────────────────────────────────────────────
  _openShiftHTML() {
    const r = this._open;
    return `
      <div class="card" style="margin-bottom:16px;">
        <div class="card-header">
          <div>
            <h3 style="margin:0;font-size:15px;">Current shift <span class="${REGISTER_STATUS_BADGE.open} badge-dot" style="margin-left:6px;">Open</span></h3>
            <p style="margin:2px 0 0;font-size:12px;color:var(--text-tertiary);">
              Opened by ${esc(r.openedByName || '—')} · ${esc(r.openDate || '')} · float ${money(r.openingCash)}
            </p>
          </div>
          <div class="card-header-actions">
            <button class="btn btn-secondary btn-sm" onclick="RegisterPage.openCashOut()">${Icon.arrowUpOut(13)} Cash out</button>
            <button class="btn btn-danger btn-sm" onclick="RegisterPage.openCloseDialog()">Close shift &amp; count</button>
          </div>
        </div>
        <div class="card-body" id="reg-live">
          <div style="padding:20px;text-align:center;"><div class="spinner-sm"></div></div>
        </div>
      </div>`;
  },

  async _loadLiveSummary() {
    const el = document.getElementById('reg-live');
    if (!el || !this._open) return;
    try {
      const z = await PosService.zReport(this._open.id);
      this._open = { ...this._open, ...z.register };
      el.innerHTML = this._summaryHTML(z, true);
    } catch (e) {
      el.innerHTML = `<p style="color:var(--color-danger);font-size:12.5px;">${esc(e.message)}</p>`;
    }
  },

  /** Shared by the live panel and the read-only view of a closed shift. */
  _summaryHTML(z, live) {
    const r = z.register;
    const tenderRows = POS_TENDERS.map(t => {
      const amt = z.tenderTotals?.[t.id] || 0;
      if (!amt && t.id === 'credit') return '';
      return `<div class="reg-tender"><span>${esc(t.label)}</span><strong>${money(amt)}</strong></div>`;
    }).join('');

    return `
      <div class="reg-metrics">
        <div class="reg-metric"><span>Bills</span><strong>${z.saleCount}</strong></div>
        <div class="reg-metric"><span>Gross sales</span><strong>${money(z.grossTotal)}</strong></div>
        <div class="reg-metric"><span>Taxable</span><strong>${money(z.netTotal)}</strong></div>
        <div class="reg-metric"><span>GST collected</span><strong>${money(z.taxTotal)}</strong></div>
        <div class="reg-metric"><span>Discounts</span><strong>${money(z.discountTotal)}</strong></div>
        <div class="reg-metric accent"><span>Cash expected</span><strong>${money(z.expectedCash)}</strong></div>
      </div>

      <div class="reg-split">
        <div>
          <h4 class="reg-h4">Tender mix</h4>
          ${tenderRows || '<p class="pos-muted">No sales yet.</p>'}
          ${r.cashOut ? `<div class="reg-tender" style="color:var(--color-danger);"><span>Cash taken out</span><strong>−${money(r.cashOut)}</strong></div>` : ''}
          ${!live && r.countedCash !== undefined ? `
            <div class="reg-tender" style="border-top:1px solid var(--border-subtle);margin-top:6px;padding-top:8px;">
              <span>Counted</span><strong>${money(r.countedCash)}</strong>
            </div>
            <div class="reg-tender" style="color:${Math.abs(r.variance || 0) < 0.01 ? 'var(--color-success)' : 'var(--color-danger)'};">
              <span>${(r.variance || 0) < 0 ? 'Short' : 'Over'}</span><strong>${money(Math.abs(r.variance || 0))}</strong>
            </div>` : ''}
        </div>
        <div>
          <h4 class="reg-h4">Top items</h4>
          ${z.topItems.length === 0 ? '<p class="pos-muted">Nothing sold yet.</p>' : `
            <table class="data-table" style="font-size:12.5px;">
              <tbody>${z.topItems.map(i => `
                <tr><td>${esc(i.name)}</td><td class="text-right">${i.qty}</td><td class="text-right">${money(i.value)}</td></tr>
              `).join('')}</tbody>
            </table>`}
        </div>
      </div>`;
  },

  // ── CASH OUT ─────────────────────────────────────────────────────────────
  openCashOut() {
    this._modal('Take cash out of the drawer', `
      <div class="modal-body">
        <div class="form-group">
          <label class="form-label">Amount</label>
          <input id="co-amt" class="input" type="number" step="0.01" autofocus />
        </div>
        <div class="form-group">
          <label class="form-label">Reason</label>
          <input id="co-reason" class="input" placeholder="Bank drop, petty cash…" />
        </div>
        <p class="form-hint">This is deducted from the cash the drawer is expected to hold.</p>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="RegisterPage.closeModal()">Cancel</button>
        <button class="btn btn-primary" onclick="RegisterPage.saveCashOut()">Record</button>
      </div>`);
  },

  async saveCashOut() {
    const amt    = parseFloat(document.getElementById('co-amt')?.value) || 0;
    const reason = document.getElementById('co-reason')?.value || '';
    if (amt <= 0) { Toast.error('Enter an amount'); return; }
    try {
      await PosService.recordCashOut(this._open.id, amt, reason);
      this.closeModal();
      Toast.success(`${money(amt)} recorded as cash out`);
      await this._load();
    } catch (e) { Toast.error(e.message); }
  },

  // ── DAY CLOSE ────────────────────────────────────────────────────────────
  openCloseDialog() {
    this._counts = {};
    const expected = PosService.expectedCash(this._open);
    this._modal('Close shift — count the drawer', `
      <div class="modal-body">
        <p style="font-size:12.5px;color:var(--text-tertiary);margin:0 0 12px;">
          Enter how many notes and coins are in the drawer. The total is compared with
          <strong>${money(expected)}</strong> expected.
        </p>
        <div class="reg-denoms">
          ${CASH_DENOMINATIONS.map(d => `
            <div class="reg-denom">
              <span class="reg-denom-face">₹${d}</span>
              <span class="reg-denom-x">×</span>
              <input type="number" min="0" step="1" data-denom="${d}" value="" placeholder="0"
                     oninput="RegisterPage.recount()" onfocus="this.select()" />
              <span class="reg-denom-sub" id="denom-sub-${d}">₹0</span>
            </div>`).join('')}
        </div>
        <div class="reg-close-totals" id="reg-close-totals"></div>
        <div class="form-group" style="margin-top:12px;">
          <label class="form-label">Notes (optional)</label>
          <input id="reg-close-notes" class="input" placeholder="Anything worth recording about this shift" />
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="RegisterPage.closeModal()">Cancel</button>
        <button class="btn btn-danger" onclick="RegisterPage.confirmClose()">Close shift</button>
      </div>`, 520);
    this.recount();
  },

  recount() {
    let total = 0;
    document.querySelectorAll('[data-denom]').forEach(inp => {
      const d = parseInt(inp.dataset.denom, 10);
      const n = parseInt(inp.value, 10) || 0;
      const sub = d * n;
      total += sub;
      const subEl = document.getElementById(`denom-sub-${d}`);
      if (subEl) subEl.textContent = '₹' + sub.toLocaleString('en-IN');
      this._counts[d] = n;
    });

    const expected = PosService.expectedCash(this._open);
    const variance = Math.round((total - expected) * 100) / 100;
    const el = document.getElementById('reg-close-totals');
    if (!el) return;
    const ok = Math.abs(variance) < 0.01;
    el.innerHTML = `
      <div class="reg-close-row"><span>Counted</span><strong>${money(total)}</strong></div>
      <div class="reg-close-row"><span>Expected</span><strong>${money(expected)}</strong></div>
      <div class="reg-close-row ${ok ? 'ok' : variance < 0 ? 'short' : 'over'}">
        <span>${ok ? 'Tallies' : variance < 0 ? 'Short' : 'Over'}</span>
        <strong>${ok ? Icon.check(15) : money(Math.abs(variance))}</strong>
      </div>`;
    this._counted = total;
  },

  async confirmClose() {
    const notes = document.getElementById('reg-close-notes')?.value || '';
    try {
      const closed = await PosService.closeRegister(this._open.id, { countedCash: this._counted || 0, notes });
      this.closeModal();
      const v = closed.variance;
      if (Math.abs(v) < 0.01) Toast.success('Shift closed — drawer tallies exactly');
      else Toast.warning(`Shift closed — drawer is ${money(Math.abs(v))} ${v < 0 ? 'short' : 'over'}`);
      await this._load();
    } catch (e) { Toast.error(e.message); }
  },

  // ── HISTORY ──────────────────────────────────────────────────────────────
  _historyHTML() {
    if (this._history.length === 0) return '';
    return `
      <div class="card">
        <div class="card-header"><h3 style="margin:0;font-size:15px;">Past shifts</h3></div>
        <div class="table-wrapper">
          <table class="data-table">
            <thead><tr><th>Date</th><th>Opened by</th><th class="text-right">Bills</th><th class="text-right">Sales</th><th class="text-right">Expected</th><th class="text-right">Counted</th><th class="text-right">Over / short</th><th></th></tr></thead>
            <tbody>
              ${this._history.map(r => {
                const v = r.variance || 0;
                const col = Math.abs(v) < 0.01 ? 'var(--color-success)' : 'var(--color-danger)';
                return `<tr>
                  <td>${esc(r.closeDate || r.openDate || '—')}</td>
                  <td class="muted">${esc(r.openedByName || '—')}</td>
                  <td class="text-right">${r.saleCount || 0}</td>
                  <td class="col-amount">${money(r.salesTotal)}</td>
                  <td class="col-amount">${money(r.expectedCash)}</td>
                  <td class="col-amount">${money(r.countedCash)}</td>
                  <td class="col-amount" style="color:${col};">${Math.abs(v) < 0.01 ? '—' : (v < 0 ? '−' : '+') + money(Math.abs(v))}</td>
                  <td class="col-actions"><button class="btn btn-ghost btn-sm" onclick="RegisterPage.viewZ('${r.id}')">Z-report</button></td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>`;
  },

  async viewZ(id) {
    this._modal('Z-report', `<div class="modal-body"><div style="padding:30px;text-align:center;"><div class="spinner-sm"></div></div></div>`, 640);
    try {
      const z = await PosService.zReport(id);
      const r = z.register;
      this._modal(`Z-report · ${esc(r.closeDate || r.openDate || '')}`, `
        <div class="modal-body">${this._summaryHTML(z, false)}</div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="RegisterPage.closeModal()">Close</button>
          <button class="btn btn-primary" onclick="window.print()">${Icon.printer(13)} Print</button>
        </div>`, 640);
    } catch (e) {
      Toast.error(e.message);
      this.closeModal();
    }
  },

  // ── MODAL PLUMBING ───────────────────────────────────────────────────────
  _modal(title, body, width = 460) {
    document.getElementById('reg-modal')?.remove();
    const m = document.createElement('div');
    m.id = 'reg-modal';
    m.innerHTML = `
      <div class="modal-overlay" onclick="if(event.target===this)RegisterPage.closeModal()" style="z-index:400;">
        <div class="modal" style="max-width:${width}px;width:100%;">
          <div class="modal-header">
            <h3 style="margin:0;font-size:15px;font-weight:700;">${title}</h3>
            <button class="modal-close" onclick="RegisterPage.closeModal()">${Icon.x(15)}</button>
          </div>
          ${body}
        </div>
      </div>`;
    document.body.appendChild(m);
  },

  closeModal() { document.getElementById('reg-modal')?.remove(); },
};

export default RegisterPage;
