import Router from '../../core/router.js';
import Store  from '../../core/store.js';
import Toast  from '../../components/Toast.js';
import { INDIAN_STATES } from '../../utils/constants.js';
import { TeamController } from './team.controller.js';

function clean(obj){const o={};for(const[k,v]of Object.entries(obj)){if(v!==undefined&&v!==null&&v!=='')o[k]=v;}return o;}
function toDataURL(file){return new Promise((res,rej)=>{const r=new FileReader();r.onload=e=>res(e.target.result);r.onerror=rej;r.readAsDataURL(file);});}

const SettingsPage = {
  _tab:'company',

  async init(tab) {
    if (tab) this._tab = tab;
    this._render();
  },

  _render() {
    Router.render(`
      <div class="page-header">
        <div class="page-header-left"><h1>Settings</h1><p>Company · Team · Invoice · Bank · Profile</p></div>
      </div>
      <div style="display:grid;grid-template-columns:200px 1fr;gap:20px;align-items:start;">
        <div class="card" style="overflow:hidden;">
          <div style="padding:6px;">
            ${[{id:'company',label:'Company'},{id:'invoice',label:'Invoice'},{id:'bank',label:'Bank & Payments'},{id:'team',label:'Team & Members'},{id:'profile',label:'My Profile'}].map(item=>`
              <button class="sidebar-item ${this._tab===item.id?'active':''}" style="width:100%;text-align:left;" onclick="SettingsPage.setTab('${item.id}')">
                <span class="sidebar-item-label">${item.label}</span>
              </button>`).join('')}
          </div>
        </div>
        <div id="settings-tab">
          ${this._tab==='team' ? '<div style="text-align:center;padding:32px;font-size:13px;color:var(--text-tertiary);">Loading team…</div>' : this._tabHTML()}
        </div>
      </div>
    `);
    window.SettingsPage = this;
    if (this._tab==='team') {
      TeamController.loadTab(document.getElementById('settings-tab'));
    } else {
      this._bindForms();
    }
  },

  _tabHTML() {
    const c = Store.get('company')||{};
    const u = Store.get('user')||{};
    const role = Store.get('role')||'founder';
    const stateOpts = INDIAN_STATES.map(s=>`<option value="${s.name}" ${c.state===s.name?'selected':''}>${s.name}</option>`).join('');

    if (this._tab==='company') return `
      <div class="card">
        <div class="card-header"><h2>Company details</h2></div>
        <div class="card-body">
          <form id="company-form">
            <div class="form-row mb-4">
              <div class="form-group"><label class="form-label">Company name *</label><input class="input" name="name" value="${c.name||''}" placeholder="Your Business Pvt. Ltd." required /></div>
              <div class="form-group"><label class="form-label">GSTIN</label><input class="input" name="gstin" value="${c.gstin||''}" placeholder="22AAAAA0000A1Z5" maxlength="15" style="text-transform:uppercase;" /></div>
            </div>
            <div class="form-row mb-4">
              <div class="form-group"><label class="form-label">PAN</label><input class="input" name="pan" value="${c.pan||''}" placeholder="ABCDE1234F" maxlength="10" style="text-transform:uppercase;" /></div>
              <div class="form-group"><label class="form-label">Business email</label><input class="input" type="email" name="email" value="${c.email||''}" /></div>
            </div>
            <div class="form-row mb-4">
              <div class="form-group"><label class="form-label">Phone</label><input class="input" type="tel" name="phone" value="${c.phone||''}" /></div>
              <div class="form-group"><label class="form-label">Website</label><input class="input" type="url" name="website" value="${c.website||''}" placeholder="https://yoursite.com" /></div>
            </div>
            <div class="form-group mb-4"><label class="form-label">Registered address</label><textarea class="textarea" name="address" rows="2">${c.address||''}</textarea></div>
            <div class="form-row-3 mb-5">
              <div class="form-group"><label class="form-label">City</label><input class="input" name="city" value="${c.city||''}" /></div>
              <div class="form-group"><label class="form-label">State</label><select class="select" name="state"><option value="">Select</option>${stateOpts}</select></div>
              <div class="form-group"><label class="form-label">Pincode</label><input class="input" name="pincode" value="${c.pincode||''}" maxlength="6" /></div>
            </div>

            <!-- File uploads for invoice assets -->
            <div style="background:var(--bg-subtle);border:1px solid var(--border-subtle);border-radius:10px;padding:16px;margin-bottom:20px;">
              <div style="font-size:13px;font-weight:700;color:var(--text-primary);margin-bottom:14px;">📎 Invoice assets (appear on all invoices)</div>
              <div class="form-row-3">
                <div class="form-group">
                  <label class="form-label">Company logo (PNG/JPG)</label>
                  ${c.logoDataUrl?`<img src="${c.logoDataUrl}" style="height:40px;object-fit:contain;margin-bottom:8px;display:block;border-radius:4px;" />`:''}
                  <input type="file" id="logo-file" accept="image/png,image/jpeg,image/jpg" class="input" style="padding:5px;font-size:12px;" onchange="SettingsPage.uploadAsset('logo','logoDataUrl',this)" />
                  <div class="form-hint">Max 2MB. Appears top-left on invoices.</div>
                </div>
                <div class="form-group">
                  <label class="form-label">Signature (PNG/JPG)</label>
                  ${c.signatureDataUrl?`<img src="${c.signatureDataUrl}" style="height:40px;object-fit:contain;margin-bottom:8px;display:block;border-radius:4px;" />`:''}
                  <input type="file" id="sig-file" accept="image/png,image/jpeg,image/jpg" class="input" style="padding:5px;font-size:12px;" onchange="SettingsPage.uploadAsset('signature','signatureDataUrl',this)" />
                  <div class="form-hint">Authorized signatory signature.</div>
                </div>
                <div class="form-group">
                  <label class="form-label">Payment QR code (PNG/JPG)</label>
                  ${c.qrDataUrl?`<img src="${c.qrDataUrl}" style="height:40px;object-fit:contain;margin-bottom:8px;display:block;border-radius:4px;" />`:''}
                  <input type="file" id="qr-file" accept="image/png,image/jpeg,image/jpg" class="input" style="padding:5px;font-size:12px;" onchange="SettingsPage.uploadAsset('qr','qrDataUrl',this)" />
                  <div class="form-hint">UPI/Gpay QR for payments.</div>
                </div>
              </div>
            </div>

            <div class="form-group mb-5">
              <label class="form-label">Authorized signatory name</label>
              <input class="input" name="signatoryName" value="${c.signatoryName||''}" placeholder="Full name as authorized signatory" />
            </div>

            <button type="submit" id="btn-save-co" class="btn btn-primary">Save company details</button>
          </form>
        </div>
      </div>`;

    if (this._tab==='invoice') return `
      <div class="card">
        <div class="card-header"><h2>Invoice settings</h2></div>
        <div class="card-body">
          <form id="invoice-form">
            <div class="form-row mb-4">
              <div class="form-group"><label class="form-label">Invoice prefix</label><input class="input" name="invoicePrefix" value="${c.invoicePrefix||'INV'}" maxlength="10" /><div class="form-hint">e.g. MM → MM-0001</div></div>
              <div class="form-group"><label class="form-label">Default credit days</label><input class="input" type="number" name="defaultCreditDays" value="${c.defaultCreditDays||30}" min="0" /></div>
            </div>
            <div class="form-row mb-4">
              <div class="form-group"><label class="form-label">Default payment terms</label><textarea class="textarea" name="defaultTerms" rows="2">${c.defaultTerms||''}</textarea></div>
              <div class="form-group"><label class="form-label">Default invoice notes</label><textarea class="textarea" name="defaultNotes" rows="2">${c.defaultNotes||''}</textarea></div>
            </div>
            <div class="form-group mb-5">
              <label class="form-label">Invoice categories (comma separated)</label>
              <input class="input" name="invoiceCategories" value="${(c.invoiceCategories||['Consulting','Software','Marketing','Design','Legal','Travel','Other']).join(', ')}" />
              <div class="form-hint">These appear as "Type" dropdown on invoices</div>
            </div>
            <button type="submit" class="btn btn-primary">Save invoice settings</button>
          </form>
        </div>
      </div>`;

    if (this._tab==='bank') return `
      <div class="card">
        <div class="card-header"><h2>Bank & payment details</h2></div>
        <div class="card-body">
          <form id="bank-form">
            <div class="form-row mb-4">
              <div class="form-group"><label class="form-label">Account holder name</label><input class="input" name="bankName" value="${c.bankName||''}" placeholder="Name as in bank account" /></div>
              <div class="form-group"><label class="form-label">Bank name</label><input class="input" name="bankBankName" value="${c.bankBankName||''}" placeholder="ICICI Bank" /></div>
            </div>
            <div class="form-row mb-4">
              <div class="form-group"><label class="form-label">Account number</label><input class="input" name="bankAccountNo" value="${c.bankAccountNo||''}" placeholder="000123456789" /></div>
              <div class="form-group"><label class="form-label">IFSC code</label><input class="input" name="bankIFSC" value="${c.bankIFSC||''}" placeholder="ICIC0001234" style="text-transform:uppercase;" /></div>
            </div>
            <div class="form-row mb-4">
              <div class="form-group"><label class="form-label">Branch</label><input class="input" name="bankBranch" value="${c.bankBranch||''}" /></div>
              <div class="form-group"><label class="form-label">Account type</label><select class="select" name="bankAccountType"><option value="Current" ${c.bankAccountType==='Current'?'selected':''}>Current</option><option value="Savings" ${c.bankAccountType==='Savings'?'selected':''}>Savings</option></select></div>
            </div>
            <div class="form-row mb-4">
              <div class="form-group"><label class="form-label">UPI ID</label><input class="input" name="upiId" value="${c.upiId||''}" placeholder="yourname@upi" /></div>
              <div class="form-group"><label class="form-label">Razorpay / payment link</label><input class="input" name="razorpayLink" value="${c.razorpayLink||''}" placeholder="https://rzp.io/l/yourlink" /></div>
            </div>
            <div class="form-group mb-5">
              <label class="form-label">Payment remarks</label>
              <textarea class="textarea" name="paymentRemarks" rows="2" placeholder="e.g. 50% advance required. Kindly pay within 24 hours.">${c.paymentRemarks||''}</textarea>
            </div>
            <button type="submit" class="btn btn-primary">Save bank details</button>
          </form>
        </div>
      </div>`;

    if (this._tab==='profile') return `
      <div class="card">
        <div class="card-header"><h2>My profile</h2></div>
        <div class="card-body">
          <div style="display:flex;align-items:center;gap:14px;padding:16px;background:var(--bg-subtle);border-radius:10px;margin-bottom:24px;">
            <div style="width:52px;height:52px;border-radius:50%;background:linear-gradient(135deg,#3B82F6,#1D4ED8);color:white;display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:700;">${(u.displayName||u.email||'U').charAt(0).toUpperCase()}</div>
            <div><div style="font-weight:700;font-size:16px;">${u.displayName||'—'}</div><div style="font-size:13px;color:var(--text-tertiary);">${u.email}</div><div style="margin-top:6px;"><span class="badge badge-info">${role.charAt(0).toUpperCase()+role.slice(1)}</span></div></div>
          </div>
          <form id="profile-form">
            <div class="form-row mb-4">
              <div class="form-group"><label class="form-label">Display name</label><input class="input" id="pf-name" value="${u.displayName||''}" /></div>
              <div class="form-group"><label class="form-label">Email</label><input class="input" value="${u.email}" disabled /><div class="form-hint">Cannot be changed</div></div>
            </div>
            <button type="submit" id="btn-save-pf" class="btn btn-primary">Save profile</button>
          </form>
        </div>
      </div>`;
    return '';
  },

  setTab(tab) {
    this._tab = tab;
    const el = document.getElementById('settings-tab');
    if (!el) return;
    if (tab==='team') {
      el.innerHTML = '<div style="text-align:center;padding:32px;font-size:13px;color:var(--text-tertiary);">Loading team…</div>';
      TeamController.loadTab(el);
    } else {
      el.innerHTML = this._tabHTML();
      this._bindForms();
    }
    document.querySelectorAll('.sidebar-item').forEach(el=>{
      const lbl=el.querySelector('.sidebar-item-label')?.textContent?.toLowerCase().trim()||'';
      const map={'company':'company','invoice':'invoice','bank & payments':'bank','team & members':'team','my profile':'profile'};
      el.classList.toggle('active',map[lbl]===tab);
    });
  },

  async uploadAsset(type, storeKey, inputEl) {
    const file = inputEl?.files?.[0];
    if (!file) return;
    if (file.size > 2*1024*1024) { Toast.error('File too large (max 2MB)'); return; }
    try {
      const dataUrl = await toDataURL(file);
      // Save to Firestore company record
      const cid = Store.get('companyId');
      if (cid) {
        const{default:CS}=await import('../../services/company.service.js');
        await CS.update(cid, {[storeKey]: dataUrl});
      }
      Store.set('company', {...Store.get('company'), [storeKey]: dataUrl});
      Toast.success(`${type.charAt(0).toUpperCase()+type.slice(1)} uploaded!`);
      // Refresh to show preview
      this.setTab(this._tab);
    } catch(e) { Toast.error('Upload failed: '+e.message); }
  },

  _bindForms() {
    document.getElementById('company-form')?.addEventListener('submit', async e => {
      e.preventDefault();
      const btn=document.getElementById('btn-save-co');
      const data=Object.fromEntries(new FormData(e.target));
      if(!data.name?.trim()){Toast.error('Company name required');return;}
      btn.classList.add('loading');
      try{
        const{default:C}=await import('../../services/company.service.js');
        let cid=Store.get('companyId');
        const payload=clean({name:data.name.trim(),gstin:data.gstin?.toUpperCase()||null,pan:data.pan?.toUpperCase()||null,email:data.email||null,phone:data.phone||null,website:data.website||null,address:data.address||null,city:data.city||null,state:data.state||null,pincode:data.pincode||null,signatoryName:data.signatoryName||null});
        if(!cid){
          cid=await C.create(Store.get('user')?.uid,data);
          Store.set('companyId',cid);
          const comps=Store.get('companies')||[];Store.set('companies',[...comps,{id:cid,...payload,role:'founder'}]);
          Toast.success('Company created!');
        }else{
          await C.update(cid,payload);Store.set('company',{...Store.get('company'),...payload});Toast.success('Company saved');
        }
        const{default:Sidebar}=await import('../../components/Sidebar.js');Sidebar.render();
      }catch(err){Toast.error('Failed: '+err.message);}finally{btn.classList.remove('loading');}
    });

    document.getElementById('invoice-form')?.addEventListener('submit', async e=>{
      e.preventDefault();
      const data=Object.fromEntries(new FormData(e.target));
      const cats=data.invoiceCategories?.split(',').map(s=>s.trim()).filter(Boolean)||[];
      try{const cid=Store.get('companyId');if(cid){const{default:C}=await import('../../services/company.service.js');await C.update(cid,clean({invoicePrefix:data.invoicePrefix,defaultCreditDays:parseInt(data.defaultCreditDays)||30,defaultTerms:data.defaultTerms||null,defaultNotes:data.defaultNotes||null,invoiceCategories:cats}));}Store.set('company',{...Store.get('company'),...data,invoiceCategories:cats});Toast.success('Invoice settings saved');}catch(e){Toast.error('Failed: '+e.message);}
    });

    document.getElementById('bank-form')?.addEventListener('submit', async e=>{
      e.preventDefault();
      const data=Object.fromEntries(new FormData(e.target));
      try{const cid=Store.get('companyId');if(cid){const{default:C}=await import('../../services/company.service.js');await C.update(cid,clean(data));}Store.set('company',{...Store.get('company'),...data});Toast.success('Bank details saved');}catch(e){Toast.error('Failed: '+e.message);}
    });

    document.getElementById('profile-form')?.addEventListener('submit', async e=>{
      e.preventDefault();
      const btn=document.getElementById('btn-save-pf');
      const name=document.getElementById('pf-name')?.value?.trim();
      btn.classList.add('loading');
      try{const{updateProfile}=await import('https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js');if(name)await updateProfile(window.fbAuth.currentUser,{displayName:name});Store.set('user',{...Store.get('user'),displayName:name});const{default:S}=await import('../../components/Sidebar.js');S.render();Toast.success('Profile updated');}catch(e){Toast.error('Failed: '+e.message);}finally{btn.classList.remove('loading');}
    });
  },
};
export default SettingsPage;
