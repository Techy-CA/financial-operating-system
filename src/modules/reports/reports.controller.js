import Router from '../../core/router.js';
import Store  from '../../core/store.js';
import Toast  from '../../components/Toast.js';
import { formatCurrency, formatCurrencyShort, formatDate } from '../../utils/formatters.js';
import Icon from '../../utils/icons.js';

const ReportsPage = {
  _tab:'pl', _inv:[], _exp:[],

  async init() {
    Router.render(`<div class="page-header"><div class="page-header-left"><h1>Reports</h1></div></div><div class="skeleton" style="height:400px;border-radius:12px;margin-top:16px;"></div>`);
    this._inv=[]; this._exp=[];
    try {
      const{default:DB}=await import('../../services/firestore.js');
      [this._inv,this._exp]=await Promise.all([
        DB.getAll('invoices',[DB.orderBy('createdAt','desc')]).catch(()=>[]),
        DB.getAll('expenses',[DB.orderBy('createdAt','desc')]).catch(()=>[]),
      ]);
    }catch(e){ this._inv=[]; this._exp=[]; }
    this._render();
  },

  _tabs(){return[{id:'pl',label:'P&L',icon:Icon.trendingUp(14)},{id:'cashflow',label:'Cash Flow',icon:Icon.cashflow(14)},{id:'outstanding',label:'Outstanding',icon:Icon.clock(14)},{id:'customer',label:'By Customer',icon:Icon.user(14)},{id:'gst',label:'GST',icon:Icon.calculator(14)}];},

  _render(){
    const fy=Store.get('fy');
    Router.render(`
      <div class="page-header">
        <div class="page-header-left"><h1>Reports</h1><p>${fy?.label||''} · All figures in INR (₹)</p></div>
        <div class="page-header-actions">
          <button class="btn btn-secondary btn-sm" onclick="ReportsPage.export()">${Icon.download(14)} Export CSV</button>
        </div>
      </div>
      <div class="tabs">${this._tabs().map(t=>`<button class="tab-item ${this._tab===t.id?'active':''}" style="display:inline-flex;align-items:center;gap:6px;" onclick="ReportsPage.setTab('${t.id}')">${t.icon}${t.label}</button>`).join('')}</div>
      <div id="report-body">${this._tabContent()}</div>
    `);
    window.ReportsPage=this;
    requestAnimationFrame(()=>this._drawChart());
  },

  _tabContent(){
    const inv=this._inv||[], exp=this._exp||[];
    const revenue=inv.filter(i=>['paid','partial'].includes(i.status)).reduce((s,i)=>s+(i.paidAmount||i.grandTotal||0),0);
    const billed=inv.reduce((s,i)=>s+(i.grandTotal||0),0);
    const totalExp=exp.reduce((s,e)=>s+(e.amount||0),0);
    const net=revenue-totalExp;
    const outstanding=inv.filter(i=>['sent','partial','overdue'].includes(i.status));
    const outTotal=outstanding.reduce((s,i)=>s+(i.balanceDue||0),0);

    if(this._tab==='pl') return `
      <div class="grid-3 mb-4">
        <div class="metric-card"><div class="metric-label">Revenue collected</div><div class="metric-value success">${formatCurrencyShort(revenue)}</div><div class="metric-subtext">${formatCurrencyShort(billed)} billed total</div></div>
        <div class="metric-card"><div class="metric-label">Total expenses</div><div class="metric-value danger">${formatCurrencyShort(totalExp)}</div></div>
        <div class="metric-card"><div class="metric-label">Net profit</div><div class="metric-value ${net>=0?'success':'danger'}">${formatCurrencyShort(net)}</div><div class="metric-subtext">Margin: ${revenue>0?((net/revenue)*100).toFixed(1):0}%</div></div>
      </div>
      <div class="card mb-4"><div class="card-header"><h2>Monthly overview</h2></div><div class="card-body" style="height:260px;"><canvas id="rep-chart"></canvas></div></div>
      <div class="card"><div class="card-header"><h2>P&L Statement</h2></div>
        <div class="table-wrapper"><table class="data-table"><thead><tr><th>Item</th><th class="text-right">Amount</th></tr></thead><tbody>
          <tr style="background:var(--color-success-light);"><td style="font-weight:700;color:var(--color-success-text);">Revenue (collected)</td><td class="col-amount" style="color:var(--color-success);">${formatCurrency(revenue)}</td></tr>
          <tr><td style="padding-left:24px;color:var(--text-tertiary);">Billed (incl. outstanding)</td><td class="col-amount">${formatCurrency(billed)}</td></tr>
          <tr style="background:var(--color-danger-light);"><td style="font-weight:700;color:var(--color-danger-text);">Total Expenses</td><td class="col-amount" style="color:var(--color-danger);">-${formatCurrency(totalExp)}</td></tr>
          <tr style="border-top:2px solid var(--border-default);"><td style="font-weight:700;font-size:15px;">Net Profit / Loss</td><td class="col-amount" style="color:${net>=0?'var(--color-success)':'var(--color-danger)'};font-size:15px;font-weight:700;">${formatCurrency(net)}</td></tr>
        </tbody></table></div>
      </div>`;

    if(this._tab==='cashflow'){
      const inflow=revenue, outflow=totalExp, net2=inflow-outflow;
      return `
        <div class="grid-3 mb-4">
          <div class="metric-card"><div class="metric-label">Cash inflow</div><div class="metric-value success">${formatCurrencyShort(inflow)}</div></div>
          <div class="metric-card"><div class="metric-label">Cash outflow</div><div class="metric-value danger">${formatCurrencyShort(outflow)}</div></div>
          <div class="metric-card"><div class="metric-label">Net cash flow</div><div class="metric-value ${net2>=0?'success':'danger'}">${formatCurrencyShort(net2)}</div></div>
        </div>
        <div class="card"><div class="card-header"><h2>Cash flow chart</h2></div><div class="card-body" style="height:260px;"><canvas id="rep-chart"></canvas></div></div>`;
    }

    if(this._tab==='outstanding') return `
      <div class="metric-card mb-4" style="max-width:280px;"><div class="metric-label">Total outstanding</div><div class="metric-value warning">${formatCurrencyShort(outTotal)}</div><div class="metric-subtext">${outstanding.length} invoice${outstanding.length!==1?'s':''}</div></div>
      <div class="card"><div class="card-header"><h2>Outstanding invoices</h2></div>
        ${outstanding.length===0?`<div class="empty-state" style="padding:40px;"><div class="empty-state-icon">${Icon.checkCircle(24)}</div><h3>All caught up!</h3></div>`:
        `<div class="table-wrapper"><table class="data-table"><thead><tr><th>Invoice #</th><th>Customer</th><th>Due date</th><th>Status</th><th class="text-right">Balance due</th></tr></thead><tbody>
          ${outstanding.map(i=>`<tr>
            <td><a href="#/invoices/${i.id}" style="color:var(--brand-primary);font-weight:500;">${i.invoiceNumber||'—'}</a></td>
            <td>${i.customerName||'—'}</td><td class="muted">${formatDate(i.dueDate)}</td>
            <td><span class="badge ${i.status==='overdue'?'badge-danger':'badge-warning'} badge-dot">${i.status}</span></td>
            <td class="col-amount" style="font-weight:600;color:var(--color-warning);">${formatCurrency(i.balanceDue||0)}</td>
          </tr>`).join('')}
        </tbody></table></div>`}
      </div>`;

    if(this._tab==='customer'){
      const map={};
      inv.forEach(i=>{if(!i.customerName)return;if(!map[i.customerName])map[i.customerName]={billed:0,paid:0,count:0};map[i.customerName].billed+=(i.grandTotal||0);map[i.customerName].paid+=(i.paidAmount||0);map[i.customerName].count++;});
      const rows=Object.entries(map).sort((a,b)=>b[1].billed-a[1].billed);
      return `<div class="card"><div class="card-header"><h2>Revenue by customer</h2></div>
        <div class="table-wrapper"><table class="data-table"><thead><tr><th>Customer</th><th class="text-right">Invoices</th><th class="text-right">Total billed</th><th class="text-right">Collected</th><th class="text-right">Outstanding</th></tr></thead><tbody>
          ${rows.length===0?`<tr><td colspan="5" style="text-align:center;color:var(--text-tertiary);padding:32px;">No data</td></tr>`:
          rows.map(([name,v])=>`<tr><td style="font-weight:500;">${name}</td><td class="text-right muted">${v.count}</td><td class="col-amount">${formatCurrency(v.billed)}</td><td class="col-amount" style="color:var(--color-success);">${formatCurrency(v.paid)}</td><td class="col-amount" style="color:${v.billed-v.paid>0?'var(--color-warning)':'var(--text-primary)'};">${formatCurrency(v.billed-v.paid)}</td></tr>`).join('')}
        </tbody></table></div>
      </div>`;
    }

    if(this._tab==='gst'){
      const taxable=inv.filter(i=>i.status!=='draft');
      const gstOut=taxable.reduce((s,i)=>s+(i.totalGST||0),0);
      const itc=exp.reduce((s,e)=>s+(e.gstAmount||0),0);
      const payable=Math.max(0,gstOut-itc);
      return `
        <div class="grid-3 mb-4">
          <div class="metric-card"><div class="metric-label">GST collected</div><div class="metric-value">${formatCurrencyShort(gstOut)}</div></div>
          <div class="metric-card"><div class="metric-label">ITC available</div><div class="metric-value success">${formatCurrencyShort(itc)}</div></div>
          <div class="metric-card"><div class="metric-label">Net payable</div><div class="metric-value warning">${formatCurrencyShort(payable)}</div></div>
        </div>
        <div class="card"><div class="card-header"><h2>GSTR-1 — Invoice wise</h2></div>
          ${taxable.length===0?`<div class="empty-state" style="padding:40px;"><div class="empty-state-icon">${Icon.calculator(24)}</div><h3>No taxable invoices yet</h3></div>`:`
          <div class="table-wrapper"><table class="data-table"><thead><tr><th>Invoice #</th><th>Customer</th><th>Date</th><th class="text-right">Taxable</th><th class="text-right">CGST</th><th class="text-right">SGST</th><th class="text-right">IGST</th><th class="text-right">Total GST</th></tr></thead><tbody>
            ${taxable.map(i=>`<tr>
              <td><a href="#/invoices/${i.id}" style="color:var(--brand-primary);font-weight:500;">${i.invoiceNumber||'—'}</a></td>
              <td>${i.customerName||'—'}</td><td class="muted">${formatDate(i.invoiceDate)}</td>
              <td class="col-amount">${formatCurrency(i.totalTaxable||0)}</td>
              <td class="col-amount">${formatCurrency(i.cgst||0)}</td>
              <td class="col-amount">${formatCurrency(i.sgst||0)}</td>
              <td class="col-amount">${formatCurrency(i.igst||0)}</td>
              <td class="col-amount" style="font-weight:600;">${formatCurrency(i.totalGST||0)}</td>
            </tr>`).join('')}
          </tbody></table></div>`}
        </div>`;
    }
    return '';
  },

  _drawChart(){
    const canvas=document.getElementById('rep-chart');
    if(!canvas||!window.Chart)return;
    const months=['Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec','Jan','Feb','Mar'];
    const sy=Store.get('fy')?.startYear||new Date().getFullYear();
    const rev=Array(12).fill(0), exps=Array(12).fill(0);
    (this._inv||[]).filter(i=>['paid','partial'].includes(i.status)).forEach(i=>{
      const d=i.invoiceDate?new Date(i.invoiceDate):null; if(!d)return;
      const idx=((d.getMonth()-3+12)%12);
      const y=d.getFullYear();
      if((y===sy&&d.getMonth()>=3)||(y===sy+1&&d.getMonth()<3)) rev[idx]+=(i.paidAmount||i.grandTotal||0);
    });
    (this._exp||[]).forEach(e=>{
      const d=e.expenseDate?new Date(e.expenseDate):null; if(!d)return;
      const idx=((d.getMonth()-3+12)%12);
      const y=d.getFullYear();
      if((y===sy&&d.getMonth()>=3)||(y===sy+1&&d.getMonth()<3)) exps[idx]+=(e.amount||0);
    });
    new Chart(canvas,{type:'bar',data:{labels:months,datasets:[{label:'Revenue',data:rev,backgroundColor:'#1A56DB',borderRadius:4,barThickness:12},{label:'Expenses',data:exps,backgroundColor:'#E5E7EB',borderRadius:4,barThickness:12}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{backgroundColor:'#1A202C',callbacks:{label:ctx=>`₹${(ctx.raw/100000).toFixed(1)}L`}}},scales:{x:{grid:{display:false},ticks:{font:{size:11},color:'#6B7A99'}},y:{grid:{color:'#F1F3F7'},border:{display:false},ticks:{font:{size:11},color:'#6B7A99',callback:v=>v===0?'0':`₹${(v/100000).toFixed(0)}L`}}}}});
  },

  setTab(t){this._tab=t;const body=document.getElementById('report-body');if(body){body.innerHTML=this._tabContent();}document.querySelectorAll('.tab-item').forEach((el,i)=>{el.classList.toggle('active',i===this._tabs().findIndex(x=>x.id===t));});requestAnimationFrame(()=>this._drawChart());},

  export(){
    const inv=this._inv||[], exp=this._exp||[], tab=this._tab;
    let csv='', fname='report';
    if(tab==='pl'){
      const rev=inv.filter(i=>['paid','partial'].includes(i.status)).reduce((s,i)=>s+(i.paidAmount||i.grandTotal||0),0);
      const totalExp=exp.reduce((s,e)=>s+(e.amount||0),0);
      csv='Item,Amount\nRevenue,'+rev+'\nExpenses,'+totalExp+'\nNet Profit,'+(rev-totalExp); fname='profit_loss';
    }else if(tab==='outstanding'){
      csv='Invoice No,Customer,Invoice Date,Due Date,Status,Balance Due\n'+inv.filter(i=>['sent','partial','overdue'].includes(i.status)).map(i=>`${i.invoiceNumber||''},"${i.customerName||''}",${i.invoiceDate||''},${i.dueDate||''},${i.status},${i.balanceDue||0}`).join('\n'); fname='outstanding';
    }else if(tab==='gst'){
      csv='Invoice No,Customer,Date,Taxable Value,CGST,SGST,IGST,Total GST\n'+inv.filter(i=>i.status!=='draft').map(i=>`${i.invoiceNumber||''},"${i.customerName||''}",${i.invoiceDate||''},${i.totalTaxable||0},${i.cgst||0},${i.sgst||0},${i.igst||0},${i.totalGST||0}`).join('\n'); fname='gstr1';
    }else if(tab==='customer'){
      const map={};inv.forEach(i=>{if(!map[i.customerName])map[i.customerName]={billed:0,paid:0,count:0};map[i.customerName].billed+=(i.grandTotal||0);map[i.customerName].paid+=(i.paidAmount||0);map[i.customerName].count++;});
      csv='Customer,Invoices,Total Billed,Collected,Outstanding\n'+Object.entries(map).map(([n,v])=>`"${n}",${v.count},${v.billed},${v.paid},${v.billed-v.paid}`).join('\n'); fname='customers';
    }else{csv='No data for this tab';}
    if(!csv || csv==='No data for this tab'){Toast.error('No data to export on this tab');return;}
    const blob=new Blob(['﻿'+csv],{type:'text/csv;charset=utf-8;'}); // BOM for Excel
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');
    a.href=url; a.download=`finos_${fname}_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(()=>URL.revokeObjectURL(url),1000);
    Toast.success(`${fname.replace('_',' ')} exported as CSV!`);
  },
};
export default ReportsPage;