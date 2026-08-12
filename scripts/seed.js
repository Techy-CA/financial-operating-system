#!/usr/bin/env node
/**
 * seed.js — Loads a complete demo company into Firestore for a live walkthrough.
 *
 *   npm run seed
 *
 * Signs in (or creates) the demo account with the project's public web API key
 * and writes through the REST API, so no service-account key is needed. All data
 * lands under one company document (DEMO_COMPANY_ID); re-running wipes only that
 * company and rebuilds it, never touching anything else in the project.
 *
 * Override the account with SEED_EMAIL / SEED_PASSWORD.
 */

const API_KEY    = process.env.FIREBASE_API_KEY || 'AIzaSyCuJZ6enu91CWaJFKQ7lbFGb2nBpf_KSPo';
const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'finos-543d9';
const EMAIL      = process.env.SEED_EMAIL    || 'admin@gmail.com';
const PASSWORD   = process.env.SEED_PASSWORD || '123456789';
const COMPANY_ID = 'demo-eka-gifts';
const TODAY      = process.env.SEED_TODAY || new Date().toISOString().slice(0, 10);

const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
const DOC  = (p) => `projects/${PROJECT_ID}/databases/(default)/documents/${p}`;

// ── tiny helpers ─────────────────────────────────────────────────────────────
const r2 = (n) => Math.round((n || 0) * 100) / 100;
const r3 = (n) => Math.round((n || 0) * 1000) / 1000;
const day = (iso, add = 0) => { const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + add); return d.toISOString().slice(0, 10); };
const ts = (iso, secs = 0) => new Date(new Date(iso + 'T09:30:00Z').getTime() + secs * 1000).toISOString();
let _seed = 42;
const rand = () => { _seed = (_seed * 1103515245 + 12345) % 2147483648; return _seed / 2147483648; };
const pick = (arr) => arr[Math.floor(rand() * arr.length)];

// ── Firestore value encoding ─────────────────────────────────────────────────
function encode(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === 'string') {
    return /^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/.test(v) ? { timestampValue: v } : { stringValue: v };
  }
  if (typeof v === 'number')  return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (Array.isArray(v))       return { arrayValue: { values: v.map(encode) } };
  if (typeof v === 'object')  return { mapValue: { fields: toFields(v) } };
  return { stringValue: String(v) };
}
function toFields(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj)) if (v !== undefined) out[k] = encode(v);
  return out;
}

async function api(url, opts = {}, token) {
  const res = await fetch(url, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(opts.headers || {}) },
  });
  const text = await res.text();
  let json = {}; try { json = text ? JSON.parse(text) : {}; } catch { json = { raw: text }; }
  if (!res.ok) throw new Error(`${res.status} ${url.split('/documents')[1] || url} → ${json?.error?.message || text.slice(0, 200)}`);
  return json;
}

// ── auth ─────────────────────────────────────────────────────────────────────
async function signIn() {
  const body = JSON.stringify({ email: EMAIL, password: PASSWORD, returnSecureToken: true });
  try {
    const r = await api(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`, { method: 'POST', body });
    console.log(`  signed in as ${EMAIL}`);
    return { token: r.idToken, uid: r.localId };
  } catch (e) {
    if (!/EMAIL_NOT_FOUND|INVALID_LOGIN_CREDENTIALS/.test(e.message)) throw e;
    const r = await api(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${API_KEY}`, { method: 'POST', body });
    console.log(`  created account ${EMAIL}`);
    await api(`https://identitytoolkit.googleapis.com/v1/accounts:update?key=${API_KEY}`, {
      method: 'POST', body: JSON.stringify({ idToken: r.idToken, displayName: 'Demo Admin', returnSecureToken: false }),
    }).catch(() => {});
    return { token: r.idToken, uid: r.localId };
  }
}

// ── writes ───────────────────────────────────────────────────────────────────
const writes = [];
const put = (path, data) => writes.push({ update: { name: DOC(path), fields: toFields(data) } });

async function flush(token) {
  for (let i = 0; i < writes.length; i += 300) {
    const chunk = writes.slice(i, i + 300);
    await api(`${BASE}:commit`, { method: 'POST', body: JSON.stringify({ writes: chunk }) }, token);
    process.stdout.write(`  written ${Math.min(i + 300, writes.length)}/${writes.length}\r`);
  }
  console.log(`  written ${writes.length}/${writes.length} documents   `);
}

async function wipeCollection(col, token) {
  let pageToken, names = [];
  do {
    const url = `${BASE}/companies/${COMPANY_ID}/${col}?pageSize=300${pageToken ? `&pageToken=${pageToken}` : ''}`;
    const res = await api(url, {}, token).catch(() => ({}));
    (res.documents || []).forEach(d => names.push(d.name));
    pageToken = res.nextPageToken;
  } while (pageToken);
  for (let i = 0; i < names.length; i += 300) {
    await api(`${BASE}:commit`, {
      method: 'POST', body: JSON.stringify({ writes: names.slice(i, i + 300).map(n => ({ delete: n })) }),
    }, token);
  }
  return names.length;
}

