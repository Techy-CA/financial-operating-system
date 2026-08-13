/**
 * receipt.js — Thermal receipt renderer
 *
 * Builds an 58mm/80mm receipt and prints it through a hidden iframe rather than
 * window.open, so a blocked popup can never swallow a sale that has already been
 * charged. The same markup doubles as the on-screen preview.
 *
 * Widths are set in mm with an @page rule; thermal drivers honour this and cut
 * to the roll. Everything is monospace so columns line up on a dot-matrix head.
 */

import { formatCurrency } from '../../utils/formatters.js';
import { POS_TENDER_MAP } from '../../utils/constants.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const money = (v) => formatCurrency(v, { symbol: false });

/** Receipt paper presets. `chars` is the usable monospace column count. */
export const PAPER = {
  '58mm': { width: 58, pad: 2, font: 10,   chars: 32 },
  '80mm': { width: 80, pad: 3, font: 11.5, chars: 42 },
};

/**
 * @param sale     result object returned by PosService.checkout()
 * @param company  Store.get('company')
 * @param opts     { paper:'80mm'|'58mm', footerNote, showGstBreakup }
 */
export function receiptHTML(sale, company = {}, opts = {}) {
  const p = PAPER[opts.paper] || PAPER['80mm'];
  const t = sale.totals || {};
  const showGst = opts.showGstBreakup !== false && (t.taxTotal || 0) > 0;

  const line = (label, value, bold = false) => `
    <div class="row${bold ? ' b' : ''}">
      <span class="l">${esc(label)}</span>
      <span class="r">${esc(value)}</span>
    </div>`;

  const items = (sale.itemsSnapshot || []).map((i, n) => `
    <div class="item">
      <div class="item-name">${n + 1}. ${esc(i.description)}</div>
      <div class="row">
        <span class="l">${i.qty} ${esc(i.unit || '')} × ${money(i.rate)}${i.discount ? `  (-${i.discount}%)` : ''}</span>
        <span class="r">${money(i.lineTotal)}</span>
      </div>
    </div>`).join('');

  const tenders = (sale.payments || []).filter(x => Number(x.amount) > 0).map(x =>
    line(POS_TENDER_MAP[x.method]?.label || x.method, money(x.amount))
  ).join('');

  const gstRows = showGst ? (t.taxGroups || []).map(g => `
    <tr><td>${g.rate}%</td><td class="ta-r">${money(g.taxable)}</td><td class="ta-r">${money(g.tax / 2)}</td><td class="ta-r">${money(g.tax / 2)}</td></tr>
  `).join('') : '';

  const changeDue = Math.max(0, (sale.paid || 0) - (t.grandTotal || 0));

  return `
<style>
  @page { size: ${p.width}mm auto; margin: 0; }
  * { box-sizing: border-box; }
  body { margin: 0; }
  .rcpt {
    width: ${p.width}mm; padding: ${p.pad}mm;
    font-family: 'JetBrains Mono', 'Courier New', monospace;
    font-size: ${p.font}px; line-height: 1.45; color: #000; background: #fff;
    -webkit-font-smoothing: none;
  }
  .rcpt .c  { text-align: center; }
  .rcpt .b  { font-weight: 700; }
  .rcpt .lg { font-size: ${p.font + 3}px; font-weight: 700; }
  .rcpt .sm { font-size: ${p.font - 1.5}px; }
  .rcpt hr  { border: none; border-top: 1px dashed #000; margin: 5px 0; }
  .rcpt .row { display: flex; justify-content: space-between; gap: 6px; }
  .rcpt .row .l { flex: 1; min-width: 0; word-break: break-word; }
  .rcpt .row .r { white-space: nowrap; }
  .rcpt .item { margin-bottom: 3px; }
  .rcpt .item-name { font-weight: 600; word-break: break-word; }
  .rcpt table { width: 100%; border-collapse: collapse; font-size: ${p.font - 1.5}px; }
  .rcpt th, .rcpt td { padding: 1px 0; text-align: left; }
  .rcpt .ta-r { text-align: right; }
  .rcpt .total-box { border-top: 1px solid #000; border-bottom: 1px solid #000; padding: 3px 0; margin: 4px 0; }
</style>

<div class="rcpt">
  <div class="c">
    <div class="lg">${esc(company.name || 'FinOS Store')}</div>
    ${company.address ? `<div class="sm">${esc(company.address)}</div>` : ''}
    ${company.phone   ? `<div class="sm">Ph: ${esc(company.phone)}</div>` : ''}
    ${company.gstin   ? `<div class="sm">GSTIN: ${esc(company.gstin)}</div>` : ''}
  </div>

  <hr />
  <div class="c b">TAX INVOICE</div>
  <hr />

  ${line('Bill No', sale.invoiceNumber || '—')}
  ${line('Date', new Date(sale.date || Date.now()).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }))}
  ${line('Customer', sale.customer?.name || 'Walk-in')}
  ${sale.customer?.phone ? line('Phone', sale.customer.phone) : ''}
  ${sale.customer?.gstin ? line('GSTIN', sale.customer.gstin) : ''}

  <hr />
  ${items}
  <hr />

  ${line(`Subtotal (${t.totalQty || 0} qty)`, money(t.subTotal))}
  ${(t.lineDiscount || 0) > 0 ? line('Item discount', '-' + money(t.lineDiscount)) : ''}
  ${(t.billDiscount || 0) > 0 ? line('Bill discount', '-' + money(t.billDiscount)) : ''}
  ${(t.taxTotal || 0) > 0 && !t.interState ? line('CGST', money(t.cgst)) + line('SGST', money(t.sgst)) : ''}
  ${(t.taxTotal || 0) > 0 &&  t.interState ? line('IGST', money(t.igst)) : ''}
  ${Math.abs(t.roundOff || 0) >= 0.01 ? line('Round off', (t.roundOff > 0 ? '+' : '') + money(t.roundOff)) : ''}

  <div class="total-box">
    <div class="row lg"><span class="l">TOTAL</span><span class="r">${esc('₹' + money(t.grandTotal))}</span></div>
  </div>

  ${tenders}
  ${changeDue > 0.009 ? line('CHANGE', money(changeDue), true) : ''}
  ${(sale.balance || 0) > 0.5 ? line('BALANCE DUE', money(sale.balance), true) : ''}

  ${showGst ? `
    <hr />
    <div class="sm b">GST SUMMARY</div>
    <table>
      <thead><tr><th>Rate</th><th class="ta-r">Taxable</th><th class="ta-r">CGST</th><th class="ta-r">SGST</th></tr></thead>
      <tbody>${gstRows}</tbody>
    </table>` : ''}

  <hr />
  <div class="c sm">
    ${opts.footerNote ? `<div>${esc(opts.footerNote)}</div>` : '<div>Thank you for your business!</div>'}
    <div style="margin-top:3px;">Goods once sold are subject to store policy.</div>
    <div style="margin-top:5px;">— FinOS —</div>
  </div>
</div>`;
}

/**
 * Prints without leaving the terminal. The iframe is removed after the print
 * dialog settles; the sale is already saved either way.
 */
export function printReceipt(sale, company, opts = {}) {
  document.getElementById('__rcpt-frame')?.remove();

  const frame = document.createElement('iframe');
  frame.id = '__rcpt-frame';
  frame.setAttribute('aria-hidden', 'true');
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;';
  document.body.appendChild(frame);

  const doc = frame.contentWindow.document;
  doc.open();
  doc.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(sale.invoiceNumber || 'Receipt')}</title></head><body>${receiptHTML(sale, company, opts)}</body></html>`);
  doc.close();

  const go = () => {
    try { frame.contentWindow.focus(); frame.contentWindow.print(); }
    catch (e) { console.warn('[Receipt]', e.message); }
    setTimeout(() => frame.remove(), 1500);
  };
  // Give the webfont a beat to land so columns don't reflow mid-print
  if (doc.readyState === 'complete') setTimeout(go, 220);
  else frame.onload = () => setTimeout(go, 220);
}

export default { receiptHTML, printReceipt, PAPER };
