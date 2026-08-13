# FinOS — Financial Operating System for Indian SMEs

**Complete product & technical summary** · v2.0 · August 2026
Live at **finance.ekagifts.com**

---

## 1. In one line

FinOS is a browser-based financial operating system that lets an Indian small
business run its entire money workflow — **counter sale → invoice → payment →
purchase → stock → staff salary → udhaar → GST → books** — from a single screen,
with no accountant-grade training and no per-seat licence.

**The thesis:** a typical shop runs four apps — Khatabook for udhaar, PagarBook
for staff, Tally or Zoho for accounts, and some POS at the counter. Each keeps
its *own* ledger, so the same fact is typed four times and the four never agree.

FinOS has **exactly one write path per fact.** A counter sale is not a separate
record type — it *is* an invoice. The party khata is not a second book — it is a
*view* over invoices, payments and bills. A vendor bill feeds the same stock
ledger an invoice consumes from.

The consequence is the product: **reconciliation-free by construction.** There is
no "sync" step because there is nothing to sync, and that claim is testable —
see §9.

---

## 2. The problem

A typical Indian SME with ₹50L–₹5Cr turnover runs on:

| What they use | What breaks |
|---|---|
| Excel for invoices | No GST validation, numbering clashes, no audit trail |
| A POS at the counter | Counter sales never reach the books until month-end |
| Khatabook for udhaar | The udhaar figure and the receivable figure disagree |
| PagarBook for staff | Salaries never land in the P&L |
| A register for stock | Stock never matches what was invoiced |
| The CA's Tally file | Owner sees the numbers 45 days late |

The cost is not the software — it is **not knowing the numbers until the quarter
has already closed**, and never being certain which of the four figures is right.

---

## 3. What FinOS does — the whole product

**Counter** — Point of Sale → Register & day close
**Money in** — Quotations → Invoices → Credit notes → Payments → Collections
**Money out** — Purchase bills → Expenses → Vendors
**Khata** — Party udhaar ledger with WhatsApp reminders
**People** — Staff → Attendance → Payroll
**Stock** — Inventory → Stock ledger
**Compliance** — GST → Double-entry ledger
**Insight** — Dashboard → Insights → Reports → Consistency proof
**Workspace** — Multi-company, six roles, bulk import, command palette, settings

Twenty-two feature modules, 51 routes, one login.

---

## 4. Tech stack

### Frontend
| Layer | Choice | Why |
|---|---|---|
| Language | **Vanilla JavaScript (ES Modules)** | No framework tax, no version churn |
| Build | **None** — browser loads modules directly | Zero build step; edit a file, refresh, done |
| Routing | Custom hash router (~150 lines) | Deep links, back-button, no server config |
| State | Custom pub/sub store (~50 lines) | Reactive without a state library |
| Offline | Firestore persistent cache (IndexedDB) + a replay queue | The till keeps selling when the line drops |
| Styling | Hand-written CSS design system, 9 files | Design tokens, print styles, thermal receipts |
| Icons | Inline SVG set (`utils/icons.js`) | No icon font, no network round-trip |
| Charts | Chart.js 4.4.4 (CDN) | Only external UI dependency |
| Fonts | Inter + JetBrains Mono | Tabular numerals for money, monospace for receipts |
| Code loading | Dynamic `import()` per route | Each page's code downloads on first visit |

### Backend / platform
| Layer | Choice |
|---|---|
| Auth | Firebase Authentication (email + password; Google provider wired in) |
| Database | Cloud Firestore — multi-company, document-per-record |
| Hosting | Firebase Hosting (SPA rewrites, 1-year cache on JS/CSS) + Vercel config included |
| Storage | Firebase Storage provisioned with rules — reserved for attachments/logos |
| Functions | Cloud Functions runtime configured (Node 20) — **not required today**, everything runs client-side |
| Email | EmailJS in the browser — invoices, payment receipts, collection reminders |
| Messaging | WhatsApp deep links — khata reminders and payslips |
| PDF | Generated client-side from HTML with three invoice templates |
| Receipts | 58mm / 80mm thermal, printed via a hidden iframe |
| Demo data | Dependency-free Node seeder over the Firestore REST API |

