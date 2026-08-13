/**
 * firestore.js — Bulletproof Firestore layer
 * - Strips undefined values before every write
 * - Lazy loads Firebase SDK
 * - Works with or without companyId
 */

import Store from '../core/store.js';

// Remove undefined/null fields so Firestore never throws
function clean(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) out[k] = v;
  }
  return out;
}

async function sdk() {
  const m = await import('https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js');
  return { ...m, db: window.fbDB };
}

function colPath(name) {
  const cid = Store.get('companyId');
  if (!cid) throw new Error('No company selected. Go to Settings to set up your company.');
  return `companies/${cid}/${name}`;
}

function buildConstraints(f, raw) {
  return (raw || []).map(c => {
    if (!c || !c._type) return null;
    if (c._type === 'where')   return f.where(c.field, c.op, c.value);
    if (c._type === 'orderBy') return f.orderBy(c.field, c.dir || 'asc');
    if (c._type === 'limit')   return f.limit(c.n);
    return null;
  }).filter(Boolean);
}

const DB = {
  // Constraint builders — synchronous, used in arrays
  where(field, op, value)    { return { _type:'where',   field, op, value }; },
  orderBy(field, dir='asc')  { return { _type:'orderBy', field, dir }; },
  limit(n)                   { return { _type:'limit',   n }; },

  // ── READ ──────────────────────────────────────────────────────
  async getOne(colName, docId) {
    const f    = await sdk();
    const path = colPath(colName).split('/');
    const ref  = f.doc(f.db, ...path, docId);
    const snap = await f.getDoc(ref);
    return snap.exists() ? { id: snap.id, ...snap.data() } : null;
  },

  async getAll(colName, constraints = []) {
    const f    = await sdk();
    const path = colPath(colName).split('/');
    const ref  = f.collection(f.db, ...path);
    const cs   = buildConstraints(f, constraints);
    const q    = cs.length ? f.query(ref, ...cs) : f.query(ref);
    const snap = await f.getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },

  // ── WRITE ─────────────────────────────────────────────────────
  async create(colName, data) {
    const f    = await sdk();
    const path = colPath(colName).split('/');
    const ref  = f.collection(f.db, ...path);
    const uid  = Store.get('user')?.uid || null;
    const doc  = await f.addDoc(ref, clean({
      ...data,
      createdAt: f.serverTimestamp(),
      updatedAt: f.serverTimestamp(),
      createdBy: uid,
    }));
    return doc.id;
  },

  /**
   * Creates without waiting for the server.
   *
   * addDoc() only settles once the write is acknowledged, which never happens
   * while offline — awaiting it would freeze the caller mid-sale. Here the
   * document ID is generated on the client and the write is issued but not
   * awaited, so the record exists locally (and reads back immediately) whether
   * or not there is a connection. The returned `synced` promise resolves when
   * the server has it, for callers that care.
   */
  async createLocal(colName, data) {
    const f    = await sdk();
    const path = colPath(colName).split('/');
    const ref  = f.doc(f.collection(f.db, ...path));
    const uid  = Store.get('user')?.uid || null;

    const synced = f.setDoc(ref, clean({
      ...data,
      createdAt: f.serverTimestamp(),
      updatedAt: f.serverTimestamp(),
      createdBy: uid,
    }));
    synced.catch(() => {});   // offline rejections are expected — the cache retries

    return { id: ref.id, synced };
  },

  async update(colName, docId, data) {
    const f    = await sdk();
    const path = colPath(colName).split('/');
    const ref  = f.doc(f.db, ...path, docId);
    const uid  = Store.get('user')?.uid || null;
    await f.updateDoc(ref, clean({
      ...data,
      updatedAt: f.serverTimestamp(),
      updatedBy: uid,
    }));
  },

  async set(colName, docId, data) {
    const f    = await sdk();
    const path = colPath(colName).split('/');
    const ref  = f.doc(f.db, ...path, docId);
    await f.setDoc(ref, clean({ ...data, updatedAt: f.serverTimestamp() }), { merge: true });
  },

  async delete(colName, docId) {
    const f    = await sdk();
    const path = colPath(colName).split('/');
    const ref  = f.doc(f.db, ...path, docId);
    await f.deleteDoc(ref);
  },

  // ── GLOBAL (not company-scoped) ───────────────────────────────
  async getGlobal(path, docId) {
    const f    = await sdk();
    const parts = path.split('/');
    const ref  = f.doc(f.db, ...parts, docId);
    const snap = await f.getDoc(ref);
    return snap.exists() ? { id: snap.id, ...snap.data() } : null;
  },

  async setGlobal(path, docId, data) {
    const f     = await sdk();
    const parts = path.split('/');
    const ref   = f.doc(f.db, ...parts, docId);
    await f.setDoc(ref, clean({ ...data, updatedAt: f.serverTimestamp() }), { merge: true });
  },

  async batchUpdate(colName, updates) {
    const f     = await sdk();
    const batch = f.writeBatch(f.db);
    const path  = colPath(colName).split('/');
    updates.forEach(({ id, data }) => {
      const ref = f.doc(f.db, ...path, id);
      batch.update(ref, clean({ ...data, updatedAt: f.serverTimestamp() }));
    });
    await batch.commit();
  },

  toDate(ts) { return ts?.toDate?.() || null; },
};

export default DB;
