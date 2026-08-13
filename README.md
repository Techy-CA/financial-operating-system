# FinOS — Financial Operating System

A production-ready financial management system for Indian SMEs.  
Built with **Vanilla JS + Firebase** — no framework, no bundler required for development.

---

## Tech Stack

- **Frontend:** Vanilla JS ES Modules, Inter font, Tabler Icons, Chart.js
- **Backend:** Firebase (Auth, Firestore, Storage, Functions, Hosting)
- **Architecture:** Multi-company SPA with role-based access

---

## Quick Start

### 1. Clone and install

```bash
git clone <repo>
cd financial-os
npm install
```

### 2. Create Firebase project

1. Go to [console.firebase.google.com](https://console.firebase.google.com)
2. Create a new project
3. Enable **Authentication** (Email/Password + Google)
4. Enable **Firestore** (start in production mode)
5. Enable **Storage**
6. Enable **Hosting**

### 3. Configure environment

```bash
cp .env.example .env
```

Edit `.env` with your Firebase project config from Project Settings > General > Your apps.

### 4. Run locally

```bash
npm run dev
```

Opens at `http://localhost:5000` with Firebase emulators running.

---

## Project Structure

```
financial-os/
├── public/               # PWA shell
│   ├── index.html        # Single entry point
│   └── manifest.json     # PWA manifest
├── src/
│   ├── core/             # App bootstrap, auth, router, store, roles
│   ├── styles/           # CSS design system
│   ├── components/       # Sidebar, Topbar, Toast, Modal
│   ├── modules/          # Feature modules
│   │   ├── auth/         # Login, signup, forgot password
│   │   ├── dashboard/    # Founder dashboard
│   │   ├── pos/          # Counter terminal, register/day close, receipts
│   │   ├── invoices/     # Invoice CRUD + GST calculator
│   │   ├── purchases/    # Vendor bills, ITC, stock inward, payments out
│   │   ├── credit-notes/ # Sales returns and credit notes
│   │   ├── khata/        # Party udhaar ledger + WhatsApp reminders
│   │   ├── payroll/      # Staff, attendance register, salary runs
│   │   ├── customers/    # Customer management
│   │   ├── vendors/      # Vendor management
│   │   ├── products/     # Product/service catalogue
│   │   ├── inventory/    # Stock summary, ledger, movements, locations
│   │   ├── quotations/   # Quotation management
│   │   ├── collections/  # Receivables & reminders
│   │   ├── expenses/     # Expense tracking
│   │   ├── ledger/       # Double-entry ledger
│   │   ├── gst/          # GST dashboard, GSTR-1/3B
│   │   ├── reports/      # P&L, Cash Flow, Outstanding
│   │   └── settings/     # Company, team, invoice settings
│   ├── services/         # Firestore, Storage, PDF, Email
│   └── utils/            # Formatters, validators, constants
├── functions/            # Firebase Cloud Functions
├── firestore.rules       # Security rules
├── firebase.json         # Firebase configuration
└── package.json
```

---

## Roles

| Role        | Access                                        |
|-------------|-----------------------------------------------|
| Founder     | Full access to everything                     |
| Admin       | Everything except team delete, billing        |
| Accountant  | Invoices, expenses, ledger, GST, reports      |
| Sales       | Customers, quotations, invoices (create/send) |
| Operations  | Vendors, products, inventory, expenses         |
| Auditor     | Read-only access to all modules               |

---

## Deploy to Production

```bash
# Build and deploy
npm run deploy

# Deploy only frontend
npm run deploy:hosting

# Deploy only Cloud Functions
npm run deploy:functions
```

---

## Environment Variables

```env
FIREBASE_API_KEY=
FIREBASE_AUTH_DOMAIN=
FIREBASE_PROJECT_ID=
FIREBASE_STORAGE_BUCKET=
FIREBASE_MESSAGING_SENDER_ID=
FIREBASE_APP_ID=
```

---

## Demo data

```bash
npm run seed
```

Loads a full walkthrough company — **Eka Gifts Pvt Ltd**, FY 2026-27 — into the
demo account `admin@gmail.com` / `123456789`. Roughly 390 documents:

- 12 customers, 6 vendors, 13 products, 34 expenses, 6 quotations
- 26 invoices across every status, plus **12 POS bills** and their payments
- **8 vendor bills** (paid, partial, overdue) with input tax credit
- **2 credit notes** — one goods return that restocks, one rate revision
- **4 register shifts** — three closed (one tallies, one short, one over) and
  one left **open** so the counter is ready for a live demo
- **6 staff**, three months of attendance, two months of payroll paid, three
  advances (August salary is left pending on purpose so payroll can be run live)
- **5 khata cash entries** across customers and vendors
- 101 stock movements with fully reconciled balances

Every number ties out: POS sales and vendor bills feed the same stock ledger as
invoices, and the opening balances are solved so nothing ever goes negative.

Dry-run it first without touching Firestore:

```bash
SEED_DRY_RUN=1 node scripts/seed.js
```

The script signs in with the project's public web API key and writes through the
Firestore REST API, so no service-account key is needed. Everything lands under
the single company `demo-eka-gifts`; re-running wipes and rebuilds **only that
company** and never touches other data. Override the account with
`SEED_EMAIL` / `SEED_PASSWORD`.

---

## Inventory

Stock tracking is opt-in per product (**Products → edit → Stock tracking**). Once
enabled, an item gets a quantity, a moving-average cost and a reorder level.

- **Stock summary** (`#/inventory`) — value at cost, low-stock and out-of-stock
  counts, per-location balances, CSV export.
- **Stock ledger** (`#/inventory/movements`) — every inward and outward entry with
  a running balance, filterable by item, direction, reason, location and date.
- **Stock in / out / count** — a single dialog for receipts, issues, damage,
  returns and physical-count corrections.
- **Automatic sale deduction** — invoicing a tracked product issues the stock.
  Editing the invoice books only the difference; deleting it returns everything.
  Drafts hold no stock.
- **Valuation** — moving weighted average. Inward entries at their own cost,
  outward entries at the running average.
- **Locations** — optional warehouses/godowns; balances are kept per location.
- **Reorder alerts** — surfaced on the inventory page and the dashboard.

Every quantity change is written through `inventory.service.js` in a Firestore
transaction, so the ledger and the item balance can never drift apart. Nothing
else writes `stockQty`.

Collections used: `products` (balance + valuation), `stockMovements` (the ledger),
`warehouses` (locations).

---

## Point of Sale

A full counter terminal at `#/pos`, built for speed at a till.

- **Catalogue grid** — tap or scan. The search box keeps focus so a barcode gun
  fires straight into it; Enter adds the exact barcode/SKU match.
- **Cart** — per-line quantity, rate and discount, plus a whole-bill discount in
  ₹ or %. Bill discounts are spread across lines *before* tax so the GST split
  stays correct.
- **Mixed pricing** — each line knows whether its price includes tax, so MRP
  items and pre-tax items can sit on the same bill.
- **Split payment** — cash, UPI, card and khata (credit) on one bill, with
  quick-cash chips and automatic change. A credit balance requires a named
  customer.
- **Held bills** — park a cart and pull it back later. Held carts live on the
  device so a dropped connection can't lose them.
- **Thermal receipt** — 58mm or 80mm, printed through a hidden iframe so a
  blocked popup can never swallow a sale that has already been charged.
- **Keyboard** — `F2` pay · `F4` hold · `F8` held bills · `F9` customer ·
  `Esc` clear · `/` focus search.

A POS sale **is a real invoice**. It writes to `invoices` / `invoiceItems` just
like the invoice form, so counter sales appear in GST returns, reports, customer
ledgers and the stock ledger with nothing to reconcile.

### Register &amp; day close

`#/pos/register` groups a day's takings into a shift.

- Open a shift with a cash float; every sale is tallied against it.
- Record mid-shift **cash out** (bank drop, petty cash).
- Close with a **denomination count grid** — the drawer's expected cash is
  compared against what was counted and the over/short is recorded.
- **Z-report** per shift: tender mix, tax collected, discounts and top items.

Collections used: `registers`.

---

## Purchases

Vendor bills at `#/purchases` — the mirror of an invoice.

- Books what is owed, claims **input tax credit**, and brings goods into stock
  at the price actually paid, which is what moves the moving-average cost.
- Editing a bill posts only the difference, so a revised bill never
  double-receives.
- Payments out with running balance, and payables grouped by vendor.

Collections used: `bills`, `billPayments`.

---

## Credit notes &amp; sales returns

`#/credit-notes`. Pick the invoice, pick the lines, pick a reason.

- Quantities are **clamped to what has not already been credited** — over-
  crediting is a quiet way to corrupt GST, so it is blocked rather than trusted.
- Restocking follows the reason: a return puts goods back, a rate revision does
  not.
- Reduces the invoice balance and reverses the GST that was charged.

Collections used: `creditNotes`.

---

## Party Khata

`#/khata` — the udhaar book, for customers and vendors together.

The khata is a **view, not a second set of books**: it merges invoices,
payments, bills and vendor payments with plain cash entries and runs a balance
down the list, so the udhaar figure can never disagree with the accounting
figure.

- **You'll get / you'll give** totals and a net position.
- Per-party running statement with debit, credit and closing balance.
- **Cash entries** for money that has no document behind it.
- **WhatsApp reminders** with the balance pre-filled.

Collections used: `khataEntries`.

---

## Staff, Attendance &amp; Payroll

- **Staff** (`#/staff`) — monthly, daily, hourly or piece-rate. Staff are
  deactivated rather than deleted so past payslips stay valid. Advances are
  tracked and recovered automatically at payroll.
- **Attendance** (`#/attendance`) — a month-by-day register. Click a cell to
  cycle Present → Half day → Absent → clear; right-click for leave, week off and
  holiday. Writes are optimistic, so marking never waits on the network.
  One document per staff member per month keeps a month to a single read.
- **Payroll** (`#/payroll`) — pulls the month's attendance, computes each
  person's pay, and lets bonus, advance recovery and deductions be adjusted
  before paying. Marking a payslip paid recovers the advance and **books the
  salary as an expense**, so it lands in P&amp;L and cash flow automatically.
  Payslips print or send over WhatsApp.

Monthly staff are paid pro-rata on calendar days (salary ÷ days-in-month ×
payable days), the convention most Indian small businesses use.

Collections used: `staff`, `attendance`, `staffAdvances`, `payrollRuns`.

---

## Offline-first counter

A till cannot stop selling because the line dropped. Firestore runs on an
IndexedDB-backed cache, so reads are served locally and document writes queue
and replay on their own.

Two things Firestore *cannot* do offline, which this handles explicitly:

- **`runTransaction` needs a live server.** Anything that reads-then-writes —
  stock balances, register tallies, bill numbers — would simply hang. Offline,
  bill numbers fall through to a local sequence carrying an `OFF` marker so two
  terminals can never mint the same number, and the transactional work is queued.
- **`addDoc` only settles on server acknowledgement.** Awaiting it offline
  blocks the sale forever, so writes use `DB.createLocal()`, which generates the
  document ID on the client and does not await the round trip.

Queued work replays **in order** on reconnect, stopping at the first failure so
ordering is preserved. Replay is idempotent — the stock engine posts only the
difference between what a document needs and what it has already booked — so a
task running twice cannot double-deduct.

The pill at the bottom-left shows the connection state and how much is waiting.

**To demo it:** open `#/pos`, kill the network in DevTools (or switch off Wi-Fi),
keep billing, then reconnect and watch the queue drain.

---

## Consistency proof

`#/proof` tests the central claim instead of asserting it. Every stored balance
is discarded and recomputed from the underlying ledger, then compared:

1. **Stock** — stored `stockQty` vs the sum of every stock movement
2. **Money in** — invoice `paidAmount` and `balanceDue` vs the payments recorded
3. **Money out** — bill `paidAmount` vs `billPayments`
4. **Document totals** — `grandTotal` vs the sum of that document's own lines

Anything above half a paisa of rounding tolerance is reported as drift, with the
offending records listed.

This is only possible because stored numbers in FinOS are *derived*, never
independently maintained — so recomputing them is a real test rather than a
restatement.

---

## Insights

`#/insights` computes signals from history the business already generated.
Nothing is configured, and every number traces back to the transactions behind
it — an unexplainable score in an accounting tool is worse than none.

- **Payment behaviour** — each customer scored on the mean delay between invoice
  and payment, the share of invoices that went late, and the age of the oldest
  unpaid one. Customers with fewer than two settled invoices are marked
  *limited history* rather than scored, because one late payment is not a
  pattern. Outstanding balances are weighted by that score into an exposure
  figure.
- **Stock runway** — consumption rate per item from the movement ledger, and the
  date each item runs out. Only `sale` movements count, so a one-off write-off
  cannot inflate the forecast.
- **Spend anomalies** — a category is flagged when this month's spend is more
  than 1.6 standard deviations above its *own* trailing mean, with at least
  three months of prior history. Self-relative, so a category that is always
  large is never flagged merely for being large.
- **Margins** — revenue against the cost the stock ledger actually valued each
  sale at, surfacing thin-margin items.

---

## Command palette

`Ctrl/Cmd + K` anywhere. Jumps to any page, creates any document, and searches
invoices, customers, vendors and products. Records are fetched once per session
and cached, so typing stays instant.

---

## GST Features

- Automatic CGST/SGST vs IGST based on place of supply
- HSN/SAC code support
- GSTR-1 and GSTR-3B summary export
- Input tax credit tracking
- GST payable calculation

---

Built for Indian businesses. Made with care.
