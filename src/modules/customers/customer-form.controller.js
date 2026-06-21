import Router from '../../core/router.js';
import Topbar from '../../components/Topbar.js';
import Toast  from '../../components/Toast.js';
import { INDIAN_STATES } from '../../utils/constants.js';

function clean(obj){const o={};for(const[k,v]of Object.entries(obj)){if(v!==undefined&&v!==null&&v!=='')o[k]=v;}return o;}

const CustomerFormPage = {
  async init(id) {
    this._id = id;
    let customer = {};
    if (id) {
      try { const { default: DB } = await import('../../services/firestore.js'); customer = await DB.getOne('customers', id) || {}; }
      catch (e) {}
    }
    Topbar.render({ breadcrumb: [{ label: 'Customers', route: '/customers' }, { label: id ? 'Edit customer' : 'New customer' }] });
    const c = customer;
    const stateOpts = INDIAN_STATES.map(s => `<option value="${s.name}" ${c.state === s.name ? 'selected' : ''}>${s.name}</option>`).join('');

    Router.render(`
      <div style="max-width:720px;">
        <div class="page-header">
          <div class="page-header-left"><h1>${id ? 'Edit customer' : 'New customer'}</h1></div>
          <div class="page-header-actions"><a href="#/customers" class="btn btn-secondary">Cancel</a></div>
        </div>
        <form id="cust-form" novalidate>
          <div class="card mb-4">
            <div class="card-header"><h2>Basic information</h2></div>
            <div class="card-body">
              <div class="form-row mb-4">
                <div class="form-group">
                  <label class="form-label">Business / Customer name <span class="required">*</span></label>
                  <input class="input" name="name" value="${c.name||''}" placeholder="Acme Pvt. Ltd." required />
                </div>
                <div class="form-group">
                  <label class="form-label">GSTIN</label>
                  <input class="input" name="gstin" value="${c.gstin||''}" placeholder="22AAAAA0000A1Z5" maxlength="15" style="text-transform:uppercase;" />
                </div>
              </div>
              <div class="form-row mb-4">
                <div class="form-group">
                  <label class="form-label">PAN</label>
                  <input class="input" name="pan" value="${c.pan||''}" placeholder="ABCDE1234F" maxlength="10" style="text-transform:uppercase;" />
                </div>
                <div class="form-group">
                  <label class="form-label">Customer type</label>
                  <select class="select" name="type">
                    <option value="business" ${c.type==='business'||!c.type?'selected':''}>Business (B2B)</option>
                    <option value="individual" ${c.type==='individual'?'selected':''}>Individual (B2C)</option>
                    <option value="government" ${c.type==='government'?'selected':''}>Government</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          <div class="card mb-4">
            <div class="card-header"><h2>Contact details</h2></div>
            <div class="card-body">
              <div class="form-row mb-4">
                <div class="form-group">
                  <label class="form-label">
                    Email address <span class="required">*</span>
                    <span style="font-size:10.5px;font-weight:400;color:var(--text-tertiary);margin-left:6px;">Used for invoice emails &amp; reminders</span>
                  </label>
                  <input class="input" type="email" name="email" value="${c.email||''}" placeholder="billing@company.com" required />
                </div>
                <div class="form-group">
                  <label class="form-label">Phone</label>
                  <input class="input" type="tel" name="phone" value="${c.phone||''}" placeholder="9876543210" />
                </div>
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">Contact person</label>
                  <input class="input" name="contact_name" value="${c.contact_name||''}" placeholder="Rahul Sharma" />
                </div>
                <div class="form-group">
                  <label class="form-label">Credit period (days)</label>
                  <input class="input" type="number" name="credit_days" value="${c.credit_days||30}" min="0" />
                </div>
              </div>
            </div>
          </div>

          <div class="card mb-4">
            <div class="card-header"><h2>Address</h2></div>
            <div class="card-body">
              <div class="form-group mb-4">
                <label class="form-label">Address</label>
                <textarea class="textarea" name="address" rows="2">${c.address||''}</textarea>
              </div>
              <div class="form-row-3">
                <div class="form-group">
                  <label class="form-label">City</label>
                  <input class="input" name="city" value="${c.city||''}" />
                </div>
                <div class="form-group">
                  <label class="form-label">State</label>
                  <select class="select" name="state"><option value="">Select state</option>${stateOpts}</select>
                </div>
                <div class="form-group">
                  <label class="form-label">Pincode</label>
                  <input class="input" name="pincode" value="${c.pincode||''}" maxlength="6" />
                </div>
              </div>
            </div>
          </div>

          <div style="display:flex;gap:12px;">
            <button type="submit" id="btn-save" class="btn btn-primary btn-lg">${id ? 'Save changes' : 'Add customer'}</button>
            <a href="#/customers" class="btn btn-ghost btn-lg">Cancel</a>
          </div>
        </form>
      </div>
    `);

    document.getElementById('cust-form')?.addEventListener('submit', async e => {
      e.preventDefault();
      const btn  = document.getElementById('btn-save');
      const data = Object.fromEntries(new FormData(e.target));
      if (!data.name?.trim())  { Toast.error('Customer name is required'); return; }
      if (!data.email?.trim()) { Toast.error('Email address is required — needed for invoice emails & reminders'); return; }
      btn.classList.add('loading');
      try {
        const { default: DB } = await import('../../services/firestore.js');
        const payload = clean({
          name:         data.name.trim(),
          gstin:        data.gstin?.toUpperCase() || null,
          pan:          data.pan?.toUpperCase()   || null,
          type:         data.type || 'business',
          email:        data.email.trim().toLowerCase(),
          phone:        data.phone?.trim() || null,
          contact_name: data.contact_name?.trim() || null,
          credit_days:  parseInt(data.credit_days) || 30,
          address:      data.address?.trim() || null,
          city:         data.city?.trim()    || null,
          state:        data.state           || null,
          pincode:      data.pincode?.trim() || null,
        });
        if (id) await DB.update('customers', id, payload);
        else    await DB.create('customers', payload);
        Toast.success(id ? 'Customer updated' : 'Customer added');
        window.location.hash = '#/customers';
      } catch (err) { btn.classList.remove('loading'); Toast.error('Failed: ' + err.message); }
    });
  },
};
export default CustomerFormPage;
