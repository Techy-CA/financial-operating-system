import Router from '../../core/router.js';
import Store  from '../../core/store.js';
import Toast  from '../../components/Toast.js';
import { formatCurrency, formatCurrencyShort, formatDate } from '../../utils/formatters.js';
import { EXPENSE_CATEGORIES, EXPENSE_CATEGORY_MAP } from '../../utils/constants.js';

const ExpensesPage = {
  _list: [], _cat: 'all',

  async init() {
    Router.render(`
      <div class="page-header">
        <div class="page-header-left"><h1>Expenses</h1><p id="exp-count">Loading…</p></div>
        <div class="page-header-actions"><a href="#/expenses/new" class="btn btn-primary btn-sm">+ Add expense</a></div>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px;" id="cat-filters">
        <button class="filter-chip active" onclick="ExpensesPage.setCat('all')">All</button>
        ${(EXPENSE_CATEGORIES||[]).map(c=>`<button class="filter-chip" onclick="ExpensesPage.setCat('${c.id}')">${c.label}</button>`).join('')}
      </div>
      <div class="grid-3 mb-4" id="exp-metrics">
        <div class="skeleton" style="height:80px;border-radius:12px;"></div>
        <div class="skeleton" style="height:80px;border-radius:12px;"></div>
        <div class="skeleton" style="height:80px;border-radius:12px;"></div>
      </div>
      <div class="card" id="exp-table"><div style="padding:40px;text-align:center;"><div class="spinner-sm"></div></div></div>
    `);

    try {
      const { default: DB } = await import('../../services/firestore.js');
      this._list = await DB.getAll('expenses', []).catch(() => []);
      this._list.sort((a,b) => new Date(b.expenseDate||0) - new Date(a.expenseDate||0));
    } catch(e) { this._list = []; }

    this._render();
    window.ExpensesPage = this;
  },

  _render() {
    const filtered = this._cat === 'all' ? this._list : this._list.filter(e => e.category === this._cat);
    const total    = this._list.reduce((s,e)=>s+(e.amount||0),0);
    const now      = new Date();
    const thisMonth= this._list.filter(e=>{const d=new Date(e.expenseDate||'');return d.getMonth()===now.getMonth()&&d.getFullYear()===now.getFullYear();}).reduce((s,e)=>s+(e.amount||0),0);

    const countEl   = document.getElementById('exp-count');
    const metricsEl = document.getElementById('exp-metrics');
    const tableEl   = document.getElementById('exp-table');

    if (countEl)   countEl.textContent   = `${this._list.length} entries`;
    if (metricsEl) metricsEl.innerHTML   = `
      <div class="metric-card"><div class="metric-label">This month</div><div class="metric-value">₹${formatCurrencyShort(thisMonth)}</div></div>
      <div class="metric-card"><div class="metric-label">This FY total</div><div class="metric-value danger">₹${formatCurrencyShort(total)}</div></div>
      <div class="metric-card"><div class="metric-label">Entries</div><div class="metric-value">${this._list.length}</div></div>
    `;

    // Update category filter active state
    document.querySelectorAll('#cat-filters .filter-chip').forEach((el,i) => {
      const val = i === 0 ? 'all' : (EXPENSE_CATEGORIES||[])[i-1]?.id;
      el.classList.toggle('active', val === this._cat);
    });

    if (!tableEl) return;

    if (filtered.length === 0) {
      tableEl.innerHTML = `<div class="empty-state"><div class="empty-state-icon">🧾</div><h3>${this._list.length===0?'No expenses yet':'No results'}</h3><p>${this._list.length===0?'Start tracking business expenses.':''}</p>${this._list.length===0?`<a href="#/expenses/new" class="btn btn-primary">Add first expense</a>`:''}</div>`;
      return;
    }

    tableEl.innerHTML = `
      <div class="table-wrapper">
        <table class="data-table">
          <thead>
            <tr><th>Date</th><th>Category</th><th>Description</th><th>Vendor</th><th class="text-right">Amount</th><th class="text-right" style="min-width:120px;">Actions</th></tr>
          </thead>
          <tbody>
            ${filtered.map(e => {
              const cat = EXPENSE_CATEGORY_MAP?.[e.category] || { label: e.category||'Other', icon:'ti-dots' };
              return `<tr>
                <td class="muted" style="white-space:nowrap;">${formatDate(e.expenseDate)}</td>
                <td>
                  <span class="badge badge-neutral">${cat.label||e.category||'—'}</span>
                </td>
                <td style="font-weight:500;">${e.description||'—'}</td>
                <td class="muted">${e.vendorName||'—'}</td>
                <td class="col-amount" style="font-weight:700;">₹${formatCurrency(e.amount||0)}</td>
                <td class="col-actions">
                  <div class="row-actions">
                    <a href="#/expenses/${e.id}/edit" class="btn btn-secondary btn-sm" title="Edit">✏️ Edit</a>
                    <button class="btn btn-danger btn-sm" onclick="ExpensesPage.del('${e.id}','${(e.description||'').replace(/'/g,"\\'")}',this)" title="Delete">🗑 Delete</button>
                  </div>
                </td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
        <div class="card-footer" style="text-align:right;">
          Total (filtered): <strong>₹${formatCurrencyShort(filtered.reduce((s,e)=>s+(e.amount||0),0))}</strong>
        </div>
      </div>
    `;
  },

  setCat(cat) { this._cat = cat; this._render(); },

  async del(id, desc, btn) {
    if (!confirm(`Delete expense "${desc}"? This cannot be undone.`)) return;
    btn?.classList?.add('loading');
    try {
      const { default: DB } = await import('../../services/firestore.js');
      await DB.delete('expenses', id);
      this._list = this._list.filter(e => e.id !== id);
      this._render();
      Toast.success('Expense deleted');
    } catch(e) { Toast.error('Delete failed: ' + e.message); }
  },
};
export default ExpensesPage;
