/**
 * inventory.service.js — Stock engine
 *
 * Every quantity change goes through recordMovement(), which writes an
 * immutable stockMovements entry AND updates the product balance inside a
 * single Firestore transaction. Nothing else is allowed to touch stockQty.
 *
 * Valuation: weighted average cost (moving average), recomputed on each inward
 * movement. Outward movements are valued at the running average.
 */

import Store from '../../core/store.js';
import DB    from '../../services/firestore.js';
import { DEFAULT_WAREHOUSE, STOCK_REASONS } from '../../utils/constants.js';

const COL_MOVEMENTS = 'stockMovements';
const COL_PRODUCTS  = 'products';
const COL_WAREHOUSES= 'warehouses';

async function sdk() {
  const m = await import('https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js');
  return { ...m, db: window.fbDB };
}

function companyId() {
  const cid = Store.get('companyId');
  if (!cid) throw new Error('No company selected. Go to Settings to set up your company.');
  return cid;
}

const num  = (v) => { const n = parseFloat(v); return isNaN(n) ? 0 : n; };
const qRnd = (v) => Math.round(num(v) * 1000) / 1000;   // quantities — 3 decimals
const mRnd = (v) => Math.round(num(v) * 100)  / 100;    // money — 2 decimals

const InventoryService = {

  /**
   * Company data is fetched after sign-in, so a page opened by direct URL or a
   * hard refresh can render before companyId exists. Pages wait on this instead
   * of throwing "No company selected" at the user.
   */
  async waitForCompany(timeout = 5000) {
    const step = 150;
    for (let waited = 0; waited < timeout; waited += step) {
      if (Store.get('companyId')) return true;
      await new Promise(r => setTimeout(r, step));
    }
    return !!Store.get('companyId');
  },

  // ── ITEMS ────────────────────────────────────────────────────────────────
  /** All products that have stock tracking switched on. */
  async listItems() {
    const products = await DB.getAll(COL_PRODUCTS, []).catch(() => []);
    return products
      .filter(p => p.trackInventory === true)
      .map(p => this.decorate(p))
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  },

  /** All products, tracked or not — used by pickers so items can be enabled inline. */
  async listAllProducts() {
    const products = await DB.getAll(COL_PRODUCTS, []).catch(() => []);
    return products.map(p => this.decorate(p)).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  },

  getItem(id) { return DB.getOne(COL_PRODUCTS, id); },

  /** Adds derived stock fields so views never recompute them. */
  decorate(p) {
    const qty    = qRnd(p.stockQty);
    const cost   = mRnd(p.avgCost ?? p.purchaseRate ?? 0);
    const reorder= qRnd(p.reorderLevel);
    let status   = 'in_stock';
    if (qty < 0)                       status = 'negative';
    else if (qty === 0)                status = 'out_of_stock';
    else if (reorder > 0 && qty <= reorder) status = 'low_stock';
    return { ...p, stockQty: qty, avgCost: cost, reorderLevel: reorder, stockValue: mRnd(qty * cost), stockStatus: status };
  },

  /** Portfolio-level numbers for the overview cards. */
  stats(items) {
    const list = items || [];
    return {
      itemCount:   list.length,
      totalQty:    qRnd(list.reduce((s, i) => s + num(i.stockQty), 0)),
      stockValue:  mRnd(list.reduce((s, i) => s + num(i.stockValue), 0)),
      lowStock:    list.filter(i => i.stockStatus === 'low_stock').length,
      outOfStock:  list.filter(i => i.stockStatus === 'out_of_stock').length,
      negative:    list.filter(i => i.stockStatus === 'negative').length,
      potentialSaleValue: mRnd(list.reduce((s, i) => s + (num(i.stockQty) * num(i.rate)), 0)),
    };
  },

  lowStockItems(items) {
    return (items || []).filter(i => i.stockStatus === 'low_stock' || i.stockStatus === 'out_of_stock' || i.stockStatus === 'negative');
  },

  // ── WAREHOUSES ───────────────────────────────────────────────────────────
  async listWarehouses() {
    const rows = await DB.getAll(COL_WAREHOUSES, []).catch(() => []);
    if (rows.length === 0) return [{ ...DEFAULT_WAREHOUSE }];
    const sorted = rows.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    return sorted.some(w => w.id === DEFAULT_WAREHOUSE.id) ? sorted : [{ ...DEFAULT_WAREHOUSE }, ...sorted];
  },

  saveWarehouse(id, data) {
    return id ? DB.update(COL_WAREHOUSES, id, data) : DB.create(COL_WAREHOUSES, data);
  },

  async deleteWarehouse(id) {
    if (id === DEFAULT_WAREHOUSE.id) throw new Error('The default location cannot be deleted');
    const held = await this.listItems();
    const stuck = held.filter(i => qRnd(i.stockByWarehouse?.[id]) !== 0);
    if (stuck.length) throw new Error(`${stuck.length} item(s) still hold stock here. Transfer them out first.`);
    return DB.delete(COL_WAREHOUSES, id);
  },

  // ── MOVEMENTS ────────────────────────────────────────────────────────────
  /**
   * The only write path for stock.
   *
   * @param {object} m
   *   productId   required
   *   type        'in' | 'out'                  (ignored when mode==='set')
   *   mode        'delta' (default) | 'set'     'set' books the difference to reach targetQty
   *   qty         movement quantity (mode==='delta')
   *   targetQty   counted quantity  (mode==='set')
   *   rate        unit cost — defaults to the running average
   *   reason      key from STOCK_REASONS
   *   warehouseId / warehouseName
   *   date        YYYY-MM-DD
   *   refType / refId / refNumber   source document
   *   notes
   *   allowNegative  bypass the negative-stock guard (sales do this)
   */
  async recordMovement(m) {
    const f    = await sdk();
    const cid  = companyId();
    const user = Store.get('user');
    const pRef = f.doc(f.db, 'companies', cid, COL_PRODUCTS, m.productId);
    const mRef = f.doc(f.collection(f.db, 'companies', cid, COL_MOVEMENTS));

    let out = null;

    await f.runTransaction(f.db, async (tx) => {
      const snap = await tx.get(pRef);
      if (!snap.exists()) throw new Error('Item not found — it may have been deleted');
      const p      = snap.data();
      const before = qRnd(p.stockQty);

      // Resolve direction + quantity
      let type = m.type === 'out' ? 'out' : 'in';
      let qty  = qRnd(Math.abs(num(m.qty)));
      if (m.mode === 'set') {
        const diff = qRnd(num(m.targetQty) - before);
        if (diff === 0) throw new Error('Counted quantity matches the current stock — nothing to adjust');
        type = diff > 0 ? 'in' : 'out';
        qty  = Math.abs(diff);
      }
      if (qty <= 0) throw new Error('Quantity must be greater than zero');

      const dir   = type === 'in' ? 1 : -1;
      const after = qRnd(before + dir * qty);
      if (after < 0 && !m.allowNegative) {
        throw new Error(`Only ${before} ${p.unit || 'Nos'} of "${p.name}" in stock — cannot issue ${qty}`);
      }

      // Moving-average valuation
      let avg  = mRnd(p.avgCost ?? p.purchaseRate ?? 0);
      const rate = (m.rate === '' || m.rate === null || m.rate === undefined) ? avg : mRnd(m.rate);
      if (dir > 0) {
        const base = Math.max(before, 0);
        avg = (base + qty) > 0 ? mRnd(((base * avg) + (qty * rate)) / (base + qty)) : rate;
      }
      const unitValue = dir > 0 ? rate : avg;

      // Per-location balances
      const whId   = m.warehouseId || DEFAULT_WAREHOUSE.id;
      const whName = m.warehouseName || DEFAULT_WAREHOUSE.name;
      const byWh   = { ...(p.stockByWarehouse || {}) };
      byWh[whId]   = qRnd(num(byWh[whId]) + dir * qty);

      const movement = {
        productId:     m.productId,
        productName:   p.name || '—',
        sku:           p.sku || null,
        unit:          p.unit || 'Nos',
        type,
        reason:        m.reason || (type === 'in' ? 'purchase' : 'sale'),
        qty,
        rate:          mRnd(unitValue),
        value:         mRnd(qty * unitValue),
        balanceBefore: before,
        balanceAfter:  after,
        warehouseId:   whId,
        warehouseName: whName,
        date:          m.date || new Date().toISOString().split('T')[0],
        refType:       m.refType || 'manual',
        refId:         m.refId || null,
        refNumber:     m.refNumber || null,
        notes:         m.notes || null,
        createdAt:     f.serverTimestamp(),
        createdBy:     user?.uid || null,
        createdByName: user?.displayName || user?.email?.split('@')[0] || 'System',
      };

      tx.set(mRef, movement);
      tx.update(pRef, {
        trackInventory:   true,
        stockQty:         after,
        avgCost:          avg,
        stockValue:       mRnd(after * avg),
        stockByWarehouse: byWh,
        lastMovementAt:   f.serverTimestamp(),
        updatedAt:        f.serverTimestamp(),
        updatedBy:        user?.uid || null,
      });

      out = { id: mRef.id, ...movement, createdAt: new Date() };
    });

    return out;
  },

  /** Movement history, newest first. Filtering happens client-side to keep index needs at zero. */
  async listMovements({ productId = null, limit = 500 } = {}) {
    const constraints = productId
      ? [DB.where('productId', '==', productId)]
      : [DB.orderBy('createdAt', 'desc'), DB.limit(limit)];
    const rows = await DB.getAll(COL_MOVEMENTS, constraints).catch(() => []);
    return rows.sort((a, b) => {
      const ta = a.createdAt?.toMillis?.() || new Date(a.date || 0).getTime();
      const tb = b.createdAt?.toMillis?.() || new Date(b.date || 0).getTime();
      return tb - ta;
    });
  },

  movementsForRef(refType, refId) {
    return DB.getAll(COL_MOVEMENTS, [DB.where('refId', '==', refId)])
      .then(rows => rows.filter(r => r.refType === refType))
      .catch(() => []);
  },

  /** Net quantity already booked against a source document, per product. */
  async netAppliedByProduct(refType, refId) {
    const rows = await this.movementsForRef(refType, refId);
    const map  = {};
    for (const r of rows) {
      const signed = r.type === 'out' ? num(r.qty) : -num(r.qty);   // positive = consumed
      map[r.productId] = qRnd(num(map[r.productId]) + signed);
    }
    return map;
  },

  // ── DOCUMENT SYNC ────────────────────────────────────────────────────────
  /**
   * Books an invoice's goods movement. Idempotent and edit-safe: it compares
   * what the invoice now needs against what has already been booked against
   * it, and posts only the difference. Draft/cancelled invoices net to zero,
   * which returns any previously issued stock.
   *
   * Sales are allowed to go negative — the ledger must mirror what was actually
   * invoiced — and the shortfall is returned as a warning for the caller.
   */
  async syncInvoiceStock(invoice, items) {
    const invoiceId = invoice?.id;
    if (!invoiceId) return { applied: [], warnings: [] };

    const releaseAll = invoice.status === 'draft' || invoice.status === 'cancelled';
    const products   = await DB.getAll(COL_PRODUCTS, []).catch(() => []);
    const tracked    = new Map(products.filter(p => p.trackInventory).map(p => [p.id, p]));

    // Target consumption per product — a draft or cancelled invoice consumes nothing
    const target = {};
    if (!releaseAll) {
      for (const it of (items || [])) {
        if (!it.productId || !tracked.has(it.productId)) continue;
        target[it.productId] = qRnd(num(target[it.productId]) + num(it.qty));
      }
    }

    const applied  = await this.netAppliedByProduct('invoice', invoiceId);
    const ids      = new Set([...Object.keys(target), ...Object.keys(applied)]);
    const results  = [];
    const warnings = [];

    for (const productId of ids) {
      const delta = qRnd(num(target[productId]) - num(applied[productId]));
      if (delta === 0) continue;
      const product = tracked.get(productId) || products.find(p => p.id === productId);
      if (!product) continue;
      try {
        const mv = await this.recordMovement({
          productId,
          type:      delta > 0 ? 'out' : 'in',
          qty:       Math.abs(delta),
          reason:    delta > 0 ? 'sale' : 'sale_reversal',
          refType:   'invoice',
          refId:     invoiceId,
          refNumber: invoice.invoiceNumber || null,
          date:      invoice.invoiceDate || undefined,
          notes:     delta > 0 ? null : 'Invoice revised — stock returned',
          allowNegative: true,
        });
        results.push(mv);
        if (mv.balanceAfter < 0) {
          warnings.push(`${product.name} is now ${mv.balanceAfter} ${product.unit || 'Nos'} — stock went negative`);
        }
      } catch (e) {
        warnings.push(`${product.name}: ${e.message}`);
      }
    }

    return { applied: results, warnings };
  },

  /** Returns everything an invoice consumed — call before deleting it. */
  async reverseInvoiceStock(invoice) {
    return this.syncInvoiceStock({ ...invoice, status: 'cancelled' }, []);
  },

  /** Opening balance when an item first starts being tracked. */
  openingStock(productId, qty, rate, warehouse) {
    return this.recordMovement({
      productId,
      type:   'in',
      qty,
      rate,
      reason: 'opening',
      refType:'opening',
      notes:  'Opening stock',
      warehouseId:   warehouse?.id,
      warehouseName: warehouse?.name,
    });
  },

  reasonLabel(key) { return STOCK_REASONS[key]?.label || key || '—'; },
};

export default InventoryService;
