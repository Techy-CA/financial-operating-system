import Router  from '../../core/router.js';
import Topbar  from '../../components/Topbar.js';
import Toast   from '../../components/Toast.js';
import Store   from '../../core/store.js';
import { calcInvoiceGST, amountInWords } from '../invoices/gst-calculator.js';
import { formatCurrency } from '../../utils/formatters.js';
import { GST_RATE_OPTIONS } from '../../utils/constants.js';

function clean(o){const r={};for(const[k,v]of Object.entries(o)){if(v!==undefined&&v!==null&&v!=='')r[k]=v;}return r;}

const QuotationFormPage = {
  _id:null, _customers:[], _items:[{description:'',hsn:'',qty:1,unit:'Nos',rate:0,discount:0,gstRate:18}],

  async init(id) {
    this._id=id;
    let q={};
    try {
      const { default: DB } = await import('../../services/firestore.js');
      this._customers = await DB.getAll('customers',[]);
      if (id) { q = await DB.getOne('quotations',id)||{}; if(q.items?.length)this._items=q.items; }
    } catch(e) { this._customers=[]; }
    Topbar.render({ breadcrumb:[{label:'Quotations',route:'/quotations'},{label:id?'Edit quotation':'New quotation'}] });
    this._render(q);
  },

  _render(q={}) {
    const today = new Date().toISOString().split('T')[0];
    const valid30 = new Date(Date.now()+30*86400000).toISOString().split('T')[0];
    const custOpts = this._customers.map(c=>`<option value="${c.id}" ${q.customerId===c.id?'selected':''}>${c.name}</option>`).join('');
    const gstOpts  = GST_RATE_OPTIONS.map(r=>`<option value="${r.value}">${r.label}</option>`).join('');

    Router.render(`
      <div style="max-width:900px;">
        <div class="page-header">
          <div class="page-header-left"><h1>${this._id?'Edit quotation':'New quotation'}</h1></div>
          <div class="page-header-actions"><a href="#/quotations" class="btn btn-secondary">Cancel</a></div>
        </div>
        <form id="quo-form">
          <div class="card mb-4">
            <div class="card-header"><h2>Quotation details</h2></div>
            <div class="card-body">
              <div class="form-row mb-4">
                <div class="form-group">
                  <label class="form-label">Customer *</label>
                  <select class="select" name="customerId" required>
                    <option value="">Select customer…</option>${custOpts}
                  </select>
                  ${this._customers.length===0?`<div class="form-hint"><a href="#/customers/new" style="color:var(--brand-primary);">+ Add customer first</a></div>`:''}
                </div>
                <div class="form-group">
                  <label class="form-label">Quotation date</label>
                  <input class="input" type="date" name="quotationDate" value="${q.quotationDate||today}" />
                </div>
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">Valid until</label>
                  <input class="input" type="date" name="validUntil" value="${q.validUntil||valid30}" />
                </div>
                <div class="form-group">
                  <label class="form-label">Subject</label>
                  <input class="input" name="subject" value="${q.subject||''}" placeholder="e.g. Website development proposal" />
                </div>
              </div>
            </div>
          </div>

          <div class="card mb-4">
            <div class="card-header">
              <h2>Line items</h2>
              <button type="button" class="btn btn-secondary btn-sm" onclick="QuotationFormPage.addItem()">+ Add line</button>
            </div>
            <div class="table-wrapper">
              <table class="data-table">
                <thead><tr><th style="min-width:200px;">Description</th><th style="width:80px;">HSN/SAC</th><th style="width:65px;">Qty</th><th style="width:100px;">Rate (₹)</th><th style="width:70px;">Disc%</th><th style="width:75px;">GST%</th><th style="width:110px;" class="text-right">Amount</th><th style="width:36px;"></th></tr></thead>
                <tbody id="quo-items">${this._items.map((item,i)=>this._itemRow(item,i)).join('')}</tbody>
              </table>
            </div>
            <div style="display:flex;justify-content:flex-end;padding:14px 20px;background:var(--bg-subtle);border-top:1px solid var(--border-subtle);">
              <div style="width:250px;" id="quo-totals">${this._totalsHTML()}</div>
            </div>
          </div>

          <div class="card mb-4">
            <div class="card-header"><h2>Notes & terms</h2></div>
            <div class="card-body">
              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">Notes to customer</label>
                  <textarea class="textarea" name="notes" rows="2">${q.notes||''}</textarea>
                </div>
                <div class="form-group">
                  <label class="form-label">Terms & conditions</label>
                  <textarea class="textarea" name="terms" rows="2">${q.terms||''}</textarea>
                </div>
              </div>
            </div>
          </div>

          <div style="display:flex;gap:10px;flex-wrap:wrap;">
            <button type="submit" id="btn-save-quo" data-action="draft" class="btn btn-secondary btn-lg">Save as draft</button>
            <button type="button" id="btn-send-quo" class="btn btn-primary btn-lg" onclick="QuotationFormPage.submit('sent')">Save & mark sent</button>
          </div>
        </form>
      </div>
    `);
    window.QuotationFormPage = this;
    document.getElementById('quo-form')?.addEventListener('submit', e=>{ e.preventDefault(); this.submit('draft'); });
  },

  _itemRow(item,i) {
    const gOpts=GST_RATE_OPTIONS.map(r=>`<option value="${r.value}" ${item.gstRate==r.value?'selected':''}>${r.value}%</option>`).join('');
    const amt=(parseFloat(item.qty)||0)*(parseFloat(item.rate)||0)*(1-((parseFloat(item.discount)||0)/100));
    return `<tr id="qrow-${i}">
      <td><input class="input" name="qdesc_${i}" value="${item.description||''}" placeholder="Description" oninput="QuotationFormPage.upd(${i},'description',this.value)"/></td>
      <td><input class="input" name="qhsn_${i}" value="${item.hsn||''}" placeholder="HSN" oninput="QuotationFormPage.upd(${i},'hsn',this.value)"/></td>
      <td><input class="input" type="number" name="qqty_${i}" value="${item.qty||1}" min="0.01" step="0.01" style="text-align:right;" oninput="QuotationFormPage.upd(${i},'qty',this.value)"/></td>
      <td><input class="input" type="number" name="qrate_${i}" value="${item.rate||0}" min="0" step="0.01" style="text-align:right;" oninput="QuotationFormPage.upd(${i},'rate',this.value)"/></td>
      <td><input class="input" type="number" name="qdisc_${i}" value="${item.discount||0}" min="0" max="100" style="text-align:right;" oninput="QuotationFormPage.upd(${i},'discount',this.value)"/></td>
      <td><select class="select" name="qgst_${i}" onchange="QuotationFormPage.upd(${i},'gstRate',this.value)">${gOpts}</select></td>
      <td class="text-right"><span id="qamt-${i}" style="font-weight:600;font-size:13px;">${formatCurrency(amt)}</span></td>
      <td><button type="button" class="btn btn-ghost btn-icon btn-sm" onclick="QuotationFormPage.removeItem(${i})" ${this._items.length<=1?'disabled':''}><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--color-danger)" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg></button></td>
    </tr>`;
  },

  _totalsHTML() {
    const calc=calcInvoiceGST(this._items,false);
    return `<div style="display:flex;flex-direction:column;gap:5px;font-size:13px;">
      <div style="display:flex;justify-content:space-between;color:var(--text-secondary);"><span>Subtotal</span><span>${formatCurrency(calc.subTotal)}</span></div>
      <div style="display:flex;justify-content:space-between;color:var(--text-secondary);"><span>GST</span><span>${formatCurrency(calc.totalGST)}</span></div>
      <div style="height:1px;background:var(--border-default);margin:4px 0;"></div>
      <div style="display:flex;justify-content:space-between;font-size:16px;font-weight:700;"><span>Total</span><span>${formatCurrency(calc.grandTotal)}</span></div>
    </div>`;
  },

  addItem(){this._items.push({description:'',hsn:'',qty:1,unit:'Nos',rate:0,discount:0,gstRate:18});const b=document.getElementById('quo-items');if(b)b.insertAdjacentHTML('beforeend',this._itemRow(this._items[this._items.length-1],this._items.length-1));this._recalc();},
  removeItem(i){if(this._items.length<=1)return;this._items.splice(i,1);const b=document.getElementById('quo-items');if(b)b.innerHTML=this._items.map((item,idx)=>this._itemRow(item,idx)).join('');this._recalc();},
  upd(i,f,v){this._items[i][f]=['qty','rate','discount','gstRate'].includes(f)?parseFloat(v)||0:v;const g=(this._items[i].qty||0)*(this._items[i].rate||0)*(1-((this._items[i].discount||0)/100));const el=document.getElementById(`qamt-${i}`);if(el)el.textContent=formatCurrency(g);this._recalc();},
  _recalc(){const b=document.getElementById('quo-totals');if(b)b.innerHTML=this._totalsHTML();},

  async submit(status) {
    const f=new FormData(document.getElementById('quo-form'));
    const data=Object.fromEntries(f);
    if(!data.customerId){Toast.error('Please select a customer');return;}
    const custName=document.querySelector('[name="customerId"] option:checked')?.textContent||'';
    const calc=calcInvoiceGST(this._items,false);
    const btn=document.getElementById('btn-save-quo');
    if(btn)btn.disabled=true;
    try {
      const { default: DB } = await import('../../services/firestore.js');
      const payload=clean({customerId:data.customerId,customerName:custName,quotationDate:data.quotationDate,validUntil:data.validUntil,subject:data.subject||null,notes:data.notes||null,terms:data.terms||null,subTotal:calc.subTotal,totalGST:calc.totalGST,grandTotal:calc.grandTotal,status});
      if(this._id)await DB.update('quotations',this._id,payload);
      else await DB.create('quotations',payload);
      Toast.success(status==='sent'?'Quotation saved and marked as sent':'Quotation saved as draft');
      window.location.hash='#/quotations';
    } catch(e){if(btn)btn.disabled=false;Toast.error('Failed: '+e.message);}
  },
};
export default QuotationFormPage;
