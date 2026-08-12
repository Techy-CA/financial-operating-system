import Router from '../../core/router.js';
import Toast  from '../../components/Toast.js';
import Icon   from '../../utils/icons.js';
import { formatCurrency, formatCurrencyShort, formatDate } from '../../utils/formatters.js';
import { STOCK_REASONS, DEFAULT_WAREHOUSE } from '../../utils/constants.js';
import InventoryService from './inventory.service.js';
import StockModal       from './stock-modal.js';
import { downloadCSV }  from './csv.js';

const esc = (s) => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

const StockLedgerPage = {
  _moves: [], _items: [], _warehouses: [],
  _f: { type: 'all', reason: 'all', productId: 'all', warehouseId: 'all', from: '', to: '' },

  async init() {
    Router.render(`
      <div class="page-header">
        <div class="page-header-left"><h1>Stock ledger</h1><p id="lg-sub">Loading movements…</p></div>
        <div class="page-header-actions" style="display:flex;gap:6px;flex-wrap:wrap;">
          <button class="btn btn-secondary btn-sm" onclick="StockLedgerPage.act('in')">${Icon.arrowDownIn(14)} Stock in</button>
          <button class="btn btn-secondary btn-sm" onclick="StockLedgerPage.act('out')">${Icon.arrowUpOut(14)} Stock out</button>
          <button class="btn btn-ghost btn-sm" onclick="StockLedgerPage.exportCSV()">${Icon.download(14)} Export</button>
          <a href="#/inventory" class="btn btn-primary btn-sm">${Icon.packages(14)} Stock summary</a>
        </div>
      </div>

      <div class="card mb-4"><div class="card-body">
        <div class="form-row-3" style="align-items:end;">
          <div class="form-group">
            <label class="form-label">Item</label>
            <select class="select" id="lg-item"><option value="all">All items</option></select>
          </div>
          <div class="form-group">
            <label class="form-label">Direction</label>
            <select class="select" id="lg-type">
              <option value="all">In &amp; out</option><option value="in">Stock in</option><option value="out">Stock out</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Reason</label>
            <select class="select" id="lg-reason">
              <option value="all">All reasons</option>
              ${Object.entries(STOCK_REASONS).map(([id, r]) => `<option value="${id}">${r.label}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="form-row-3" style="align-items:end;">
          <div class="form-group">
            <label class="form-label">Location</label>
            <select class="select" id="lg-wh"><option value="all">All locations</option></select>
          </div>
          <div class="form-group"><label class="form-label">From</label><input class="input" type="date" id="lg-from" /></div>
          <div class="form-group"><label class="form-label">To</label><input class="input" type="date" id="lg-to" /></div>
        </div>
      </div></div>

      <div class="grid-3 mb-4" id="lg-metrics">
        ${Array(3).fill('<div class="skeleton" style="height:78px;border-radius:12px;"></div>').join('')}
      </div>

      <div class="card" id="lg-table"><div style="padding:40px;text-align:center;"><div class="spinner-sm"></div></div></div>
    `);

    window.StockLedgerPage = this;

    try {
      [this._moves, this._items, this._warehouses] = await Promise.all([
        InventoryService.listMovements({ limit: 1000 }),
        InventoryService.listItems(),
        InventoryService.listWarehouses(),
      ]);
    } catch (e) { Toast.error(e.message); this._moves = []; }

    const itemSel = document.getElementById('lg-item');
    if (itemSel) itemSel.innerHTML = `<option value="all">All items</option>` +
      this._items.map(i => `<option value="${esc(i.id)}">${esc(i.name)}</option>`).join('');
    const whSel = document.getElementById('lg-wh');
    if (whSel) whSel.innerHTML = `<option value="all">All locations</option>` +
      this._warehouses.map(w => `<option value="${esc(w.id)}">${esc(w.name)}</option>`).join('');

    const bind = (id, key) => document.getElementById(id)?.addEventListener('change', (e) => { this._f[key] = e.target.value; this._render(); });
    bind('lg-item', 'productId'); bind('lg-type', 'type'); bind('lg-reason', 'reason');
    bind('lg-wh', 'warehouseId'); bind('lg-from', 'from'); bind('lg-to', 'to');

    this._render();
  },

  _visible() {
    const f = this._f;
    return this._moves.filter(m => {
      if (f.type !== 'all'        && m.type !== f.type) return false;
      if (f.reason !== 'all'      && m.reason !== f.reason) return false;
      if (f.productId !== 'all'   && m.productId !== f.productId) return false;
      if (f.warehouseId !== 'all' && (m.warehouseId || DEFAULT_WAREHOUSE.id) !== f.warehouseId) return false;
      const d = m.date || '';
      if (f.from && d && d < f.from) return false;
      if (f.to   && d && d > f.to)   return false;
      return true;
    });
  },

  _render() {
    const list = this._visible();
    const inQty  = list.filter(m => m.type === 'in').reduce((s, m) => s + (m.qty || 0), 0);
    const outQty = list.filter(m => m.type === 'out').reduce((s, m) => s + (m.qty || 0), 0);
    const inVal  = list.filter(m => m.type === 'in').reduce((s, m) => s + (m.value || 0), 0);
    const outVal = list.filter(m => m.type === 'out').reduce((s, m) => s + (m.value || 0), 0);

    const sub = document.getElementById('lg-sub');
    if (sub) sub.textContent = `${this._moves.length} movement${this._moves.length === 1 ? '' : 's'} recorded · showing ${list.length}`;

    const met = document.getElementById('lg-metrics');
    if (met) met.innerHTML = `
      <div class="metric-card"><div class="metric-label">Inward</div><div class="metric-value" style="color:var(--color-success);">${Math.round(inQty * 1000) / 1000}</div><div class="metric-subtext">₹${formatCurrencyShort(inVal)} received</div></div>
      <div class="metric-card"><div class="metric-label">Outward</div><div class="metric-value" style="color:var(--color-danger);">${Math.round(outQty * 1000) / 1000}</div><div class="metric-subtext">₹${formatCurrencyShort(outVal)} issued at cost</div></div>
      <div class="metric-card"><div class="metric-label">Net change</div><div class="metric-value">${Math.round((inQty - outQty) * 1000) / 1000}</div><div class="metric-subtext">units over the filtered period</div></div>`;

    const wrap = document.getElementById('lg-table');
    if (!wrap) return;

    if (list.length === 0) {
      wrap.innerHTML = `<div class="empty-state"><div class="empty-state-icon">${Icon.history(24)}</div>
        <h3>${this._moves.length === 0 ? 'No stock movements yet' : 'No movements match these filters'}</h3>
        <p>${this._moves.length === 0 ? 'Receive stock or raise an invoice — every quantity change is logged here with a running balance.' : 'Widen the date range or clear a filter.'}</p>
        ${this._moves.length === 0 ? `<button class="btn btn-primary" onclick="StockLedgerPage.act('in')">Record stock in</button>` : ''}</div>`;
      return;
    }

    wrap.innerHTML = `<div class="table-wrapper"><table class="data-table">
      <thead><tr><th>Date</th><th>Item</th><th>Type</th><th>Reason</th><th>Reference</th><th>Location</th><th class="text-right">Qty</th><th class="text-right">Value</th><th class="text-right">Balance</th><th>By</th></tr></thead>
      <tbody>
        ${list.map(m => `<tr>
          <td class="muted" style="white-space:nowrap;">${formatDate(m.date || m.createdAt)}</td>
          <td><a href="#/inventory/${esc(m.productId)}" style="font-weight:600;color:var(--text-primary);">${esc(m.productName)}</a>
            ${m.sku ? `<div style="font-size:11px;color:var(--text-tertiary);font-family:var(--font-mono);">${esc(m.sku)}</div>` : ''}</td>
          <td><span class="badge ${m.type === 'in' ? 'badge-success' : 'badge-danger'}">${m.type === 'in' ? 'IN' : 'OUT'}</span></td>
          <td style="font-size:12.5px;">${esc(InventoryService.reasonLabel(m.reason))}</td>
          <td style="font-size:12px;">${m.refType === 'invoice' && m.refId
              ? `<a href="#/invoices/${esc(m.refId)}" style="color:var(--brand-primary);font-weight:600;">${esc(m.refNumber || 'Invoice')}</a>`
              : `<span class="muted">${esc(m.refNumber || '—')}</span>`}</td>
          <td class="muted">${esc(m.warehouseName || DEFAULT_WAREHOUSE.name)}</td>
          <td class="text-right" style="font-weight:700;color:${m.type === 'in' ? 'var(--color-success)' : 'var(--color-danger)'};">${m.type === 'in' ? '+' : '−'}${m.qty} <span style="font-weight:400;color:var(--text-tertiary);font-size:11px;">${esc(m.unit || '')}</span></td>
          <td class="col-amount">₹${formatCurrency(m.value || 0)}</td>
          <td class="text-right" style="font-weight:600;${(m.balanceAfter || 0) < 0 ? 'color:var(--color-danger);' : ''}">${m.balanceAfter}</td>
          <td class="muted">${esc(m.createdByName || '—')}</td>
        </tr>`).join('')}
      </tbody>
    </table>
    <div class="card-footer" style="display:flex;justify-content:space-between;align-items:center;">
      <span style="font-size:12px;color:var(--text-tertiary);">Showing ${list.length} of ${this._moves.length}</span>
      <span style="font-size:12px;font-weight:600;">Inward ₹${formatCurrencyShort(inVal)} · Outward ₹${formatCurrencyShort(outVal)}</span>
    </div></div>`;
  },

  act(mode) {
    StockModal.open({ mode, items: this._items, warehouses: this._warehouses, onDone: () => this.init() });
  },

  exportCSV() {
    const list = this._visible();
    if (list.length === 0) { Toast.error('Nothing to export'); return; }
    downloadCSV(
      `stock-ledger-${new Date().toISOString().split('T')[0]}.csv`,
      ['Date', 'Item', 'SKU', 'Type', 'Reason', 'Reference', 'Location', 'Qty', 'Unit', 'Rate', 'Value', 'Balance', 'By', 'Notes'],
      list.map(m => [
        m.date || '', m.productName || '', m.sku || '', m.type === 'in' ? 'IN' : 'OUT',
        InventoryService.reasonLabel(m.reason), m.refNumber || '', m.warehouseName || '',
        (m.type === 'in' ? '' : '-') + m.qty, m.unit || '', m.rate || 0, m.value || 0,
        m.balanceAfter, m.createdByName || '', m.notes || '',
      ]),
    );
    Toast.success(`${list.length} movements exported`);
  },
};

export default StockLedgerPage;
