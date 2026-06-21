import Router from '../../core/router.js';
import DB from '../../services/firestore.js';
import Toast from '../../components/Toast.js';
import { formatCurrencyShort, formatDate } from '../../utils/formatters.js';

const VendorsPage = {
  _vendors: [],
  async init() {
    try {
      this._vendors = await DB.getAll('vendors', [DB.orderBy('name', 'asc')]);
    } catch(e) { this._vendors = []; }
    this._render();
  },
  _render() {
    Router.render(`
      <div class="page-header">
        <div class="page-header-left"><h1>Vendors</h1><p>${this._vendors.length} vendors</p></div>
        <div class="page-header-actions">
          <a href="#/vendors/new" class="btn btn-primary btn-sm"><i class="ti ti-plus"></i> Add vendor</a>
        </div>
      </div>
      <div class="card">
        ${this._vendors.length === 0 ? `
          <div class="empty-state">
            <div class="empty-state-icon"><i class="ti ti-truck"></i></div>
            <h3>No vendors yet</h3>
            <p>Add vendors to track your purchases and payables.</p>
            <a href="#/vendors/new" class="btn btn-primary">Add first vendor</a>
          </div>` : `
          <div class="table-wrapper">
            <table class="data-table">
              <thead><tr><th>Vendor</th><th>GSTIN</th><th>Contact</th><th>State</th><th class="text-right">Total paid</th><th></th></tr></thead>
              <tbody>
                ${this._vendors.map(v => `
                  <tr>
                    <td style="font-weight:500;">${v.name}</td>
                    <td style="font-family:var(--font-mono);font-size:11px;color:var(--text-tertiary);">${v.gstin || '—'}</td>
                    <td class="muted">${v.email || v.phone || '—'}</td>
                    <td class="muted">${v.state || '—'}</td>
                    <td class="col-amount">${formatCurrencyShort(v.totalPaid || 0)}</td>
                    <td class="col-actions">
                      <div class="row-actions">
                        <a href="#/vendors/${v.id}" class="btn btn-ghost btn-icon btn-sm"><i class="ti ti-eye"></i></a>
                      </div>
                    </td>
                  </tr>`).join('')}
              </tbody>
            </table>
          </div>`}
      </div>
    `);
  },
};
export default VendorsPage;
