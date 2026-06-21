import Router from '../../core/router.js';
import DB from '../../services/firestore.js';
import Topbar from '../../components/Topbar.js';
import Toast from '../../components/Toast.js';
import { formatCurrencyShort, formatDate } from '../../utils/formatters.js';

const VendorDetailPage = {
  async init(id) {
    const vendor = await DB.getOne('vendors', id);
    if (!vendor) { Toast.error('Vendor not found'); return; }
    Topbar.render({ breadcrumb: [{ label: 'Vendors', route: '/vendors' }, { label: vendor.name }], actions: `<a href="#/vendors/${id}/edit" class="btn btn-secondary btn-sm"><i class="ti ti-edit"></i> Edit</a>` });
    Router.render(`
      <h1 style="font-size:22px;font-weight:600;margin-bottom:20px;">${vendor.name}</h1>
      <div class="grid-3 mb-4">
        <div class="metric-card"><div class="metric-label">GSTIN</div><div style="font-family:var(--font-mono);font-size:13px;margin-top:4px;">${vendor.gstin || '—'}</div></div>
        <div class="metric-card"><div class="metric-label">Contact</div><div style="font-size:13px;margin-top:4px;">${vendor.email || vendor.phone || '—'}</div></div>
        <div class="metric-card"><div class="metric-label">State</div><div style="font-size:16px;font-weight:600;margin-top:4px;">${vendor.state || '—'}</div></div>
      </div>
      <div class="card"><div class="empty-state"><div class="empty-state-icon"><i class="ti ti-receipt"></i></div><h3>No expenses yet</h3><p>Expenses linked to this vendor will appear here.</p></div></div>
    `);
  },
};
export default VendorDetailPage;
