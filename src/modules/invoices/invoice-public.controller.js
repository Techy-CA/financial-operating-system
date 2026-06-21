/**
 * invoice-public.controller.js — NO login required
 * Route: #/invoice/:companyId/:invoiceId
 * Completely self-contained — replaces full page
 */

const InvoicePublicPage = {

  async init(path) {
    // Take over entire page
    document.body.style.cssText = 'margin:0;padding:0;background:#F4F6FA;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif;min-height:100vh;overflow-y:auto;';
    document.body.innerHTML = `
      <div id="pi-wrap" style="max-width:860px;margin:0 auto;padding:24px 16px;">
        <div id="pi-loading" style="text-align:center;padding:80px 0;">
          <div style="width:36px;height:36px;border:3px solid #E2E8F0;border-top-color:#1A3A6B;border-radius:50%;animation:spin 0.8s linear infinite;margin:0 auto 16px;"></div>
          <div style="color:#64748B;font-size:14px;">Loading invoice…</div>
        </div>
        <div id="pi-error" style="display:none;text-align:center;padding:80px 0;">
          <div style="font-size:52px;margin-bottom:16px;">🔍</div>
          <div style="font-size:18px;font-weight:700;color:#0F172A;margin-bottom:8px;">Invoice not found</div>
          <div style="font-size:14px;color:#64748B;">This link may be invalid or the invoice was deleted.</div>
          <div id="pi-err-detail" style="font-size:12px;color:#94A3B8;margin-top:8px;"></div>
        </div>
        <div id="pi-content"></div>
      </div>
      <style>
        @keyframes spin{to{transform:rotate(360deg);}}
        *{box-sizing:border-box;}
        @media print{
          body{background:white!important;}
          #pi-wrap{padding:0!important;max-width:100%!important;}
          .np{display:none!important;}
          .inv-card{border:none!important;box-shadow:none!important;border-radius:0!important;}
        }
      </style>`;

    const parts     = (path || '').split('/');
    const companyId = parts[0];
    const invoiceId = parts[1];

    if (!companyId || !invoiceId) {
      this._err('Invalid invoice link — missing company or invoice ID.');
      return;
    }

    try {
      // Init Firebase
      const { initializeApp, getApps } =
        await import('https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js');
      const { getFirestore, doc, getDoc, collection, query, where, getDocs } =
        await import('https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js');

      let db = window.fbDB;
      if (!db) {
        const cfg = {
          apiKey:            "AIzaSyCuJZ6enu91CWaJFKQ7lbFGb2nBpf_KSPo",
          authDomain:        "finos-543d9.firebaseapp.com",
          projectId:         "finos-543d9",
          storageBucket:     "finos-543d9.firebasestorage.app",
          messagingSenderId: "740672028290",
          appId:             "1:740672028290:web:a7fd891ad0f2bd7672be9b",
        };
        const app = getApps().length ? getApps()[0] : initializeApp(cfg);
        db = getFirestore(app);
      }

      // Fetch invoice
      const invSnap = await getDoc(
        doc(db, 'companies', companyId, 'invoices', invoiceId)
      );
      if (!invSnap.exists()) {
        this._err(`Invoice not found.\nCompany: ${companyId}\nInvoice: ${invoiceId}`);
        return;
      }
      const inv = { id: invSnap.id, ...invSnap.data() };

      // Fetch items (no orderBy = no composite index needed)
      let items = [];
      try {
        const snap = await getDocs(
          query(
            collection(db, 'companies', companyId, 'invoiceItems'),
            where('invoiceId', '==', invoiceId)
          )
        );
        items = snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .sort((a, b) => (a.position || 0) - (b.position || 0));
      } catch(e) { console.warn('[PI] items:', e.message); }

      // Fetch company
      let co = {};
      try {
        const s = await getDoc(doc(db, 'companies', companyId));
        if (s.exists()) co = s.data();
      } catch(e) { console.warn('[PI] company:', e.message); }

      // Enrich customer address
      if (inv.customerId && !inv.customerAddress) {
        try {
          const s = await getDoc(
            doc(db, 'companies', companyId, 'customers', inv.customerId)
          );
          if (s.exists()) {
            const c = s.data();
            inv.customerAddress = [c.address, c.city,
              [c.state, c.pincode].filter(Boolean).join(' - ')
            ].filter(Boolean).join(', ');
            inv.customerGSTIN = inv.customerGSTIN || c.gstin || null;
          }
        } catch(e) {}
      }

      document.getElementById('pi-loading').style.display = 'none';
      document.getElementById('pi-content').innerHTML     = this._html(inv, items, co);

    } catch(e) {
      console.error('[PI]', e);
      this._err(e.message);
    }
  },

  _err(msg) {
    document.getElementById('pi-loading').style.display  = 'none';
    document.getElementById('pi-error').style.display    = 'block';
    document.getElementById('pi-err-detail').textContent = msg;
  },

  _fc(n) {
    return '₹' + Number(n || 0).toLocaleString('en-IN', {
      minimumFractionDigits: 2, maximumFractionDigits: 2
    });
  },

  _words(n) {
    const a = ['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine',
      'Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen',
      'Eighteen','Nineteen'];
    const b = ['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety'];
    if (!n || isNaN(n)) return 'Zero Rupees Only';
    n = Math.round(n);
    function words(num) {
      if (num === 0) return '';
      if (num < 20)  return a[num] + ' ';
      if (num < 100) return b[Math.floor(num/10)] + (num%10 ? ' '+a[num%10] : '') + ' ';
      if (num < 1000) return a[Math.floor(num/100)] + ' Hundred ' + words(num%100);
      if (num < 100000) return words(Math.floor(num/1000)) + 'Thousand ' + words(num%1000);
      if (num < 10000000) return words(Math.floor(num/100000)) + 'Lakh ' + words(num%100000);
      return words(Math.floor(num/10000000)) + 'Crore ' + words(num%10000000);
    }
    return words(n).trim() + ' Rupees Only';
  },

  _fd(d) {
    if (!d) return '—';
    try {
      const dt = d?.toDate ? d.toDate() : new Date(d);
      return dt.toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' });
    } catch(e) { return d || '—'; }
  },

  _html(inv, items, co) {
    const fc     = n => this._fc(n);
    const fd     = d => this._fd(d);
    const total  = Math.round(inv.grandTotal || 0);
    const paid   = inv.paidAmount || 0;
    const bal    = Math.max(0, inv.balanceDue ?? (total - paid));
    const isPaid = inv.status === 'paid';

    return `
      <!-- Action bar -->
      <div class="np" style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;flex-wrap:wrap;gap:10px;">
        <div style="display:flex;align-items:center;gap:10px;">
          <div style="width:34px;height:34px;background:#1A3A6B;border-radius:9px;display:flex;align-items:center;justify-content:center;">
            <svg width="15" height="15" viewBox="0 0 100 120" fill="none"><path d="M15 10 C70 10 85 10 85 10 C90 10 95 15 85 25 C75 35 30 50 30 50 C70 50 80 50 80 50 C85 50 88 55 80 63 C72 71 30 90 30 90 L30 115" stroke="white" stroke-width="18" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>
          </div>
          <div>
            <div style="font-size:13px;font-weight:700;color:#0F172A;">FinOS Invoice</div>
            <div style="font-size:11px;color:#64748B;">${co.name || ''}</div>
          </div>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          ${co.razorpayLink && !isPaid ? `<a href="${co.razorpayLink}" target="_blank" style="padding:9px 20px;background:#16A34A;color:white;border-radius:8px;font-size:13px;font-weight:700;text-decoration:none;display:inline-block;">💳 Pay Now</a>` : ''}
          <button onclick="window.print()" style="padding:9px 20px;background:#1A3A6B;color:white;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;">🖨️ Download PDF</button>
        </div>
      </div>

      <!-- Invoice card -->
      <div class="inv-card" style="background:white;border:1px solid #E2E8F0;border-radius:12px;overflow:hidden;box-shadow:0 2px 20px rgba(0,0,0,0.07);">

        <!-- Header -->
        <div style="background:#1A3A6B;padding:22px 32px;display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:12px;">
          <div>
            <div style="font-size:10px;font-weight:600;color:#93C5FD;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:6px;">TAX INVOICE</div>
            <div style="font-size:24px;font-weight:800;color:white;">${inv.invoiceNumber || '—'}</div>
          </div>
          <div style="text-align:right;">
            <div style="font-size:10px;color:#93C5FD;margin-bottom:3px;">Date</div>
            <div style="font-size:14px;font-weight:600;color:white;">${fd(inv.invoiceDate)}</div>
            <div style="margin-top:10px;">
              <span style="background:${isPaid?'#16A34A':'rgba(255,255,255,0.15)'};color:white;font-size:10px;font-weight:700;padding:4px 12px;border-radius:99px;text-transform:uppercase;">
                ${isPaid ? '✓ PAID' : (inv.status || 'SENT').toUpperCase()}
              </span>
            </div>
          </div>
        </div>

        <!-- From / To -->
        <div style="display:grid;grid-template-columns:1fr 1fr;border-bottom:1px solid #E2E8F0;">
          <div style="padding:22px 32px;border-right:1px solid #E2E8F0;">
            <div style="font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#94A3B8;margin-bottom:10px;">From</div>
            ${co.logoDataUrl ? `<img src="${co.logoDataUrl}" style="height:32px;object-fit:contain;display:block;margin-bottom:8px;" />` : ''}
            <div style="font-size:15px;font-weight:800;color:#0F172A;margin-bottom:3px;">${co.name || '—'}</div>
            ${co.gstin ? `<div style="font-size:11.5px;color:#64748B;">GSTIN: <strong>${co.gstin}</strong></div>` : ''}
            ${co.address ? `<div style="font-size:11.5px;color:#64748B;line-height:1.6;margin-top:3px;">${co.address}</div>` : ''}
            ${[co.city, co.state].filter(Boolean).join(', ') ? `<div style="font-size:11.5px;color:#64748B;">${[co.city,co.state].filter(Boolean).join(', ')} ${co.pincode || ''}</div>` : ''}
            ${co.phone ? `<div style="font-size:11.5px;color:#64748B;margin-top:2px;">${co.phone}</div>` : ''}
            ${co.email ? `<div style="font-size:11.5px;color:#64748B;">${co.email}</div>` : ''}
          </div>
          <div style="padding:22px 32px;">
            <div style="font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#94A3B8;margin-bottom:10px;">Bill To</div>
            <div style="font-size:15px;font-weight:800;color:#0F172A;margin-bottom:3px;">${inv.customerName || '—'}</div>
            ${inv.customerAddress ? `<div style="font-size:11.5px;color:#64748B;line-height:1.6;margin-top:3px;">${inv.customerAddress}</div>` : ''}
            ${inv.customerGSTIN ? `<div style="font-size:11.5px;color:#64748B;margin-top:3px;">GSTIN: <strong>${inv.customerGSTIN}</strong></div>` : ''}
            <div style="display:flex;gap:20px;flex-wrap:wrap;margin-top:14px;padding-top:12px;border-top:1px solid #F1F5F9;">
              <div>
                <div style="font-size:9.5px;color:#94A3B8;text-transform:uppercase;letter-spacing:0.5px;">Due Date</div>
                <div style="font-size:12.5px;font-weight:700;color:${isPaid?'#16A34A':'#DC2626'};margin-top:3px;">${fd(inv.dueDate)}</div>
              </div>
              ${inv.placeOfSupply ? `<div><div style="font-size:9.5px;color:#94A3B8;text-transform:uppercase;letter-spacing:0.5px;">Place of Supply</div><div style="font-size:12.5px;font-weight:600;color:#374151;margin-top:3px;">${inv.placeOfSupply}</div></div>` : ''}
              ${inv.invoiceCategory ? `<div><div style="font-size:9.5px;color:#94A3B8;text-transform:uppercase;letter-spacing:0.5px;">Type</div><div style="font-size:12.5px;font-weight:600;color:#374151;margin-top:3px;">${inv.invoiceCategory}</div></div>` : ''}
            </div>
          </div>
        </div>

        <!-- Items -->
        <div style="overflow-x:auto;">
          <table style="width:100%;border-collapse:collapse;min-width:500px;">
            <thead>
              <tr style="background:#F8FAFC;border-bottom:2px solid #E2E8F0;">
                <th style="padding:10px 14px 10px 24px;text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.7px;color:#94A3B8;">#</th>
                <th style="padding:10px 14px;text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.7px;color:#94A3B8;">Description</th>
                <th style="padding:10px 14px;text-align:right;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.7px;color:#94A3B8;">Qty</th>
                <th style="padding:10px 14px;text-align:right;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.7px;color:#94A3B8;">Rate</th>
                <th style="padding:10px 14px;text-align:right;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.7px;color:#94A3B8;">GST%</th>
                <th style="padding:10px 24px 10px 14px;text-align:right;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.7px;color:#94A3B8;">Amount</th>
              </tr>
            </thead>
            <tbody>
              ${items.length === 0
                ? `<tr><td colspan="6" style="padding:40px;text-align:center;color:#94A3B8;">No line items</td></tr>`
                : items.map((item, i) => {
                    const qty  = parseFloat(item.qty)     || 0;
                    const rate = parseFloat(item.rate)    || 0;
                    const disc = parseFloat(item.discount)|| 0;
                    const gst  = parseFloat(item.gstRate) || 0;
                    const tax  = qty * rate * (1 - disc/100);
                    const amt  = tax + tax * gst / 100;
                    return `<tr style="border-bottom:1px solid #F1F5F9;${i%2?'background:#FAFAFA;':''}">
                      <td style="padding:13px 14px 13px 24px;color:#94A3B8;">${i+1}</td>
                      <td style="padding:13px 14px;">
                        <div style="font-size:13.5px;font-weight:600;color:#0F172A;">${item.description || '—'}</div>
                        ${item.hsn ? `<div style="font-size:10.5px;color:#94A3B8;margin-top:2px;">HSN/SAC: ${item.hsn}</div>` : ''}
                      </td>
                      <td style="padding:13px 14px;text-align:right;color:#374151;">${qty} ${item.unit||''}</td>
                      <td style="padding:13px 14px;text-align:right;color:#374151;">${fc(rate)}</td>
                      <td style="padding:13px 14px;text-align:right;color:#64748B;">${gst}%</td>
                      <td style="padding:13px 24px 13px 14px;text-align:right;font-size:14px;font-weight:700;color:#0F172A;">${fc(amt)}</td>
                    </tr>`;
                  }).join('')}
            </tbody>
          </table>
        </div>

        <!-- Totals -->
        <div style="display:flex;justify-content:flex-end;padding:18px 24px;background:#F8FAFC;border-top:1px solid #E2E8F0;">
          <div style="width:280px;">
            <div style="display:flex;justify-content:space-between;font-size:13px;padding:4px 0;color:#64748B;"><span>Subtotal</span><span>${fc(inv.subTotal||0)}</span></div>
            ${(inv.totalDiscount||0)>0?`<div style="display:flex;justify-content:space-between;font-size:13px;padding:4px 0;color:#16A34A;"><span>Discount</span><span>-${fc(inv.totalDiscount)}</span></div>`:''}
            ${inv.interState
              ?`<div style="display:flex;justify-content:space-between;font-size:13px;padding:4px 0;color:#64748B;"><span>IGST</span><span>${fc(inv.igst||0)}</span></div>`
              :`<div style="display:flex;justify-content:space-between;font-size:13px;padding:4px 0;color:#64748B;"><span>CGST</span><span>${fc(inv.cgst||0)}</span></div>
                <div style="display:flex;justify-content:space-between;font-size:13px;padding:4px 0;color:#64748B;"><span>SGST</span><span>${fc(inv.sgst||0)}</span></div>`}
            <div style="height:1px;background:#E2E8F0;margin:8px 0;"></div>
            <div style="display:flex;justify-content:space-between;font-size:20px;font-weight:800;color:#0F172A;"><span>Total</span><span>${fc(total)}</span></div>
            ${paid>0?`
              <div style="height:1px;background:#E2E8F0;margin:8px 0;"></div>
              <div style="display:flex;justify-content:space-between;font-size:13px;padding:4px 0;color:#16A34A;"><span>Paid</span><span>-${fc(paid)}</span></div>
              <div style="display:flex;justify-content:space-between;font-size:15px;font-weight:700;color:${bal<=0?'#16A34A':'#DC2626'};"><span>Balance due</span><span>${fc(bal)}</span></div>`:''}
          </div>
        </div>

        <!-- Amount in words -->
        <div style="padding:12px 24px;border-top:1px solid #E2E8F0;background:#FAFAFA;font-size:12.5px;color:#64748B;">
          <strong style="color:#374151;">Amount in words:</strong> ${this._words(total)}
        </div>

        <!-- Payment details -->
        ${co.bankAccountNo||co.razorpayLink||co.upiId ? `
        <div style="padding:16px 24px;border-top:1px solid #E2E8F0;">
          <div style="font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#94A3B8;margin-bottom:10px;">Payment Details</div>
          <div style="display:flex;flex-wrap:wrap;gap:20px;font-size:12.5px;">
            ${co.bankName?`<div><div style="color:#94A3B8;font-size:10px;margin-bottom:2px;">Account Name</div><div style="font-weight:700;color:#0F172A;">${co.bankName}</div></div>`:''}
            ${co.bankAccountNo?`<div><div style="color:#94A3B8;font-size:10px;margin-bottom:2px;">Account No.</div><div style="font-weight:700;color:#0F172A;font-family:monospace;">${co.bankAccountNo}</div></div>`:''}
            ${co.bankIFSC?`<div><div style="color:#94A3B8;font-size:10px;margin-bottom:2px;">IFSC</div><div style="font-weight:700;color:#0F172A;font-family:monospace;">${co.bankIFSC}</div></div>`:''}
            ${co.upiId?`<div><div style="color:#94A3B8;font-size:10px;margin-bottom:2px;">UPI ID</div><div style="font-weight:700;color:#0F172A;">${co.upiId}</div></div>`:''}
          </div>
          ${co.paymentRemarks?`<div style="font-size:11.5px;color:#64748B;margin-top:8px;">${co.paymentRemarks}</div>`:''}
          ${co.razorpayLink&&!isPaid?`<a href="${co.razorpayLink}" target="_blank" style="display:inline-block;margin-top:12px;background:#1A3A6B;color:white;padding:10px 22px;border-radius:8px;text-decoration:none;font-size:13px;font-weight:700;">💳 Pay Online</a>`:''}
        </div>` : ''}

        ${inv.notes?`<div style="padding:12px 24px;border-top:1px solid #E2E8F0;font-size:12.5px;color:#64748B;"><strong style="color:#374151;">Notes:</strong> ${inv.notes}</div>`:''}
        ${inv.terms?`<div style="padding:12px 24px;border-top:1px solid #E2E8F0;font-size:12.5px;color:#64748B;"><strong style="color:#374151;">Terms:</strong> ${inv.terms}</div>`:''}

        <!-- Signature -->
        <div style="padding:20px 24px 24px;border-top:1px solid #E2E8F0;text-align:right;">
          ${co.signatureDataUrl?`<img src="${co.signatureDataUrl}" style="height:44px;object-fit:contain;display:block;margin:0 0 8px auto;" />`:`<div style="height:40px;"></div>`}
          <div style="border-top:1.5px solid #374151;width:150px;margin:0 0 5px auto;"></div>
          <div style="font-size:13.5px;font-weight:700;color:#0F172A;">${co.signatoryName||co.name||''}</div>
          <div style="font-size:11px;color:#64748B;margin-top:2px;">Authorized Signatory</div>
        </div>

        <!-- Footer -->
        <div style="background:#0F172A;padding:12px 24px;text-align:center;">
          <div style="font-size:11px;color:#475569;">Computer generated invoice · ${co.name||''} ${co.gstin?'· GSTIN: '+co.gstin:''}</div>
        </div>
      </div>

      <div class="np" style="text-align:center;margin-top:16px;font-size:11.5px;color:#94A3B8;">
        🔒 Securely shared via <strong>FinOS</strong> · Financial OS for Indian Businesses 🇮🇳
      </div>
    `;
  },
};

export default InvoicePublicPage;