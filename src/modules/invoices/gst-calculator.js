/**
 * gst-calculator.js — Pure functions, no imports needed
 */

export function calcInvoiceGST(items, interState = false) {
  let subTotal=0, totalDiscount=0, totalTaxable=0, cgst=0, sgst=0, igst=0, totalGST=0;

  const lineCalcs = (items||[]).map(item => {
    const qty      = parseFloat(item.qty)      || 0;
    const rate     = parseFloat(item.rate)     || 0;
    const gstRate  = parseFloat(item.gstRate)  || 0;
    const discount = parseFloat(item.discount) || 0;

    const lineGross    = qty * rate;
    const lineDiscount = lineGross * (discount / 100);
    const lineNet      = lineGross - lineDiscount;
    const gstAmt       = lineNet * (gstRate / 100);
    const lineCGST     = interState ? 0 : gstAmt / 2;
    const lineSGST     = interState ? 0 : gstAmt / 2;
    const lineIGST     = interState ? gstAmt : 0;
    const lineTotal    = lineNet + gstAmt;

    subTotal      += lineGross;
    totalDiscount += lineDiscount;
    totalTaxable  += lineNet;
    cgst          += lineCGST;
    sgst          += lineSGST;
    igst          += lineIGST;
    totalGST      += gstAmt;

    return { ...item, lineGross: r(lineGross), lineDiscount: r(lineDiscount), lineNet: r(lineNet), cgst: r(lineCGST), sgst: r(lineSGST), igst: r(lineIGST), totalGST: r(gstAmt), lineTotal: r(lineTotal) };
  });

  return {
    lineCalcs,
    subTotal:      r(subTotal),
    totalDiscount: r(totalDiscount),
    totalTaxable:  r(totalTaxable),
    cgst:          r(cgst),
    sgst:          r(sgst),
    igst:          r(igst),
    totalGST:      r(totalGST),
    grandTotal:    r(totalTaxable + totalGST),
    interState,
  };
}

export function amountInWords(amount) {
  const n = Math.round(amount || 0);
  if (n === 0) return 'Zero Rupees Only';
  const ones = ['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen'];
  const tens  = ['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety'];
  function w(n) {
    if (n < 20)  return ones[n];
    if (n < 100) return tens[Math.floor(n/10)]+(n%10?' '+ones[n%10]:'');
    if (n < 1000)      return ones[Math.floor(n/100)]+' Hundred'+(n%100?' '+w(n%100):'');
    if (n < 100000)    return w(Math.floor(n/1000))+' Thousand'+(n%1000?' '+w(n%1000):'');
    if (n < 10000000)  return w(Math.floor(n/100000))+' Lakh'+(n%100000?' '+w(n%100000):'');
    return w(Math.floor(n/10000000))+' Crore'+(n%10000000?' '+w(n%10000000):'');
  }
  return w(n) + ' Rupees Only';
}

function r(n) { return Math.round((n||0)*100)/100; }