### Why no framework
- **Load speed** — no runtime framework to parse before the first pixel.
- **Zero lock-in** — any JS developer can read it; nothing to migrate in two years.
- **No build pipeline** — nothing to break; deploy is a file copy.
- **Small surface** — ~16,300 lines of application JavaScript, all readable.

---

## 5. Architecture

```
index.html                 Boot → Firebase init (offline cache) → App.init()
│
├── src/core/              The engine
│   ├── app.js             Route table (51 routes) + login/logout lifecycle
│   ├── router.js          Hash router: pattern matching, guards, page render
│   ├── store.js           Reactive state (user, company, role, permissions, FY)
│   ├── auth.js            Firebase Auth wrapper
│   ├── roles.js           Role → permission matrix + nav generation
│   └── offline.js         Degradation rules + ordered replay queue
│
├── src/components/        Sidebar · Topbar · Toast · Notifications ·
│                          CommandPalette (Ctrl+K) · ConnectionStatus
│
├── src/modules/           22 feature modules — one folder per business area
│   └── <module>/          <name>.controller.js  +  <name>.service.js
│
├── src/services/          Cross-cutting: firestore.js, company, user, email
├── src/styles/            variables · reset · layout · components · pos ·
│                          modules · utilities · responsive · print
├── src/utils/             formatters · validators · constants · icons
│
├── scripts/seed.js        One-command demo dataset (with a dry-run mode)
└── firestore.rules        Security rules
```

### How a page renders
1. URL hash changes → `Router._resolve()` matches a route pattern.
2. Route guard checks auth (`meta.auth` / `meta.guest`).
3. The controller module is **dynamically imported** — first visit only.
4. `Controller.init()` paints the layout immediately, then loads data.
5. `Router.render(html)` swaps `#page-content`; the sidebar highlights the
   deepest matching nav item.

Every page follows the same shape: **skeleton first, data second** — so the app
never shows a blank screen while Firestore responds.

### Data model
```
users/{uid}                            Profile
companyUsers/{id}                      uid ↔ company ↔ role  (cross-company lookup)
companies/{companyId}                  Profile, GSTIN, bank, invoice settings
  ├── members/{uid}                    Role inside this company
  ├── customers/          vendors/     Masters
  ├── products/                        Catalogue + stock balance + valuation
  ├── invoices/           invoiceItems/   ← counter sales live here too
  ├── payments/                        Receipts (invoice + POS)
  ├── bills/              billPayments/   Purchases and payments out
  ├── creditNotes/                     Sales returns and adjustments
  ├── khataEntries/                    Cash movements with no document behind them
  ├── registers/                       POS shifts, tender mix, drawer count
  ├── staff/              staffAdvances/
  ├── attendance/                      One doc per staff per month
  ├── payrollRuns/                     Payslips
  ├── expenses/           quotations/
  ├── stockMovements/                  Immutable stock ledger
  ├── warehouses/         activityLogs/
  └── settings/…_counter               Transactional document numbering
```
Every business record lives **under a company document**, so multi-company
isolation is structural, not a filter someone can forget to apply.

Note what is *absent*: there is no `posSales`, no `udhaar`, no `receivables`
table. Those are not omissions — they are the design.

### The write layer
`services/firestore.js` is the only path to the database. It strips `undefined`
values before every write, stamps `createdAt` / `updatedAt` / `createdBy` /
`updatedBy`, resolves the active company, and exposes `where` / `orderBy` /
`limit` builders. It also provides `createLocal()` — see §6.

---

## 6. Offline-first counter

A till cannot stop selling because the line dropped. Firestore's persistent
cache handles the easy half on its own: reads are served from IndexedDB and
document writes queue and replay automatically.

Two things it **cannot** do offline, which FinOS handles explicitly:

| Problem | Consequence if ignored | How FinOS handles it |
|---|---|---|
| `runTransaction` needs a live server | Stock updates, register tallies and bill numbering **hang forever** | Bill numbers fall through to a local sequence with an `OFF` marker so two terminals can never mint the same number; the transactional work is queued |
| `addDoc` only settles on server ack | Awaiting it offline **blocks the sale** | `DB.createLocal()` generates the document ID on the client and does not await the round trip |