// ── master data ──────────────────────────────────────────────────────────────
const HOME_STATE = 'Maharashtra';

const COMPANY = {
  name: 'Eka Gifts Pvt Ltd',
  gstin: '27AAECE1234F1Z5',
  pan: 'AAECE1234F',
  email: 'accounts@ekagifts.com',
  phone: '9820045512',
  website: 'https://ekagifts.com',
  state: HOME_STATE,
  address: 'Unit 14, Kohinoor Industrial Estate, Andheri East',
  city: 'Mumbai',
  pincode: '400059',
  invoicePrefix: 'EKA',
  defaultCreditDays: 30,
  defaultTerms: 'Payment due within 30 days. 18% p.a. interest applies on overdue amounts.',
  defaultNotes: 'Thank you for your business. Goods once sold will not be taken back.',
  bankName: 'Eka Gifts Pvt Ltd',
  bankBankName: 'HDFC Bank',
  bankAccountNo: '50200078451236',
  bankIFSC: 'HDFC0000521',
  bankBranch: 'Andheri East, Mumbai',
  bankAccountType: 'Current',
  upiId: 'ekagifts@hdfcbank',
  signatoryName: 'Shubham Sugandhi',
  paymentRemarks: 'Please quote the invoice number in the payment reference.',
  invoiceCategories: ['Corporate Gifting', 'Retail Order', 'Custom Branding', 'Festive Hamper', 'Packaging', 'Other'],
};

const WAREHOUSES = [
  { id: 'wh-andheri', name: 'Andheri Warehouse', address: 'Kohinoor Industrial Estate, Mumbai' },
  { id: 'wh-pune',    name: 'Pune Shop',         address: 'FC Road, Pune' },
];

// key, name, sku, hsn, unit, rate, gst, cost, reorder, targetStock (null = service)
const PRODUCTS = [
  ['mug',    'Ceramic Coffee Mug — 350ml',      'MUG-CER-01', '6912', 'Nos', 449,   18,  210,  25,  164],
  ['diary',  'Personalised Leather Diary A5',   'DIA-A5-01',  '4820', 'Nos', 599,   12,  280,  20,   96],
  ['hamper', 'Corporate Gift Hamper — Premium', 'HAM-COR-01', '2106', 'Nos', 2499,  18,  1350, 10,   38],
  ['bottle', 'Bamboo Insulated Bottle 750ml',   'BOT-BAM-01', '3924', 'Nos', 899,   18,  420,  15,   72],
  ['tote',   'Organic Cotton Tote Bag',         'TOT-COT-01', '4202', 'Nos', 349,    5,  150,  30,  210],
  ['pen',    'Metal Pen & Keyring Set',         'PEN-MET-01', '9608', 'Set', 799,   18,  360,  20,   14],
  ['desk',   'Bamboo Desk Organiser',           'ORG-DSK-01', '4420', 'Nos', 1299,  18,  640,  12,   45],
  ['choco',  'Assorted Chocolate Box — 16pc',   'CHO-BOX-01', '1806', 'Box', 649,   18,  300,  40,  118],
  ['tshirt', 'Custom Printed T-Shirt',          'TSH-CUS-01', '6109', 'Nos', 499,    5,  230,  25,   88],
  ['card',   'Premium Gift Card & Envelope',    'ENV-GFT-01', '4817', 'Nos',  99,   12,   35, 100,   62],
  ['bag',    'Jute Hamper Carry Bag',           'BAG-JUT-01', '4602', 'Nos', 199,   12,   80,  50,    0],
  ['design', 'Custom Design & Branding',        null,         '998391','Hr', 15000, 18,    0,   0, null],
  ['pack',   'Gift Curation & Packaging',       null,         '998540','Nos', 5000, 18,    0,   0, null],
];

