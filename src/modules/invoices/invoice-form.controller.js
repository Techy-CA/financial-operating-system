import Router  from '../../core/router.js';
import Topbar  from '../../components/Topbar.js';
import Toast   from '../../components/Toast.js';
import Store   from '../../core/store.js';
import { calcInvoiceGST, amountInWords } from './gst-calculator.js';
import { formatCurrency } from '../../utils/formatters.js';
import { GST_RATE_OPTIONS } from '../../utils/constants.js';
import Icon from '../../utils/icons.js';

function clean(o){const r={};for(const[k,v]of Object.entries(o)){if(v!==undefined&&v!==null&&v!=='')r[k]=v;}return r;}

const InvoiceFormPage = {
  _id:null,_customers:[],_products:[],_items:[],_interState:false,

  async init(id=null) {
    this._id=id; this._items=[this._newItem()];
    let invoice={};
    try{
      const{default:DB}=await import('../../services/firestore.js');
      [this._customers,this._products]=await Promise.all([
        DB.getAll('customers',[]).catch(()=>[]),
        DB.getAll('products',[]).catch(()=>[]),
      ]);
      if(id){invoice=await DB.getOne('invoices',id)||{};if(invoice.items?.length)this._items=invoice.items;}
    }catch(e){this._customers=[];this._products=[];}
    Topbar.render({breadcrumb:[{label:'Invoices',route:'/invoices'},{label:id?'Edit invoice':'New invoice'}]});
    this._render(invoice);
  },

  _newItem(){return{description:'',hsn:'',qty:1,unit:'Nos',rate:0,discount:0,gstRate:18};},

  _render(inv={}){
    const today=new Date().toISOString().split('T')[0];
    const due30=new Date(Date.now()+((Store.get('company')?.defaultCreditDays||30)*86400000)).toISOString().split('T')[0];
    const custOpts=this._customers.map(c=>`<option value="${c.id}" data-state="${c.state||''}" data-gstin="${c.gstin||''}" data-email="${c.email||''}" data-addr="${encodeURIComponent(c.address||'')} ${c.city||''} ${c.state||''} ${c.pincode||''}" ${inv.customerId===c.id?'selected':''}>${c.name}</option>`).join('');
    const gstOpts=GST_RATE_OPTIONS.map(r=>`<option value="${r.value}">${r.label}</option>`).join('');
    const company=Store.get('company')||{};
    const catOpts=(company.invoiceCategories||['Consulting','Software','Marketing','Design','Legal','Travel','Other']).map(c=>`<option value="${c}" ${inv.invoiceCategory===c?'selected':''}>${c}</option>`).join('');

    Router.render(`
      <div style="max-width:960px;">
        <div class="page-header">
          <div class="page-header-left"><h1>${this._id?'Edit invoice':'New tax invoice'}</h1></div>
          <div class="page-header-actions"><a href="#/invoices" class="btn btn-secondary">Cancel</a></div>
        </div>
        <form id="inv-form" novalidate>
          <!-- Meta -->
          <div class="card mb-4">
            <div class="card-header"><h2>Invoice details</h2></div>
            <div class="card-body">
              <div class="form-row mb-4">
                <div class="form-group"><label class="form-label">Invoice number</label><input class="input" name="invoiceNumber" value="${inv.invoiceNumber||''}" placeholder="Auto-generated" /><div class="form-hint">Leave blank to auto-generate</div></div>
                <div class="form-group"><label class="form-label">Invoice type / category</label>
                  <select class="select" name="invoiceCategory">
                    <option value="">Select category…</option>${catOpts}
                    <option value="__custom__">+ Custom category…</option>
                  </select>
                </div>
              </div>
              <div class="form-row">
                <div class="form-group"><label class="form-label">Invoice date *</label><input class="input" type="date" name="invoiceDate" value="${inv.invoiceDate||today}" required /></div>
                <div class="form-group"><label class="form-label">Due date *</label><input class="input" type="date" name="dueDate" value="${inv.dueDate||due30}" required /></div>
              </div>
            </div>
          </div>

          <!-- Bill to -->
          <div class="card mb-4">
            <div class="card-header"><h2>Bill to</h2></div>
            <div class="card-body">
              <div class="form-row mb-3">
                <div class="form-group"><label class="form-label">Customer *</label>
                  <select class="select" id="sel-cust" name="customerId" required>
                    <option value="">Select customer…</option>${custOpts}
                  </select>
                  ${this._customers.length===0?`<div class="form-hint"><a href="#/customers/new" style="color:var(--brand-primary);">+ Add customer first</a></div>`:''}
                </div>
                <div class="form-group"><label class="form-label">Place of supply</label><input class="input" id="pos" name="placeOfSupply" value="${inv.placeOfSupply||company?.state||''}" /></div>
              </div>
              <div id="gst-info" style="display:none;background:var(--bg-subtle);border:1px solid var(--border-subtle);border-radius:8px;padding:9px 14px;font-size:12.5px;display:flex;align-items:center;gap:8px;"></div>
            </div>
          </div>

          <!-- Line items -->
          <div class="card mb-4">
            <div class="card-header">
              <h2>Line items</h2>
              <button type="button" class="btn btn-secondary btn-sm" onclick="InvoiceFormPage.addItem()">+ Add line</button>
            </div>
            <!-- Product search hint -->
            <div style="padding:8px 16px 0;font-size:12px;color:var(--text-tertiary);display:flex;align-items:center;gap:6px;">
              ${Icon.bulb(13)} Type in description to search your products/services
            </div>
            <div class="table-wrapper">
              <table class="data-table">
                <thead><tr><th style="min-width:200px;">Description</th><th style="width:85px;">HSN/SAC</th><th style="width:65px;">Qty</th><th style="width:65px;">Unit</th><th style="width:100px;">Rate (₹)</th><th style="width:70px;">Disc%</th><th style="width:78px;">GST%</th><th style="width:110px;" class="text-right">Amount</th><th style="width:36px;"></th></tr></thead>
                <tbody id="items-body">${this._items.map((item,i)=>this._itemRow(item,i)).join('')}</tbody>
              </table>
            </div>
            <div style="display:flex;justify-content:flex-end;padding:14px 20px;background:var(--bg-subtle);border-top:1px solid var(--border-subtle);">
              <div style="width:260px;" id="totals-box">${this._totalsHTML()}</div>
            </div>
          </div>

          <!-- Notes -->
          <div class="card mb-4">
            <div class="card-header"><h2>Notes, terms & payment</h2></div>
            <div class="card-body">
              <div class="form-row mb-4">
                <div class="form-group"><label class="form-label">Notes to customer</label><textarea class="textarea" name="notes" rows="2">${inv.notes||company?.defaultNotes||''}</textarea></div>
                <div class="form-group"><label class="form-label">Payment terms</label><textarea class="textarea" name="terms" rows="2">${inv.terms||company?.defaultTerms||''}</textarea></div>
              </div>
              <div class="form-row">
                <div class="form-group"><label class="form-label">Payment link (Razorpay/Paytm/etc.)</label><input class="input" name="paymentLink" value="${inv.paymentLink||company?.razorpayLink||''}" placeholder="https://rzp.io/l/yourlink" /><div class="form-hint">Appears as clickable link in PDF</div></div>
              </div>
            </div>
          </div>

          <!-- Actions -->
          <div style="display:flex;gap:10px;flex-wrap:wrap;">
            <button type="submit" id="btn-send" class="btn btn-primary btn-lg" data-action="sent">${Icon.mail(15)} Save & mark sent</button>
            <button type="submit" id="btn-draft" class="btn btn-secondary btn-lg" data-action="draft">${Icon.save(15)} Save as draft</button>
            <button type="button" class="btn btn-ghost btn-lg" onclick="InvoiceFormPage.previewPDF()">${Icon.eye(15)} Preview PDF</button>
          </div>
        </form>
      </div>

      <!-- Product autocomplete dropdown -->
      <div id="prod-dropdown" style="display:none;position:fixed;background:white;border:1px solid var(--border-default);border-radius:8px;box-shadow:var(--shadow-lg);z-index:200;max-height:200px;overflow-y:auto;min-width:240px;"></div>
    `);

    window.InvoiceFormPage=this;
    this._attachListeners();
    this._recalc();
  },

  _itemRow(item,i){
    const gOpts=GST_RATE_OPTIONS.map(r=>`<option value="${r.value}" ${item.gstRate==r.value?'selected':''}>${r.value}%</option>`).join('');
    const units=['Nos','Hrs','Days','Kg','L','Mtr','Sqmt','Set','Month','Box'].map(u=>`<option value="${u}" ${item.unit===u?'selected':''}>${u}</option>`).join('');
    const amt=(parseFloat(item.qty)||0)*(parseFloat(item.rate)||0)*(1-((parseFloat(item.discount)||0)/100));
    return `<tr id="row-${i}">
      <td style="position:relative;">
        <input class="input" name="desc_${i}" value="${item.description||''}" placeholder="Search products…"
          oninput="InvoiceFormPage.searchProduct(${i},this.value)"
          onblur="setTimeout(()=>InvoiceFormPage.hideDropdown(),200)"
          onfocus="InvoiceFormPage.searchProduct(${i},this.value)"
          onchange="InvoiceFormPage.upd(${i},'description',this.value)" />
      </td>
      <td><input class="input" name="hsn_${i}" value="${item.hsn||''}" oninput="InvoiceFormPage.upd(${i},'hsn',this.value)" /></td>
      <td><input class="input" type="number" name="qty_${i}" value="${item.qty||1}" min="0.01" step="0.01" style="text-align:right;" oninput="InvoiceFormPage.upd(${i},'qty',this.value)" /></td>
      <td><select class="select" name="unit_${i}" onchange="InvoiceFormPage.upd(${i},'unit',this.value)">${units}</select></td>
      <td><input class="input" type="number" name="rate_${i}" id="rate_${i}" value="${item.rate||0}" min="0" step="0.01" style="text-align:right;" oninput="InvoiceFormPage.upd(${i},'rate',this.value)" /></td>
      <td><input class="input" type="number" name="disc_${i}" value="${item.discount||0}" min="0" max="100" style="text-align:right;" oninput="InvoiceFormPage.upd(${i},'discount',this.value)" /></td>
      <td><select class="select" name="gst_${i}" id="gst_${i}" onchange="InvoiceFormPage.upd(${i},'gstRate',this.value)">${gOpts}</select></td>
      <td class="text-right"><span id="iamt-${i}" style="font-weight:600;font-size:13px;">${formatCurrency(amt)}</span></td>
      <td><button type="button" class="btn btn-ghost btn-icon btn-sm" onclick="InvoiceFormPage.removeItem(${i})" ${this._items.length<=1?'disabled':''}><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--color-danger)" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg></button></td>
    </tr>`;
  },

  _totalsHTML(){
    const calc=calcInvoiceGST(this._items,this._interState);
    return `<div style="display:flex;flex-direction:column;gap:5px;font-size:13px;">
      <div style="display:flex;justify-content:space-between;color:var(--text-secondary);"><span>Subtotal</span><span>${formatCurrency(calc.subTotal)}</span></div>
      ${calc.totalDiscount>0?`<div style="display:flex;justify-content:space-between;color:var(--color-success);"><span>Discount</span><span>-${formatCurrency(calc.totalDiscount)}</span></div>`:''}
      ${this._interState?`<div style="display:flex;justify-content:space-between;color:var(--text-secondary);"><span>IGST</span><span>${formatCurrency(calc.igst)}</span></div>`:`<div style="display:flex;justify-content:space-between;color:var(--text-secondary);"><span>CGST</span><span>${formatCurrency(calc.cgst)}</span></div><div style="display:flex;justify-content:space-between;color:var(--text-secondary);"><span>SGST</span><span>${formatCurrency(calc.sgst)}</span></div>`}
      <div style="height:1px;background:var(--border-default);margin:3px 0;"></div>
      <div style="display:flex;justify-content:space-between;font-size:17px;font-weight:700;"><span>Total</span><span>${formatCurrency(calc.grandTotal)}</span></div>
      <div style="font-size:10.5px;color:var(--text-tertiary);line-height:1.4;">${amountInWords(calc.grandTotal)}</div>
    </div>`;
  },

  // ── PRODUCT SEARCH AUTOCOMPLETE ───────────────────────────────
  _activeRow: null,
  searchProduct(rowIdx, val) {
    this._activeRow = rowIdx;
    const dd = document.getElementById('prod-dropdown');
    if (!dd) return;
    if (!val || val.length < 1) { dd.style.display='none'; return; }

    const q = val.toLowerCase();
    const matches = this._products.filter(p =>
      p.name?.toLowerCase().includes(q) ||
      p.hsn?.toLowerCase().includes(q) ||
      p.description?.toLowerCase().includes(q)
    ).slice(0, 8);

    if (matches.length === 0) { dd.style.display='none'; return; }

    const input = document.querySelector(`[name="desc_${rowIdx}"]`);
    if (input) {
      const rect = input.getBoundingClientRect();
      dd.style.top    = (rect.bottom + window.scrollY + 2) + 'px';
      dd.style.left   = rect.left + 'px';
      dd.style.width  = Math.max(rect.width, 260) + 'px';
    }

    dd.innerHTML = matches.map(p => `
      <div onclick="InvoiceFormPage.selectProduct(${rowIdx},'${p.id}')"
        style="padding:9px 12px;cursor:pointer;border-bottom:1px solid var(--border-subtle);transition:background 0.1s;"
        onmouseover="this.style.background='#EEF2FF'" onmouseout="this.style.background='white'">
        <div style="font-size:13px;font-weight:600;color:var(--text-primary);">${p.name}</div>
        <div style="font-size:11px;color:var(--text-tertiary);">${p.hsn||p.sac||''} · ₹${p.rate||0} · GST ${p.gstRate||0}%</div>
      </div>`).join('');

    dd.style.display = 'block';
  },

  selectProduct(rowIdx, productId) {
    const p = this._products.find(x => x.id === productId);
    if (!p) return;
    this._items[rowIdx] = {
      ...this._items[rowIdx],
      description: p.name,
      hsn: p.hsn || p.sac || '',
      rate: parseFloat(p.rate) || 0,
      unit: p.unit || 'Nos',
      gstRate: parseFloat(p.gstRate) || 18,
    };
    this.hideDropdown();
    const body = document.getElementById('items-body');
    if (body) body.innerHTML = this._items.map((item,idx) => this._itemRow(item,idx)).join('');
    this._recalc();
  },

  hideDropdown() {
    const dd = document.getElementById('prod-dropdown');
    if (dd) dd.style.display = 'none';
  },

  addItem(){
    this._items.push(this._newItem());
    const body=document.getElementById('items-body');
    if(body)body.insertAdjacentHTML('beforeend',this._itemRow(this._items[this._items.length-1],this._items.length-1));
    this._recalc();
  },

  removeItem(i){
    if(this._items.length<=1)return;
    this._items.splice(i,1);
    const body=document.getElementById('items-body');
    if(body)body.innerHTML=this._items.map((item,idx)=>this._itemRow(item,idx)).join('');
    this._recalc();
  },

  upd(i,f,v){
    this._items[i][f]=['qty','rate','discount','gstRate'].includes(f)?parseFloat(v)||0:v;
    const item=this._items[i];
    const amt=(item.qty||0)*(item.rate||0)*(1-((item.discount||0)/100));
    const el=document.getElementById(`iamt-${i}`);
    if(el)el.textContent=formatCurrency(amt);
    this._recalc();
  },

  _recalc(){const box=document.getElementById('totals-box');if(box)box.innerHTML=this._totalsHTML();},

  _attachListeners(){
    document.getElementById('sel-cust')?.addEventListener('change',e=>{
      const opt=e.target.selectedOptions[0];
      const cState=opt?.dataset.state||'';
      const coState=Store.get('company')?.state||'';
      this._interState=!!(cState&&coState&&cState!==coState);
      const info=document.getElementById('gst-info');
      if(opt?.dataset.gstin&&info){
        info.style.display='flex';
        info.innerHTML=`<span>GSTIN: <strong style="font-family:var(--font-mono);">${opt.dataset.gstin}</strong></span><span class="badge ${this._interState?'badge-info':'badge-success'} ml-auto">${this._interState?'Inter-state (IGST)':'Intra-state (CGST+SGST)'}</span>`;
      }else if(info)info.style.display='none';
      this._recalc();
    });

    // Custom category handler
    document.querySelector('[name="invoiceCategory"]')?.addEventListener('change',e=>{
      if(e.target.value==='__custom__'){
        const custom=prompt('Enter custom category name:');
        if(custom){
          const opt=new Option(custom,custom,true,true);
          e.target.appendChild(opt);
          e.target.value=custom;
        }else{e.target.value='';}
      }
    });

    document.getElementById('inv-form')?.addEventListener('submit',async e=>{
      e.preventDefault();
      const action=e.submitter?.dataset?.action||'draft';
      await this._save(action);
    });
  },

  async _save(action){
    const f=new FormData(document.getElementById('inv-form'));
    const data=Object.fromEntries(f);
    if(!data.customerId){Toast.error('Please select a customer');return;}
    const custName=document.getElementById('sel-cust')?.selectedOptions[0]?.text||'';
    const calc=calcInvoiceGST(this._items,this._interState);
    const btn=action==='sent'?document.getElementById('btn-send'):document.getElementById('btn-draft');
    btn?.classList.add('loading');
    try{
      const{default:DB}=await import('../../services/firestore.js');
      const{default:Svc}=await import('./invoices.service.js');
      const payload=clean({
        invoiceNumber:data.invoiceNumber||null,
        invoiceCategory:data.invoiceCategory||null,
        type:'tax_invoice',
        invoiceDate:data.invoiceDate,
        dueDate:data.dueDate,
        customerId:data.customerId,
        customerName:custName,
        placeOfSupply:data.placeOfSupply||null,
        interState:this._interState,
        notes:data.notes||null,
        terms:data.terms||null,
        paymentLink:data.paymentLink||null,
        subTotal:calc.subTotal,
        totalDiscount:calc.totalDiscount,
        totalTaxable:calc.totalTaxable,
        cgst:calc.cgst,sgst:calc.sgst,igst:calc.igst,
        totalGST:calc.totalGST,
        grandTotal:calc.grandTotal,
        status:action,
      });
      let invId;
      if(this._id){await DB.update('invoices',this._id,payload);invId=this._id;}
      else{invId=await Svc.create(payload);}
      await Svc.saveLineItems(invId,this._items.map((item,i)=>({...item,invoiceId:invId,position:i})));

      // Log activity
      try{const{default:N}=await import('../../components/Notifications.js');await N.log('invoice',`Invoice ${payload.invoiceNumber||invId} ${action==='sent'?'sent':'saved as draft'}`);}catch(e){}

      Toast.success(action==='sent'?'Invoice saved and marked as sent':'Invoice saved as draft');

      // Auto-email when invoice is sent
      if(action==='sent'){
        const custEmail=document.getElementById('sel-cust')?.selectedOptions[0]?.dataset?.email||null;
        if(custEmail){
          import('../../services/email.service.js').then(async m=>{
            try{
              // Get invoice data for email
              const{default:DB2}=await import('../../services/firestore.js');
              const freshInv=await DB2.getOne('invoices',invId);
              if(freshInv){
                freshInv.customerEmail=custEmail;
                await m.default.sendInvoice(freshInv);
                Toast.success(`Invoice emailed to ${custEmail}`);
              }
            }catch(e){console.warn('[Email]',e.message);}
          });
        }
      }

      window.location.hash=`#/invoices/${invId}`;
    }catch(err){btn?.classList.remove('loading');Toast.error('Failed: '+err.message);}
  },

  async previewPDF(){
    const f=new FormData(document.getElementById('inv-form'));
    const data=Object.fromEntries(f);
    const custName=document.getElementById('sel-cust')?.selectedOptions[0]?.text||'';
    const calc=calcInvoiceGST(this._items,this._interState);
    const{generateInvoicePDF}=await import('./invoice-pdf.js');
    generateInvoicePDF({
      invoiceNumber:data.invoiceNumber||'PREVIEW',
      invoiceDate:data.invoiceDate,
      dueDate:data.dueDate,
      customerName:custName,
      placeOfSupply:data.placeOfSupply,
      interState:this._interState,
      notes:data.notes,
      terms:data.terms,
      invoiceCategory:data.invoiceCategory,
      ...calc,
    }, this._items);
  },
};
export default InvoiceFormPage;
