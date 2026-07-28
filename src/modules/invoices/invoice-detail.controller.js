import Router  from '../../core/router.js';
import Topbar  from '../../components/Topbar.js';
import Toast   from '../../components/Toast.js';
import Store   from '../../core/store.js';
import { formatCurrency, formatDate } from '../../utils/formatters.js';
import { INVOICE_STATUS_BADGE, INVOICE_STATUS_LABELS, PAYMENT_METHODS } from '../../utils/constants.js';
import Icon from '../../utils/icons.js';

function daysDue(d){return d?Math.floor((Date.now()-new Date(d).getTime())/86400000):0;}

const InvoiceDetailPage = {
  _inv:null, _pays:[], _items:[], _template:1,

  async init(id) {
    Router.render(`<div class="skeleton" style="height:60px;border-radius:8px;margin-bottom:12px;"></div><div class="skeleton" style="height:500px;border-radius:12px;"></div>`);
    try {
      const{default:DB}=await import('../../services/firestore.js');
      const[inv, pays, rawItems]=await Promise.all([
        DB.getOne('invoices', id),
        DB.getAll('payments',  [DB.where('invoiceId','==',id)]).catch(()=>[]),
        DB.getAll('invoiceItems',[DB.where('invoiceId','==',id)]).catch(()=>[]),
      ]);
      if(!inv){Toast.error('Invoice not found');window.location.hash='#/invoices';return;}

      // Patch companyId if missing (old invoices) + save it for future
      if(!inv.companyId){
        const cid=Store.get('companyId');
        if(cid){
          inv.companyId=cid;
          try{await DB.update('invoices',id,{companyId:cid});}catch(e){}
        }
      }
      const items=rawItems.sort((a,b)=>(a.position||0)-(b.position||0));

      // Enrich customer address from customers collection
      if(inv.customerId && (!inv.customerAddress || !inv.customerEmail)){
        try{
          const cust=await DB.getOne('customers',inv.customerId);
          if(cust){
            if(!inv.customerAddress) inv.customerAddress=[cust.address,cust.city,cust.state&&cust.pincode?`${cust.state} - ${cust.pincode}`:(cust.state||cust.pincode)].filter(Boolean).join(', ');
            if(!inv.customerGSTIN) inv.customerGSTIN=cust.gstin||null;
            if(!inv.customerEmail) inv.customerEmail=cust.email||null;
          }
        }catch(e){}
      }

      const paysSorted=pays.sort((a,b)=>new Date(b.paymentDate||0)-new Date(a.paymentDate||0));
      this._inv=inv; this._pays=paysSorted; this._items=items;
    }catch(e){Toast.error(e.message);return;}

    Topbar.render({
      breadcrumb:[{label:'Invoices',route:'/invoices'},{label:this._inv.invoiceNumber||'Invoice'}],
      actions:this._actions(),
    });
    this._render();
  },

  _actions(){
    const inv=this._inv;
    const hasEmail=!!(inv.customerEmail);
    return `<div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;">
      <select id="tpl-sel" class="select" style="font-size:12px;padding:5px 8px;width:auto;" onchange="InvoiceDetailPage._template=parseInt(this.value)">
        <option value="1">Classic Blue</option>
        <option value="2">Modern Dark</option>
        <option value="3">Minimal Clean</option>
      </select>
      <button class="btn btn-secondary btn-sm" onclick="InvoiceDetailPage.downloadPDF()">${Icon.download(14)} PDF</button>
      <button class="btn btn-secondary btn-sm" onclick="InvoiceDetailPage.copyLink()">${Icon.link(14)} Share</button>
      <button class="btn btn-${hasEmail?'primary':'secondary'} btn-sm" onclick="InvoiceDetailPage.sendEmail()" title="${hasEmail?'Send invoice email':'Add customer email first'}">
        ${Icon.mail(14)} ${hasEmail?'Email invoice':'No email'}
      </button>
      ${inv.status!=='paid'?`<button class="btn btn-primary btn-sm" onclick="InvoiceDetailPage.openPayModal()">${Icon.wallet(14)} Record payment</button>`:''}
      <a href="#/invoices/${inv.id}/edit" class="btn btn-ghost btn-sm">${Icon.edit(14)} Edit</a>
      <button class="btn btn-ghost btn-sm" onclick="InvoiceDetailPage.delInvoice()" style="color:var(--color-danger);">${Icon.trash(14)} Delete</button>
    </div>`;
  },

  async downloadPDF(){
    const{generateInvoicePDF}=await import('./invoice-pdf.js');
    generateInvoicePDF(this._inv,this._items,this._template);
  },

  _publicUrl(){
    const inv=this._inv;
    const cid=inv.companyId||Store.get('companyId')||'';
    const base=`${location.origin}${location.pathname}`;
    // Public URL format: #/invoice/COMPANYID/INVOICEID  (no login needed)
    if(cid) return `${base}#/invoice/${cid}/${inv.id}`;
    return `${base}#/invoices/${inv.id}`; // fallback (requires login)
  },

  copyLink(){
    const url=this._publicUrl();
    navigator.clipboard?.writeText(url)
      .then(()=>Toast.success('Public link copied! Anyone can open this without logging in.'))
      .catch(()=>{prompt('Copy this public invoice link:',url);});
  },

  async sendEmail(){
    const inv=this._inv;
    if(!inv.customerEmail){
      Toast.error(`No email for ${inv.customerName}. Edit the customer and add their email first.`);
      return;
    }
    const btn=document.querySelector('[onclick*="sendEmail"]');
    if(btn){btn.textContent='Sending…';btn.disabled=true;}
    try{
      const{default:EmailSvc}=await import('../../services/email.service.js');
      await EmailSvc.sendInvoice(inv);
      Toast.success(`Invoice emailed to ${inv.customerEmail}`);
    }catch(e){
      Toast.error('Email failed: '+e.message);
      console.error('[Email]',e);
    }finally{
      if(btn){btn.textContent='Email invoice';btn.disabled=false;}
    }
  },

  async delInvoice(){
    if(!confirm(`Delete invoice ${this._inv.invoiceNumber}? Cannot be undone.`))return;
    try{
      const{default:DB}=await import('../../services/firestore.js');
      const items=await DB.getAll('invoiceItems',[DB.where('invoiceId','==',this._inv.id)]).catch(()=>[]);
      for(const i of items) await DB.delete('invoiceItems',i.id);
      await DB.delete('invoices',this._inv.id);
      Toast.success('Invoice deleted');
      window.location.hash='#/invoices';
    }catch(e){Toast.error('Delete failed: '+e.message);}
  },

  _render(){
    const inv=this._inv, pays=this._pays, items=this._items;
    const days=daysDue(inv.dueDate);
    const company=Store.get('company')||{};

    Router.render(`
      <!-- Status bar -->
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:18px;flex-wrap:wrap;gap:10px;">
        <div style="display:flex;align-items:center;gap:10px;">
          <span class="${INVOICE_STATUS_BADGE[inv.status]||'badge badge-neutral'} badge-dot" style="font-size:13px;padding:4px 12px;">${INVOICE_STATUS_LABELS[inv.status]||inv.status||'draft'}</span>
          ${days>0?`<span style="font-size:12px;color:var(--color-danger);font-weight:600;display:inline-flex;align-items:center;gap:4px;">${Icon.alertTriangle(12)} ${days} days overdue</span>`:''}
          ${inv.customerEmail?`<span style="font-size:11px;color:var(--color-success);display:inline-flex;align-items:center;gap:4px;">${Icon.mail(11)} ${inv.customerEmail}</span>`:`<span style="font-size:11px;color:var(--color-warning);display:inline-flex;align-items:center;gap:4px;">${Icon.alertTriangle(11)} No customer email · <a href="#/customers/${inv.customerId}/edit" style="color:var(--brand-primary);">Add email</a></span>`}
        </div>
        <div>${inv.status!=='paid'?`Balance: <strong style="color:var(--color-warning);font-size:18px;">₹${formatCurrency(inv.balanceDue||0)}</strong>`:`<span style="color:var(--color-success);font-weight:700;display:inline-flex;align-items:center;gap:5px;">${Icon.check(13)} Paid in full</span>`}</div>
      </div>

      <!-- Invoice card -->
      <div class="card mb-4" style="overflow:hidden;">
        <div style="background:#1a3a6b;color:white;padding:10px 24px;display:flex;justify-content:space-between;align-items:center;">
          <div style="font-size:14px;font-weight:700;letter-spacing:1px;">INVOICE</div>
          <div style="display:flex;gap:24px;font-size:12px;"><span><strong>${inv.invoiceNumber}</strong></span><span>${formatDate(inv.invoiceDate)}</span></div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;padding:20px 24px;border-bottom:1px solid var(--border-subtle);">
          <div style="display:flex;align-items:flex-start;gap:12px;">
            ${company.logoDataUrl?`<img src="${company.logoDataUrl}" style="height:40px;object-fit:contain;border-radius:4px;" />`:''}
            <div>
              <div style="font-size:16px;font-weight:700;color:#1a3a6b;">${company.name||'Your Company'}</div>
              ${company.gstin?`<div style="font-size:11px;color:var(--text-tertiary);">GSTIN: ${company.gstin}</div>`:''}
              ${company.address?`<div style="font-size:11px;color:var(--text-tertiary);">${company.address}</div>`:''}
              ${company.phone?`<div style="font-size:11px;color:var(--text-tertiary);">${company.phone}</div>`:''}
              ${company.email?`<div style="font-size:11px;color:var(--text-tertiary);">${company.email}</div>`:''}
            </div>
          </div>
          <div style="text-align:right;">
            <div style="font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.6px;color:var(--text-tertiary);margin-bottom:4px;">Bill to</div>
            <div style="font-size:15px;font-weight:700;">${inv.customerName||'—'}</div>
            ${inv.customerAddress?`<div style="font-size:11px;color:var(--text-tertiary);margin-top:3px;line-height:1.5;">${inv.customerAddress}</div>`:''}
            ${inv.customerGSTIN?`<div style="font-size:11px;color:var(--text-tertiary);">GSTIN: ${inv.customerGSTIN}</div>`:''}
            <div style="margin-top:6px;font-size:11px;">Due: <strong ${days>0?'style="color:var(--color-danger);"':''}>${formatDate(inv.dueDate)}</strong></div>
            ${inv.invoiceCategory?`<div style="font-size:11px;color:var(--text-tertiary);">Type: ${inv.invoiceCategory}</div>`:''}
          </div>
        </div>

        <!-- Line items -->
        <div class="table-wrapper">
          <table class="data-table">
            <thead><tr><th>#</th><th>Description</th><th>HSN/SAC</th><th class="text-right">Qty</th><th class="text-right">Rate</th><th class="text-right">Disc%</th><th class="text-right">GST%</th><th class="text-right">Amount</th></tr></thead>
            <tbody>
              ${items.length===0
                ?`<tr><td colspan="8" style="text-align:center;padding:28px;color:var(--text-tertiary);">
                    <div>No line items saved.</div>
                    <div style="font-size:11px;margin-top:4px;"><a href="#/invoices/${inv.id}/edit" style="color:var(--brand-primary);">Edit invoice</a> to add line items.</div>
                  </td></tr>`
                :items.map((item,i)=>{
                  const taxable=(item.qty||0)*(item.rate||0)*(1-((item.discount||0)/100));
                  const gst=taxable*((item.gstRate||0)/100);
                  return `<tr>
                    <td class="muted">${i+1}</td>
                    <td style="font-weight:500;">${item.description||'—'}</td>
                    <td class="muted">${item.hsn||'—'}</td>
                    <td class="text-right muted">${item.qty||1} ${item.unit||''}</td>
                    <td class="col-amount">₹${formatCurrency(item.rate||0)}</td>
                    <td class="text-right muted">${item.discount||0}%</td>
                    <td class="text-right muted">${item.gstRate||0}%</td>
                    <td class="col-amount"><strong>₹${formatCurrency(taxable+gst)}</strong></td>
                  </tr>`;
                }).join('')}
            </tbody>
          </table>
        </div>

        <!-- Totals -->
        <div style="display:flex;justify-content:flex-end;padding:16px 24px;background:var(--bg-subtle);border-top:1px solid var(--border-subtle);">
          <div style="width:280px;display:flex;flex-direction:column;gap:6px;font-size:13px;">
            <div style="display:flex;justify-content:space-between;color:var(--text-secondary);"><span>Subtotal</span><span>₹${formatCurrency(inv.subTotal||0)}</span></div>
            ${(inv.totalDiscount||0)>0?`<div style="display:flex;justify-content:space-between;color:var(--color-success);"><span>Discount</span><span>-₹${formatCurrency(inv.totalDiscount)}</span></div>`:''}
            ${inv.interState
              ?`<div style="display:flex;justify-content:space-between;color:var(--text-secondary);"><span>IGST</span><span>₹${formatCurrency(inv.igst||0)}</span></div>`
              :`<div style="display:flex;justify-content:space-between;color:var(--text-secondary);"><span>CGST</span><span>₹${formatCurrency(inv.cgst||0)}</span></div>
                <div style="display:flex;justify-content:space-between;color:var(--text-secondary);"><span>SGST</span><span>₹${formatCurrency(inv.sgst||0)}</span></div>`}
            <div style="height:1px;background:var(--border-default);margin:4px 0;"></div>
            <div style="display:flex;justify-content:space-between;font-size:19px;font-weight:800;"><span>Total</span><span>₹${formatCurrency(inv.grandTotal||0)}</span></div>
            ${(inv.paidAmount||0)>0?`
              <div style="display:flex;justify-content:space-between;color:var(--color-success);"><span>Paid</span><span>-₹${formatCurrency(inv.paidAmount)}</span></div>
              <div style="display:flex;justify-content:space-between;font-weight:700;color:${(inv.balanceDue||0)>0?'var(--color-warning)':'var(--color-success)'};">
                <span>Balance due</span><span>₹${formatCurrency(inv.balanceDue||0)}</span>
              </div>`:''}
          </div>
        </div>

        <!-- Payment details -->
        ${company.bankAccountNo||company.razorpayLink||company.upiId?`
          <div style="padding:12px 24px;border-top:1px solid var(--border-subtle);background:#f8f9fb;display:flex;flex-wrap:wrap;gap:14px;font-size:12px;align-items:center;">
            ${company.bankName?`<span><span style="color:var(--text-tertiary);">A/c:</span> <strong>${company.bankName}</strong></span>`:''}
            ${company.bankAccountNo?`<span><strong>${company.bankAccountNo}</strong></span>`:''}
            ${company.bankIFSC?`<span>IFSC: <strong>${company.bankIFSC}</strong></span>`:''}
            ${company.upiId?`<span>UPI: <strong>${company.upiId}</strong></span>`:''}
            ${company.razorpayLink?`<a href="${company.razorpayLink}" target="_blank" class="btn btn-success btn-sm" style="text-decoration:none;">${Icon.creditCard(14)} Pay online</a>`:''}
          </div>`:''}

        ${inv.notes?`<div style="padding:12px 24px;border-top:1px solid var(--border-subtle);font-size:13px;color:var(--text-secondary);"><strong style="font-size:10px;text-transform:uppercase;letter-spacing:0.6px;color:var(--text-tertiary);">Notes</strong><br>${inv.notes}</div>`:''}
        ${inv.terms?`<div style="padding:12px 24px;border-top:1px solid var(--border-subtle);font-size:13px;color:var(--text-secondary);"><strong style="font-size:10px;text-transform:uppercase;letter-spacing:0.6px;color:var(--text-tertiary);">Terms</strong><br>${inv.terms}</div>`:''}
      </div>

      <!-- Payment history -->
      ${pays.length>0?`<div class="card mb-4">
        <div class="card-header"><h2>Payment history</h2></div>
        <div class="table-wrapper"><table class="data-table"><thead><tr><th>Date</th><th>Method</th><th>Reference</th><th class="text-right">Amount</th></tr></thead><tbody>
          ${pays.map(p=>`<tr><td>${formatDate(p.paymentDate||p.createdAt)}</td><td class="muted">${p.method||'—'}</td><td class="muted">${p.reference||'—'}</td><td class="col-amount" style="color:var(--color-success);font-weight:600;">₹${formatCurrency(p.amount||0)}</td></tr>`).join('')}
        </tbody></table></div>
      </div>`:''}

      <div id="pay-modal"></div>
    `);
    window.InvoiceDetailPage=this;
  },

  openPayModal(){
    const inv=this._inv, balance=inv.balanceDue||inv.grandTotal||0;
    const today=new Date().toISOString().split('T')[0];
    const mOpts=PAYMENT_METHODS.map(m=>`<option value="${m.id}">${m.label}</option>`).join('');
    document.getElementById('pay-modal').innerHTML=`
      <div class="modal-overlay" onclick="if(event.target===this)InvoiceDetailPage.closePayModal()">
        <div class="modal modal-sm">
          <div class="modal-header"><h3>Record payment</h3><button class="modal-close" onclick="InvoiceDetailPage.closePayModal()">${Icon.x(15)}</button></div>
          <div class="modal-body">
            <div class="form-group mb-4">
              <label class="form-label">Amount received <span class="required">*</span></label>
              <div class="input-wrapper"><span class="input-rupee-prefix">₹</span><input class="input input-rupee" type="number" id="pay-amt" value="${balance}" min="0.01" step="0.01" /></div>
              <div class="form-hint">Balance due: ₹${formatCurrency(balance)}</div>
            </div>
            <div class="form-group mb-4"><label class="form-label">Payment method</label><select class="select" id="pay-meth">${mOpts}</select></div>
            <div class="form-group mb-4"><label class="form-label">Payment date <span class="required">*</span></label><input class="input" type="date" id="pay-date" value="${today}" /></div>
            <div class="form-group mb-3"><label class="form-label">Reference / UTR</label><input class="input" type="text" id="pay-ref" placeholder="NEFT/UPI transaction ID" /></div>
            ${this._inv.customerEmail?`<div style="background:var(--color-info-light);border:1px solid var(--color-info-mid);border-radius:8px;padding:9px 12px;font-size:12.5px;color:var(--color-info-text);display:flex;gap:7px;align-items:flex-start;">${Icon.mail(14)} <span>Payment confirmation will be emailed to ${this._inv.customerEmail}</span></div>`:''}
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" onclick="InvoiceDetailPage.closePayModal()">Cancel</button>
            <button class="btn btn-primary" id="btn-pay" onclick="InvoiceDetailPage.savePayment()">Record payment</button>
          </div>
        </div>
      </div>`;
  },

  closePayModal(){const el=document.getElementById('pay-modal');if(el)el.innerHTML='';},

  async savePayment(){
    const amt=parseFloat(document.getElementById('pay-amt').value)||0;
    const meth=document.getElementById('pay-meth').value;
    const date=document.getElementById('pay-date').value;
    const ref=document.getElementById('pay-ref').value;
    const btn=document.getElementById('btn-pay');
    if(!amt||!date){Toast.error('Fill in amount and date');return;}
    btn.classList.add('loading');
    try{
      const{default:DB}=await import('../../services/firestore.js');
      const inv=this._inv;
      const newPaid=(inv.paidAmount||0)+amt;
      const newBal=Math.max(0,(inv.grandTotal||0)-newPaid);
      const status=newBal<=0?'paid':newPaid>0?'partial':inv.status;
      const pmtData={invoiceId:inv.id,amount:amt,method:meth,paymentDate:date};
      if(ref)pmtData.reference=ref;
      if(inv.customerId)pmtData.customerId=inv.customerId;
      if(inv.customerName)pmtData.customerName=inv.customerName;
      await DB.create('payments',pmtData);
      await DB.update('invoices',inv.id,{paidAmount:newPaid,balanceDue:newBal,status});
      this.closePayModal();
      Toast.success(`₹${formatCurrency(amt)} recorded${status==='paid'?' · Invoice fully paid!':''}`);

      // Send payment confirmation email (non-blocking)
      const emailTo = inv.customerEmail;
      if(emailTo){
        const updatedInv = {...inv, paidAmount:newPaid, balanceDue:newBal, status};
        import('../../services/email.service.js').then(async m => {
          try {
            await m.default.sendPaymentConfirm(updatedInv, amt, newBal);
            Toast.success('Payment confirmation emailed to ' + emailTo);
          } catch(e) {
            console.warn('[Email] Payment confirm failed:', e.message);
          }
        });
      } else {
        console.warn('[Email] No customerEmail on invoice — skipping confirmation');
      }

      await this.init(inv.id);
    }catch(e){btn.classList.remove('loading');Toast.error('Failed: '+e.message);}
  },
};
export default InvoiceDetailPage;