Queued work replays **in order** on reconnect, stopping at the first failure so
ordering is preserved. Replay is **idempotent** — the stock engine posts only the
difference between what a document needs and what it has already booked — so a
task running twice cannot double-deduct.

A pill at the bottom-left shows connection state and queue depth.

**To demo:** open `#/pos`, kill the network, keep billing, reconnect, watch the
queue drain.

---

## 7. Security & access control

### What is solid
- **Authentication** — Firebase Auth; passwords are scrypt-hashed by Google and
  never reach the application. Sessions persist across reloads.
- **Encryption** — AES-256 at rest, TLS 1.2+ in transit, on Google Cloud
  infrastructure certified to ISO 27001 and SOC 1/2/3.
- **Role-based access control** — six roles with per-module rights across
  create / read / update / delete / send / export. The sidebar is *generated*
  from the permission matrix, so a role never sees a page it cannot use.
- **Audit trail** — every record carries who created and last updated it; stock
  movements additionally record the author's name.

| Role | Access |
|---|---|
| **Founder** | Everything, including team and company deletion |
| **Admin** | Everything except billing and team deletion |
| **Accountant** | Invoices, purchases, credit notes, payroll, ledger, GST, reports |
| **Sales** | Customers, quotations, invoices, POS, khata, collections |
| **Operations** | Vendors, products, **full inventory**, purchases, attendance |
| **Auditor** | Read-only across every module, with export rights |

### Known gaps — stated plainly

The Firestore rules are **currently permissive and are the top priority before
any real customer data is loaded.** Specifically:

1. `companies/{id}/{subcol}` allows `read: if true`, so company data is readable
   without authentication by anyone who knows the company ID — and the company
   ID is exposed in every public invoice share link.
2. Writes require only *an* authenticated user, not membership of that company.
3. The role matrix is enforced **client-side only**; the rules do not check it.

The fix is scoped: membership and role checks in the rules, and token-based
invoice sharing so the company ID never leaves the building.

The API key visible in `index.html` is **not** a secret — that is normal for
Firebase, where it is a project identifier. Security comes entirely from the
rules, which is exactly why the above matters.

---

## 8. Feature walkthrough

### 8.1 Point of Sale
A two-pane terminal built for speed at a till: catalogue grid on the left,
running bill on the right, page itself never scrolls.

- **Barcode-first** — the search box keeps focus so a scanner gun fires straight
  into it; Enter adds the exact barcode/SKU match.
- **Mixed pricing** — each line knows whether its price includes tax, so MRP
  items and pre-tax items can sit on one bill.
- **Bill discounts spread pro-rata across lines before tax**, which is what keeps
  the GST split correct when a whole-bill discount is given.
- **Split payment** — cash, UPI, card and khata (credit) on one bill, with
  quick-cash chips and automatic change. A credit balance requires a named
  customer.
- **Held bills** — park a cart and resume it; held carts live on the device.
- **Thermal receipt** — 58mm/80mm, printed through a hidden iframe so a blocked
  popup can never swallow a sale that has already been charged.
- **Keyboard** — `F2` pay · `F4` hold · `F8` held bills · `F9` customer ·
  `Esc` clear · `/` search.

A POS sale writes to `invoices` / `invoiceItems`, so it appears in GST returns,
reports, customer ledgers and the stock ledger with nothing to reconcile.

### 8.2 Register & day close
Shifts group a day's takings. Open with a cash float, record mid-shift cash out
(bank drop, petty cash), then close with a **denomination count grid** that
compares counted cash against expected and records the over/short. Each shift
produces a **Z-report**: tender mix, tax collected, discounts, top items.

### 8.3 Invoicing — the core loop
- Auto numbers from a **transactional counter** with a configurable prefix.
- Customer picker that reads the customer's state and **automatically decides
  CGST+SGST vs IGST** from place of supply.
- Product autocomplete showing live stock; per-line qty, rate, discount, GST, HSN.
- Live totals with the amount spelled out in Indian words.
- **PDF** in three templates; **public share link** needing no login; **email**
  to the customer; **record payments** full or partial.
