import Router from '../../core/router.js';
import Toast  from '../../components/Toast.js';
import Icon   from '../../utils/icons.js';
import { formatCurrency, formatCurrencyShort } from '../../utils/formatters.js';
import { STOCK_STATUS_LABELS, STOCK_STATUS_BADGE, DEFAULT_WAREHOUSE } from '../../utils/constants.js';
import InventoryService from './inventory.service.js';
import StockModal       from './stock-modal.js';
import { downloadCSV }  from './csv.js';

const esc = (s) => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
// For values dropped inside a single-quoted JS string in an inline handler
const jsq = (s) => esc(String(s ?? '').replace(/\\/g,'\\\\').replace(/'/g,"\\'"));

const InventoryPage = {
  _items: [], _warehouses: [], _filter: 'all', _warehouse: 'all',

  async init() {
    Router.render(`
      <div class="page-header">
        <div class="page-header-left"><h1>Inventory</h1><p id="inv-sub">Loading stock…</p></div>
        <div class="page-header-actions" style="display:flex;gap:6px;flex-wrap:wrap;">
          <button class="btn btn-secondary btn-sm" onclick="InventoryPage.stockIn()">${Icon.arrowDownIn(14)} Stock in</button>
          <button class="btn btn-secondary btn-sm" onclick="InventoryPage.stockOut()">${Icon.arrowUpOut(14)} Stock out</button>
          <button class="btn btn-secondary btn-sm" onclick="InventoryPage.stockCount()">${Icon.sliders(14)} Stock count</button>
          <a href="#/inventory/movements" class="btn btn-primary btn-sm">${Icon.history(14)} Stock ledger</a>
        </div>
      </div>

      <div class="grid-4 mb-4" id="stk-metrics">
        ${Array(4).fill('<div class="skeleton" style="height:82px;border-radius:12px;"></div>').join('')}
      </div>

      <div id="stk-alert"></div>

      <div style="display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap;align-items:center;">
        <div id="stk-filters" style="display:flex;gap:6px;flex-wrap:wrap;"></div>
        <div style="display:flex;gap:8px;margin-left:auto;align-items:center;flex-wrap:wrap;">
          <select class="select" id="stk-wh" style="width:auto;font-size:12.5px;padding:6px 10px;"><option value="all">All locations</option></select>
          <div class="input-wrapper" style="max-width:220px;">
            <svg style="position:absolute;left:10px;top:50%;transform:translateY(-50%);width:13px;height:13px;" viewBox="0 0 24 24" fill="none" stroke="#9AA5B8" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input class="input" id="stk-search" type="search" placeholder="Item, SKU, HSN…" style="padding-left:32px;" autocomplete="off" />
          </div>
          <button class="btn btn-ghost btn-sm" onclick="InventoryPage.exportCSV()" title="Export stock summary">${Icon.download(14)} Export</button>
          <button class="btn btn-ghost btn-sm" onclick="InventoryPage.manageWarehouses()" title="Manage locations">${Icon.warehouse(14)}</button>
        </div>
      </div>

      <div class="card" id="stk-table"><div style="padding:40px;text-align:center;"><div class="spinner-sm"></div></div></div>
    `);

    window.InventoryPage = this;
    document.getElementById('stk-search')?.addEventListener('input', () => this._renderTable());
    document.getElementById('stk-wh')?.addEventListener('change', (e) => { this._warehouse = e.target.value; this._renderTable(); });

    await this.reload();
  },

  async reload() {
    try {
      [this._items, this._warehouses] = await Promise.all([
        InventoryService.listItems(),
        InventoryService.listWarehouses(),
      ]);
    } catch (e) {
      this._items = []; this._warehouses = [DEFAULT_WAREHOUSE];
      Toast.error(e.message);
    }
    this._renderMetrics();
    this._renderFilters();
    this._renderWarehouseSelect();
    this._renderAlert();
    this._renderTable();
  },

  // ── HEADER BLOCKS ────────────────────────────────────────────────────────
  _renderMetrics() {
    const s  = InventoryService.stats(this._items);
    const el = document.getElementById('stk-metrics');
    const sub= document.getElementById('inv-sub');
    if (sub) sub.textContent = `${s.itemCount} tracked item${s.itemCount === 1 ? '' : 's'} · ₹${formatCurrencyShort(s.stockValue)} at cost`;
    if (!el) return;
    el.innerHTML = `
      <div class="metric-card">
        <div class="metric-label">Stock value (cost)</div>
        <div class="metric-value">₹${formatCurrencyShort(s.stockValue)}</div>
        <div class="metric-subtext">₹${formatCurrencyShort(s.potentialSaleValue)} at selling price</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Items tracked</div>
        <div class="metric-value">${s.itemCount}</div>
        <div class="metric-subtext">${s.totalQty} units on hand</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Low stock</div>
        <div class="metric-value" style="color:${s.lowStock ? 'var(--color-warning)' : 'inherit'};">${s.lowStock}</div>
        <div class="metric-subtext">at or below reorder level</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Out of stock</div>
        <div class="metric-value" style="color:${(s.outOfStock + s.negative) ? 'var(--color-danger)' : 'inherit'};">${s.outOfStock + s.negative}</div>
        <div class="metric-subtext">${s.negative ? `${s.negative} negative balance` : 'nothing oversold'}</div>
      </div>`;
  },

  _renderFilters() {
    const el = document.getElementById('stk-filters');
    if (!el) return;
    const counts = {
      all:          this._items.length,
      in_stock:     this._items.filter(i => i.stockStatus === 'in_stock').length,
      low_stock:    this._items.filter(i => i.stockStatus === 'low_stock').length,
      out_of_stock: this._items.filter(i => i.stockStatus === 'out_of_stock').length,
      negative:     this._items.filter(i => i.stockStatus === 'negative').length,
    };
    const chips = [
      ['all', 'All'], ['in_stock', 'In stock'], ['low_stock', 'Low'], ['out_of_stock', 'Out'],
      ...(counts.negative ? [['negative', 'Negative']] : []),
    ];
    el.innerHTML = chips.map(([id, label]) =>
      `<button class="filter-chip ${this._filter === id ? 'active' : ''}" onclick="InventoryPage.setFilter('${id}')">${label}${counts[id] ? ` (${counts[id]})` : ''}</button>`
    ).join('');
  },

  _renderWarehouseSelect() {
    const el = document.getElementById('stk-wh');
    if (!el || this._warehouses.length <= 1) return;
    el.innerHTML = `<option value="all">All locations</option>` +
      this._warehouses.map(w => `<option value="${esc(w.id)}" ${this._warehouse === w.id ? 'selected' : ''}>${esc(w.name)}</option>`).join('');
  },

  _renderAlert() {
    const el = document.getElementById('stk-alert');
    if (!el) return;
    const critical = this._items.filter(i => i.stockStatus === 'low_stock' || i.stockStatus === 'out_of_stock' || i.stockStatus === 'negative');
    if (critical.length === 0) { el.innerHTML = ''; return; }
    const names = critical.slice(0, 4).map(i => `${esc(i.name)} (${i.stockQty} ${esc(i.unit || 'Nos')})`).join(', ');
    el.innerHTML = `
      <div style="display:flex;align-items:flex-start;gap:10px;padding:11px 14px;border:1px solid #FDE68A;background:#FFFBEB;border-radius:11px;margin-bottom:14px;">
        <div style="color:#B45309;flex-shrink:0;margin-top:1px;">${Icon.alertTriangle(15)}</div>
        <div style="flex:1;min-width:0;font-size:12.5px;color:#78350F;line-height:1.55;">
          <strong>${critical.length} item${critical.length === 1 ? ' needs' : 's need'} restocking</strong> — ${names}${critical.length > 4 ? ` and ${critical.length - 4} more` : ''}
        </div>
        <button class="btn btn-secondary btn-sm" style="flex-shrink:0;" onclick="InventoryPage.setFilter('low_stock')">Review</button>
      </div>`;
  },

  // ── TABLE ────────────────────────────────────────────────────────────────
  _visible() {
    const q = (document.getElementById('stk-search')?.value || '').toLowerCase().trim();
    let list = this._filter === 'all' ? this._items : this._items.filter(i => i.stockStatus === this._filter);
    if (this._warehouse !== 'all') list = list.filter(i => (i.stockByWarehouse?.[this._warehouse] ?? 0) !== 0);
    if (q) list = list.filter(i => `${i.name || ''} ${i.sku || ''} ${i.hsn || ''} ${i.description || ''}`.toLowerCase().includes(q));
    return list;
  },

  _renderTable() {
    const wrap = document.getElementById('stk-table');
    if (!wrap) return;
    const list = this._visible();

    if (this._items.length === 0) {
      wrap.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">${Icon.packages(24)}</div>
          <h3>No items are being tracked yet</h3>
          <p>Turn on <strong>stock tracking</strong> on any product to start counting units, valuing stock and getting reorder alerts. Sales deduct stock automatically.</p>
          <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap;">
            <button class="btn btn-primary" onclick="InventoryPage.trackItems()">Enable tracking on products</button>
            <a href="#/products/new" class="btn btn-secondary">Add a product</a>
          </div>
        </div>`;
      return;
    }

    if (list.length === 0) {
      wrap.innerHTML = `<div class="empty-state"><div class="empty-state-icon">${Icon.search(24)}</div><h3>No matching items</h3><p>Try a different filter or search term.</p></div>`;
      return;
    }

    const whCol = this._warehouse !== 'all';
    wrap.innerHTML = `<div class="table-wrapper"><table class="data-table">
      <thead><tr>
        <th>Item</th><th>SKU / HSN</th>
        <th class="text-right">${whCol ? 'At location' : 'In stock'}</th>
        <th class="text-right">Reorder at</th>
        <th class="text-right">Avg cost</th>
        <th class="text-right">Stock value</th>
        <th>Status</th>
        <th class="text-right">Actions</th>
      </tr></thead>
      <tbody>
        ${list.map(i => {
          const qty = whCol ? (i.stockByWarehouse?.[this._warehouse] ?? 0) : i.stockQty;
          return `<tr style="cursor:pointer;" onclick="location.hash='#/inventory/${i.id}'">
            <td>
              <div style="font-weight:600;">${esc(i.name)}</div>
              ${i.description ? `<div style="font-size:11px;color:var(--text-tertiary);">${esc(i.description)}</div>` : ''}
            </td>
            <td style="font-family:var(--font-mono);font-size:11.5px;color:var(--text-secondary);">${esc(i.sku || i.hsn || '—')}</td>
            <td class="text-right" style="font-weight:700;${qty < 0 ? 'color:var(--color-danger);' : ''}">${qty} <span style="font-weight:400;color:var(--text-tertiary);font-size:11px;">${esc(i.unit || 'Nos')}</span></td>
            <td class="text-right muted">${i.reorderLevel || '—'}</td>
            <td class="col-amount">₹${formatCurrency(i.avgCost || 0)}</td>
            <td class="col-amount">₹${formatCurrency(i.stockValue || 0)}</td>
            <td><span class="${STOCK_STATUS_BADGE[i.stockStatus]} badge-dot">${STOCK_STATUS_LABELS[i.stockStatus]}</span></td>
            <td class="col-actions" onclick="event.stopPropagation()"><div class="row-actions">
              <button class="btn btn-ghost btn-icon btn-sm" title="Stock in"  style="color:var(--color-success);" onclick="InventoryPage.stockIn('${i.id}')">${Icon.arrowDownIn(14)}</button>
              <button class="btn btn-ghost btn-icon btn-sm" title="Stock out" style="color:var(--color-danger);"  onclick="InventoryPage.stockOut('${i.id}')">${Icon.arrowUpOut(14)}</button>
              <button class="btn btn-ghost btn-icon btn-sm" title="Stock count" onclick="InventoryPage.stockCount('${i.id}')">${Icon.sliders(14)}</button>
              <a href="#/inventory/${i.id}" class="btn btn-ghost btn-icon btn-sm" title="History">${Icon.history(14)}</a>
            </div></td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>
    <div class="card-footer" style="display:flex;justify-content:space-between;align-items:center;">
      <span style="font-size:12px;color:var(--text-tertiary);">Showing ${list.length} of ${this._items.length} items</span>
      <span style="font-size:12px;font-weight:600;">Value: ₹${formatCurrencyShort(list.reduce((s, i) => s + (i.stockValue || 0), 0))}</span>
    </div></div>`;
  },

  setFilter(f) { this._filter = f; this._renderFilters(); this._renderTable(); },

  // ── ACTIONS ──────────────────────────────────────────────────────────────
  _open(mode, id) {
    StockModal.open({
      mode,
      item:       id ? this._items.find(i => i.id === id) : null,
      items:      this._items,
      warehouses: this._warehouses,
      onDone:     () => this.reload(),
    });
  },

  stockIn(id)    { this._open('in', id); },
  stockOut(id)   { this._open('out', id); },
  stockCount(id) { this._open('adjust', id); },

  exportCSV() {
    const list = this._visible();
    if (list.length === 0) { Toast.error('Nothing to export'); return; }
    downloadCSV(
      `stock-summary-${new Date().toISOString().split('T')[0]}.csv`,
      ['Item', 'SKU', 'HSN', 'Unit', 'In stock', 'Reorder level', 'Avg cost', 'Stock value', 'Selling rate', 'Status'],
      list.map(i => [i.name, i.sku || '', i.hsn || '', i.unit || 'Nos', i.stockQty, i.reorderLevel || 0, i.avgCost || 0, i.stockValue || 0, i.rate || 0, STOCK_STATUS_LABELS[i.stockStatus]]),
    );
    Toast.success(`${list.length} items exported`);
  },

  /** Bulk-enable tracking on products that are not tracked yet. */
  async trackItems() {
    const all = await InventoryService.listAllProducts();
    const untracked = all.filter(p => !p.trackInventory && p.type !== 'service');
    if (untracked.length === 0) { Toast.info('Every product is already tracked. Services do not carry stock.'); return; }

    document.getElementById('__track-modal')?.remove();
    const modal = document.createElement('div');
    modal.id = '__track-modal';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(15,20,32,0.45);z-index:500;display:flex;align-items:center;justify-content:center;padding:20px;';
    modal.innerHTML = `
      <div style="background:white;border-radius:16px;width:100%;max-width:460px;box-shadow:0 20px 60px rgba(0,0,0,0.18);overflow:hidden;">
        <div style="padding:15px 18px;border-bottom:1px solid #F1F5F9;display:flex;align-items:center;justify-content:space-between;">
          <div>
            <div style="font-size:15px;font-weight:700;color:#0F172A;">Track stock for products</div>
            <div style="font-size:11.5px;color:#64748B;">Pick the goods you want counted. Opening stock can be added after.</div>
          </div>
          <button onclick="document.getElementById('__track-modal').remove()" style="width:28px;height:28px;border-radius:8px;border:none;background:#F1F5F9;cursor:pointer;color:#64748B;">${Icon.x(14)}</button>
        </div>
        <div style="padding:8px;max-height:320px;overflow-y:auto;" id="track-list">
          ${untracked.map(p => `
            <label style="display:flex;align-items:center;gap:10px;padding:9px 10px;border-radius:9px;cursor:pointer;" onmouseover="this.style.background='#F8FAFC'" onmouseout="this.style.background='transparent'">
              <input type="checkbox" value="${esc(p.id)}" style="width:15px;height:15px;accent-color:#1D4ED8;" />
              <div style="min-width:0;">
                <div style="font-size:13px;font-weight:600;color:#0F172A;">${esc(p.name)}</div>
                <div style="font-size:11px;color:#64748B;">${esc(p.hsn || p.sku || '')} ${p.rate ? `· ₹${p.rate}` : ''}</div>
              </div>
            </label>`).join('')}
        </div>
        <div style="padding:12px 18px;border-top:1px solid #F1F5F9;display:flex;gap:8px;">
          <button class="btn btn-secondary" style="flex:1;" onclick="document.getElementById('__track-modal').remove()">Cancel</button>
          <button class="btn btn-primary" style="flex:1.3;" id="btn-track" onclick="InventoryPage.saveTracking()">Enable tracking</button>
        </div>
      </div>`;
    document.body.appendChild(modal);
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
  },

  async saveTracking() {
    const ids = [...document.querySelectorAll('#track-list input:checked')].map(el => el.value);
    if (ids.length === 0) { Toast.error('Select at least one product'); return; }
    const btn = document.getElementById('btn-track');
    btn?.classList.add('loading');
    try {
      const { default: DB } = await import('../../services/firestore.js');
      for (const id of ids) {
        await DB.update('products', id, { trackInventory: true, stockQty: 0, reorderLevel: 0 });
      }
      document.getElementById('__track-modal')?.remove();
      Toast.success(`${ids.length} item${ids.length === 1 ? '' : 's'} now tracked`);
      await this.reload();
    } catch (e) { btn?.classList.remove('loading'); Toast.error('Failed: ' + e.message); }
  },

  // ── LOCATIONS ────────────────────────────────────────────────────────────
  manageWarehouses() {
    document.getElementById('__wh-modal')?.remove();
    const modal = document.createElement('div');
    modal.id = '__wh-modal';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(15,20,32,0.45);z-index:500;display:flex;align-items:center;justify-content:center;padding:20px;';
    modal.innerHTML = `
      <div style="background:white;border-radius:16px;width:100%;max-width:420px;box-shadow:0 20px 60px rgba(0,0,0,0.18);overflow:hidden;">
        <div style="padding:15px 18px;border-bottom:1px solid #F1F5F9;display:flex;align-items:center;justify-content:space-between;">
          <div>
            <div style="font-size:15px;font-weight:700;color:#0F172A;">Stock locations</div>
            <div style="font-size:11.5px;color:#64748B;">Warehouses, shops or godowns you hold stock in</div>
          </div>
          <button onclick="document.getElementById('__wh-modal').remove()" style="width:28px;height:28px;border-radius:8px;border:none;background:#F1F5F9;cursor:pointer;color:#64748B;">${Icon.x(14)}</button>
        </div>
        <div style="padding:8px;max-height:280px;overflow-y:auto;">
          ${this._warehouses.map(w => `
            <div style="display:flex;align-items:center;gap:10px;padding:10px;border-radius:9px;">
              <div style="width:30px;height:30px;border-radius:8px;background:#EEF2FF;color:#3730A3;display:flex;align-items:center;justify-content:center;">${Icon.warehouse(15)}</div>
              <div style="flex:1;min-width:0;">
                <div style="font-size:13px;font-weight:600;color:#0F172A;">${esc(w.name)}</div>
                <div style="font-size:11px;color:#64748B;">${esc(w.address || (w.id === DEFAULT_WAREHOUSE.id ? 'Default location' : '—'))}</div>
              </div>
              ${w.id === DEFAULT_WAREHOUSE.id ? '' : `<button class="btn btn-ghost btn-icon btn-sm" style="color:var(--color-danger);" onclick="InventoryPage.deleteWarehouse('${jsq(w.id)}','${jsq(w.name)}')">${Icon.trash(14)}</button>`}
            </div>`).join('')}
        </div>
        <div style="padding:12px 18px;border-top:1px solid #F1F5F9;">
          <div class="form-row mb-3">
            <div class="form-group"><input class="input" id="wh-name" placeholder="Location name" autocomplete="off" /></div>
            <div class="form-group"><input class="input" id="wh-addr" placeholder="City / address" autocomplete="off" /></div>
          </div>
          <button class="btn btn-primary w-full" onclick="InventoryPage.addWarehouse()">Add location</button>
        </div>
      </div>`;
    document.body.appendChild(modal);
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
  },

  async addWarehouse() {
    const name = document.getElementById('wh-name')?.value?.trim();
    const addr = document.getElementById('wh-addr')?.value?.trim();
    if (!name) { Toast.error('Location name is required'); return; }
    try {
      await InventoryService.saveWarehouse(null, { name, address: addr || null });
      this._warehouses = await InventoryService.listWarehouses();
      Toast.success(`${name} added`);
      this.manageWarehouses();
      this._renderWarehouseSelect();
    } catch (e) { Toast.error('Failed: ' + e.message); }
  },

  async deleteWarehouse(id, name) {
    if (!confirm(`Delete location "${name}"?`)) return;
    try {
      await InventoryService.deleteWarehouse(id);
      this._warehouses = await InventoryService.listWarehouses();
      Toast.success(`${name} deleted`);
      this.manageWarehouses();
      this._renderWarehouseSelect();
    } catch (e) { Toast.error(e.message); }
  },
};

export default InventoryPage;
