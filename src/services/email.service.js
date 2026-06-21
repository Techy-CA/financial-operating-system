import Store from '../core/store.js';

// ── UPDATE THESE 3 VALUES ─────────────────────────────────────
const EMAILJS_PUBLIC_KEY  = 'C_7lgSun6Nos8Asgr';
const EMAILJS_SERVICE_ID  = 'service_h2gfe3k';   // ← REPLACE with your actual Service ID from EmailJS dashboard → Email Services
const EMAILJS_TEMPLATE_ID = 'template_fsgvayf';
// ─────────────────────────────────────────────────────────────

async function ensureReady() {
  // Wait for emailjs to be available (loaded in index.html)
  let tries = 0;
  while (!window.emailjs && tries < 30) {
    await new Promise(r => setTimeout(r, 200));
    tries++;
  }
  if (!window.emailjs) {
    throw new Error('EmailJS SDK not loaded. Check your internet connection.');
  }
  // Re-init in case it was loaded after the page init
  window.emailjs.init(EMAILJS_PUBLIC_KEY);
}

function rupees(n) {
  return '₹' + Number(n || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function baseParams() {
  const co = Store.get('company') || {};
  return {
    company_name: co.name          || 'FinOS',
    payment_link: co.razorpayLink  || '',
    reply_to:     co.email         || '',
    from_name:    co.name          || 'FinOS',
  };
}

function _publicInvoiceUrl(invoice) {
  // Public URL — no login needed
  // Format: #/invoice/COMPANYID/INVOICEID
  const base = `${location.origin}${location.pathname}`;
  // Try invoice.companyId first, then fall back to Store (for older invoices)
  const cid  = invoice.companyId
             || window.__Store?.get?.('companyId')
             || Store.get('companyId')
             || '';
  if (cid) return `${base}#/invoice/${cid}/${invoice.id}`;
  // Last resort fallback (requires login — not ideal)
  return `${base}#/invoices/${invoice.id}`;
}

async function send(params) {
  await ensureReady();

  const payload = { ...baseParams(), ...params };

  console.log('[EmailJS] ► Sending', {
    to:       payload.to_email,
    service:  EMAILJS_SERVICE_ID,
    template: EMAILJS_TEMPLATE_ID,
    invoice:  payload.invoice_number,
  });

  try {
    const result = await window.emailjs.send(
      EMAILJS_SERVICE_ID,
      EMAILJS_TEMPLATE_ID,
      payload
    );
    console.log('[EmailJS] ✅ Success', result.status, result.text);
    return result;
  } catch (err) {
    // Provide specific error messages
    if (err?.status === 400) {
      throw new Error(
        'EmailJS 400: Service ID is wrong. Go to EmailJS dashboard → Email Services → copy the Service ID (format: service_xxxxxxx) and update email.service.js line 40.'
      );
    }
    if (err?.status === 401) {
      throw new Error('EmailJS 401: Public key invalid. Check EMAILJS_PUBLIC_KEY in email.service.js');
    }
    if (err?.status === 404) {
      throw new Error('EmailJS 404: Template not found. Check EMAILJS_TEMPLATE_ID (currently: ' + EMAILJS_TEMPLATE_ID + ')');
    }
    throw new Error('EmailJS error: ' + (err?.text || err?.message || JSON.stringify(err)));
  }
}

const EmailService = {

  async sendInvoice(invoice) {
    if (!invoice.customerEmail) {
      throw new Error(`No email for "${invoice.customerName}". Edit the customer and add their email first.`);
    }
    return send({
      to_email:       invoice.customerEmail,
      to_name:        invoice.customerName  || 'Customer',
      invoice_number: invoice.invoiceNumber || '',
      invoice_date:   invoice.invoiceDate   || '',
      due_date:       invoice.dueDate       || '',
      invoice_amount: rupees(invoice.grandTotal),
      balance_due:    rupees(invoice.balanceDue || invoice.grandTotal),
      invoice_link:   _publicInvoiceUrl(invoice),
      notes:          invoice.notes || '',
    });
  },

  async sendReminder(invoice) {
    if (!invoice.customerEmail) {
      throw new Error(`No email for "${invoice.customerName}".`);
    }
    const daysLeft = invoice.dueDate
      ? Math.floor((new Date(invoice.dueDate).getTime() - Date.now()) / 86400000)
      : 0;
    const notes = daysLeft < 0
      ? `⚠️ This invoice is ${Math.abs(daysLeft)} day${Math.abs(daysLeft) !== 1 ? 's' : ''} overdue. Please settle immediately.`
      : daysLeft === 0
        ? '🔴 This invoice is due TODAY. Please make payment immediately.'
        : `Reminder: This invoice is due in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}. Kindly arrange payment.`;
    return send({
      to_email:       invoice.customerEmail,
      to_name:        invoice.customerName  || 'Customer',
      invoice_number: invoice.invoiceNumber || '',
      invoice_date:   invoice.invoiceDate   || '',
      due_date:       invoice.dueDate       || '',
      invoice_amount: rupees(invoice.grandTotal),
      balance_due:    rupees(invoice.balanceDue),
      invoice_link:   _publicInvoiceUrl(invoice),
      notes,
    });
  },

  async sendPaymentConfirm(invoice, amountPaid, newBalance) {
    if (!invoice.customerEmail) return;
    return send({
      to_email:       invoice.customerEmail,
      to_name:        invoice.customerName  || 'Customer',
      invoice_number: invoice.invoiceNumber || '',
      invoice_date:   invoice.invoiceDate   || '',
      due_date:       invoice.dueDate       || '',
      invoice_amount: rupees(invoice.grandTotal),
      balance_due:    newBalance <= 0 ? 'FULLY PAID' : rupees(newBalance) + ' remaining',
      invoice_link:   _publicInvoiceUrl(invoice),
      notes:          newBalance <= 0
        ? `Payment of ${rupees(amountPaid)} received. Your account is fully settled. Thank you!`
        : `Payment of ${rupees(amountPaid)} received. Balance remaining: ${rupees(newBalance)}.`,
    });
  },

  // Run from browser console: testEmail('your@email.com')
  async test(toEmail) {
    console.log('[EmailJS] Sending test email to:', toEmail);
    return send({
      to_email:       toEmail,
      to_name:        'Test User',
      invoice_number: 'TEST-0001',
      invoice_date:   new Date().toISOString().split('T')[0],
      due_date:       new Date(Date.now() + 30*86400000).toISOString().split('T')[0],
      invoice_amount: '₹10,000.00',
      balance_due:    '₹10,000.00',
      invoice_link:   location.href,
      notes:          '🧪 Test email from FinOS. If received, EmailJS is working!',
    });
  },
};

window.EmailService = EmailService;
export default EmailService;