- Status lifecycle: draft → sent → viewed → partial → paid, plus overdue and
  cancelled. Drafts hold no stock and no receivable.

### 8.4 Purchase bills
The mirror of an invoice. Books what is owed, claims **input tax credit**, and
brings goods into stock **at the price actually paid** — which is what moves the
moving-average cost. Receiving through a bill rather than a manual stock-in is
the difference between a valuation you can trust and one you cannot. Editing a
bill posts only the difference, so it never double-receives.

### 8.5 Credit notes & sales returns
Pick the invoice, pick the lines, pick a reason. Quantities are **clamped to what
has not already been credited** — over-crediting is a quiet way to corrupt GST,
so it is blocked rather than trusted. Restocking follows the reason: a goods
return puts stock back, a rate revision does not. The invoice balance and the
output tax both adjust.

### 8.6 Party khata
The udhaar book, for customers and vendors together — and a **view, not a second
set of books**. It merges invoices, payments, bills and vendor payments with
plain cash entries and runs a balance down the list, so the udhaar figure can
never disagree with the accounting figure.

"You'll get / you'll give" totals, per-party running statement, cash entries for
money with no document behind it, and **WhatsApp reminders** with the balance
pre-filled.

### 8.7 Staff, attendance & payroll
- **Staff** — monthly, daily, hourly or piece rate. Staff are deactivated rather
  than deleted so past payslips stay valid. Advances are tracked and recovered
  automatically at payroll.
- **Attendance** — a month-by-day register. Click a cell to cycle Present →
  Half day → Absent → clear; right-click for leave, week off and holiday. Writes
  are optimistic, so marking never waits on the network. One document per staff
  member per month keeps a month to a single read.
- **Payroll** — pulls the month's attendance, computes each person's pay, and
  allows bonus, advance recovery and deductions to be adjusted before paying.
  Marking a payslip paid recovers the advance and **books the salary as an
  expense**, so it lands in P&L and cash flow automatically. Payslips print or
  send over WhatsApp.

Monthly staff are paid pro-rata on calendar days — salary ÷ days-in-month ×
payable days — the convention most Indian small businesses use.

### 8.8 Insights
Signals computed from history the business already generated. Nothing is
configured, and every number traces back to the transactions behind it — an
unexplainable score in an accounting tool is worse than none.

- **Payment behaviour** — each customer scored on mean delay between invoice and
  payment, share of invoices that went late, and age of the oldest unpaid one.
  Customers with fewer than two settled invoices are marked *limited history*
  rather than scored, because one late payment is not a pattern. Outstanding
  balances are weighted by that score into an exposure figure.
- **Stock runway** — consumption rate per item from the movement ledger and the
  date each item runs out. Only `sale` movements count, so a one-off write-off
  cannot inflate the forecast.
- **Spend anomalies** — a category is flagged when this month's spend exceeds
  1.6 standard deviations above its *own* trailing mean, with at least three
  months of prior history. Self-relative, so a category that is always large is
  never flagged merely for being large.
- **Margins** — revenue against the cost the stock ledger actually valued each
  sale at, surfacing thin-margin items.

### 8.9 Expenses, GST, ledger, reports
Fifteen Indian-SME expense categories with **automatic GST/ITC extraction**;
output GST split into CGST/SGST/IGST with ITC from expenses and purchase bills;
a unified double-entry journal built from invoices, payments and expenses with
drill-through to source documents; and five report tabs — P&L, Cash Flow,
Outstanding, By Customer, GST — each with CSV export.

### 8.10 Workspace
Multi-company switching, team invites with role assignment, CSV bulk import for
customers/products/invoices, a real-time activity feed, and a **Ctrl+K command
palette** that jumps to any page, creates any document, and searches invoices,
customers, vendors and products.

---

## 9. Consistency proof — the claim, tested

`#/proof` exists because "our books always tie out" is a claim, and a claim in
front of an auditor is worth nothing without a test.

The page **discards every stored balance and recomputes it from the underlying
ledger**, then compares:

| # | Check | Recomputed from |
|---|---|---|
| 1 | Stock balances | Sum of every `stockMovement` per product |
| 2 | Money in | `payments` booked against each invoice, plus credit notes |
| 3 | Money out | `billPayments` booked against each bill |
| 4 | Document totals | The sum of each document's own line items |

Anything above a half-paisa rounding tolerance is reported as drift, with the
offending records listed. On the demo dataset:

```
1. Stock       : 11 items,   101 movements → 0 drift
2. Money in    : 38 invoices, 29 receipts  → 0 drift
3. Money out   :  8 bills,     6 payments  → 0 drift
4. Doc totals  : 38 documents, 71 lines    → 0 drift
```

**This is only possible because stored numbers in FinOS are derived, never
independently maintained.** In a system with four ledgers, recomputing one from
another is meaningless — they were never the same number to begin with. Here it
is a real test.

---

## 10. Inventory — deep dive

Inventory is opt-in per product, so a services business is never forced into
stock management and a goods business gets a full system.

**Stock summary** (`#/inventory`) — value at cost, low-stock and out-of-stock
counts, reorder banner, filter chips, per-location balances, CSV export.

**Stock ledger** (`#/inventory/movements`) — every movement with a running
balance, filterable by item, direction, reason, location and date.

**Stock in / out / count** — one dialog with a live "12 → 7 Nos" preview.
Structured reasons: purchase, sales return, production, transfer in / damage,
shrinkage, internal use, purchase return, transfer out, and stock count.

**Four things move stock, all through one engine** — an invoice, a POS sale, a
vendor bill, and a credit note. Each posts through the same transaction with its
own `refType`, so the ledger names the document behind every movement.

**Delta-based edits** — FinOS compares what a document *now* needs against what
has *already* been booked against it and posts **only the difference**. An
invoice edited from 10 units to 3 returns exactly 7; deleting it returns
everything. This is also what makes offline replay safe.

**Valuation** — moving weighted-average cost. Inward movements recompute the
average; outward movements are valued at the running average.

**Safety** — a manual issue that would push stock negative is refused, naming the
item and what is actually available. A *sale* is allowed to go negative — the
ledger must mirror what was genuinely invoiced — but it warns loudly.

**Integrity guarantee** — every quantity change is written inside a **Firestore
transaction** that appends the immutable movement and updates the item balance
together. Nothing else in the codebase may write `stockQty`.

---

## 11. Built for India

| Requirement | How FinOS handles it |
|---|---|
| CGST + SGST vs IGST | Decided automatically from customer state vs place of supply |
| HSN / SAC codes | On every product, invoice line and bill line |
| GST rates | Full slab list — 0, 0.1, 0.25, 1, 1.5, 3, 5, 6, 7.5, 9, 12, 14, 18, 28% |
| Input tax credit | Extracted from every expense **and every purchase bill** |
| GSTR-1 / GSTR-3B | Summary views ready for filing |
| Financial year | April–March, computed everywhere, with quarter breakdowns |
| Currency | ₹ with lakh/crore commas and ₹1.2L / ₹3.4Cr short forms |
| Amount in words | "One Lakh Twenty Three Thousand Rupees Only" on every invoice |
| State codes | All 36 states and union territories with GST codes |
| TDS | Sections 194C, 194J, 194H, 194I, 194A with rates |
| Payments | NEFT/RTGS, UPI, cheque, cash, card |
| Udhaar | First-class party khata, not a workaround |
| Daily-wage staff | Attendance register and pro-rata payroll built in |
| Thermal billing | 58mm / 80mm receipts for counter sales |

---

## 12. How to use it

### Setup
1. **Sign up**, then **Settings → Company** — name, GSTIN, PAN, address, state.
   The state drives every GST calculation, so it matters.
2. **Settings → Invoice** — prefix, credit days, default terms, categories.
3. **Settings → Bank** — account, UPI ID, payment link; these print on invoices.
4. **Settings → Team** — invite colleagues with roles.
5. **Customers** and **Products** — add, or **Bulk Import** a CSV. Switch on
   *Stock tracking* for goods and set opening stock, cost and reorder level.