const CUSTOMERS = [
  ['Nimbus Softech Pvt Ltd',   '27AABCN2345K1Z9', HOME_STATE,     'Pune',      'accounts@nimbussoftech.in', '9822011234', 500000],
  ['Sanchi Retail LLP',        '27AACFS8899L1ZP', HOME_STATE,     'Mumbai',    'finance@sanchiretail.in',   '9819922331', 300000],
  ['Kanha Foods Pvt Ltd',      '24AADCK4567M1Z2', 'Gujarat',      'Ahmedabad', 'ap@kanhafoods.com',         '9925511220', 400000],
  ['Aarohi Interiors',         '29AAFCA1122N1ZK', 'Karnataka',    'Bengaluru', 'hello@aarohiinteriors.in',  '9845567788', 200000],
  ['Trilok Pharma Ltd',        '27AABCT7788P1Z4', HOME_STATE,     'Nashik',    'purchase@trilokpharma.in',  '9881144556', 750000],
  ['Vayu Logistics Pvt Ltd',   '07AAGCV3344Q1Z8', 'Delhi',        'New Delhi', 'accounts@vayulogistics.in', '9811223344', 350000],
  ['Meher Textiles',           '33AAHFM5566R1ZC', 'Tamil Nadu',   'Coimbatore','meher.textiles@gmail.com',  '9840099887', 150000],
  ['Orbit Fintech Pvt Ltd',    '27AAJCO9900S1Z6', HOME_STATE,     'Mumbai',    'ops@orbitfintech.in',       '9820556677', 600000],
  ['Suryodaya Constructions',  '08AAKFS2233T1ZD', 'Rajasthan',    'Jaipur',    'accounts@suryodaya.co.in',  '9829011223', 250000],
  ['Neelkanth Hospitality',    '27AALFN4455U1Z1', HOME_STATE,     'Pune',      'billing@neelkanthhotels.in','9970012345', 300000],
  ['Zenith EdTech Pvt Ltd',    '36AAMCZ6677V1ZB', 'Telangana',    'Hyderabad', 'finance@zenithedtech.com',  '9948877665', 450000],
  ['Bandra Coworks LLP',       '27AANFB8899W1ZM', HOME_STATE,     'Mumbai',    'admin@bandracoworks.in',    '9930011223', 180000],
];

const VENDORS = [
  ['Shreeji Ceramics',      '24AABCS1234A1Z5', 'Gujarat',    'Morbi',  'sales@shreejiceramics.in', '9825011223'],
  ['Ratna Packaging Co',    '27AACFR5566B1ZQ', HOME_STATE,   'Mumbai', 'orders@ratnapack.in',      '9820112233'],
  ['Urban Print Studio',    '27AADFU7788C1ZR', HOME_STATE,   'Pune',   'hello@urbanprint.in',      '9890011223'],
  ['Cocoa Craft Foods LLP', '29AAECC9900D1ZT', 'Karnataka',  'Bengaluru','sales@cocoacraft.in',    '9844556677'],
  ['Nordic Paper Mills',    '19AAFCN1122E1ZU', 'West Bengal','Kolkata','accounts@nordicpaper.in',  '9831122334'],
  ['Global Freight Movers', '27AAGCG3344F1ZV', HOME_STATE,   'Mumbai', 'ops@globalfreight.in',     '9820445566'],
];

// invoiceNumber suffix, customer index, date, status, [[productKey, qty, discount%]], category
const INVOICE_PLAN = [
  [ 1,  0, '2026-04-06', 'paid',    [['mug', 120, 0], ['card', 120, 0]],                 'Corporate Gifting'],
  [ 2,  2, '2026-04-11', 'paid',    [['hamper', 25, 5], ['bag', 25, 0]],                 'Festive Hamper'],
  [ 3,  4, '2026-04-18', 'paid',    [['diary', 60, 0], ['pen', 60, 10]],                 'Corporate Gifting'],
  [ 4,  1, '2026-04-24', 'paid',    [['tote', 200, 0], ['design', 2, 0]],                'Custom Branding'],
  [ 5,  7, '2026-05-04', 'paid',    [['bottle', 80, 0], ['tshirt', 80, 5]],              'Corporate Gifting'],
  [ 6,  3, '2026-05-09', 'paid',    [['desk', 30, 0], ['mug', 30, 0]],                   'Retail Order'],
  [ 7,  9, '2026-05-15', 'partial', [['hamper', 40, 8], ['pack', 1, 0]],                 'Festive Hamper'],
  [ 8,  5, '2026-05-21', 'paid',    [['choco', 150, 0], ['card', 150, 0]],               'Retail Order'],
  [ 9, 10, '2026-05-28', 'paid',    [['tshirt', 120, 0], ['design', 1, 0]],              'Custom Branding'],
  [10,  0, '2026-06-03', 'paid',    [['mug', 90, 0], ['bottle', 45, 0]],                 'Corporate Gifting'],
  [11,  6, '2026-06-09', 'overdue', [['tote', 150, 0], ['bag', 150, 0]],                 'Retail Order'],
  [12,  8, '2026-06-16', 'paid',    [['diary', 45, 0], ['desk', 20, 5]],                 'Corporate Gifting'],
  [13, 11, '2026-06-22', 'overdue', [['choco', 90, 0], ['card', 90, 0]],                 'Festive Hamper'],
  [14,  4, '2026-06-29', 'paid',    [['hamper', 30, 0], ['pack', 1, 0]],                 'Festive Hamper'],
  [15,  1, '2026-07-06', 'paid',    [['pen', 80, 0], ['mug', 80, 5]],                    'Corporate Gifting'],
  [16,  7, '2026-07-13', 'partial', [['bottle', 100, 0], ['tote', 100, 0]],              'Corporate Gifting'],
  [17,  2, '2026-07-17', 'overdue', [['tshirt', 60, 0], ['bag', 60, 0]],                 'Retail Order'],
  [18,  5, '2026-07-23', 'paid',    [['desk', 25, 0], ['diary', 25, 0]],                 'Corporate Gifting'],
  [19,  9, '2026-07-29', 'sent',    [['choco', 120, 5], ['card', 120, 0]],               'Festive Hamper'],
  [20,  3, '2026-08-03', 'overdue', [['mug', 70, 0], ['pen', 35, 0]],                    'Corporate Gifting'],
  [21, 10, '2026-08-05', 'partial', [['hamper', 22, 0], ['design', 1, 0]],               'Custom Branding'],
  [22,  0, '2026-08-07', 'sent',    [['tote', 180, 0], ['tshirt', 90, 0]],               'Retail Order'],
  [23,  8, '2026-08-08', 'sent',    [['bottle', 60, 0], ['bag', 60, 0]],                 'Corporate Gifting'],
  [24, 11, '2026-08-10', 'sent',    [['diary', 40, 0], ['pack', 1, 0]],                  'Corporate Gifting'],
  [25,  6, '2026-08-11', 'sent',    [['choco', 60, 0], ['mug', 60, 0]],                  'Festive Hamper'],
  [26,  4, '2026-08-12', 'draft',   [['hamper', 50, 10], ['pack', 1, 0]],                'Festive Hamper'],
];

