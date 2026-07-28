import Router from '../../core/router.js';
import Store  from '../../core/store.js';
import Toast  from '../../components/Toast.js';
import { formatCurrency, formatCurrencyShort, formatDate } from '../../utils/formatters.js';
import Icon from '../../utils/icons.js';

function daysUntilDue(d){ return d ? Math.floor((new Date(d).getTime()-Date.now())/86400000) : 0; }

const CollectionsPage = {
  _list:[],

  async init() {
    Router.render(`<div class="page-header"><div class="page-header-left"><h1>Collections</h1></div></div><div class="skeleton" style="height:400px;border-radius:12px;margin-top:16px;"></div>`);
    try{
      const{default:DB}=await import('../../services/firestore.js');
      const all=await DB.getAll('invoices',[]).catch(()=>[]);
      // Enrich with customer emails
      const customerIds=[...new Set(all.filter(i=>i.customerId).map(i=>i.customerId))];
      const emailMap={};
      for(const cid of customerIds){
        try{const c=await DB.getOne('customers',cid);if(c?.email)emailMap[cid]=c.email;}catch(e){}
      }
      this._list=all
        .filter(i=>['sent','partial','overdue'].includes(i.status))
        .map(i=>({...i, customerEmail: i.customerEmail||emailMap[i.customerId]||null}));
    }catch(e){this._list=[];}
    this._render();
  },

  _render(){
    const list=this._list, total=list.reduce((s,i)=>s+(i.balanceDue||0),0);
    const dueSoon  =list.filter(i=>{const d=daysUntilDue(i.dueDate);return d>=1&&d<=30;});
    const due31_60 =list.filter(i=>{const d=daysUntilDue(i.dueDate);return d>=31&&d<=60;});
    const overdue  =list.filter(i=>daysUntilDue(i.dueDate)<0);
    const sumAmt   =arr=>arr.reduce((s,i)=>s+(i.balanceDue||0),0);
    const withEmail=list.filter(i=>i.customerEmail).length;
    const noEmail  =list.length-withEmail;

    Router.render(`
      <div class="page-header">
        <div class="page-header-left">
          <h1>Collections</h1>
          <p>${list.length} outstanding · ${formatCurrencyShort(total)} receivable</p>
        </div>
        <div class="page-header-actions">
          <button class="btn btn-primary btn-sm" id="btn-remind-all" onclick="CollectionsPage.remindAll()">
            ${Icon.mail(14)} Send all reminders ${withEmail>0?`(${withEmail})`:''}
          </button>
        </div>
      </div>

      ${noEmail>0?`<div style="background:var(--color-warning-light);border:1px solid var(--color-warning-mid);border-radius:10px;padding:12px 16px;margin-bottom:16px;font-size:13px;color:var(--color-warning-text);display:flex;gap:8px;">
        ${Icon.alertTriangle(15)} <span><strong>${noEmail} customer${noEmail!==1?'s':''}</strong> don't have email addresses — reminders won't be sent to them. <a href="#/customers" style="color:var(--color-warning-text);font-weight:700;text-decoration:underline;">Add emails →</a></span>
      </div>`:''}

      <div class="grid-4 mb-5">
        ${this._bucket('Total outstanding', total,            list.length,       'info')}
        ${this._bucket('Due in 1–30 days',  sumAmt(dueSoon), dueSoon.length,    'warning')}
        ${this._bucket('Due in 31–60 days', sumAmt(due31_60),due31_60.length,   'success')}
        ${this._bucket('Overdue',           sumAmt(overdue), overdue.length,    'danger')}
      </div>

      <div class="card">
        <div class="card-header"><h2>All outstanding</h2><span class="badge badge-warning">${list.length} pending</span></div>
        ${list.length===0?`<div class="empty-state" style="padding:48px;"><div class="empty-state-icon">${Icon.checkCircle(24)}</div><h3>All clear!</h3><p>No outstanding receivables.</p></div>`:
        `<div class="table-wrapper"><table class="data-table">
          <thead><tr><th>Customer</th><th>Invoice #</th><th>Invoice date</th><th>Due date</th><th>Days status</th><th>Status</th><th class="text-right">Balance</th><th></th></tr></thead>
          <tbody>
            ${list.map(inv=>{
              const rem=daysUntilDue(inv.dueDate);
              const over=rem<0;
              let daysTxt,daysColor;
              if(rem===0){daysTxt='Due TODAY!';daysColor='var(--color-danger)';}
              else if(over){daysTxt=`${Math.abs(rem)}d overdue`;daysColor='var(--color-danger)';}
              else if(rem<=7){daysTxt=`Due in ${rem}d`;daysColor='var(--color-warning)';}
              else{daysTxt=`Due in ${rem}d`;daysColor='var(--color-success)';}
              const badge=inv.status==='partial'?'badge-warning':inv.status==='overdue'?'badge-danger':'badge-info';
              const hasEmail=!!inv.customerEmail;
              return `<tr>
                <td>
                  <div style="font-weight:500;">${inv.customerName||'—'}</div>
                  <div style="font-size:11px;color:${hasEmail?'var(--color-success)':'var(--color-danger)'};display:flex;align-items:center;gap:4px;">${hasEmail?`${Icon.mail(11)} ${inv.customerEmail}`:`${Icon.alertTriangle(11)} No email`}</div>
                </td>
                <td><a href="#/invoices/${inv.id}" style="color:var(--brand-primary);font-weight:600;">${inv.invoiceNumber||'—'}</a></td>
                <td class="muted">${formatDate(inv.invoiceDate)}</td>
                <td class="muted">${formatDate(inv.dueDate)}</td>
                <td style="font-size:13px;font-weight:600;color:${daysColor};">${daysTxt}</td>
                <td><span class="badge ${badge} badge-dot">${inv.status}</span></td>
                <td class="col-amount" style="font-weight:700;color:${over?'var(--color-danger)':'var(--text-primary)'};">${formatCurrency(inv.balanceDue||0)}</td>
                <td class="col-actions"><div class="row-actions">
                  <button class="btn btn-ghost btn-sm ${hasEmail?'':'btn-disabled'}" onclick="CollectionsPage.remind('${inv.id}')" title="${hasEmail?'Send reminder':'No email'}" ${hasEmail?'':'disabled style="opacity:0.4;cursor:not-allowed;"'}>
                    ${Icon.mail(13)} Remind
                  </button>
                  <a href="#/invoices/${inv.id}" class="btn btn-ghost btn-icon btn-sm">${Icon.eye(14)}</a>
                </div></td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
        <div class="card-footer" style="text-align:right;">Total outstanding: <strong style="color:var(--color-warning);">${formatCurrencyShort(total)}</strong></div>
        </div>`}
      </div>
    `);
    window.CollectionsPage=this;
  },

  _bucket(label,amount,count,type){
    const bg={info:'var(--color-info-light)',success:'var(--color-success-light)',warning:'var(--color-warning-light)',danger:'var(--color-danger-light)'};
    const tx={info:'var(--color-info-text)',success:'var(--color-success-text)',warning:'var(--color-warning-text)',danger:'var(--color-danger-text)'};
    return `<div style="background:${bg[type]};border-radius:12px;padding:16px 18px;">
      <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.7px;color:${tx[type]};margin-bottom:8px;">${label}</div>
      <div style="font-size:22px;font-weight:800;color:var(--text-primary);">${formatCurrencyShort(amount)}</div>
      <div style="font-size:11px;color:var(--text-tertiary);margin-top:3px;">${count} invoice${count!==1?'s':''}</div>
    </div>`;
  },

  async remind(invId){
    const inv=this._list.find(i=>i.id===invId);
    if(!inv){Toast.error('Invoice not found');return;}
    if(!inv.customerEmail){Toast.error(`No email for ${inv.customerName}. Add email to customer first.`);return;}
    const btn=document.querySelector(`[onclick="CollectionsPage.remind('${invId}')"]`);
    if(btn){btn.textContent='Sending…';btn.disabled=true;}
    try{
      const{default:EmailSvc}=await import('../../services/email.service.js');
      await EmailSvc.sendReminder(inv);
      Toast.success(`Reminder sent to ${inv.customerEmail}`);
      if(btn){btn.textContent='Sent!';btn.style.color='var(--color-success)';}
    }catch(e){
      Toast.error('Email failed: '+e.message);
      console.error('[Email]',e);
      if(btn){btn.textContent='Remind';btn.disabled=false;}
    }
  },

  async remindAll(){
    const btn=document.getElementById('btn-remind-all');
    const withEmail=this._list.filter(i=>i.customerEmail);
    const noEmail  =this._list.filter(i=>!i.customerEmail);
    if(withEmail.length===0){Toast.error('No customer emails on file. Add emails to customers first.');return;}
    if(!confirm(`Send payment reminders to ${withEmail.length} customer${withEmail.length!==1?'s':''}?\n\n${noEmail.length>0?`(${noEmail.length} will be skipped — no email on file)`:'All have emails'}`))return;
    if(btn){btn.textContent='Sending…';btn.disabled=true;}
    const{default:EmailSvc}=await import('../../services/email.service.js');
    let sent=0,failed=0;
    for(const inv of withEmail){
      try{await EmailSvc.sendReminder(inv);sent++;await new Promise(r=>setTimeout(r,300));}// 300ms delay between emails
      catch(e){failed++;console.warn('[Email]',inv.customerName,e.message);}
    }
    if(btn){btn.textContent=`Send all reminders (${withEmail.length})`;btn.disabled=false;}
    Toast.success(`${sent} reminder${sent!==1?'s':''} sent${failed>0?` · ${failed} failed`:''}`);
  },
};
export default CollectionsPage;
