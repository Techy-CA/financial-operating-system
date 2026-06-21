/**
 * company.service.js
 * Fixed: getUserCompanies now also checks companies where ownerId == uid
 * so founders always see ALL their companies even if companyUsers entry is missing.
 */

async function sdk() {
  const m = await import('https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js');
  return { ...m, db: window.fbDB };
}

function clean(obj) {
  const o = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined && v !== null && v !== '') o[k] = v;
  }
  return o;
}

const CompanyService = {

  async getUserCompanies(uid) {
    if (!uid) return [];
    try {
      const f  = await sdk();
      const db = f.db;

      // Query 1: companies where user is in companyUsers collection
      const q1   = f.query(f.collection(db, 'companyUsers'), f.where('uid', '==', uid));
      const snap1 = await f.getDocs(q1);

      // Query 2: companies where ownerId == uid (catches companies created before companyUsers entry)
      const q2    = f.query(f.collection(db, 'companies'), f.where('ownerId', '==', uid));
      const snap2 = await f.getDocs(q2);

      // Build a map of companyId → role from companyUsers
      const roleMap = {};
      snap1.docs.forEach(d => {
        const data = d.data();
        roleMap[data.companyId] = data.role || 'founder';
      });

      // Collect all unique company IDs
      const companyIds = new Set([
        ...snap1.docs.map(d => d.data().companyId).filter(Boolean),
        ...snap2.docs.map(d => d.id),
      ]);

      if (companyIds.size === 0) return [];

      // Fetch all company docs
      const companies = await Promise.all(
        [...companyIds].map(async (cid) => {
          try {
            const cSnap = await f.getDoc(f.doc(db, 'companies', cid));
            if (!cSnap.exists()) return null;
            const role = roleMap[cid] || (cSnap.data().ownerId === uid ? 'founder' : 'member');
            return { id: cSnap.id, role, ...cSnap.data() };
          } catch { return null; }
        })
      );

      return companies.filter(Boolean);

    } catch(e) {
      console.warn('[CompanyService] getUserCompanies:', e.message);
      return [];
    }
  },

  async getCompanyUser(companyId, uid) {
    try {
      const f  = await sdk();
      const db = f.db;

      // Try members subcollection first
      const mSnap = await f.getDoc(f.doc(db, 'companies', companyId, 'members', uid));
      if (mSnap.exists()) return mSnap.data();

      // Try companyUsers collection
      const q = f.query(
        f.collection(db, 'companyUsers'),
        f.where('companyId', '==', companyId),
        f.where('uid', '==', uid)
      );
      const s = await f.getDocs(q);
      if (!s.empty) return s.docs[0].data();

      // Check if owner
      const cSnap = await f.getDoc(f.doc(db, 'companies', companyId));
      if (cSnap.exists() && cSnap.data().ownerId === uid) {
        return { uid, role: 'founder' };
      }

      return null;
    } catch { return null; }
  },

  async create(uid, companyData) {
    const f  = await sdk();
    const db = f.db;

    const data = clean({
      name:               companyData.name    || 'My Company',
      gstin:              companyData.gstin?.toUpperCase() || null,
      pan:                companyData.pan?.toUpperCase()   || null,
      email:              companyData.email   || null,
      phone:              companyData.phone   || null,
      website:            companyData.website || null,
      state:              companyData.state   || null,
      address:            companyData.address || null,
      city:               companyData.city    || null,
      pincode:            companyData.pincode || null,
      ownerId:            uid,
      invoicePrefix:      companyData.invoicePrefix     || 'INV',
      defaultCreditDays:  parseInt(companyData.defaultCreditDays) || 30,
      defaultTerms:       companyData.defaultTerms      || null,
      defaultNotes:       companyData.defaultNotes      || null,
    });

    // Create company
    const ref       = await f.addDoc(f.collection(db, 'companies'), clean({ ...data, createdAt: f.serverTimestamp(), updatedAt: f.serverTimestamp() }));
    const companyId = ref.id;

    // Add founder to members subcollection
    await f.setDoc(f.doc(db, 'companies', companyId, 'members', uid), clean({
      uid, role: 'founder', joinedAt: f.serverTimestamp(),
    }));

    // Add to companyUsers collection (used for cross-company queries)
    await f.addDoc(f.collection(db, 'companyUsers'), clean({
      uid, companyId, role: 'founder', joinedAt: f.serverTimestamp(),
    }));

    return companyId;
  },

  async update(companyId, companyData) {
    const f = await sdk();
    await f.updateDoc(
      f.doc(f.db, 'companies', companyId),
      clean({ ...companyData, updatedAt: f.serverTimestamp() })
    );
  },

  // Add a member to a company (used when processing invites)
  async addMember(companyId, memberUid, email, role) {
    const f  = await sdk();
    const db = f.db;

    await f.setDoc(f.doc(db, 'companies', companyId, 'members', memberUid), clean({
      uid: memberUid, email, role, joinedAt: f.serverTimestamp(),
    }));

    await f.addDoc(f.collection(db, 'companyUsers'), clean({
      uid: memberUid, email, companyId, role, joinedAt: f.serverTimestamp(),
    }));
  },
};

export default CompanyService;
