/**
 * constants.js
 * Single source of truth for all enum values.
 */

// ---- GST Rates ----
export const GST_RATES = [0, 0.1, 0.25, 1, 1.5, 3, 5, 6, 7.5, 9, 12, 14, 18, 28];

export const GST_RATE_OPTIONS = GST_RATES.map(r => ({
  value: r,
  label: r === 0 ? 'Exempt (0%)' : `${r}%`,
}));

// ---- Invoice Types ----
export const INVOICE_TYPES = {
  TAX_INVOICE:   'tax_invoice',
  PROFORMA:      'proforma',
  CREDIT_NOTE:   'credit_note',
  DEBIT_NOTE:    'debit_note',
  RECURRING:     'recurring',
};

export const INVOICE_TYPE_LABELS = {
  tax_invoice:  'Tax Invoice',
  proforma:     'Proforma Invoice',
  credit_note:  'Credit Note',
  debit_note:   'Debit Note',
  recurring:    'Recurring Invoice',
};

// ---- Invoice Status ----
export const INVOICE_STATUS = {
  DRAFT:     'draft',
  SENT:      'sent',
  VIEWED:    'viewed',
  PAID:      'paid',
  PARTIAL:   'partial',
  OVERDUE:   'overdue',
  CANCELLED: 'cancelled',
};

export const INVOICE_STATUS_LABELS = {
  draft:     'Draft',
  sent:      'Sent',
  viewed:    'Viewed',
  paid:      'Paid',
  partial:   'Partially paid',
  overdue:   'Overdue',
  cancelled: 'Cancelled',
};

export const INVOICE_STATUS_BADGE = {
  draft:     'badge badge-neutral status-draft',
  sent:      'badge badge-info status-sent',
  viewed:    'badge badge-purple status-viewed',
  paid:      'badge badge-success status-paid',
  partial:   'badge badge-warning status-partial',
  overdue:   'badge badge-danger status-overdue',
  cancelled: 'badge badge-neutral status-cancelled',
};

// ---- Quotation Status ----
export const QUOTATION_STATUS = {
  DRAFT:     'draft',
  SENT:      'sent',
  APPROVED:  'approved',
  REJECTED:  'rejected',
  CONVERTED: 'converted',
  EXPIRED:   'expired',
};

// ---- Expense Categories ----
export const EXPENSE_CATEGORIES = [
  { id: 'salary',        label: 'Salaries & Wages',      icon: 'ti-user-dollar' },
  { id: 'rent',          label: 'Rent & Office',          icon: 'ti-building' },
  { id: 'marketing',     label: 'Marketing & Ads',        icon: 'ti-speakerphone' },
  { id: 'software',      label: 'Software & Tools',       icon: 'ti-apps' },
  { id: 'travel',        label: 'Travel & Transport',     icon: 'ti-car' },
  { id: 'utilities',     label: 'Utilities & Internet',   icon: 'ti-bolt' },
  { id: 'professional',  label: 'Professional Fees',      icon: 'ti-briefcase' },
  { id: 'raw_material',  label: 'Raw Materials',          icon: 'ti-package' },
  { id: 'bank_charges',  label: 'Bank Charges',           icon: 'ti-building-bank' },
  { id: 'maintenance',   label: 'Repairs & Maintenance',  icon: 'ti-tool' },
  { id: 'insurance',     label: 'Insurance',              icon: 'ti-shield-check' },
  { id: 'entertainment', label: 'Entertainment & Meals',  icon: 'ti-coffee' },
  { id: 'tds',           label: 'TDS / Tax Payments',     icon: 'ti-receipt-tax' },
  { id: 'gst',           label: 'GST Payments',           icon: 'ti-calculator' },
  { id: 'other',         label: 'Other',                  icon: 'ti-dots' },
];

export const EXPENSE_CATEGORY_MAP = Object.fromEntries(
  EXPENSE_CATEGORIES.map(c => [c.id, c])
);

