/**
 * khata.service.js — Running party ledger (udhaar book)
 *
 * The khata is a *view*, not a second set of books. It merges what already
 * exists — invoices, payments, bills, vendor payments — with any plain cash
 * entries recorded directly against a party, and runs a balance down the list.
 * That way the udhaar figure can never disagree with the accounting figure.
 *
 * Sign convention throughout: a positive balance means the party owes us.
 */

import Store from '../../core/store.js';
import DB    from '../../services/firestore.js';

const COL_ENTRIES = 'khataEntries';

const num  = (v) => { const n = parseFloat(v); return isNaN(n) ? 0 : n; };
const mRnd = (v) => Math.round(num(v) * 100) / 100;

function companyId() {
  const cid = Store.get('companyId');
  if (!cid) throw new Error('No company selected. Go to Settings to set up your company.');
  return cid;
}

const dateOf = (r) => r.date || r.invoiceDate || r.billDate || r.paymentDate || '';

const KhataService = {

  async waitForCompany(timeout = 5000) {
    const step = 150;
    for (let waited = 0; waited < timeout; waited += step) {
      if (Store.get('companyId')) return true;
      await new Promise(r => setTimeout(r, step));
    }
    return !!Store.get('companyId');
  },

  // ── MANUAL ENTRIES ───────────────────────────────────────────────────────
  /**
   * A cash transaction with no document behind it — the "you gave / you got"
   * pair that Khatabook is built on.
   * type 'gave' increases what they owe; 'got' reduces it.
   */
  addEntry({ partyType, partyId, partyName, type, amount, date, notes }) {
    return DB.create(COL_ENTRIES, {
      partyType, partyId, partyName,
      type,
      amount:  mRnd(amount),
      date:    date || new Date().toISOString().split('T')[0],
      notes:   notes || null,
      companyId: companyId(),
    });
  },

  deleteEntry(id) { return DB.delete(COL_ENTRIES, id); },

  listEntries(partyId = null) {
    return DB.getAll(COL_ENTRIES, []).catch(() => [])
      .then(rows => partyId ? rows.filter(r => r.partyId === partyId) : rows);
  },

  // ── PARTY LIST ───────────────────────────────────────────────────────────
  /**
   * Every customer and vendor with their net balance, sorted by who owes most.
   * One pass over each source collection — no per-party queries.
   */
  async parties() {
    const [customers, vendors, invoices, payments, bills, billPayments, entries] = await Promise.all([
      DB.getAll('customers', []).catch(() => []),
      DB.getAll('vendors', []).catch(() => []),
      DB.getAll('invoices', []).catch(() => []),
      DB.getAll('payments', []).catch(() => []),
      DB.getAll('bills', []).catch(() => []),
      DB.getAll('billPayments', []).catch(() => []),
      this.listEntries(),
    ]);

    const map = {};
    const seed = (type, p) => {
      const key = `${type}:${p.id}`;
      map[key] = {
        key, partyType: type, partyId: p.id,
        name: p.name || 'Unnamed',
        phone: p.phone || p.mobile || null,
        gstin: p.gstin || null,
        balance: 0, lastDate: null, txnCount: 0,
      };
      return map[key];
    };

    customers.forEach(c => seed('customer', c));
    vendors.forEach(v   => seed('vendor',   v));

    const touch = (key, amount, date) => {
      const e = map[key];
      if (!e) return;
      e.balance = mRnd(e.balance + amount);
      e.txnCount += 1;
      if (date && (!e.lastDate || String(date) > String(e.lastDate))) e.lastDate = date;
    };

    // Sales raise what the customer owes; receipts bring it down
    for (const inv of invoices) {
      if (!inv.customerId || inv.status === 'draft' || inv.status === 'cancelled') continue;
      touch(`customer:${inv.customerId}`, num(inv.grandTotal), dateOf(inv));
    }
    for (const p of payments) {
      if (!p.customerId) continue;
      touch(`customer:${p.customerId}`, -num(p.amount), dateOf(p));
    }

    // Purchases raise what we owe the vendor — negative from our side
    for (const b of bills) {
      if (!b.vendorId || b.status === 'draft' || b.status === 'cancelled') continue;
      touch(`vendor:${b.vendorId}`, -num(b.grandTotal), dateOf(b));
    }
    for (const p of billPayments) {
      if (!p.vendorId) continue;
      touch(`vendor:${p.vendorId}`, num(p.amount), dateOf(p));
    }

    // Plain cash entries
    for (const e of entries) {
      const key = `${e.partyType}:${e.partyId}`;
      touch(key, e.type === 'gave' ? num(e.amount) : -num(e.amount), dateOf(e));
    }

    return Object.values(map)
      .map(p => ({ ...p, balance: mRnd(p.balance) }))
      .sort((a, b) => Math.abs(b.balance) - Math.abs(a.balance));
  },

  /** Headline numbers for the khata page. */
  totals(parties) {
    const toGet  = parties.filter(p => p.balance >  0.5);
    const toGive = parties.filter(p => p.balance < -0.5);
    return {
      toGet:      mRnd(toGet.reduce((s, p) => s + p.balance, 0)),
      toGive:     mRnd(Math.abs(toGive.reduce((s, p) => s + p.balance, 0))),
      getCount:   toGet.length,
      giveCount:  toGive.length,
      net:        mRnd(parties.reduce((s, p) => s + p.balance, 0)),
    };
  },

  // ── STATEMENT ────────────────────────────────────────────────────────────
  /**
   * Full transaction history for one party with a running balance, oldest
   * first, so the closing figure at the bottom is the amount to chase.
   */
  async statement(partyType, partyId) {
    const isCustomer = partyType === 'customer';
    const [party, invoices, payments, bills, billPayments, entries] = await Promise.all([
      DB.getOne(isCustomer ? 'customers' : 'vendors', partyId).catch(() => null),
      isCustomer ? DB.getAll('invoices', [DB.where('customerId', '==', partyId)]).catch(() => []) : Promise.resolve([]),
      isCustomer ? DB.getAll('payments', [DB.where('customerId', '==', partyId)]).catch(() => []) : Promise.resolve([]),
      !isCustomer ? DB.getAll('bills', [DB.where('vendorId', '==', partyId)]).catch(() => []) : Promise.resolve([]),
      !isCustomer ? DB.getAll('billPayments', [DB.where('vendorId', '==', partyId)]).catch(() => []) : Promise.resolve([]),
      this.listEntries(partyId),
    ]);

    const rows = [];

    for (const inv of invoices) {
      if (inv.status === 'draft' || inv.status === 'cancelled') continue;
      rows.push({
        date: dateOf(inv), kind: 'invoice',
        label: `Invoice ${inv.invoiceNumber || ''}`.trim(),
        sub: `${(inv.itemsSnapshot || []).length || ''} items`.trim(),
        debit: num(inv.grandTotal), credit: 0,
        link: `#/invoices/${inv.id}`,
      });
    }
    for (const p of payments) {
      rows.push({
        date: dateOf(p), kind: 'receipt',
        label: 'Payment received',
        sub: p.method || '', debit: 0, credit: num(p.amount),
        link: p.invoiceId ? `#/invoices/${p.invoiceId}` : null,
      });
    }
    for (const b of bills) {
      if (b.status === 'draft' || b.status === 'cancelled') continue;
      rows.push({
        date: dateOf(b), kind: 'bill',
        label: `Bill ${b.billNumber || ''}`.trim(),
        sub: b.vendorBillNumber || '', debit: 0, credit: num(b.grandTotal),
        link: `#/purchases/${b.id}/edit`,
      });
    }
    for (const p of billPayments) {
      rows.push({
        date: dateOf(p), kind: 'payout',
        label: 'Payment made', sub: p.method || '',
        debit: num(p.amount), credit: 0, link: null,
      });
    }
    for (const e of entries) {
      rows.push({
        date: dateOf(e), kind: 'cash', entryId: e.id,
        label: e.type === 'gave' ? 'You gave' : 'You got',
        sub: e.notes || '',
        debit:  e.type === 'gave' ? num(e.amount) : 0,
        credit: e.type === 'got'  ? num(e.amount) : 0,
        link: null,
      });
    }

    rows.sort((a, b) => String(a.date).localeCompare(String(b.date)));

    let running = 0;
    for (const r of rows) {
      running = mRnd(running + r.debit - r.credit);
      r.balance = running;
    }

    return {
      party: party ? { id: partyId, partyType, ...party } : { id: partyId, partyType, name: 'Unknown party' },
      rows,
      balance: running,
      totalDebit:  mRnd(rows.reduce((s, r) => s + r.debit, 0)),
      totalCredit: mRnd(rows.reduce((s, r) => s + r.credit, 0)),
    };
  },

  // ── REMINDERS ────────────────────────────────────────────────────────────
  /** Builds the WhatsApp text. Kept here so the wording stays consistent. */
  reminderText(party, balance, companyName) {
    const amt = `₹${Math.abs(balance).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    if (balance > 0) {
      return [
        `Hello ${party.name},`, ``,
        `This is a gentle reminder from *${companyName || 'us'}*.`,
        `An amount of *${amt}* is outstanding on your account.`,
        ``,
        `Kindly arrange the payment at your earliest convenience.`,
        `If you have already paid, please ignore this message.`,
        ``, `Thank you!`,
      ].join('\n');
    }
    return [
      `Hello ${party.name},`, ``,
      `As per our records, *${companyName || 'we'}* owe you *${amt}*.`,
      `We will settle this shortly.`,
      ``, `Thank you!`,
    ].join('\n');
  },

  /** wa.me needs a country code; Indian mobiles are stored as 10 digits. */
  whatsappLink(phone, text) {
    const digits = String(phone || '').replace(/\D/g, '');
    if (!digits) return null;
    const to = digits.length === 10 ? '91' + digits : digits;
    return `https://wa.me/${to}?text=${encodeURIComponent(text)}`;
  },
};

export default KhataService;
