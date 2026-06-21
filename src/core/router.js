/**
 * router.js — Hash-based SPA router
 */

import Store from './store.js';

const routes = {};
let _beforeEach = null;
let _started    = false;

const Router = {

  on(path, handler, meta = {}) {
    routes[path] = { handler, meta };
    return this;
  },

  beforeEach(fn) {
    _beforeEach = fn;
    return this;
  },

  navigate(path, replace = false) {
    if (replace) {
      history.replaceState(null, '', '#' + path);
      this._resolve();
    } else {
      window.location.hash = path;
    }
  },

  currentPath() {
    return window.location.hash.slice(1) || '/dashboard';
  },

  start(defaultPath) {
    if (_started) return;
    _started = true;

    window.addEventListener('hashchange', () => this._resolve());

    // If no hash yet, set default
    if (!window.location.hash || window.location.hash === '#') {
      history.replaceState(null, '', '#' + (defaultPath || '/dashboard'));
    }

    this._resolve();
  },

  async _resolve() {
    const rawPath = this.currentPath();

    // Match route
    let matched = null;
    let params  = {};

    for (const [pattern, route] of Object.entries(routes)) {
      const result = this._matchPath(pattern, rawPath);
      if (result) {
        matched = route;
        params  = result.params;
        break;
      }
    }

    // Fallback to 404
    if (!matched) {
      matched = routes['/404'] || routes['/dashboard'];
    }

    if (!matched) {
      console.warn('[Router] No route matched and no fallback for:', rawPath);
      return;
    }

    // Run guard
    if (_beforeEach) {
      const ok = await _beforeEach(rawPath, matched.meta || {});
      if (!ok) return;
    }

    // Page title
    if (matched.meta?.title) {
      document.title = `${matched.meta.title} — FinOS`;
    }

    // Scroll to top
    const content = document.getElementById('page-content');
    if (content) content.scrollTop = 0;

    // Update sidebar active state
    this._updateActive(rawPath);

    // Run handler
    try {
      await matched.handler({ params, path: rawPath });
    } catch (err) {
      console.error('[Router] Handler error:', err);
      this.render(`
        <div class="empty-state" style="padding-top:80px;">
          <div class="empty-state-icon"><i class="ti ti-alert-triangle"></i></div>
          <h3>Page failed to load</h3>
          <p style="color:var(--color-danger);font-size:12px;">${err.message}</p>
          <button class="btn btn-primary" onclick="location.reload()">Reload</button>
        </div>
      `);
    }
  },

  _matchPath(pattern, path) {
    const pp = pattern.split('/').filter(Boolean);
    const rp = path.split('/').filter(Boolean);
    if (pp.length !== rp.length) return null;

    const params = {};
    for (let i = 0; i < pp.length; i++) {
      if (pp[i].startsWith(':')) {
        params[pp[i].slice(1)] = decodeURIComponent(rp[i]);
      } else if (pp[i] !== rp[i]) {
        return null;
      }
    }
    return { params };
  },

  _updateActive(path) {
    document.querySelectorAll('.sidebar-item[data-route]').forEach(el => {
      const route = el.dataset.route;
      const isActive = route && (path === route || (route !== '/' && path.startsWith(route + '/')));
      el.classList.toggle('active', !!isActive);
    });
  },

  render(html) {
    const content = document.getElementById('page-content');
    if (content) {
      content.innerHTML = `<div class="page-inner fade-in">${html}</div>`;
    }
  },
};

export default Router;