// Sized for a gifting SME billing roughly ₹55L a year, so the P&L closes with a
// healthy margin rather than a demo-breaking loss.
const EXPENSE_PLAN = [
  ['2026-04-02', 'rent',          'Office & warehouse rent — April',         38000, 18, 'Kohinoor Estates'],
  ['2026-04-04', 'raw_material',  'Ceramic blanks — 500 units',              42000, 18, 'Shreeji Ceramics'],
  ['2026-04-09', 'salary',        'Salaries — April',                        82000,  0, null],
  ['2026-04-15', 'marketing',     'Instagram & Google Ads',                  18500, 18, 'Meta Platforms'],
  ['2026-04-22', 'raw_material',  'Gift boxes & jute bags',                  26000, 12, 'Ratna Packaging Co'],
  ['2026-04-28', 'utilities',     'Electricity & internet — April',           7400, 18, 'MSEDCL'],
  ['2026-05-02', 'rent',          'Office & warehouse rent — May',           38000, 18, 'Kohinoor Estates'],
  ['2026-05-06', 'raw_material',  'Bamboo bottles — 300 units',              38000, 18, 'Shreeji Ceramics'],
  ['2026-05-10', 'salary',        'Salaries — May',                          82000,  0, null],
  ['2026-05-14', 'travel',        'Client visits — Pune & Nashik',            8400,  5, null],
  ['2026-05-19', 'software',      'Design suite + CRM subscription',          9500, 18, 'Adobe India'],
  ['2026-05-26', 'professional',  'CA retainer — Q1 filings',                15000, 18, 'Deshpande & Associates'],
  ['2026-06-01', 'rent',          'Office & warehouse rent — June',          38000, 18, 'Kohinoor Estates'],
  ['2026-06-05', 'raw_material',  'Chocolate stock — festive batch',         29000, 18, 'Cocoa Craft Foods LLP'],
  ['2026-06-10', 'salary',        'Salaries — June',                         88000,  0, null],
  ['2026-06-13', 'marketing',     'Corporate gifting catalogue print',       22000, 12, 'Urban Print Studio'],
  ['2026-06-18', 'bank_charges',  'Payment gateway & bank charges',           3900, 18, 'HDFC Bank'],
  ['2026-06-24', 'maintenance',   'Warehouse racking repair',                 8500, 18, null],
  ['2026-06-30', 'gst',           'GST payment — Q1',                        42000,  0, null],
  ['2026-07-01', 'rent',          'Office & warehouse rent — July',          38000, 18, 'Kohinoor Estates'],
  ['2026-07-04', 'raw_material',  'Cotton totes & t-shirt blanks',           34000,  5, 'Nordic Paper Mills'],
  ['2026-07-09', 'salary',        'Salaries — July',                         88000,  0, null],
  ['2026-07-12', 'travel',        'Freight — Bengaluru & Hyderabad orders',  12600,  5, 'Global Freight Movers'],
  ['2026-07-17', 'utilities',     'Electricity & internet — July',            8100, 18, 'MSEDCL'],
  ['2026-07-21', 'insurance',     'Stock & fire insurance premium',          14000, 18, 'ICICI Lombard'],
  ['2026-07-25', 'marketing',     'Influencer campaign — festive teaser',    26000, 18, null],
  ['2026-07-30', 'entertainment', 'Client dinner — Orbit Fintech',            5400,  5, null],
  ['2026-08-01', 'rent',          'Office & warehouse rent — August',        38000, 18, 'Kohinoor Estates'],
  ['2026-08-03', 'raw_material',  'Leather diaries — 200 units',             26000, 12, 'Nordic Paper Mills'],
  ['2026-08-06', 'salary',        'Salaries — August',                       94000,  0, null],
  ['2026-08-07', 'software',      'Cloud hosting & FinOS subscription',       6500, 18, null],
  ['2026-08-09', 'tds',           'TDS payment — 194C contractors',           9800,  0, null],
  ['2026-08-10', 'professional',  'Trademark filing — brand refresh',        18000, 18, 'Deshpande & Associates'],
  ['2026-08-11', 'travel',        'Freight — Delhi & Jaipur dispatch',        9800,  5, 'Global Freight Movers'],
];

