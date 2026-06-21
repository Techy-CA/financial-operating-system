/**
 * customer-detail.controller.js
 */

import Router           from '../../core/router.js';
import Topbar           from '../../components/Topbar.js';
import CustomersService from './customers.service.js';
import Toast            from '../../components/Toast.js';
import { formatCurrency, formatCurrencyShort, formatDate, initials, avatarColor } from '../../utils/formatters.js';
import { INVOICE_STATUS_BADGE, INVOICE_STATUS_LABELS } from '../../utils/constants.js';
import DB from '../../services/firestore.js';

const CustomerDetailPage = {
  async init(id) {
    this._id = id;
    try {
      const [customer, stats, invoices] = await Promise.all([
        CustomersService.getById(id),
        CustomersService.getStats(id),
        DB.getAll('invoices', [DB.where('customerId', '==', id), DB.orderBy('invoiceDate', 'desc'), DB.limit(20)]),
      ]);

      if (!customer) { Toast.error('Customer not found'); return; }

      Topbar.render({
        breadcrumb: [
          { label: 'Customers', route: '/customers' },
          { label: customer.name },
        ],
        actions: `
          <a href="#/invoices/new?customerId=${id}" class="btn btn-primary btn-sm">
            <i class="ti ti-file-plus" aria-hidden="true"></i> New invoice
          </a>
          <a href="#/customers/${id}/edit" class="btn btn-secondary btn-sm">
            <i class="ti ti-edit" aria-hidden="true"></i> Edit
          </a>
        `,
      });

      this._render(customer, stats, invoices);
    } catch (err) {
      Toast.error('Failed to load customer');
    }
  },

  _render(c, stats, invoices) {
    const color = avatarColor(c.name || '');

    Router.render(`
      <!-- Header -->
      <div style="display:flex;align-items:center;gap:16px;margin-bottom:24px;">
        <div style="width:52px;height:52px;border-radius:12px;background:${color.bg};color:${color.text};display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:600;flex-shrink:0;">
          ${initials(c.name)}
        </div>
        <div>
          <h1 style="font-size:22px;font-weight:600;letter-spacing:-0.3px;">${c.name}</h1>
          <div style="display:flex;gap:12px;margin-top:4px;flex-wrap:wrap;">
            ${c.gstin ? `<span style="font-size:var(--text-xs);font-family:var(--font-mono);color:var(--text-tertiary);">GST: ${c.gstin}</span>` : ''}
            ${c.state ? `<span style="font-size:var(--text-xs);color:var(--text-tertiary);">${c.state}</span>` : ''}
            ${c.email ? `<a href="mailto:${c.email}" style="font-size:var(--text-xs);color:var(--brand-primary);">${c.email}</a>` : ''}
            ${c.phone ? `<span style="font-size:var(--text-xs);color:var(--text-tertiary);">${c.phone}</span>` : ''}
          </div>
        </div>
      </div>

      <!-- Stats row -->
      <div class="grid-4 mb-5">
        <div class="metric-card">
          <div class="metric-label"><i class="ti ti-file-invoice" aria-hidden="true"></i> Total invoiced</div>
          <div class="metric-value">${formatCurrencyShort(stats.totalInvoiced)}</div>
          <div class="metric-subtext">${stats.invoiceCount} invoice${stats.invoiceCount!==1?'s':''}</div>
        </div>
        <div class="metric-card">
          <div class="metric-label"><i class="ti ti-circle-check" aria-hidden="true"></i> Total received</div>
          <div class="metric-value success">${formatCurrencyShort(stats.totalReceived)}</div>
        </div>
        <div class="metric-card">
          <div class="metric-label"><i class="ti ti-clock" aria-hidden="true"></i> Outstanding</div>
          <div class="metric-value ${stats.totalInvoiced - stats.totalReceived > 0 ? 'warning' : ''}">${formatCurrencyShort(Math.max(0, stats.totalInvoiced - stats.totalReceived))}</div>
        </div>
        <div class="metric-card">
          <div class="metric-label"><i class="ti ti-alert-triangle" aria-hidden="true"></i> Overdue invoices</div>
          <div class="metric-value ${stats.overdueCount > 0 ? 'danger' : ''}">${stats.overdueCount}</div>
        </div>
      </div>

      <!-- Main content -->
      <div style="display:grid;grid-template-columns:1fr 280px;gap:16px;">

        <!-- Invoice history -->
        <div class="card">
          <div class="card-header"><h2>Invoice history</h2></div>
          ${invoices.length === 0 ? `
            <div class="empty-state" style="padding:40px 0;">
              <div class="empty-state-icon"><i class="ti ti-file-off" aria-hidden="true"></i></div>
              <h3>No invoices yet</h3>
              <p>Create the first invoice for this customer.</p>
              <a href="#/invoices/new?customerId=${c.id}" class="btn btn-primary">Create invoice</a>
            </div>
          ` : `
            <div class="table-wrapper">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Invoice #</th>
                    <th>Date</th>
                    <th>Due date</th>
                    <th>Status</th>
                    <th class="text-right">Amount</th>
                    <th class="text-right">Balance</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  ${invoices.map(inv => `
                    <tr>
                      <td><a href="#/invoices/${inv.id}" style="font-weight:500;color:var(--brand-primary);font-size:var(--text-sm);">${inv.invoiceNumber}</a></td>
                      <td class="muted">${formatDate(inv.invoiceDate)}</td>
                      <td class="muted">${formatDate(inv.dueDate)}</td>
                      <td><span class="${INVOICE_STATUS_BADGE[inv.status] || 'badge badge-neutral'}">${INVOICE_STATUS_LABELS[inv.status] || inv.status}</span></td>
                      <td class="col-amount">${formatCurrency(inv.grandTotal)}</td>
                      <td class="col-amount" style="color:${(inv.balanceDue||0)>0?'var(--color-danger)':'var(--text-primary)'};">${formatCurrency(inv.balanceDue||0)}</td>
                      <td class="col-actions">
                        <div class="row-actions">
                          <a href="#/invoices/${inv.id}" class="btn btn-ghost btn-icon btn-sm" aria-label="View invoice">
                            <i class="ti ti-eye" aria-hidden="true"></i>
                          </a>
                        </div>
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          `}
        </div>

        <!-- Details panel -->
        <div style="display:flex;flex-direction:column;gap:12px;">
          <div class="card">
            <div class="card-header"><h2>Contact</h2></div>
            <div class="card-body">
              ${c.contact_name ? `<div style="font-size:var(--text-sm);font-weight:500;color:var(--text-primary);">${c.contact_name}</div>${c.designation?`<div style="font-size:var(--text-xs);color:var(--text-tertiary);">${c.designation}</div>`:''}<div class="divider" style="margin:12px 0;"></div>` : ''}
              ${c.email ? `<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;font-size:var(--text-sm);"><i class="ti ti-mail" style="color:var(--text-tertiary);font-size:15px;" aria-hidden="true"></i><a href="mailto:${c.email}" style="color:var(--brand-primary);">${c.email}</a></div>` : ''}
              ${c.phone ? `<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;font-size:var(--text-sm);"><i class="ti ti-phone" style="color:var(--text-tertiary);font-size:15px;" aria-hidden="true"></i>${c.phone}</div>` : ''}
              ${!c.email && !c.phone ? `<div style="font-size:var(--text-sm);color:var(--text-tertiary);">No contact info</div>` : ''}
            </div>
          </div>

          <div class="card">
            <div class="card-header"><h2>Address</h2></div>
            <div class="card-body">
              <div style="font-size:var(--text-sm);color:var(--text-secondary);line-height:1.6;">
                ${[c.address, c.city, c.state, c.pincode].filter(Boolean).join(', ') || '—'}
              </div>
            </div>
          </div>

          <div class="card">
            <div class="card-header"><h2>Credit terms</h2></div>
            <div class="card-body">
              <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
                <span style="font-size:var(--text-sm);color:var(--text-tertiary);">Credit period</span>
                <span style="font-size:var(--text-sm);font-weight:500;">${c.credit_days || 30} days</span>
              </div>
              ${c.credit_limit ? `
                <div style="display:flex;justify-content:space-between;">
                  <span style="font-size:var(--text-sm);color:var(--text-tertiary);">Credit limit</span>
                  <span style="font-size:var(--text-sm);font-weight:500;">${formatCurrencyShort(c.credit_limit)}</span>
                </div>` : ''}
            </div>
          </div>

          ${c.notes ? `
            <div class="card">
              <div class="card-header"><h2>Notes</h2></div>
              <div class="card-body">
                <p style="font-size:var(--text-sm);color:var(--text-secondary);line-height:1.6;">${c.notes}</p>
              </div>
            </div>` : ''}
        </div>

      </div>
    `);
  },
};

export default CustomerDetailPage;
