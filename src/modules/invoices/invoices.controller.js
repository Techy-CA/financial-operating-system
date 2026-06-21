import Router from '../../core/router.js';
import Store  from '../../core/store.js';
import Toast  from '../../components/Toast.js';
import { formatCurrency, formatCurrencyShort, formatDate, initials, avatarColor } from '../../utils/formatters.js';
import { INVOICE_STATUS_LABELS, INVOICE_STATUS_BADGE } from '../../utils/constants.js';

const InvoicesPage = {
  _list: [], _tab: 'all',

  async init() {
    Router.render(`
      <div class="page-header">
        <div class="page-header-left"><h1>Invoices</h1><p id="inv-count">Loading…</p></div>
        <div class="page-header-actions"><a href="#/invoices/new" class="btn btn-primary btn-sm">+ New invoice</a></div>
      </div>
      <div class="tabs" id="inv-tabs"></div>
      <div class="page-toolbar">
        <div class="input-wrapper" style="max-width:280px;">
          <svg style="position:absolute;left:10px;top:50%;transform:translateY(-50%);width:14px;height:14px;" viewBox="0 0 24 24" fill="none" stroke="#9AA5B8" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input class="input" id="inv-search" type="search" placeholder="Invoice #, customer…" style="padding-left:34px;" autocomplete="off" />
        </div>
      </div>
      <div class="card" id="inv-table-wrap"><div style="padding:40px;text-align:center;"><div class="spinner-sm"></div></div></div>
    `);

    // Attach listeners immediately — before data loads
    const input = document.getElementById('inv-search');
    if (input) input.addEventListener('input', () => this._filter());

    try {
      const { default: DB } = await import('../../services/firestore.js');
      this._list = await DB.getAll('invoices', [DB.orderBy('createdAt', 'desc')]).catch(() => []);
    } catch (e) { this._list = []; }

    this._renderTabs();
    this._filter();
    window.InvoicesPage = this;
  },

  _renderTabs() {
    const tabs = ['all', 'draft', 'sent', 'partial', 'paid', 'overdue'];
    const counts = {};
    tabs.forEach(t => counts[t] = t === 'all' ? this._list.length : this._list.filter(i => i.status === t).length);
    const container = document.getElementById('inv-tabs');
    if (container) {
      container.innerHTML = tabs.map(t =>
        `<button class="tab-item ${this._tab === t ? 'active' : ''}" onclick="InvoicesPage.setTab('${t}')">
          ${t.charAt(0).toUpperCase() + t.slice(1)}
          ${counts[t] > 0 ? `<span class="tab-count">${counts[t]}</span>` : ''}
        </button>`
      ).join('');
    }
    const total = this._list.reduce((s, i) => s + (i.grandTotal || 0), 0);
    const countEl = document.getElementById('inv-count');
    if (countEl) countEl.textContent = `${this._list.length} invoices · ₹${formatCurrencyShort(total)} total`;
  },

  _filter() {
    const q    = (document.getElementById('inv-search')?.value || '').toLowerCase().trim();
    let list   = this._tab === 'all' ? this._list : this._list.filter(i => i.status === this._tab);
    if (q)  list = list.filter(i => `${i.invoiceNumber} ${i.customerName}`.toLowerCase().includes(q));
    this._renderTable(list);
  },

  setTab(tab) {
    this._tab = tab;
    document.querySelectorAll('#inv-tabs .tab-item').forEach(el => {
      el.classList.toggle('active', el.textContent.trim().toLowerCase().startsWith(tab));
    });
    this._filter();
  },

  _renderTable(list) {
    const wrap = document.getElementById('inv-table-wrap');
    if (!wrap) return;
    if (list.length === 0) {
      wrap.innerHTML = `<div class="empty-state"><div class="empty-state-icon">📄</div><h3>${this._list.length === 0 ? 'No invoices yet' : 'No results'}</h3><p>${this._list.length === 0 ? 'Create your first invoice in under 30 seconds.' : 'Try a different filter.'}</p>${this._list.length === 0 ? `<a href="#/invoices/new" class="btn btn-primary">Create first invoice</a>` : ''}</div>`;
      return;
    }
    wrap.innerHTML = `<div class="table-wrapper"><table class="data-table">
      <thead><tr><th>Invoice #</th><th>Customer</th><th>Date</th><th>Due</th><th>Status</th><th class="text-right">Amount</th><th class="text-right">Balance</th><th></th></tr></thead>
      <tbody>
        ${list.map(inv => {
          const col = avatarColor(inv.customerName || '');
          return `<tr style="cursor:pointer;" onclick="location.hash='#/invoices/${inv.id}'">
            <td onclick="event.stopPropagation()"><a href="#/invoices/${inv.id}" style="font-weight:700;color:var(--brand-primary);">${inv.invoiceNumber || '—'}</a></td>
            <td>
              <div class="table-entity">
                <div class="table-entity-avatar" style="background:${col.bg};color:${col.text};">${initials(inv.customerName || '?')}</div>
                <span style="font-size:13px;font-weight:500;">${inv.customerName || '—'}</span>
              </div>
            </td>
            <td class="muted">${formatDate(inv.invoiceDate)}</td>
            <td class="muted">${formatDate(inv.dueDate)}</td>
            <td><span class="${INVOICE_STATUS_BADGE[inv.status] || 'badge badge-neutral'} badge-dot">${INVOICE_STATUS_LABELS[inv.status] || inv.status || 'draft'}</span></td>
            <td class="col-amount">₹${formatCurrency(inv.grandTotal || 0)}</td>
            <td class="col-amount" style="${(inv.balanceDue || 0) > 0 ? 'color:var(--color-warning);' : ''}">₹${formatCurrency(inv.balanceDue || 0)}</td>
            <td onclick="event.stopPropagation()" class="col-actions"><div class="row-actions">
              <a href="#/invoices/${inv.id}/edit" class="btn btn-ghost btn-icon btn-sm" title="Edit">✏️</a>
              <button class="btn btn-ghost btn-icon btn-sm" onclick="InvoicesPage.del('${inv.id}','${inv.invoiceNumber||''}')" title="Delete" style="color:var(--color-danger);">🗑</button>
            </div></td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>
    <div class="card-footer" style="display:flex;justify-content:space-between;align-items:center;">
      <span style="font-size:12px;color:var(--text-tertiary);">Showing ${list.length} of ${this._list.length}</span>
      <span style="font-size:12px;font-weight:600;">Total: ₹${formatCurrencyShort(list.reduce((s,i)=>s+(i.grandTotal||0),0))}</span>
    </div></div>`;
  },

  async del(id, num) {
    if (!confirm(`Delete invoice ${num}?`)) return;
    try {
      const { default: DB } = await import('../../services/firestore.js');
      const items = await DB.getAll('invoiceItems', [DB.where('invoiceId','==',id)]).catch(()=>[]);
      for (const item of items) await DB.delete('invoiceItems', item.id);
      await DB.delete('invoices', id);
      this._list = this._list.filter(i => i.id !== id);
      this._renderTabs();
      this._filter();
      Toast.success(`Invoice ${num} deleted`);
    } catch (e) { Toast.error('Delete failed: ' + e.message); }
  },
};
export default InvoicesPage;
