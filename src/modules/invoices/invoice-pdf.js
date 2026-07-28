import Store from '../../core/store.js';
import { formatCurrency, formatDate } from '../../utils/formatters.js';
import { amountInWords } from './gst-calculator.js';
import Icon from '../../utils/icons.js';

/**
 * 3 professional invoice templates:
 * 1. Classic Blue  — traditional Indian invoice (like the reference image)
 * 2. Modern Dark   — dark header accent, clean lines
 * 3. Minimal Clean — white, elegant, minimal
 */

export function generateInvoicePDF(invoice, items, template = 1) {
  const company = Store.get('company') || {};
  const lineItems = items || invoice.items || [];

  const templates = [classicBlue, modernDark, minimalClean];
  const fn = templates[template - 1] || classicBlue;
  const html = fn(invoice, lineItems, company);

  const win = window.open('', '_blank');
  if (win) { win.document.write(html); win.document.close(); }
  else      alert('Popup blocked — please allow popups');
}

function commonCSS(accent, accentText='white') {
  return `
    * { box-sizing:border-box; margin:0; padding:0; }
    body { font-family:Arial,Helvetica,sans-serif; font-size:11px; color:#1a1a1a; background:white; }
    .page { max-width:210mm; margin:0 auto; padding:8mm 10mm; }
    table { width:100%; border-collapse:collapse; }
    th { padding:5px 6px; font-size:9.5px; font-weight:700; }
    td { padding:5px 6px; }
    .num { text-align:right; }
    .total-row td { font-size:14px; font-weight:800; padding:7px 8px; }
    .footer { text-align:center; font-size:8.5px; color:#888; margin-top:10px; border-top:1px solid #eee; padding-top:6px; }
    @media print { .no-print { display:none!important; } body { -webkit-print-color-adjust:exact; print-color-adjust:exact; } }
  `;
}

function printBar() {
  return `<div class="no-print" style="text-align:right;padding:8px 0 12px;display:flex;gap:8px;justify-content:flex-end;">
    <button onclick="window.print()" style="padding:8px 18px;background:#1a3a6b;color:white;border:none;border-radius:6px;cursor:pointer;font-size:13px;font-weight:600;display:inline-flex;align-items:center;gap:7px;">${Icon.printer(15)} Print / Save PDF</button>
    <button onclick="window.close()" style="padding:8px 14px;background:#f1f5f9;color:#374151;border:1px solid #e2e8f0;border-radius:6px;cursor:pointer;font-size:13px;">Close</button>
  </div>`;
}

function lineItemRows(items, inv) {
  return items.map((item,i) => {
    const qty=parseFloat(item.qty)||0, rate=parseFloat(item.rate)||0;
    const disc=parseFloat(item.discount)||0;
    const netRate=rate*(1-disc/100), taxable=qty*netRate;
    const gstRate=parseFloat(item.gstRate)||0, gstAmt=taxable*gstRate/100;
    const total=taxable+gstAmt;
    const taxLabel=inv.interState?`IGST ${gstRate}% = ${formatCurrency(gstAmt)}`:`CGST ${gstRate/2}% + SGST ${gstRate/2}% = ${formatCurrency(gstAmt)}`;
    return {i,item,qty,rate,disc,netRate,taxable,gstAmt,total,taxLabel};
  });
}

