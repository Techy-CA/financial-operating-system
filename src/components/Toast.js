/**
 * Toast.js
 * Lightweight toast notification system.
 * Usage: Toast.success('Invoice created') / Toast.error('Failed to save')
 */
import Icon from '../utils/icons.js';

const Toast = {
  _container: null,

  _getContainer() {
    if (!this._container) {
      this._container = document.getElementById('toast-container');
    }
    return this._container;
  },

  show({ message, type = 'info', duration = 4000, action = null }) {
    const container = this._getContainer();
    if (!container) return;

    const icons = {
      success: Icon.checkCircle(17),
      error:   Icon.x(17),
      warning: Icon.alertTriangle(17),
      info:    Icon.info(17),
    };

    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.setAttribute('role', 'alert');
    el.innerHTML = `
      <i aria-hidden="true" style="display:flex;">${icons[type] || icons.info}</i>
      <span class="toast-message">${message}</span>
      ${action ? `<button class="btn btn-sm btn-ghost toast-action">${action.label}</button>` : ''}
      <button class="toast-close" aria-label="Dismiss" style="background:none;border:none;display:flex;">${Icon.x(14)}</button>
    `;

    // Action handler
    if (action) {
      el.querySelector('.toast-action').addEventListener('click', () => {
        action.onClick?.();
        this._remove(el);
      });
    }

    // Close handler
    el.querySelector('.toast-close').addEventListener('click', () => this._remove(el));

    container.appendChild(el);

    // Auto dismiss
    if (duration > 0) {
      setTimeout(() => this._remove(el), duration);
    }

    return el;
  },

  success(message, opts = {}) {
    return this.show({ message, type: 'success', ...opts });
  },

  error(message, opts = {}) {
    return this.show({ message, type: 'error', duration: 6000, ...opts });
  },

  warning(message, opts = {}) {
    return this.show({ message, type: 'warning', ...opts });
  },

  info(message, opts = {}) {
    return this.show({ message, type: 'info', ...opts });
  },

  _remove(el) {
    if (!el || !el.parentNode) return;
    el.style.opacity = '0';
    el.style.transform = 'translateX(16px)';
    el.style.transition = 'all 200ms ease';
    setTimeout(() => el.parentNode?.removeChild(el), 200);
  },

  clear() {
    const container = this._getContainer();
    if (container) container.innerHTML = '';
  },
};

export default Toast;
