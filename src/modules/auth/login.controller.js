import Auth from '../../core/auth.js';

const LoginPage = {
  init() {
    const c = document.getElementById('auth-container');
    c.style.cssText = 'display:flex;width:100%;min-height:100vh;';
    c.innerHTML = `
    <style>
      .lp { display:flex; width:100%; min-height:100vh; font-family:'Inter',sans-serif; }

      /* LEFT */
      .lp-left {
        flex:1; background:linear-gradient(160deg,#0B1220 0%,#101827 55%,#0D1420 100%);
        display:flex; flex-direction:column;
        justify-content:space-between; padding:48px 56px; position:relative; overflow:hidden;
      }
      .lp-left-bg {
        position:absolute; inset:0;
        background: radial-gradient(ellipse 60% 45% at 10% 100%, rgba(59,130,246,0.14) 0%, transparent 65%),
                    linear-gradient(rgba(255,255,255,0.035) 1px, transparent 1px),
                    linear-gradient(90deg, rgba(255,255,255,0.035) 1px, transparent 1px);
        background-size: auto, 42px 42px, 42px 42px;
        pointer-events:none;
      }

      .lp-brand { display:flex; align-items:center; gap:10px; position:relative; z-index:1; }
      .lp-brand-name { font-size:19px; font-weight:700; color:#F8FAFC; letter-spacing:-0.3px; }

      .lp-hero { position:relative; z-index:1; }
      .lp-h1 {
        font-size:32px; font-weight:700; color:#F8FAFC; line-height:1.22;
        letter-spacing:-0.6px; margin-bottom:14px; max-width:380px;
      }
      .lp-sub { font-size:14.5px; color:#94A3B8; line-height:1.65; max-width:340px; margin-bottom:36px; }

      .lp-chips { display:flex; flex-direction:column; gap:13px; }
      .lp-chip {
        display:flex; align-items:center; gap:11px;
        font-size:13px; color:#CBD5E1;
      }
      .lp-chip-dot {
        width:16px; height:16px; border-radius:5px;
        background:rgba(59,130,246,0.14); border:1px solid rgba(96,165,250,0.3);
        display:flex; align-items:center; justify-content:center;
        flex-shrink:0;
      }
      .lp-chip-dot svg { width:9px; height:9px; }

      .lp-footer { position:relative; z-index:1; font-size:11.5px; color:#64748B; padding-top:20px; border-top:1px solid rgba(255,255,255,0.08); }

      /* RIGHT */
      .lp-right {
        width:460px; flex-shrink:0; background:white;
        display:flex; flex-direction:column; justify-content:center;
        padding:52px 48px; border-left:1px solid #E2E8F0; min-height:100vh;
      }
      .lp-form-logo { display:flex; align-items:center; gap:9px; margin-bottom:28px; }
      .lp-form-logo-name { font-size:17px; font-weight:700; color:#0F172A; }

      .lp-form-h2 { font-size:22px; font-weight:800; color:#0F172A; letter-spacing:-0.5px; margin-bottom:4px; }
      .lp-form-sub { font-size:13px; color:#64748B; margin-bottom:26px; }

      .lp-google {
        width:100%; display:flex; align-items:center; justify-content:center; gap:9px;
        padding:10px 16px; border:1.5px solid #E2E8F0; border-radius:9px;
        background:white; font-size:13.5px; font-weight:500; color:#0F172A;
        cursor:pointer; margin-bottom:18px; transition:all 0.12s; font-family:inherit;
        box-shadow:0 1px 3px rgba(0,0,0,0.05);
      }
      .lp-google:hover { border-color:#94A3B8; background:#F8FAFC; }

      .lp-divider { display:flex; align-items:center; gap:10px; margin-bottom:18px; }
      .lp-divider-line { flex:1; height:1px; background:#E2E8F0; }
      .lp-divider-txt { font-size:11.5px; color:#94A3B8; }

      .lp-label { font-size:12.5px; font-weight:600; color:#374151; display:block; margin-bottom:5px; }
      .lp-input {
        width:100%; padding:10px 12px; border:1.5px solid #E2E8F0; border-radius:8px;
        font-size:13.5px; font-family:inherit; color:#0F172A; outline:none;
        transition:all 0.12s; box-sizing:border-box; background:white;
      }
      .lp-input::placeholder { color:#94A3B8; }
      .lp-input:focus { border-color:#3B82F6; box-shadow:0 0 0 3px rgba(59,130,246,0.12); }
      .lp-pass-wrap { position:relative; }
      .lp-pass-wrap .lp-input { padding-right:38px; }
      .lp-eye { position:absolute; right:10px; top:50%; transform:translateY(-50%); background:none; border:none; cursor:pointer; color:#94A3B8; padding:2px; display:flex; }
      .lp-eye:hover { color:#64748B; }

      .lp-err { display:none; background:#FEF2F2; border:1px solid #FECACA; border-radius:7px; padding:9px 12px; font-size:12.5px; color:#991B1B; margin-bottom:12px; margin-top:10px; }

      .lp-btn {
        width:100%; padding:11px; border:none; border-radius:9px;
        font-size:14px; font-weight:700; cursor:pointer; transition:all 0.12s; font-family:inherit;
        background:#1D4ED8; color:white; box-shadow:0 3px 10px rgba(29,78,216,0.25); margin-top:14px;
        letter-spacing:0.1px;
      }
      .lp-btn:hover { background:#1E40AF; box-shadow:0 5px 16px rgba(29,78,216,0.35); transform:translateY(-1px); }
      .lp-btn:active { transform:none; }
      .lp-btn:disabled { opacity:0.6; cursor:not-allowed; transform:none; }

      .lp-foot { text-align:center; font-size:12.5px; color:#64748B; margin-top:18px; }
      .lp-foot a { color:#1D4ED8; font-weight:600; text-decoration:none; }

      @media (max-width:720px) {
        .lp-left { display:none; }
        .lp-right { width:100%; padding:32px 24px; }
      }
    </style>

    <div class="lp">
      <!-- LEFT PANEL -->
      <div class="lp-left">
        <div class="lp-left-bg"></div>

        <div class="lp-brand">
          <span class="lp-brand-name">FinOS</span>
        </div>

        <div class="lp-hero">
          <h1 class="lp-h1">The Financial OS for Indian Businesses.</h1>
          <p class="lp-sub">Built for GST, invoicing, cashflow & accounting. Real-time visibility for SMEs and growing teams.</p>

          <div class="lp-chips">
            ${[
              'GST-compliant invoicing (CGST · SGST · IGST)',
              'Collections, expenses & vendor payments',
              'P&L, cash flow & reports in seconds',
              'Multi-company · team roles · Indian FY',
            ].map(t => `
              <div class="lp-chip">
                <div class="lp-chip-dot">
                  <svg viewBox="0 0 24 24" fill="none" stroke="#60A5FA" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                </div>
                ${t}
              </div>
            `).join('')}
          </div>
        </div>

        <div class="lp-footer">© 2026 FinOS. All rights reserved.</div>
      </div>

      <!-- RIGHT PANEL — form -->
      <div class="lp-right">
        <div class="lp-form-logo">
          <span class="lp-form-logo-name">FinOS</span>
        </div>

        <h2 class="lp-form-h2">Sign in to FinOS.</h2>
        <p class="lp-form-sub">New to FinOS? <a href="#/signup" style="color:#1D4ED8;font-weight:600;text-decoration:none;">Create your workspace</a></p>

        <button id="btn-google" class="lp-google">
          <svg width="17" height="17" viewBox="0 0 24 24" style="flex-shrink:0;">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          Continue with Google
        </button>

        <div class="lp-divider">
          <div class="lp-divider-line"></div>
          <span class="lp-divider-txt">or with</span>
          <div class="lp-divider-line"></div>
        </div>

        <form id="lp-form" novalidate>
          <div style="margin-bottom:14px;">
            <label class="lp-label">Email</label>
            <input id="l-email" class="lp-input" type="email" placeholder="you@company.com" autocomplete="email" />
          </div>
          <div>
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:5px;">
              <label class="lp-label" style="margin:0;">Password</label>
              <a href="#/forgot-password" style="font-size:12px;color:#1D4ED8;text-decoration:none;font-weight:500;">Forgot password?</a>
            </div>
            <div class="lp-pass-wrap">
              <input id="l-pass" class="lp-input" type="password" placeholder="••••••••" autocomplete="current-password" />
              <button type="button" class="lp-eye" id="tog-eye">
                <svg id="eye-svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
              </button>
            </div>
          </div>

          <div id="l-err" class="lp-err"></div>
          <button type="submit" class="lp-btn" id="btn-login">Sign In</button>
        </form>

        <p class="lp-foot" style="margin-top:22px;border-top:1px solid #F1F5F9;padding-top:16px;font-size:11px;color:#94A3B8;display:flex;align-items:center;justify-content:center;gap:6px;">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><rect x="3" y="11" width="18" height="10" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          Secure sign-in &nbsp;·&nbsp; Made in India &nbsp;·&nbsp; GST compliant
        </p>
      </div>
    </div>`;

    // Eye toggle
    document.getElementById('tog-eye')?.addEventListener('click', () => {
      const inp = document.getElementById('l-pass');
      const svg = document.getElementById('eye-svg');
      if (inp.type === 'password') {
        inp.type = 'text';
        svg.innerHTML = `<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/>`;
      } else {
        inp.type = 'password';
        svg.innerHTML = `<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>`;
      }
    });

    // Google
    document.getElementById('btn-google')?.addEventListener('click', async e => {
      const btn = e.currentTarget; btn.disabled = true; btn.textContent = 'Connecting…';
      try { await Auth.loginWithGoogle(); }
      catch(err) {
        btn.disabled = false;
        btn.innerHTML = `<svg width="17" height="17" viewBox="0 0 24 24" style="flex-shrink:0;"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>Continue with Google`;
        this._err(Auth.errorMessage(err.code));
      }
    });

    // Email
    document.getElementById('lp-form')?.addEventListener('submit', async e => {
      e.preventDefault();
      const email = document.getElementById('l-email').value.trim();
      const pass  = document.getElementById('l-pass').value;
      const btn   = document.getElementById('btn-login');
      if (!email || !pass) { this._err('Enter your email and password.'); return; }
      btn.disabled = true; btn.textContent = 'Signing in…'; this._hideErr();
      try { await Auth.loginWithEmail(email, pass); }
      catch(err) { btn.disabled = false; btn.textContent = 'Sign In'; this._err(Auth.errorMessage(err.code)); }
    });
  },
  _err(m) { const e=document.getElementById('l-err'); if(e){e.textContent=m;e.style.display='block';} },
  _hideErr() { const e=document.getElementById('l-err'); if(e)e.style.display='none'; },
};
export default LoginPage;
