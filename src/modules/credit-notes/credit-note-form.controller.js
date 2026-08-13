/**
 * credit-note-form.controller.js — Issue a credit note against an invoice
 *
 * Picking the invoice pulls its lines in at the price they were sold at, capped
 * to what has not already been credited. Crediting more than was invoiced is a
 * common way to quietly corrupt GST, so the quantity is clamped, not trusted.
 */

import Router from '../../core/router.js';
import Toast  from '../../components/Toast.js';
import Icon   from '../../utils/icons.js';
import DB     from '../../services/firestore.js';
import CreditNoteService, { calcNote } from './credit-notes.service.js';
import { formatCurrency, formatDate } from '../../utils/formatters.js';
import { CREDIT_NOTE_REASONS, GST_RATE_OPTIONS } from '../../utils/constants.js';

const money = (v) => formatCurrency(v);
const esc   = (s) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const CreditNoteForm = {
  _invoices: [], _invoice: null, _lines: [], _maxQty: {}, _saving: false,

  async init() {
    window.CreditNoteForm = this;
    Router.render(`
      <div class="page-header">
        <div class="page-header-left"><h1>New credit note</h1><p>Return goods or adjust an invoice</p></div>
        <div class="page-header-actions">
          <a href="#/credit-notes" class="btn btn-secondary btn-sm">Cancel</a>
          <button class="btn btn-primary btn-sm" id="cf-save" onclick="CreditNoteForm.save()">${Icon.save(14)} Issue credit note</button>
        </div>
      </div>
      <div id="cf-body"><div class="card" style="padding:40px;text-align:center;"><div class="spinner-sm"></div></div></div>
    `);

    if (!(await CreditNoteService.waitForCompany())) {
      document.getElementById('cf-body').innerHTML = `<div class="empty-state"><h3>No company selected</h3><p>Set up your company in Settings first.</p></div>`;
      return;
    }

    this._invoices = await CreditNoteService.creditableInvoices().catch(() => []);
    this._render();
  },

  _render() {
    document.getElementById('cf-body').innerHTML = `
      <div class="card" style="margin-bottom:14px;">
        <div class="card-body">
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Against invoice *</label>
              <select id="cf-invoice" class="select" onchange="CreditNoteForm.pickInvoice(this.value)">
                <option value="">Select the invoice being credited…</option>
                ${this._invoices.map(i => `<option value="${i.id}">${esc(i.invoiceNumber || 'Invoice')} · ${esc(i.customerName || '')} · ${money(i.grandTotal)} · ${formatDate(i.invoiceDate, 'short')}</option>`).join('')}
              </select>
              <span class="form-hint">Only sent invoices can be credited.</span>
            </div>
            <div class="form-group">
              <label class="form-label">Reason *</label>
              <select id="cf-reason" class="select" onchange="CreditNoteForm.renderLines()">
                ${CREDIT_NOTE_REASONS.map(r => `<option value="${r.id}">${esc(r.label)}</option>`).join('')}
              </select>
              <span class="form-hint" id="cf-restock-hint"></span>
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Credit note date</label>
              <input id="cf-date" class="input" type="date" value="${new Date().toISOString().split('T')[0]}" />
            </div>
            <div class="form-group">
              <label class="form-label">Settlement</label>
              <select id="cf-settle" class="select">
                <option value="adjust">Adjust against the invoice balance</option>
                <option value="refund">Refunded in cash / bank</option>
              </select>
            </div>
          </div>
          <div class="form-group" style="margin-bottom:0;">
            <label class="form-label">Notes</label>
            <input id="cf-notes" class="input" placeholder="Why this credit note is being issued" />
          </div>
        </div>
      </div>

      <div class="card" style="margin-bottom:14px;">
        <div class="card-header"><h3 style="margin:0;font-size:15px;">Lines to credit</h3></div>
        <div id="cf-lines-wrap">
          <div class="empty-state" style="padding:30px;">
            <p style="color:var(--text-tertiary);font-size:13px;">Pick an invoice above to load its items.</p>
          </div>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 320px;gap:14px;align-items:start;">
        <div></div>
        <div class="card"><div class="card-body" id="cf-totals"></div></div>
      </div>`;

    this._updateRestockHint();
  },

  _updateRestockHint() {
    const reason = document.getElementById('cf-reason')?.value;
    const cfg = CREDIT_NOTE_REASONS.find(r => r.id === reason);
    const el = document.getElementById('cf-restock-hint');
    if (el) el.textContent = cfg?.restock
      ? 'Goods will be added back to stock.'
      : 'Stock is not changed for this reason.';
  },

  async pickInvoice(id) {
    this._invoice = this._invoices.find(i => i.id === id) || null;
    this._lines = [];
    this._maxQty = {};

    if (!this._invoice) { this.renderLines(); return; }

    // Prefer the snapshot on the invoice; fall back to the line-item collection
    let items = this._invoice.itemsSnapshot;
    if (!items || items.length === 0) {
      items = await DB.getAll('invoiceItems', [DB.where('invoiceId', '==', id)]).catch(() => []);
      items = items.sort((a, b) => (a.position || 0) - (b.position || 0));
    }

    const credited = await CreditNoteService.alreadyCredited(id).catch(() => ({}));

    this._lines = items.map(it => {
      const key = it.productId || it.description;
      const sold = parseFloat(it.qty) || 0;
      const done = parseFloat(credited[key]) || 0;
      const left = Math.max(0, Math.round((sold - done) * 1000) / 1000);
      this._maxQty[key] = left;
      return {
        productId: it.productId || null,
        description: it.description || '',
        hsn: it.hsn || null,
        unit: it.unit || 'Nos',
        // Rate net of any line discount, so the credit matches what was charged
        rate: sold > 0 ? Math.round(((parseFloat(it.lineNet) || 0) / sold) * 100) / 100 : (parseFloat(it.rate) || 0),
        gstRate: parseFloat(it.gstRate) || 0,
        qty: left,
        soldQty: sold, creditedQty: done, maxQty: left,
      };
    }).filter(l => l.maxQty > 0 || l.soldQty > 0);

    this.renderLines();
  },

  renderLines() {
    this._updateRestockHint();
    const wrap = document.getElementById('cf-lines-wrap');
    if (!wrap) return;

    if (!this._invoice) {
      wrap.innerHTML = `<div class="empty-state" style="padding:30px;"><p style="color:var(--text-tertiary);font-size:13px;">Pick an invoice above to load its items.</p></div>`;
      this._renderTotals(calcNote([], {}));
      return;
    }

    const totals = this._totals();

    wrap.innerHTML = `<div class="table-wrapper"><table class="data-table">
      <thead><tr>
        <th>Item</th><th class="text-right">Sold</th><th class="text-right">Already credited</th>
        <th class="text-right">Credit qty</th><th class="text-right">Rate</th><th>GST</th><th class="text-right">Amount</th>
      </tr></thead>
      <tbody>
        ${this._lines.map((l, i) => {
          const calc = totals.items[i] || { lineTotal: 0 };
          const maxed = l.maxQty <= 0;
          return `<tr style="${maxed ? 'opacity:0.5;' : ''}">
            <td><strong style="font-size:12.5px;">${esc(l.description)}</strong>${l.hsn ? `<div style="font-size:10.5px;color:var(--text-tertiary);">HSN ${esc(l.hsn)}</div>` : ''}</td>
            <td class="text-right muted">${l.soldQty} ${esc(l.unit)}</td>
            <td class="text-right muted">${l.creditedQty || '—'}</td>
            <td class="text-right">
              <input class="pr-mini" type="number" step="any" min="0" max="${l.maxQty}" value="${l.qty || ''}"
                     ${maxed ? 'disabled' : ''} onchange="CreditNoteForm.setQty(${i},this.value)" onfocus="this.select()" />
              ${maxed ? `<div style="font-size:10px;color:var(--color-danger);">fully credited</div>` : `<div style="font-size:10px;color:var(--text-tertiary);">max ${l.maxQty}</div>`}
            </td>
            <td class="text-right"><input class="pr-mini" type="number" step="0.01" value="${l.rate}" onchange="CreditNoteForm.setRate(${i},this.value)" onfocus="this.select()" /></td>
            <td>
              <select class="select" style="height:28px;padding:0 6px;font-size:11.5px;" onchange="CreditNoteForm.setGst(${i},this.value)">
                ${GST_RATE_OPTIONS.map(o => `<option value="${o.value}" ${Number(l.gstRate) === o.value ? 'selected' : ''}>${o.label}</option>`).join('')}
              </select>
            </td>
            <td class="col-amount">${money(calc.lineTotal)}</td>
          </tr>`;
        }).join('')}
      </tbody>
    </table></div>`;

    this._renderTotals(totals);
  },

  _totals() {
    const active = this._lines.filter(l => (parseFloat(l.qty) || 0) > 0);
    const all = calcNote(this._lines, { interState: !!this._invoice?.interState || !!this._invoice?.igst });
    // Keep index alignment with the rendered rows while totalling only credited lines
    const totals = calcNote(active, { interState: !!this._invoice?.interState || !!this._invoice?.igst });
    return { ...totals, items: all.items };
  },

  setQty(i, v) {
    const l = this._lines[i];
    if (!l) return;
    let q = parseFloat(v) || 0;
    if (q > l.maxQty) { q = l.maxQty; Toast.warning(`Only ${l.maxQty} ${l.unit} left to credit on this line`); }
    l.qty = Math.max(0, q);
    this.renderLines();
  },
  setRate(i, v) { if (this._lines[i]) { this._lines[i].rate = Math.max(0, parseFloat(v) || 0); this.renderLines(); } },
  setGst(i, v)  { if (this._lines[i]) { this._lines[i].gstRate = parseFloat(v) || 0; this.renderLines(); } },

  _renderTotals(t) {
    const el = document.getElementById('cf-totals');
    if (!el) return;
    const row = (l, v, strong) => `
      <div style="display:flex;justify-content:space-between;padding:3px 0;font-size:${strong ? '15px' : '12.5px'};${strong ? 'font-weight:700;border-top:1.5px solid var(--border-default);margin-top:6px;padding-top:8px;' : 'color:var(--text-secondary);'}">
        <span>${l}</span><span>${v}</span>
      </div>`;
    el.innerHTML =
      row('Taxable value', money(t.taxableTotal)) +
      (t.interState ? row('IGST', money(t.igst)) : row('CGST', money(t.cgst)) + row('SGST', money(t.sgst))) +
      row('Credit total', money(t.grandTotal), true);
  },

  async save() {
    if (this._saving) return;
    if (!this._invoice) { Toast.error('Pick the invoice being credited'); return; }
    const lines = this._lines.filter(l => (parseFloat(l.qty) || 0) > 0);
    if (lines.length === 0) { Toast.error('Enter a quantity on at least one line'); return; }

    const btn = document.getElementById('cf-save');
    this._saving = true;
    btn.disabled = true; btn.textContent = 'Issuing…';

    try {
      const res = await CreditNoteService.issue({
        invoice: this._invoice,
        customer: { id: this._invoice.customerId, name: this._invoice.customerName, gstin: this._invoice.customerGstin },
        lines,
        reason:   document.getElementById('cf-reason')?.value,
        noteDate: document.getElementById('cf-date')?.value,
        notes:    document.getElementById('cf-notes')?.value,
        interState: !!this._invoice.interState || !!this._invoice.igst,
        refund:   document.getElementById('cf-settle')?.value === 'refund',
      });

      (res.warnings || []).forEach(w => Toast.warning(w));
      Toast.success(`Credit note ${res.noteNumber} issued · ${money(res.totals.grandTotal)}`);
      Router.navigate('/credit-notes');
    } catch (e) {
      Toast.error('Failed: ' + e.message);
      this._saving = false;
      btn.disabled = false; btn.textContent = 'Issue credit note';
    }
  },
};

export default CreditNoteForm;
