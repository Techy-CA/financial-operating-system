/**
 * purchases.service.js — Vendor bills (the buy side)
 *
 * A bill is the mirror of an invoice: it books what is owed to a vendor, claims
 * the input tax credit, and brings goods *into* stock at the price actually
 * paid — which is what moves the moving-average cost. Receiving through a bill
 * rather than a manual stock-in is the difference between a valuation you can
 * trust and one you cannot.
 *
 * Stock sync mirrors invoices: it compares what the bill now says against what
 * has already been booked against it and posts only the difference, so editing
 * a bill never double-receives.
 */

import Store     from '../../core/store.js';
import DB        from '../../services/firestore.js';
import Inventory from '../inventory/inventory.service.js';
import { BILL_STATUS } from '../../utils/constants.js';

const COL_BILLS    = 'bills';
const COL_PAYOUTS  = 'billPayments';

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

/**
 * Bill totals. Purchase rates are quoted pre-tax in practice, so unlike the POS
 * cart there is no inclusive mode here — just line discount, then tax.
 */
export function calcBill(lines, opts = {}) {
  const interState = !!opts.interState;
  const groups = {};
  let subTotal = 0, taxableTotal = 0, taxTotal = 0, discountTotal = 0;

  const items = (lines || []).map((l, idx) => {
    const qty     = qRnd(l.qty);
    const rate    = mRnd(l.rate);
    const gstRate = num(l.gstRate);
    const disc    = num(l.discount);
    const gross   = qty * rate;
    const discAmt = gross * disc / 100;
    const lineNet = mRnd(gross - discAmt);
    const lineTax = mRnd(lineNet * gstRate / 100);

    subTotal      += gross;
    discountTotal += discAmt;
    taxableTotal  += lineNet;
    taxTotal      += lineTax;

    const g = groups[gstRate] || (groups[gstRate] = { rate: gstRate, taxable: 0, tax: 0 });
    g.taxable = mRnd(g.taxable + lineNet);
    g.tax     = mRnd(g.tax + lineTax);

    return {
      position:    idx,
      productId:   l.productId || null,
      description: l.description || l.name || '',
      hsn:         l.hsn || null,
      qty, unit: l.unit || 'Nos', rate,
      discount: disc, gstRate,
      lineNet, lineTax,
      lineTotal: mRnd(lineNet + lineTax),
    };
  });

  const beforeRound = mRnd(taxableTotal + taxTotal);
  const rounded     = opts.roundOff === false ? beforeRound : Math.round(beforeRound);

  return {
    items,
    subTotal:      mRnd(subTotal),
    discountTotal: mRnd(discountTotal),
    taxableTotal:  mRnd(taxableTotal),
    cgst: interState ? 0 : mRnd(taxTotal / 2),
    sgst: interState ? 0 : mRnd(taxTotal / 2),
    igst: interState ? mRnd(taxTotal) : 0,
    taxTotal:  mRnd(taxTotal),
    taxGroups: Object.values(groups).sort((a, b) => a.rate - b.rate),
    roundOff:  mRnd(rounded - beforeRound),
    grandTotal: mRnd(rounded),
    interState,
  };
}

