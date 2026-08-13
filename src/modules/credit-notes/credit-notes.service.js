/**
 * credit-notes.service.js — Sales returns and credit notes
 *
 * A credit note reverses part or all of an invoice: it reduces what the
 * customer owes, reverses the GST that was charged, and — when the goods
 * actually came back — puts them into stock.
 *
 * Restocking is driven by the reason, not by a checkbox nobody reads: a return
 * puts goods back, a rate revision does not.
 */

import Store     from '../../core/store.js';
import DB        from '../../services/firestore.js';
import Inventory from '../inventory/inventory.service.js';
import { CREDIT_NOTE_REASON_MAP } from '../../utils/constants.js';

const COL_NOTES = 'creditNotes';

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

/** Same shape as an invoice's totals so the printed note matches the invoice. */
export function calcNote(lines, opts = {}) {
  const interState = !!opts.interState;
  let taxable = 0, tax = 0;
  const groups = {};

  const items = (lines || []).map((l, idx) => {
    const qty     = qRnd(l.qty);
    const rate    = mRnd(l.rate);
    const gstRate = num(l.gstRate);
    const lineNet = mRnd(qty * rate);
    const lineTax = mRnd(lineNet * gstRate / 100);
    taxable += lineNet; tax += lineTax;

    const g = groups[gstRate] || (groups[gstRate] = { rate: gstRate, taxable: 0, tax: 0 });
    g.taxable = mRnd(g.taxable + lineNet);
    g.tax     = mRnd(g.tax + lineTax);

    return {
      position: idx,
      productId: l.productId || null,
      description: l.description || '',
      hsn: l.hsn || null,
      qty, unit: l.unit || 'Nos', rate, gstRate,
      lineNet, lineTax, lineTotal: mRnd(lineNet + lineTax),
    };
  });

  taxable = mRnd(taxable); tax = mRnd(tax);
  return {
    items,
    taxableTotal: taxable,
    cgst: interState ? 0 : mRnd(tax / 2),
    sgst: interState ? 0 : mRnd(tax / 2),
    igst: interState ? tax : 0,
    taxTotal: tax,
    taxGroups: Object.values(groups).sort((a, b) => a.rate - b.rate),
    grandTotal: mRnd(taxable + tax),
    interState,
  };
}

