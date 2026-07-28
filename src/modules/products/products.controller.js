import Router from '../../core/router.js';
import Toast  from '../../components/Toast.js';
import { formatCurrency } from '../../utils/formatters.js';
import Icon from '../../utils/icons.js';

const ProductsPage = {
  _list: [], _type: 'all',

  async init() {
    Router.render(`
      <div class="page-header">
        <div class="page-header-left"><h1>Products &amp; Services</h1><p id="prod-count">Loading…</p></div>
        <div class="page-header-actions"><a href="#/products/new" class="btn btn-primary btn-sm">+ Add item</a></div>
      </div>
      <div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap;align-items:center;">
        <div id="type-filters" style="display:flex;gap:6px;">
          <button class="filter-chip active" onclick="ProductsPage.setType('all')">All</button>
          <button class="filter-chip" onclick="ProductsPage.setType('product')">Products</button>
          <button class="filter-chip" onclick="ProductsPage.setType('service')">Services</button>
        </div>
        <div class="input-wrapper" style="max-width:240px;margin-left:auto;">
          <svg style="position:absolute;left:10px;top:50%;transform:translateY(-50%);width:13px;height:13px;" viewBox="0 0 24 24" fill="none" stroke="#9AA5B8" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input class="input" id="prod-search" type="search" placeholder="Search…" style="padding-left:32px;" autocomplete="off" />
        </div>
      </div>
      <div class="card" id="prod-table-wrap"><div style="padding:40px;text-align:center;"><div class="spinner-sm"></div></div></div>
    `);

    const input = document.getElementById('prod-search');
    if (input) input.addEventListener('input', () => this._filter());

    try {
      const { default: DB } = await import('../../services/firestore.js');
      this._list = await DB.getAll('products', []).catch(() => []);
      this._list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    } catch (e) { this._list = []; }

    this._filter();
    document.getElementById('prod-count').textContent = `${this._list.length} item${this._list.length !== 1 ? 's' : ''}`;
    window.ProductsPage = this;
  },

  _filter() {
    const q    = (document.getElementById('prod-search')?.value || '').toLowerCase().trim();
    let list   = this._type !== 'all' ? this._list.filter(p => p.type === this._type) : this._list;
    if (q) list = list.filter(p => `${p.name} ${p.hsn || ''} ${p.sac || ''} ${p.description || ''}`.toLowerCase().includes(q));
    this._renderTable(list);
  },

  setType(type) {
    this._type = type;
    document.querySelectorAll('#type-filters .filter-chip').forEach((el, i) => {
      el.classList.toggle('active', ['all','product','service'][i] === type);
    });
    this._filter();
  },

  _renderTable(list) {
    const wrap = document.getElementById('prod-table-wrap');
    if (!wrap) return;
    if (list.length === 0) {
      wrap.innerHTML = `<div class="empty-state"><div class="empty-state-icon">${Icon.box(24)}</div><h3>${this._list.length === 0 ? 'No products yet' : 'No results'}</h3><p>${this._list.length === 0 ? 'Add products and services to use them in invoices with smart autocomplete.' : ''}</p>${this._list.length === 0 ? `<a href="#/products/new" class="btn btn-primary">Add first product</a>` : ''}</div>`;
      return;
    }
    wrap.innerHTML = `<div class="table-wrapper"><table class="data-table">
      <thead><tr><th>Name</th><th>Type</th><th>HSN/SAC</th><th class="text-right">Rate</th><th class="text-right">GST%</th><th>Unit</th><th class="text-right">Actions</th></tr></thead>
      <tbody>
        ${list.map(p => `<tr>
          <td><div style="font-weight:600;">${p.name || '—'}</div>${p.description ? `<div style="font-size:11px;color:var(--text-tertiary);">${p.description}</div>` : ''}</td>
          <td><span class="badge ${p.type === 'service' ? 'badge-purple' : 'badge-neutral'}">${p.type || 'product'}</span></td>
          <td style="font-family:var(--font-mono);font-size:11.5px;color:var(--text-secondary);">${p.hsn || p.sac || '—'}</td>
          <td class="col-amount">₹${formatCurrency(p.rate || 0)}</td>
          <td class="text-right muted">${p.gstRate || 0}%</td>
          <td class="muted">${p.unit || 'Nos'}</td>
          <td class="col-actions"><div class="row-actions">
            <a href="#/products/${p.id}" class="btn btn-ghost btn-icon btn-sm" title="Edit">${Icon.edit(14)}</a>
            <button class="btn btn-ghost btn-icon btn-sm" onclick="ProductsPage.del('${p.id}','${(p.name||'').replace(/'/g,"\\'")}',this)" title="Delete" style="color:var(--color-danger);">${Icon.trash(14)}</button>
          </div></td>
        </tr>`).join('')}
      </tbody>
    </table></div>`;
  },

  async del(id, name) {
    if (!confirm(`Delete "${name}"?`)) return;
    try {
      const { default: DB } = await import('../../services/firestore.js');
      await DB.delete('products', id);
      this._list = this._list.filter(p => p.id !== id);
      this._filter();
      Toast.success(`${name} deleted`);
    } catch (e) { Toast.error('Delete failed: ' + e.message); }
  },
};
export default ProductsPage;