### Every day
6. **Register → Open shift** with the cash float.
7. **POS** — scan, take payment, print. Or **New invoice** for credit sales.
8. **Purchase bills** when goods arrive — stock and ITC update together.
9. **Expenses** as bills come in.
10. **Attendance** — mark the day.
11. **Register → Close shift** — count the drawer.

### Every week
12. **Collections** and **Khata** — chase what is outstanding, WhatsApp reminders.
13. **Insights** — clear the reorder and payment-risk alerts.

### Every month / quarter
14. **Payroll** — run salaries; they post to expenses automatically.
15. **Inventory → Stock count** — correct against a physical count.
16. **GST** — output tax, ITC, net payable; export for the CA.
17. **Reports** and **Ledger** — P&L, cash flow, and a scan for anything odd.
18. **Consistency proof** — confirm the books tie out before filing.

---

## 13. Running & deploying

```bash
npm install                        # firebase-tools only
npm run dev                        # Firebase emulators at localhost:5000
npm run seed                       # load the full demo dataset
SEED_DRY_RUN=1 node scripts/seed.js  # build it in memory, write nothing

npm run deploy                     # everything
npm run deploy:hosting             # frontend only
npm run deploy:rules               # security rules only
```

- **No build step** — `npm run build` is a no-op by design.
- **Demo dataset** — the seeder signs in (or creates) the demo account and writes
  through the Firestore REST API. It rebuilds **only** the demo company.

### The demo workspace
**admin@gmail.com / 123456789** → *Eka Gifts Pvt Ltd*, FY 2026-27 · ~392 documents

| Data | Count |
|---|---|
| Customers / Vendors / Products | 12 / 6 / 13 |
| Invoices | 37 live — 25 regular + **12 POS bills** |
| Purchase bills | 8 — paid, partial, overdue, received |
| Credit notes | 2 — one restocked return, one rate revision |
| Register shifts | 4 — 3 closed (one tallies, one short, one over), **1 open** |
| Staff / Attendance / Payroll | 6 people · 3 months · 2 months paid |
| Advances | 3 — one recovered, one partial, one outstanding |
| Khata cash entries | 5 across customers and vendors |
| Expenses / Quotations | 34 / 6 |
| Stock movements | 101 across 2 warehouses |

Headline figures: billed **₹22.33L**, collected **₹13.65L**, outstanding
**₹8.55L**, overdue **₹2.70L**, expenses **₹10.64L**, purchases **₹4.29L**
(₹1.48L payable), output GST **₹2.86L** against **₹1.32L** ITC, stock on hand
**₹2.69L** with 2 low-stock and 1 out-of-stock item.

August payroll is **deliberately left pending** so it can be run live on stage.

---

## 14. Quality & verification

- **Consistency proof** (§9) — four independent recomputations, currently zero
  drift across 392 documents.
- **Seeder dry-run** — `SEED_DRY_RUN=1` builds every document in memory and
  reports per-collection counts and any point at which stock would have gone
  negative during replay. Currently: **0 negative balances across 101 movements.**
- **Opening-balance solver** — the seeder replays the whole year twice: the first
  pass reveals where stock would have gone negative, the opening balance absorbs
  it, and the second pass is the one written. The demo data is therefore
  internally consistent by construction, not by hand-tuning.
- Defensive by default: every data call has a fallback, every page has a loading
  skeleton and an empty state, and the app never blocks on a failed request.

---

## 15. Numbers at a glance

| | |
|---|---|
| Application JavaScript | 81 files · ~16,300 lines |
| CSS design system | 9 files · ~2,500 lines |
| Feature modules | 22 |
| Routes | 51 |
| Roles | 6, with per-module permissions |
| Firestore collections | 25 (3 top-level + 22 company-scoped) |
| External runtime dependencies | 1 (Chart.js) |
| Build tooling | none |

---

## 16. Why this approach wins

1. **One write path per fact.** A counter sale is an invoice; khata is a view;
   a bill feeds the same stock ledger. Reconciliation is not automated — it is
   *eliminated*.
2. **The claim is testable.** `#/proof` recomputes every balance from the ledger
   and shows the drift. Most accounting software cannot offer this, because its
   numbers are independently maintained.