const QUOTATION_PLAN = [
  ['QT-0001', 0, '2026-07-18', '2026-08-17', 'approved', 'Diwali gifting — 300 hampers',        812000],
  ['QT-0002', 6, '2026-07-26', '2026-08-25', 'sent',     'Employee welcome kits — 150 sets',    268000],
  ['QT-0003', 3, '2026-08-01', '2026-08-31', 'sent',     'Branded merchandise for annual day',  394000],
  ['QT-0004', 8, '2026-08-04', '2026-09-03', 'rejected', 'Site handover gift boxes — 80 units', 142000],
  ['QT-0005', 10,'2026-08-08', '2026-09-07', 'sent',     'Student achiever kits — 500 units',   576000],
  ['QT-0006', 1, '2026-08-11', '2026-09-10', 'draft',    'Festive retail restock — assorted',   231000],
];

// ── build ────────────────────────────────────────────────────────────────────
function build(uid) {
  const P = {};   // productKey → record
  const C = [];   // customers
  const stockMoves = [];
  let moveSeq = 0;

  // Products
  PRODUCTS.forEach(([key, name, sku, hsn, unit, rate, gstRate, cost, reorder, target], i) => {
    const isService = target === null;
    P[key] = {
      id: `prod-${key}`, key, name, sku, hsn, unit, rate, gstRate,
      type: isService ? 'service' : 'product',
      purchaseRate: cost, reorderLevel: reorder, target, isService,
      description: isService ? 'Billed per engagement' : null,
      createdAt: ts('2026-04-01', i * 60),
      // running state for the simulation
      qty: 0, avg: 0, wh: {},
    };
  });

  // Customers / vendors
  CUSTOMERS.forEach(([name, gstin, state, city, email, phone, credit], i) => {
    C.push({ id: `cust-${i + 1}`, name, gstin, state, city, email, phone, credit_limit: credit,
      type: 'business', address: `${city}, ${state}`, pincode: '400001',
      interState: state !== HOME_STATE, createdAt: ts('2026-04-01', i * 30) });
  });

  // ── stock simulation ───────────────────────────────────────────────────────
  const move = (p, type, qty, rate, reason, date, extra = {}) => {
    if (qty <= 0) return;
    const before = r3(p.qty);
    const dir = type === 'in' ? 1 : -1;
    const after = r3(before + dir * qty);
    if (dir > 0) {
      const base = Math.max(before, 0);
      p.avg = r2((base + qty) > 0 ? ((base * p.avg) + (qty * rate)) / (base + qty) : rate);
    }
    const unitValue = dir > 0 ? rate : p.avg;
    const whId = extra.warehouseId || 'default';
    const whName = extra.warehouseName || 'Main Store';
    p.wh[whId] = r3((p.wh[whId] || 0) + dir * qty);
    p.qty = after;
    stockMoves.push({
      id: `mv-${String(++moveSeq).padStart(4, '0')}`,
      productId: p.id, productName: p.name, sku: p.sku, unit: p.unit,
      type, reason, qty: r3(qty), rate: r2(unitValue), value: r2(qty * unitValue),
      balanceBefore: before, balanceAfter: after,
      warehouseId: whId, warehouseName: whName,
      date, refType: extra.refType || 'manual', refId: extra.refId || null,
      refNumber: extra.refNumber || null, notes: extra.notes || null,
      createdAt: ts(date, moveSeq * 7), createdBy: uid, createdByName: 'Demo Admin',
    });
  };

  // Sales pulled from the invoice plan (drafts move nothing)
  const salesByProduct = {};
  const invoiceSales = [];
  INVOICE_PLAN.forEach(([num, , date, status, lines]) => {
    if (status === 'draft') return;
    lines.forEach(([key, qty]) => {
      if (P[key].isService) return;
      salesByProduct[key] = (salesByProduct[key] || 0) + qty;
      invoiceSales.push({ key, qty, date, num });
    });
  });

  // Purchases + shrinkage, then an opening balance that lands on the target stock
  const purchasePlan = {
    mug:    [['2026-04-03', 260, 205], ['2026-06-02', 180, 214]],
    diary:  [['2026-04-05', 140, 275], ['2026-07-02', 120, 288]],
    hamper: [['2026-04-08', 90, 1320], ['2026-06-26', 70, 1385]],
    bottle: [['2026-05-02', 190, 412], ['2026-08-02', 90, 431]],
    tote:   [['2026-04-12', 380, 148], ['2026-07-03', 320, 154]],
    pen:    [['2026-04-16', 130, 355], ['2026-07-05', 90, 368]],
    desk:   [['2026-05-06', 80, 632], ['2026-07-20', 40, 651]],
    choco:  [['2026-05-18', 300, 296], ['2026-08-04', 180, 308]],
    tshirt: [['2026-05-25', 240, 226], ['2026-07-27', 150, 236]],
    card:   [['2026-04-10', 400, 34],  ['2026-06-19', 250, 36]],
    bag:    [['2026-04-14', 260, 78],  ['2026-07-06', 180, 82]],
  };
  const shrinkPlan = [
    ['mug',   '2026-06-11', 6,  'damage',     'Broken in transit — Andheri'],
    ['choco', '2026-07-15', 12, 'damage',     'Expired stock written off'],
    ['tote',  '2026-08-06', 4,  'consumption','Used as marketing samples'],
  ];

  // Opening balance chosen so each item lands on its target stock:
  //   target = opening + purchases − sales − shrinkage
  // When purchases alone already overshoot the target they are trimmed back,
  // and any leftover difference is closed by a physical stock count in August.
  const openings = {};
  Object.keys(purchasePlan).forEach(key => {
    const p = P[key];
    const rows = purchasePlan[key];
    const sold   = salesByProduct[key] || 0;
    const shrunk = shrinkPlan.filter(s => s[0] === key).reduce((s, x) => s + x[2], 0);
    const total  = () => rows.reduce((s, [, q]) => s + q, 0);

    let need = Math.round(p.target - (total() - sold - shrunk));
    if (need < 0) {                       // bought more than the target — buy less
      let trim = -need;
      for (let i = rows.length - 1; i >= 0 && trim > 0; i--) {
        const cut = Math.min(rows[i][1] - 10, trim);
        if (cut > 0) { rows[i][1] -= cut; trim -= cut; }
      }
      need = Math.round(p.target - (total() - sold - shrunk));
    }
    openings[key] = Math.max(0, need);
  });

  // Replay every movement in date order so balances and valuation reconcile.
  // Runs twice: the first pass reveals any point where stock would have gone
  // negative, the opening balance absorbs it, and the second pass is the one
  // that gets written.
  function replay() {
    stockMoves.length = 0; moveSeq = 0;
    Object.values(P).forEach(p => { p.qty = 0; p.avg = 0; p.wh = {}; });

    const timeline = [];
    Object.entries(openings).forEach(([key, qty]) => {
      if (qty > 0) timeline.push({ date: '2026-04-01', kind: 'open', key, qty, rate: P[key].purchaseRate });
    });
    Object.entries(purchasePlan).forEach(([key, rows]) =>
      rows.forEach(([date, qty, rate], i) => timeline.push({ date, kind: 'purchase', key, qty, rate, i })));
    invoiceSales.forEach(s => timeline.push({ date: s.date, kind: 'sale', ...s }));
    shrinkPlan.forEach(([key, date, qty, reason, note]) => timeline.push({ date, kind: 'shrink', key, qty, reason, note }));
    timeline.sort((a, b) => a.date.localeCompare(b.date));

    timeline.forEach(ev => {
      const p = P[ev.key];
      if (ev.kind === 'open')     move(p, 'in',  ev.qty, ev.rate, 'opening',  ev.date, { refType: 'opening', notes: 'Opening stock — FY 2026-27' });
      if (ev.kind === 'purchase') move(p, 'in',  ev.qty, ev.rate, 'purchase', ev.date, { refType: 'manual', refNumber: `GRN-${1000 + stockMoves.length}`, warehouseId: ev.i === 1 ? 'wh-andheri' : 'default', warehouseName: ev.i === 1 ? 'Andheri Warehouse' : 'Main Store' });
      if (ev.kind === 'sale')     move(p, 'out', ev.qty, 0, 'sale', ev.date, { refType: 'invoice', refId: `inv-${String(ev.num).padStart(4, '0')}`, refNumber: `EKA-${String(ev.num).padStart(4, '0')}` });
      if (ev.kind === 'shrink')   move(p, 'out', ev.qty, 0, ev.reason, ev.date, { notes: ev.note });
    });
  }

  replay();
  let patched = false;
  Object.keys(purchasePlan).forEach(key => {
    const lowest = Math.min(0, ...stockMoves.filter(m => m.productId === P[key].id).map(m => m.balanceAfter));
    if (lowest < 0) { openings[key] += Math.ceil(Math.abs(lowest)); patched = true; }
  });
  if (patched) replay();

  // Close the remaining gap to the target with a physical count on 09 Aug
  Object.keys(purchasePlan).forEach(key => {
    const p = P[key];
    const diff = Math.round(p.target - p.qty);
    if (diff !== 0) {
      move(p, diff > 0 ? 'in' : 'out', Math.abs(diff), p.purchaseRate, 'adjustment', '2026-08-09',
        { notes: 'Physical stock count — August' });
    }
  });

  // ── documents ──────────────────────────────────────────────────────────────
  put(`users/${uid}`, { uid, displayName: 'Demo Admin', email: EMAIL, photoURL: null, createdAt: ts('2026-04-01') });
  put(`companies/${COMPANY_ID}`, { ...COMPANY, ownerId: uid, createdAt: ts('2026-04-01'), updatedAt: ts(TODAY) });
  put(`companies/${COMPANY_ID}/members/${uid}`, { uid, email: EMAIL, role: 'founder', joinedAt: ts('2026-04-01') });
  put(`companyUsers/${COMPANY_ID}_${uid}`, { uid, email: EMAIL, companyId: COMPANY_ID, role: 'founder', joinedAt: ts('2026-04-01') });

  WAREHOUSES.forEach((w, i) => put(`companies/${COMPANY_ID}/warehouses/${w.id}`,
    { name: w.name, address: w.address, createdAt: ts('2026-04-01', i * 10), createdBy: uid }));

  Object.values(P).forEach(p => {
    put(`companies/${COMPANY_ID}/products/${p.id}`, {
      name: p.name, type: p.type, hsn: p.hsn, sku: p.sku, unit: p.unit,
      rate: p.rate, gstRate: p.gstRate, description: p.description,
      trackInventory: !p.isService,
      ...(p.isService ? {} : {
        purchaseRate: p.purchaseRate, reorderLevel: p.reorderLevel,
        stockQty: r3(p.qty), avgCost: r2(p.avg), stockValue: r2(p.qty * p.avg),
        stockByWarehouse: p.wh, lastMovementAt: ts(TODAY),
      }),
      createdAt: p.createdAt, createdBy: uid,
    });
  });

  C.forEach(c => put(`companies/${COMPANY_ID}/customers/${c.id}`, {
    name: c.name, type: c.type, gstin: c.gstin, state: c.state, city: c.city,
    email: c.email, phone: c.phone, address: c.address, pincode: c.pincode,
    credit_limit: c.credit_limit, createdAt: c.createdAt, createdBy: uid,
  }));

  VENDORS.forEach(([name, gstin, state, city, email, phone], i) =>
    put(`companies/${COMPANY_ID}/vendors/vend-${i + 1}`, {
      name, gstin, state, city, email, phone, address: `${city}, ${state}`,
      createdAt: ts('2026-04-01', i * 45), createdBy: uid,
    }));

  // Invoices + line items + payments
  let payNo = 0;
  INVOICE_PLAN.forEach(([num, custIdx, date, status, lines, category]) => {
    const cust = C[custIdx];
    const inter = cust.interState;
    const id = `inv-${String(num).padStart(4, '0')}`;
    const invoiceNumber = `EKA-${String(num).padStart(4, '0')}`;

    let subTotal = 0, totalDiscount = 0, totalTaxable = 0, gstTotal = 0;
    const items = lines.map(([key, qty, disc], pos) => {
      const p = P[key];
      const gross = qty * p.rate;
      const discAmt = gross * ((disc || 0) / 100);
      const net = gross - discAmt;
      const gst = net * (p.gstRate / 100);
      subTotal += gross; totalDiscount += discAmt; totalTaxable += net; gstTotal += gst;
      return {
        id: `${id}-li-${pos}`, invoiceId: id, position: pos,
        description: p.name, productId: p.id, hsn: p.hsn, qty, unit: p.unit,
        rate: p.rate, discount: disc || 0, gstRate: p.gstRate,
        lineNet: r2(net), lineTotal: r2(net + gst), createdAt: ts(date, pos),
      };
    });

    const grandTotal = r2(r2(totalTaxable) + r2(gstTotal));
    const paidAmount = status === 'paid' ? grandTotal
                     : status === 'partial' ? r2(grandTotal * (num % 2 ? 0.5 : 0.4))
                     : 0;
    const dueDate = day(date, 30);

    put(`companies/${COMPANY_ID}/invoices/${id}`, {
      invoiceNumber, invoiceCategory: category, type: 'tax_invoice',
      invoiceDate: date, dueDate,
      customerId: cust.id, customerName: cust.name, customerEmail: cust.email,
      placeOfSupply: cust.state, interState: inter,
      notes: COMPANY.defaultNotes, terms: COMPANY.defaultTerms,
      subTotal: r2(subTotal), totalDiscount: r2(totalDiscount), totalTaxable: r2(totalTaxable),
      cgst: inter ? 0 : r2(gstTotal / 2), sgst: inter ? 0 : r2(gstTotal / 2), igst: inter ? r2(gstTotal) : 0,
      totalGST: r2(gstTotal), grandTotal,
      status, paidAmount, balanceDue: r2(grandTotal - paidAmount),
      companyId: COMPANY_ID, createdAt: ts(date, 5), createdBy: uid,
    });

    items.forEach(it => put(`companies/${COMPANY_ID}/invoiceItems/${it.id}`, it));

    if (paidAmount > 0) {
      const payDate = day(date, status === 'paid' ? 12 : 20);
      put(`companies/${COMPANY_ID}/payments/pay-${String(++payNo).padStart(4, '0')}`, {
        invoiceId: id, invoiceNumber, customerId: cust.id, customerName: cust.name,
        amount: paidAmount, method: pick(['bank_transfer', 'upi', 'cheque', 'bank_transfer']),
        paymentDate: payDate, reference: `UTR${800000 + num * 137}`,
        createdAt: ts(payDate, 3), createdBy: uid,
      });
    }
  });

  put(`companies/${COMPANY_ID}/settings/invoice_counter`, { last: INVOICE_PLAN.length, updatedAt: ts(TODAY) });

  EXPENSE_PLAN.forEach(([date, category, description, amount, gstRate, vendorName], i) =>
    put(`companies/${COMPANY_ID}/expenses/exp-${String(i + 1).padStart(4, '0')}`, {
      expenseDate: date, category, description, amount,
      gstRate, gstAmount: r2(amount * (gstRate / (100 + gstRate))),
      vendorName, reference: `BILL-${2600 + i}`, notes: null,
      createdAt: ts(date, i), createdBy: uid,
    }));

  QUOTATION_PLAN.forEach(([qNo, custIdx, date, valid, status, subject, grandTotal], i) => {
    const cust = C[custIdx];
    const taxable = r2(grandTotal / 1.18);
    put(`companies/${COMPANY_ID}/quotations/quot-${i + 1}`, {
      quotationNumber: qNo, customerId: cust.id, customerName: cust.name,
      quotationDate: date, validUntil: valid, status, subject,
      subTotal: taxable, totalGST: r2(grandTotal - taxable), grandTotal,
      notes: 'Prices valid for 30 days. Delivery 10–12 working days from PO.',
      terms: COMPANY.defaultTerms, createdAt: ts(date, i), createdBy: uid,
    });
  });

  stockMoves.forEach(m => put(`companies/${COMPANY_ID}/stockMovements/${m.id}`, m));

  const activity = [
    ['invoice',   'Invoice EKA-0025 sent to Meher Textiles',            '2026-08-11'],
    ['payment',   'Payment of ₹1,42,000 received from Trilok Pharma',   '2026-08-11'],
    ['inventory', 'Stock in · Assorted Chocolate Box +180 Box',         '2026-08-04'],
    ['inventory', 'Stock out · Organic Cotton Tote Bag −4 Nos (Internal use)', '2026-08-06'],
    ['expense',   'Expense added: Freight — Delhi & Jaipur dispatch',   '2026-08-11'],
    ['invoice',   'Invoice EKA-0024 sent to Bandra Coworks LLP',        '2026-08-10'],
    ['customer',  'New customer added: Zenith EdTech Pvt Ltd',          '2026-08-08'],
    ['inventory', 'Stock in · Bamboo Insulated Bottle +90 Nos',         '2026-08-02'],
  ];
  activity.forEach(([type, message, date], i) =>
    put(`companies/${COMPANY_ID}/activityLogs/act-${i + 1}`, {
      type, message, userId: uid, userName: 'Demo Admin', createdAt: ts(date, i * 11),
    }));

  return { products: P, customers: C, moves: stockMoves };
}