const CreditNoteService = {

  calcNote,

  waitForCompany(t) { return Inventory.waitForCompany(t); },

  async nextNumber(prefix = 'CN') {
    try {
      const f   = await sdk();
      const ref = f.doc(f.db, 'companies', companyId(), 'settings', 'credit_note_counter');
      let next = 1;
      await f.runTransaction(f.db, async (tx) => {
        const snap = await tx.get(ref);
        next = (snap.exists() ? num(snap.data().last) : 0) + 1;
        tx.set(ref, { last: next, updatedAt: f.serverTimestamp() }, { merge: true });
      });
      return `${prefix}-${String(next).padStart(4, '0')}`;
    } catch { return `${prefix}-${String(Date.now()).slice(-5)}`; }
  },

  async list() {
    const rows = await DB.getAll(COL_NOTES, []).catch(() => []);
    return rows.sort((a, b) => String(b.noteDate || '').localeCompare(String(a.noteDate || '')));
  },

  get(id) { return DB.getOne(COL_NOTES, id); },

  stats(notes) {
    const live = (notes || []).filter(n => n.status !== 'cancelled');
    return {
      count: live.length,
      total: mRnd(live.reduce((s, n) => s + num(n.grandTotal), 0)),
      taxReversed: mRnd(live.reduce((s, n) => s + num(n.taxTotal), 0)),
      thisMonth: mRnd(live
        .filter(n => String(n.noteDate || '').startsWith(new Date().toISOString().slice(0, 7)))
        .reduce((s, n) => s + num(n.grandTotal), 0)),
    };
  },

  /** Invoices that can still be credited, newest first. */
  async creditableInvoices() {
    const rows = await DB.getAll('invoices', []).catch(() => []);
    return rows
      .filter(i => i.status !== 'draft' && i.status !== 'cancelled')
      .sort((a, b) => String(b.invoiceDate || '').localeCompare(String(a.invoiceDate || '')));
  },

  /** How much of each invoice line has already been credited. */
  async alreadyCredited(invoiceId) {
    const notes = await DB.getAll(COL_NOTES, [DB.where('invoiceId', '==', invoiceId)]).catch(() => []);
    const map = {};
    for (const n of notes) {
      if (n.status === 'cancelled') continue;
      for (const it of (n.itemsSnapshot || [])) {
        const k = it.productId || it.description;
        map[k] = qRnd(num(map[k]) + num(it.qty));
      }
    }
    return map;
  },

  /**
   * Issues the note. Restocks first when the reason calls for it, so a failure
   * to write stock surfaces before the customer's balance is changed.
   */
  async issue({ invoice, customer, lines, reason, noteDate, notes, interState, refund = false }) {
    if (!lines || lines.length === 0) throw new Error('Add at least one line to credit');

    const totals = calcNote(lines, { interState });
    const number = await this.nextNumber(Store.get('company')?.creditNotePrefix || 'CN');
    const date   = noteDate || new Date().toISOString().split('T')[0];
    const restock = CREDIT_NOTE_REASON_MAP[reason]?.restock === true;

    const noteId = await DB.create(COL_NOTES, {
      noteNumber:   number,
      noteDate:     date,
      invoiceId:    invoice?.id || null,
      invoiceNumber:invoice?.invoiceNumber || null,
      customerId:   customer?.id || null,
      customerName: customer?.name || invoice?.customerName || 'Customer',
      customerGstin:customer?.gstin || invoice?.customerGstin || null,
      reason,
      restocked:    restock,
      itemsSnapshot: totals.items,
      taxableTotal: totals.taxableTotal,
      cgst: totals.cgst, sgst: totals.sgst, igst: totals.igst,
      taxTotal:   totals.taxTotal,
      grandTotal: totals.grandTotal,
      interState: totals.interState,
      status:     refund ? 'refunded' : 'issued',
      notes:      notes || null,
      companyId:  companyId(),
    });

    const warnings = [];

    // Goods back into stock
    if (restock) {
      for (const it of totals.items) {
        if (!it.productId) continue;
        try {
          await Inventory.recordMovement({
            productId: it.productId,
            type: 'in',
            qty:  it.qty,
            reason: 'sale_return',
            refType: 'credit_note',
            refId: noteId,
            refNumber: number,
            date,
            notes: `Return against ${invoice?.invoiceNumber || 'sale'}`,
          });
        } catch (e) {
          warnings.push(`${it.description}: ${e.message}`);
        }
      }
    }

    // Reduce what the customer owes on the original invoice
    if (invoice?.id && !refund) {
      try {
        const fresh   = await DB.getOne('invoices', invoice.id);
        const credited= mRnd(num(fresh?.creditedAmount) + totals.grandTotal);
        const balance = Math.max(0, mRnd(num(fresh?.grandTotal) - num(fresh?.paidAmount) - credited));
        await DB.update('invoices', invoice.id, {
          creditedAmount: credited,
          balanceDue:     balance,
          status:         balance <= 0.5 ? 'paid' : fresh?.status,
        });
      } catch (e) {
        warnings.push(`Invoice balance not updated: ${e.message}`);
      }
    }

    return { id: noteId, noteNumber: number, totals, warnings };
  },

  async delete(id) {
    const note = await this.get(id).catch(() => null);
    if (note?.restocked) {
      // Take the returned goods back out
      for (const it of (note.itemsSnapshot || [])) {
        if (!it.productId) continue;
        await Inventory.recordMovement({
          productId: it.productId, type: 'out', qty: it.qty,
          reason: 'sale', refType: 'credit_note', refId: id,
          refNumber: note.noteNumber, notes: 'Credit note deleted',
          allowNegative: true,
        }).catch(() => {});
      }
    }
    if (note?.invoiceId) {
      const fresh = await DB.getOne('invoices', note.invoiceId).catch(() => null);
      if (fresh) {
        const credited = Math.max(0, mRnd(num(fresh.creditedAmount) - num(note.grandTotal)));
        await DB.update('invoices', note.invoiceId, {
          creditedAmount: credited,
          balanceDue: Math.max(0, mRnd(num(fresh.grandTotal) - num(fresh.paidAmount) - credited)),
        }).catch(() => {});
      }
    }
    return DB.delete(COL_NOTES, id);
  },
};

export default CreditNoteService;
