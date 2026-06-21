import Router from '../../core/router.js';
import DB from '../../services/firestore.js';
import Toast from '../../components/Toast.js';
import Topbar from '../../components/Topbar.js';
import { GST_RATE_OPTIONS, PRODUCT_UNITS } from '../../utils/constants.js';

const ProductFormPage = {
  async init(id) {
    this._id = id;
    this._product = id ? await DB.getOne('products', id) : {};
    Topbar.render({ breadcrumb: [{ label: 'Products', route: '/products' }, { label: id ? 'Edit product' : 'New product' }] });
    const p = this._product || {};
    const gstOpts = GST_RATE_OPTIONS.map(r => `<option value="${r.value}" ${p.gstRate==r.value?'selected':''}>${r.label}</option>`).join('');
    const unitOpts = PRODUCT_UNITS.map(u => `<option value="${u}" ${p.unit===u?'selected':''}>${u}</option>`).join('');
    Router.render(`
      <div style="max-width:600px;">
        <div class="page-header">
          <div class="page-header-left"><h1>${id ? 'Edit product' : 'New product'}</h1></div>
          <div class="page-header-actions"><a href="#/products" class="btn btn-secondary">Cancel</a></div>
        </div>
        <div class="card">
          <div class="card-body">
            <form id="product-form">
              <div class="form-group mb-4">
                <label class="form-label">Name *</label>
                <input class="input" name="name" value="${p.name||''}" required placeholder="e.g. Web Design Service" />
              </div>
              <div class="form-row mb-4">
                <div class="form-group">
                  <label class="form-label">Type</label>
                  <select class="select" name="type">
                    <option value="product" ${p.type==='product'||!p.type?'selected':''}>Product (Goods)</option>
                    <option value="service" ${p.type==='service'?'selected':''}>Service</option>
                  </select>
                </div>
                <div class="form-group">
                  <label class="form-label">HSN / SAC code</label>
                  <input class="input" name="hsn" value="${p.hsn||p.sac||''}" placeholder="e.g. 998314" />
                </div>
              </div>
              <div class="form-row mb-4">
                <div class="form-group">
                  <label class="form-label">Default rate (₹)</label>
                  <div class="input-wrapper"><span class="input-rupee-prefix">₹</span>
                    <input class="input input-rupee" type="number" name="rate" value="${p.rate||''}" placeholder="0.00" min="0" />
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
              <div class="form-group mb-4">
                <label class="form-label">Description</label>
                <textarea class="textarea" name="description" rows="2" placeholder="Optional description for invoices">${p.description||''}</textarea>
              </div>
              <button type="submit" class="btn btn-primary">${id ? 'Save changes' : 'Add product'}</button>
            </form>
          </div>
        </div>
      </div>
    `);
    document.getElementById('product-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(e.target));
      data.rate = parseFloat(data.rate) || 0;
      data.gstRate = parseFloat(data.gstRate) || 0;
      try {
        if (this._id) await DB.update('products', this._id, data);
        else await DB.create('products', data);
        Toast.success(this._id ? 'Product updated' : 'Product added');
        window.location.hash = '#/products';
      } catch { Toast.error('Failed to save'); }
    });
  },
};
export default ProductFormPage;
