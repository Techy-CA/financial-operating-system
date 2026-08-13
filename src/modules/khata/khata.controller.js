/**
 * khata.controller.js — Party balances (you'll get / you'll give)
 */

import Router from '../../core/router.js';
import Store  from '../../core/store.js';
import Toast  from '../../components/Toast.js';
import Icon   from '../../utils/icons.js';
import KhataService from './khata.service.js';
import { formatCurrency, formatCurrencyShort, formatDate, formatPhone, initials, avatarColor } from '../../utils/formatters.js';

const money = (v) => formatCurrency(v);
const esc   = (s) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const KhataPage = {
  _parties: [], _tab: 'get', _search: '',

  async init() {
    window.KhataPage = this;
    Router.render(`
      <div class="page-header">
        <div class="page-header-left"><h1>Party khata</h1><p>Running udhaar for every customer and vendor</p></div>
      </div>
      <div id="kh-summary"></div>
      <div class="tabs" id="kh-tabs"></div>
      <div class="page-toolbar">
        <div class="input-wrapper" style="max-width:280px;">
          <input class="input" id="kh-search" type="search" placeholder="Search party…" autocomplete="off" />
        </div>
      </div>
      <div class="card" id="kh-body"><div style="padding:40px;text-align:center;"><div class="spinner-sm"></div></div></div>
    `);

    document.getElementById('kh-search')?.addEventListener('input', e => { this._search = e.target.value; this._render(); });

    if (!(await KhataService.waitForCompany())) {
      document.getElementById('kh-body').innerHTML = `<div class="empty-state"><h3>No company selected</h3><p>Set up your company in Settings first.</p></div>`;
      return;
    }

    try {
      this._parties = await KhataService.parties();
    } catch (e) {
      Toast.error('Could not load khata: ' + e.message);
    }
    this._renderSummary();
    this._render();
  },

  _renderSummary() {
    const t = KhataService.totals(this._parties);
    document.getElementById('kh-summary').innerHTML = `
      <div class="khata-summary">
        <div class="khata-sum-card get">
          <span>You'll get</span>
          <strong>${money(t.toGet)}</strong>
          <small>${t.getCount} part${t.getCount === 1 ? 'y' : 'ies'}</small>
        </div>
        <div class="khata-sum-card give">
          <span>You'll give</span>
          <strong>${money(t.toGive)}</strong>
          <small>${t.giveCount} part${t.giveCount === 1 ? 'y' : 'ies'}</small>
        </div>
        <div class="khata-sum-card net">
          <span>Net position</span>
          <strong style="color:${t.net >= 0 ? 'var(--color-success)' : 'var(--color-danger)'};">${money(Math.abs(t.net))}</strong>
          <small>${t.net >= 0 ? 'In your favour' : 'You owe overall'}</small>
        </div>
      </div>`;
  },

  setTab(t) { this._tab = t; this._render(); },

  _render() {
    const get   = this._parties.filter(p => p.balance >  0.5);
    const give  = this._parties.filter(p => p.balance < -0.5);
    const settled = this._parties.filter(p => Math.abs(p.balance) <= 0.5 && p.txnCount > 0);

    document.getElementById('kh-tabs').innerHTML = [
      ['get', `You'll get`, get.length],
      ['give', `You'll give`, give.length],
      ['settled', 'Settled', settled.length],
      ['all', 'All parties', this._parties.length],
    ].map(([id, label, n]) => `
      <button class="tab-item ${this._tab === id ? 'active' : ''}" onclick="KhataPage.setTab('${id}')">
        ${label}${n > 0 ? `<span class="tab-count">${n}</span>` : ''}
      </button>`).join('');

    let list = this._tab === 'get' ? get : this._tab === 'give' ? give : this._tab === 'settled' ? settled : this._parties;
    const q = this._search.toLowerCase().trim();
    if (q) list = list.filter(p => `${p.name} ${p.phone || ''}`.toLowerCase().includes(q));

    const body = document.getElementById('kh-body');
    if (list.length === 0) {
      body.innerHTML = `<div class="empty-state">
        <div class="empty-state-icon">${Icon.clipboard(24)}</div>
        <h3>Nothing here</h3>
        <p>${this._parties.length === 0 ? 'Add customers or vendors, then their balances appear here automatically.' : 'No party in this bucket.'}</p>
      </div>`;
      return;
    }

    body.innerHTML = `<div class="table-wrapper"><table class="data-table">
      <thead><tr><th>Party</th><th>Type</th><th>Phone</th><th>Last activity</th><th class="text-right">Balance</th><th></th></tr></thead>
      <tbody>
        ${list.map(p => {
          const col = avatarColor(p.name);
          const owed = p.balance > 0.5;
          const owe  = p.balance < -0.5;
          return `<tr style="cursor:pointer;" onclick="location.hash='#/khata/${p.partyType}/${p.partyId}'">
            <td>
              <div class="table-entity">
                <div class="table-entity-avatar" style="background:${col.bg};color:${col.text};">${esc(initials(p.name))}</div>
                <div><div class="table-entity-name">${esc(p.name)}</div>
                <div class="table-entity-sub">${p.txnCount} transaction${p.txnCount === 1 ? '' : 's'}</div></div>
              </div>
            </td>
            <td><span class="badge ${p.partyType === 'customer' ? 'badge-info' : 'badge-purple'}">${p.partyType === 'customer' ? 'Customer' : 'Vendor'}</span></td>
            <td class="muted">${p.phone ? formatPhone(p.phone) : '—'}</td>
            <td class="muted">${p.lastDate ? formatDate(p.lastDate, 'short') : '—'}</td>
            <td class="col-amount">
              <strong style="color:${owed ? 'var(--color-success)' : owe ? 'var(--color-danger)' : 'var(--text-tertiary)'};">
                ${Math.abs(p.balance) <= 0.5 ? 'Settled' : money(Math.abs(p.balance))}
              </strong>
              ${owed ? `<div style="font-size:10.5px;color:var(--text-tertiary);">to get</div>` : owe ? `<div style="font-size:10.5px;color:var(--text-tertiary);">to give</div>` : ''}
            </td>
            <td class="col-actions" onclick="event.stopPropagation()"><div class="row-actions">
              ${p.phone && Math.abs(p.balance) > 0.5
                ? `<button class="btn btn-secondary btn-sm" onclick="KhataPage.remind('${p.partyType}','${p.partyId}')">${Icon.send(13)} Remind</button>`
                : ''}
              <a href="#/khata/${p.partyType}/${p.partyId}" class="btn btn-ghost btn-sm">Statement</a>
            </div></td>
          </tr>`;
        }).join('')}
      </tbody>
    </table></div>`;
  },

  remind(partyType, partyId) {
    const p = this._parties.find(x => x.partyType === partyType && x.partyId === partyId);
    if (!p) return;
    if (!p.phone) { Toast.warning(`${p.name} has no phone number saved`); return; }
    const text = KhataService.reminderText(p, p.balance, Store.get('company')?.name);
    const url  = KhataService.whatsappLink(p.phone, text);
    if (url) { window.open(url, '_blank'); Toast.success(`Reminder opened for ${p.name}`); }
  },
};

export default KhataPage;
