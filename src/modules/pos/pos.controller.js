/**
 * pos.controller.js — The counter terminal
 *
 * Two panes: a catalogue grid on the left, the running bill on the right.
 * Built for speed at a till — the search box keeps focus so a barcode gun can
 * fire straight into it, and every action has a function key.
 *
 * F2 pay · F4 hold · F8 held bills · F9 customer · Esc clear · / focus search
 */

import Router from '../../core/router.js';
import Store  from '../../core/store.js';
import Toast  from '../../components/Toast.js';
import Icon   from '../../utils/icons.js';
import PosService, { calcCart } from './pos.service.js';
import { printReceipt } from './receipt.js';
import { formatCurrency, initials, avatarColor } from '../../utils/formatters.js';
import { POS_TENDERS } from '../../utils/constants.js';

const money = (v) => formatCurrency(v);
const esc   = (s) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const PosPage = {
  _cat: [], _customers: [], _lines: [], _customer: null, _register: null,
  _search: '', _category: 'all', _busy: false,
  _billDiscountType: 'percent', _billDiscountValue: 0,
  _tenders: [], _keyHandler: null,

  async init() {
    window.PosPage = this;
    Router.render(this._shell());
    this._bindKeys();

    if (!(await PosService.waitForCompany())) {
      document.getElementById('pos-grid').innerHTML = this._notice('No company selected', 'Set up your company in Settings before billing.');
      return;
    }

    try {
      const { default: DB } = await import('../../services/firestore.js');
      const [cat, customers, register] = await Promise.all([
        PosService.catalogue(),
        DB.getAll('customers', []).catch(() => []),
        PosService.getOpenRegister().catch(() => null),
      ]);
      this._cat       = cat;
      this._customers = customers;
      this._register  = register;
    } catch (e) {
      Toast.error('Could not load the catalogue: ' + e.message);
    }

    this._renderCategories();
    this._renderGrid();
    this._renderCart();
    this._renderRegisterChip();
    this._focusSearch();
  },

  /** Router swaps innerHTML on navigation, so the key listener must come off with it. */
  destroy() {
    if (this._keyHandler) document.removeEventListener('keydown', this._keyHandler, true);
    this._keyHandler = null;
  },

  // ── SHELL ────────────────────────────────────────────────────────────────
  _shell() {
    return `
    <div class="pos-shell">
      <!-- CATALOGUE -->
      <section class="pos-catalogue">
        <div class="pos-searchbar">
          <div class="pos-search-wrap">
            ${Icon.barcode(16)}
            <input id="pos-search" class="pos-search" type="text" autocomplete="off" spellcheck="false"
                   placeholder="Scan barcode or search item…  ( / )" />
          </div>
          <button class="btn btn-secondary btn-sm" onclick="PosPage.openHolds()" title="Held bills (F8)">
            ${Icon.clipboard(14)} <span id="pos-hold-count">Held</span>
          </button>
          <a href="#/pos/register" class="btn btn-secondary btn-sm" title="Register &amp; day close">
            ${Icon.wallet(14)} Register
          </a>
        </div>
        <div class="pos-categories" id="pos-categories"></div>
        <div class="pos-grid" id="pos-grid">
          <div style="grid-column:1/-1;padding:40px;text-align:center;"><div class="spinner-sm"></div></div>
        </div>
      </section>

      <!-- BILL -->
      <aside class="pos-bill">
        <div class="pos-bill-head">
          <button class="pos-customer-btn" onclick="PosPage.openCustomerPicker()" title="Choose customer (F9)">
            <span id="pos-cust-avatar" class="pos-cust-avatar">W</span>
            <span class="pos-cust-meta">
              <span id="pos-cust-name">Walk-in customer</span>
              <span id="pos-cust-sub" class="pos-cust-sub">Tap to attach a customer</span>
            </span>
          </button>
          <div id="pos-register-chip"></div>
        </div>

        <div class="pos-lines" id="pos-lines"></div>

        <div class="pos-summary" id="pos-summary"></div>

        <div class="pos-actions">
          <button class="btn btn-secondary" onclick="PosPage.clearCart()" title="Clear (Esc)">Clear</button>
          <button class="btn btn-secondary" onclick="PosPage.holdCart()" title="Hold (F4)">Hold</button>
          <button class="btn btn-primary pos-pay-btn" id="pos-pay" onclick="PosPage.openPayment()" title="Pay (F2)">
            Pay <span id="pos-pay-amt">₹0</span>
          </button>
        </div>
      </aside>
    </div>
    <div id="pos-modal"></div>`;
  },

  _notice(title, sub) {
    return `<div class="empty-state" style="grid-column:1/-1;"><div class="empty-state-icon">${Icon.alertCircle(24)}</div><h3>${esc(title)}</h3><p>${esc(sub)}</p></div>`;
  },

  // ── KEYBOARD ─────────────────────────────────────────────────────────────
  _bindKeys() {
    this.destroy();
    this._keyHandler = (e) => {
      // Leave the page and the listener goes with it
      if (!document.querySelector('.pos-shell')) { this.destroy(); return; }
      if (document.getElementById('pos-modal')?.innerHTML.trim()) {
        if (e.key === 'Escape') { e.preventDefault(); this.closeModal(); }
        return;                                   // a modal owns the keyboard
      }
      const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName);

      if (e.key === 'F2')      { e.preventDefault(); this.openPayment(); }
      else if (e.key === 'F4') { e.preventDefault(); this.holdCart(); }
      else if (e.key === 'F8') { e.preventDefault(); this.openHolds(); }
      else if (e.key === 'F9') { e.preventDefault(); this.openCustomerPicker(); }
      else if (e.key === 'Escape' && !typing) { e.preventDefault(); this.clearCart(); }
      else if (e.key === '/' && !typing)      { e.preventDefault(); this._focusSearch(); }
    };
    document.addEventListener('keydown', this._keyHandler, true);

    const box = document.getElementById('pos-search');
    box?.addEventListener('input', () => { this._search = box.value; this._renderGrid(); });
    // A barcode gun ends its burst with Enter — treat that as "add exactly this"
    box?.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      const code = box.value.trim();
      if (!code) return;
      const hit = PosService.findByCode(this._cat, code);
      if (hit) { this.add(hit.id); box.value = ''; this._search = ''; this._renderGrid(); }
      else {
        const matches = this._visible();
        if (matches.length === 1) { this.add(matches[0].id); box.value = ''; this._search = ''; this._renderGrid(); }
        else Toast.warning(`Nothing matches "${code}"`);
      }
    });
  },

  _focusSearch() {
    const el = document.getElementById('pos-search');
    el?.focus(); el?.select();
  },

  // ── CATALOGUE ────────────────────────────────────────────────────────────
  _renderCategories() {
    const el = document.getElementById('pos-categories');
    if (!el) return;
    const cats = [...new Set(this._cat.map(p => p.category).filter(Boolean))].sort();
    if (cats.length === 0) { el.innerHTML = ''; return; }
    el.innerHTML = ['all', ...cats].map(c => `
      <button class="pos-chip ${this._category === c ? 'active' : ''}" onclick="PosPage.setCategory('${esc(c)}')">
        ${c === 'all' ? 'All items' : esc(c)}
      </button>`).join('');
  },

  setCategory(c) { this._category = c; this._renderCategories(); this._renderGrid(); },

  _visible() {
    const q = this._search.toLowerCase().trim();
    return this._cat.filter(p => {
      if (this._category !== 'all' && p.category !== this._category) return false;
      if (!q) return true;
      return `${p.name} ${p.sku} ${p.barcode} ${p.category}`.toLowerCase().includes(q);
    });
  },

  _renderGrid() {
    const el = document.getElementById('pos-grid');
    if (!el) return;
    const list = this._visible();

    if (this._cat.length === 0) {
      el.innerHTML = this._notice('No products yet', 'Add products first — they show up here instantly.');
      return;
    }
    if (list.length === 0) {
      el.innerHTML = this._notice('No match', 'Try another code or clear the search.');
      return;
    }

    el.innerHTML = list.slice(0, 200).map(p => {
      const out  = p.trackInventory && p.stockQty <= 0;
      const low  = p.trackInventory && p.stockQty > 0 && p.stockStatus === 'low_stock';
      const col  = avatarColor(p.name);
      return `
      <button class="pos-tile ${out ? 'out' : ''}" onclick="PosPage.add('${p.id}')" title="${esc(p.name)}">
        <span class="pos-tile-badge" style="background:${col.bg};color:${col.text};">${esc(initials(p.name))}</span>
        <span class="pos-tile-name">${esc(p.name)}</span>
        <span class="pos-tile-foot">
          <span class="pos-tile-rate">${money(p.rate)}</span>
          ${p.trackInventory
            ? `<span class="pos-tile-stock ${out ? 'is-out' : low ? 'is-low' : ''}">${out ? 'Out' : p.stockQty + ' ' + esc(p.unit)}</span>`
            : ''}
        </span>
      </button>`;
    }).join('');
  },

  // ── CART ─────────────────────────────────────────────────────────────────
  add(productId) {
    const p = this._cat.find(x => x.id === productId);
    if (!p) return;
    const existing = this._lines.find(l => l.productId === productId);
    if (existing) existing.qty = Math.round((existing.qty + 1) * 1000) / 1000;
    else this._lines.push({
      productId: p.id, name: p.name, hsn: p.hsn, unit: p.unit,
      qty: 1, rate: p.rate, discount: 0, gstRate: p.gstRate,
      priceIncludesTax: p.priceIncludesTax, trackInventory: p.trackInventory, stockQty: p.stockQty,
    });
    this._renderCart();
  },

  setQty(i, v) {
    const line = this._lines[i];
    if (!line) return;
    const q = parseFloat(v);
    if (isNaN(q) || q <= 0) { this.removeLine(i); return; }
    line.qty = Math.round(q * 1000) / 1000;
    this._renderCart();
  },

  bump(i, by) {
    const line = this._lines[i];
    if (!line) return;
    const next = Math.round((line.qty + by) * 1000) / 1000;
    if (next <= 0) { this.removeLine(i); return; }
    line.qty = next;
    this._renderCart();
  },

  setRate(i, v)  { if (this._lines[i]) { this._lines[i].rate     = Math.max(0, parseFloat(v) || 0); this._renderCart(); } },
  setDisc(i, v)  { if (this._lines[i]) { this._lines[i].discount = Math.min(100, Math.max(0, parseFloat(v) || 0)); this._renderCart(); } },
  removeLine(i)  { this._lines.splice(i, 1); this._renderCart(); },

  clearCart() {
    if (this._lines.length === 0) return;
    if (!confirm('Clear this bill?')) return;
    this._lines = []; this._customer = null;
    this._billDiscountValue = 0;
    this._renderCart();
    this._focusSearch();
  },

  setBillDiscount(type, value) {
    this._billDiscountType  = type;
    this._billDiscountValue = Math.max(0, parseFloat(value) || 0);
    this._renderCart();
  },

  _totals() {
    return calcCart(this._lines, {
      billDiscountType:  this._billDiscountType,
      billDiscountValue: this._billDiscountValue,
      roundOff:   true,
      interState: this._isInterState(),
    });
  },

  /** Place of supply outside the company's own state makes the sale IGST. */
  _isInterState() {
    const co = Store.get('company');
    return !!(this._customer?.state && co?.state && this._customer.state !== co.state);
  },

  _renderCart() {
    const linesEl = document.getElementById('pos-lines');
    const sumEl   = document.getElementById('pos-summary');
    if (!linesEl || !sumEl) return;

    const t = this._totals();

    if (this._lines.length === 0) {
      linesEl.innerHTML = `
        <div class="pos-empty">
          <div class="pos-empty-icon">${Icon.inbox(30)}</div>
          <p>Scan or tap an item to start</p>
          <span class="pos-empty-hint">F2 pay · F4 hold · F8 held bills · / search</span>
        </div>`;
    } else {
      linesEl.innerHTML = t.items.map((l, i) => {
        const short = l.trackInventory && l.qty > (l.stockQty ?? 0);
        return `
        <div class="pos-line">
          <div class="pos-line-top">
            <span class="pos-line-name">${esc(l.name)}</span>
            <button class="pos-line-x" onclick="PosPage.removeLine(${i})" title="Remove">${Icon.x(12)}</button>
          </div>
          <div class="pos-line-mid">
            <div class="pos-stepper">
              <button onclick="PosPage.bump(${i},-1)" aria-label="Less">−</button>
              <input type="number" step="any" value="${l.qty}" onchange="PosPage.setQty(${i},this.value)" onfocus="this.select()" />
              <button onclick="PosPage.bump(${i},1)" aria-label="More">+</button>
            </div>
            <span class="pos-line-x-sym">×</span>
            <input class="pos-line-rate" type="number" step="0.01" value="${l.rate}" onchange="PosPage.setRate(${i},this.value)" onfocus="this.select()" title="Rate" />
            <input class="pos-line-disc" type="number" step="1" value="${l.lineDisc || 0}" onchange="PosPage.setDisc(${i},this.value)" onfocus="this.select()" title="Discount %" placeholder="0" />
            <span class="pos-line-amt">${money(l.lineTotal)}</span>
          </div>
          ${short ? `<div class="pos-line-warn">${Icon.alertTriangle(11)} Only ${l.stockQty} ${esc(l.unit || '')} in stock</div>` : ''}
        </div>`;
      }).join('');
      linesEl.scrollTop = linesEl.scrollHeight;
    }

    const discRow = `
      <div class="pos-sum-row pos-disc-row">
        <span>Bill discount</span>
        <span class="pos-disc-controls">
          <input type="number" step="0.01" min="0" value="${this._billDiscountValue || ''}" placeholder="0"
                 onchange="PosPage.setBillDiscount('${this._billDiscountType}',this.value)" />
          <button class="${this._billDiscountType === 'percent' ? 'active' : ''}" onclick="PosPage.setBillDiscount('percent',${this._billDiscountValue || 0})">%</button>
          <button class="${this._billDiscountType === 'amount'  ? 'active' : ''}" onclick="PosPage.setBillDiscount('amount',${this._billDiscountValue || 0})">₹</button>
        </span>
      </div>`;

    sumEl.innerHTML = `
      <div class="pos-sum-row"><span>Subtotal (${t.totalQty} qty)</span><span>${money(t.subTotal)}</span></div>
      ${t.lineDiscount > 0 ? `<div class="pos-sum-row pos-neg"><span>Item discounts</span><span>−${money(t.lineDiscount)}</span></div>` : ''}
      ${discRow}
      ${t.taxTotal > 0 ? (t.interState
        ? `<div class="pos-sum-row"><span>IGST</span><span>${money(t.igst)}</span></div>`
        : `<div class="pos-sum-row"><span>CGST</span><span>${money(t.cgst)}</span></div>
           <div class="pos-sum-row"><span>SGST</span><span>${money(t.sgst)}</span></div>`) : ''}
      ${Math.abs(t.roundOff) >= 0.01 ? `<div class="pos-sum-row"><span>Round off</span><span>${t.roundOff > 0 ? '+' : ''}${money(t.roundOff)}</span></div>` : ''}
      <div class="pos-sum-total"><span>Total</span><span>${money(t.grandTotal)}</span></div>`;

    const payAmt = document.getElementById('pos-pay-amt');
    if (payAmt) payAmt.textContent = money(t.grandTotal);
    const payBtn = document.getElementById('pos-pay');
    if (payBtn) payBtn.disabled = this._lines.length === 0;

    const holdCount = PosService.listHolds().length;
    const holdEl = document.getElementById('pos-hold-count');
    if (holdEl) holdEl.textContent = holdCount ? `Held (${holdCount})` : 'Held';

    this._renderCustomerChip();
  },

  _renderCustomerChip() {
    const c = this._customer;
    const nameEl = document.getElementById('pos-cust-name');
    const subEl  = document.getElementById('pos-cust-sub');
    const avEl   = document.getElementById('pos-cust-avatar');
    if (!nameEl) return;
    nameEl.textContent = c?.name || 'Walk-in customer';
    subEl.textContent  = c ? (c.phone || c.gstin || 'Attached') : 'Tap to attach a customer';
    if (avEl) {
      avEl.textContent = c ? initials(c.name) : 'W';
      const col = avatarColor(c?.name || 'Walk in');
      avEl.style.background = col.bg; avEl.style.color = col.text;
    }
  },

  _renderRegisterChip() {
    const el = document.getElementById('pos-register-chip');
    if (!el) return;
    el.innerHTML = this._register
      ? `<a href="#/pos/register" class="pos-reg-chip open" title="Shift open — click for day close">${Icon.checkCircle(12)} Shift open</a>`
      : `<a href="#/pos/register" class="pos-reg-chip shut" title="No shift open — sales will not be tallied">${Icon.alertTriangle(12)} No shift</a>`;
  },

  // ── MODALS ───────────────────────────────────────────────────────────────
  closeModal() { const m = document.getElementById('pos-modal'); if (m) m.innerHTML = ''; this._focusSearch(); },

  _modal(title, body, width = 460) {
    const m = document.getElementById('pos-modal');
    if (!m) return;
    m.innerHTML = `
      <div class="modal-overlay" onclick="if(event.target===this)PosPage.closeModal()" style="z-index:400;">
        <div class="modal" style="max-width:${width}px;width:100%;">
          <div class="modal-header">
            <h3 style="margin:0;font-size:15px;font-weight:700;">${esc(title)}</h3>
            <button class="modal-close" onclick="PosPage.closeModal()">${Icon.x(15)}</button>
          </div>
          ${body}
        </div>
      </div>`;
  },

  // ── CUSTOMER ─────────────────────────────────────────────────────────────
  openCustomerPicker() {
    const rows = this._customers.map(c => `
      <button class="pos-pick-row" onclick="PosPage.pickCustomer('${c.id}')">
        <span class="pos-pick-av" style="background:${avatarColor(c.name || '').bg};color:${avatarColor(c.name || '').text};">${esc(initials(c.name || '?'))}</span>
        <span class="pos-pick-meta">
          <strong>${esc(c.name || 'Unnamed')}</strong>
          <span>${esc(c.phone || c.gstin || c.email || '—')}</span>
        </span>
      </button>`).join('');

    this._modal('Attach customer', `
      <div class="modal-body" style="padding:12px 14px;">
        <input id="pos-cust-search" class="input" placeholder="Search name or phone…" autocomplete="off" style="margin-bottom:10px;" />
        <button class="pos-pick-row" onclick="PosPage.pickCustomer('')">
          <span class="pos-pick-av" style="background:#F1F3F7;color:#4A5568;">W</span>
          <span class="pos-pick-meta"><strong>Walk-in customer</strong><span>No customer record</span></span>
        </button>
        <div id="pos-cust-rows" style="max-height:320px;overflow-y:auto;">${rows || '<p class="pos-muted" style="padding:14px;">No customers yet.</p>'}</div>
      </div>`);

    const box = document.getElementById('pos-cust-search');
    box?.focus();
    box?.addEventListener('input', () => {
      const q = box.value.toLowerCase().trim();
      const list = this._customers.filter(c => `${c.name} ${c.phone} ${c.gstin} ${c.email}`.toLowerCase().includes(q));
      document.getElementById('pos-cust-rows').innerHTML = list.map(c => `
        <button class="pos-pick-row" onclick="PosPage.pickCustomer('${c.id}')">
          <span class="pos-pick-av" style="background:${avatarColor(c.name || '').bg};color:${avatarColor(c.name || '').text};">${esc(initials(c.name || '?'))}</span>
          <span class="pos-pick-meta"><strong>${esc(c.name || 'Unnamed')}</strong><span>${esc(c.phone || c.gstin || '—')}</span></span>
        </button>`).join('') || '<p class="pos-muted" style="padding:14px;">No match.</p>';
    });
  },

  pickCustomer(id) {
    this._customer = id ? (this._customers.find(c => c.id === id) || null) : null;
    this.closeModal();
    this._renderCart();
  },

  // ── HELD BILLS ───────────────────────────────────────────────────────────
  openHolds() {
    const holds = PosService.listHolds();
    const body = holds.length === 0
      ? `<div class="modal-body"><p class="pos-muted" style="padding:20px;text-align:center;">No held bills.</p></div>`
      : `<div class="modal-body" style="padding:10px 14px;max-height:400px;overflow-y:auto;">
          ${holds.map(h => `
            <div class="pos-hold-row">
              <div>
                <strong>${esc(h.label)}</strong>
                <span class="pos-muted">${h.count} item${h.count === 1 ? '' : 's'} · ${money(h.total)}</span>
                <span class="pos-muted">${new Date(h.at).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}</span>
              </div>
              <div style="display:flex;gap:6px;">
                <button class="btn btn-primary btn-sm" onclick="PosPage.resume('${h.id}')">Resume</button>
                <button class="btn btn-ghost btn-icon btn-sm" style="color:var(--color-danger);" onclick="PosPage.dropHold('${h.id}')">${Icon.trash(13)}</button>
              </div>
            </div>`).join('')}
        </div>`;
    this._modal('Held bills', body, 500);
  },

  holdCart() {
    if (this._lines.length === 0) { Toast.warning('Nothing to hold'); return; }
    PosService.hold({
      lines: this._lines, customer: this._customer,
      billDiscountType: this._billDiscountType, billDiscountValue: this._billDiscountValue,
    });
    this._lines = []; this._customer = null; this._billDiscountValue = 0;
    this._renderCart();
    Toast.success('Bill held — press F8 to bring it back');
    this._focusSearch();
  },

  resume(id) {
    if (this._lines.length > 0 && !confirm('The current bill will be replaced. Continue?')) return;
    const h = PosService.resumeHold(id);
    if (!h) return;
    this._lines            = h.cart.lines || [];
    this._customer         = h.cart.customer || null;
    this._billDiscountType = h.cart.billDiscountType || 'percent';
    this._billDiscountValue= h.cart.billDiscountValue || 0;
    this.closeModal();
    this._renderCart();
  },

  dropHold(id) { PosService.dropHold(id); this.openHolds(); this._renderCart(); },

  // ── PAYMENT ──────────────────────────────────────────────────────────────
  openPayment() {
    if (this._lines.length === 0) { Toast.warning('Cart is empty'); return; }
    const t = this._totals();
    // Default to the whole amount in cash — the common case, one keystroke to done
    this._tenders = [{ method: 'cash', amount: t.grandTotal, reference: '' }];

    this._modal('Take payment', `
      <div class="modal-body pos-pay-body">
        <div class="pos-pay-due">
          <span>Amount due</span>
          <strong id="pos-due">${money(t.grandTotal)}</strong>
        </div>

        <div class="pos-quick-cash" id="pos-quick-cash"></div>

        <div id="pos-tenders"></div>

        <button class="pos-add-tender" onclick="PosPage.addTender()">${Icon.creditCard(13)} Split into another method</button>

        <div class="pos-pay-status" id="pos-pay-status"></div>

        <label class="pos-print-toggle">
          <input type="checkbox" id="pos-print" checked /> Print receipt after saving
        </label>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="PosPage.closeModal()">Cancel</button>
        <button class="btn btn-primary" id="pos-confirm" onclick="PosPage.confirmPayment()">Complete sale</button>
      </div>`, 480);

    this._renderTenders();
    this._renderQuickCash(t.grandTotal);
  },

  /** Notes a cashier is most likely to be handed for this total. */
  _renderQuickCash(due) {
    const el = document.getElementById('pos-quick-cash');
    if (!el) return;
    const set = new Set([Math.ceil(due)]);
    for (const step of [10, 50, 100, 500]) set.add(Math.ceil(due / step) * step);
    for (const note of [100, 200, 500, 2000]) if (note >= due) set.add(note);
    const options = [...set].filter(v => v >= due).sort((a, b) => a - b).slice(0, 5);
    el.innerHTML = options.map(v =>
      `<button class="pos-cash-chip" onclick="PosPage.setTenderAmount(0,${v})">${money(v)}</button>`
    ).join('');
  },

  addTender() {
    const t   = this._totals();
    const got = this._tenders.reduce((s, x) => s + (parseFloat(x.amount) || 0), 0);
    this._tenders.push({ method: 'upi', amount: Math.max(0, Math.round((t.grandTotal - got) * 100) / 100), reference: '' });
    this._renderTenders();
  },

  removeTender(i) { this._tenders.splice(i, 1); this._renderTenders(); },
  setTenderMethod(i, m) { if (this._tenders[i]) { this._tenders[i].method = m; this._renderTenders(); } },
  setTenderAmount(i, v) { if (this._tenders[i]) { this._tenders[i].amount = parseFloat(v) || 0; this._renderTenders(); } },
  setTenderRef(i, v)    { if (this._tenders[i]) this._tenders[i].reference = v; },

  _renderTenders() {
    const el = document.getElementById('pos-tenders');
    if (!el) return;
    el.innerHTML = this._tenders.map((tn, i) => `
      <div class="pos-tender">
        <div class="pos-tender-methods">
          ${POS_TENDERS.map(m => `
            <button class="pos-tender-btn ${tn.method === m.id ? 'active' : ''}" onclick="PosPage.setTenderMethod(${i},'${m.id}')">${esc(m.label)}</button>
          `).join('')}
        </div>
        <div class="pos-tender-row">
          <input class="input pos-tender-amt" type="number" step="0.01" value="${tn.amount}"
                 onchange="PosPage.setTenderAmount(${i},this.value)" onfocus="this.select()" />
          ${tn.method !== 'cash' ? `<input class="input pos-tender-ref" placeholder="Ref / UTR (optional)" value="${esc(tn.reference || '')}" onchange="PosPage.setTenderRef(${i},this.value)" />` : ''}
          ${this._tenders.length > 1 ? `<button class="btn btn-ghost btn-icon btn-sm" style="color:var(--color-danger);" onclick="PosPage.removeTender(${i})">${Icon.x(13)}</button>` : ''}
        </div>
      </div>`).join('');
    this._renderPayStatus();
  },

  _renderPayStatus() {
    const el = document.getElementById('pos-pay-status');
    if (!el) return;
    const t    = this._totals();
    const paid = this._tenders.reduce((s, x) => s + (parseFloat(x.amount) || 0), 0);
    const diff = Math.round((paid - t.grandTotal) * 100) / 100;
    const credit = this._tenders.some(x => x.method === 'credit');

    if (diff > 0.009) {
      el.className = 'pos-pay-status is-change';
      el.innerHTML = `<span>Change to return</span><strong>${money(diff)}</strong>`;
    } else if (diff < -0.009) {
      el.className = 'pos-pay-status is-short';
      el.innerHTML = `<span>${credit ? 'Goes to khata' : 'Still due'}</span><strong>${money(Math.abs(diff))}</strong>`;
    } else {
      el.className = 'pos-pay-status is-exact';
      el.innerHTML = `<span>Exact payment</span><strong>${Icon.check(14)}</strong>`;
    }
  },

  async confirmPayment() {
    if (this._busy) return;
    const btn = document.getElementById('pos-confirm');
    const t   = this._totals();

    // "Credit" is a promise to pay, not cash in the drawer — drop it from the
    // tender list so the balance lands on the customer's account instead.
    const payments = this._tenders
      .filter(x => x.method !== 'credit' && (parseFloat(x.amount) || 0) > 0)
      .map(x => ({ method: x.method, amount: Math.min(parseFloat(x.amount) || 0, t.grandTotal), reference: x.reference }));

    const paid    = payments.reduce((s, x) => s + x.amount, 0);
    const balance = Math.round((t.grandTotal - paid) * 100) / 100;

    if (balance > 0.5 && !this._customer) {
      Toast.error('An unpaid balance needs a customer — attach one (F9) or take full payment.');
      return;
    }

    this._busy = true;
    if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }

    try {
      const sale = await PosService.checkout({
        lines: this._lines,
        customer: this._customer,
        payments,
        billDiscountType:  this._billDiscountType,
        billDiscountValue: this._billDiscountValue,
        roundOff: true,
        interState: this._isInterState(),
        registerId: this._register?.id || null,
      });

      const wantsPrint = document.getElementById('pos-print')?.checked;
      this.closeModal();

      // Reset for the next customer before anything slow happens
      this._lines = []; this._customer = null; this._billDiscountValue = 0; this._tenders = [];
      this._renderCart();
      this._focusSearch();

      if (wantsPrint) printReceipt(sale, Store.get('company') || {}, { paper: '80mm' });

      (sale.warnings || []).forEach(w => Toast.warning(w));

      if (sale.offline) {
        Toast.warning(`${sale.invoiceNumber} · ${money(sale.totals.grandTotal)} saved on this device — stock and register update when the line returns`, { duration: 7000 });
      } else {
        Toast.success(`${sale.invoiceNumber} · ${money(sale.totals.grandTotal)} saved`, {
          action: { label: 'Open bill', onClick: () => { location.hash = `#/invoices/${sale.id}`; } },
        });
      }

      // Refresh stock counts on the tiles so the next sale sees the truth
      PosService.catalogue().then(c => { this._cat = c; this._renderGrid(); }).catch(() => {});
      if (this._register) PosService.getRegister(this._register.id).then(r => { if (r) this._register = { id: this._register.id, ...r }; }).catch(() => {});

    } catch (e) {
      Toast.error('Sale failed: ' + e.message);
      if (btn) { btn.disabled = false; btn.textContent = 'Complete sale'; }
    } finally {
      this._busy = false;
    }
  },
};

export default PosPage;
