/**
 * pos.service.js — Counter engine
 *
 * A POS sale is a real invoice. Checkout writes to `invoices` / `invoiceItems`
 * exactly like the invoice form does, so counter sales flow into GST returns,
 * reports, customer ledgers and the stock ledger with no separate reconciliation.
 * What POS adds on top is the register session (`registers`): the shift that
 * groups a day's takings so the drawer can be counted and signed off.
 *
 * Cart maths lives in calcCart() and is shared by the terminal, the receipt and
 * the checkout write, so the printed total can never disagree with the saved one.
 */

import Store     from '../../core/store.js';
import DB        from '../../services/firestore.js';
import Inventory from '../inventory/inventory.service.js';
import { POS_TENDER_MAP, REGISTER_STATUS } from '../../utils/constants.js';

const COL_REGISTERS = 'registers';
const COL_INVOICES  = 'invoices';
const COL_ITEMS     = 'invoiceItems';
const COL_PAYMENTS  = 'payments';

const HOLD_KEY = 'finos_pos_holds';

const num  = (v) => { const n = parseFloat(v); return isNaN(n) ? 0 : n; };
const mRnd = (v) => Math.round(num(v) * 100) / 100;
const qRnd = (v) => Math.round(num(v) * 1000) / 1000;

async function sdk() {
  const m = await import('https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js');
  return { ...m, db: window.fbDB };
}

function companyId() {
  const cid = Store.get('companyId');
  if (!cid) throw new Error('No company selected. Go to Settings to set up your company.');
  return cid;
}

function today() { return new Date().toISOString().split('T')[0]; }

/**
 * Cart totals.
 *
 * Retail counters usually quote MRP (tax already inside the price tag) while
 * B2B desks quote pre-tax rates, so every line carries its own inclusive flag
 * and the two can be mixed in one bill.
 *
 * Order of operations per line: line discount, then bill-level discount spread
 * pro-rata across lines, then tax on what is left. Spreading before tax is what
 * keeps the GST split correct when a whole-bill discount is given.
 */
export function calcCart(lines, opts = {}) {
  const billDiscType  = opts.billDiscountType === 'amount' ? 'amount' : 'percent';
  const billDiscValue = num(opts.billDiscountValue);
  const roundOffOn    = opts.roundOff !== false;
  const interState    = !!opts.interState;

  // Pass 1 — per-line net after the line's own discount, tax stripped out if inclusive
  const rows = (lines || []).map(l => {
    const qty      = qRnd(l.qty);
    const rate     = mRnd(l.rate);
    const gstRate  = num(l.gstRate);
    const lineDisc = num(l.discount);          // percent
    const gross    = qty * rate;
    const afterDisc= gross - (gross * lineDisc / 100);
    // Inclusive prices carry tax inside the tag — strip it to reach the taxable value
    const taxable  = l.priceIncludesTax ? afterDisc / (1 + gstRate / 100) : afterDisc;
    return { ...l, qty, rate, gstRate, lineDisc, gross, taxable };
  });

  const subTotal = rows.reduce((s, r) => s + r.taxable, 0);

  // Pass 2 — spread the bill discount across lines in proportion to their value
  const billDiscount = billDiscType === 'amount'
    ? Math.min(num(billDiscValue), subTotal)
    : subTotal * (Math.min(num(billDiscValue), 100) / 100);

  const taxGroups = {};
  let taxableTotal = 0, taxTotal = 0;

  const items = rows.map(r => {
    const share    = subTotal > 0 ? (r.taxable / subTotal) : 0;
    const lineNet  = mRnd(r.taxable - (billDiscount * share));
    const lineTax  = mRnd(lineNet * r.gstRate / 100);
    taxableTotal  += lineNet;
    taxTotal      += lineTax;

    const g = taxGroups[r.gstRate] || (taxGroups[r.gstRate] = { rate: r.gstRate, taxable: 0, tax: 0 });
    g.taxable = mRnd(g.taxable + lineNet);
    g.tax     = mRnd(g.tax + lineTax);

    return {
      ...r,
      lineNet,
      lineTax,
      lineTotal: mRnd(lineNet + lineTax),
      // What the customer sees on the shelf/receipt line
      displayAmount: mRnd(r.gross - (r.gross * r.lineDisc / 100)),
    };
  });

  taxableTotal = mRnd(taxableTotal);
  taxTotal     = mRnd(taxTotal);

  const beforeRound = mRnd(taxableTotal + taxTotal);
  const rounded     = roundOffOn ? Math.round(beforeRound) : beforeRound;
  const roundOff    = mRnd(rounded - beforeRound);

  return {
    items,
    lineCount:    items.length,
    totalQty:     qRnd(items.reduce((s, i) => s + i.qty, 0)),
    subTotal:     mRnd(subTotal),
    billDiscount: mRnd(billDiscount),
    lineDiscount: mRnd(rows.reduce((s, r) => s + (r.gross * r.lineDisc / 100), 0)),
    taxableTotal,
    taxTotal,
    cgst:      interState ? 0 : mRnd(taxTotal / 2),
    sgst:      interState ? 0 : mRnd(taxTotal / 2),
    igst:      interState ? taxTotal : 0,
    interState,
    taxGroups: Object.values(taxGroups).sort((a, b) => a.rate - b.rate),
    roundOff,
    grandTotal: mRnd(rounded),
  };
}

