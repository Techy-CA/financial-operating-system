/**
 * khata-detail.controller.js — One party's running statement
 *
 * Every document and cash entry in date order with a running balance, plus the
 * two buttons that matter: record a cash movement, and send a reminder.
 */

import Router from '../../core/router.js';
import Store  from '../../core/store.js';
import Toast  from '../../components/Toast.js';
import Icon   from '../../utils/icons.js';
import KhataService from './khata.service.js';
import { formatCurrency, formatDate, formatPhone, initials, avatarColor } from '../../utils/formatters.js';

const money = (v) => formatCurrency(v);
const esc   = (s) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const KIND_ICON = {
  invoice: 'fileText', receipt: 'wallet', bill: 'truck',
  payout: 'wallet', cash: 'creditCard',
};

const KhataDetail = {
  _type: null, _id: null, _data: null,

  async init(partyType, partyId) {
    window.KhataDetail = this;
    this._type = partyType; this._id = partyId;

    Router.render(`
      <div id="kd-head"></div>
      <div class="card" id="kd-body"><div style="padding:40px;text-align:center;"><div class="spinner-sm"></div></div></div>
      <div id="kd-modal"></div>
    `);

    if (!(await KhataService.waitForCompany())) {
      document.getElementById('kd-body').innerHTML = `<div class="empty-state"><h3>No company selected</h3></div>`;
      return;
    }
    await this._load();
  },

  async _load() {
    try {
      this._data = await KhataService.statement(this._type, this._id);
    } catch (e) {
      document.getElementById('kd-body').innerHTML = `<div class="empty-state"><h3>Could not load statement</h3><p>${esc(e.message)}</p></div>`;
      return;
    }
    this._render();
  },

  _render() {
    const { party, rows, balance } = this._data;
    const col = avatarColor(party.name || '');
    const owed = balance > 0.5, owe = balance < -0.5;

    document.getElementById('kd-head').innerHTML = `
      <div class="page-header">
        <div class="page-header-left" style="display:flex;align-items:center;gap:12px;">
          <div class="table-entity-avatar" style="width:42px;height:42px;font-size:15px;background:${col.bg};color:${col.text};">${esc(initials(party.name || '?'))}</div>
          <div>
            <h1 style="margin:0;">${esc(party.name || 'Party')}</h1>
            <p style="margin:2px 0 0;">
              ${party.phone ? esc(formatPhone(party.phone)) : 'No phone'} ·
              ${this._type === 'customer' ? 'Customer' : 'Vendor'} ·
              ${rows.length} transaction${rows.length === 1 ? '' : 's'}
            </p>
          </div>
        </div>
        <div class="page-header-actions">
          <a href="#/khata" class="btn btn-secondary btn-sm">← All parties</a>
          ${party.phone ? `<button class="btn btn-secondary btn-sm" onclick="KhataDetail.remind()">${Icon.send(14)} Remind</button>` : ''}
          <button class="btn btn-primary btn-sm" onclick="KhataDetail.openEntry()">+ Cash entry</button>
        </div>
      </div>

      <div class="khata-balance ${owed ? 'get' : owe ? 'give' : 'flat'}">
        <span>${owed ? "You'll get" : owe ? "You'll give" : 'Account settled'}</span>
        <strong>${Math.abs(balance) <= 0.5 ? '—' : money(Math.abs(balance))}</strong>
      </div>`;

    const body = document.getElementById('kd-body');
    if (rows.length === 0) {
      body.innerHTML = `<div class="empty-state">
        <div class="empty-state-icon">${Icon.clipboard(24)}</div>
        <h3>No transactions yet</h3>
        <p>Record a cash entry, or raise an invoice for this party.</p>
        <button class="btn btn-primary" onclick="KhataDetail.openEntry()">Add cash entry</button>
      </div>`;
      return;
    }

    body.innerHTML = `<div class="table-wrapper"><table class="data-table">
      <thead><tr><th>Date</th><th>Detail</th><th class="text-right">Debit</th><th class="text-right">Credit</th><th class="text-right">Balance</th><th></th></tr></thead>
      <tbody>
        ${rows.slice().reverse().map(r => `
          <tr>
            <td class="muted" style="white-space:nowrap;">${formatDate(r.date, 'short')}</td>
            <td>
              <div style="display:flex;align-items:center;gap:8px;">
                <span style="color:var(--text-tertiary);display:flex;">${Icon[KIND_ICON[r.kind] || 'fileText'](14)}</span>
                <div>
                  ${r.link ? `<a href="${r.link}" style="font-weight:600;color:var(--brand-primary);">${esc(r.label)}</a>` : `<span style="font-weight:600;">${esc(r.label)}</span>`}
                  ${r.sub ? `<div style="font-size:11px;color:var(--text-tertiary);">${esc(r.sub)}</div>` : ''}
                </div>
              </div>
            </td>
            <td class="col-amount" style="${r.debit ? 'color:var(--color-danger);' : 'color:var(--text-disabled);'}">${r.debit ? money(r.debit) : '—'}</td>
            <td class="col-amount" style="${r.credit ? 'color:var(--color-success);' : 'color:var(--text-disabled);'}">${r.credit ? money(r.credit) : '—'}</td>
            <td class="col-amount"><strong>${money(Math.abs(r.balance))}</strong><span style="font-size:10px;color:var(--text-tertiary);"> ${r.balance >= 0 ? 'Dr' : 'Cr'}</span></td>
            <td class="col-actions">
              ${r.entryId ? `<button class="btn btn-ghost btn-icon btn-sm" style="color:var(--color-danger);" onclick="KhataDetail.delEntry('${r.entryId}')" title="Delete entry">${Icon.trash(13)}</button>` : ''}
            </td>
          </tr>`).join('')}
      </tbody>
    </table>
    <div class="card-footer" style="display:flex;justify-content:space-between;">
      <span style="font-size:12px;color:var(--text-tertiary);">${rows.length} entries · newest first</span>
      <span style="font-size:12.5px;font-weight:700;">Closing balance: ${money(Math.abs(balance))} ${balance >= 0 ? 'Dr' : 'Cr'}</span>
    </div></div>`;
  },

  // ── CASH ENTRY ───────────────────────────────────────────────────────────
  openEntry() {
    const isCustomer = this._type === 'customer';
    document.getElementById('kd-modal').innerHTML = `
      <div class="modal-overlay" onclick="if(event.target===this)KhataDetail.closeModal()" style="z-index:400;">
        <div class="modal" style="max-width:420px;width:100%;">
          <div class="modal-header">
            <h3 style="margin:0;font-size:15px;font-weight:700;">Cash entry</h3>
            <button class="modal-close" onclick="KhataDetail.closeModal()">${Icon.x(15)}</button>
          </div>
          <div class="modal-body">
            <div class="khata-type-toggle">
              <button id="ke-gave" class="active" onclick="KhataDetail.setType('gave')">
                You gave<small>${isCustomer ? 'They owe more' : 'Reduces what you owe'}</small>
              </button>
              <button id="ke-got" onclick="KhataDetail.setType('got')">
                You got<small>${isCustomer ? 'They owe less' : 'You owe more'}</small>
              </button>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Amount *</label>
                <input id="ke-amt" class="input" type="number" step="0.01" placeholder="0.00" autofocus />
              </div>
              <div class="form-group">
                <label class="form-label">Date</label>
                <input id="ke-date" class="input" type="date" value="${new Date().toISOString().split('T')[0]}" />
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">Note</label>
              <input id="ke-notes" class="input" placeholder="Cash received, goods given…" />
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" onclick="KhataDetail.closeModal()">Cancel</button>
            <button class="btn btn-primary" id="ke-save" onclick="KhataDetail.saveEntry()">Save entry</button>
          </div>
        </div>
      </div>`;
    this._entryType = 'gave';
    document.getElementById('ke-amt')?.focus();
  },

  setType(t) {
    this._entryType = t;
    document.getElementById('ke-gave')?.classList.toggle('active', t === 'gave');
    document.getElementById('ke-got')?.classList.toggle('active', t === 'got');
  },

  async saveEntry() {
    const amt = parseFloat(document.getElementById('ke-amt')?.value) || 0;
    if (amt <= 0) { Toast.error('Enter an amount'); return; }
    const btn = document.getElementById('ke-save');
    btn.disabled = true; btn.textContent = 'Saving…';
    try {
      await KhataService.addEntry({
        partyType: this._type, partyId: this._id,
        partyName: this._data.party.name,
        type:   this._entryType || 'gave',
        amount: amt,
        date:   document.getElementById('ke-date')?.value,
        notes:  document.getElementById('ke-notes')?.value,
      });
      this.closeModal();
      Toast.success('Entry recorded');
      await this._load();
    } catch (e) {
      Toast.error('Failed: ' + e.message);
      btn.disabled = false; btn.textContent = 'Save entry';
    }
  },

  async delEntry(id) {
    if (!confirm('Delete this cash entry?')) return;
    try { await KhataService.deleteEntry(id); Toast.success('Entry deleted'); await this._load(); }
    catch (e) { Toast.error(e.message); }
  },

  remind() {
    const { party, balance } = this._data;
    if (!party.phone) { Toast.warning('No phone number saved for this party'); return; }
    const text = KhataService.reminderText(party, balance, Store.get('company')?.name);
    const url  = KhataService.whatsappLink(party.phone, text);
    if (url) { window.open(url, '_blank'); Toast.success('Reminder opened in WhatsApp'); }
  },

  closeModal() { const m = document.getElementById('kd-modal'); if (m) m.innerHTML = ''; },
};

export default KhataDetail;
