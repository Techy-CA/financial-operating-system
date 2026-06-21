const Auth = {
  onStateChange(callback) {
    import('https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js')
      .then(({ onAuthStateChanged }) => onAuthStateChanged(window.fbAuth, callback));
  },

  async loginWithEmail(email, password) {
    const { signInWithEmailAndPassword } = await import('https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js');
    const cred = await signInWithEmailAndPassword(window.fbAuth, email, password);
    return cred.user;
  },

  async loginWithGoogle() {
    const { signInWithPopup, GoogleAuthProvider } = await import('https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js');
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    const cred = await signInWithPopup(window.fbAuth, provider);
    return cred.user;
  },

  async signup(email, password, displayName) {
    const { createUserWithEmailAndPassword, updateProfile } = await import('https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js');
    const cred = await createUserWithEmailAndPassword(window.fbAuth, email, password);
    await updateProfile(cred.user, { displayName });
    return cred.user;
  },

  async resetPassword(email) {
    const { sendPasswordResetEmail } = await import('https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js');
    await sendPasswordResetEmail(window.fbAuth, email);
  },

  async logout() {
    const { signOut } = await import('https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js');
    await signOut(window.fbAuth);
  },

  currentUser() { return window.fbAuth?.currentUser || null; },

  errorMessage(code) {
    const m = {
      'auth/user-not-found':        'No account with this email.',
      'auth/wrong-password':        'Wrong password.',
      'auth/email-already-in-use':  'Email already in use.',
      'auth/weak-password':         'Password must be at least 6 characters.',
      'auth/invalid-email':         'Invalid email address.',
      'auth/too-many-requests':     'Too many attempts. Try again later.',
      'auth/network-request-failed':'No internet connection.',
      'auth/popup-closed-by-user':  'Sign-in popup closed.',
      'auth/invalid-credential':    'Invalid email or password.',
    };
    return m[code] || 'Something went wrong. Try again.';
  },
};
export default Auth;
