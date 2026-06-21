import Auth from '../../core/auth.js';

const SignupPage = {
  _mode: null,
  _inviteData: null,

  init() {
    const preKey = new URLSearchParams(window.location.hash.split('?')[1]||'').get('key')||'';
    if (preKey) { this._mode = 'join'; }
    this._renderChoice(preKey);
    window.SignupPage = this;
  },

  _renderChoice(preKey='') {
    const c = document.getElementById('auth-container');
    c.style.cssText = 'display:flex;width:100%;min-height:100vh;align-items:center;justify-content:center;background:#F8F9FC;';
    c.innerHTML = `
    <div style="width:100%;max-width:480px;padding:24px 20px;font-family:Inter,sans-serif;">
      <div style="text-align:center;margin-bottom:32px;">
        <div style="width:52px;height:52px;background:linear-gradient(135deg,#3B82F6,#1D4ED8);border-radius:14px;display:inline-flex;align-items:center;justify-content:center;margin-bottom:16px;box-shadow:0 4px 16px rgba(29,78,216,0.3);">
          <svg width="26" height="26" viewBox="0 0 100 120" fill="none"><path d="M15 10 C15 10 70 10 85 10 C90 10 95 15 85 25 C75 35 30 50 30 50 C30 50 70 50 80 50 C85 50 88 55 80 63 C72 71 30 90 30 90 L30 115" stroke="white" stroke-width="18" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>
        </div>
        <h1 style="font-size:24px;font-weight:800;color:#0F172A;margin:0 0 6px;">Welcome to FinOS</h1>
        <p style="font-size:14px;color:#64748B;margin:0;">How would you like to get started?</p>
      </div>
      <div style="display:flex;flex-direction:column;gap:12px;">
        <!-- New workspace -->
        <button onclick="SignupPage._mode='new';SignupPage._renderForm()"
          style="background:white;border:1.5px solid #E2E8F0;border-radius:14px;padding:20px 22px;text-align:left;cursor:pointer;transition:all 0.15s;font-family:inherit;width:100%;"
          onmouseover="this.style.borderColor='#3B82F6';this.style.boxShadow='0 0 0 3px rgba(59,130,246,0.1)'"
          onmouseout="this.style.borderColor='#E2E8F0';this.style.boxShadow='none'">
          <div style="display:flex;align-items:center;gap:14px;">
            <div style="width:40px;height:40px;background:#EFF6FF;border-radius:10px;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1D4ED8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/><line x1="12" y1="12" x2="12" y2="16"/><line x1="10" y1="14" x2="14" y2="14"/></svg>
            </div>
            <div>
              <div style="font-size:15px;font-weight:700;color:#0F172A;margin-bottom:3px;">Create new workspace</div>
              <div style="font-size:13px;color:#64748B;line-height:1.4;">Start fresh — set up your company, invite your team later.</div>
            </div>
            <svg style="margin-left:auto;flex-shrink:0;" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#CBD5E1" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
          </div>
        </button>
        <!-- Join existing -->
        <button onclick="SignupPage._mode='join';SignupPage._renderForm('${preKey}')"
          style="background:white;border:1.5px solid #E2E8F0;border-radius:14px;padding:20px 22px;text-align:left;cursor:pointer;transition:all 0.15s;font-family:inherit;width:100%;"
          onmouseover="this.style.borderColor='#3B82F6';this.style.boxShadow='0 0 0 3px rgba(59,130,246,0.1)'"
          onmouseout="this.style.borderColor='#E2E8F0';this.style.boxShadow='none'">
          <div style="display:flex;align-items:center;gap:14px;">
            <div style="width:40px;height:40px;background:#F0FDF4;border-radius:10px;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#16A34A" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>
            </div>
            <div>
              <div style="font-size:15px;font-weight:700;color:#0F172A;margin-bottom:3px;">Join existing workspace</div>
              <div style="font-size:13px;color:#64748B;line-height:1.4;">Your admin shared a workspace key. Enter it to request access.</div>
            </div>
            <svg style="margin-left:auto;flex-shrink:0;" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#CBD5E1" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
          </div>
        </button>
      </div>
      <p style="text-align:center;margin-top:24px;font-size:13px;color:#64748B;">
        Already have an account? <a href="#/login" style="color:#1D4ED8;font-weight:600;text-decoration:none;">Sign in</a>
      </p>
    </div>`;
  },

  _renderForm(preKey='') {
    const isJoin = this._mode === 'join';
    const c = document.getElementById('auth-container');
    c.innerHTML = `
    <div style="width:100%;max-width:480px;padding:24px 20px;font-family:Inter,sans-serif;">
      <!-- Header -->
      <div style="text-align:center;margin-bottom:28px;">
        <div style="width:48px;height:48px;background:linear-gradient(135deg,#3B82F6,#1D4ED8);border-radius:13px;display:inline-flex;align-items:center;justify-content:center;margin-bottom:14px;box-shadow:0 4px 16px rgba(29,78,216,0.3);">
          <svg width="24" height="24" viewBox="0 0 100 120" fill="none"><path d="M15 10 C15 10 70 10 85 10 C90 10 95 15 85 25 C75 35 30 50 30 50 C30 50 70 50 80 50 C85 50 88 55 80 63 C72 71 30 90 30 90 L30 115" stroke="white" stroke-width="18" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>
        </div>
        <h2 style="font-size:22px;font-weight:800;color:#0F172A;margin:0 0 4px;">${isJoin ? 'Join a workspace' : 'Create your account'}</h2>
        <p style="font-size:13px;color:#64748B;margin:0;">${isJoin ? 'Enter the key your admin shared with you' : 'Set up your FinOS account'}</p>
      </div>

      <div style="background:white;border:1px solid #E2E8F0;border-radius:16px;overflow:hidden;box-shadow:0 2px 16px rgba(0,0,0,0.06);">

        ${isJoin ? `
        <!-- Step 1: Workspace key -->
        <div id="s-key" style="padding:24px;">
          <label style="display:block;font-size:12px;font-weight:700;color:#374151;margin-bottom:6px;text-transform:uppercase;letter-spacing:0.6px;">Workspace Key</label>
          <input id="j-key" type="text" value="${preKey}" placeholder="FINOS-XXXX-XXXX" maxlength="20" autocomplete="off"
            style="width:100%;padding:14px;border:2px solid ${preKey?'#3B82F6':'#E2E8F0'};border-radius:10px;font-size:18px;font-family:monospace;letter-spacing:3px;text-align:center;text-transform:uppercase;outline:none;box-sizing:border-box;transition:all 0.15s;"
            onfocus="this.style.borderColor='#3B82F6';this.style.boxShadow='0 0 0 3px rgba(59,130,246,0.12)'"
            onblur="this.style.borderColor=this.value?'#3B82F6':'#E2E8F0';this.style.boxShadow='none'"
            oninput="this.value=this.value.toUpperCase()" onkeydown="if(event.key==='Enter')SignupPage.verifyKey()" />
          ${preKey ? `<div style="background:#EFF6FF;border:1px solid #BFDBFE;border-radius:8px;padding:8px 12px;font-size:12.5px;color:#1E40AF;margin-top:8px;display:flex;align-items:center;gap:6px;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#1D4ED8" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg> Workspace key pre-filled from invite link</div>` : ''}
          <div id="key-err" style="display:none;background:#FEF2F2;border:1px solid #FECACA;border-radius:8px;padding:10px 12px;font-size:12.5px;color:#991B1B;margin-top:10px;"></div>
          <button onclick="SignupPage.verifyKey()" id="btn-verify"
            style="width:100%;padding:13px;background:#1D4ED8;color:white;border:none;border-radius:10px;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;margin-top:14px;box-shadow:0 3px 10px rgba(29,78,216,0.3);">
            Verify key →
          </button>
        </div>
        <div id="j-ws-banner" style="display:none;padding:12px 20px;background:#EFF6FF;border-top:1px solid #DBEAFE;"></div>
        <div id="s-form" style="display:none;padding:20px 24px 24px;">` : `
        <div style="padding:24px;">`}

          <!-- Name -->
          <div style="margin-bottom:14px;">
            <label style="display:block;font-size:12.5px;font-weight:600;color:#374151;margin-bottom:5px;">Full name <span style="color:#EF4444;">*</span></label>
            <div style="position:relative;">
              <svg style="position:absolute;left:12px;top:50%;transform:translateY(-50%);pointer-events:none;" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              <input id="su-name" type="text" placeholder="Rahul Sharma" autocomplete="name"
                style="width:100%;padding:10px 12px 10px 36px;border:1.5px solid #E2E8F0;border-radius:9px;font-size:13.5px;font-family:inherit;outline:none;box-sizing:border-box;transition:border 0.12s;"
                onfocus="this.style.borderColor='#3B82F6'" onblur="this.style.borderColor='#E2E8F0'" />
            </div>
          </div>

          <!-- Email -->
          <div style="margin-bottom:14px;">
            <label style="display:block;font-size:12.5px;font-weight:600;color:#374151;margin-bottom:5px;">Email address <span style="color:#EF4444;">*</span></label>
            <div style="position:relative;">
              <svg style="position:absolute;left:12px;top:50%;transform:translateY(-50%);pointer-events:none;" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
              <input id="su-email" type="email" placeholder="rahul@company.com" autocomplete="email"
                style="width:100%;padding:10px 12px 10px 36px;border:1.5px solid #E2E8F0;border-radius:9px;font-size:13.5px;font-family:inherit;outline:none;box-sizing:border-box;transition:border 0.12s;"
                onfocus="this.style.borderColor='#3B82F6'" onblur="this.style.borderColor='#E2E8F0'" />
            </div>
          </div>

          <!-- Phone -->
          <div style="margin-bottom:14px;">
            <label style="display:block;font-size:12.5px;font-weight:600;color:#374151;margin-bottom:5px;">Mobile number <span style="color:#EF4444;">*</span></label>
            <div style="position:relative;">
              <svg style="position:absolute;left:12px;top:50%;transform:translateY(-50%);pointer-events:none;" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" stroke-width="2"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>
              <input id="su-phone" type="tel" placeholder="9876543210" autocomplete="tel" maxlength="10"
                style="width:100%;padding:10px 12px 10px 36px;border:1.5px solid #E2E8F0;border-radius:9px;font-size:13.5px;font-family:inherit;outline:none;box-sizing:border-box;transition:border 0.12s;"
                onfocus="this.style.borderColor='#3B82F6'" onblur="this.style.borderColor='#E2E8F0'"
                oninput="this.value=this.value.replace(/[^0-9]/g,'')" />
            </div>
          </div>

          <!-- Password -->
          <div style="margin-bottom:14px;">
            <label style="display:block;font-size:12.5px;font-weight:600;color:#374151;margin-bottom:5px;">Password <span style="color:#EF4444;">*</span> <span style="font-weight:400;color:#9CA3AF;">(min 8 chars)</span></label>
            <div style="position:relative;">
              <svg style="position:absolute;left:12px;top:50%;transform:translateY(-50%);pointer-events:none;" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
              <input id="su-pass" type="password" placeholder="Create a strong password" autocomplete="new-password"
                style="width:100%;padding:10px 12px 10px 36px;border:1.5px solid #E2E8F0;border-radius:9px;font-size:13.5px;font-family:inherit;outline:none;box-sizing:border-box;transition:border 0.12s;"
                onfocus="this.style.borderColor='#3B82F6'" onblur="this.style.borderColor='#E2E8F0'" />
              <button type="button" onclick="SignupPage._togglePass('su-pass',this)" style="position:absolute;right:10px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;padding:4px;color:#9CA3AF;">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
              </button>
            </div>
          </div>

          <!-- Confirm password -->
          <div style="margin-bottom:18px;">
            <label style="display:block;font-size:12.5px;font-weight:600;color:#374151;margin-bottom:5px;">Confirm password <span style="color:#EF4444;">*</span></label>
            <div style="position:relative;">
              <svg style="position:absolute;left:12px;top:50%;transform:translateY(-50%);pointer-events:none;" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
              <input id="su-conf" type="password" placeholder="Re-enter your password" autocomplete="new-password"
                style="width:100%;padding:10px 12px 10px 36px;border:1.5px solid #E2E8F0;border-radius:9px;font-size:13.5px;font-family:inherit;outline:none;box-sizing:border-box;transition:border 0.12s;"
                onfocus="this.style.borderColor='#3B82F6'" onblur="this.style.borderColor='#E2E8F0'"
                onkeydown="if(event.key==='Enter')SignupPage.submit()" />
              <button type="button" onclick="SignupPage._togglePass('su-conf',this)" style="position:absolute;right:10px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;padding:4px;color:#9CA3AF;">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
              </button>
            </div>
          </div>

          <div id="su-err" style="display:none;background:#FEF2F2;border:1px solid #FECACA;border-radius:9px;padding:10px 12px;font-size:12.5px;color:#991B1B;margin-bottom:14px;display:flex;align-items:flex-start;gap:8px;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#991B1B" stroke-width="2" style="flex-shrink:0;margin-top:1px;"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            <span id="su-err-text"></span>
          </div>

          <button id="btn-su" onclick="SignupPage.submit()"
            style="width:100%;padding:13px;background:linear-gradient(135deg,#1D4ED8,#2563EB);color:white;border:none;border-radius:10px;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;box-shadow:0 3px 10px rgba(29,78,216,0.3);transition:opacity 0.12s;">
            ${isJoin ? 'Request to join workspace' : 'Create account'}
          </button>
          <p style="font-size:11.5px;color:#94A3B8;text-align:center;margin:10px 0 0;">By signing up you agree to our terms of service.</p>

        ${isJoin ? '</div></div>' : '</div></div>'}

      <!-- Back link — single, at bottom -->
      <div style="text-align:center;margin-top:16px;">
        <button onclick="SignupPage._renderChoice()" style="background:none;border:none;cursor:pointer;font-size:13px;color:#64748B;font-family:inherit;display:inline-flex;align-items:center;gap:5px;">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
          Back to options
        </button>
        <span style="color:#E2E8F0;margin:0 8px;">·</span>
        <a href="#/login" style="font-size:13px;color:#64748B;text-decoration:none;">Already have an account? <span style="color:#1D4ED8;font-weight:600;">Sign in</span></a>
      </div>
    </div>`;

    if (preKey && isJoin) setTimeout(() => this.verifyKey(), 100);
  },

  _togglePass(id, btn) {
    const inp = document.getElementById(id);
    if (!inp) return;
    const show = inp.type === 'password';
    inp.type = show ? 'text' : 'password';
    btn.innerHTML = show
      ? `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`
      : `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
  },

  async verifyKey() {
    const key   = document.getElementById('j-key')?.value?.trim().toUpperCase();
    const btn   = document.getElementById('btn-verify');
    const errEl = document.getElementById('key-err');
    if (!key || key.length < 8) { this._showErr(errEl, 'Enter a valid workspace key (e.g. FINOS-ABCD-1234)'); return; }
    if (btn) { btn.disabled=true; btn.textContent='Verifying…'; }
    if (errEl) errEl.style.display='none';
    try {
      const { collection, getDocs, query, where } =
        await import('https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js');
      const snap = await getDocs(
        query(collection(window.fbDB, 'workspaceKeys'), where('key','==',key), where('active','==',true))
      );
      if (snap.empty) {
        if (btn) { btn.disabled=false; btn.textContent='Verify key →'; }
        this._showErr(errEl, 'Invalid or expired key. Ask your admin to regenerate it from Settings → Team.');
        return;
      }
      this._inviteData = { docId: snap.docs[0].id, ...snap.docs[0].data() };
      const banner = document.getElementById('j-ws-banner');
      if (banner) {
        banner.style.display = 'block';
        banner.innerHTML = `<div style="display:flex;align-items:center;gap:10px;">
          <div style="width:32px;height:32px;border-radius:8px;background:#1D4ED8;color:white;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;flex-shrink:0;">${(this._inviteData.companyName||'?').charAt(0)}</div>
          <div><div style="font-size:13.5px;font-weight:700;color:#1E40AF;">Workspace verified: ${this._inviteData.companyName}</div><div style="font-size:12px;color:#3B82F6;">Fill in your details to request access</div></div></div>`;
      }
      document.getElementById('s-key').style.display  = 'none';
      document.getElementById('s-form').style.display = 'block';
    } catch(e) {
      if (btn) { btn.disabled=false; btn.textContent='Verify key →'; }
      this._showErr(errEl, 'Error: ' + e.message);
    }
  },

  async submit() {
    const name  = document.getElementById('su-name')?.value?.trim();
    const email = document.getElementById('su-email')?.value?.trim();
    const phone = document.getElementById('su-phone')?.value?.trim();
    const pass  = document.getElementById('su-pass')?.value;
    const conf  = document.getElementById('su-conf')?.value;
    const errEl = document.getElementById('su-err');
    const btn   = document.getElementById('btn-su');

    if (!name)               { this._showErr(errEl, 'Enter your full name'); return; }
    if (!email || !email.includes('@')) { this._showErr(errEl, 'Enter a valid email address'); return; }
    if (!phone || phone.length < 10)   { this._showErr(errEl, 'Enter a valid 10-digit mobile number'); return; }
    if (!pass || pass.length < 8)      { this._showErr(errEl, 'Password must be at least 8 characters'); return; }
    if (pass !== conf)                 { this._showErr(errEl, 'Passwords do not match'); return; }
    if (errEl) errEl.style.display='none';
    if (btn) { btn.disabled=true; btn.textContent=this._mode==='join'?'Sending request…':'Creating account…'; }

    try {
      let uid;
      try {
        const user = await Auth.signup(email, pass, name);
        uid = user.uid;
        // Save phone to user profile
        try {
          const { getFirestore, doc, setDoc } = await import('https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js');
          await setDoc(doc(window.fbDB, 'users', uid), { name, email, phone, createdAt: new Date().toISOString() }, { merge: true });
        } catch(e) {}
      } catch(authErr) {
        if (authErr.code === 'auth/email-already-in-use') {
          try { const u = await Auth.loginWithEmail(email,pass); uid=u.uid; if(this._mode!=='join')return; await Auth.logout(); }
          catch(e2) { if(btn){btn.disabled=false;btn.textContent=this._mode==='join'?'Request to join workspace':'Create account';} this._showErr(errEl,'Email already registered. Check your password.'); return; }
        } else {
          if(btn){btn.disabled=false;btn.textContent=this._mode==='join'?'Request to join workspace':'Create account';}
          this._showErr(errEl, Auth.errorMessage(authErr.code)); return;
        }
      }

      if (this._mode === 'join' && this._inviteData) {
        await Auth.logout().catch(()=>{});
        const { collection, addDoc, serverTimestamp } =
          await import('https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js');
        await addDoc(collection(window.fbDB,'joinRequests'), {
          uid, name, email, phone,
          companyId:    this._inviteData.companyId,
          companyName:  this._inviteData.companyName,
          workspaceKey: this._inviteData.key,
          status:       'pending',
          createdAt:    serverTimestamp(),
        });
        const c = document.getElementById('auth-container');
        c.innerHTML = `<div style="width:100%;max-width:440px;padding:24px 20px;font-family:Inter,sans-serif;margin:auto;">
          <div style="background:white;border:1px solid #E2E8F0;border-radius:16px;padding:44px 32px;text-align:center;box-shadow:0 2px 16px rgba(0,0,0,0.06);">
            <div style="width:56px;height:56px;background:#F0FDF4;border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 16px;">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#16A34A" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <h3 style="font-size:19px;font-weight:800;color:#0F172A;margin:0 0 8px;">Request submitted!</h3>
            <p style="font-size:13.5px;color:#64748B;line-height:1.7;margin:0 0 24px;">Your request to join <strong>${this._inviteData.companyName}</strong> is pending.<br/>The admin will assign you a role and approve access.</p>
            <a href="#/login" style="display:inline-block;padding:12px 32px;background:#1D4ED8;color:white;border-radius:10px;font-weight:700;font-size:14px;text-decoration:none;">Go to login</a>
          </div>
        </div>`;
      }
      // If 'new' — auth state change will handle routing to dashboard
    } catch(e) {
      if(btn){btn.disabled=false;btn.textContent=this._mode==='join'?'Request to join workspace':'Create account';}
      this._showErr(errEl, 'Error: '+e.message);
    }
  },

  _showErr(el, msg) {
    if (!el) return;
    el.style.display = 'flex';
    const txt = document.getElementById('su-err-text');
    if (txt) txt.textContent = msg;
    else el.textContent = msg;
  },
};
export default SignupPage;