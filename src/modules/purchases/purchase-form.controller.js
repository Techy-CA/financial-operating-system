/**
 * purchase-form.controller.js — Create / edit a vendor bill
 *
 * Picking a product fills its purchase rate, HSN, unit and GST so a bill can be
 * keyed in almost entirely from the product master. Saving posts the goods into
 * stock at the rate on the bill.
 */

import Router from '../../core/router.js';
import Store  from '../../core/store.js';
import Toast  from '../../components/Toast.js';
import Icon   from '../../utils/icons.js';
import DB     from '../../services/firestore.js';
import PurchaseService, { calcBill } from './purchases.service.js';
import { formatCurrency } from '../../utils/formatters.js';
import { GST_RATE_OPTIONS, PRODUCT_UNITS, BILL_STATUS, INDIAN_STATES } from '../../utils/constants.js';

const money = (v) => formatCurrency(v);
const esc   = (s) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const today = () => new Date().toISOString().split('T')[0];

const PurchaseForm = {
  _id: null, _vendors: [], _products: [], _warehouses: [], _lines: [], _bill: null, _saving: false,

  async init(id) {
    window.PurchaseForm = this;
    this._id = id || null;
    this._lines = [];

    Router.render(`
      <div class="page-header">
        <div class="page-header-left">
          <h1>${id ? 'Edit bill' : 'New purchase bill'}</h1>
          <p>Record what you bought — stock and input tax credit update together</p>
        </div>
        <div class="page-header-actions">
          <a href="#/purchases" class="btn btn-secondary btn-sm">Cancel</a>
          <button class="btn btn-primary btn-sm" id="pf-save" onclick="PurchaseForm.save()">${Icon.save(14)} Save bill</button>
        </div>
      </div>
      <div id="pf-body"><div class="card" style="padding:40px;text-align:center;"><div class="spinner-sm"></div></div></div>
    `);

    if (!(await PurchaseService.waitForCompany())) {
      document.getElementById('pf-body').innerHTML = `<div class="empty-state"><h3>No company selected</h3><p>Set up your company in Settings first.</p></div>`;
      return;
    }

    const { default: Inventory } = await import('../inventory/inventory.service.js');
    const [vendors, products, warehouses, bill] = await Promise.all([
      DB.getAll('vendors', []).catch(() => []),
      DB.getAll('products', []).catch(() => []),
      Inventory.listWarehouses().catch(() => []),
      id ? PurchaseService.get(id).catch(() => null) : Promise.resolve(null),
    ]);

    this._vendors    = vendors.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    this._products   = products.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    this._warehouses = warehouses;
    this._bill       = bill;

    if (bill) {
      this._lines = (bill.itemsSnapshot || []).map(i => ({ ...i, name: i.description }));
    }
    if (this._lines.length === 0) this._blankLine();

    this._render();
  },

  _blankLine() {
    this._lines.push({ productId: '', description: '', hsn: '', qty: 1, unit: 'Nos', rate: 0, discount: 0, gstRate: 18 });
  },

  _render() {
    const b = this._bill || {};
    const el = document.getElementById('pf-body');
    if (!el) return;

    el.innerHTML = `
      <div class="card" style="margin-bottom:14px;">
        <div class="card-body">
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Vendor *</label>
              <select id="pf-vendor" class="select" onchange="PurchaseForm.recalc()">
                <option value="">Select vendor…</option>
                ${this._vendors.map(v => `<option value="${v.id}" ${b.vendorId === v.id ? 'selected' : ''}>${esc(v.name || 'Unnamed')}</option>`).join('')}
              </select>
              <span class="form-hint">Not listed? <a href="#/vendors/new">Add a vendor</a></span>
            </div>
            <div class="form-group">
              <label class="form-label">Vendor's bill number</label>
              <input id="pf-vbill" class="input" value="${esc(b.vendorBillNumber || '')}" placeholder="As printed on their invoice" />
            </div>
          </div>

          <div class="form-row-3">
            <div class="form-group">
              <label class="form-label">Bill date *</label>
              <input id="pf-date" class="input" type="date" value="${esc(b.billDate || today())}" />
            </div>
            <div class="form-group">
              <label class="form-label">Due date</label>
              <input id="pf-due" class="input" type="date" value="${esc(b.dueDate || today())}" />
            </div>
            <div class="form-group">
              <label class="form-label">Receive into</label>
              <select id="pf-wh" class="select">
                ${this._warehouses.map(w => `<option value="${w.id}" ${b.warehouseId === w.id ? 'selected' : ''}>${esc(w.name)}</option>`).join('')}
              </select>
            </div>
          </div>

          <div class="form-row-3">
            <div class="form-group">
              <label class="form-label">Place of supply</label>
              <select id="pf-pos" class="select" onchange="PurchaseForm.recalc()">
                <option value="">Same state (CGST + SGST)</option>
                ${INDIAN_STATES.map(s => `<option value="${esc(s.name)}" ${b.placeOfSupply === s.name ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Status</label>
              <select id="pf-status" class="select">
                <option value="${BILL_STATUS.RECEIVED}" ${b.status !== 'draft' ? 'selected' : ''}>Received (books stock)</option>
                <option value="${BILL_STATUS.DRAFT}" ${b.status === 'draft' ? 'selected' : ''}>Draft (no stock yet)</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Input tax credit</label>
              <select id="pf-itc" class="select">
                <option value="yes" ${b.itcEligible !== false ? 'selected' : ''}>Eligible — claim ITC</option>
                <option value="no"  ${b.itcEligible === false ? 'selected' : ''}>Not eligible</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <div class="card" style="margin-bottom:14px;">
        <div class="card-header">
          <h3 style="margin:0;font-size:15px;">Items</h3>
          <div class="card-header-actions">
            <button class="btn btn-secondary btn-sm" onclick="PurchaseForm.addLine()">+ Add line</button>
          </div>
        </div>
        <div class="table-wrapper">
          <table class="data-table pf-table">
            <thead><tr>
              <th style="min-width:200px;">Item</th><th style="width:90px;">HSN</th>
              <th style="width:80px;" class="text-right">Qty</th><th style="width:80px;">Unit</th>
              <th style="width:100px;" class="text-right">Rate</th><th style="width:70px;" class="text-right">Disc %</th>
              <th style="width:90px;">GST</th><th style="width:110px;" class="text-right">Amount</th><th style="width:36px;"></th>
            </tr></thead>
            <tbody id="pf-lines"></tbody>
          </table>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 320px;gap:14px;align-items:start;">
        <div class="card">
          <div class="card-body">
            <div class="form-group" style="margin:0;">
              <label class="form-label">Notes</label>
              <textarea id="pf-notes" class="textarea" rows="3" placeholder="Transport, terms, anything worth remembering">${esc(b.notes || '')}</textarea>
            </div>
          </div>
        </div>
        <div class="card"><div class="card-body" id="pf-totals"></div></div>
      </div>
    `;

    this._renderLines();
  },

  _renderLines() {
    const tb = document.getElementById('pf-lines');
    if (!tb) return;
    const totals = this._totals();

    tb.innerHTML = this._lines.map((l, i) => {
      const calc = totals.items[i] || { lineTotal: 0 };
      return `<tr>
        <td>
          <select class="select pf-in" onchange="PurchaseForm.pickProduct(${i},this.value)">
            <option value="">— free text —</option>
            ${this._products.map(p => `<option value="${p.id}" ${l.productId === p.id ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}
          </select>
          <input class="input pf-in" style="margin-top:4px;" placeholder="Description"
                 value="${esc(l.description || '')}" onchange="PurchaseForm.setField(${i},'description',this.value)" />
        </td>
        <td><input class="input pf-in" value="${esc(l.hsn || '')}" onchange="PurchaseForm.setField(${i},'hsn',this.value)" /></td>
        <td><input class="input pf-in text-right" type="number" step="any" value="${l.qty}" onchange="PurchaseForm.setField(${i},'qty',this.value)" onfocus="this.select()" /></td>
        <td>
          <select class="select pf-in" onchange="PurchaseForm.setField(${i},'unit',this.value)">
            ${PRODUCT_UNITS.map(u => `<option value="${u}" ${l.unit === u ? 'selected' : ''}>${u}</option>`).join('')}
          </select>
        </td>
        <td><input class="input pf-in text-right" type="number" step="0.01" value="${l.rate}" onchange="PurchaseForm.setField(${i},'rate',this.value)" onfocus="this.select()" /></td>
        <td><input class="input pf-in text-right" type="number" step="0.01" value="${l.discount || 0}" onchange="PurchaseForm.setField(${i},'discount',this.value)" onfocus="this.select()" /></td>
        <td>
          <select class="select pf-in" onchange="PurchaseForm.setField(${i},'gstRate',this.value)">
            ${GST_RATE_OPTIONS.map(o => `<option value="${o.value}" ${Number(l.gstRate) === o.value ? 'selected' : ''}>${o.label}</option>`).join('')}
          </select>
        </td>
        <td class="col-amount">${money(calc.lineTotal)}</td>
        <td class="col-actions">
          <button class="btn btn-ghost btn-icon btn-sm" style="color:var(--color-danger);" onclick="PurchaseForm.removeLine(${i})">${Icon.x(13)}</button>
        </td>
      </tr>`;
    }).join('');

    this._renderTotals(totals);
  },

  _totals() {
    return calcBill(this._lines, { interState: this._isInterState() });
  },

  _isInterState() {
    const pos = document.getElementById('pf-pos')?.value;
    const co  = Store.get('company');
    return !!(pos && co?.state && pos !== co.state);
  },

  _renderTotals(t) {
    const el = document.getElementById('pf-totals');
    if (!el) return;
    const row = (l, v, strong) => `
      <div style="display:flex;justify-content:space-between;padding:3px 0;font-size:${strong ? '15px' : '12.5px'};${strong ? 'font-weight:700;border-top:1.5px solid var(--border-default);margin-top:6px;padding-top:8px;' : 'color:var(--text-secondary);'}">
        <span>${l}</span><span>${v}</span>
      </div>`;
    el.innerHTML =
      row('Subtotal', money(t.subTotal)) +
      (t.discountTotal > 0 ? row('Discount', '−' + money(t.discountTotal)) : '') +
      row('Taxable', money(t.taxableTotal)) +
      (t.interState ? row('IGST', money(t.igst)) : row('CGST', money(t.cgst)) + row('SGST', money(t.sgst))) +
      (Math.abs(t.roundOff) >= 0.01 ? row('Round off', (t.roundOff > 0 ? '+' : '') + money(t.roundOff)) : '') +
      row('Total', money(t.grandTotal), true);
  },

  // ── LINE EDITING ─────────────────────────────────────────────────────────
  addLine() { this._blankLine(); this._renderLines(); },
  removeLine(i) {
    this._lines.splice(i, 1);
    if (this._lines.length === 0) this._blankLine();
    this._renderLines();
  },

  setField(i, field, value) {
    const l = this._lines[i];
    if (!l) return;
    l[field] = ['qty', 'rate', 'discount', 'gstRate'].includes(field) ? (parseFloat(value) || 0) : value;
    this._renderLines();
  },

  /** Pull everything the product master already knows so only qty needs typing. */
  pickProduct(i, productId) {
    const l = this._lines[i];
    if (!l) return;
    l.productId = productId || '';
    const p = this._products.find(x => x.id === productId);
    if (p) {
      l.description = p.name || '';
      l.hsn         = p.hsn || '';
      l.unit        = p.unit || 'Nos';
      l.gstRate     = Number(p.gstRate) || 0;
      // Purchase rate first, then last known cost — never the selling price
      l.rate        = Number(p.purchaseRate ?? p.avgCost ?? 0);
    }
    this._renderLines();
  },

  recalc() { this._renderLines(); },

  // ── SAVE ─────────────────────────────────────────────────────────────────
  async save() {
    if (this._saving) return;
    const vendorId = document.getElementById('pf-vendor')?.value;
    const vendor   = this._vendors.find(v => v.id === vendorId);
    const date     = document.getElementById('pf-date')?.value;

    if (!vendorId) { Toast.error('Choose a vendor'); return; }
    if (!date)     { Toast.error('Bill date is required'); return; }

    const lines = this._lines.filter(l => (l.description || '').trim() && (parseFloat(l.qty) || 0) > 0);
    if (lines.length === 0) { Toast.error('Add at least one item with a quantity'); return; }

    const wh = this._warehouses.find(w => w.id === document.getElementById('pf-wh')?.value);

    const btn = document.getElementById('pf-save');
    this._saving = true;
    btn.disabled = true; btn.textContent = 'Saving…';

    try {
      const res = await PurchaseService.save(this._id, {
        vendorId,
        vendorName:       vendor?.name || 'Vendor',
        vendorGstin:      vendor?.gstin || null,
        vendorBillNumber: document.getElementById('pf-vbill')?.value || null,
        billNumber:       this._bill?.billNumber,
        billDate:         date,
        dueDate:          document.getElementById('pf-due')?.value || date,
        placeOfSupply:    document.getElementById('pf-pos')?.value || null,
        status:           document.getElementById('pf-status')?.value || BILL_STATUS.RECEIVED,
        itcEligible:      document.getElementById('pf-itc')?.value !== 'no',
        warehouseId:      wh?.id,
        warehouseName:    wh?.name,
        notes:            document.getElementById('pf-notes')?.value || null,
        paidAmount:       this._bill?.paidAmount || 0,
      }, lines, { interState: this._isInterState() });

      (res.warnings || []).forEach(w => Toast.warning(w));
      Toast.success(`Bill ${res.billNumber || ''} saved`);
      Router.navigate('/purchases');
    } catch (e) {
      Toast.error('Save failed: ' + e.message);
      this._saving = false;
      btn.disabled = false; btn.textContent = 'Save bill';
    }
  },
};

export default PurchaseForm;