// ---- Payment Methods ----
export const PAYMENT_METHODS = [
  { id: 'bank_transfer', label: 'Bank Transfer / NEFT / RTGS' },
  { id: 'upi',           label: 'UPI' },
  { id: 'cheque',        label: 'Cheque' },
  { id: 'cash',          label: 'Cash' },
  { id: 'credit_card',   label: 'Credit Card' },
  { id: 'other',         label: 'Other' },
];

// ---- TDS Categories ----
export const TDS_CATEGORIES = [
  { id: '194C',  label: '194C — Contractor (1%/2%)', rate: { individual: 1, company: 2 } },
  { id: '194J',  label: '194J — Professional (10%)',  rate: { individual: 10, company: 10 } },
  { id: '194H',  label: '194H — Commission (5%)',     rate: { individual: 5, company: 5 } },
  { id: '194I',  label: '194I — Rent (10%)',          rate: { individual: 10, company: 10 } },
  { id: '194A',  label: '194A — Interest (10%)',      rate: { individual: 10, company: 10 } },
  { id: 'none',  label: 'No TDS',                     rate: { individual: 0, company: 0 } },
];

// ---- Indian States (for GST place of supply) ----
export const INDIAN_STATES = [
  { code: '01', name: 'Jammu & Kashmir' },
  { code: '02', name: 'Himachal Pradesh' },
  { code: '03', name: 'Punjab' },
  { code: '04', name: 'Chandigarh' },
  { code: '05', name: 'Uttarakhand' },
  { code: '06', name: 'Haryana' },
  { code: '07', name: 'Delhi' },
  { code: '08', name: 'Rajasthan' },
  { code: '09', name: 'Uttar Pradesh' },
  { code: '10', name: 'Bihar' },
  { code: '11', name: 'Sikkim' },
  { code: '12', name: 'Arunachal Pradesh' },
  { code: '13', name: 'Nagaland' },
  { code: '14', name: 'Manipur' },
  { code: '15', name: 'Mizoram' },
  { code: '16', name: 'Tripura' },
  { code: '17', name: 'Meghalaya' },
  { code: '18', name: 'Assam' },
  { code: '19', name: 'West Bengal' },
  { code: '20', name: 'Jharkhand' },
  { code: '21', name: 'Odisha' },
  { code: '22', name: 'Chattisgarh' },
  { code: '23', name: 'Madhya Pradesh' },
  { code: '24', name: 'Gujarat' },
  { code: '26', name: 'Dadra & Nagar Haveli and Daman & Diu' },
  { code: '27', name: 'Maharashtra' },
  { code: '29', name: 'Karnataka' },
  { code: '30', name: 'Goa' },
  { code: '31', name: 'Lakshadweep' },
  { code: '32', name: 'Kerala' },
  { code: '33', name: 'Tamil Nadu' },
  { code: '34', name: 'Puducherry' },
  { code: '35', name: 'Andaman & Nicobar Islands' },
  { code: '36', name: 'Telangana' },
  { code: '37', name: 'Andhra Pradesh' },
  { code: '38', name: 'Ladakh' },
];

// ---- Financial Year ----
export function getCurrentFY() {
  const now   = new Date();
  const month = now.getMonth();
  const year  = now.getFullYear();
  const startYear = month >= 3 ? year : year - 1;
  return {
    startYear,
    endYear: startYear + 1,
    start:   `${startYear}-04-01`,
    end:     `${startYear + 1}-03-31`,
    label:   `FY ${startYear}-${String(startYear + 1).slice(2)}`,
    quarters: [
      { label: 'Q1', start: `${startYear}-04-01`,    end: `${startYear}-06-30`    },
      { label: 'Q2', start: `${startYear}-07-01`,    end: `${startYear}-09-30`    },
      { label: 'Q3', start: `${startYear}-10-01`,    end: `${startYear}-12-31`    },
      { label: 'Q4', start: `${startYear + 1}-01-01`,end: `${startYear + 1}-03-31`},
    ],
  };
}

// ---- Unit options for products ----
export const PRODUCT_UNITS = [
  'Nos', 'Pcs', 'Kg', 'Gm', 'L', 'ML', 'Mtr', 'Sqmt', 'Hr', 'Day', 'Month', 'Box', 'Set', 'Pair',
];
