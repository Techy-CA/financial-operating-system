import Router from '../../core/router.js';
import Store  from '../../core/store.js';
import Toast  from '../../components/Toast.js';
import { initials, avatarColor } from '../../utils/formatters.js';
import Icon from '../../utils/icons.js';

const CustomersPage = {
  _list: [],

  async init() {
    Router.render(`
      <div class="page-header">
        <div class="page-header-left"><h1>Customers</h1><p id="cust-count">Loading…</p></div>
        <div class="page-header-actions"><a href="#/customers/new" class="btn btn-primary btn-sm">+ Add customer</a></div>
      </div>
      <div class="page-toolbar">
        <div class="input-wrapper" style="max-width:300px;">
          <svg style="position:absolute;left:10px;top:50%;transform:translateY(-50%);width:14px;height:14px;" viewBox="0 0 24 24" fill="none" stroke="#9AA5B8" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input class="input" id="cust-search" type="search" placeholder="Name, GSTIN, email, phone…" style="padding-left:34px;" autocomplete="off" spellcheck="false" />
        </div>
      </div>
      <div class="card" id="cust-table-wrap">
        <div style="padding:40px;text-align:center;"><div class="spinner-sm"></div></div>
      </div>
    `);

    // Attach search BEFORE loading data so there's no re-render
    const input = document.getElementById('cust-search');
    if (input) {
      input.addEventListener('input', () => this._filterTable(input.value));
      input.addEventListener('search', () => this._filterTable(input.value));
    }

    try {
      const { default: DB } = await import('../../services/firestore.js');
      this._list = await DB.getAll('customers', []).catch(() => []);
      this._list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    } catch (e) { this._list = []; }

    this._renderTable(this._list);
    document.getElementById('cust-count').textContent = `${this._list.length} customer${this._list.length !== 1 ? 's' : ''}`;
    window.CustomersPage = this;
  },

  _filterTable(q) {
    const term = q.toLowerCase().trim();
    const filtered = term
      ? this._list.filter(c => `${c.name} ${c.gstin} ${c.email} ${c.phone}`.toLowerCase().includes(term))
      : this._list;
    this._renderTable(filtered);
  },

  _renderTable(list) {
    const wrap = document.getElementById('cust-table-wrap');
    if (!wrap) return;
    if (list.length === 0) {
      wrap.innerHTML = `<div class="empty-state"><div class="empty-state-icon">${Icon.users(24)}</div><h3>${this._list.length === 0 ? 'No customers yet' : 'No results'}</h3><p>${this._list.length === 0 ? 'Add your first customer to start creating invoices.' : 'Try a different search.'}</p>${this._list.length === 0 ? `<a href="#/customers/new" class="btn btn-primary">Add first customer</a>` : ''}</div>`;
      return;
    }
    wrap.innerHTML = `<div class="table-wrapper"><table class="data-table">
      <thead><tr><th>Customer</th><th>GSTIN</th><th>Email</th><th>Phone</th><th>State</th><th class="text-right">Actions</th></tr></thead>
      <tbody>
        ${list.map(c => {
          const col = avatarColor(c.name || '');
          return `<tr>
            <td>
              <div class="table-entity">
                <div class="table-entity-avatar" style="background:${col.bg};color:${col.text};">${initials(c.name)}</div>
                <div>
                  <a href="#/customers/${c.id}" style="font-weight:600;color:var(--text-primary);text-decoration:none;">${c.name || '—'}</a>
                  ${c.pan ? `<div style="font-size:11px;color:var(--text-tertiary);">PAN: ${c.pan}</div>` : ''}
                </div>
              </div>
            </td>
            <td style="font-family:var(--font-mono);font-size:11.5px;color:var(--text-secondary);">${c.gstin || '—'}</td>
            <td style="font-size:13px;color:var(--text-secondary);">${c.email || '—'}</td>
            <td class="muted">${c.phone || '—'}</td>
            <td class="muted">${c.state || '—'}</td>
            <td class="col-actions">
              <div class="row-actions">
                <a href="#/invoices/new?customerId=${c.id}" class="btn btn-ghost btn-icon btn-sm" title="New invoice">${Icon.fileText(14)}</a>
                <a href="#/customers/${c.id}/edit" class="btn btn-ghost btn-icon btn-sm" title="Edit">${Icon.edit(14)}</a>
                <button class="btn btn-ghost btn-icon btn-sm" onclick="CustomersPage.del('${c.id}','${(c.name||'').replace(/'/g, "\\'")}',this)" title="Delete" style="color:var(--color-danger);">${Icon.trash(14)}</button>
              </div>
            </td>
          </tr>`;
        }).join('')}
      </tbody>
    </table></div>`;
  },

  async del(id, name, btn) {
    if (!confirm(`Delete customer "${name}"?\n\nThis will NOT delete their invoices.`)) return;
    try {
      const { default: DB } = await import('../../services/firestore.js');
      await DB.delete('customers', id);
      this._list = this._list.filter(c => c.id !== id);
      this._renderTable(this._list);
      document.getElementById('cust-count').textContent = `${this._list.length} customers`;
      Toast.success(`${name} deleted`);
    } catch (e) { Toast.error('Delete failed: ' + e.message); }
  },
};
export default CustomersPage;
