import Router from '../../core/router.js';
import DB from '../../services/firestore.js';
import Toast from '../../components/Toast.js';
import Topbar from '../../components/Topbar.js';
import Icon from '../../utils/icons.js';
import { formatCurrency } from '../../utils/formatters.js';
import { GST_RATE_OPTIONS, PRODUCT_UNITS, DEFAULT_WAREHOUSE } from '../../utils/constants.js';

const esc = (s) => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

const ProductFormPage = {
  async init(id) {
    this._id = id;
    this._product = id ? await DB.getOne('products', id) : {};
    this._warehouses = [{ ...DEFAULT_WAREHOUSE }];
    try {
      const { default: Inventory } = await import('../inventory/inventory.service.js');
      this._warehouses = await Inventory.listWarehouses();
    } catch (e) { /* locations are optional */ }

    Topbar.render({ breadcrumb: [{ label: 'Products', route: '/products' }, { label: id ? 'Edit product' : 'New product' }] });
    const p = this._product || {};
    const gstOpts  = GST_RATE_OPTIONS.map(r => `<option value="${r.value}" ${p.gstRate==r.value?'selected':''}>${r.label}</option>`).join('');
    const unitOpts = PRODUCT_UNITS.map(u => `<option value="${u}" ${p.unit===u?'selected':''}>${u}</option>`).join('');
    const whOpts   = this._warehouses.map(w => `<option value="${esc(w.id)}">${esc(w.name)}</option>`).join('');
    const tracked  = p.trackInventory === true;
    const isNew    = !id;

    Router.render(`
      <div style="max-width:600px;">
        <div class="page-header">
          <div class="page-header-left"><h1>${id ? 'Edit product' : 'New product'}</h1></div>
          <div class="page-header-actions"><a href="#/products" class="btn btn-secondary">Cancel</a></div>
        </div>
        <form id="product-form">
          <div class="card mb-4">
            <div class="card-body">
              <div class="form-group mb-4">
                <label class="form-label">Name *</label>
                <input class="input" name="name" value="${esc(p.name)}" required placeholder="e.g. Web Design Service" />
              </div>
              <div class="form-row mb-4">
                <div class="form-group">
                  <label class="form-label">Type</label>
                  <select class="select" name="type" id="prod-type">
                    <option value="product" ${p.type==='product'||!p.type?'selected':''}>Product (Goods)</option>
                    <option value="service" ${p.type==='service'?'selected':''}>Service</option>
                  </select>
                </div>
                <div class="form-group">
                  <label class="form-label">HSN / SAC code</label>
                  <input class="input" name="hsn" value="${esc(p.hsn || p.sac || '')}" placeholder="e.g. 998314" />
                </div>
              </div>
              <div class="form-row mb-4">
                <div class="form-group">
                  <label class="form-label">Default rate (₹)</label>
                  <div class="input-wrapper"><span class="input-rupee-prefix">₹</span>
                    <input class="input input-rupee" type="number" name="rate" value="${p.rate||''}" placeholder="0.00" min="0" step="0.01" />
                  </div>
                </div>
                <div class="form-group">
                  <label class="form-label">Unit</label>
                  <select class="select" name="unit">${unitOpts}</select>
                </div>
              </div>
              <div class="form-group mb-4">
                <label class="form-label">GST rate</label>
                <select class="select" name="gstRate">${gstOpts}</select>
              </div>
              <div class="form-group">
                <label class="form-label">Description</label>
                <textarea class="textarea" name="description" rows="2" placeholder="Optional description for invoices">${esc(p.description)}</textarea>
              </div>
            </div>
          </div>

          <!-- Inventory -->
          <div class="card mb-4" id="inv-card">
            <div class="card-header">
              <h2 style="display:flex;align-items:center;gap:7px;">${Icon.packages(15)} Stock tracking</h2>
              <div class="card-header-actions">
                <label class="toggle-wrapper" style="cursor:pointer;font-size:12.5px;color:var(--text-secondary);">
                  <span class="toggle">
                    <input type="checkbox" name="trackInventory" id="track-toggle" ${tracked?'checked':''} />
                    <span class="toggle-track"></span><span class="toggle-thumb"></span>
                  </span>
                  Track stock for this item
                </label>
              </div>
            </div>
            <div class="card-body" id="inv-fields" style="display:${tracked?'block':'none'};">
              <div class="form-row mb-4">
                <div class="form-group">
                  <label class="form-label">SKU / item code</label>
                  <input class="input" name="sku" value="${esc(p.sku)}" placeholder="e.g. MUG-RED-01" autocomplete="off" />
                </div>
                <div class="form-group">
                  <label class="form-label">Purchase cost (₹)</label>
                  <div class="input-wrapper"><span class="input-rupee-prefix">₹</span>
                    <input class="input input-rupee" type="number" name="purchaseRate" value="${p.purchaseRate||''}" placeholder="0.00" min="0" step="0.01" />
                  </div>
                  <div class="form-hint">Used as the default cost on stock-in</div>
                </div>
              </div>
              <div class="form-row mb-4">
                <div class="form-group">
                  <label class="form-label">Reorder level</label>
                  <input class="input" type="number" name="reorderLevel" value="${p.reorderLevel||''}" placeholder="0" min="0" step="0.001" />
                  <div class="form-hint">Alerts you when stock drops to this level</div>
                </div>
                <div class="form-group">
                  <label class="form-label">${isNew ? 'Opening stock' : 'Current stock'}</label>
                  ${isNew ? `
                    <input class="input" type="number" name="openingStock" value="" placeholder="0" min="0" step="0.001" />
                    <div class="form-hint">Posted to the ledger as an opening entry</div>
                  ` : `
                    <div style="display:flex;align-items:center;gap:8px;padding:9px 11px;border:1px solid var(--border-subtle);border-radius:9px;background:var(--bg-subtle);">
                      <strong style="font-size:14px;">${p.stockQty ?? 0} ${esc(p.unit || 'Nos')}</strong>
                      <span style="font-size:11.5px;color:var(--text-tertiary);">avg ${formatCurrency(p.avgCost || 0)}</span>
                      <a href="#/inventory/${esc(id)}" class="btn btn-ghost btn-sm" style="margin-left:auto;">Adjust</a>
                    </div>
                    <div class="form-hint">Quantities can only change through the stock ledger</div>
                  `}
                </div>
              </div>
              ${isNew && this._warehouses.length > 1 ? `
                <div class="form-group">
                  <label class="form-label">Opening stock location</label>
                  <select class="select" name="warehouseId">${whOpts}</select>
                </div>` : ''}
              <div style="display:flex;gap:8px;align-items:flex-start;padding:10px 12px;background:var(--bg-subtle);border-radius:9px;font-size:12px;color:var(--text-secondary);line-height:1.5;">
                <span style="color:var(--brand-primary);flex-shrink:0;">${Icon.info(14)}</span>
                <span>Stock is deducted automatically when this item is billed on an invoice, and returned if the invoice is edited or deleted. Valuation uses moving average cost.</span>
              </div>
            </div>
          </div>

          <button type="submit" class="btn btn-primary btn-lg">${id ? 'Save changes' : 'Add product'}</button>
        </form>
      </div>
    `);

    // Toggle + service guard
    const toggle = document.getElementById('track-toggle');
    const fields = document.getElementById('inv-fields');
    const type   = document.getElementById('prod-type');
    const sync = () => {
      const isService = type?.value === 'service';
      if (isService && toggle) { toggle.checked = false; toggle.disabled = true; }
      else if (toggle) toggle.disabled = false;
      if (fields) fields.style.display = toggle?.checked ? 'block' : 'none';
    };
    toggle?.addEventListener('change', sync);
    type?.addEventListener('change', sync);
    sync();

    document.getElementById('product-form')?.addEventListener('submit', (e) => this._save(e));
  },

  async _save(e) {
    e.preventDefault();
    const btn  = e.target.querySelector('button[type="submit"]');
    const form = new FormData(e.target);
    const data = Object.fromEntries(form);

    const openingStock = parseFloat(data.openingStock) || 0;
    const warehouseId  = data.warehouseId || DEFAULT_WAREHOUSE.id;
    delete data.openingStock;
    delete data.warehouseId;

    data.rate           = parseFloat(data.rate) || 0;
    data.gstRate        = parseFloat(data.gstRate) || 0;
    data.trackInventory = form.get('trackInventory') === 'on';
    data.purchaseRate   = parseFloat(data.purchaseRate) || 0;
    data.reorderLevel   = parseFloat(data.reorderLevel) || 0;
    data.sku            = (data.sku || '').trim() || null;

    btn?.classList.add('loading');
    try {
      let productId = this._id;
      if (productId) {
        // stockQty is owned by the ledger — never written from this form
        if (data.trackInventory && this._product?.stockQty === undefined) data.stockQty = 0;
        await DB.update('products', productId, data);
      } else {
        if (data.trackInventory) data.stockQty = 0;
        productId = await DB.create('products', data);
      }

      if (!this._id && data.trackInventory && openingStock > 0) {
        const { default: Inventory } = await import('../inventory/inventory.service.js');
        const wh = (this._warehouses || []).find(w => w.id === warehouseId) || DEFAULT_WAREHOUSE;
        await Inventory.openingStock(productId, openingStock, data.purchaseRate, wh);
      }

      Toast.success(this._id ? 'Product updated' : 'Product added');
      window.location.hash = data.trackInventory && !this._id ? `#/inventory/${productId}` : '#/products';
    } catch (err) {
      btn?.classList.remove('loading');
      Toast.error('Failed to save: ' + err.message);
    }
  },
};
export default ProductFormPage;
