/**
 * offline.js — Deterministic degradation and replay
 *
 * Firestore's offline cache handles plain document writes on its own: the write
 * lands in IndexedDB immediately and syncs later. Two things it cannot do
 * offline are what this module covers:
 *
 *   1. `runTransaction` needs a live server, so anything that reads-then-writes
 *      (stock balances, register tallies, number counters) simply hangs.
 *   2. `addDoc`'s promise only settles on server acknowledgement, so awaiting it
 *      offline blocks the caller forever.
 *
 * The rule here: a sale must never be blocked by the network. Documents are
 * written with client-generated IDs and not awaited; the derived work that
 * needs a transaction is queued to localStorage and replayed in order once the
 * connection returns. Replay is idempotent — the stock engine posts only the
 * difference between what a document needs and what it has already booked, so
 * a task running twice is harmless.
 */

const KEY      = 'finos_offline_queue';
const SEQ_KEY  = 'finos_offline_seq';

const listeners = new Set();

function read() {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]'); }
  catch { return []; }
}

function write(tasks) {
  localStorage.setItem(KEY, JSON.stringify(tasks));
  listeners.forEach(fn => { try { fn(Offline.status()); } catch {} });
}

const Offline = {
  _flushing: false,
  _started:  false,

  isOnline() { return navigator.onLine !== false; },

  /** Queue depth and connection state — what the status pill renders from. */
  status() {
    const tasks = read();
    return {
      online:   this.isOnline(),
      pending:  tasks.length,
      sales:    tasks.filter(t => t.type === 'stockSync').length,
      flushing: this._flushing,
    };
  },

  subscribe(fn) {
    listeners.add(fn);
    fn(this.status());
    return () => listeners.delete(fn);
  },

  _notify() { listeners.forEach(fn => { try { fn(this.status()); } catch {} }); },

  /** Adds work to be replayed when the connection returns. */
  push(type, payload) {
    const tasks = read();
    tasks.push({ id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, type, payload, at: new Date().toISOString() });
    write(tasks);
    return tasks.length;
  },

  clear() { write([]); },

  /**
   * Offline bill numbers come from a local counter and carry a distinct suffix,
   * so they can never collide with a number the server counter hands out.
   */
  localNumber(prefix) {
    const n = (parseInt(localStorage.getItem(SEQ_KEY) || '0', 10) || 0) + 1;
    localStorage.setItem(SEQ_KEY, String(n));
    return `${prefix}-OFF${String(n).padStart(3, '0')}`;
  },

  /**
   * Replays the queue oldest-first, stopping at the first failure so ordering
   * is preserved. A task that throws stays queued for the next attempt.
   */
  async flush() {
    if (this._flushing || !this.isOnline()) return { done: 0, left: read().length };
    const tasks = read();
    if (tasks.length === 0) return { done: 0, left: 0 };

    this._flushing = true;
    this._notify();

    let done = 0;
    try {
      for (const task of tasks) {
        try {
          await this._run(task);
          done++;
        } catch (e) {
          console.warn('[Offline] replay failed, will retry:', task.type, e.message);
          break;                                   // keep order — stop on first failure
        }
      }
      write(read().slice(done));
    } finally {
      this._flushing = false;
      this._notify();
    }

    return { done, left: read().length };
  },

  async _run(task) {
    if (task.type === 'stockSync') {
      const { default: Inventory } = await import('../modules/inventory/inventory.service.js');
      const { invoice, items } = task.payload;
      await Inventory.syncInvoiceStock(invoice, items);
      return;
    }
    if (task.type === 'registerPost') {
      const { default: Pos } = await import('../modules/pos/pos.service.js');
      const { registerId, grandTotal, payments } = task.payload;
      await Pos._postToRegister(registerId, { grandTotal, payments });
      return;
    }
    throw new Error(`Unknown offline task: ${task.type}`);
  },

  /** Binds the connection listeners once, and drains anything left from last time. */
  start() {
    if (this._started) return;
    this._started = true;

    window.addEventListener('online',  () => { this._notify(); this.flush(); });
    window.addEventListener('offline', () => this._notify());

    // A queue can survive a reload — drain it on the next boot
    if (this.isOnline()) setTimeout(() => this.flush(), 1500);
  },
};

window.__Offline = Offline;
export default Offline;
