import Router from '../../core/router.js';
import Store  from '../../core/store.js';
import Toast  from '../../components/Toast.js';
import { formatCurrencyShort, formatDate } from '../../utils/formatters.js';
import Icon from '../../utils/icons.js';

const statusBadge = {draft:'badge badge-neutral',sent:'badge badge-info',approved:'badge badge-success',rejected:'badge badge-danger',converted:'badge badge-purple',expired:'badge badge-neutral'};
const statusLabel = {draft:'Draft',sent:'Sent',approved:'Approved',rejected:'Rejected',converted:'Converted',expired:'Expired'};

const QuotationsPage = {
  _list:[], _tab:'all',

  async init() {
    this._skeleton();
    try {
      const{default:DB}=await import('../../services/firestore.js');
      this._list=await DB.getAll('quotations',[DB.orderBy('createdAt','desc')]);
    }catch(e){this._list=[];}
    this._render();
  },

  _skeleton(){Router.render(`<div class="page-header"><div><div class="skeleton skeleton-h1"></div></div></div><div class="card">${[1,2,3].map(()=>`<div style="display:flex;gap:12px;padding:14px 16px;border-bottom:1px solid var(--border-subtle);"><div class="skeleton skeleton-avatar"></div><div style="flex:1;"><div class="skeleton skeleton-text w-lg"></div></div></div>`).join('')}</div>`);},

  _render() {
    const tabs=['all','draft','sent','approved','converted'];
    const counts={};tabs.forEach(t=>counts[t]=t==='all'?this._list.length:this._list.filter(q=>q.status===t).length);
    const filtered=this._tab==='all'?this._list:this._list.filter(q=>q.status===this._tab);

    Router.render(`
      <div class="page-header">
        <div class="page-header-left"><h1>Quotations</h1><p>${this._list.length} quotation${this._list.length!==1?'s':''}</p></div>
        <div class="page-header-actions"><a href="#/quotations/new" class="btn btn-primary btn-sm">+ New quotation</a></div>
      </div>
      <div class="tabs">
        ${tabs.map(t=>`<button class="tab-item ${this._tab===t?'active':''}" onclick="QuotationsPage.setTab('${t}')">${t.charAt(0).toUpperCase()+t.slice(1)}${counts[t]>0?`<span class="tab-count">${counts[t]}</span>`:''}</button>`).join('')}
      </div>
      <div class="card">
        ${filtered.length===0?`<div class="empty-state"><div class="empty-state-icon">${Icon.fileText(24)}</div><h3>No quotations</h3><p>Create quotations and convert them to invoices.</p><a href="#/quotations/new" class="btn btn-primary">Create quotation</a></div>`:
        `<div class="table-wrapper"><table class="data-table">
          <thead><tr><th>Quotation #</th><th>Customer</th><th>Date</th><th>Valid until</th><th>Status</th><th class="text-right">Amount</th><th>Actions</th></tr></thead>
          <tbody>
            ${filtered.map(q=>`<tr>
              <td><a href="#/quotations/${q.id}" style="font-weight:600;color:var(--brand-primary);">${q.quotationNumber||'QUO-'+q.id?.slice(-4)}</a></td>
              <td>${q.customerName||'—'}</td>
              <td class="muted">${formatDate(q.quotationDate||q.createdAt)}</td>
              <td class="muted">${formatDate(q.validUntil)||'—'}</td>
              <td><span class="${statusBadge[q.status]||'badge badge-neutral'} badge-dot">${statusLabel[q.status]||'draft'}</span></td>
              <td class="col-amount">${formatCurrencyShort(q.grandTotal||0)}</td>
              <td>
                <div style="display:flex;gap:4px;flex-wrap:wrap;">
                  ${q.status==='sent'?`<button class="btn btn-success btn-sm" onclick="QuotationsPage.approve('${q.id}')">${Icon.check(13)} Approve</button>`:''}
                  ${q.status==='sent'?`<button class="btn btn-secondary btn-sm" onclick="QuotationsPage.reject('${q.id}')">Reject</button>`:''}
                  ${q.status==='approved'?`<button class="btn btn-primary btn-sm" onclick="QuotationsPage.convertToInvoice('${q.id}')">→ Convert to Invoice</button>`:''}
                  <a href="#/quotations/${q.id}" class="btn btn-ghost btn-sm">View</a>
                  <button class="btn btn-ghost btn-sm" onclick="QuotationsPage.del('${q.id}')">${Icon.trash(14)}</button>
                </div>
              </td>
            </tr>`).join('')}
          </tbody>
        </table></div>`}
      </div>
    `);
    window.QuotationsPage=this;
  },

  setTab(t){this._tab=t;this._render();},

  async approve(id){
    try{
      const{default:DB}=await import('../../services/firestore.js');
      await DB.update('quotations',id,{status:'approved'});
      this._list=this._list.map(q=>q.id===id?{...q,status:'approved'}:q);
      this._render();Toast.success('Quotation approved! You can now convert it to an invoice.');
    }catch(e){Toast.error(e.message);}
  },

  async reject(id){
    if(!confirm('Reject this quotation?'))return;
    try{
      const{default:DB}=await import('../../services/firestore.js');
      await DB.update('quotations',id,{status:'rejected'});
      this._list=this._list.map(q=>q.id===id?{...q,status:'rejected'}:q);
      this._render();Toast.success('Quotation rejected');
    }catch(e){Toast.error(e.message);}
  },

  async convertToInvoice(id) {
    const q = this._list.find(x=>x.id===id);
    if (!q) return;
    try {
      const{default:DB}=await import('../../services/firestore.js');
      const{default:InvoiceSvc}=await import('../invoices/invoices.service.js');

      // Get company prefix for invoice number
      const company=Store.get('company');
      const prefix=company?.invoicePrefix||'INV';
      const invNumber=await InvoiceSvc.getNextNumber(prefix);

      // Create invoice from quotation
      const invoiceData={
        invoiceNumber:invNumber,
        type:'tax_invoice',
        invoiceDate:new Date().toISOString().split('T')[0],
        dueDate:new Date(Date.now()+((company?.defaultCreditDays||30)*86400000)).toISOString().split('T')[0],
        customerId:q.customerId,
        customerName:q.customerName,
        placeOfSupply:q.placeOfSupply||company?.state||'',
        interState:q.interState||false,
        notes:q.notes||company?.defaultNotes||'',
        terms:q.terms||company?.defaultTerms||'',
        subTotal:q.subTotal||0,
        totalDiscount:q.totalDiscount||0,
        totalTaxable:q.totalTaxable||0,
        cgst:q.cgst||0,sgst:q.sgst||0,igst:q.igst||0,
        totalGST:q.totalGST||0,
        grandTotal:q.grandTotal||0,
        status:'draft',
        convertedFromQuotation:id,
      };

      const invId=await InvoiceSvc.create(invoiceData);

      // Copy line items
      const items=await DB.getAll('quotationItems',[DB.where('quotationId','==',id)]).catch(()=>[]);
      if(items.length>0){
        await InvoiceSvc.saveLineItems(invId,items.map((item,i)=>({...item,invoiceId:invId,position:i})));
      }

      // Mark quotation as converted
      await DB.update('quotations',id,{status:'converted',convertedInvoiceId:invId,convertedInvoiceNumber:invNumber});
      this._list=this._list.map(q=>q.id===id?{...q,status:'converted'}:q);
      this._render();

      Toast.success(`Invoice ${invNumber} created!`, {
        action:{label:'View invoice',onClick:()=>{window.location.hash=`#/invoices/${invId}`;}},
        duration:8000
      });
    }catch(e){Toast.error('Failed to convert: '+e.message);}
  },

  async del(id){
    if(!confirm('Delete this quotation?'))return;
    try{
      const{default:DB}=await import('../../services/firestore.js');
      await DB.delete('quotations',id);
      this._list=this._list.filter(q=>q.id!==id);
      this._render();Toast.success('Deleted');
    }catch(e){Toast.error(e.message);}
  },
};
export default QuotationsPage;