function classicBlue(inv, lineItems, co) {
  const rows = lineItemRows(lineItems, inv);
  const grandTotal = Math.round(inv.grandTotal||0);
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"/><title>${inv.invoiceNumber}</title>
  <style>${commonCSS('#1a3a6b')}
    .hdr { background:#1a3a6b; color:white; padding:7px 12px; display:flex; align-items:center; justify-content:space-between; }
    .hdr-title { font-size:15px; font-weight:700; letter-spacing:2px; }
    .hdr-meta { display:flex; gap:20px; font-size:10.5px; }
    .top { display:flex; justify-content:space-between; align-items:flex-start; padding:10px 0 8px; border-bottom:1px solid #ddd; }
    .bill-grid { display:grid; grid-template-columns:1fr 1fr 1fr; border:1px solid #ccc; margin:8px 0; }
    .bill-col { padding:8px 10px; border-right:1px solid #ccc; }
    .bill-col:last-child { border-right:none; }
    .bill-lbl { font-size:9px; font-weight:700; color:#1a3a6b; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:5px; border-bottom:1px solid #eee; padding-bottom:3px; }
    .bill-field { display:flex; justify-content:space-between; font-size:9.5px; margin-bottom:2px; }
    .items-hdr th { background:#1a3a6b; color:white; }
    .sub-row td { border-top:1px solid #ccc; }
    .total-row { background:#1a3a6b; color:white; }
    .bottom { display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-top:8px; }
    .remarks { border:1px solid #ccc; border-radius:3px; padding:8px 10px; }
    .remarks h4 { font-size:10px; font-weight:700; color:#1a3a6b; margin-bottom:6px; }
    .sign { text-align:right; }
    .sign-line { border-top:1px solid #333; width:140px; margin-left:auto; margin-top:36px; }
  </style></head><body><div class="page">
  ${printBar()}
  <div class="hdr"><div class="hdr-title">INVOICE</div><div class="hdr-meta"><span><strong>${inv.invoiceNumber}</strong></span><span>${formatDate(inv.invoiceDate)}</span></div></div>
  <div class="top">
    <div style="display:flex;align-items:center;gap:10px;">
      ${co.logoDataUrl?`<img src="${co.logoDataUrl}" style="height:44px;object-fit:contain;" />`:''}
      <div style="font-size:17px;font-weight:700;color:#1a3a6b;">${co.name||''}</div>
    </div>
    <div style="text-align:right;font-size:9.5px;color:#333;line-height:1.7;">
      ${co.website?`<div style="color:#1a3a6b;font-weight:600;">${co.website}</div>`:''}
      ${co.address?`<div>${co.address}</div>`:''}
      ${[co.city,co.state,co.pincode].filter(Boolean).join(', ')?`<div>${[co.city,co.state,co.pincode].filter(Boolean).join(', ')}</div>`:''}
      ${co.phone?`<div>Contact: ${co.phone}</div>`:''}
      ${co.email?`<div>Email: ${co.email}</div>`:''}
      ${co.gstin?`<div>GSTIN: ${co.gstin}</div>`:''}
    </div>
  </div>
  <div class="bill-grid">
    <div class="bill-col"><div class="bill-lbl">To</div><div style="font-size:12px;font-weight:700;margin-bottom:3px;">${inv.customerName||'—'}</div><div style="font-size:9.5px;color:#333;line-height:1.5;">${inv.customerAddress||''}</div>${inv.customerGSTIN?`<div style="font-size:9px;margin-top:3px;">GSTIN: <strong>${inv.customerGSTIN}</strong></div>`:''}</div>
    <div class="bill-col"><div class="bill-lbl">Shipping address</div><div style="font-size:12px;font-weight:700;margin-bottom:3px;">${inv.customerName||'—'}</div><div style="font-size:9.5px;color:#333;line-height:1.5;">${inv.shippingAddress||inv.customerAddress||''}</div></div>
    <div class="bill-col"><div class="bill-lbl">Invoice details</div><div class="bill-field"><label>Due Date:</label><span>${formatDate(inv.dueDate)}</span></div>${inv.invoiceCategory?`<div class="bill-field"><label>Type:</label><span>${inv.invoiceCategory}</span></div>`:''}<div class="bill-field"><label>Place of Supply:</label><span>${inv.placeOfSupply||'—'}</span></div><div class="bill-field"><label>Supply Type:</label><span>${inv.interState?'Inter-state':'Intra-state'}</span></div></div>
  </div>
  <table><thead class="items-hdr"><tr><th>Items</th><th>HSN/SAC</th><th class="num">Rate</th><th class="num">Disc</th><th class="num">Net Rate</th><th class="num">Qty</th><th class="num">Taxable</th><th>Tax</th><th class="num">Amount</th></tr></thead><tbody>
    ${rows.map(r=>`<tr><td><strong>${r.item.description||'—'}</strong></td><td>${r.item.hsn||'—'}</td><td class="num">${formatCurrency(r.rate)}</td><td class="num">${r.disc}%</td><td class="num">${formatCurrency(r.netRate)}</td><td class="num">${r.qty} ${r.item.unit||''}</td><td class="num">${formatCurrency(r.taxable)}</td><td style="font-size:9px;">${r.taxLabel}</td><td class="num"><strong>${formatCurrency(r.total)}</strong></td></tr>`).join('')}
  </tbody><tfoot>
    <tr class="sub-row"><td colspan="6" class="num" style="color:#666;">Subtotal</td><td class="num">${formatCurrency(inv.totalTaxable||0)}</td><td class="num">${formatCurrency(inv.totalGST||0)}</td><td class="num">${formatCurrency((inv.totalTaxable||0)+(inv.totalGST||0))}</td></tr>
    ${(inv.totalDiscount||0)>0?`<tr><td colspan="8" class="num">Discount</td><td class="num" style="color:red;">-${formatCurrency(inv.totalDiscount)}</td></tr>`:''}
    <tr><td colspan="8" class="num" style="font-size:9px;color:#666;">Round off</td><td class="num" style="font-size:9px;">${formatCurrency(grandTotal-(inv.grandTotal||0))}</td></tr>
    <tr class="total-row"><td colspan="6">TOTAL</td><td colspan="3" class="num">₹ ${formatCurrency(grandTotal)}</td></tr>
  </tfoot></table>
  <div style="font-size:9.5px;margin:6px 0;"><strong>Amount in words:</strong> ${amountInWords(grandTotal)}</div>
  <div class="bottom">
    <div class="remarks"><h4>Remarks</h4>
      ${co.bankName?`<p style="font-size:9.5px;margin-bottom:4px;"><strong>Bank: ${co.bankName}</strong></p>`:''}
      ${co.bankAccountNo?`<p style="font-size:9.5px;">A/c: ${co.bankAccountNo}</p>`:''}
      ${co.bankIFSC?`<p style="font-size:9.5px;">IFSC: ${co.bankIFSC}</p>`:''}
      ${co.bankBranch?`<p style="font-size:9.5px;">Branch: ${co.bankBranch}</p>`:''}
      ${co.bankAccountType?`<p style="font-size:9.5px;">Type: ${co.bankAccountType}</p>`:''}
      ${co.upiId?`<p style="font-size:9.5px;margin-top:4px;">UPI: <strong>${co.upiId}</strong></p>`:''}
      ${co.razorpayLink?`<p style="font-size:9.5px;">Pay: <a href="${co.razorpayLink}" style="color:#1a3a6b;font-weight:600;">${co.razorpayLink}</a></p>`:''}
      ${co.paymentRemarks?`<p style="font-size:9.5px;margin-top:4px;">${co.paymentRemarks}</p>`:''}
      ${inv.notes?`<p style="font-size:9.5px;margin-top:6px;">${inv.notes}</p>`:''}
    </div>
    <div class="sign">
      ${co.qrDataUrl?`<img src="${co.qrDataUrl}" style="height:70px;object-fit:contain;display:block;margin-left:auto;margin-bottom:6px;" />`:''}
      <div style="font-size:9px;color:#555;background:#f5f5f5;padding:6px;border-radius:3px;text-align:left;">₹ ${amountInWords(grandTotal)}</div>
      ${co.signatureDataUrl?`<img src="${co.signatureDataUrl}" style="height:36px;object-fit:contain;display:block;margin-left:auto;margin-top:8px;" />`:`<div class="sign-line"></div>`}
      <div style="font-size:12px;font-weight:700;margin-top:4px;">${co.signatoryName||co.name||''}</div>
      <div style="font-size:9px;color:#555;">Authorized Signatory</div>
    </div>
  </div>
  ${inv.terms?`<div style="font-size:9px;color:#555;margin-top:6px;padding:6px;background:#f9f9f9;"><strong>Terms:</strong> ${inv.terms}</div>`:''}
  <div class="footer">${co.name||''} · ${co.gstin||''} · Computer generated invoice</div>
  </div></body></html>`;
}

function modernDark(inv, lineItems, co) {
  const rows=lineItemRows(lineItems,inv), gt=Math.round(inv.grandTotal||0);
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"/><title>${inv.invoiceNumber}</title>
  <style>${commonCSS('#0F172A')}
    .hdr { background:#0F172A; color:white; padding:20px 24px; display:grid; grid-template-columns:1fr auto; gap:20px; }
    .hdr-badge { background:#3B82F6; color:white; display:inline-block; font-size:10px; font-weight:700; padding:3px 10px; border-radius:99px; letter-spacing:1px; margin-bottom:10px; }
    .hdr-num { font-size:24px; font-weight:800; letter-spacing:-0.5px; }
    .hdr-right { text-align:right; }
    .hdr-co-name { font-size:20px; font-weight:700; color:white; }
    .hdr-co-detail { font-size:9.5px; color:#94A3B8; line-height:1.7; margin-top:6px; }
    .hdr-logo { height:38px; object-fit:contain; display:block; margin-bottom:8px; filter:brightness(0) invert(1); }
    .meta-bar { display:flex; gap:0; border:1px solid #E2E8F0; border-radius:0; margin:16px 0; overflow:hidden; }
    .meta-cell { flex:1; padding:10px 14px; border-right:1px solid #E2E8F0; }
    .meta-cell:last-child { border-right:none; }
    .meta-label { font-size:9px; font-weight:700; text-transform:uppercase; letter-spacing:0.8px; color:#94A3B8; margin-bottom:4px; }
    .meta-val { font-size:12px; font-weight:600; color:#0F172A; }
    .items-hdr th { background:#0F172A; color:white; }
    .alt-row { background:#F8FAFC; }
    .total-row { background:#0F172A; color:white; }
    .bill-grid { display:grid; grid-template-columns:1fr 1fr; gap:16px; margin:16px 0; }
    .bill-box { background:#F8FAFC; border-radius:8px; padding:12px; }
    .bill-box-lbl { font-size:9px; font-weight:700; text-transform:uppercase; letter-spacing:0.8px; color:#64748B; margin-bottom:6px; }
  </style></head><body><div class="page">
  ${printBar()}
  <div class="hdr">
    <div>
      <div class="hdr-badge">TAX INVOICE</div>
      <div class="hdr-num">${inv.invoiceNumber}</div>
      <div style="font-size:11px;color:#94A3B8;margin-top:4px;">${formatDate(inv.invoiceDate)}</div>
    </div>
    <div class="hdr-right">
      ${co.logoDataUrl?`<img src="${co.logoDataUrl}" class="hdr-logo" />`:''}
      <div class="hdr-co-name">${co.name||''}</div>
      <div class="hdr-co-detail">
        ${co.website?`<div>${co.website}</div>`:''}
        ${co.address?`<div>${co.address}</div>`:''}
        ${co.phone?`<div>${co.phone}</div>`:''}
        ${co.gstin?`<div>GSTIN: ${co.gstin}</div>`:''}
      </div>
    </div>
  </div>

  <div class="bill-grid">
    <div class="bill-box"><div class="bill-box-lbl">Bill to</div><div style="font-size:13px;font-weight:700;">${inv.customerName||'—'}</div>${inv.customerAddress?`<div style="font-size:10px;color:#64748B;margin-top:4px;line-height:1.6;">${inv.customerAddress}</div>`:''} ${inv.customerGSTIN?`<div style="font-size:10px;margin-top:4px;">GSTIN: <strong>${inv.customerGSTIN}</strong></div>`:''}</div>
    <div class="bill-box"><div class="bill-box-lbl">Invoice details</div>
      <div style="display:flex;flex-direction:column;gap:5px;font-size:10px;">
        <div style="display:flex;justify-content:space-between;"><span style="color:#64748B;">Due date</span><strong>${formatDate(inv.dueDate)}</strong></div>
        ${inv.invoiceCategory?`<div style="display:flex;justify-content:space-between;"><span style="color:#64748B;">Category</span><strong>${inv.invoiceCategory}</strong></div>`:''}
        <div style="display:flex;justify-content:space-between;"><span style="color:#64748B;">Place of supply</span><strong>${inv.placeOfSupply||'—'}</strong></div>
        <div style="display:flex;justify-content:space-between;"><span style="color:#64748B;">Type</span><strong>${inv.interState?'Inter-state':'Intra-state'}</strong></div>
      </div>
    </div>
  </div>

  <table><thead class="items-hdr"><tr><th>#</th><th>Description</th><th>HSN/SAC</th><th class="num">Qty</th><th class="num">Rate</th><th class="num">Taxable</th><th class="num">GST</th><th class="num">Amount</th></tr></thead><tbody>
    ${rows.map((r,i)=>`<tr ${i%2===1?'class="alt-row"':''}><td>${i+1}</td><td><strong>${r.item.description||'—'}</strong>${r.item.hsn?`<div style="font-size:9px;color:#64748B;">${r.item.hsn}</div>`:''}</td><td>${r.item.hsn||'—'}</td><td class="num">${r.qty} ${r.item.unit||''}</td><td class="num">${formatCurrency(r.rate)}</td><td class="num">${formatCurrency(r.taxable)}</td><td class="num" style="font-size:9px;">${formatCurrency(r.gstAmt)}<div style="font-size:8px;color:#64748B;">${inv.interState?`IGST ${r.item.gstRate}%`:`CGST+SGST ${r.item.gstRate}%`}</div></td><td class="num"><strong>${formatCurrency(r.total)}</strong></td></tr>`).join('')}
  </tbody><tfoot>
    <tr style="border-top:2px solid #E2E8F0;"><td colspan="5" class="num" style="color:#64748B;">Subtotal</td><td class="num">${formatCurrency(inv.totalTaxable||0)}</td><td class="num">${formatCurrency(inv.totalGST||0)}</td><td class="num">${formatCurrency((inv.totalTaxable||0)+(inv.totalGST||0))}</td></tr>
    <tr class="total-row"><td colspan="5">TOTAL</td><td colspan="3" class="num" style="font-size:16px;">₹ ${formatCurrency(gt)}</td></tr>
  </tfoot></table>
  <div style="font-size:9.5px;margin:8px 0;padding:8px;background:#F8FAFC;border-radius:6px;"><strong>Amount in words:</strong> ${amountInWords(gt)}</div>

  <div style="display:grid;grid-template-columns:1fr auto;gap:16px;margin-top:12px;align-items:end;">
    <div>
      ${co.bankAccountNo?`<div style="background:#F8FAFC;border-radius:8px;padding:10px 12px;font-size:9.5px;margin-bottom:8px;">
        <div style="font-weight:700;font-size:10px;margin-bottom:6px;">BANK DETAILS</div>
        ${co.bankName?`<div>Name: ${co.bankName}</div>`:''}
        ${co.bankAccountNo?`<div>A/c No: ${co.bankAccountNo}</div>`:''}
        ${co.bankIFSC?`<div>IFSC: ${co.bankIFSC} · ${co.bankBranch||''}</div>`:''}
        ${co.upiId?`<div>UPI: ${co.upiId}</div>`:''}
        ${co.razorpayLink?`<div>Pay online: <a href="${co.razorpayLink}" style="color:#3B82F6;">${co.razorpayLink}</a></div>`:''}
      </div>`:''}
      ${inv.notes?`<div style="font-size:9.5px;color:#555;padding:8px;background:#F8FAFC;border-radius:6px;">${inv.notes}</div>`:''}
    </div>
    <div style="text-align:right;min-width:140px;">
      ${co.qrDataUrl?`<img src="${co.qrDataUrl}" style="height:70px;object-fit:contain;display:block;margin:0 0 8px auto;" />`:''}
      ${co.signatureDataUrl?`<img src="${co.signatureDataUrl}" style="height:36px;object-fit:contain;display:block;margin:8px 0 4px auto;" />`:`<div style="border-top:1px solid #1a1a1a;width:120px;margin:40px 0 4px auto;"></div>`}
      <div style="font-size:11px;font-weight:700;">${co.signatoryName||co.name||''}</div>
      <div style="font-size:9px;color:#555;">Authorized Signatory</div>
    </div>
  </div>
  <div class="footer">${co.name} · ${co.gstin||''} · Computer generated invoice</div>
  </div></body></html>`;
}

function minimalClean(inv, lineItems, co) {
  const rows=lineItemRows(lineItems,inv), gt=Math.round(inv.grandTotal||0);
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"/><title>${inv.invoiceNumber}</title>
  <style>${commonCSS('#2563EB')}
    .hdr { padding:20px 0 16px; border-bottom:3px solid #2563EB; display:flex; justify-content:space-between; align-items:flex-start; }
    .inv-title { font-size:32px; font-weight:900; color:#E5E7EB; letter-spacing:-1px; }
    .inv-num { font-size:14px; font-weight:700; color:#2563EB; margin-top:4px; }
    .bill-row { display:grid; grid-template-columns:1fr 1fr 1fr; gap:20px; margin:16px 0; border-top:1px solid #E5E7EB; padding-top:14px; }
    .bill-block label { display:block; font-size:9px; font-weight:700; text-transform:uppercase; letter-spacing:0.8px; color:#9CA3AF; margin-bottom:5px; }
    .bill-block p { font-size:12px; color:#1F2937; line-height:1.5; }
    .items-hdr th { background:transparent; color:#9CA3AF; font-size:9px; letter-spacing:0.5px; text-transform:uppercase; border-bottom:1px solid #E5E7EB; padding:6px; }
    td { border-bottom:1px solid #F3F4F6; }
    .sub-line { border-bottom:none!important; font-size:10px; color:#9CA3AF; }
    .total-row td { background:#2563EB; color:white; border-radius:0; border:none; font-size:15px; padding:8px 6px; }
    .sign-area { display:flex; justify-content:flex-end; margin-top:16px; }
    .sign-block { text-align:right; min-width:150px; }
    .pay-block { background:#F9FAFB; border-left:3px solid #2563EB; padding:10px 12px; font-size:9.5px; margin-top:12px; }
  </style></head><body><div class="page">
  ${printBar()}
  <div class="hdr">
    <div>
      ${co.logoDataUrl?`<img src="${co.logoDataUrl}" style="height:40px;object-fit:contain;display:block;margin-bottom:8px;" />`:''}
      <div style="font-size:16px;font-weight:800;color:#111827;">${co.name||''}</div>
      <div style="font-size:9.5px;color:#6B7280;line-height:1.7;margin-top:4px;">
        ${co.address?`${co.address}<br>`:''}
        ${[co.city,co.state,co.pincode].filter(Boolean).join(', ')}<br>
        ${co.phone?`${co.phone} · `:''} ${co.email||''}<br>
        ${co.gstin?`GSTIN: ${co.gstin}`:''}
      </div>
    </div>
    <div style="text-align:right;">
      <div class="inv-title">INVOICE</div>
      <div class="inv-num">${inv.invoiceNumber}</div>
      <div style="font-size:10px;color:#9CA3AF;margin-top:6px;">Date: ${formatDate(inv.invoiceDate)}</div>
      <div style="font-size:10px;color:#9CA3AF;">Due: <span ${new Date(inv.dueDate)<new Date()?'style="color:#EF4444;font-weight:700;"':''}>${formatDate(inv.dueDate)}</span></div>
    </div>
  </div>

  <div class="bill-row">
    <div class="bill-block"><label>Bill to</label><p><strong>${inv.customerName||'—'}</strong><br>${inv.customerAddress||''}<br>${inv.customerGSTIN?`GSTIN: ${inv.customerGSTIN}`:''}</p></div>
    <div class="bill-block"><label>Details</label><p>${inv.invoiceCategory?`${inv.invoiceCategory}<br>`:''}${inv.placeOfSupply||''}<br>${inv.interState?'Inter-state':'Intra-state'}</p></div>
    <div class="bill-block"><label>Payment</label><p>${co.upiId?`UPI: ${co.upiId}<br>`:''} ${co.bankAccountNo?`A/c: ${co.bankAccountNo}`:''}</p></div>
  </div>

  <table><thead class="items-hdr"><tr><th>#</th><th>Description</th><th>HSN/SAC</th><th class="num">Qty</th><th class="num">Rate</th><th class="num">Taxable</th><th class="num">GST</th><th class="num">Total</th></tr></thead><tbody>
    ${rows.map((r,i)=>`<tr><td>${i+1}</td><td><strong>${r.item.description||'—'}</strong></td><td style="color:#9CA3AF;">${r.item.hsn||'—'}</td><td class="num">${r.qty}</td><td class="num">${formatCurrency(r.rate)}</td><td class="num">${formatCurrency(r.taxable)}</td><td class="num" style="font-size:9px;">${formatCurrency(r.gstAmt)}</td><td class="num"><strong>${formatCurrency(r.total)}</strong></td></tr>`).join('')}
  </tbody><tfoot>
    <tr><td colspan="5" class="num sub-line" style="padding-top:8px;">Subtotal</td><td class="num sub-line">${formatCurrency(inv.totalTaxable||0)}</td><td class="num sub-line">${formatCurrency(inv.totalGST||0)}</td><td class="num sub-line">${formatCurrency((inv.totalTaxable||0)+(inv.totalGST||0))}</td></tr>
    <tr class="total-row"><td colspan="5">TOTAL</td><td colspan="3" class="num">₹ ${formatCurrency(gt)}</td></tr>
  </tfoot></table>
  <div style="font-size:9px;margin-top:6px;color:#6B7280;font-style:italic;">${amountInWords(gt)}</div>

  ${co.bankAccountNo||co.razorpayLink?`<div class="pay-block">
    <strong>Payment details</strong> —
    ${co.bankName?` ${co.bankName}`:''} ${co.bankAccountNo?`A/c ${co.bankAccountNo}`:''} ${co.bankIFSC?`IFSC ${co.bankIFSC}`:''} ${co.upiId?`· UPI: ${co.upiId}`:''}
    ${co.razorpayLink?`· <a href="${co.razorpayLink}" style="color:#2563EB;font-weight:600;">Pay online →</a>`:''}
    ${co.paymentRemarks?`<br>${co.paymentRemarks}`:''}
  </div>`:''}
  ${inv.notes?`<div style="font-size:9.5px;color:#555;margin-top:6px;">${inv.notes}</div>`:''}
  ${inv.terms?`<div style="font-size:9px;color:#9CA3AF;margin-top:4px;"><strong>Terms:</strong> ${inv.terms}</div>`:''}

  <div class="sign-area">
    <div class="sign-block">
      ${co.qrDataUrl?`<img src="${co.qrDataUrl}" style="height:65px;object-fit:contain;display:block;margin:0 0 8px auto;" />`:''}
      ${co.signatureDataUrl?`<img src="${co.signatureDataUrl}" style="height:34px;object-fit:contain;display:block;margin:8px 0 4px auto;" />`:`<div style="border-top:1px solid #1a1a1a;margin:36px 0 4px auto;width:120px;"></div>`}
      <div style="font-size:11px;font-weight:700;">${co.signatoryName||co.name||''}</div>
      <div style="font-size:9px;color:#9CA3AF;">Authorized Signatory</div>
    </div>
  </div>
  <div class="footer">${co.name||''} · ${co.gstin||''} · This is a computer generated invoice</div>
  </div></body></html>`;
}

export function getShareableLink(invoiceId) {
  return `${window.location.origin}${window.location.pathname}#/invoices/${invoiceId}`;
}
