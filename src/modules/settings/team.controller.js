/**
 * team.controller.js
 * Workspace join system with secret key + approval flow
 *
 * SECURITY MODEL:
 * - workspaceKeys: anyone with auth can read (to verify key), only owner can write
 * - joinRequests: anyone with auth can create (to submit request), only owner can update
 * - companyUsers: only readable by authenticated users; only owner can add members
 * - Members only see data from companies they're in companyUsers for (enforced by Firestore rules)
 */

import Store from '../../core/store.js';
import Toast from '../../components/Toast.js';
import Icon  from '../../utils/icons.js';

const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no ambiguous chars

function genKey() {
  let k = 'FINOS-';
  for (let i = 0; i < 4; i++) k += CHARS[Math.floor(Math.random() * CHARS.length)];
  k += '-';
  for (let i = 0; i < 4; i++) k += CHARS[Math.floor(Math.random() * CHARS.length)];
  return k;
}

export const TeamController = {
  _cid: null,
  _co:  null,
  _currentKey: null,

  async loadTab(container) {
    this._cid = Store.get('companyId');
    this._co  = Store.get('company') || {};
    const user = Store.get('user') || {};
    const role = Store.get('role') || 'founder';

    if (!this._cid) {
      container.innerHTML = `<div class="card"><div class="card-body empty-state"><h3>Set up your company first</h3><a href="#/settings" class="btn btn-primary">Go to Settings</a></div></div>`;
      return;
    }

    const joinUrl = `${location.origin}${location.pathname}#/join`;

    container.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:16px;">

        <!-- Workspace key card -->
        <div class="card">
          <div class="card-header"><h2 style="display:flex;align-items:center;gap:8px;">${Icon.key(16)} Workspace key</h2></div>
          <div class="card-body">
            <p style="font-size:13.5px;color:var(--text-secondary);margin-bottom:16px;">
              Share this key with your team. They go to <a href="#/join" style="color:var(--brand-primary);font-weight:600;">${joinUrl}</a>, enter the key, and create an account. You then approve them here.
            </p>
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;">
              <div id="key-display" style="flex:1;background:var(--bg-subtle);border:2px dashed var(--border-default);border-radius:10px;padding:14px 20px;font-family:var(--font-mono);font-size:20px;font-weight:800;letter-spacing:4px;color:var(--brand-primary);text-align:center;">
                Loading…
              </div>
              <div style="display:flex;flex-direction:column;gap:6px;">
                <button onclick="TeamController.copyKey()" class="btn btn-secondary btn-sm">${Icon.clipboard(13)} Copy key</button>
                <button onclick="TeamController.copyLink()" class="btn btn-secondary btn-sm">${Icon.link(13)} Copy link</button>
                <button onclick="TeamController.newKey()" class="btn btn-ghost btn-sm" style="font-size:11px;color:var(--text-tertiary);">${Icon.refresh(12)} Regenerate</button>
              </div>
            </div>
            <div style="background:var(--color-info-light);border:1px solid var(--color-info-mid);border-radius:8px;padding:10px 14px;font-size:12.5px;color:var(--color-info-text);display:flex;gap:8px;">
              ${Icon.lock(14)} <span><strong>Security:</strong> This key grants access requests only. You still approve every member before they get access. Regenerate the key anytime to invalidate old ones.</span>
            </div>
          </div>
        </div>

        <!-- Pending join requests -->
        <div class="card">
          <div class="card-header">
            <h2 style="display:flex;align-items:center;gap:8px;">${Icon.inbox(16)} Join requests</h2>
            <button onclick="TeamController.refresh()" class="btn btn-ghost btn-sm">${Icon.refresh(13)} Refresh</button>
          </div>
          <div id="join-requests"><div style="text-align:center;padding:24px;"><div class="spinner-sm"></div></div></div>
        </div>

        <!-- Current members -->
        <div class="card">
          <div class="card-header"><h2 style="display:flex;align-items:center;gap:8px;">${Icon.users(16)} Current team</h2></div>
          <div class="card-body">
            <div style="display:flex;align-items:center;gap:12px;padding:12px;background:var(--bg-subtle);border-radius:10px;margin-bottom:10px;">
              <div style="width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,#3B82F6,#1D4ED8);color:white;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;flex-shrink:0;">${(user.displayName||user.email||'U').charAt(0).toUpperCase()}</div>
              <div style="flex:1;">
                <div style="font-size:14px;font-weight:600;">${user.displayName||user.email||'—'} <span style="font-size:11px;color:var(--text-tertiary);">(you)</span></div>
                <div style="font-size:12px;color:var(--text-tertiary);">${user.email}</div>
              </div>
              <span class="badge badge-info">${role.charAt(0).toUpperCase()+role.slice(1)}</span>
            </div>
            <div id="members-list"><div style="text-align:center;padding:16px;"><div class="spinner-sm"></div></div></div>
          </div>
        </div>

        <!-- Roles matrix -->
        <div class="card">
          <div class="card-header"><h2 style="display:flex;align-items:center;gap:8px;">${Icon.clipboard(16)} Roles & permissions</h2></div>
          <div class="card-body" style="overflow-x:auto;">
            <table class="data-table" style="min-width:500px;">
              <thead><tr><th>Permission</th><th class="text-center">Founder</th><th class="text-center">Admin</th><th class="text-center">Accountant</th><th class="text-center">Sales</th><th class="text-center">Auditor</th></tr></thead>
              <tbody>
                ${[
                  ['Create & send invoices', true, true, true, true, false],
                  ['Edit & delete invoices', true, true, true, false, false],
                  ['Record payments',        true, true, true, false, false],
                  ['Manage customers',       true, true, false, true, false],
                  ['Add expenses',           true, true, true, false, false],
                  ['View reports & GST',     true, true, true, true, true],
                  ['Export data',            true, true, true, false, true],
                  ['Vendors & products',     true, true, false, false, false],
                  ['Manage team',            true, false, false, false, false],
                  ['Company settings',       true, true, false, false, false],
                ].map(([p,...v]) => `<tr><td style="font-size:13px;">${p}</td>${v.map(x => `<td class="text-center">${x ? `<span style="color:var(--color-success);display:inline-flex;">${Icon.check(14)}</span>` : '<span style="color:var(--border-strong);">–</span>'}</td>`).join('')}</tr>`).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    window.TeamController = this;
    await Promise.all([this._loadKey(), this.refresh(), this._loadMembers()]);
  },

  async _loadKey() {
    try {
      const { collection, getDocs, query, where } = await import('https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js');
      const q    = query(collection(window.fbDB, 'workspaceKeys'), where('companyId', '==', this._cid), where('active', '==', true));
      const snap = await getDocs(q);
      if (!snap.empty) {
        this._currentKey = snap.docs[0].data().key;
      } else {
        await this.newKey();
        return;
      }
      const el = document.getElementById('key-display');
      if (el) el.textContent = this._currentKey;
    } catch(e) {
      const el = document.getElementById('key-display');
      if (el) el.textContent = 'Error loading key';
      console.warn('[Team] loadKey:', e.message);
    }
  },

  async newKey() {
    const newKey = genKey();
    try {
      const { collection, addDoc, getDocs, query, where, updateDoc, doc, serverTimestamp } =
        await import('https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js');
      const db = window.fbDB;
      // Deactivate all existing keys for this company
      const old = await getDocs(query(collection(db, 'workspaceKeys'), where('companyId', '==', this._cid)));
      for (const d of old.docs) await updateDoc(doc(db, 'workspaceKeys', d.id), { active: false });
      // Create new
      await addDoc(collection(db, 'workspaceKeys'), {
        key:         newKey,
        companyId:   this._cid,
        companyName: this._co?.name || '',
        active:      true,
        createdAt:   serverTimestamp(),
        createdBy:   Store.get('user')?.uid,
      });
      this._currentKey = newKey;
      const el = document.getElementById('key-display');
      if (el) el.textContent = newKey;
      Toast.success('New workspace key generated!');
    } catch(e) { Toast.error('Failed: ' + e.message); }
  },

  copyKey() {
    if (!this._currentKey) return;
    navigator.clipboard?.writeText(this._currentKey)
      .then(() => Toast.success('Key copied!'))
      .catch(() => prompt('Copy this workspace key:', this._currentKey));
  },

  copyLink() {
    // Link goes to /signup?key=... so it pre-fills key and skips to join flow
    const url = `${location.origin}${location.pathname}#/signup?key=${this._currentKey||''}`;
    navigator.clipboard?.writeText(url)
      .then(() => Toast.success('Join link copied! Anyone opening this link will be taken directly to the join form with the key pre-filled.'))
      .catch(() => prompt('Copy this join link:', url));
  },

  async refresh() {
    const el = document.getElementById('join-requests');
    if (!el) return;
    try {
      const { collection, getDocs, query, where, orderBy } =
        await import('https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js');
      const q = query(collection(window.fbDB, 'joinRequests'), where('companyId', '==', this._cid));
      const snap = await getDocs(q);
      const requests = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));

      const pending = requests.filter(r => r.status === 'pending');

      // Update badge in header
      const badge = el.previousElementSibling?.querySelector('.badge');
      if (!badge && pending.length > 0) {
        const hdr = document.querySelector('#join-requests')?.previousElementSibling;
        // do nothing, handled in HTML
      }

      if (requests.length === 0) {
        el.innerHTML = `<div style="text-align:center;padding:24px;font-size:13px;color:var(--text-tertiary);">No join requests yet. Share the workspace key with your team.</div>`;
        return;
      }

      el.innerHTML = `<div style="padding:8px 16px 14px;">
        ${pending.length > 0 ? `<div style="background:var(--color-warning-light);border:1px solid var(--color-warning-mid);border-radius:8px;padding:10px 14px;margin-bottom:12px;font-size:13px;font-weight:600;color:var(--color-warning-text);">⏳ ${pending.length} pending approval${pending.length !== 1 ? 's' : ''}</div>` : ''}
        ${requests.map(r => `
          <div style="display:flex;align-items:center;gap:12px;padding:12px;border-radius:10px;border:1.5px solid ${r.status === 'pending' ? 'var(--color-warning-mid)' : 'var(--border-subtle)'};background:${r.status === 'pending' ? 'var(--color-warning-light)' : 'white'};margin-bottom:8px;">
            <div style="width:38px;height:38px;border-radius:50%;background:${r.status === 'approved' ? 'var(--color-success-light)' : 'var(--bg-inset)'};display:flex;align-items:center;justify-content:center;font-size:15px;font-weight:700;color:var(--text-secondary);flex-shrink:0;">${(r.name||r.email||'?').charAt(0).toUpperCase()}</div>
            <div style="flex:1;min-width:0;">
              <div style="font-size:14px;font-weight:600;color:var(--text-primary);">${r.name || '—'}</div>
              <div style="font-size:12px;color:var(--text-tertiary);">${r.email}</div>
              <div style="font-size:11px;color:var(--text-tertiary);margin-top:2px;">Requested ${r.createdAt?.toDate ? r.createdAt.toDate().toLocaleDateString('en-IN') : 'recently'}</div>
            </div>
            ${r.status === 'pending' ? `
              <div style="display:flex;align-items:center;gap:8px;flex-shrink:0;">
                <div>
                  <label style="font-size:11px;font-weight:600;color:var(--text-tertiary);display:block;margin-bottom:3px;">Assign role</label>
                  <select id="role-${r.id}" class="select" style="font-size:12px;padding:5px 10px;min-width:130px;">
                    <option value="accountant">Accountant</option>
                    <option value="admin">Admin</option>
                    <option value="sales">Sales</option>
                    <option value="operations">Operations</option>
                    <option value="auditor">Auditor</option>
                  </select>
                </div>
                <div style="display:flex;flex-direction:column;gap:5px;margin-top:15px;">
                  <button class="btn btn-success btn-sm" onclick="TeamController.approve('${r.id}','${r.uid}','${r.email}','${r.name||''}')">${Icon.check(13)} Approve</button>
                  <button class="btn btn-secondary btn-sm" onclick="TeamController.reject('${r.id}','${r.name||r.email}')">Reject</button>
                </div>
              </div>` :
              `<span class="badge ${r.status === 'approved' ? 'badge-success' : 'badge-danger'}">${r.status === 'approved' ? `${Icon.check(11)} Approved` : `${Icon.x(11)} Rejected`}</span>`}
          </div>`).join('')}
      </div>`;
    } catch(e) {
      if (el) el.innerHTML = `<div style="color:var(--color-danger);padding:16px;font-size:13px;">Error: ${e.message}</div>`;
    }
  },

  async approve(reqId, uid, email, name) {
    const role = document.getElementById(`role-${reqId}`)?.value || 'accountant';
    try {
      const { doc, updateDoc, setDoc, addDoc, collection, serverTimestamp, getDocs, query, where } =
        await import('https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js');
      const db = window.fbDB;

      // 1. Update join request
      await updateDoc(doc(db, 'joinRequests', reqId), {
        status:     'approved',
        role,
        approvedAt: serverTimestamp(),
        approvedBy: Store.get('user')?.uid,
      });

      // 2. Add to company members subcollection
      await setDoc(doc(db, 'companies', this._cid, 'members', uid), {
        uid, email, name: name || '', role,
        joinedAt: serverTimestamp(),
        addedBy:  Store.get('user')?.uid,
      });

      // 3. Check if already in companyUsers
      const existing = await getDocs(query(collection(db, 'companyUsers'), where('uid','==',uid), where('companyId','==',this._cid)));
      if (existing.empty) {
        await addDoc(collection(db, 'companyUsers'), {
          uid, email, name: name||'', companyId: this._cid, role,
          joinedAt: serverTimestamp(),
        });
      }

      Toast.success(`${name || email} approved as ${role}! They can now log in.`);
      await this.refresh();
      await this._loadMembers();
    } catch(e) { Toast.error('Failed: ' + e.message); }
  },

  async reject(reqId, name) {
    if (!confirm(`Reject join request from ${name}?`)) return;
    try {
      const { doc, updateDoc, serverTimestamp } = await import('https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js');
      await updateDoc(doc(window.fbDB, 'joinRequests', reqId), {
        status:     'rejected',
        rejectedAt: serverTimestamp(),
        rejectedBy: Store.get('user')?.uid,
      });
      Toast.success('Request rejected');
      await this.refresh();
    } catch(e) { Toast.error('Failed: ' + e.message); }
  },

  async _loadMembers() {
    const el = document.getElementById('members-list');
    if (!el) return;
    try {
      const { collection, getDocs, query, where } =
        await import('https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js');
      const q = query(collection(window.fbDB, 'companyUsers'), where('companyId', '==', this._cid));
      const snap = await getDocs(q);
      const members = snap.docs.map(d => d.data()).filter(m => m.uid !== Store.get('user')?.uid);

      el.innerHTML = members.length === 0
        ? `<div style="text-align:center;padding:16px;font-size:13px;color:var(--text-tertiary);">No other members yet. Share the workspace key to invite your team.</div>`
        : members.map(m => `
          <div style="display:flex;align-items:center;gap:12px;padding:10px;border-radius:9px;border:1px solid var(--border-subtle);margin-bottom:6px;">
            <div style="width:34px;height:34px;border-radius:50%;background:var(--bg-inset);display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;color:var(--text-secondary);flex-shrink:0;">${(m.name||m.email||'?').charAt(0).toUpperCase()}</div>
            <div style="flex:1;">
              <div style="font-size:13.5px;font-weight:600;">${m.name || m.email}</div>
              <div style="font-size:12px;color:var(--text-tertiary);">${m.email}</div>
            </div>
            <span class="badge badge-neutral">${m.role || 'member'}</span>
          </div>`).join('');
    } catch(e) { el.innerHTML = ''; }
  },
};