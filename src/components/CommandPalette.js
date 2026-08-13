/**
 * CommandPalette.js — Ctrl/Cmd+K jump-anywhere
 *
 * Two things in one box: navigation and record search. Records (invoices,
 * customers, products, vendors) are fetched once on first open and cached for
 * the session, so typing stays instant and doesn't hammer Firestore.
 *
 * Ranking is deliberately simple and predictable: prefix match beats a
 * contained match, and a shorter name beats a longer one. A palette that
 * reorders unpredictably is worse than one that never reorders at all.
 */

import Store  from '../core/store.js';
import Router from '../core/router.js';
import Icon   from '../utils/icons.js';
import { formatCurrency, initials, avatarColor } from '../utils/formatters.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/** Static destinations and actions. `perm` gates the row by module read access. */
const COMMANDS = [
  { id: 'pos',        title: 'Open Point of Sale',   sub: 'Ring up a counter sale',      route: '/pos',                icon: 'creditCard', perm: 'pos',        group: 'Counter' },
  { id: 'register',   title: 'Register & day close', sub: 'Count the drawer',            route: '/pos/register',       icon: 'wallet',     perm: 'register',   group: 'Counter' },
  { id: 'new-inv',    title: 'New invoice',          sub: 'Create a tax invoice',        route: '/invoices/new',       icon: 'fileText',   perm: 'invoices',   group: 'Create' },
  { id: 'new-bill',   title: 'New purchase bill',    sub: 'Record a vendor bill',        route: '/purchases/new',      icon: 'truck',      perm: 'purchases',  group: 'Create' },
  { id: 'new-cn',     title: 'New credit note',      sub: 'Return or adjust a sale',     route: '/credit-notes/new',   icon: 'fileText',   perm: 'creditnotes',group: 'Create' },
  { id: 'new-quote',  title: 'New quotation',        sub: 'Send a quote',                route: '/quotations/new',     icon: 'clipboard',  perm: 'quotations', group: 'Create' },
  { id: 'new-cust',   title: 'Add customer',         sub: 'New customer record',         route: '/customers/new',      icon: 'user',       perm: 'customers',  group: 'Create' },
  { id: 'new-vend',   title: 'Add vendor',           sub: 'New vendor record',           route: '/vendors/new',        icon: 'truck',      perm: 'vendors',    group: 'Create' },
  { id: 'new-prod',   title: 'Add product',          sub: 'New item in the catalogue',   route: '/products/new',       icon: 'box',        perm: 'products',   group: 'Create' },
  { id: 'new-exp',    title: 'Add expense',          sub: 'Record money going out',      route: '/expenses/new',       icon: 'wallet',     perm: 'expenses',   group: 'Create' },
  { id: 'dashboard',  title: 'Dashboard',            sub: 'Business overview',           route: '/dashboard',          icon: 'trendingUp', perm: 'dashboard',  group: 'Go to' },
  { id: 'insights',   title: 'Insights',             sub: 'Payment risk, stock runway',  route: '/insights',           icon: 'bulb',       perm: 'insights',   group: 'Go to' },
  { id: 'proof',      title: 'Consistency proof',    sub: 'Verify the books tie out',    route: '/proof',              icon: 'checkCircle',perm: 'proof',      group: 'Go to' },
  { id: 'khata',      title: 'Party khata',          sub: 'Udhaar and balances',         route: '/khata',              icon: 'clipboard',  perm: 'khata',      group: 'Go to' },
  { id: 'attendance', title: 'Attendance',           sub: 'Mark staff attendance',       route: '/attendance',         icon: 'users',      perm: 'attendance', group: 'Go to' },
  { id: 'payroll',    title: 'Payroll',              sub: 'Run salaries',                route: '/payroll',            icon: 'wallet',     perm: 'payroll',    group: 'Go to' },
  { id: 'staff',      title: 'Staff',                sub: 'Your team',                   route: '/staff',              icon: 'users',      perm: 'staff',      group: 'Go to' },
  { id: 'inventory',  title: 'Inventory',            sub: 'Stock on hand',               route: '/inventory',          icon: 'warehouse',  perm: 'inventory',  group: 'Go to' },
  { id: 'stockledger',title: 'Stock ledger',         sub: 'Every movement',              route: '/inventory/movements',icon: 'history',    perm: 'inventory',  group: 'Go to' },
  { id: 'invoices',   title: 'Invoices',             sub: 'All invoices',                route: '/invoices',           icon: 'fileText',   perm: 'invoices',   group: 'Go to' },
  { id: 'purchases',  title: 'Purchase bills',       sub: 'All vendor bills',            route: '/purchases',          icon: 'truck',      perm: 'purchases',  group: 'Go to' },
  { id: 'collections',title: 'Collections',          sub: 'Chase receivables',           route: '/collections',        icon: 'clock',      perm: 'collections',group: 'Go to' },
  { id: 'gst',        title: 'GST',                  sub: 'Returns and summaries',       route: '/gst',                icon: 'calculator', perm: 'gst',        group: 'Go to' },
  { id: 'reports',    title: 'Reports',              sub: 'P&L, cash flow, ageing',      route: '/reports',            icon: 'trendingUp', perm: 'reports',    group: 'Go to' },
  { id: 'settings',   title: 'Settings',             sub: 'Company and preferences',     route: '/settings',           icon: 'sliders',    perm: null,         group: 'Go to' },
];