// ── run ──────────────────────────────────────────────────────────────────────
(async () => {
  console.log(`\nFinOS demo seed → project ${PROJECT_ID}\n`);
  const { token, uid } = await signIn();

  console.log('  clearing previous demo data…');
  const cols = ['customers', 'vendors', 'products', 'warehouses', 'invoices', 'invoiceItems',
                'payments', 'expenses', 'quotations', 'stockMovements', 'activityLogs', 'settings', 'members'];
  let removed = 0;
  for (const c of cols) removed += await wipeCollection(c, token);
  console.log(`  removed ${removed} old documents`);

  const { products, moves } = build(uid);
  await flush(token);

  const tracked = Object.values(products).filter(p => !p.isService);
  const low = tracked.filter(p => p.reorderLevel > 0 && p.qty <= p.reorderLevel && p.qty > 0);
  const out = tracked.filter(p => p.qty === 0);
  const value = tracked.reduce((s, p) => s + p.qty * p.avg, 0);

  console.log(`
  Company    : ${COMPANY.name}  (${COMPANY_ID})
  Login      : ${EMAIL}  /  ${PASSWORD}
  Customers  : ${CUSTOMERS.length}   Vendors: ${VENDORS.length}   Products: ${PRODUCTS.length}
  Invoices   : ${INVOICE_PLAN.length}   Expenses: ${EXPENSE_PLAN.length}   Quotations: ${QUOTATION_PLAN.length}
  Stock      : ${moves.length} movements · ₹${Math.round(value).toLocaleString('en-IN')} on hand
               ${low.length} low stock (${low.map(p => p.sku).join(', ') || '—'})
               ${out.length} out of stock (${out.map(p => p.sku).join(', ') || '—'})

  Done. Open the app and log in.\n`);
})().catch(e => { console.error('\n  SEED FAILED:', e.message, '\n'); process.exit(1); });
