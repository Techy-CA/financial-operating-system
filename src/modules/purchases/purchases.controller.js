/**
 * purchases.controller.js — Vendor bills list, payables and payment recording
 */

import Router from '../../core/router.js';
import Toast  from '../../components/Toast.js';
import Icon   from '../../utils/icons.js';
import PurchaseService from './purchases.service.js';
import { formatCurrency, formatCurrencyShort, formatDate, initials, avatarColor, overdueDays } from '../../utils/formatters.js';
import { BILL_STATUS_LABELS, BILL_STATUS_BADGE, PAYMENT_METHODS } from '../../utils/constants.js';

const money = (v) => formatCurrency(v);
const esc   = (s) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const PurchasesPage = {
  _list: [], _tab: 'all', _payTarget: null,

  async init() {
    window.PurchasesPage = this;
    Router.render(`
      <div class="page-header">
        <div class="page-header-left"><h1>Purchase bills</h1><p id="bill-count">Loading…</p></div>
        <div class="page-header-actions"><a href="#/purchases/new" class="btn btn-primary btn-sm">+ New bill</a></div>
      </div>
      <div id="bill-metrics" class="metrics-row" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;margin-bottom:16px;"></div>
      <div class="tabs" id="bill-tabs"></div>
      <div class="page-toolbar">
        <div class="input-wrapper" style="max-width:280px;">
          <input class="input" id="bill-search" type="search" placeholder="Bill #, vendor…" autocomplete="off" />
        </div>
      </div>
      <div class="card" id="bill-table"><div style="padding:40px;text-align:center;"><div class="spinner-sm"></div></div></div>
      <div id="bill-modal"></div>
    `);

    document.getElementById('bill-search')?.addEventListener('input', () => this._filter());

    if (!(await PurchaseService.waitForCompany())) {
      document.getElementById('bill-table').innerHTML = `<div class="empty-state"><h3>No company selected</h3><p>Set up your company in Settings first.</p></div>`;
      return;
    }

    this._list = await PurchaseService.list().catch(() => []);
    this._renderMetrics();
    this._renderTabs();
    this._filter();
  },

  _renderMetrics() {
    const s = PurchaseService.stats(this._list);
    const el = document.getElementById('bill-metrics');
    if (!el) return;
    const card = (label, value, sub, tone) => `
      <div class="metric-card">
        <div class="metric-label">${label}</div>
        <div class="metric-value" ${tone ? `style="color:${tone};"` : ''}>${value}</div>
        ${sub ? `<div class="metric-subtext">${sub}</div>` : ''}
      </div>`;
    el.innerHTML =
      card('Total purchases', formatCurrencyShort(s.totalValue), `${s.count} bills`) +
      card('Payable', formatCurrencyShort(s.payable), 'Outstanding to vendors', 'var(--color-warning)') +
      card('Overdue', formatCurrencyShort(s.overdue), 'Past due date', s.overdue > 0 ? 'var(--color-danger)' : null) +
      card('Input tax credit', formatCurrencyShort(s.itc), 'GST claimable', 'var(--color-success)');
  },

  _renderTabs() {
    const tabs = ['all', 'received', 'partial', 'paid', 'overdue', 'draft'];
    const counts = {};
    tabs.forEach(t => counts[t] = t === 'all' ? this._list.length : this._list.filter(b => b.status === t).length);
    const el = document.getElementById('bill-tabs');
    if (el) el.innerHTML = tabs.map(t => `
      <button class="tab-item ${this._tab === t ? 'active' : ''}" onclick="PurchasesPage.setTab('${t}')">
        ${t.charAt(0).toUpperCase() + t.slice(1)}${counts[t] > 0 ? `<span class="tab-count">${counts[t]}</span>` : ''}
      </button>`).join('');

    const total = this._list.reduce((s, b) => s + (b.grandTotal || 0), 0);
    const c = document.getElementById('bill-count');
    if (c) c.textContent = `${this._list.length} bills · ${formatCurrencyShort(total)} total`;
  },

  setTab(t) { this._tab = t; this._renderTabs(); this._filter(); },

  _filter() {
    const q = (document.getElementById('bill-search')?.value || '').toLowerCase().trim();
    let list = this._tab === 'all' ? this._list : this._list.filter(b => b.status === this._tab);
    if (q) list = list.filter(b => `${b.billNumber} ${b.vendorBillNumber} ${b.vendorName}`.toLowerCase().includes(q));
    this._renderTable(list);
  },

  _renderTable(list) {
    const wrap = document.getElementById('bill-table');
    if (!wrap) return;
    if (list.length === 0) {
      wrap.innerHTML = `<div class="empty-state">
        <div class="empty-state-icon">${Icon.truck(24)}</div>
        <h3>${this._list.length === 0 ? 'No purchase bills yet' : 'No results'}</h3>
        <p>${this._list.length === 0 ? 'Record what you buy — stock comes in and input tax credit is tracked automatically.' : 'Try a different filter.'}</p>
        ${this._list.length === 0 ? `<a href="#/purchases/new" class="btn btn-primary">Record first bill</a>` : ''}
      </div>`;
      return;
    }

    wrap.innerHTML = `<div class="table-wrapper"><table class="data-table">
      <thead><tr><th>Bill #</th><th>Vendor</th><th>Vendor ref</th><th>Date</th><th>Due</th><th>Status</th><th class="text-right">Amount</th><th class="text-right">Balance</th><th></th></tr></thead>
      <tbody>
        ${list.map(b => {
          const col = avatarColor(b.vendorName || '');
          const od  = b.status === 'overdue' ? overdueDays(b.dueDate) : 0;
          return `<tr>
            <td><a href="#/purchases/${b.id}/edit" style="font-weight:700;color:var(--brand-primary);">${esc(b.billNumber || '—')}</a></td>
            <td>
              <div class="table-entity">
                <div class="table-entity-avatar" style="background:${col.bg};color:${col.text};">${esc(initials(b.vendorName || '?'))}</div>
                <span style="font-size:13px;font-weight:500;">${esc(b.vendorName || '—')}</span>
              </div>
            </td>
            <td class="muted">${esc(b.vendorBillNumber || '—')}</td>
            <td class="muted">${formatDate(b.billDate)}</td>
            <td class="muted">${formatDate(b.dueDate)}${od > 0 ? `<br><span style="font-size:10.5px;color:var(--color-danger);">${od}d late</span>` : ''}</td>
            <td><span class="${BILL_STATUS_BADGE[b.status] || 'badge badge-neutral'} badge-dot">${BILL_STATUS_LABELS[b.status] || b.status}</span></td>
            <td class="col-amount">${money(b.grandTotal)}</td>
            <td class="col-amount" style="${b.balanceDue > 0 ? 'color:var(--color-warning);font-weight:600;' : ''}">${money(b.balanceDue)}</td>
            <td class="col-actions"><div class="row-actions">
              ${b.balanceDue > 0.5 ? `<button class="btn btn-secondary btn-sm" onclick="PurchasesPage.openPay('${b.id}')">Pay</button>` : ''}
              <a href="#/purchases/${b.id}/edit" class="btn btn-ghost btn-icon btn-sm" title="Edit">${Icon.edit(14)}</a>
              <button class="btn btn-ghost btn-icon btn-sm" style="color:var(--color-danger);" onclick="PurchasesPage.del('${b.id}','${esc(b.billNumber || '')}')" title="Delete">${Icon.trash(14)}</button>
            </div></td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>
    <div class="card-footer" style="display:flex;justify-content:space-between;align-items:center;">
      <span style="font-size:12px;color:var(--text-tertiary);">Showing ${list.length} of ${this._list.length}</span>
      <span style="font-size:12px;font-weight:600;">Payable: ${formatCurrencyShort(list.reduce((s, b) => s + (b.balanceDue || 0), 0))}</span>
    </div></div>`;
  },

  // ── PAY A BILL ───────────────────────────────────────────────────────────
  openPay(id) {
    const b = this._list.find(x => x.id === id);
    if (!b) return;
    this._payTarget = b;
    document.getElementById('bill-modal').innerHTML = `
      <div class="modal-overlay" onclick="if(event.target===this)PurchasesPage.closeModal()" style="z-index:400;">
        <div class="modal" style="max-width:420px;width:100%;">
          <div class="modal-header">
            <h3 style="margin:0;font-size:15px;font-weight:700;">Pay ${esc(b.vendorName || 'vendor')}</h3>
            <button class="modal-close" onclick="PurchasesPage.closeModal()">${Icon.x(15)}</button>
          </div>
          <div class="modal-body">
            <div style="display:flex;justify-content:space-between;padding:10px 12px;background:var(--bg-subtle);border-radius:var(--radius-lg);margin-bottom:14px;">
              <span style="font-size:12.5px;color:var(--text-secondary);">Balance on ${esc(b.billNumber)}</span>
              <strong style="font-size:15px;">${money(b.balanceDue)}</strong>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Amount</label>
                <input id="bp-amt" class="input" type="number" step="0.01" value="${b.balanceDue}" onfocus="this.select()" />
              </div>
              <div class="form-group">
                <label class="form-label">Date</label>
                <input id="bp-date" class="input" type="date" value="${new Date().toISOString().split('T')[0]}" />
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">Method</label>
              <select id="bp-method" class="select">
                ${PAYMENT_METHODS.map(m => `<option value="${m.id}">${esc(m.label)}</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Reference (optional)</label>
              <input id="bp-ref" class="input" placeholder="UTR / cheque no." />
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" onclick="PurchasesPage.closeModal()">Cancel</button>
            <button class="btn btn-primary" id="bp-save" onclick="PurchasesPage.savePay()">Record payment</button>
          </div>
        </div>
      </div>`;
  },

  closeModal() { const m = document.getElementById('bill-modal'); if (m) m.innerHTML = ''; },

  async savePay() {
    const b   = this._payTarget;
    const amt = parseFloat(document.getElementById('bp-amt')?.value) || 0;
    const btn = document.getElementById('bp-save');
    if (amt <= 0) { Toast.error('Enter an amount'); return; }
    if (amt > b.balanceDue + 0.5 && !confirm('That is more than the balance due. Record it anyway?')) return;

    btn.disabled = true; btn.textContent = 'Saving…';
    try {
      await PurchaseService.recordPayment(b, {
        amount:    amt,
        method:    document.getElementById('bp-method')?.value,
        date:      document.getElementById('bp-date')?.value,
        reference: document.getElementById('bp-ref')?.value,
      });
      this.closeModal();
      Toast.success(`${money(amt)} paid to ${b.vendorName || 'vendor'}`);
      this._list = await PurchaseService.list().catch(() => this._list);
      this._renderMetrics(); this._renderTabs(); this._filter();
    } catch (e) {
      Toast.error('Failed: ' + e.message);
      btn.disabled = false; btn.textContent = 'Record payment';
    }
  },

  async del(id, num) {
    if (!confirm(`Delete bill ${num}?\n\nAny stock this bill brought in will be taken back out.`)) return;
    try {
      await PurchaseService.delete(id);
      this._list = this._list.filter(b => b.id !== id);
      this._renderMetrics(); this._renderTabs(); this._filter();
      Toast.success(`Bill ${num} deleted`);
    } catch (e) { Toast.error('Delete failed: ' + e.message); }
  },
};

export default PurchasesPage;
