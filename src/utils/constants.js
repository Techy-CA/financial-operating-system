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

// ---- Inventory ----
export const DEFAULT_WAREHOUSE = { id: 'default', name: 'Main Store', isDefault: true };

// Every stock movement carries a reason. `dir` is the direction it is offered
// as in the UI ('in', 'out' or 'both' for system-generated entries).
export const STOCK_REASONS = {
  opening:        { label: 'Opening stock',      dir: 'in',   system: true  },
  purchase:       { label: 'Purchase',           dir: 'in',   system: false },
  sale_return:    { label: 'Sales return',       dir: 'in',   system: false },
  production:     { label: 'Production / Assembly', dir: 'in', system: false },
  transfer_in:    { label: 'Transfer in',        dir: 'in',   system: false },
  sale:           { label: 'Sale (invoice)',     dir: 'out',  system: true  },
  sale_reversal:  { label: 'Invoice revised',    dir: 'out',  system: true  },
  purchase_return:{ label: 'Purchase return',    dir: 'out',  system: false },
  damage:         { label: 'Damage / Breakage',  dir: 'out',  system: false },
  theft:          { label: 'Shrinkage / Theft',  dir: 'out',  system: false },
  consumption:    { label: 'Internal use',       dir: 'out',  system: false },
  transfer_out:   { label: 'Transfer out',       dir: 'out',  system: false },
  adjustment:     { label: 'Stock count adjustment', dir: 'both', system: false },
};

export const STOCK_REASONS_IN  = Object.entries(STOCK_REASONS).filter(([, r]) => r.dir === 'in'  && !r.system).map(([id, r]) => ({ id, ...r }));
export const STOCK_REASONS_OUT = Object.entries(STOCK_REASONS).filter(([, r]) => r.dir === 'out' && !r.system).map(([id, r]) => ({ id, ...r }));

export const STOCK_STATUS_LABELS = {
  in_stock:     'In stock',
  low_stock:    'Low stock',
  out_of_stock: 'Out of stock',
  negative:     'Negative',
};

export const STOCK_STATUS_BADGE = {
  in_stock:     'badge badge-success',
  low_stock:    'badge badge-warning',
  out_of_stock: 'badge badge-neutral',
  negative:     'badge badge-danger',
};

// ---- Point of Sale ----
// Tender types accepted at the counter. `countsAsCash` decides whether the
// amount is expected in the physical drawer at day close.
export const POS_TENDERS = [
  { id: 'cash', label: 'Cash',  countsAsCash: true  },
  { id: 'upi',  label: 'UPI',   countsAsCash: false },
  { id: 'card', label: 'Card',  countsAsCash: false },
  { id: 'credit', label: 'Credit (khata)', countsAsCash: false },
];

export const POS_TENDER_MAP = Object.fromEntries(POS_TENDERS.map(t => [t.id, t]));

// Denominations offered in the cash-count grid at day close.
export const CASH_DENOMINATIONS = [500, 200, 100, 50, 20, 10, 5, 2, 1];

export const REGISTER_STATUS = { OPEN: 'open', CLOSED: 'closed' };

export const REGISTER_STATUS_BADGE = {
  open:   'badge badge-success',
  closed: 'badge badge-neutral',
};

// ---- Purchase bills ----
export const BILL_STATUS = {
  DRAFT:     'draft',
  RECEIVED:  'received',
  PARTIAL:   'partial',
  PAID:      'paid',
  OVERDUE:   'overdue',
  CANCELLED: 'cancelled',
};

export const BILL_STATUS_LABELS = {
  draft:     'Draft',
  received:  'Received',
  partial:   'Partially paid',
  paid:      'Paid',
  overdue:   'Overdue',
  cancelled: 'Cancelled',
};

export const BILL_STATUS_BADGE = {
  draft:     'badge badge-neutral',
  received:  'badge badge-info',
  partial:   'badge badge-warning',
  paid:      'badge badge-success',
  overdue:   'badge badge-danger',
  cancelled: 'badge badge-neutral',
};

// ---- Credit notes / sales returns ----
export const CREDIT_NOTE_REASONS = [
  { id: 'sales_return',   label: 'Goods returned',        restock: true  },
  { id: 'damaged',        label: 'Damaged / defective',   restock: false },
  { id: 'rate_revision',  label: 'Rate revision',         restock: false },
  { id: 'short_supply',   label: 'Short supply',          restock: false },
  { id: 'order_cancel',   label: 'Order cancelled',       restock: true  },
  { id: 'other',          label: 'Other',                 restock: false },
];

export const CREDIT_NOTE_REASON_MAP = Object.fromEntries(
  CREDIT_NOTE_REASONS.map(r => [r.id, r])
);

export const CREDIT_NOTE_STATUS_BADGE = {
  draft:    'badge badge-neutral',
  issued:   'badge badge-info',
  applied:  'badge badge-success',
  refunded: 'badge badge-purple',
};

// ---- Staff & payroll ----
export const SALARY_TYPES = [
  { id: 'monthly', label: 'Monthly salary',  unit: 'month' },
  { id: 'daily',   label: 'Daily wage',      unit: 'day'   },
  { id: 'hourly',  label: 'Hourly wage',     unit: 'hour'  },
  { id: 'piece',   label: 'Piece rate',      unit: 'piece' },
];

export const SALARY_TYPE_MAP = Object.fromEntries(SALARY_TYPES.map(s => [s.id, s]));

// Attendance marks. `payFactor` is the fraction of a day's wage earned.
export const ATTENDANCE_STATUS = {
  present:   { id: 'present',   label: 'Present',    short: 'P',  payFactor: 1,   color: '#0A7C4A', bg: '#E8F5EE' },
  half_day:  { id: 'half_day',  label: 'Half day',   short: '½',  payFactor: 0.5, color: '#C27C0E', bg: '#FEF3DC' },
  paid_leave:{ id: 'paid_leave',label: 'Paid leave', short: 'PL', payFactor: 1,   color: '#2B6CB0', bg: '#EBF4FF' },
  absent:    { id: 'absent',    label: 'Absent',     short: 'A',  payFactor: 0,   color: '#C53030', bg: '#FEF0F0' },
  week_off:  { id: 'week_off',  label: 'Week off',   short: 'WO', payFactor: 0,   color: '#718096', bg: '#F1F3F7' },
  holiday:   { id: 'holiday',   label: 'Holiday',    short: 'H',  payFactor: 1,   color: '#6B46C1', bg: '#FAF5FF' },
};

export const ATTENDANCE_ORDER = ['present', 'half_day', 'absent', 'paid_leave', 'week_off', 'holiday'];

export const PAYROLL_STATUS_BADGE = {
  draft:  'badge badge-neutral',
  paid:   'badge badge-success',
};

// ---- Party khata (running ledger) ----
// Positive balance means the party owes the business.
export const KHATA_ENTRY_TYPES = {
  gave:  { id: 'gave',  label: 'You gave',  sign: +1, color: '#C53030' },
  got:   { id: 'got',   label: 'You got',   sign: -1, color: '#0A7C4A' },
};
