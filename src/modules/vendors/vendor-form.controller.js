import Router from '../../core/router.js';
import DB from '../../services/firestore.js';
import Toast from '../../components/Toast.js';
import Topbar from '../../components/Topbar.js';
import { INDIAN_STATES } from '../../utils/constants.js';

const VendorFormPage = {
  async init(id) {
    this._id = id;
    this._vendor = id ? await DB.getOne('vendors', id) : {};
    Topbar.render({ breadcrumb: [{ label: 'Vendors', route: '/vendors' }, { label: id ? 'Edit vendor' : 'New vendor' }] });
    this._render();
  },
  _render() {
    const v = this._vendor || {};
    const stateOptions = INDIAN_STATES.map(s => `<option value="${s.name}" ${v.state===s.name?'selected':''}>${s.name}</option>`).join('');
    Router.render(`
      <div style="max-width:720px;">
        <div class="page-header">
          <div class="page-header-left"><h1>${this._id ? 'Edit vendor' : 'New vendor'}</h1></div>
          <div class="page-header-actions"><a href="#/vendors" class="btn btn-secondary">Cancel</a></div>
        </div>
        <div class="card">
          <div class="card-header"><h2>Vendor details</h2></div>
          <div class="card-body">
            <form id="vendor-form">
              <div class="form-row mb-4">
                <div class="form-group">
                  <label class="form-label">Vendor name *</label>
                  <input class="input" type="text" name="name" value="${v.name||''}" required />
                </div>
                <div class="form-group">
                  <label class="form-label">GSTIN</label>
                  <input class="input" type="text" name="gstin" value="${v.gstin||''}" style="text-transform:uppercase;" />
                </div>
              </div>
              <div class="form-row mb-4">
                <div class="form-group">
                  <label class="form-label">Email</label>
                  <input class="input" type="email" name="email" value="${v.email||''}" />
                </div>
                <div class="form-group">
                  <label class="form-label">Phone</label>
                  <input class="input" type="tel" name="phone" value="${v.phone||''}" />
                </div>
              </div>
              <div class="form-row mb-4">
                <div class="form-group">
                  <label class="form-label">City</label>
                  <input class="input" type="text" name="city" value="${v.city||''}" />
                </div>
                <div class="form-group">
                  <label class="form-label">State</label>
                  <select class="select" name="state"><option value="">Select state</option>${stateOptions}</select>
                </div>
              </div>
              <button type="submit" class="btn btn-primary">${this._id ? 'Save changes' : 'Add vendor'}</button>
            </form>
          </div>
        </div>
      </div>
    `);
    document.getElementById('vendor-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(e.target));
      try {
        if (this._id) await DB.update('vendors', this._id, data);
        else await DB.create('vendors', data);
        Toast.success(this._id ? 'Vendor updated' : 'Vendor added');
        window.location.hash = '#/vendors';
      } catch { Toast.error('Failed to save vendor'); }
    });
  },
};
export default VendorFormPage;
