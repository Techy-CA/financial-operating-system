import Auth from '../../core/auth.js';

const ForgotPasswordPage = {
  init() {
    const c = document.getElementById('auth-container');
    c.style.cssText = 'display:flex;width:100%;min-height:100vh;align-items:center;justify-content:center;background:#F8FAFC;';
    c.innerHTML = `
    <div style="width:100%;max-width:420px;padding:24px;font-family:Inter,sans-serif;">
      <div style="text-align:center;margin-bottom:28px;">
        <div style="width:52px;height:52px;background:linear-gradient(135deg,#1A56DB,#6366F1);border-radius:14px;display:flex;align-items:center;justify-content:center;margin:0 auto 18px;box-shadow:0 4px 16px rgba(26,86,219,0.3);">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
        </div>
        <h2 style="font-size:23px;font-weight:800;color:#0F172A;letter-spacing:-0.5px;margin-bottom:7px;">Reset your password</h2>
        <p style="font-size:14px;color:#64748B;line-height:1.6;">Enter your email and we'll send you a secure reset link</p>
      </div>

      <div style="background:white;border:1px solid #E2E8F0;border-radius:14px;padding:30px;box-shadow:0 2px 16px rgba(0,0,0,0.06);">
        <div id="success-msg" style="display:none;background:#F0FFF4;border:1px solid #86EFAC;border-radius:10px;padding:14px 16px;margin-bottom:18px;display:none;align-items:center;gap:10px;">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#16A34A" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          <span style="font-size:13.5px;color:#15803D;font-weight:500;">Reset link sent — check your inbox!</span>
        </div>

        <form id="fp-form" novalidate>
          <div style="margin-bottom:18px;">
            <label style="display:block;font-size:13px;font-weight:600;color:#374151;margin-bottom:7px;">Email address</label>
            <input id="fp-email" type="email" placeholder="you@company.com" autocomplete="email"
              style="width:100%;padding:11px 14px;border:1.5px solid #E2E8F0;border-radius:9px;font-size:14px;font-family:Inter,sans-serif;color:#0F172A;outline:none;transition:all 0.15s;box-sizing:border-box;"
              onfocus="this.style.borderColor='#1A56DB';this.style.boxShadow='0 0 0 3px rgba(26,86,219,0.1)'"
              onblur="this.style.borderColor='#E2E8F0';this.style.boxShadow='none'" />
          </div>
          <div id="fp-error" style="display:none;background:#FEF2F2;border:1px solid #FECACA;border-radius:8px;padding:10px 13px;font-size:12.5px;color:#991B1B;margin-bottom:14px;"></div>
          <button type="submit" id="fp-btn"
            style="width:100%;padding:12px;background:linear-gradient(135deg,#1A56DB,#2563EB);color:white;border:none;border-radius:10px;font-size:14px;font-weight:700;cursor:pointer;font-family:Inter,sans-serif;box-shadow:0 4px 12px rgba(26,86,219,0.3);">
            Send reset link
          </button>
        </form>
      </div>

      <p style="text-align:center;margin-top:20px;font-size:13px;color:#64748B;">
        <a href="#/login" style="color:#1A56DB;font-weight:600;text-decoration:none;">← Back to sign in</a>
      </p>
    </div>`;

    document.getElementById('fp-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('fp-email').value.trim();
      const btn   = document.getElementById('fp-btn');
      const errEl = document.getElementById('fp-error');
      const sucEl = document.getElementById('success-msg');
      if (!email) { errEl.textContent='Enter your email address.'; errEl.style.display='block'; return; }
      btn.disabled=true; btn.textContent='Sending…'; errEl.style.display='none';
      try {
        await Auth.resetPassword(email);
        sucEl.style.display='flex';
        btn.textContent='Resend link'; btn.disabled=false;
      } catch(err) {
        const msgs={'auth/user-not-found':'No account with this email.','auth/invalid-email':'Invalid email address.'};
        errEl.textContent=msgs[err.code]||'Failed to send reset link.';
        errEl.style.display='block'; btn.disabled=false; btn.textContent='Send reset link';
      }
    });
  },
};
export default ForgotPasswordPage;
