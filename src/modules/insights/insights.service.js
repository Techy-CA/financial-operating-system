/**
 * insights.service.js — Derived signals
 *
 * Everything here is computed from history the business already generated;
 * nothing is configured or guessed. Three families of signal:
 *
 *   1. Payment behaviour — how long each customer actually takes to pay, and
 *      what that predicts about the money currently outstanding.
 *   2. Stock velocity    — consumption rate per item, and the date it runs out.
 *   3. Anomalies         — this month's spending against its own trailing mean.
 *
 * The scoring is intentionally transparent rather than clever: every number a
 * user sees can be traced back to the transactions that produced it, because an
 * unexplainable score in an accounting tool is worse than none at all.
 */

import DB from '../../services/firestore.js';

const num  = (v) => { const n = parseFloat(v); return isNaN(n) ? 0 : n; };
const r2   = (v) => Math.round(num(v) * 100) / 100;
const DAY  = 86400000;

const dateOf = (v) => {
  if (!v) return null;
  const d = v?.toDate ? v.toDate() : new Date(v);
  return isNaN(d.getTime()) ? null : d;
};
const daysBetween = (a, b) => Math.round((b - a) / DAY);

const InsightsService = {

  async load() {
    const [invoices, payments, products, movements, expenses, customers] = await Promise.all([
      DB.getAll('invoices', []).catch(() => []),
      DB.getAll('payments', []).catch(() => []),
      DB.getAll('products', []).catch(() => []),
      DB.getAll('stockMovements', []).catch(() => []),
      DB.getAll('expenses', []).catch(() => []),
      DB.getAll('customers', []).catch(() => []),
    ]);
    return { invoices, payments, products, movements, expenses, customers };
  },

  // ── PAYMENT BEHAVIOUR ────────────────────────────────────────────────────
  /**
   * Scores each customer on how they have actually paid, not on a credit limit
   * someone typed in once.
   *
   * The score blends three observable things: the mean delay between invoice
   * date and payment date, the share of invoices that went past due, and how
   * long the oldest unpaid invoice has been sitting. Customers with too little
   * history are reported as such rather than scored — a single late payment is
   * not a pattern.
   */
  paymentRisk({ invoices, payments, customers }) {
    const paidByInvoice = {};
    for (const p of payments) {
      if (!p.invoiceId) continue;
      const d = dateOf(p.paymentDate) || dateOf(p.createdAt);
      const e = paidByInvoice[p.invoiceId] || (paidByInvoice[p.invoiceId] = { amount: 0, last: null });
      e.amount = r2(e.amount + num(p.amount));
      if (d && (!e.last || d > e.last)) e.last = d;
    }

    const byCustomer = {};
    const now = new Date();

    for (const inv of invoices) {
      if (!inv.customerId || inv.status === 'draft' || inv.status === 'cancelled') continue;
      const c = byCustomer[inv.customerId] || (byCustomer[inv.customerId] = {
        customerId: inv.customerId, name: inv.customerName || 'Customer',
        settled: 0, delays: [], lateCount: 0, outstanding: 0, oldestUnpaidDays: 0,
        billed: 0, invoiceCount: 0,
      });

      c.invoiceCount++;
      c.billed = r2(c.billed + num(inv.grandTotal));

      const invDate = dateOf(inv.invoiceDate) || dateOf(inv.createdAt);
      const dueDate = dateOf(inv.dueDate) || invDate;
      const rec     = paidByInvoice[inv.id];
      const balance = num(inv.balanceDue);

      if (balance <= 0.5 && rec?.last && invDate) {
        // Settled — record how long it actually took
        c.settled++;
        c.delays.push(Math.max(0, daysBetween(invDate, rec.last)));
        if (dueDate && rec.last > dueDate) c.lateCount++;
      } else if (balance > 0.5) {
        c.outstanding = r2(c.outstanding + balance);
        if (dueDate) {
          const overdue = daysBetween(dueDate, now);
          if (overdue > c.oldestUnpaidDays) c.oldestUnpaidDays = overdue;
        }
      }
    }

    const nameById = Object.fromEntries(customers.map(c => [c.id, c.name]));

    return Object.values(byCustomer).map(c => {
      const avgDelay = c.delays.length ? Math.round(c.delays.reduce((s, d) => s + d, 0) / c.delays.length) : null;
      const lateRate = c.settled ? c.lateCount / c.settled : 0;

      // Three transparent components, each capped, then weighted
      const delayScore = avgDelay === null ? 0 : Math.min(100, (avgDelay / 60) * 100);
      const lateScore  = lateRate * 100;
      const agingScore = Math.min(100, (Math.max(0, c.oldestUnpaidDays) / 90) * 100);

      const score = Math.round(
        (c.delays.length >= 2 ? delayScore * 0.35 + lateScore * 0.30 : 0) +
        agingScore * (c.delays.length >= 2 ? 0.35 : 1.0)
      );

      const band = score >= 60 ? 'high' : score >= 30 ? 'medium' : 'low';
      const thin = c.delays.length < 2;

      return {
        ...c,
        name: nameById[c.customerId] || c.name,
        avgDelay, lateRate: Math.round(lateRate * 100),
        score: Math.min(100, score), band, thin,
        // The money actually at stake, weighted by how likely it is to slip
        exposure: r2(c.outstanding * (Math.min(100, score) / 100)),
      };
    }).sort((a, b) => b.exposure - a.exposure || b.outstanding - a.outstanding);
  },

  /** Portfolio view: how long the business waits to be paid, on average. */
  collectionHealth(risks, invoices) {
    const withHistory = risks.filter(r => r.avgDelay !== null);
    const avgDelay = withHistory.length
      ? Math.round(withHistory.reduce((s, r) => s + r.avgDelay, 0) / withHistory.length)
      : null;
    const outstanding = r2(risks.reduce((s, r) => s + r.outstanding, 0));
    const atRisk      = r2(risks.filter(r => r.band === 'high').reduce((s, r) => s + r.outstanding, 0));
    return {
      avgDelay, outstanding, atRisk,
      atRiskPct: outstanding > 0 ? Math.round((atRisk / outstanding) * 100) : 0,
      customers: risks.length,
    };
  },

  // ── STOCK VELOCITY ───────────────────────────────────────────────────────
  /**
   * Consumption rate from the movement ledger, and the day stock hits zero.
   *
   * Only outward sale movements count — damage and internal use are excluded so
   * a one-off write-off does not inflate the forecast. The window is the span
   * of real sales history available, capped at 90 days, so a young catalogue
   * still produces a usable rate instead of dividing by a fixed 90.
   */
  stockForecast({ products, movements }, windowDays = 90) {
    const now = new Date();
    const cutoff = new Date(now.getTime() - windowDays * DAY);

    const sales = {};
    for (const m of movements) {
      if (m.type !== 'out') continue;
      if (m.reason !== 'sale') continue;
      const d = dateOf(m.date) || dateOf(m.createdAt);
      if (!d || d < cutoff) continue;
      const e = sales[m.productId] || (sales[m.productId] = { qty: 0, first: d, last: d });
      e.qty  = r2(e.qty + num(m.qty));
      if (d < e.first) e.first = d;
      if (d > e.last)  e.last  = d;
    }

    return products
      .filter(p => p.trackInventory === true)
      .map(p => {
        const s    = sales[p.id];
        const qty  = num(p.stockQty);
        const span = s ? Math.max(1, daysBetween(s.first, now)) : 0;
        const perDay = s && span > 0 ? s.qty / span : 0;
        const daysLeft = perDay > 0 ? Math.floor(qty / perDay) : null;
        const runsOut  = daysLeft === null ? null : new Date(now.getTime() + daysLeft * DAY);

        let urgency = 'ok';
        if (qty <= 0)                       urgency = 'out';
        else if (daysLeft !== null && daysLeft <= 7)  urgency = 'critical';
        else if (daysLeft !== null && daysLeft <= 21) urgency = 'soon';
        else if (num(p.reorderLevel) > 0 && qty <= num(p.reorderLevel)) urgency = 'soon';

        return {
          id: p.id, name: p.name || 'Item', sku: p.sku || '', unit: p.unit || 'Nos',
          stockQty: qty, reorderLevel: num(p.reorderLevel),
          soldInWindow: s ? s.qty : 0, perDay: Math.round(perDay * 100) / 100,
          daysLeft, runsOut, urgency,
          // Order enough to cover the lead time plus a month of demand
          suggestedOrder: perDay > 0 ? Math.max(0, Math.ceil(perDay * 30 - qty)) : 0,
          value: r2(qty * num(p.avgCost)),
        };
      })
      .sort((a, b) => {
        const rank = { out: 0, critical: 1, soon: 2, ok: 3 };
        return rank[a.urgency] - rank[b.urgency] || (a.daysLeft ?? 9999) - (b.daysLeft ?? 9999);
      });
  },

  // ── SPEND ANOMALIES ──────────────────────────────────────────────────────
  /**
   * Flags a category whose spend this month is far above its own trailing mean.
   *
   * Uses a z-score over the previous months of that same category, which keeps
   * the comparison self-relative — a category that is always large does not get
   * flagged simply for being large. At least three prior months are needed
   * before anything is called unusual.
   */
  spendAnomalies({ expenses }, { minMonths = 3, z = 1.6 } = {}) {
    const byCat = {};
    for (const e of expenses) {
      const d = dateOf(e.expenseDate) || dateOf(e.createdAt);
      if (!d) continue;
      const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const cat = e.category || 'other';
      const c = byCat[cat] || (byCat[cat] = {});
      c[month] = r2(num(c[month]) + num(e.amount));
    }

    const months = [...new Set(expenses.map(e => {
      const d = dateOf(e.expenseDate) || dateOf(e.createdAt);
      return d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` : null;
    }).filter(Boolean))].sort();

    if (months.length === 0) return [];
    const current = months[months.length - 1];

    const out = [];
    for (const [cat, series] of Object.entries(byCat)) {
      const prior = months.slice(0, -1).map(m => num(series[m])).filter((_, i, a) => a.length);
      if (prior.length < minMonths) continue;

      const mean = prior.reduce((s, v) => s + v, 0) / prior.length;
      const sd   = Math.sqrt(prior.reduce((s, v) => s + (v - mean) ** 2, 0) / prior.length);
      const now  = num(series[current]);
      if (mean <= 0) continue;

      const score = sd > 0 ? (now - mean) / sd : (now > mean * 1.5 ? 99 : 0);
      if (score >= z && now > mean) {
        out.push({
          category: cat, current: r2(now), mean: r2(mean),
          delta: r2(now - mean),
          pct: Math.round(((now - mean) / mean) * 100),
          z: Math.round(score * 10) / 10,
          month: current,
        });
      }
    }
    return out.sort((a, b) => b.delta - a.delta);
  },

  // ── MARGIN ───────────────────────────────────────────────────────────────
  /** Gross margin per item — where the money is actually being made or lost. */
  margins({ products, movements }) {
    const sold = {};
    for (const m of movements) {
      if (m.type !== 'out' || m.reason !== 'sale') continue;
      const e = sold[m.productId] || (sold[m.productId] = { qty: 0, cost: 0 });
      e.qty  = r2(e.qty + num(m.qty));
      e.cost = r2(e.cost + num(m.value));
    }

    return products
      .filter(p => p.trackInventory === true && sold[p.id]?.qty > 0)
      .map(p => {
        const s = sold[p.id];
        const revenue = r2(s.qty * num(p.rate));
        const profit  = r2(revenue - s.cost);
        return {
          id: p.id, name: p.name, qty: s.qty,
          revenue, cost: s.cost, profit,
          marginPct: revenue > 0 ? Math.round((profit / revenue) * 100) : 0,
        };
      })
      .sort((a, b) => b.profit - a.profit);
  },
};

export default InsightsService;
