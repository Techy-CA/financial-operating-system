const _state = {
  user: null, userProfile: null, company: null, companyId: null,
  companies: [], fy: null, role: null, permissions: {}, loading: false,
};
const _subs = {};

const Store = {
  get(key)      { return _state[key]; },
  getAll()      { return { ..._state }; },

  set(key, val) {
    _state[key] = val;
    (_subs[key] || []).forEach(fn => fn(val, _state));
    (_subs['*']  || []).forEach(fn => fn(key, val, _state));
  },

  setMany(updates) {
    Object.entries(updates).forEach(([k, v]) => { _state[k] = v; });
    Object.keys(updates).forEach(k => (_subs[k]||[]).forEach(fn => fn(updates[k], _state)));
    (_subs['*']||[]).forEach(fn => fn('batch', updates, _state));
  },

  subscribe(key, fn) {
    if (!_subs[key]) _subs[key] = [];
    _subs[key].push(fn);
    return () => { _subs[key] = _subs[key].filter(f => f !== fn); };
  },

  isLoggedIn() { return !!_state.user; },
  isFounder()  { return _state.role === 'founder'; },

  can(module, action) {
    const role = _state.role;
    if (!role) return false;
    if (role === 'founder' || role === 'admin') return true; // Full access
    return !!_state.permissions?.[module]?.[action];
  },

  getFY()      { return _state.fy; },
  getFYLabel() { return _state.fy?.label || 'FY 2025-26'; },

  reset() {
    Object.keys(_state).forEach(k => {
      _state[k] = k === 'companies' ? [] : k === 'permissions' ? {} : k === 'loading' ? false : null;
    });
    (_subs['*']||[]).forEach(fn => fn('reset', null, _state));
  },
};

export default Store;

// Expose globally for cross-module access
window.__Store = Store;
