/**
 * stock-modal.js — Stock In / Stock Out / Stock Count dialog
 *
 * Shared by the inventory list, the item page and the product form. Every
 * submit goes through InventoryService.recordMovement(), so the ledger and the
 * balance can never drift apart.
 */

import Toast from '../../components/Toast.js';
import Icon  from '../../utils/icons.js';
import { STOCK_REASONS_IN, STOCK_REASONS_OUT, DEFAULT_WAREHOUSE } from '../../utils/constants.js';
import { formatCurrency } from '../../utils/formatters.js';
import InventoryService from './inventory.service.js';

const MODES = {
  in:     { title: 'Stock in',    verb: 'Add stock',     accent: '#059669', bg: '#ECFDF5', border: '#A7F3D0' },
  out:    { title: 'Stock out',   verb: 'Issue stock',   accent: '#DC2626', bg: '#FEF2F2', border: '#FECACA' },
  adjust: { title: 'Stock count', verb: 'Apply count',   accent: '#2563EB', bg: '#EFF6FF', border: '#BFDBFE' },
};

const esc = (s) => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

const StockModal = {
  _mode: 'in', _items: [], _warehouses: [], _selected: null, _onDone: null,

  /**
   * @param {object} opts
   *   mode        'in' | 'out' | 'adjust'
   *   item        pre-selected product (optional)
   *   items       candidate products — fetched when omitted
   *   warehouses  locations — fetched when omitted
   *   onDone      callback(movement) after a successful post
   */
  async open(opts = {}) {
    this._mode     = MODES[opts.mode] ? opts.mode : 'in';
    this._onDone   = opts.onDone || null;
    this._items      = opts.items      || await InventoryService.listItems();
    this._warehouses = opts.warehouses || await InventoryService.listWarehouses();
    this._selected   = opts.item ? InventoryService.decorate(opts.item) : null;

    if (this._items.length === 0 && !this._selected) {
      Toast.error('No tracked items yet. Turn on stock tracking on a product first.');
      return;
    }

    this._render(!!opts.item);
    window.StockModal = this;
  },

  close() { document.getElementById('__stock-modal')?.remove(); },

  _render(locked) {
    this.close();
    const cfg   = MODES[this._mode];
    const item  = this._selected;
    const reasons = this._mode === 'in' ? STOCK_REASONS_IN : this._mode === 'out' ? STOCK_REASONS_OUT : [{ id: 'adjustment', label: 'Stock count adjustment' }];
    const today = new Date().toISOString().split('T')[0];

    const wrap = document.createElement('div');
    wrap.id = '__stock-modal';
    wrap.style.cssText = 'position:fixed;inset:0;background:rgba(15,20,32,0.45);z-index:500;display:flex;align-items:center;justify-content:center;padding:20px;overflow-y:auto;';
    wrap.innerHTML = `
      <div style="background:white;border-radius:16px;width:100%;max-width:480px;box-shadow:0 20px 60px rgba(0,0,0,0.18);overflow:hidden;" onclick="event.stopPropagation()">

        <div style="padding:15px 18px;border-bottom:1px solid #F1F5F9;display:flex;align-items:center;justify-content:space-between;gap:10px;">
          <div style="display:flex;align-items:center;gap:10px;">
            <div style="width:32px;height:32px;border-radius:9px;background:${cfg.bg};color:${cfg.accent};display:flex;align-items:center;justify-content:center;">
              ${this._mode === 'in' ? Icon.arrowDownIn(16) : this._mode === 'out' ? Icon.arrowUpOut(16) : Icon.sliders(16)}
            </div>
            <div>
              <div style="font-size:15px;font-weight:700;color:#0F172A;">${cfg.title}</div>
              <div style="font-size:11.5px;color:#64748B;">${this._mode === 'adjust' ? 'Correct the balance to a physical count' : 'Posts an entry to the stock ledger'}</div>
            </div>
          </div>
          <button onclick="StockModal.close()" style="width:28px;height:28px;border-radius:8px;border:none;background:#F1F5F9;cursor:pointer;color:#64748B;display:flex;align-items:center;justify-content:center;flex-shrink:0;">${Icon.x(14)}</button>
        </div>

        <form id="stock-form" style="padding:16px 18px 18px;">

          <!-- Item -->
          <div class="form-group mb-3">
            <label class="form-label">Item *</label>
            ${locked && item ? `
              <div style="display:flex;align-items:center;gap:10px;padding:9px 11px;border:1px solid #E2E8F0;border-radius:9px;background:#F8FAFC;">
                <div style="width:28px;height:28px;border-radius:8px;background:#EEF2FF;color:#3730A3;display:flex;align-items:center;justify-content:center;">${Icon.box(14)}</div>
                <div style="min-width:0;flex:1;">
                  <div style="font-size:13px;font-weight:600;color:#0F172A;">${esc(item.name)}</div>
                  <div style="font-size:11px;color:#64748B;">${esc(item.sku || item.hsn || '')}</div>
                </div>
              </div>
              <input type="hidden" name="productId" value="${esc(item.id)}" />
            ` : `
              <select class="select" name="productId" id="stk-item" required>
                <option value="">Select item…</option>
                ${this._items.map(p => `<option value="${esc(p.id)}" ${item?.id === p.id ? 'selected' : ''}>${esc(p.name)}${p.sku ? ` · ${esc(p.sku)}` : ''}</option>`).join('')}
              </select>
            `}
          </div>

          <!-- Live balance -->
          <div id="stk-balance" style="display:${item ? 'flex' : 'none'};align-items:center;justify-content:space-between;gap:8px;padding:9px 12px;border-radius:9px;background:${cfg.bg};border:1px solid ${cfg.border};margin-bottom:12px;font-size:12.5px;color:#0F172A;"></div>

          <div class="form-row mb-3">
            <div class="form-group">
              <label class="form-label">${this._mode === 'adjust' ? 'Counted quantity *' : 'Quantity *'}</label>
              <input class="input" type="number" name="qty" id="stk-qty" step="0.001" min="${this._mode === 'adjust' ? '0' : '0.001'}" placeholder="0" required autocomplete="off" />
            </div>
            <div class="form-group">
              <label class="form-label">${this._mode === 'in' ? 'Cost per unit (₹)' : 'Rate (₹)'}</label>
              <div class="input-wrapper"><span class="input-rupee-prefix">₹</span>
                <input class="input input-rupee" type="number" name="rate" id="stk-rate" step="0.01" min="0" placeholder="0.00"
                  ${this._mode === 'in' ? '' : 'readonly style="background:#F8FAFC;"'} />
              </div>
              <div class="form-hint">${this._mode === 'in' ? 'Updates the average cost' : 'Valued at average cost'}</div>
            </div>
          </div>

          <div class="form-row mb-3">
            <div class="form-group">
              <label class="form-label">Reason *</label>
              <select class="select" name="reason" required>
                ${reasons.map(r => `<option value="${r.id}">${r.label}</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Location</label>
              <select class="select" name="warehouseId">
                ${this._warehouses.map(w => `<option value="${esc(w.id)}">${esc(w.name)}</option>`).join('')}
              </select>
            </div>
          </div>

          <div class="form-row mb-3">
            <div class="form-group">
              <label class="form-label">Date</label>
              <input class="input" type="date" name="date" value="${today}" />
            </div>
            <div class="form-group">
              <label class="form-label">Reference no.</label>
              <input class="input" name="refNumber" placeholder="GRN / bill / challan" autocomplete="off" />
            </div>
          </div>

          <div class="form-group mb-4">
            <label class="form-label">Notes</label>
            <input class="input" name="notes" placeholder="Optional" autocomplete="off" />
          </div>

          <div style="display:flex;gap:8px;">
            <button type="button" class="btn btn-secondary" style="flex:1;" onclick="StockModal.close()">Cancel</button>
            <button type="submit" id="stk-submit" class="btn btn-primary" style="flex:1.4;background:${cfg.accent};border-color:${cfg.accent};">${cfg.verb}</button>
          </div>
        </form>
      </div>
    `;

    document.body.appendChild(wrap);
    wrap.addEventListener('click', (e) => { if (e.target === wrap) this.close(); });

    document.getElementById('stk-item')?.addEventListener('change', (e) => {
      this._selected = this._items.find(p => p.id === e.target.value) || null;
      this._syncBalance();
    });
    document.getElementById('stk-qty')?.addEventListener('input', () => this._syncBalance());
    document.getElementById('stock-form')?.addEventListener('submit', (e) => this._submit(e));

    this._syncBalance();
    (document.getElementById('stk-item') || document.getElementById('stk-qty'))?.focus();
  },

  /** Keeps the balance strip and the default rate in step with the selection. */
  _syncBalance() {
    const box  = document.getElementById('stk-balance');
    const item = this._selected;
    if (!box) return;
    if (!item) { box.style.display = 'none'; return; }

    const unit  = item.unit || 'Nos';
    const qty   = parseFloat(document.getElementById('stk-qty')?.value) || 0;
    const after = this._mode === 'adjust' ? qty
                : this._mode === 'in'     ? item.stockQty + qty
                                          : item.stockQty - qty;
    const diff  = this._mode === 'adjust' ? Math.round((qty - item.stockQty) * 1000) / 1000 : null;

    const rateInput = document.getElementById('stk-rate');
    if (rateInput && !rateInput.dataset.touched) {
      rateInput.value = this._mode === 'in' ? (item.purchaseRate || item.avgCost || '') : (item.avgCost || 0);
      rateInput.addEventListener('input', () => { rateInput.dataset.touched = '1'; }, { once: true });
    }

    box.style.display = 'flex';
    box.innerHTML = `
      <span style="color:#475569;">In stock now <strong style="color:#0F172A;">${item.stockQty} ${esc(unit)}</strong>
        <span style="color:#94A3B8;">· avg ₹${formatCurrency(item.avgCost || 0)}</span></span>
      <span style="font-weight:700;color:${after < 0 ? '#DC2626' : '#0F172A'};">
        ${qty ? `→ ${Math.round(after * 1000) / 1000} ${esc(unit)}${diff !== null && diff !== 0 ? ` (${diff > 0 ? '+' : ''}${diff})` : ''}` : ''}
      </span>`;
  },

  async _submit(e) {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target));
    const btn  = document.getElementById('stk-submit');
    if (!data.productId) { Toast.error('Select an item'); return; }

    const wh = this._warehouses.find(w => w.id === data.warehouseId) || DEFAULT_WAREHOUSE;
    btn?.classList.add('loading');
    if (btn) btn.disabled = true;

    try {
      const movement = await InventoryService.recordMovement({
        productId:     data.productId,
        mode:          this._mode === 'adjust' ? 'set' : 'delta',
        type:          this._mode === 'out' ? 'out' : 'in',
        qty:           data.qty,
        targetQty:     data.qty,
        rate:          this._mode === 'in' ? data.rate : '',
        reason:        data.reason,
        warehouseId:   wh.id,
        warehouseName: wh.name,
        date:          data.date,
        refType:       'manual',
        refNumber:     data.refNumber || null,
        notes:         data.notes || null,
      });

      const sign = movement.type === 'in' ? '+' : '−';
      Toast.success(`${movement.productName}: ${sign}${movement.qty} ${movement.unit} · balance ${movement.balanceAfter}`);

      try {
        const { default: Notifs } = await import('../../components/Notifications.js');
        await Notifs.log('inventory', `Stock ${movement.type === 'in' ? 'in' : 'out'} · ${movement.productName} ${sign}${movement.qty} ${movement.unit} (${InventoryService.reasonLabel(movement.reason)})`);
      } catch (err) { /* non-critical */ }

      this.close();
      if (this._onDone) this._onDone(movement);
    } catch (err) {
      btn?.classList.remove('loading');
      if (btn) btn.disabled = false;
      Toast.error(err.message || 'Could not post the movement');
    }
  },
};

export default StockModal;
