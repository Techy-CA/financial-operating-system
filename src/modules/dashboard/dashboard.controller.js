import Router from '../../core/router.js';
import Store  from '../../core/store.js';
import { formatCurrencyShort, formatCurrency, formatDate, initials, avatarColor } from '../../utils/formatters.js';
import Icon from '../../utils/icons.js';

const DashboardPage = {
  _chart: null,
  _retries: 0,

  async init() {
    // If companyId not loaded yet, wait up to 3s
    if (!Store.get('companyId')) {
      if (this._retries < 15) {
        this._retries++;
        this._showWaiting();
        setTimeout(() => this.init(), 200);
        return;
      }
      // No company — show setup prompt
      this._retries = 0;
      this._showSetup();
      return;
    }
    this._retries = 0;
    this._renderSkeleton();
    try {
      const data = await this._loadData();
      this._render(data);
    } catch(err) {
      console.error('[Dashboard]', err);
      this._render(this._emptyData());
    }
  },

  _showWaiting() {
    Router.render(`
      <div style="display:flex;align-items:center;justify-content:center;height:60vh;flex-direction:column;gap:16px;">
        <div style="width:36px;height:36px;border:3px solid #E2E8F0;border-top-color:#1D4ED8;border-radius:50%;animation:spin 0.8s linear infinite;"></div>
        <div style="font-size:13.5px;color:var(--text-tertiary);">Loading your data…</div>
        <style>@keyframes spin{to{transform:rotate(360deg);}}</style>
      </div>
    `);
  },

  _showSetup() {
    Router.render(`
      <div style="max-width:460px;margin:60px auto;">
        <div class="card">
          <div class="card-body" style="text-align:center;padding:44px 36px;">
            <div style="display:flex;justify-content:center;color:var(--text-disabled);margin-bottom:16px;">${Icon.building(40)}</div>
            <h2 style="font-size:20px;font-weight:700;margin-bottom:8px;">Set up your company</h2>
            <p style="color:var(--text-tertiary);font-size:13.5px;margin-bottom:24px;line-height:1.6;">
              Add your company details to start creating invoices and tracking your finances.
            </p>
            <a href="#/settings" class="btn btn-primary" style="width:100%;justify-content:center;padding:11px;">
              Go to Settings →
            </a>
          </div>
        </div>
      </div>
    `);
  },

  async _loadData() {
    const { default: DB } = await import('../../services/firestore.js');
    const fy = Store.get('fy') || { start:'2025-04-01', end:'2026-03-31' };

    const [invoices, expenses, payments] = await Promise.allSettled([
      DB.getAll('invoices',  [DB.orderBy('createdAt','desc'), DB.limit(50)]),
      DB.getAll('expenses',  [DB.orderBy('createdAt','desc'), DB.limit(50)]),
      DB.getAll('payments',  [DB.orderBy('createdAt','desc'), DB.limit(10)]),
    ]);

    const inv  = invoices.status  === 'fulfilled' ? invoices.value  : [];
    const exp  = expenses.status  === 'fulfilled' ? expenses.value  : [];
    const pays = payments.status  === 'fulfilled' ? payments.value  : [];

    const paid        = inv.filter(i => ['paid','partial'].includes(i.status));
    const outstanding = inv.filter(i => ['sent','partial'].includes(i.status));
    const overdue     = inv.filter(i => i.status === 'overdue');

    const revenue   = paid.reduce((s,i) => s + (i.paidAmount || i.grandTotal || 0), 0);
    const outTotal  = outstanding.reduce((s,i) => s + (i.balanceDue || 0), 0);
    const ovTotal   = overdue.reduce((s,i) => s + (i.balanceDue || 0), 0);
    const expTotal  = exp.reduce((s,e) => s + (e.amount || 0), 0);
    const gstTotal  = inv.filter(i=>i.status!=='draft').reduce((s,i)=>s+(i.totalGST||0),0);

    const custMap = {};
    inv.forEach(i => {
      if (!i.customerId && !i.customerName) return;
      const k = i.customerId || i.customerName;
      if (!custMap[k]) custMap[k] = { name: i.customerName||'Unknown', total:0, count:0 };
      custMap[k].total += i.grandTotal || 0;
      custMap[k].count += 1;
    });
    const topCustomers = Object.values(custMap).sort((a,b)=>b.total-a.total).slice(0,5);

    const monthly = this._monthlyData(inv, exp);

    return { revenue, outTotal, outCount: outstanding.length, ovTotal, ovCount: overdue.length,
             expTotal, gstTotal, topCustomers, monthly, recentInvoices: inv.slice(0,5),
             invoiceCount: inv.length, hasData: inv.length > 0 || exp.length > 0 };
  },

  _emptyData() {
    return { revenue:0, outTotal:0, outCount:0, ovTotal:0, ovCount:0, expTotal:0, gstTotal:0,
             topCustomers:[], monthly:{labels:['Apr','May','Jun','Jul','Aug','Sep'],revenue:[0,0,0,0,0,0],expenses:[0,0,0,0,0,0]},
             recentInvoices:[], invoiceCount:0, hasData:false };
  },

  _monthlyData(inv, exp) {
    const labels = ['Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec','Jan','Feb','Mar'];
    const now = new Date();
    const sy = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear()-1;
    const rev = Array(12).fill(0), exps = Array(12).fill(0);
    inv.filter(i=>['paid','partial'].includes(i.status)).forEach(i=>{
      const d = i.invoiceDate ? new Date(i.invoiceDate) : null; if(!d) return;
      const m = ((d.getMonth()-3+12)%12);
      const y = d.getFullYear();
      if((y===sy&&d.getMonth()>=3)||(y===sy+1&&d.getMonth()<3)) rev[m]+=(i.paidAmount||i.grandTotal||0);
    });
    exp.forEach(e=>{
      const d = e.expenseDate ? new Date(e.expenseDate) : null; if(!d) return;
      const m = ((d.getMonth()-3+12)%12);
      const y = d.getFullYear();
      if((y===sy&&d.getMonth()>=3)||(y===sy+1&&d.getMonth()<3)) exps[m]+=(e.amount||0);
    });
    return { labels, revenue:rev, expenses:exps };
  },

  _renderSkeleton() {
    Router.render(`
      <div class="page-header"><div><div class="skeleton skeleton-h1"></div><div class="skeleton skeleton-text w-md mt-2"></div></div><div class="skeleton skeleton-btn"></div></div>
      <div class="grid-4 mb-5">${[1,2,3,4].map(()=>`<div class="skeleton" style="height:90px;border-radius:12px;"></div>`).join('')}</div>
      <div style="display:grid;grid-template-columns:1fr 340px;gap:16px;"><div class="skeleton" style="height:280px;border-radius:12px;"></div><div class="skeleton" style="height:280px;border-radius:12px;"></div></div>
    `);
  },

  _render(d) {
    const user = Store.get('user');
    const fy   = Store.get('fy');
    const hour = new Date().getHours();
    const name = user?.displayName?.split(' ')[0] || 'there';
    const greet = hour<12?'Good morning':hour<17?'Good afternoon':'Good evening';
    const net = d.revenue - d.expTotal;

    Router.render(`
      <div class="page-header">
        <div class="page-header-left">
          <h1>${greet}, ${name}</h1>
          <p>${new Date().toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'long'})} · ${fy?.label||'FY 2026-27'}</p>
        </div>
        <div class="page-header-actions">
          <a href="#/invoices/new" class="btn btn-primary btn-sm">+ New invoice</a>
        </div>
      </div>

      ${!d.hasData ? `
        <div style="background:linear-gradient(135deg,#EEF2FF,#E0E7FF);border:1px solid #C7D2FE;border-radius:12px;padding:18px 24px;margin-bottom:20px;display:flex;align-items:center;justify-content:space-between;gap:16px;">
          <div>
            <div style="font-weight:700;color:#3730A3;margin-bottom:3px;display:flex;align-items:center;gap:7px;">${Icon.rocket(15)} Welcome! Start by adding data.</div>
            <div style="font-size:13px;color:#4338CA;">Add customers, create invoices, or bulk import your existing data.</div>
          </div>
          <div style="display:flex;gap:8px;flex-shrink:0;">
            <a href="#/customers/new" class="btn btn-secondary btn-sm">Add customer</a>
            <a href="#/import" class="btn btn-primary btn-sm">Bulk import</a>
          </div>
        </div>` : ''}

      <!-- KPI Row -->
      <div class="grid-4 mb-5">
        <a href="#/reports" class="metric-card" style="display:block;text-decoration:none;">
          <div class="metric-label">Revenue collected</div>
          <div class="metric-value success">${formatCurrencyShort(d.revenue)}</div>
          <div class="metric-subtext">${d.invoiceCount} invoice${d.invoiceCount!==1?'s':''} · ${fy?.label||''}</div>
        </a>
        <a href="#/collections" class="metric-card" style="display:block;text-decoration:none;">
          <div class="metric-label">Outstanding</div>
          <div class="metric-value ${d.outTotal>0?'warning':''}">${formatCurrencyShort(d.outTotal)}</div>
          <div class="metric-subtext">${d.outCount} pending</div>
        </a>
        <a href="#/collections" class="metric-card" style="display:block;text-decoration:none;">
          <div class="metric-label">Overdue</div>
          <div class="metric-value ${d.ovCount>0?'danger':''}">${formatCurrencyShort(d.ovTotal)}</div>
          <div class="metric-subtext">${d.ovCount>0?`${d.ovCount} need attention`:'All on track'}</div>
        </a>
        <a href="#/gst" class="metric-card" style="display:block;text-decoration:none;">
          <div class="metric-label">Net profit</div>
          <div class="metric-value ${net>=0?'success':'danger'}">${formatCurrencyShort(net)}</div>
          <div class="metric-subtext">Revenue − expenses</div>
        </a>
      </div>

      <!-- Main grid -->
      <div style="display:grid;grid-template-columns:1fr 340px;gap:16px;margin-bottom:16px;">
        <div class="card">
          <div class="card-header">
            <h2>Revenue vs Expenses — ${fy?.label||''}</h2>
          </div>
          <div class="card-body">
            <div style="display:flex;gap:24px;margin-bottom:16px;">
              <div><div style="font-size:11px;color:var(--text-tertiary);text-transform:uppercase;">Revenue</div><div style="font-size:20px;font-weight:700;color:var(--color-success);">${formatCurrencyShort(d.revenue)}</div></div>
              <div><div style="font-size:11px;color:var(--text-tertiary);text-transform:uppercase;">Expenses</div><div style="font-size:20px;font-weight:700;color:var(--color-danger);">${formatCurrencyShort(d.expTotal)}</div></div>
              <div><div style="font-size:11px;color:var(--text-tertiary);text-transform:uppercase;">Net Profit</div><div style="font-size:20px;font-weight:700;color:${net>=0?'var(--color-success)':'var(--color-danger)'};">${formatCurrencyShort(net)}</div></div>
            </div>
            <div style="height:200px;"><canvas id="rev-chart"></canvas></div>
          </div>
        </div>

        <div style="display:flex;flex-direction:column;gap:14px;">
          <!-- Quick actions -->
          <div class="card">
            <div class="card-header"><h2>Quick actions</h2></div>
            <div class="card-body" style="padding:8px;">
              ${[
                {href:'#/invoices/new', icon:Icon.fileText(16), label:'New invoice'},
                {href:'#/customers/new',icon:Icon.user(16),     label:'Add customer'},
                {href:'#/expenses/new', icon:Icon.calculator(16),label:'Add expense'},
                {href:'#/import',       icon:Icon.upload(16),   label:'Bulk import'},
              ].map(a=>`
                <a href="${a.href}" style="display:flex;align-items:center;gap:10px;padding:9px 10px;border-radius:8px;text-decoration:none;transition:background 0.1s;" onmouseover="this.style.background='#F8F9FB'" onmouseout="this.style.background='transparent'">
                  <span style="display:flex;color:var(--text-secondary);">${a.icon}</span>
                  <span style="font-size:13.5px;font-weight:500;color:var(--text-primary);">${a.label}</span>
                  <span style="margin-left:auto;color:var(--text-tertiary);font-size:12px;">›</span>
                </a>`).join('')}
            </div>
          </div>

          <!-- Recent invoices -->
          <div class="card" style="flex:1;">
            <div class="card-header"><h2>Recent invoices</h2><a href="#/invoices" style="font-size:12px;color:var(--brand-primary);text-decoration:none;">View all</a></div>
            ${d.recentInvoices.length===0
              ? `<div style="padding:20px;text-align:center;font-size:13px;color:var(--text-tertiary);">No invoices yet</div>`
              : d.recentInvoices.map(inv=>`
                <a href="#/invoices/${inv.id}" style="display:flex;align-items:center;justify-content:space-between;padding:10px 16px;border-bottom:1px solid var(--border-subtle);text-decoration:none;">
                  <div>
                    <div style="font-size:13px;font-weight:600;color:var(--brand-primary);">${inv.invoiceNumber||'—'}</div>
                    <div style="font-size:11px;color:var(--text-tertiary);">${inv.customerName||'—'}</div>
                  </div>
                  <div style="text-align:right;">
                    <div style="font-size:13px;font-weight:600;">${formatCurrencyShort(inv.grandTotal||0)}</div>
                    <span style="font-size:10px;padding:1px 6px;border-radius:99px;background:${inv.status==='paid'?'#D1FAE5':inv.status==='overdue'?'#FEE2E2':'#FEF3C7'};color:${inv.status==='paid'?'#065F46':inv.status==='overdue'?'#991B1B':'#92400E'};">${inv.status}</span>
                  </div>
                </a>`).join('')}
          </div>
        </div>
      </div>

      <!-- Bottom: top customers + aging -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
        <div class="card">
          <div class="card-header"><h2>Top customers</h2><a href="#/customers" style="font-size:12px;color:var(--brand-primary);text-decoration:none;">View all</a></div>
          ${d.topCustomers.length===0
            ? `<div class="empty-state" style="padding:32px;"><div class="empty-state-icon">${Icon.users(24)}</div><h3 style="font-size:14px;">No customers yet</h3><a href="#/customers/new" class="btn btn-primary btn-sm mt-3">Add customer</a></div>`
            : d.topCustomers.map(c=>{
                const col=avatarColor(c.name);
                return `<div style="display:flex;align-items:center;gap:10px;padding:10px 16px;border-bottom:1px solid var(--border-subtle);">
                  <div style="width:30px;height:30px;border-radius:7px;background:${col.bg};color:${col.text};display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;">${initials(c.name)}</div>
                  <div style="flex:1;"><div style="font-size:13px;font-weight:500;">${c.name}</div><div style="font-size:11px;color:var(--text-tertiary);">${c.count} invoice${c.count!==1?'s':''}</div></div>
                  <div style="font-size:13px;font-weight:600;">${formatCurrencyShort(c.total)}</div>
                </div>`;
              }).join('')}
        </div>

        <div class="card">
          <div class="card-header"><h2>Receivables aging</h2><a href="#/collections" style="font-size:12px;color:var(--brand-primary);text-decoration:none;">Collections →</a></div>
          <div class="card-body">
            ${[
              {l:'Current',    v:d.outTotal, c:'var(--color-info)',    bg:'var(--color-info-light)'},
              {l:'1–30 days',  v:0,          c:'var(--color-success)', bg:'var(--color-success-light)'},
              {l:'31–60 days', v:0,          c:'var(--color-warning)', bg:'var(--color-warning-light)'},
              {l:'60+ days',   v:d.ovTotal,  c:'var(--color-danger)',  bg:'var(--color-danger-light)'},
            ].map(b=>`
              <div style="display:flex;align-items:center;justify-content:space-between;background:${b.bg};border-radius:8px;padding:9px 14px;margin-bottom:8px;">
                <span style="font-size:12px;font-weight:600;color:${b.c};">${b.l}</span>
                <span style="font-size:15px;font-weight:700;">${formatCurrencyShort(b.v)}</span>
              </div>`).join('')}
          </div>
        </div>
      </div>
    `);

    window.DashboardPage = this;
    requestAnimationFrame(() => this._drawChart(d.monthly));
  },

  _drawChart(monthly) {
    const canvas = document.getElementById('rev-chart');
    if (!canvas || !window.Chart) return;
    if (this._chart) { this._chart.destroy(); this._chart=null; }
    this._chart = new Chart(canvas, {
      type:'bar',
      data:{ labels:monthly.labels, datasets:[
        {label:'Revenue', data:monthly.revenue, backgroundColor:'#1D4ED8',borderRadius:4,barThickness:12},
        {label:'Expenses',data:monthly.expenses,backgroundColor:'#E5E7EB',borderRadius:4,barThickness:12},
      ]},
      options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{backgroundColor:'#1A202C',callbacks:{label:ctx=>` ₹${(ctx.raw/100000).toFixed(1)}L`}}},scales:{x:{grid:{display:false},ticks:{font:{size:11,family:'Inter'},color:'#6B7A99'}},y:{grid:{color:'#F1F3F7'},border:{display:false},ticks:{font:{size:11},color:'#6B7A99',callback:v=>v===0?'0':`₹${(v/100000).toFixed(0)}L`}}}},
    });
  },
};
export default DashboardPage;
