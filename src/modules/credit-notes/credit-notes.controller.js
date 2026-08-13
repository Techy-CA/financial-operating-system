/**
 * credit-notes.controller.js — Issued credit notes
 */

import Router from '../../core/router.js';
import Toast  from '../../components/Toast.js';
import Icon   from '../../utils/icons.js';
import CreditNoteService from './credit-notes.service.js';
import { formatCurrency, formatCurrencyShort, formatDate, initials, avatarColor } from '../../utils/formatters.js';
import { CREDIT_NOTE_REASON_MAP, CREDIT_NOTE_STATUS_BADGE } from '../../utils/constants.js';

const money = (v) => formatCurrency(v);
const esc   = (s) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const CreditNotesPage = {
  _list: [],

  async init() {
    window.CreditNotesPage = this;
    Router.render(`
      <div class="page-header">
        <div class="page-header-left"><h1>Credit notes</h1><p id="cn-count">Loading…</p></div>
        <div class="page-header-actions"><a href="#/credit-notes/new" class="btn btn-primary btn-sm">+ New credit note</a></div>
      </div>
      <div id="cn-metrics" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;margin-bottom:16px;"></div>
      <div class="page-toolbar">
        <div class="input-wrapper" style="max-width:280px;">
          <input class="input" id="cn-search" type="search" placeholder="Note #, invoice, customer…" autocomplete="off" />
        </div>
      </div>
      <div class="card" id="cn-table"><div style="padding:40px;text-align:center;"><div class="spinner-sm"></div></div></div>
    `);

    document.getElementById('cn-search')?.addEventListener('input', () => this._filter());

    if (!(await CreditNoteService.waitForCompany())) {
      document.getElementById('cn-table').innerHTML = `<div class="empty-state"><h3>No company selected</h3><p>Set up your company in Settings first.</p></div>`;
      return;
    }

    this._list = await CreditNoteService.list().catch(() => []);
    this._renderMetrics();
    this._filter();
  },

  _renderMetrics() {
    const s = CreditNoteService.stats(this._list);
    const card = (label, value, sub, tone) => `
      <div class="metric-card">
        <div class="metric-label">${label}</div>
        <div class="metric-value" ${tone ? `style="color:${tone};"` : ''}>${value}</div>
        ${sub ? `<div class="metric-subtext">${sub}</div>` : ''}
      </div>`;
    document.getElementById('cn-metrics').innerHTML =
      card('Total credited', formatCurrencyShort(s.total), `${s.count} notes`) +
      card('This month', formatCurrencyShort(s.thisMonth), 'Returns and adjustments') +
      card('GST reversed', formatCurrencyShort(s.taxReversed), 'Reduces output tax', 'var(--color-info)');

    const c = document.getElementById('cn-count');
    if (c) c.textContent = `${this._list.length} credit note${this._list.length === 1 ? '' : 's'}`;
  },

  _filter() {
    const q = (document.getElementById('cn-search')?.value || '').toLowerCase().trim();
    const list = q
      ? this._list.filter(n => `${n.noteNumber} ${n.invoiceNumber} ${n.customerName}`.toLowerCase().includes(q))
      : this._list;
    this._renderTable(list);
  },

  _renderTable(list) {
    const wrap = document.getElementById('cn-table');
    if (!wrap) return;
    if (list.length === 0) {
      wrap.innerHTML = `<div class="empty-state">
        <div class="empty-state-icon">${Icon.fileText(24)}</div>
        <h3>${this._list.length === 0 ? 'No credit notes yet' : 'No results'}</h3>
        <p>${this._list.length === 0 ? 'Issue a credit note when goods come back or a rate is revised — stock and GST adjust together.' : 'Try a different search.'}</p>
        ${this._list.length === 0 ? `<a href="#/credit-notes/new" class="btn btn-primary">Create credit note</a>` : ''}
      </div>`;
      return;
    }

    wrap.innerHTML = `<div class="table-wrapper"><table class="data-table">
      <thead><tr><th>Note #</th><th>Customer</th><th>Against invoice</th><th>Date</th><th>Reason</th><th>Stock</th><th class="text-right">Amount</th><th></th></tr></thead>
      <tbody>
        ${list.map(n => {
          const col = avatarColor(n.customerName || '');
          return `<tr>
            <td><strong style="color:var(--brand-primary);">${esc(n.noteNumber || '—')}</strong></td>
            <td>
              <div class="table-entity">
                <div class="table-entity-avatar" style="background:${col.bg};color:${col.text};">${esc(initials(n.customerName || '?'))}</div>
                <span style="font-size:13px;font-weight:500;">${esc(n.customerName || '—')}</span>
              </div>
            </td>
            <td>${n.invoiceId ? `<a href="#/invoices/${n.invoiceId}" style="color:var(--brand-primary);">${esc(n.invoiceNumber || 'Invoice')}</a>` : '<span class="muted">—</span>'}</td>
            <td class="muted">${formatDate(n.noteDate)}</td>
            <td class="muted">${esc(CREDIT_NOTE_REASON_MAP[n.reason]?.label || n.reason || '—')}</td>
            <td>${n.restocked ? `<span class="badge badge-success">Returned</span>` : `<span class="badge badge-neutral">No</span>`}</td>
            <td class="col-amount"><strong>${money(n.grandTotal)}</strong></td>
            <td class="col-actions"><div class="row-actions">
              <button class="btn btn-ghost btn-icon btn-sm" style="color:var(--color-danger);" onclick="CreditNotesPage.del('${n.id}','${esc(n.noteNumber || '')}')" title="Delete">${Icon.trash(14)}</button>
            </div></td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>
    <div class="card-footer" style="display:flex;justify-content:space-between;">
      <span style="font-size:12px;color:var(--text-tertiary);">Showing ${list.length} of ${this._list.length}</span>
      <span style="font-size:12px;font-weight:600;">Total: ${formatCurrencyShort(list.reduce((s, n) => s + (n.grandTotal || 0), 0))}</span>
    </div></div>`;
  },

  async del(id, number) {
    if (!confirm(`Delete credit note ${number}?\n\nAny stock it returned will be taken back out and the invoice balance restored.`)) return;
    try {
      await CreditNoteService.delete(id);
      this._list = this._list.filter(n => n.id !== id);
      this._renderMetrics(); this._filter();
      Toast.success(`Credit note ${number} deleted`);
    } catch (e) { Toast.error('Delete failed: ' + e.message); }
  },
};

export default CreditNotesPage;
