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
│   ├── modules/          # Feature modules (13 total)
│   │   ├── auth/         # Login, signup, forgot password
│   │   ├── dashboard/    # Founder dashboard
│   │   ├── invoices/     # Invoice CRUD + GST calculator
│   │   ├── customers/    # Customer management
│   │   ├── vendors/      # Vendor management
│   │   ├── products/     # Product/service catalogue
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
| Operations  | Vendors, products, expenses                   |
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

## GST Features

- Automatic CGST/SGST vs IGST based on place of supply
- HSN/SAC code support
- GSTR-1 and GSTR-3B summary export
- Input tax credit tracking
- GST payable calculation

---

Built for Indian businesses. Made with care.