const CommandPalette = {
  _open: false, _records: null, _loading: false,
  _results: [], _active: 0, _bound: false,

  /** Called once at login. Safe to call again — the listener is only bound once. */
  install() {
    if (this._bound) return;
    this._bound = true;
    document.addEventListener('keydown', (e) => {
      const isK = (e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey);
      if (isK) { e.preventDefault(); this.toggle(); return; }
      if (!this._open) return;

      if (e.key === 'Escape')      { e.preventDefault(); this.close(); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); this._move(1); }
      else if (e.key === 'ArrowUp')   { e.preventDefault(); this._move(-1); }
      else if (e.key === 'Enter')     { e.preventDefault(); this._run(this._active); }
    }, true);
  },

  toggle() { this._open ? this.close() : this.open(); },

  open() {
    if (this._open) return;
    if (!Store.get('user')) return;          // nothing to search before sign-in
    this._open = true;
    this._active = 0;

    const el = document.createElement('div');
    el.id = '__cmdk';
    el.className = 'cmdk-overlay';
    el.innerHTML = `
      <div class="cmdk-panel" onclick="event.stopPropagation()">
        <div class="cmdk-search">
          ${Icon.search(17)}
          <input id="cmdk-input" placeholder="Search invoices, customers, products… or jump to a page" autocomplete="off" spellcheck="false" />
          <span class="cmdk-kbd">ESC</span>
        </div>
        <div class="cmdk-list" id="cmdk-list"></div>
        <div class="cmdk-foot">
          <span><span class="cmdk-kbd">↑↓</span> navigate</span>
          <span><span class="cmdk-kbd">↵</span> open</span>
          <span style="margin-left:auto;">${this._loading ? 'Loading records…' : ''}</span>
        </div>
      </div>`;
    el.addEventListener('click', (e) => { if (e.target === el) this.close(); });
    document.body.appendChild(el);

    const input = document.getElementById('cmdk-input');
    input?.addEventListener('input', () => this._search(input.value));
    input?.focus();

    this._search('');
    this._warm();
  },

  close() {
    this._open = false;
    document.getElementById('__cmdk')?.remove();
  },

  /** Loads searchable records once per session, in the background. */
  async _warm() {
    if (this._records || this._loading) return;
    this._loading = true;
    try {
      const { default: DB } = await import('../services/firestore.js');
      const [invoices, customers, products, vendors] = await Promise.all([
        DB.getAll('invoices',  [DB.orderBy('createdAt', 'desc'), DB.limit(300)]).catch(() => []),
        DB.getAll('customers', []).catch(() => []),
        DB.getAll('products',  []).catch(() => []),
        DB.getAll('vendors',   []).catch(() => []),
      ]);

      this._records = [
        ...invoices.map(i => ({
          kind: 'Invoice', group: 'Invoices',
          title: i.invoiceNumber || 'Invoice',
          sub:   i.customerName || '',
          amount: i.grandTotal,
          route: `/invoices/${i.id}`,
          hay: `${i.invoiceNumber || ''} ${i.customerName || ''}`.toLowerCase(),
        })),
        ...customers.map(c => ({
          kind: 'Customer', group: 'Customers',
          title: c.name || 'Customer',
          sub:   c.phone || c.gstin || c.email || '',
          route: `/customers/${c.id}`,
          hay: `${c.name || ''} ${c.phone || ''} ${c.gstin || ''} ${c.email || ''}`.toLowerCase(),
        })),
        ...vendors.map(v => ({
          kind: 'Vendor', group: 'Vendors',
          title: v.name || 'Vendor',
          sub:   v.phone || v.gstin || '',
          route: `/vendors/${v.id}`,
          hay: `${v.name || ''} ${v.phone || ''} ${v.gstin || ''}`.toLowerCase(),
        })),
        ...products.map(p => ({
          kind: 'Product', group: 'Products',
          title: p.name || 'Product',
          sub:   [p.sku, p.hsn && `HSN ${p.hsn}`].filter(Boolean).join(' · '),
          amount: p.rate,
          route: `/products/${p.id}`,
          hay: `${p.name || ''} ${p.sku || ''} ${p.barcode || ''} ${p.hsn || ''}`.toLowerCase(),
        })),
      ];
    } catch (e) {
      this._records = [];
    } finally {
      this._loading = false;
      if (this._open) this._search(document.getElementById('cmdk-input')?.value || '');
    }
  },

  _allowed(cmd) {
    if (!cmd.perm) return true;
    return Store.can(cmd.perm, 'read') || !!Store.get('permissions')?.[cmd.perm]?.r;
  },

  /** Prefix hits outrank contained hits; shorter titles win ties. */
  _score(text, q) {
    const t = (text || '').toLowerCase();
    const i = t.indexOf(q);
    if (i < 0) return -1;
    return (i === 0 ? 1000 : 500 - Math.min(i, 400)) - Math.min(t.length, 90);
  },

  _search(query) {
    const q = (query || '').toLowerCase().trim();

    const commands = COMMANDS.filter(c => this._allowed(c));
    let rows = [];

    if (!q) {
      // Empty state: the things people open most, in a fixed order
      rows = commands
        .filter(c => ['Counter', 'Create'].includes(c.group))
        .slice(0, 8)
        .map(c => ({ ...c, _kind: 'command' }));
    } else {
      const cmdHits = commands
        .map(c => ({ c, s: Math.max(this._score(c.title, q), this._score(c.sub, q) - 200) }))
        .filter(x => x.s > -1)
        .sort((a, b) => b.s - a.s)
        .map(x => ({ ...x.c, _kind: 'command' }));

      const recHits = (this._records || [])
        .map(r => ({ r, s: this._score(r.hay, q) }))
        .filter(x => x.s > -1)
        .sort((a, b) => b.s - a.s)
        .slice(0, 40)
        .map(x => ({ ...x.r, _kind: 'record' }));

      rows = [...cmdHits, ...recHits];
    }

    this._results = rows.slice(0, 60);
    this._active = 0;
    this._paint(q);
  },

  _paint(q) {
    const list = document.getElementById('cmdk-list');
    if (!list) return;

    if (this._results.length === 0) {
      list.innerHTML = `<div class="cmdk-empty">
        ${this._loading ? 'Loading records…' : `Nothing matches “${esc(q)}”`}
      </div>`;
      return;
    }

    let html = '', lastGroup = null;
    this._results.forEach((r, i) => {
      const group = r.group || (r._kind === 'record' ? r.kind : 'Actions');
      if (group !== lastGroup) { html += `<div class="cmdk-group">${esc(group)}</div>`; lastGroup = group; }

      const col = r._kind === 'record' ? avatarColor(r.title || '') : null;
      const ico = r._kind === 'command'
        ? `<span class="cmdk-ico">${(Icon[r.icon] || Icon.fileText)(15)}</span>`
        : `<span class="cmdk-ico" style="background:${col.bg};color:${col.text};font-size:11px;font-weight:700;">${esc(initials(r.title || '?'))}</span>`;

      html += `
        <button class="cmdk-item ${i === this._active ? 'active' : ''}" data-i="${i}" onclick="CommandPalette._run(${i})" onmouseenter="CommandPalette._hover(${i})">
          ${ico}
          <span class="cmdk-meta">
            <span class="cmdk-title">${esc(r.title)}</span>
            ${r.sub ? `<span class="cmdk-sub">${esc(r.sub)}</span>` : ''}
          </span>
          ${r.amount !== undefined && r.amount !== null ? `<span class="cmdk-amt">${formatCurrency(r.amount)}</span>` : ''}
        </button>`;
    });

    list.innerHTML = html;
  },

  _hover(i) {
    this._active = i;
    document.querySelectorAll('.cmdk-item').forEach(el => {
      el.classList.toggle('active', Number(el.dataset.i) === i);
    });
  },

  _move(by) {
    if (this._results.length === 0) return;
    this._active = (this._active + by + this._results.length) % this._results.length;
    this._paint();
    document.querySelector(`.cmdk-item[data-i="${this._active}"]`)?.scrollIntoView({ block: 'nearest' });
  },

  _run(i) {
    const r = this._results[i];
    if (!r) return;
    this.close();
    Router.navigate(r.route);
  },
};

window.CommandPalette = CommandPalette;
export default CommandPalette;
