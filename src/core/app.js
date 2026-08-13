import Auth    from './auth.js';
import Store   from './store.js';
import Router  from './router.js';
import Sidebar from '../components/Sidebar.js';
import Topbar  from '../components/Topbar.js';
import { getPermissions } from './roles.js';
import Icon from '../utils/icons.js';

const App = {
  _started: false,

  async init() {
    this._registerRoutes();

    // ── PUBLIC ROUTES — bypass auth entirely ─────────────
    // Check if current URL is a public route before auth fires
    const hash = window.location.hash.slice(1) || '';
    if (hash.startsWith('/invoice/')) {
      // Public invoice view — no login needed
      const parts = hash.replace('/invoice/', '').split('/');
      if (parts.length === 2) {
        document.getElementById('boot-screen').style.display = 'none';
        document.getElementById('app').style.display = 'flex';
        const { default: P } = await import('../modules/invoices/invoice-public.controller.js');
        P.init(parts[0] + '/' + parts[1]);
        return; // Don't start auth listener for public pages
      }
    }
    // ─────────────────────────────────────────────────────

    Auth.onStateChange(async (user) => {
      if (user) await this._onLogin(user);
      else       this._onLogout();
    });
  },

  async _onLogin(user) {
    Store.set('user', user);
    Store.set('fy', this._fy());
    this._showAppShell();
    this._go('/dashboard');

    // Load company data in background, then re-render current page
    try {
      const [{ default: UserSvc }, { default: CompanySvc }] = await Promise.all([
        import('../services/user.service.js'),
        import('../services/company.service.js'),
      ]);

      UserSvc.getOrCreate(user).catch(() => {});

      const companies = await CompanySvc.getUserCompanies(user.uid);
      Store.set('companies', companies);

      if (companies.length === 0) {
        Store.set('role', 'founder');
        Store.set('permissions', getPermissions('founder'));
        Sidebar.render();
        return;
      }

      const saved   = localStorage.getItem(`finos_co_${user.uid}`);
      const company = companies.find(c => c.id === saved) || companies[0];
      Store.set('company',   company);
      Store.set('companyId', company.id);

      const cu   = await CompanySvc.getCompanyUser(company.id, user.uid).catch(() => null);
      const role = cu?.role || company.role || 'founder';
      Store.set('role',        role);
      Store.set('permissions', getPermissions(role));

      Sidebar.render();
      Topbar.render({ title: 'Dashboard' });

      // Re-navigate to refresh the current page with company data
      const currentPath = Router.currentPath();
      Router.navigate(currentPath || '/dashboard', true);

      // Start notifications
      import('../components/Notifications.js').then(m => m.default.start()).catch(() => {});

      // Ctrl/Cmd+K search — binds once, survives navigation
      import('../components/CommandPalette.js').then(m => m.default.install()).catch(() => {});

      // Offline queue + the pill that shows it draining
      import('../components/ConnectionStatus.js').then(m => m.default.mount()).catch(() => {});

    } catch (e) {
      console.warn('[App]', e.message);
      Store.set('role', 'founder');
      Store.set('permissions', getPermissions('founder'));
      Sidebar.render();
    }
  },

  _onLogout() {
    import('../components/Notifications.js').then(m => m.default.stop()).catch(() => {});
    document.getElementById('app-shell')?.classList.add('d-none');
    document.getElementById('auth-container')?.classList.remove('d-none');
    Store.reset();
    this._go('/login');
  },

  _showAppShell() {
    document.getElementById('auth-container')?.classList.add('d-none');
    document.getElementById('app-shell')?.classList.remove('d-none');
    Sidebar.render();
    Topbar.render({ title: 'Dashboard' });
  },

  _go(path) {
    if (!this._started) {
      this._started = true;
      history.replaceState(null, '', '#' + path);
      Router.start();
    } else {
      Router.navigate(path, true);
    }
  },

  _registerRoutes() {
    Router.beforeEach(async (path, meta) => {
      const loggedIn = !!Auth.currentUser();
      if (meta.auth  && !loggedIn) { Router.navigate('/login',     true); return false; }
      if (meta.guest &&  loggedIn) { Router.navigate('/dashboard', true); return false; }
      return true;
    });

    Router
      // Auth
      .on('/login',           async () => { const { default: P } = await import('../modules/auth/login.controller.js');           P.init(); }, { guest: true })
      .on('/signup',          async () => { const { default: P } = await import('../modules/auth/signup.controller.js');          P.init(); }, { guest: true })
      .on('/forgot-password', async () => { const { default: P } = await import('../modules/auth/forgot-password.controller.js'); P.init(); }, { guest: true })
      .on('/join',            async () => { const { default: P } = await import('../modules/auth/join.controller.js');            P.init(); }, {})

      // Dashboard
      .on('/dashboard', async () => {
        Topbar.render({ title: 'Dashboard' });
        const { default: P } = await import('../modules/dashboard/dashboard.controller.js');
        P.init();
      }, { auth: true })

      // Invoices
      .on('/invoices/new', async () => {
        Topbar.render({ breadcrumb: [{ label: 'Invoices', route: '/invoices' }, { label: 'New invoice' }] });
        const { default: P } = await import('../modules/invoices/invoice-form.controller.js');
        P.init(null);
      }, { auth: true })
      .on('/invoices/:id/edit', async ({ params }) => {
        Topbar.render({ breadcrumb: [{ label: 'Invoices', route: '/invoices' }, { label: 'Edit invoice' }] });
        const { default: P } = await import('../modules/invoices/invoice-form.controller.js');
        P.init(params.id);
      }, { auth: true })
      .on('/invoices/:id', async ({ params }) => {
        Topbar.render({ breadcrumb: [{ label: 'Invoices', route: '/invoices' }, { label: 'Invoice' }] });
        const { default: P } = await import('../modules/invoices/invoice-detail.controller.js');
        P.init(params.id);
      }, { auth: true })
      .on('/invoices', async () => {
        Topbar.render({ breadcrumb: [{ label: 'Invoices', route: '/invoices' }], actions: `<a href="#/invoices/new" class="btn btn-primary btn-sm">+ New invoice</a>` });
        const { default: P } = await import('../modules/invoices/invoices.controller.js');
        P.init();
      }, { auth: true })

      // Customers
      .on('/customers/new',      async () => { const { default: P } = await import('../modules/customers/customer-form.controller.js');   P.init(null); }, { auth: true })
      .on('/customers/:id/edit', async ({ params }) => { const { default: P } = await import('../modules/customers/customer-form.controller.js');   P.init(params.id); }, { auth: true })
      .on('/customers/:id',      async ({ params }) => { const { default: P } = await import('../modules/customers/customer-detail.controller.js'); P.init(params.id); }, { auth: true })
      .on('/customers', async () => {
        Topbar.render({ breadcrumb: [{ label: 'Customers', route: '/customers' }], actions: `<a href="#/customers/new" class="btn btn-primary btn-sm">+ Add customer</a>` });
        const { default: P } = await import('../modules/customers/customers.controller.js');
        P.init();
      }, { auth: true })

      // Vendors
      .on('/vendors/new', async () => { const { default: P } = await import('../modules/vendors/vendor-form.controller.js');   P.init(null); }, { auth: true })
      .on('/vendors/:id', async ({ params }) => { const { default: P } = await import('../modules/vendors/vendor-detail.controller.js'); P.init(params.id); }, { auth: true })
      .on('/vendors', async () => {
        Topbar.render({ breadcrumb: [{ label: 'Vendors', route: '/vendors' }], actions: `<a href="#/vendors/new" class="btn btn-primary btn-sm">+ Add vendor</a>` });
        const { default: P } = await import('../modules/vendors/vendors.controller.js');
        P.init();
      }, { auth: true })

      // Products
      .on('/products/new', async () => { const { default: P } = await import('../modules/products/product-form.controller.js'); P.init(null); }, { auth: true })
      .on('/products/:id', async ({ params }) => { const { default: P } = await import('../modules/products/product-form.controller.js'); P.init(params.id); }, { auth: true })
      .on('/products', async () => {
        Topbar.render({ breadcrumb: [{ label: 'Products', route: '/products' }], actions: `<a href="#/products/new" class="btn btn-primary btn-sm">+ Add product</a>` });
        const { default: P } = await import('../modules/products/products.controller.js');
        P.init();
      }, { auth: true })

      // Inventory  (specific routes must be registered before /inventory/:id)
      .on('/inventory/movements', async () => {
        Topbar.render({ breadcrumb: [{ label: 'Inventory', route: '/inventory' }, { label: 'Stock ledger' }] });
        const { default: P } = await import('../modules/inventory/movements.controller.js');
        P.init();
      }, { auth: true })
      .on('/inventory/:id', async ({ params }) => {
        const { default: P } = await import('../modules/inventory/item-detail.controller.js');
        P.init(params.id);
      }, { auth: true })
      .on('/inventory', async () => {
        Topbar.render({ breadcrumb: [{ label: 'Inventory', route: '/inventory' }] });
        const { default: P } = await import('../modules/inventory/inventory.controller.js');
        P.init();
      }, { auth: true })

      // Insights + consistency proof
      .on('/insights', async () => {
        Topbar.render({ breadcrumb: [{ label: 'Insights', route: '/insights' }] });
        const { default: P } = await import('../modules/insights/insights.controller.js');
        P.init();
      }, { auth: true })
      .on('/proof', async () => {
        Topbar.render({ breadcrumb: [{ label: 'Consistency proof', route: '/proof' }] });
        const { default: P } = await import('../modules/audit/proof.controller.js');
        P.init();
      }, { auth: true })

      // Point of sale  (register must be registered before /pos)
      .on('/pos/register', async () => {
        Topbar.render({ breadcrumb: [{ label: 'Point of Sale', route: '/pos' }, { label: 'Register' }] });
        const { default: P } = await import('../modules/pos/register.controller.js');
        P.init();
      }, { auth: true })
      .on('/pos', async () => {
        Topbar.render({ breadcrumb: [{ label: 'Point of Sale', route: '/pos' }] });
        const { default: P } = await import('../modules/pos/pos.controller.js');
        P.init();
      }, { auth: true })

      // Purchase bills
      .on('/purchases/new', async () => {
        Topbar.render({ breadcrumb: [{ label: 'Purchase Bills', route: '/purchases' }, { label: 'New bill' }] });
        const { default: P } = await import('../modules/purchases/purchase-form.controller.js');
        P.init(null);
      }, { auth: true })
      .on('/purchases/:id/edit', async ({ params }) => {
        Topbar.render({ breadcrumb: [{ label: 'Purchase Bills', route: '/purchases' }, { label: 'Edit bill' }] });
        const { default: P } = await import('../modules/purchases/purchase-form.controller.js');
        P.init(params.id);
      }, { auth: true })
      .on('/purchases', async () => {
        Topbar.render({ breadcrumb: [{ label: 'Purchase Bills', route: '/purchases' }], actions: `<a href="#/purchases/new" class="btn btn-primary btn-sm">+ New bill</a>` });
        const { default: P } = await import('../modules/purchases/purchases.controller.js');
        P.init();
      }, { auth: true })

      // Credit notes / sales returns
      .on('/credit-notes/new', async () => {
        Topbar.render({ breadcrumb: [{ label: 'Credit Notes', route: '/credit-notes' }, { label: 'New credit note' }] });
        const { default: P } = await import('../modules/credit-notes/credit-note-form.controller.js');
        P.init(null);
      }, { auth: true })
      .on('/credit-notes', async () => {
        Topbar.render({ breadcrumb: [{ label: 'Credit Notes', route: '/credit-notes' }], actions: `<a href="#/credit-notes/new" class="btn btn-primary btn-sm">+ New credit note</a>` });
        const { default: P } = await import('../modules/credit-notes/credit-notes.controller.js');
        P.init();
      }, { auth: true })

      // Party khata
      .on('/khata/:type/:id', async ({ params }) => {
        Topbar.render({ breadcrumb: [{ label: 'Party Khata', route: '/khata' }, { label: 'Statement' }] });
        const { default: P } = await import('../modules/khata/khata-detail.controller.js');
        P.init(params.type, params.id);
      }, { auth: true })
      .on('/khata', async () => {
        Topbar.render({ breadcrumb: [{ label: 'Party Khata', route: '/khata' }] });
        const { default: P } = await import('../modules/khata/khata.controller.js');
        P.init();
      }, { auth: true })

      // Staff, attendance, payroll
      .on('/staff', async () => {
        Topbar.render({ breadcrumb: [{ label: 'Staff', route: '/staff' }] });
        const { default: P } = await import('../modules/payroll/staff.controller.js');
        P.init();
      }, { auth: true })
      .on('/attendance', async () => {
        Topbar.render({ breadcrumb: [{ label: 'Attendance', route: '/attendance' }] });
        const { default: P } = await import('../modules/payroll/attendance.controller.js');
        P.init();
      }, { auth: true })
      .on('/payroll', async () => {
        Topbar.render({ breadcrumb: [{ label: 'Payroll', route: '/payroll' }] });
        const { default: P } = await import('../modules/payroll/payroll.controller.js');
        P.init();
      }, { auth: true })

      // Quotations
      .on('/quotations/new', async () => { const { default: P } = await import('../modules/quotations/quotation-form.controller.js'); P.init(null); }, { auth: true })
      .on('/quotations/:id', async ({ params }) => { const { default: P } = await import('../modules/quotations/quotation-form.controller.js'); P.init(params.id); }, { auth: true })
      .on('/quotations', async () => {
        Topbar.render({ breadcrumb: [{ label: 'Quotations', route: '/quotations' }], actions: `<a href="#/quotations/new" class="btn btn-primary btn-sm">+ New quotation</a>` });
        const { default: P } = await import('../modules/quotations/quotations.controller.js');
        P.init();
      }, { auth: true })

      // Other pages
      .on('/collections', async () => {
        Topbar.render({ breadcrumb: [{ label: 'Collections', route: '/collections' }] });
        const { default: P } = await import('../modules/collections/collections.controller.js');
        P.init();
      }, { auth: true })

      .on('/expenses/new',      async () => { const { default: P } = await import('../modules/expenses/expense-form.controller.js'); P.init(null); }, { auth: true })
      .on('/expenses/:id/edit', async ({ params }) => { const { default: P } = await import('../modules/expenses/expense-form.controller.js'); P.init(params.id); }, { auth: true })
      .on('/expenses', async () => {
        Topbar.render({ breadcrumb: [{ label: 'Expenses', route: '/expenses' }], actions: `<a href="#/expenses/new" class="btn btn-primary btn-sm">+ Add expense</a>` });
        const { default: P } = await import('../modules/expenses/expenses.controller.js');
        P.init();
      }, { auth: true })

      .on('/ledger', async () => {
        Topbar.render({ breadcrumb: [{ label: 'Ledger', route: '/ledger' }] });
        const { default: P } = await import('../modules/ledger/ledger.controller.js');
        P.init();
      }, { auth: true })

      .on('/gst', async () => {
        Topbar.render({ breadcrumb: [{ label: 'GST', route: '/gst' }] });
        const { default: P } = await import('../modules/gst/gst.controller.js');
        P.init();
      }, { auth: true })

      .on('/reports', async () => {
        Topbar.render({ breadcrumb: [{ label: 'Reports', route: '/reports' }] });
        const { default: P } = await import('../modules/reports/reports.controller.js');
        P.init();
      }, { auth: true })

      .on('/import', async () => {
        Topbar.render({ breadcrumb: [{ label: 'Bulk Import', route: '/import' }] });
        const { default: P } = await import('../modules/import/bulk-import.controller.js');
        P.init();
      }, { auth: true })

      .on('/settings/team', async () => {
        Topbar.render({ breadcrumb: [{ label: 'Settings', route: '/settings' }, { label: 'Team' }] });
        const { default: P } = await import('../modules/settings/settings.controller.js');
        P.init('team');
      }, { auth: true })

      .on('/settings', async () => {
        Topbar.render({ breadcrumb: [{ label: 'Settings', route: '/settings' }] });
        const { default: P } = await import('../modules/settings/settings.controller.js');
        P.init();
      }, { auth: true })

      .on('/invoice/:companyId/:id', async ({ params }) => {
        // Public invoice — no login required
        document.getElementById('app-shell')?.classList.add('d-none');
        document.getElementById('auth-container')?.classList.remove('d-none');
        const { default: P } = await import('../modules/invoices/invoice-public.controller.js');
        P.init(params.companyId + '/' + params.id);
      }, {})

      .on('/404', async () => {
        Router.render(`<div class="empty-state" style="padding-top:80px;"><div class="empty-state-icon">${Icon.mapPin(26)}</div><h3>Page not found</h3><a href="#/dashboard" class="btn btn-primary">Go to dashboard</a></div>`);
      }, {});
  },

  _fy() {
    const now = new Date(), m = now.getMonth(), y = now.getFullYear(), sy = m >= 3 ? y : y - 1;
    return { startYear: sy, endYear: sy + 1, start: `${sy}-04-01`, end: `${sy + 1}-03-31`, label: `FY ${sy}-${String(sy + 1).slice(2)}` };
  },
};

export default App;