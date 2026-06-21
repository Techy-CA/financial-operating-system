import Store  from '../core/store.js';
import Router from '../core/router.js';
import Auth   from '../core/auth.js';
import Toast  from './Toast.js';

function ini(name='') { return (name||'?').split(' ').slice(0,2).map(w=>w[0]).join('').toUpperCase()||'?'; }

const Topbar = {
  render(opts = {}) {
    const el = document.getElementById('topbar');
    if (!el) return;
    const { title, breadcrumb=[], actions='' } = opts;
    const user = Store.get('user');
    const name = user?.displayName || user?.email?.split('@')[0] || 'User';

    const crumb = breadcrumb.length
      ? breadcrumb.map((c,i) => i < breadcrumb.length-1
          ? `<a href="#${c.route}" style="color:var(--text-tertiary);text-decoration:none;font-size:13px;transition:color 0.1s;" onmouseover="this.style.color='var(--text-primary)'" onmouseout="this.style.color='var(--text-tertiary)'">${c.label}</a><span style="color:var(--border-strong);font-size:12px;margin:0 5px;">›</span>`
          : `<span class="topbar-breadcrumb-current" style="font-size:15px;font-weight:700;color:var(--text-primary);">${c.label}</span>`
        ).join('')
      : `<span class="topbar-breadcrumb-current" style="font-size:15px;font-weight:700;color:var(--text-primary);">${title||'Dashboard'}</span>`;

    el.innerHTML = `
      <!-- Hamburger (mobile only) -->
      <button id="menu-toggle" onclick="Topbar.toggleMenu()" aria-label="Menu">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <line x1="3" y1="6" x2="21" y2="6"/>
          <line x1="3" y1="12" x2="21" y2="12"/>
          <line x1="3" y1="18" x2="21" y2="18"/>
        </svg>
      </button>

      <!-- Breadcrumb -->
      <div style="display:flex;align-items:center;gap:2px;flex:1;min-width:0;overflow:hidden;">${crumb}</div>

      <!-- Actions from page -->
      ${actions ? `<div style="display:flex;align-items:center;gap:6px;flex-shrink:0;">${actions}</div>` : ''}

      <div style="display:flex;align-items:center;gap:4px;flex-shrink:0;">
        <!-- Notification bell -->
        <button id="btn-notif" style="position:relative;width:34px;height:34px;border-radius:8px;border:none;background:none;cursor:pointer;display:flex;align-items:center;justify-content:center;color:var(--text-secondary);transition:all 0.12s;" onmouseover="this.style.background='var(--bg-subtle)'" onmouseout="this.style.background='none'" title="Activity">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
          <div id="notif-badge" style="display:none;position:absolute;top:4px;right:4px;min-width:16px;height:16px;background:#EF4444;border-radius:99px;font-size:9px;font-weight:700;color:white;align-items:center;justify-content:center;border:2px solid white;padding:0 3px;"></div>
        </button>
        <div style="width:1px;height:18px;background:var(--border-subtle);margin:0 2px;"></div>
        <button id="tb-avatar" style="width:30px;height:30px;border-radius:50%;background:linear-gradient(135deg,#3B82F6,#1D4ED8);color:white;font-size:11px;font-weight:700;border:none;cursor:pointer;flex-shrink:0;" title="${name}">${ini(name)}</button>
      </div>
    `;

    el.querySelector('#btn-notif')?.addEventListener('click', async () => {
      try { const { default: N } = await import('./Notifications.js'); N.openPanel(); } catch(e) {}
    });
    el.querySelector('#tb-avatar')?.addEventListener('click', () => this._menu());

    // Store reference for mobile toggle
    window.Topbar = this;
  },

  toggleMenu() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    if (!sidebar) return;
    const isOpen = sidebar.classList.toggle('open');
    if (overlay) overlay.classList.toggle('open', isOpen);
  },

  _menu() {
    document.getElementById('__tb-menu')?.remove();
    const user = Store.get('user');
    const role = Store.get('role');
    const name = user?.displayName || 'User';

    const menu = document.createElement('div');
    menu.id = '__tb-menu';
    menu.style.cssText = 'position:fixed;top:58px;right:12px;min-width:220px;background:white;border:1px solid #E2E8F0;border-radius:12px;box-shadow:0 12px 40px rgba(0,0,0,0.12);z-index:450;padding:4px;font-family:Inter,sans-serif;';
    menu.innerHTML = `
      <div style="padding:11px 13px 9px;border-bottom:1px solid #F1F5F9;margin-bottom:4px;">
        <div style="font-size:13.5px;font-weight:700;color:#0F172A;">${name}</div>
        <div style="font-size:12px;color:#64748B;margin-top:1px;">${user?.email||''}</div>
        ${role?`<div style="margin-top:5px;"><span style="background:#EEF2FF;color:#3730A3;font-size:10px;font-weight:600;padding:2px 8px;border-radius:99px;">${role.charAt(0).toUpperCase()+role.slice(1)}</span></div>`:''}
      </div>
      <a href="#/settings" class="dropdown-item" onclick="document.getElementById('__tb-menu')?.remove()">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
        My Profile
      </a>
      <a href="#/settings" class="dropdown-item" onclick="document.getElementById('__tb-menu')?.remove()">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/></svg>
        Settings
      </a>
      <div style="height:1px;background:#F1F5F9;margin:4px 0;"></div>
      <button class="dropdown-item danger" id="tb-logout">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
        Log out
      </button>
    `;
    document.body.appendChild(menu);
    menu.querySelector('#tb-logout')?.addEventListener('click', async () => {
      menu.remove();
      try { await Auth.logout(); Toast.success('Logged out'); }
      catch(e) { Toast.error('Logout failed'); }
    });
    setTimeout(() => {
      document.addEventListener('click', function close(e) {
        if (!menu.contains(e.target) && e.target.id !== 'tb-avatar') {
          menu.remove(); document.removeEventListener('click', close);
        }
      });
    }, 50);
  },
};
export default Topbar;
