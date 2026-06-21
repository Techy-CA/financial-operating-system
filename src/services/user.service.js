async function sdk() {
  const m = await import('https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js');
  return { ...m, db: window.fbDB };
}
function clean(obj) {
  const out = {};
  for (const [k,v] of Object.entries(obj)) { if (v !== undefined) out[k] = v; }
  return out;
}
const UserService = {
  async getOrCreate(user) {
    try {
      const f    = await sdk();
      const ref  = f.doc(f.db, 'users', user.uid);
      const snap = await f.getDoc(ref);
      if (snap.exists()) return { id: snap.id, ...snap.data() };
      const profile = clean({ uid: user.uid, displayName: user.displayName||'', email: user.email||'', photoURL: user.photoURL||null });
      await f.setDoc(ref, clean({ ...profile, createdAt: f.serverTimestamp() }));
      return { id: user.uid, ...profile };
    } catch(e) {
      console.warn('[UserService]', e.message);
      return { id: user.uid, displayName: user.displayName||'', email: user.email||'' };
    }
  },
};
export default UserService;
