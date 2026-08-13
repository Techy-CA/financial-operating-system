/**
 * ConnectionStatus.js — Live network + replay-queue indicator
 *
 * Stays out of the way while everything is fine, and becomes loud the moment
 * the line drops — because the one thing a cashier must never wonder is whether
 * the sale they just took actually saved.
 */

import Offline from '../core/offline.js';
import Icon    from '../utils/icons.js';

const ConnectionStatus = {
  _el: null, _unsub: null,

  mount() {
    if (this._el) return;

    const el = document.createElement('div');
    el.id = '__conn-status';
    el.className = 'conn-pill';
    document.body.appendChild(el);
    this._el = el;

    Offline.start();
    this._unsub = Offline.subscribe(s => this._render(s));
  },

  _render(s) {
    const el = this._el;
    if (!el) return;

    // Online and nothing waiting — say nothing at all
    if (s.online && s.pending === 0 && !s.flushing) {
      el.className = 'conn-pill';
      el.innerHTML = '';
      return;
    }

    if (!s.online) {
      el.className = 'conn-pill show offline';
      el.innerHTML = `
        <span class="conn-dot"></span>
        <span class="conn-text">
          <strong>Offline — billing continues</strong>
          ${s.pending ? `<small>${s.pending} change${s.pending === 1 ? '' : 's'} saved on this device</small>`
                      : `<small>Sales are saved locally and sync automatically</small>`}
        </span>`;
      return;
    }

    if (s.flushing) {
      el.className = 'conn-pill show syncing';
      el.innerHTML = `
        <span class="conn-spin"></span>
        <span class="conn-text"><strong>Syncing…</strong><small>${s.pending} left</small></span>`;
      return;
    }

    // Back online with work still queued
    el.className = 'conn-pill show pending';
    el.innerHTML = `
      <span class="conn-dot"></span>
      <span class="conn-text">
        <strong>${s.pending} change${s.pending === 1 ? '' : 's'} to sync</strong>
        <small>Reconnected — replaying now</small>
      </span>
      <button class="conn-btn" onclick="__Offline.flush()">${Icon.refresh(12)} Retry</button>`;
  },

  unmount() {
    this._unsub?.();
    this._el?.remove();
    this._el = null;
  },
};

export default ConnectionStatus;
