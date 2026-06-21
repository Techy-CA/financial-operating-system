/**
 * join.controller.js
 * Workspace join via secret key
 * URL: #/join or #/join?key=FINOS-XXXX-XXXX
 */

import Auth from '../../core/auth.js';
import Toast from '../../components/Toast.js';

const JoinPage = {
  _inviteData: null,

  init() {
    // Hide app shell, show auth container
    document.getElementById('app-shell')?.classList.add('d-none');
    const c = document.getElementById('auth-container');
    c.classList.remove('d-none');
    c.style.cssText = 'display:flex;width:100%;min-height:100vh;align-items:center;justify-content:center;background:#F8F9FC;';

    const key = new URLSearchParams(window.location.hash.split('?')[1]||'').get('key')||'';

    c.innerHTML = `
    <div style="width:100%;max-width:440px;padding:20px;font-family:Inter,sans-serif;">
      <div style="text-align:center;margin-bottom:24px;">
        <div style="width:48px;height:48px;background:linear-gradient(135deg,#3B82F6,#1D4ED8);border-radius:12px;display:inline-flex;align-items:center;justify-content:center;margin-bottom:14px;box-shadow:0 4px 16px rgba(26,86,219,0.3);">
          <svg width="24" height="24" viewBox="0 0 100 120" fill="none"><path d="M15 10 C15 10 70 10 85 10 C90 10 95 15 85 25 C75 35 30 50 30 50 C30 50 70 50 80 50 C85 50 88 55 80 63 C72 71 30 90 30 90 L30 115" stroke="white" stroke-width="18" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>
        </div>
        <h2 style="font-size:22px;font-weight:800;color:#0F172A;margin-bottom:5px;">Join a FinOS workspace</h2>
        <p style="font-size:13.5px;color:#64748B;">Enter the key your admin shared with you</p>
      </div>

      <div style="background:white;border:1px solid #E2E8F0;border-radius:14px;overflow:hidden;box-shadow:0 2px 16px rgba(0,0,0,0.06);">

        <!-- Step 1: Enter key -->
        <div id="step-key" style="padding:24px;">
          <div style="margin-bottom:16px;">
            <label style="display:block;font-size:12.5px;font-weight:700;color:#374151;margin-bottom:6px;text-transform:uppercase;letter-spacing:0.5px;">Workspace key</label>
            <input id="j-key" type="text" value="${key}" placeholder="FINOS-XXXX-XXXX"
              maxlength="20" autocomplete="off"
              style="width:100%;padding:14px;border:2px solid #E2E8F0;border-radius:10px;font-size:17px;font-family:monospace;letter-spacing:3px;text-align:center;text-transform:uppercase;outline:none;box-sizing:border-box;transition:border 0.15s;"
              onfocus="this.style.borderColor='#3B82F6';this.style.boxShadow='0 0 0 3px rgba(59,130,246,0.15)'"
              onblur="this.style.borderColor='#E2E8F0';this.style.boxShadow='none'"
              oninput="this.value=this.value.toUpperCase()" />
          </div>
          <div id="key-err" style="display:none;background:#FEF2F2;border:1px solid #FECACA;border-radius:8px;padding:10px 13px;font-size:12.5px;color:#991B1B;margin-bottom:14px;"></div>
          <button id="btn-verify" onclick="JoinPage.verifyKey()"
            style="width:100%;padding:12px;background:linear-gradient(135deg,#1D4ED8,#2563EB);color:white;border:none;border-radius:10px;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;box-shadow:0 3px 10px rgba(29,78,216,0.3);">
            Verify key →
          </button>
        </div>

        <!-- Step 2: Register -->
        <div id="step-register" style="display:none;">
          <div id="workspace-banner" style="padding:14px 20px;border-bottom:1px solid #E2E8F0;background:#EFF6FF;"></div>
          <div style="padding:20px;">
            <div style="margin-bottom:13px;"><label style="display:block;font-size:12.5px;font-weight:600;color:#374151;margin-bottom:5px;">Full name *</label><input id="j-name" type="text" placeholder="Your full name" style="width:100%;padding:10px 12px;border:1.5px solid #E2E8F0;border-radius:8px;font-size:13.5px;font-family:inherit;outline:none;box-sizing:border-box;" onfocus="this.style.borderColor='#3B82F6'" onblur="this.style.borderColor='#E2E8F0'" /></div>
            <div style="margin-bottom:13px;"><label style="display:block;font-size:12.5px;font-weight:600;color:#374151;margin-bottom:5px;">Email address *</label><input id="j-email" type="email" placeholder="your@email.com" style="width:100%;padding:10px 12px;border:1.5px solid #E2E8F0;border-radius:8px;font-size:13.5px;font-family:inherit;outline:none;box-sizing:border-box;" onfocus="this.style.borderColor='#3B82F6'" onblur="this.style.borderColor='#E2E8F0'" /></div>
            <div style="margin-bottom:16px;"><label style="display:block;font-size:12.5px;font-weight:600;color:#374151;margin-bottom:5px;">Password (min 8 chars) *</label><input id="j-pass" type="password" placeholder="Create a password" style="width:100%;padding:10px 12px;border:1.5px solid #E2E8F0;border-radius:8px;font-size:13.5px;font-family:inherit;outline:none;box-sizing:border-box;" onfocus="this.style.borderColor='#3B82F6'" onblur="this.style.borderColor='#E2E8F0'" /></div>
            <div id="reg-err" style="display:none;background:#FEF2F2;border:1px solid #FECACA;border-radius:8px;padding:10px 13px;font-size:12.5px;color:#991B1B;margin-bottom:14px;"></div>
            <button id="btn-join" onclick="JoinPage.requestToJoin()"
              style="width:100%;padding:12px;background:linear-gradient(135deg,#1D4ED8,#2563EB);color:white;border:none;border-radius:10px;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;">
              Request to join workspace
            </button>
            <button onclick="JoinPage.backToKey()" style="width:100%;margin-top:8px;padding:10px;background:transparent;border:none;color:#64748B;font-size:13px;cursor:pointer;font-family:inherit;">← Change key</button>
          </div>
        </div>

        <!-- Step 3: Success -->
        <div id="step-success" style="display:none;padding:40px 24px;text-align:center;">
          <div style="font-size:48px;margin-bottom:16px;">🎉</div>
          <h3 style="font-size:18px;font-weight:800;color:#0F172A;margin-bottom:8px;">Request sent!</h3>
          <p style="font-size:13.5px;color:#64748B;line-height:1.7;margin-bottom:20px;">Your join request has been sent to the workspace admin. Once they approve you with a role, you can log in and access the workspace.</p>
          <a href="#/login" style="display:inline-block;padding:11px 28px;background:#1D4ED8;color:white;border-radius:10px;font-weight:700;font-size:14px;text-decoration:none;">Go to login</a>
        </div>

      </div>

      <p style="text-align:center;margin-top:16px;font-size:13px;color:#64748B;">
        Already have access? <a href="#/login" style="color:#1D4ED8;font-weight:600;text-decoration:none;">Sign in</a>
      </p>
    </div>`;

    window.JoinPage = this;
    if (key) {
      setTimeout(() => this.verifyKey(), 200);
    }
  },

  backToKey() {
    document.getElementById('step-register').style.display = 'none';
    document.getElementById('step-key').style.display = 'block';
  },

  async verifyKey() {
    const key = document.getElementById('j-key')?.value?.trim().toUpperCase();
    const btn = document.getElementById('btn-verify');
    const errEl = document.getElementById('key-err');
    if (!key || key.length < 6) {
      this._showErr(errEl, 'Please enter the workspace key your admin shared with you.');
      return;
    }
    btn.disabled = true; btn.textContent = 'Verifying…'; errEl.style.display = 'none';
    try {
      const{collection,getDocs,query,where}=await import('https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js');
      const db = window.fbDB;
      const q = query(collection(db,'workspaceKeys'),where('key','==',key),where('active','==',true));
      const snap = await getDocs(q);

      if (snap.empty) {
        btn.disabled = false; btn.textContent = 'Verify key →';
        this._showErr(errEl, '❌ Invalid or expired key. Ask your admin to regenerate it from Settings → Team.');
        return;
      }

      this._inviteData = { docId: snap.docs[0].id, ...snap.docs[0].data() };
      const banner = document.getElementById('workspace-banner');
      if (banner) {
        banner.innerHTML = `
          <div style="display:flex;align-items:center;gap:10px;">
            <div style="width:36px;height:36px;border-radius:9px;background:#1D4ED8;color:white;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;flex-shrink:0;">${(this._inviteData.companyName||'?').charAt(0).toUpperCase()}</div>
            <div>
              <div style="font-size:14px;font-weight:700;color:#1E40AF;">✅ ${this._inviteData.companyName||'Workspace found'}</div>
              <div style="font-size:12px;color:#3B82F6;margin-top:1px;">You're joining this workspace. Create your account below.</div>
            </div>
          </div>`;
      }
      document.getElementById('step-key').style.display = 'none';
      document.getElementById('step-register').style.display = 'block';
    } catch(e) {
      btn.disabled = false; btn.textContent = 'Verify key →';
      this._showErr(errEl, 'Error: ' + e.message);
    }
  },

  async requestToJoin() {
    const name  = document.getElementById('j-name')?.value?.trim();
    const email = document.getElementById('j-email')?.value?.trim();
    const pass  = document.getElementById('j-pass')?.value;
    const errEl = document.getElementById('reg-err');
    const btn   = document.getElementById('btn-join');
    if (!name || !email || !pass) { this._showErr(errEl, 'Please fill in all fields.'); return; }
    if (pass.length < 8)          { this._showErr(errEl, 'Password must be at least 8 characters.'); return; }
    btn.disabled = true; btn.textContent = 'Sending request…'; errEl.style.display = 'none';
    try {
      // Create Firebase auth account
      let uid;
      try {
        const user = await Auth.signup(email, pass, name);
        uid = user.uid;
        await Auth.logout(); // Logout immediately - pending approval
      } catch(authErr) {
        if (authErr.code === 'auth/email-already-in-use') {
          // Account exists - verify password and get uid
          try {
            const u = await Auth.loginWithEmail(email, pass);
            uid = u.uid;
            await Auth.logout();
          } catch(e2) {
            btn.disabled = false; btn.textContent = 'Request to join workspace';
            this._showErr(errEl, 'This email is already registered. Check your password.'); return;
          }
        } else {
          btn.disabled = false; btn.textContent = 'Request to join workspace';
          this._showErr(errEl, Auth.errorMessage(authErr.code)); return;
        }
      }

      // Create join request in Firestore
      const{collection,addDoc,serverTimestamp}=await import('https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js');
      await addDoc(collection(window.fbDB,'joinRequests'),{
        uid,
        name,
        email,
        companyId:    this._inviteData.companyId,
        companyName:  this._inviteData.companyName,
        workspaceKey: this._inviteData.key,
        status:       'pending',
        createdAt:    serverTimestamp(),
      });

      document.getElementById('step-register').style.display = 'none';
      document.getElementById('step-success').style.display = 'block';
    } catch(e) {
      btn.disabled = false; btn.textContent = 'Request to join workspace';
      this._showErr(errEl, 'Error: ' + e.message);
    }
  },

  _showErr(el, msg) { if(el){ el.textContent=msg; el.style.display='block'; } },
};
export default JoinPage;
