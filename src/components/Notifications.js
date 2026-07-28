/**
 * Notifications.js — Real-time activity feed
 * Listens to activityLogs collection and shows bell badge + panel
 */

import Store from '../core/store.js';
import Icon  from '../utils/icons.js';

const Notifications = {
  _unread: 0,
  _activities: [],
  _unsubscribe: null,

  async start() {
    const companyId = Store.get('companyId');
    if (!companyId) return;

    try {
      const { collection, query, orderBy, limit, onSnapshot } =
        await import('https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js');
      const db = window.fbDB;

      const q = query(
        collection(db, 'companies', companyId, 'activityLogs'),
        orderBy('createdAt', 'desc'),
        limit(30)
      );

      if (this._unsubscribe) this._unsubscribe();

      this._unsubscribe = onSnapshot(q, snap => {
        this._activities = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        const lastSeen = parseInt(localStorage.getItem(`notif_seen_${companyId}`) || '0');
        this._unread = this._activities.filter(a => {
          const ts = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
          return ts > lastSeen;
        }).length;
        this._updateBadge();
      });
    } catch(e) { console.warn('[Notifications]', e.message); }
  },

  stop() {
    if (this._unsubscribe) { this._unsubscribe(); this._unsubscribe = null; }
  },

  _updateBadge() {
    const badge = document.getElementById('notif-badge');
    if (badge) {
      badge.textContent = this._unread > 9 ? '9+' : this._unread;
      badge.style.display = this._unread > 0 ? 'flex' : 'none';
    }
  },

  openPanel() {
    document.getElementById('__notif-panel')?.remove();

    // Mark as seen
    const companyId = Store.get('companyId');
    if (companyId) {
      localStorage.setItem(`notif_seen_${companyId}`, Date.now().toString());
      this._unread = 0;
      this._updateBadge();
    }

    const panel = document.createElement('div');
    panel.id = '__notif-panel';
    panel.style.cssText = `
      position:fixed; top:54px; right:12px; width:360px;
      background:white; border:1px solid #E2E8F0; border-radius:14px;
      box-shadow:0 12px 40px rgba(0,0,0,0.12); z-index:450;
      max-height:480px; display:flex; flex-direction:column;
    `;

    const fmt = (ts) => {
      if (!ts) return '';
      const d = ts.toDate ? ts.toDate() : new Date(ts);
      const diff = Date.now() - d.getTime();
      if (diff < 60000)  return 'just now';
      if (diff < 3600000) return `${Math.floor(diff/60000)}m ago`;
      if (diff < 86400000) return `${Math.floor(diff/3600000)}h ago`;
      return d.toLocaleDateString('en-IN',{day:'2-digit',month:'short'});
    };

    const actIcon = (type) => {
      if (type?.includes('invoice'))  return Icon.fileText(15);
      if (type?.includes('payment'))  return Icon.wallet(15);
      if (type?.includes('customer')) return Icon.user(15);
      if (type?.includes('expense'))  return Icon.calculator(15);
      if (type?.includes('vendor'))   return Icon.truck(15);
      if (type?.includes('team'))     return Icon.users(15);
      return Icon.clipboard(15);
    };

    panel.innerHTML = `
      <div style="padding:14px 16px 10px;border-bottom:1px solid #E2E8F0;display:flex;align-items:center;justify-content:space-between;">
        <div style="font-size:15px;font-weight:700;color:#0F172A;">Activity</div>
        <button onclick="document.getElementById('__notif-panel')?.remove()" style="background:none;border:none;cursor:pointer;color:#64748B;display:flex;">${Icon.x(16)}</button>
      </div>
      <div style="overflow-y:auto;flex:1;padding:6px;">
        ${this._activities.length === 0 ? `
          <div style="text-align:center;padding:40px 20px;color:#94A3B8;">
            <div style="display:flex;justify-content:center;margin-bottom:10px;">${Icon.bell(28)}</div>
            <div style="font-size:13.5px;font-weight:500;color:#64748B;">No activity yet</div>
            <div style="font-size:12px;margin-top:4px;">Actions by you and your team will appear here</div>
          </div>
        ` : this._activities.map(a => `
          <div style="display:flex;align-items:flex-start;gap:10px;padding:10px 10px;border-radius:9px;transition:background 0.1s;" onmouseover="this.style.background='#F8FAFC'" onmouseout="this.style.background='transparent'">
            <div style="width:32px;height:32px;border-radius:9px;background:#F1F5F9;display:flex;align-items:center;justify-content:center;color:#4A5568;flex-shrink:0;">${actIcon(a.type)}</div>
            <div style="flex:1;min-width:0;">
              <div style="font-size:13px;color:#0F172A;line-height:1.45;">${a.message||a.description||'Activity recorded'}</div>
              <div style="display:flex;align-items:center;gap:6px;margin-top:4px;">
                <span style="font-size:11px;color:#94A3B8;">${a.userName||'Team member'}</span>
                <span style="font-size:11px;color:#CBD5E1;">·</span>
                <span style="font-size:11px;color:#94A3B8;">${fmt(a.createdAt)}</span>
              </div>
            </div>
          </div>
        `).join('')}
      </div>
      <div style="padding:10px 12px;border-top:1px solid #E2E8F0;text-align:center;">
        <span style="font-size:12px;color:#94A3B8;">Showing last 30 activities</span>
      </div>
    `;

    document.body.appendChild(panel);
    setTimeout(() => {
      document.addEventListener('click', function close(e) {
        if (!panel.contains(e.target) && !document.getElementById('btn-notif')?.contains(e.target)) {
          panel.remove();
          document.removeEventListener('click', close);
        }
      });
    }, 50);
  },

  // Call this after every important action to log activity
  async log(type, message) {
    const companyId = Store.get('companyId');
    const user      = Store.get('user');
    if (!companyId || !user) return;

    try {
      const { collection, addDoc, serverTimestamp } =
        await import('https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js');
      await addDoc(collection(window.fbDB, 'companies', companyId, 'activityLogs'), {
        type,
        message,
        userId:   user.uid,
        userName: user.displayName || user.email?.split('@')[0] || 'User',
        createdAt: serverTimestamp(),
      });
    } catch(e) { /* non-critical */ }
  },
};

export default Notifications;
