import Store  from '../core/store.js';
import Router from '../core/router.js';
import { getNavItems } from '../core/roles.js';
import Auth   from '../core/auth.js';
import Toast  from './Toast.js';

// F monogram SVG (matches logo)
const F_SVG = `<svg width="18" height="18" viewBox="0 0 100 120" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M15 10 C15 10 70 10 85 10 C90 10 95 15 85 25 C75 35 30 50 30 50 C30 50 70 50 80 50 C85 50 88 55 80 63 C72 71 30 90 30 90 L30 115" stroke="white" stroke-width="18" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
</svg>`;

const ICONS = {
  dashboard:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>`,
  reports:     `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>`,
  invoices:    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>`,
  quotations:  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/></svg>`,
  collections: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
  expenses:    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="2"/></svg>`,
  vendors:     `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>`,
  gst:         `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="9" x2="20" y2="9"/><line x1="4" y1="15" x2="20" y2="15"/><line x1="10" y1="3" x2="8" y2="21"/><line x1="16" y1="3" x2="14" y2="21"/></svg>`,
  ledger:      `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>`,
  customers:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
  products:    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>`,
  team:        `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
  settings:    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`,
  logout:      `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>`,
  chevdown:    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>`,
  plus:        `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`,
  check:       `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
  edit:        `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`,
  trash:       `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>`,
};

function ini(name='') { return (name||'?').split(' ').slice(0,2).map(w=>w[0]||'').join('').toUpperCase()||'?'; }
function ic(name) { return `<div style="width:16px;height:16px;flex-shrink:0;">${ICONS[name]||''}</div>`; }

const Sidebar = {
  render() {
    const el = document.getElementById('sidebar');
    if (!el) return;

    const company  = Store.get('company');
    const role     = Store.get('role') || 'founder';
    const user     = Store.get('user');
    const fy       = Store.get('fy');
    const navSections = getNavItems(role);
    const userName  = user?.displayName || user?.email?.split('@')[0] || 'User';
    const userEmail = user?.email || '';
    const isFounderOrAdmin = ['founder','admin'].includes(role);
    const coInit   = company?.name ? ini(company.name) : 'CO';

    // Close mobile sidebar on nav
    document.getElementById('sidebar')?.querySelectorAll('.sidebar-item').forEach(item => { item.addEventListener('click', () => { const sidebar=document.getElementById('sidebar'); if(sidebar?.classList.contains('open')){sidebar.classList.remove('open');document.getElementById('sidebar-overlay')?.classList.remove('open');} }); });

    // re-render HTML
    el.innerHTML = `
      <!-- Logo -->
      <div style="padding:14px 16px 12px;border-bottom:1px solid var(--border-subtle);display:flex;align-items:center;gap:10px;flex-shrink:0;">
        <div style="width:30px;height:30px;background:linear-gradient(135deg,#3B82F6,#1D4ED8);border-radius:8px;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(29,78,216,0.3);">${F_SVG}</div>
        <div>
          <div style="font-size:15px;font-weight:700;color:var(--text-primary);letter-spacing:-0.3px;">FinOS</div>
          <div style="font-size:10.5px;color:var(--text-tertiary);margin-top:0px;">Financial OS</div>
        </div>
      </div>

      <!-- Company chip -->
      <div style="padding:8px 10px 0;">
        <button id="co-chip" style="width:100%;display:flex;align-items:center;gap:9px;padding:9px 10px;background:var(--bg-subtle);border:1px solid var(--border-subtle);border-radius:10px;cursor:pointer;text-align:left;transition:all 0.12s;" onmouseover="this.style.background='var(--bg-inset)'" onmouseout="this.style.background='var(--bg-subtle)'">
          <div style="width:30px;height:30px;border-radius:8px;background:var(--brand-primary-light);color:var(--brand-primary);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;flex-shrink:0;">${coInit}</div>
          <div style="flex:1;min-width:0;">
            <div style="font-size:12.5px;font-weight:600;color:var(--text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${company?.name||'Setup company'}</div>
            <div style="font-size:10.5px;color:var(--text-tertiary);">${fy?.label||'FY 2026-27'}</div>
          </div>
          <div style="width:14px;height:14px;color:var(--text-tertiary);flex-shrink:0;">${ICONS.chevdown}</div>
        </button>
      </div>

      <!-- Nav -->
      <nav style="flex:1;overflow-y:auto;padding:8px 0 4px;scrollbar-width:none;">
        ${navSections.map(section => `
          <div style="padding:10px 14px 3px;font-size:10px;font-weight:600;color:var(--text-disabled);text-transform:uppercase;letter-spacing:0.9px;">${section.section}</div>
          ${section.items.map(item => `
            <a class="sidebar-item" href="#${item.route}" data-route="${item.route}">
              <div style="width:16px;height:16px;flex-shrink:0;">${ICONS[item.id]||ICONS.dashboard}</div>
              <span class="sidebar-item-label">${item.label}</span>
            </a>
          `).join('')}
        `).join('')}

        <div style="padding:10px 14px 3px;font-size:10px;font-weight:600;color:var(--text-disabled);text-transform:uppercase;letter-spacing:0.9px;">Workspace</div>
        ${isFounderOrAdmin ? `
          <a class="sidebar-item" href="#/settings/team" data-route="/settings/team">
            ${ic('team')}<span class="sidebar-item-label">Team</span>
          </a>` : ''}
        <a class="sidebar-item" href="#/import" data-route="/import">
          <div style="width:16px;height:16px;"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg></div>
          <span class="sidebar-item-label">Bulk Import</span>
        </a>
        <a class="sidebar-item" href="#/settings" data-route="/settings">
          ${ic('settings')}<span class="sidebar-item-label">Settings</span>
        </a>
      </nav>

      <!-- Footer -->
      <div style="border-top:1px solid var(--border-subtle);padding:8px 8px 10px;flex-shrink:0;">
        <div style="display:flex;align-items:center;gap:9px;padding:7px 10px 10px;">
          <div style="width:30px;height:30px;border-radius:50%;background:linear-gradient(135deg,#3B82F6,#1D4ED8);color:white;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;flex-shrink:0;">${ini(userName)}</div>
          <div style="flex:1;min-width:0;">
            <div style="font-size:12.5px;font-weight:600;color:var(--text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${userName}</div>
            <div style="font-size:10.5px;color:var(--text-tertiary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${userEmail}</div>
          </div>
        </div>
        <div style="display:flex;gap:5px;padding:0 4px;">
          <a href="#/settings" style="flex:1;display:flex;align-items:center;justify-content:center;gap:6px;padding:7px;border-radius:8px;border:1px solid var(--border-subtle);background:var(--bg-subtle);font-size:12px;font-weight:500;color:var(--text-secondary);text-decoration:none;transition:all 0.12s;" onmouseover="this.style.background='var(--bg-inset)'" onmouseout="this.style.background='var(--bg-subtle)'">
            ${ic('settings')} Settings
          </a>
          <button id="btn-logout" style="flex:1;display:flex;align-items:center;justify-content:center;gap:6px;padding:7px;border-radius:8px;border:1px solid #FECACA;background:#FEF2F2;font-size:12px;font-weight:500;color:#991B1B;cursor:pointer;transition:all 0.12s;font-family:inherit;" onmouseover="this.style.background='#FEE2E2'" onmouseout="this.style.background='#FEF2F2'">
            ${ic('logout')} Log out
          </button>
        </div>
      </div>
    `;

    this._highlight();

    el.querySelector('#co-chip')?.addEventListener('click', () => this._companyModal());
    el.querySelector('#btn-logout')?.addEventListener('click', async () => {
      try { await Auth.logout(); Toast.success('Logged out'); }
      catch(e) { Toast.error('Logout failed'); }
    });
  },

  _highlight() {
    const path = Router.currentPath();
    document.querySelectorAll('.sidebar-item[data-route]').forEach(el => {
      const r = el.dataset.route;
      el.classList.toggle('active', !!(r && (path === r || (r.length > 1 && path.startsWith(r + '/')))));
    });
  },

  // ── COMPANY MODAL ──────────────────────────────────────────────────────────
  _companyModal() {
    document.getElementById('__co-modal')?.remove();
    const companies = Store.get('companies') || [];
    const currentId = Store.get('companyId');

    const modal = document.createElement('div');
    modal.id = '__co-modal';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(15,20,32,0.45);z-index:400;display:flex;align-items:center;justify-content:center;';
    modal.innerHTML = `
      <div style="background:white;border-radius:16px;width:100%;max-width:440px;box-shadow:0 20px 60px rgba(0,0,0,0.15);overflow:hidden;margin:20px;" onclick="event.stopPropagation()">

        <!-- Header -->
        <div style="padding:16px 18px 12px;border-bottom:1px solid #F1F5F9;display:flex;align-items:center;justify-content:space-between;">
          <div>
            <div style="font-size:15px;font-weight:700;color:#0F172A;">Your companies</div>
            <div style="font-size:12px;color:#64748B;margin-top:1px;">${companies.length} compan${companies.length===1?'y':'ies'} · click to switch</div>
          </div>
          <button onclick="document.getElementById('__co-modal').remove()" style="width:28px;height:28px;border-radius:8px;border:none;background:#F1F5F9;cursor:pointer;font-size:15px;color:#64748B;display:flex;align-items:center;justify-content:center;">✕</button>
        </div>

        <!-- Company list -->
        <div style="padding:8px;max-height:340px;overflow-y:auto;" id="co-list">
          ${companies.length === 0
            ? `<div style="text-align:center;padding:28px;color:#94A3B8;font-size:13.5px;">No companies yet.<br>Create your first company in Settings.</div>`
            : companies.map(co => `
              <div style="display:flex;align-items:center;gap:10px;padding:11px 10px;border-radius:10px;border:1.5px solid ${co.id===currentId?'#BFDBFE':'transparent'};background:${co.id===currentId?'#EFF6FF':'transparent'};margin-bottom:4px;transition:all 0.1s;" id="co-row-${co.id}">
                <!-- Avatar + info (clickable to switch) -->
                <button onclick="Sidebar.switchCompany('${co.id}')" style="display:flex;align-items:center;gap:10px;flex:1;text-align:left;background:none;border:none;cursor:pointer;min-width:0;">
                  <div style="width:36px;height:36px;border-radius:9px;background:${co.id===currentId?'#1D4ED8':'#E2E8F0'};color:${co.id===currentId?'white':'#475569'};display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;flex-shrink:0;">${ini(co.name||'?')}</div>
                  <div style="min-width:0;">
                    <div style="font-size:13.5px;font-weight:600;color:#0F172A;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${co.name||'Unnamed company'}</div>
                    <div style="font-size:11.5px;color:#64748B;margin-top:1px;">${co.gstin||co.role||'—'}</div>
                  </div>
                </button>
                <!-- Active badge -->
                ${co.id===currentId ? `<div style="width:18px;height:18px;color:#1D4ED8;flex-shrink:0;">${ICONS.check}</div>` : ''}
                <!-- Edit -->
                <button onclick="Sidebar.editCompany('${co.id}')" style="width:28px;height:28px;border-radius:7px;border:1px solid #E2E8F0;background:white;cursor:pointer;display:flex;align-items:center;justify-content:center;color:#64748B;flex-shrink:0;transition:all 0.1s;" title="Edit company" onmouseover="this.style.borderColor='#94A3B8'" onmouseout="this.style.borderColor='#E2E8F0'">
                  <div style="width:12px;height:12px;">${ICONS.edit}</div>
                </button>
                <!-- Delete (only non-current) -->
                ${co.id !== currentId ? `
                  <button onclick="Sidebar.deleteCompany('${co.id}','${co.name}')" style="width:28px;height:28px;border-radius:7px;border:1px solid #FECACA;background:#FEF2F2;cursor:pointer;display:flex;align-items:center;justify-content:center;color:#DC2626;flex-shrink:0;transition:all 0.1s;" title="Delete company" onmouseover="this.style.background='#FEE2E2'" onmouseout="this.style.background='#FEF2F2'">
                    <div style="width:12px;height:12px;">${ICONS.trash}</div>
                  </button>` : ''}
              </div>
            `).join('')}
        </div>

        <!-- Add new company -->
        <div style="padding:8px 8px 12px;border-top:1px solid #F1F5F9;">
          <button onclick="Sidebar.addNewCompany()" style="width:100%;display:flex;align-items:center;justify-content:center;gap:8px;padding:10px;border:1.5px dashed #CBD5E1;border-radius:10px;background:transparent;cursor:pointer;font-size:13.5px;font-weight:600;color:#1D4ED8;transition:all 0.12s;font-family:inherit;" onmouseover="this.style.background='#EFF6FF';this.style.borderColor='#93C5FD'" onmouseout="this.style.background='transparent';this.style.borderColor='#CBD5E1'">
            <div style="width:15px;height:15px;">${ICONS.plus}</div>
            Add new company
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    modal.addEventListener('click', e => { if(e.target===modal) modal.remove(); });
    window.Sidebar = this;
  },

  async switchCompany(companyId) {
    const companies = Store.get('companies') || [];
    const co = companies.find(c => c.id === companyId);
    if (!co || companyId === Store.get('companyId')) {
      document.getElementById('__co-modal')?.remove();
      return;
    }
    document.getElementById('__co-modal')?.remove();

    const uid = Store.get('user')?.uid;
    if (uid) localStorage.setItem(`finos_co_${uid}`, companyId);

    Store.set('company',   co);
    Store.set('companyId', companyId);

    const { getPermissions } = await import('../core/roles.js');
    const role = co.role || 'founder';
    Store.set('role',        role);
    Store.set('permissions', getPermissions(role));

    this.render();
    Toast.success(`Switched to ${co.name}`);

    // Restart notifications for new company
    try {
      const { default: Notifs } = await import('./Notifications.js');
      Notifs.stop();
      Notifs.start();
    } catch(e) {}

    Router.navigate('/dashboard', true);
  },

  editCompany(companyId) {
    document.getElementById('__co-modal')?.remove();
    const uid = Store.get('user')?.uid;
    if (uid) localStorage.setItem(`finos_co_${uid}`, companyId);
    Store.set('companyId', companyId);
    const companies = Store.get('companies') || [];
    const co = companies.find(c => c.id === companyId);
    if (co) Store.set('company', co);
    this.render();
    Router.navigate('/settings', true);
    Toast.info(`Editing ${co?.name||'company'} — go to Company tab`);
  },

  async deleteCompany(companyId, name) {
    document.getElementById('__co-modal')?.remove();
    if (!confirm(`Delete "${name}"?\n\nThis will permanently delete the company and ALL its data (invoices, customers, expenses). This cannot be undone.`)) {
      this._companyModal();
      return;
    }
    Toast.info('Deleting company…');
    try {
      const { doc, deleteDoc, collection, getDocs, writeBatch } =
        await import('https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js');
      const db = window.fbDB;
      // Delete main doc
      await deleteDoc(doc(db, 'companies', companyId));
      // Remove from local state
      const updated = (Store.get('companies')||[]).filter(c=>c.id!==companyId);
      Store.set('companies', updated);
      Toast.success(`${name} deleted`);
      this._companyModal(); // reopen with updated list
    } catch(e) { Toast.error('Delete failed: '+e.message); this._companyModal(); }
  },

  addNewCompany() {
    document.getElementById('__co-modal')?.remove();
    // Show inline create form
    const modal = document.createElement('div');
    modal.id = '__co-modal';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(15,20,32,0.45);z-index:400;display:flex;align-items:center;justify-content:center;';
    modal.innerHTML = `
      <div style="background:white;border-radius:16px;width:100%;max-width:420px;box-shadow:0 20px 60px rgba(0,0,0,0.15);overflow:hidden;margin:20px;" onclick="event.stopPropagation()">
        <div style="padding:16px 18px 12px;border-bottom:1px solid #F1F5F9;display:flex;align-items:center;justify-content:space-between;">
          <div style="font-size:15px;font-weight:700;color:#0F172A;">Add new company</div>
          <button onclick="document.getElementById('__co-modal').remove()" style="width:28px;height:28px;border-radius:8px;border:none;background:#F1F5F9;cursor:pointer;font-size:15px;color:#64748B;display:flex;align-items:center;justify-content:center;">✕</button>
        </div>
        <div style="padding:20px;">
          <div style="margin-bottom:14px;">
            <label style="display:block;font-size:12.5px;font-weight:600;color:#374151;margin-bottom:5px;">Company name *</label>
            <input id="new-co-name" type="text" placeholder="Acme Pvt. Ltd." style="width:100%;padding:10px 12px;border:1.5px solid #E2E8F0;border-radius:8px;font-size:13.5px;font-family:Inter,sans-serif;outline:none;box-sizing:border-box;" onfocus="this.style.borderColor='#3B82F6'" onblur="this.style.borderColor='#E2E8F0'" />
          </div>
          <div style="margin-bottom:16px;">
            <label style="display:block;font-size:12.5px;font-weight:600;color:#374151;margin-bottom:5px;">GSTIN (optional)</label>
            <input id="new-co-gstin" type="text" placeholder="22AAAAA0000A1Z5" maxlength="15" style="width:100%;padding:10px 12px;border:1.5px solid #E2E8F0;border-radius:8px;font-size:13.5px;font-family:Inter,sans-serif;outline:none;box-sizing:border-box;text-transform:uppercase;" onfocus="this.style.borderColor='#3B82F6'" onblur="this.style.borderColor='#E2E8F0'" oninput="this.value=this.value.toUpperCase()" />
          </div>
          <div style="display:flex;gap:8px;">
            <button onclick="document.getElementById('__co-modal').remove()" style="flex:1;padding:10px;border:1.5px solid #E2E8F0;border-radius:9px;background:white;font-size:13.5px;font-weight:500;cursor:pointer;font-family:inherit;color:#374151;">Cancel</button>
            <button id="btn-create-co" onclick="Sidebar.createCompany()" style="flex:1;padding:10px;border:none;border-radius:9px;background:#1D4ED8;color:white;font-size:13.5px;font-weight:600;cursor:pointer;font-family:inherit;">Create company</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    modal.addEventListener('click', e => { if(e.target===modal) modal.remove(); });
    document.getElementById('new-co-name')?.focus();
    window.Sidebar = this;
  },

  async createCompany() {
    const name  = document.getElementById('new-co-name')?.value?.trim();
    const gstin = document.getElementById('new-co-gstin')?.value?.trim().toUpperCase();
    const btn   = document.getElementById('btn-create-co');
    if (!name) { document.getElementById('new-co-name').style.borderColor='#EF4444'; return; }
    btn.disabled=true; btn.textContent='Creating…';
    try {
      const { default: CompanySvc } = await import('../services/company.service.js');
      const uid = Store.get('user')?.uid;
      const cid = await CompanySvc.create(uid, { name, gstin: gstin||null });
      const newCo = { id: cid, name, gstin: gstin||null, role: 'founder' };

      // Update store
      const updated = [...(Store.get('companies')||[]), newCo];
      Store.set('companies', updated);
      document.getElementById('__co-modal')?.remove();

      // Auto-switch to new company
      await this.switchCompany(cid);
      Toast.success(`${name} created and switched!`);
    } catch(e) { btn.disabled=false; btn.textContent='Create company'; Toast.error('Failed: '+e.message); }
  },

  update() { this.render(); },
};

export default Sidebar;
