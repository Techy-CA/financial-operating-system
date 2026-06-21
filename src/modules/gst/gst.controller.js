import Router from '../../core/router.js';
import Store  from '../../core/store.js';
import Toast  from '../../components/Toast.js';
import { formatCurrency, formatCurrencyShort, formatDate } from '../../utils/formatters.js';

const GSTPage = {
  async init() {
    Router.render(`<div class="page-header"><div><div class="skeleton skeleton-h1"></div></div></div><div class="grid-4 mb-4">${[1,2,3,4].map(()=>`<div class="skeleton" style="height:90px;border-radius:12px;"></div>`).join('')}</div>`);
    let invoices=[], expenses=[];
    try {
      const { default: DB } = await import('../../services/firestore.js');
      [invoices, expenses] = await Promise.all([
        DB.getAll('invoices', [DB.orderBy('createdAt','desc')]),
        DB.getAll('expenses', [DB.orderBy('createdAt','desc')]),
      ]);
    } catch(e) { if(!e.message.includes('No company'))Toast.error(e.message); }
    this._render(invoices, expenses);
  },

  _render(invoices, expenses) {
    const taxable   = invoices.filter(i=>i.status!=='draft'&&i.status!=='cancelled');
    const output    = taxable.reduce((s,i)=>s+(i.totalGST||0),0);
    const cgst      = taxable.reduce((s,i)=>s+(i.cgst||0),0);
    const sgst      = taxable.reduce((s,i)=>s+(i.sgst||0),0);
    const igst      = taxable.reduce((s,i)=>s+(i.igst||0),0);
    const itc       = expenses.reduce((s,e)=>s+(e.gstAmount||0),0);
    const payable   = Math.max(0, output-itc);
    const company   = Store.get('company');

    Router.render(`
      <div class="page-header">
        <div class="page-header-left">
          <h1>GST</h1>
          <p>${Store.get('fy')?.label||'FY 2025-26'} · ${company?.gstin||'GSTIN not set'}</p>
        </div>
        <div class="page-header-actions">
          <button class="btn btn-secondary btn-sm" onclick="GSTPage.exportGSTR1()"><i class="ti ti-download"></i> Export GSTR-1</button>
        </div>
      </div>

      <div class="grid-4 mb-5">
        <div class="metric-card"><div class="metric-label"><i class="ti ti-arrow-down-left"></i> GST collected</div><div class="metric-value">${formatCurrencyShort(output)}</div><div class="metric-subtext">${taxable.length} taxable invoices</div></div>
        <div class="metric-card"><div class="metric-label"><i class="ti ti-receipt-refund"></i> Input tax credit</div><div class="metric-value success">${formatCurrencyShort(itc)}</div><div class="metric-subtext">From purchases</div></div>
        <div class="metric-card"><div class="metric-label"><i class="ti ti-calculator"></i> Net payable</div><div class="metric-value ${payable>50000?'warning':''}">${formatCurrencyShort(payable)}</div><div class="metric-subtext">GST collected − ITC</div></div>
        <div class="metric-card"><div class="metric-label"><i class="ti ti-calendar-due"></i> Next filing</div><div class="metric-value" style="font-size:20px;">20th</div><div class="metric-subtext">GSTR-3B monthly</div></div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px;">
        <div class="card">
          <div class="card-header"><h2>Output GST breakdown</h2></div>
          <div class="card-body">
            <div style="display:flex;flex-direction:column;gap:12px;">
              ${[{l:'CGST',v:cgst},{l:'SGST',v:sgst},{l:'IGST',v:igst},{l:'Total output GST',v:output,bold:true}].map(r=>`
                <div style="display:flex;justify-content:space-between;align-items:center;${r.bold?'border-top:1px solid var(--border-default);padding-top:10px;margin-top:4px;':''} ">
                  <span style="font-size:13px;${r.bold?'font-weight:600;':''}color:var(--text-secondary);">${r.l}</span>
                  <span style="font-size:${r.bold?'16':'13'}px;font-weight:${r.bold?700:500};">${formatCurrency(r.v)}</span>
                </div>`).join('')}
            </div>
          </div>
        </div>

        <div class="card" style="background:${payable>0?'var(--color-warning-light)':'var(--color-success-light)'};border-color:transparent;">
          <div class="card-header" style="background:transparent;border-color:rgba(0,0,0,0.06);"><h2>Net GST payable</h2></div>
          <div class="card-body">
            <div style="font-size:40px;font-weight:700;color:${payable>0?'var(--color-warning)':'var(--color-success)'};line-height:1;">${formatCurrencyShort(payable)}</div>
            <div style="margin-top:16px;display:flex;flex-direction:column;gap:8px;font-size:13px;">
              <div style="display:flex;justify-content:space-between;"><span style="color:var(--text-tertiary);">Output GST collected</span><span>${formatCurrencyShort(output)}</span></div>
              <div style="display:flex;justify-content:space-between;color:var(--color-success);"><span>Less: ITC</span><span>−${formatCurrencyShort(itc)}</span></div>
            </div>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-header"><h2>GSTR-1 — Invoice-wise outward supplies</h2></div>
        ${taxable.length===0?`
          <div class="empty-state" style="padding:40px 0;">
            <div class="empty-state-icon"><i class="ti ti-file-invoice"></i></div>
            <h3>No taxable invoices</h3>
            <p>Create and send invoices to see GST summary here.</p>
            <a href="#/invoices/new" class="btn btn-primary">Create invoice</a>
          </div>`:
          `<div class="table-wrapper">
            <table class="data-table">
              <thead><tr><th>Invoice #</th><th>Customer</th><th>Date</th><th class="text-right">Taxable value</th><th class="text-right">CGST</th><th class="text-right">SGST</th><th class="text-right">IGST</th><th class="text-right">Total GST</th></tr></thead>
              <tbody>
                ${taxable.map(i=>`<tr>
                  <td><a href="#/invoices/${i.id}" style="color:var(--brand-primary);font-weight:500;">${i.invoiceNumber||'—'}</a></td>
                  <td>${i.customerName||'—'}</td>
                  <td class="muted">${formatDate(i.invoiceDate)}</td>
                  <td class="col-amount">${formatCurrency(i.totalTaxable||0)}</td>
                  <td class="col-amount">${formatCurrency(i.cgst||0)}</td>
                  <td class="col-amount">${formatCurrency(i.sgst||0)}</td>
                  <td class="col-amount">${formatCurrency(i.igst||0)}</td>
                  <td class="col-amount" style="font-weight:600;">${formatCurrency(i.totalGST||0)}</td>
                </tr>`).join('')}
              </tbody>
            </table>
          </div>`}
      </div>
    `);
    window.GSTPage = this;
  },

  exportGSTR1() { Toast.info('Preparing GSTR-1 export…'); },
};
export default GSTPage;