3. **Four apps collapse into one.** POS + Khatabook + PagarBook + Zoho, without
   the seams where those four disagree.
4. **India-first, not India-localised.** GST logic, udhaar and daily-wage payroll
   are in the core, not a plugin.
5. **The till never stops.** Offline billing with ordered, idempotent replay.
6. **Inventory that cannot lie.** Transaction-backed ledger, moving-average
   valuation, delta-based edits from four different document types.
7. **No lock-in.** Vanilla JavaScript, no framework, no build pipeline.

---

## 17. Roadmap

**Security (next, and blocking real customers)** — membership and role checks in
Firestore rules · token-based invoice sharing so company IDs stop leaking ·
server-side enforcement of the role matrix.

**Compliance** — e-Invoicing with IRN generation · e-Way bills · direct GSTR-1
JSON export · Tally export for the CA.

**Scale** — server-side aggregation for khata and insights, which currently scan
client-side; fine at SME volumes, needs moving beyond ~10k documents.

**Product** — recurring invoices · purchase orders and GRN · delivery challans ·
batch and expiry tracking · barcode label printing · bank statement
reconciliation · payment gateway auto-reconciliation.

---

## 18. Suggested slide deck

| # | Slide | Content |
|---|---|---|
| 1 | Title | FinOS — Financial Operating System for Indian SMEs |
| 2 | The problem | The four-app mess and why the four never agree (§2) |
| 3 | The insight | One write path per fact — reconciliation-free by construction (§1) |
| 4 | Product map | Nine areas, 22 modules (§3) |
| 5 | Architecture | Folder map + how a page renders (§5) |
| 6 | Data model | What is present — and what is deliberately absent (§5) |
| 7 | **Proof** | Live `#/proof` — four recomputations, zero drift (§9) |
| 8 | **Offline** | Why `runTransaction` and `addDoc` break, and the replay queue (§6) |
| 9 | POS | Barcode, split tender, thermal receipt, day close |
| 10 | Stock engine | Four document types, one transaction, delta edits (§10) |
| 11 | Khata & payroll | Udhaar as a view; salary that posts itself to P&L |
| 12 | Insights | Payment risk, stock runway, self-relative anomalies (§8.8) |
| 13 | Built for India | The compliance table (§11) |
| 14 | Security | What is solid, and the gap we are fixing next — stated plainly (§7) |
| 15 | By the numbers | Codebase + demo stats (§15) |
| 16 | Why it wins | Seven differentiators (§16) |
| 17 | Roadmap | Security first, then compliance and scale (§17) |
| 18 | Close | Live at finance.ekagifts.com |

---

## 19. Live demo script (7 minutes)

1. **Consistency proof first** (`#/proof`) — "Before I show you a single feature,
   here is the claim being tested." Four checks, zero drift across 392 documents.
   *This reframes everything that follows.*

2. **POS offline** (`#/pos`) — ring a sale normally. Then **kill the network**,
   keep billing, show the red pill and the `POS-OFF001` bill number. Reconnect;
   watch the queue drain. "The till never stops, and nothing double-deducts —
   replay only posts the difference."

3. **Register** (`#/pos/register`) — the open shift, then *Close shift* and the
   denomination count grid. Show a past Z-report with a ₹120 short.

4. **The one-ledger moment** — open **Inventory** and point at a POS sale sitting
   in the stock ledger next to invoice and vendor-bill movements. "Same engine,
   four document types, one ledger."

5. **Khata** (`#/khata`) — you'll get / you'll give. Open a party: invoices,
   payments and cash entries in one running balance. Fire a WhatsApp reminder.
   "This is a view. There is no udhaar table to fall out of sync."

6. **Payroll** (`#/payroll`) — August is pending. Press **Pay all pending**, then
   open **Expenses** and show the salaries that just posted themselves.

7. **Insights** (`#/insights`) — payment-risk scores with the reasoning shown,
   stock runway in days, a flagged spend anomaly.

8. **Close** — return to `#/proof`, re-run it. Still zero drift, *after* a live
   sale, an offline sale and a payroll run. "Every one of those actions touched
   four places at once, and the books still tie out."