const PurchaseService = {

  calcBill,

  waitForCompany(t) { return Inventory.waitForCompany(t); },

  // ── NUMBERING ────────────────────────────────────────────────────────────
  async nextBillNumber(prefix = 'BILL') {
    try {
      const f   = await sdk();
      const ref = f.doc(f.db, 'companies', companyId(), 'settings', 'bill_counter');
      let next = 1;
      await f.runTransaction(f.db, async (tx) => {
        const snap = await tx.get(ref);
        next = (snap.exists() ? num(snap.data().last) : 0) + 1;
        tx.set(ref, { last: next, updatedAt: f.serverTimestamp() }, { merge: true });
      });
      return `${prefix}-${String(next).padStart(4, '0')}`;
    } catch { return `${prefix}-${String(Date.now()).slice(-5)}`; }
  },

  // ── READ ─────────────────────────────────────────────────────────────────
  async list() {
    const rows = await DB.getAll(COL_BILLS, []).catch(() => []);
    return rows
      .map(b => this.decorate(b))
      .sort((a, b) => String(b.billDate || '').localeCompare(String(a.billDate || '')));
  },

  get(id) { return DB.getOne(COL_BILLS, id); },

  /** Overdue is derived, never stored — a stored flag goes stale overnight. */
  decorate(b) {
    const balance = mRnd(num(b.grandTotal) - num(b.paidAmount));
    let status = b.status || BILL_STATUS.RECEIVED;
    if (status !== BILL_STATUS.DRAFT && status !== BILL_STATUS.CANCELLED) {
      if (balance <= 0.5)                             status = BILL_STATUS.PAID;
      else if (num(b.paidAmount) > 0)                 status = BILL_STATUS.PARTIAL;
      else if (b.dueDate && new Date(b.dueDate) < new Date(new Date().toDateString())) status = BILL_STATUS.OVERDUE;
      else                                            status = BILL_STATUS.RECEIVED;
    }
    return { ...b, balanceDue: Math.max(0, balance), status };
  },

  stats(bills) {
    const live = (bills || []).filter(b => b.status !== BILL_STATUS.CANCELLED && b.status !== BILL_STATUS.DRAFT);
    return {
      count:      live.length,
      totalValue: mRnd(live.reduce((s, b) => s + num(b.grandTotal), 0)),
      payable:    mRnd(live.reduce((s, b) => s + num(b.balanceDue), 0)),
      overdue:    mRnd(live.filter(b => b.status === BILL_STATUS.OVERDUE).reduce((s, b) => s + num(b.balanceDue), 0)),
      itc:        mRnd(live.filter(b => b.itcEligible !== false).reduce((s, b) => s + num(b.taxTotal), 0)),
    };
  },

  // ── WRITE ────────────────────────────────────────────────────────────────
  async save(id, data, lines, opts = {}) {
    const totals = calcBill(lines, opts);
    const payload = {
      ...data,
      itemsSnapshot: totals.items,
      subTotal:      totals.subTotal,
      discountTotal: totals.discountTotal,
      taxableTotal:  totals.taxableTotal,
      cgst: totals.cgst, sgst: totals.sgst, igst: totals.igst,
      taxTotal:      totals.taxTotal,
      roundOff:      totals.roundOff,
      grandTotal:    totals.grandTotal,
      interState:    totals.interState,
      companyId:     companyId(),
    };

    let billId = id;
    if (id) {
      await DB.update(COL_BILLS, id, payload);
    } else {
      payload.billNumber = data.billNumber || await this.nextBillNumber(Store.get('company')?.billPrefix || 'BILL');
      payload.paidAmount = 0;
      billId = await DB.create(COL_BILLS, payload);
    }

    const saved = { id: billId, ...payload };
    const stock = await this.syncBillStock(saved).catch(e => ({ warnings: [e.message] }));
    return { id: billId, billNumber: payload.billNumber || data.billNumber, warnings: stock.warnings || [] };
  },

  /**
   * Brings the bill's goods into stock at the bill rate, posting only the delta
   * against what this bill already received. Drafts and cancelled bills receive
   * nothing, which also returns anything previously booked.
   */
  async syncBillStock(bill) {
    const billId = bill?.id;
    if (!billId) return { warnings: [] };

    const releaseAll = bill.status === BILL_STATUS.DRAFT || bill.status === BILL_STATUS.CANCELLED;
    const products   = await DB.getAll('products', []).catch(() => []);
    const tracked    = new Map(products.filter(p => p.trackInventory).map(p => [p.id, p]));

    // Target receipt per product, and the rate it came in at
    const target = {}, rates = {};
    if (!releaseAll) {
      for (const it of (bill.itemsSnapshot || [])) {
        if (!it.productId || !tracked.has(it.productId)) continue;
        target[it.productId] = qRnd(num(target[it.productId]) + num(it.qty));
        // Landed cost per unit — discount included, tax excluded (ITC is reclaimed)
        rates[it.productId]  = num(it.qty) > 0 ? mRnd(num(it.lineNet) / num(it.qty)) : num(it.rate);
      }
    }

    // netAppliedByProduct counts outward as positive; a bill is inward, so flip it
    const applied  = await Inventory.netAppliedByProduct('bill', billId);
    const received = {};
    for (const [pid, qty] of Object.entries(applied)) received[pid] = qRnd(-num(qty));

    const ids = new Set([...Object.keys(target), ...Object.keys(received)]);
    const warnings = [];

    for (const productId of ids) {
      const delta = qRnd(num(target[productId]) - num(received[productId]));
      if (delta === 0) continue;
      const product = tracked.get(productId) || products.find(p => p.id === productId);
      if (!product) continue;
      try {
        await Inventory.recordMovement({
          productId,
          type:   delta > 0 ? 'in' : 'out',
          qty:    Math.abs(delta),
          rate:   rates[productId],
          reason: delta > 0 ? 'purchase' : 'purchase_return',
          refType:   'bill',
          refId:     billId,
          refNumber: bill.billNumber || null,
          date:      bill.billDate || undefined,
          notes:     delta > 0 ? null : 'Bill revised — stock returned',
          warehouseId:   bill.warehouseId,
          warehouseName: bill.warehouseName,
          allowNegative: true,
        });
      } catch (e) {
        warnings.push(`${product.name}: ${e.message}`);
      }
    }
    return { warnings };
  },

  async delete(id) {
    const bill = await this.get(id).catch(() => null);
    if (bill) {
      // Take the goods back out before the document disappears
      await this.syncBillStock({ ...bill, id, status: BILL_STATUS.CANCELLED }).catch(() => {});
    }
    try {
      const pays = await DB.getAll(COL_PAYOUTS, [DB.where('billId', '==', id)]);
      for (const p of pays) await DB.delete(COL_PAYOUTS, p.id);
    } catch {}
    return DB.delete(COL_BILLS, id);
  },

  // ── PAYMENTS OUT ─────────────────────────────────────────────────────────
  paymentsFor(billId) {
    return DB.getAll(COL_PAYOUTS, [DB.where('billId', '==', billId)]).catch(() => []);
  },

  async recordPayment(bill, { amount, method, date, reference }) {
    const amt = mRnd(amount);
    if (amt <= 0) throw new Error('Enter an amount greater than zero');

    await DB.create(COL_PAYOUTS, {
      billId:     bill.id,
      billNumber: bill.billNumber || null,
      vendorId:   bill.vendorId || null,
      vendorName: bill.vendorName || null,
      amount:     amt,
      method:     method || 'bank_transfer',
      paymentDate: date || new Date().toISOString().split('T')[0],
      reference:  reference || null,
    });

    const paid    = mRnd(num(bill.paidAmount) + amt);
    const balance = mRnd(num(bill.grandTotal) - paid);
    await DB.update(COL_BILLS, bill.id, {
      paidAmount: paid,
      balanceDue: Math.max(0, balance),
      status:     balance <= 0.5 ? BILL_STATUS.PAID : BILL_STATUS.PARTIAL,
    });
    return { paid, balance: Math.max(0, balance) };
  },

  /** What is owed per vendor — feeds the payables view and the vendor khata. */
  async payablesByVendor() {
    const bills = await this.list();
    const map = {};
    for (const b of bills) {
      if (b.status === BILL_STATUS.CANCELLED || b.status === BILL_STATUS.DRAFT) continue;
      if (b.balanceDue <= 0.5) continue;
      const k = b.vendorId || b.vendorName || 'unknown';
      const e = map[k] || (map[k] = { vendorId: b.vendorId, vendorName: b.vendorName || 'Unknown vendor', outstanding: 0, bills: 0, oldest: null });
      e.outstanding = mRnd(e.outstanding + b.balanceDue);
      e.bills += 1;
      if (!e.oldest || String(b.billDate) < String(e.oldest)) e.oldest = b.billDate;
    }
    return Object.values(map).sort((a, b) => b.outstanding - a.outstanding);
  },
};

export default PurchaseService;