const PosService = {

  calcCart,

  async waitForCompany(timeout = 5000) {
    return Inventory.waitForCompany(timeout);
  },

  // ── CATALOGUE ────────────────────────────────────────────────────────────
  /**
   * Sellable products for the tile grid. Tracked items carry their live stock
   * so the counter can see what is running out without opening Inventory.
   */
  async catalogue() {
    const products = await DB.getAll('products', []).catch(() => []);
    return products
      .filter(p => p.isActive !== false)
      .map(p => {
        const d = Inventory.decorate(p);
        return {
          id:       p.id,
          name:     p.name || 'Unnamed',
          sku:      p.sku || '',
          barcode:  p.barcode || p.sku || '',
          hsn:      p.hsn || '',
          unit:     p.unit || 'Nos',
          rate:     mRnd(p.rate ?? p.sellingPrice ?? 0),
          gstRate:  num(p.gstRate),
          category: p.category || '',
          priceIncludesTax: p.priceIncludesTax === true,
          trackInventory:   p.trackInventory === true,
          stockQty:   d.stockQty,
          stockStatus:d.stockStatus,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  },

  /** Barcode/SKU lookup — exact match first, then a loose contains search. */
  findByCode(catalogue, code) {
    const q = (code || '').trim().toLowerCase();
    if (!q) return null;
    return catalogue.find(p => (p.barcode || '').toLowerCase() === q)
        || catalogue.find(p => (p.sku || '').toLowerCase() === q)
        || catalogue.find(p => (p.name || '').toLowerCase() === q)
        || null;
  },

  // ── REGISTER SESSIONS ────────────────────────────────────────────────────
  /** The shift this user is currently ringing sales into, if any. */
  async getOpenRegister() {
    const rows = await DB.getAll(COL_REGISTERS, [DB.where('status', '==', REGISTER_STATUS.OPEN)]).catch(() => []);
    const uid  = Store.get('user')?.uid;
    // Prefer this user's own shift; fall back to any open one so a handover works
    return rows.find(r => r.openedBy === uid) || rows[0] || null;
  },

  async listRegisters(limit = 60) {
    const rows = await DB.getAll(COL_REGISTERS, []).catch(() => []);
    return rows
      .sort((a, b) => (b.openedAt?.toMillis?.() || 0) - (a.openedAt?.toMillis?.() || 0))
      .slice(0, limit);
  },

  getRegister(id) { return DB.getOne(COL_REGISTERS, id); },

  async openRegister({ openingCash = 0, notes = '', counterName = 'Counter 1' } = {}) {
    const existing = await this.getOpenRegister();
    if (existing) throw new Error('A register shift is already open. Close it before starting a new one.');
    const user = Store.get('user');
    const id = await DB.create(COL_REGISTERS, {
      status:       REGISTER_STATUS.OPEN,
      counterName,
      openingCash:  mRnd(openingCash),
      openDate:     today(),
      openedBy:     user?.uid || null,
      openedByName: user?.displayName || user?.email?.split('@')[0] || 'User',
      openNotes:    notes || null,
      saleCount:    0,
      salesTotal:   0,
      tenderTotals: {},
      refundTotal:  0,
    });
    return { id, ...(await this.getRegister(id)) };
  },

  /**
   * Adds a finished sale to the running shift totals. Kept in a transaction so
   * two terminals sharing one shift cannot clobber each other's tallies.
   */
  async _postToRegister(registerId, { grandTotal, payments, isRefund = false }) {
    if (!registerId) return;
    const f    = await sdk();
    const ref  = f.doc(f.db, 'companies', companyId(), COL_REGISTERS, registerId);
    await f.runTransaction(f.db, async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists()) return;
      const r       = snap.data();
      const totals  = { ...(r.tenderTotals || {}) };
      for (const p of (payments || [])) {
        totals[p.method] = mRnd(num(totals[p.method]) + num(p.amount));
      }
      tx.update(ref, {
        saleCount:    num(r.saleCount) + (isRefund ? 0 : 1),
        salesTotal:   mRnd(num(r.salesTotal) + num(grandTotal)),
        refundTotal:  mRnd(num(r.refundTotal) + (isRefund ? Math.abs(num(grandTotal)) : 0)),
        tenderTotals: totals,
        updatedAt:    f.serverTimestamp(),
      });
    });
  },

  /**
   * What the drawer should hold: opening float plus every tender flagged as
   * cash, minus cash refunds and any pay-outs recorded during the shift.
   */
  expectedCash(register) {
    if (!register) return 0;
    const totals = register.tenderTotals || {};
    let cash = num(register.openingCash);
    for (const [method, amount] of Object.entries(totals)) {
      if (POS_TENDER_MAP[method]?.countsAsCash) cash += num(amount);
    }
    return mRnd(cash - num(register.cashOut) - num(register.cashRefunds));
  },

  async closeRegister(id, { countedCash = 0, notes = '' } = {}) {
    const reg = await this.getRegister(id);
    if (!reg) throw new Error('Register shift not found');
    if (reg.status === REGISTER_STATUS.CLOSED) throw new Error('This shift is already closed');

    const user     = Store.get('user');
    const expected = this.expectedCash(reg);
    const counted  = mRnd(countedCash);
    const variance = mRnd(counted - expected);

    await DB.update(COL_REGISTERS, id, {
      status:        REGISTER_STATUS.CLOSED,
      closeDate:     today(),
      closedBy:      user?.uid || null,
      closedByName:  user?.displayName || user?.email?.split('@')[0] || 'User',
      expectedCash:  expected,
      countedCash:   counted,
      variance,
      closeNotes:    notes || null,
    });
    return { ...reg, id, status: REGISTER_STATUS.CLOSED, expectedCash: expected, countedCash: counted, variance };
  },

  /** Money taken out of the drawer mid-shift (bank drop, petty expense). */
  async recordCashOut(registerId, amount, reason) {
    const f   = await sdk();
    const ref = f.doc(f.db, 'companies', companyId(), COL_REGISTERS, registerId);
    await f.runTransaction(f.db, async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists()) throw new Error('Register shift not found');
      const r = snap.data();
      tx.update(ref, {
        cashOut:     mRnd(num(r.cashOut) + num(amount)),
        cashOutLog:  [...(r.cashOutLog || []), { amount: mRnd(amount), reason: reason || 'Cash out', at: new Date().toISOString() }],
        updatedAt:   f.serverTimestamp(),
      });
    });
  },

  /** Every sale rung into one shift — the backing detail for the Z-report. */
  async registerSales(registerId) {
    const rows = await DB.getAll(COL_INVOICES, [DB.where('registerId', '==', registerId)]).catch(() => []);
    return rows.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
  },

  /** Z-report figures: tender mix, tax collected and top movers for one shift. */
  async zReport(registerId) {
    const [reg, sales] = await Promise.all([this.getRegister(registerId), this.registerSales(registerId)]);
    if (!reg) throw new Error('Register shift not found');

    const byProduct = {};
    let taxTotal = 0, netTotal = 0, discountTotal = 0;
    for (const s of sales) {
      taxTotal      += num(s.taxTotal);
      netTotal      += num(s.taxableTotal);
      discountTotal += num(s.discountTotal);
      for (const it of (s.itemsSnapshot || [])) {
        const k = it.productId || it.description;
        const e = byProduct[k] || (byProduct[k] = { name: it.description, qty: 0, value: 0 });
        e.qty   = qRnd(e.qty + num(it.qty));
        e.value = mRnd(e.value + num(it.lineTotal));
      }
    }

    return {
      register:  reg,
      sales,
      saleCount: sales.length,
      grossTotal: mRnd(sales.reduce((s, x) => s + num(x.grandTotal), 0)),
      netTotal:   mRnd(netTotal),
      taxTotal:   mRnd(taxTotal),
      discountTotal: mRnd(discountTotal),
      tenderTotals:  reg.tenderTotals || {},
      expectedCash:  this.expectedCash(reg),
      topItems: Object.values(byProduct).sort((a, b) => b.value - a.value).slice(0, 10),
    };
  },

  // ── BILL NUMBERING ───────────────────────────────────────────────────────
  /**
   * Counter bills get their own series so they never collide with INV-####.
   *
   * The counter is transactional, which needs a server — offline it falls
   * straight through to a local sequence carrying an OFF marker, so two
   * terminals can never mint the same number. The transaction is also raced
   * against a timeout: a flaky connection that is technically "online" must not
   * stall the till.
   */
  async nextBillNumber(prefix = 'POS') {
    const Offline = (await import('../../core/offline.js')).default;
    if (!Offline.isOnline()) return Offline.localNumber(prefix);

    try {
      const f   = await sdk();
      const ref = f.doc(f.db, 'companies', companyId(), 'settings', 'pos_counter');
      let next = 1;

      const txn = f.runTransaction(f.db, async (tx) => {
        const snap = await tx.get(ref);
        next = (snap.exists() ? num(snap.data().last) : 0) + 1;
        tx.set(ref, { last: next, updatedAt: f.serverTimestamp() }, { merge: true });
      });

      await Promise.race([
        txn,
        new Promise((_, reject) => setTimeout(() => reject(new Error('counter timeout')), 4000)),
      ]);

      return `${prefix}-${String(next).padStart(4, '0')}`;
    } catch (e) {
      return Offline.localNumber(prefix);
    }
  },

  // ── CHECKOUT ─────────────────────────────────────────────────────────────
  /**
   * Turns a cart into a paid invoice.
   *
   * Writes in an order that fails safe: the invoice first (so nothing is
   * charged without a document), then items, payments and stock. Stock uses the
   * shared inventory transaction, so a counter sale and an office invoice
   * deduct identically.
   */
  async checkout({
    lines, customer, payments = [], billDiscountType, billDiscountValue,
    roundOff = true, interState = false, notes = '', registerId = null, prefix = 'POS',
  }) {
    if (!lines || lines.length === 0) throw new Error('Cart is empty');

    const totals = calcCart(lines, { billDiscountType, billDiscountValue, roundOff, interState });
    const paid   = mRnd((payments || []).reduce((s, p) => s + num(p.amount), 0));
    const balance= mRnd(totals.grandTotal - paid);

    if (balance > 0.5 && !customer?.id) {
      throw new Error('An unpaid balance needs a named customer — pick one or take full payment.');
    }

    const company = Store.get('company');
    const billNo  = await this.nextBillNumber(company?.posPrefix || prefix);
    const date    = today();

    // Snapshot lines onto the invoice so receipts and the Z-report never need a
    // second read of invoiceItems.
    const itemsSnapshot = totals.items.map((i, idx) => ({
      position:    idx,
      productId:   i.productId || null,
      description: i.name || i.description || '',
      hsn:         i.hsn || null,
      qty:         i.qty,
      unit:        i.unit || 'Nos',
      rate:        i.rate,
      discount:    i.lineDisc,
      gstRate:     i.gstRate,
      lineNet:     i.lineNet,
      lineTax:     i.lineTax,
      lineTotal:   i.lineTotal,
    }));

    const status = balance <= 0.5 ? 'paid' : paid > 0 ? 'partial' : 'sent';

    const Offline = (await import('../../core/offline.js')).default;
    const online  = Offline.isOnline();

    const { id: invoiceId } = await DB.createLocal(COL_INVOICES, {
      invoiceNumber: billNo,
      invoiceType:   'tax_invoice',
      source:        'pos',
      registerId:    registerId || null,
      status,
      invoiceDate:   date,
      dueDate:       date,
      customerId:    customer?.id   || null,
      customerName:  customer?.name || 'Walk-in customer',
      customerPhone: customer?.phone || null,
      customerGstin: customer?.gstin || null,
      placeOfSupply: customer?.state || company?.state || null,
      itemsSnapshot,
      subTotal:      totals.subTotal,
      discountTotal: mRnd(totals.billDiscount + totals.lineDiscount),
      billDiscount:  totals.billDiscount,
      taxableTotal:  totals.taxableTotal,
      cgst:          totals.cgst,
      sgst:          totals.sgst,
      igst:          totals.igst,
      taxTotal:      totals.taxTotal,
      roundOff:      totals.roundOff,
      grandTotal:    totals.grandTotal,
      paidAmount:    paid,
      balanceDue:    Math.max(0, balance),
      notes:         notes || null,
      companyId:     companyId(),
    });

    // Line items — same collection the invoice module reads, so a POS bill opens
    // in the normal invoice detail view.
    for (const it of itemsSnapshot) {
      await DB.createLocal(COL_ITEMS, { ...it, invoiceId }).catch(() => {});
    }

    // Payments
    for (const p of payments) {
      if (num(p.amount) <= 0) continue;
      await DB.createLocal(COL_PAYMENTS, {
        invoiceId,
        amount:      mRnd(p.amount),
        method:      p.method,
        paymentDate: date,
        reference:   p.reference || null,
        customerId:  customer?.id || null,
        customerName:customer?.name || 'Walk-in customer',
        source:      'pos',
        registerId:  registerId || null,
      }).catch(() => {});
    }

    // Stock and register tallies both read-then-write, so they need a
    // transaction and a live server. Offline they are queued and replayed in
    // order on reconnect — the stock engine posts only the unbooked difference,
    // so a replayed task can never double-deduct.
    const invoice   = { id: invoiceId, status, invoiceNumber: billNo, invoiceDate: date };
    const stockItems= itemsSnapshot.map(i => ({ productId: i.productId, qty: i.qty }));
    let warnings = [], queued = false;

    if (online) {
      try {
        const res = await Inventory.syncInvoiceStock(invoice, stockItems);
        warnings = res.warnings || [];
      } catch (e) {
        Offline.push('stockSync', { invoice, items: stockItems });
        queued = true;
      }
      await this._postToRegister(registerId, { grandTotal: totals.grandTotal, payments })
        .catch(() => Offline.push('registerPost', { registerId, grandTotal: totals.grandTotal, payments }));
    } else {
      Offline.push('stockSync',   { invoice, items: stockItems });
      if (registerId) Offline.push('registerPost', { registerId, grandTotal: totals.grandTotal, payments });
      queued = true;
    }

    return {
      id: invoiceId, invoiceNumber: billNo, date, status,
      totals, payments, paid, balance: Math.max(0, balance),
      customer: customer || { name: 'Walk-in customer' },
      itemsSnapshot, warnings, queued, offline: !online,
    };
  },

  // ── HELD BILLS ───────────────────────────────────────────────────────────
  // Parked carts stay on the device: a held bill is not a business document and
  // must survive a dropped connection, so localStorage is the right home.
  listHolds() {
    try { return JSON.parse(localStorage.getItem(HOLD_KEY) || '[]'); }
    catch { return []; }
  },

  hold(cart) {
    const holds = this.listHolds();
    const entry = {
      id:    'H' + Date.now().toString(36).toUpperCase(),
      at:    new Date().toISOString(),
      label: cart.customer?.name || 'Walk-in',
      count: (cart.lines || []).length,
      total: calcCart(cart.lines || [], cart).grandTotal,
      cart,
    };
    holds.unshift(entry);
    localStorage.setItem(HOLD_KEY, JSON.stringify(holds.slice(0, 30)));
    return entry;
  },

  resumeHold(id) {
    const holds = this.listHolds();
    const found = holds.find(h => h.id === id) || null;
    if (found) localStorage.setItem(HOLD_KEY, JSON.stringify(holds.filter(h => h.id !== id)));
    return found;
  },

  dropHold(id) {
    localStorage.setItem(HOLD_KEY, JSON.stringify(this.listHolds().filter(h => h.id !== id)));
  },
};

export default PosService;
