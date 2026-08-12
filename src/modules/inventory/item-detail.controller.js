import Router from '../../core/router.js';
import Topbar from '../../components/Topbar.js';
import Toast  from '../../components/Toast.js';
import Icon   from '../../utils/icons.js';
import { formatCurrency, formatCurrencyShort, formatDate } from '../../utils/formatters.js';
import { STOCK_STATUS_LABELS, STOCK_STATUS_BADGE, DEFAULT_WAREHOUSE } from '../../utils/constants.js';
import InventoryService from './inventory.service.js';
import StockModal       from './stock-modal.js';
import { downloadCSV }  from './csv.js';

const esc = (s) => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

const ItemStockPage = {
  _item: null, _moves: [], _warehouses: [],

  async init(id) {
    this._id = id;
    Topbar.render({ breadcrumb: [{ label: 'Inventory', route: '/inventory' }, { label: 'Item' }] });
    Router.render(`<div class="card"><div style="padding:60px;text-align:center;"><div class="spinner-sm"></div></div></div>`);

    if (!await InventoryService.waitForCompany()) {
      Router.render(`<div class="empty-state" style="padding-top:60px;"><div class="empty-state-icon">${Icon.building(24)}</div>
        <h3>Set up your company first</h3><a href="#/settings" class="btn btn-primary">Go to Settings</a></div>`);
      return;
    }

    try {
      const [item, moves, warehouses] = await Promise.all([
        InventoryService.getItem(id),
        InventoryService.listMovements({ productId: id }),
        InventoryService.listWarehouses(),
      ]);
      if (!item) throw new Error('Item not found');
      this._item = InventoryService.decorate(item);
      this._moves = moves;
      this._warehouses = warehouses;
    } catch (e) {
      Router.render(`<div class="empty-state" style="padding-top:60px;"><div class="empty-state-icon">${Icon.alertTriangle(24)}</div><h3>${esc(e.message)}</h3><a href="#/inventory" class="btn btn-primary">Back to inventory</a></div>`);
      return;
    }

    Topbar.render({ breadcrumb: [{ label: 'Inventory', route: '/inventory' }, { label: this._item.name || 'Item' }] });
    window.ItemStockPage = this;
    this._render();
  },

  _totals() {
    const inQty  = this._moves.filter(m => m.type === 'in').reduce((s, m) => s + (m.qty || 0), 0);
    const outQty = this._moves.filter(m => m.type === 'out').reduce((s, m) => s + (m.qty || 0), 0);
    const sold   = this._moves.filter(m => m.reason === 'sale').reduce((s, m) => s + (m.qty || 0), 0);
    const purch  = this._moves.filter(m => m.reason === 'purchase').reduce((s, m) => s + (m.value || 0), 0);
    return { inQty: Math.round(inQty * 1000) / 1000, outQty: Math.round(outQty * 1000) / 1000, sold, purchaseValue: purch };
  },

  _render() {
    const i = this._item;
    const t = this._totals();
    const unit = i.unit || 'Nos';
    const byWh = Object.entries(i.stockByWarehouse || {}).filter(([, q]) => q !== 0);

    Router.render(`
      <div class="page-header">
        <div class="page-header-left">
          <h1 style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">${esc(i.name)}
            <span class="${STOCK_STATUS_BADGE[i.stockStatus]} badge-dot" style="font-size:12px;">${STOCK_STATUS_LABELS[i.stockStatus]}</span>
          </h1>
          <p>${esc(i.sku ? `SKU ${i.sku} · ` : '')}${esc(i.hsn ? `HSN ${i.hsn} · ` : '')}${i.rate ? `Selling ${formatCurrency(i.rate)}` : ''} ${i.gstRate ? `· GST ${i.gstRate}%` : ''}</p>
        </div>
        <div class="page-header-actions" style="display:flex;gap:6px;flex-wrap:wrap;">
          <button class="btn btn-secondary btn-sm" onclick="ItemStockPage.act('in')">${Icon.arrowDownIn(14)} Stock in</button>
          <button class="btn btn-secondary btn-sm" onclick="ItemStockPage.act('out')">${Icon.arrowUpOut(14)} Stock out</button>
          <button class="btn btn-secondary btn-sm" onclick="ItemStockPage.act('adjust')">${Icon.sliders(14)} Count</button>
          <a href="#/products/${esc(i.id)}" class="btn btn-ghost btn-sm">${Icon.edit(14)} Edit item</a>
        </div>
      </div>

      <div class="grid-4 mb-4">
        <div class="metric-card">
          <div class="metric-label">In stock</div>
          <div class="metric-value" style="${i.stockQty < 0 ? 'color:var(--color-danger);' : ''}">${i.stockQty} <span style="font-size:14px;font-weight:500;color:var(--text-tertiary);">${esc(unit)}</span></div>
          <div class="metric-subtext">${i.reorderLevel ? `reorder at ${i.reorderLevel}` : 'no reorder level set'}</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">Stock value</div>
          <div class="metric-value">${formatCurrencyShort(i.stockValue)}</div>
          <div class="metric-subtext">avg cost ${formatCurrency(i.avgCost || 0)}</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">Received (all time)</div>
          <div class="metric-value" style="color:var(--color-success);">${t.inQty}</div>
          <div class="metric-subtext">${formatCurrencyShort(t.purchaseValue)} purchased</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">Issued (all time)</div>
          <div class="metric-value" style="color:var(--color-danger);">${t.outQty}</div>
          <div class="metric-subtext">${t.sold} ${esc(unit)} sold on invoices</div>
        </div>
      </div>

      ${i.stockStatus !== 'in_stock' ? `
        <div style="display:flex;align-items:center;gap:10px;padding:11px 14px;border:1px solid ${i.stockStatus === 'negative' ? '#FECACA' : '#FDE68A'};background:${i.stockStatus === 'negative' ? '#FEF2F2' : '#FFFBEB'};border-radius:11px;margin-bottom:16px;font-size:12.5px;color:${i.stockStatus === 'negative' ? '#991B1B' : '#78350F'};">
          <span style="flex-shrink:0;">${Icon.alertTriangle(15)}</span>
          <span style="flex:1;">${
            i.stockStatus === 'negative' ? 'More units have been invoiced than were ever received. Book the missing purchase or run a stock count.'
            : i.stockStatus === 'out_of_stock' ? 'This item is out of stock. New invoices will push the balance negative.'
            : `Only ${i.stockQty} ${esc(unit)} left — at or below the reorder level of ${i.reorderLevel}.`}</span>
          <button class="btn btn-secondary btn-sm" onclick="ItemStockPage.act('in')">Add stock</button>
        </div>` : ''}

      ${byWh.length > 1 ? `
        <div class="card mb-4">
          <div class="card-header"><h2>Stock by location</h2></div>
          <div class="card-body" style="display:flex;gap:10px;flex-wrap:wrap;">
            ${byWh.map(([id, q]) => {
              const wh = this._warehouses.find(w => w.id === id);
              return `<div style="border:1px solid var(--border-subtle);border-radius:10px;padding:10px 14px;min-width:140px;">
                <div style="font-size:11.5px;color:var(--text-tertiary);">${esc(wh?.name || id)}</div>
                <div style="font-size:17px;font-weight:700;color:${q < 0 ? 'var(--color-danger)' : 'var(--text-primary)'};">${q} <span style="font-size:12px;font-weight:500;color:var(--text-tertiary);">${esc(unit)}</span></div>
              </div>`;
            }).join('')}
          </div>
        </div>` : ''}

      <div class="card">
        <div class="card-header">
          <h2>Stock ledger</h2>
          <div class="card-header-actions">
            <button class="btn btn-ghost btn-sm" onclick="ItemStockPage.exportCSV()">${Icon.download(13)} Export</button>
          </div>
        </div>
        ${this._ledgerHTML()}
      </div>
    `);
  },

  _ledgerHTML() {
    if (this._moves.length === 0) {
      return `<div class="empty-state"><div class="empty-state-icon">${Icon.history(24)}</div><h3>No movements yet</h3><p>Every stock in, stock out and sale will be listed here with a running balance.</p></div>`;
    }
    const unit = this._item.unit || 'Nos';
    return `<div class="table-wrapper"><table class="data-table">
      <thead><tr><th>Date</th><th>Type</th><th>Reason</th><th>Reference</th><th>Location</th><th class="text-right">Qty</th><th class="text-right">Rate</th><th class="text-right">Value</th><th class="text-right">Balance</th><th>By</th></tr></thead>
      <tbody>
        ${this._moves.map(m => `<tr>
          <td class="muted" style="white-space:nowrap;">${formatDate(m.date || m.createdAt)}</td>
          <td><span class="badge ${m.type === 'in' ? 'badge-success' : 'badge-danger'}">${m.type === 'in' ? 'IN' : 'OUT'}</span></td>
          <td style="font-size:12.5px;">${esc(InventoryService.reasonLabel(m.reason))}</td>
          <td style="font-size:12px;">${m.refType === 'invoice' && m.refId
              ? `<a href="#/invoices/${esc(m.refId)}" style="color:var(--brand-primary);font-weight:600;">${esc(m.refNumber || 'Invoice')}</a>`
              : `<span class="muted">${esc(m.refNumber || '—')}</span>`}</td>
          <td class="muted">${esc(m.warehouseName || DEFAULT_WAREHOUSE.name)}</td>
          <td class="text-right" style="font-weight:700;color:${m.type === 'in' ? 'var(--color-success)' : 'var(--color-danger)'};">${m.type === 'in' ? '+' : '−'}${m.qty}</td>
          <td class="col-amount">${formatCurrency(m.rate || 0)}</td>
          <td class="col-amount">${formatCurrency(m.value || 0)}</td>
          <td class="text-right" style="font-weight:600;${(m.balanceAfter || 0) < 0 ? 'color:var(--color-danger);' : ''}">${m.balanceAfter} ${esc(unit)}</td>
          <td class="muted">${esc(m.createdByName || '—')}</td>
        </tr>`).join('')}
      </tbody>
    </table>
    <div class="card-footer" style="text-align:right;font-size:12px;color:var(--text-tertiary);">${this._moves.length} movement${this._moves.length === 1 ? '' : 's'}</div>
    </div>`;
  },

  act(mode) {
    StockModal.open({
      mode,
      item:       this._item,
      warehouses: this._warehouses,
      onDone:     () => this.init(this._id),
    });
  },

  exportCSV() {
    if (this._moves.length === 0) { Toast.error('Nothing to export'); return; }
    downloadCSV(
      `stock-ledger-${(this._item.name || 'item').replace(/\W+/g, '-').toLowerCase()}.csv`,
      ['Date', 'Type', 'Reason', 'Reference', 'Location', 'Qty', 'Rate', 'Value', 'Balance', 'By', 'Notes'],
      this._moves.map(m => [
        m.date || '', m.type === 'in' ? 'IN' : 'OUT', InventoryService.reasonLabel(m.reason),
        m.refNumber || '', m.warehouseName || '', (m.type === 'in' ? '' : '-') + m.qty,
        m.rate || 0, m.value || 0, m.balanceAfter, m.createdByName || '', m.notes || '',
      ]),
    );
    Toast.success('Ledger exported');
  },
};

export default ItemStockPage;
