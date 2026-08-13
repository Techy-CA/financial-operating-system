/**
 * attendance.controller.js — Monthly attendance register
 *
 * One row per staff member, one cell per day. Clicking a cell cycles through
 * Present → Half day → Absent → clear, which is far faster at a counter than
 * opening a picker for each of thirty days. Writes are optimistic: the cell
 * flips immediately and rolls back only if Firestore rejects it.
 */

import Router from '../../core/router.js';
import Toast  from '../../components/Toast.js';
import Icon   from '../../utils/icons.js';
import PayrollService, { monthKey, monthLabel, daysInMonth } from './payroll.service.js';
import { initials, avatarColor } from '../../utils/formatters.js';
import { ATTENDANCE_STATUS, ATTENDANCE_ORDER } from '../../utils/constants.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// The quick-cycle order used when a cell is clicked
const CYCLE = ['present', 'half_day', 'absent', null];

const AttendancePage = {
  _month: monthKey(), _staff: [], _records: {}, _busy: false,

  async init() {
    window.AttendancePage = this;
    Router.render(`
      <div class="page-header">
        <div class="page-header-left"><h1>Attendance</h1><p id="at-sub">Loading…</p></div>
        <div class="page-header-actions">
          <button class="btn btn-secondary btn-sm" onclick="AttendancePage.shiftMonth(-1)">‹ Prev</button>
          <input id="at-month" class="input" type="month" value="${this._month}" style="width:150px;" onchange="AttendancePage.setMonth(this.value)" />
          <button class="btn btn-secondary btn-sm" onclick="AttendancePage.shiftMonth(1)">Next ›</button>
          <a href="#/payroll" class="btn btn-primary btn-sm">${Icon.wallet(14)} Run payroll</a>
        </div>
      </div>
      <div id="at-legend" class="att-legend"></div>
      <div class="card" id="at-body"><div style="padding:40px;text-align:center;"><div class="spinner-sm"></div></div></div>
    `);

    if (!(await PayrollService.waitForCompany())) {
      document.getElementById('at-body').innerHTML = `<div class="empty-state"><h3>No company selected</h3><p>Set up your company in Settings first.</p></div>`;
      return;
    }

    this._renderLegend();
    await this._load();
  },

  _renderLegend() {
    const el = document.getElementById('at-legend');
    if (!el) return;
    el.innerHTML = ATTENDANCE_ORDER.map(k => {
      const s = ATTENDANCE_STATUS[k];
      return `<span class="att-legend-item"><span class="att-chip" style="background:${s.bg};color:${s.color};">${s.short}</span>${esc(s.label)}</span>`;
    }).join('') + `<span class="att-legend-hint">Click a cell to cycle P → ½ → A → clear · right-click for all options</span>`;
  },

  setMonth(m) { if (m) { this._month = m; this._load(); } },

  shiftMonth(by) {
    const [y, m] = this._month.split('-').map(Number);
    const d = new Date(y, m - 1 + by, 1);
    this._month = monthKey(d);
    const input = document.getElementById('at-month');
    if (input) input.value = this._month;
    this._load();
  },

  async _load() {
    const body = document.getElementById('at-body');
    if (body) body.innerHTML = `<div style="padding:40px;text-align:center;"><div class="spinner-sm"></div></div>`;

    this._staff = await PayrollService.listStaff().catch(() => []);
    if (this._staff.length === 0) {
      body.innerHTML = `<div class="empty-state">
        <div class="empty-state-icon">${Icon.users(24)}</div>
        <h3>No active staff</h3>
        <p>Add your team first — then their attendance shows up here.</p>
        <a href="#/staff" class="btn btn-primary">Add staff</a>
      </div>`;
      return;
    }

    this._records = await PayrollService.getMonthAll(this._staff.map(s => s.id), this._month);
    this._render();
  },

  _render() {
    const total = daysInMonth(this._month);
    const [y, m] = this._month.split('-').map(Number);
    const now = new Date();
    const isCurrent = this._month === monthKey(now);
    const todayDate = isCurrent ? now.getDate() : -1;

    const sub = document.getElementById('at-sub');
    if (sub) sub.textContent = `${monthLabel(this._month)} · ${this._staff.length} staff`;

    const dayHeads = [];
    for (let d = 1; d <= total; d++) {
      const wd = new Date(y, m - 1, d).getDay();
      const isSun = wd === 0;
      dayHeads.push(`<th class="att-dh ${isSun ? 'sun' : ''} ${d === todayDate ? 'today' : ''}">
        <span>${d}</span><small>${['S','M','T','W','T','F','S'][wd]}</small>
      </th>`);
    }

    document.getElementById('at-body').innerHTML = `
      <div class="att-scroll">
        <table class="att-table">
          <thead>
            <tr>
              <th class="att-name-col">Staff</th>
              ${dayHeads.join('')}
              <th class="att-sum-col">Paid days</th>
            </tr>
          </thead>
          <tbody>
            ${this._staff.map(s => this._rowHTML(s, total, todayDate, y, m)).join('')}
          </tbody>
        </table>
      </div>
      <div class="card-footer" style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
        <span style="font-size:12px;color:var(--text-tertiary);">Bulk fill for everyone:</span>
        <button class="btn btn-secondary btn-sm" onclick="AttendancePage.fillAll('present')">Mark all present</button>
        <button class="btn btn-secondary btn-sm" onclick="AttendancePage.fillAll('week_off')">Fill blanks as week off</button>
      </div>`;
  },

  _rowHTML(s, total, todayDate, y, m) {
    const rec = this._records[s.id] || { days: {}, ot: {} };
    const sum = PayrollService.summariseMonth(rec, this._month);
    const col = avatarColor(s.name || '');

    const cells = [];
    for (let d = 1; d <= total; d++) {
      const st  = rec.days[String(d)];
      const cfg = st ? ATTENDANCE_STATUS[st] : null;
      const isSun = new Date(y, m - 1, d).getDay() === 0;
      cells.push(`<td class="att-cell ${isSun ? 'sun' : ''} ${d === todayDate ? 'today' : ''}">
        <button class="att-mark" id="att-${s.id}-${d}"
                style="${cfg ? `background:${cfg.bg};color:${cfg.color};` : ''}"
                onclick="AttendancePage.cycle('${s.id}',${d})"
                oncontextmenu="AttendancePage.pick(event,'${s.id}',${d})"
                title="${cfg ? esc(cfg.label) : 'Not marked'}">${cfg ? cfg.short : ''}</button>
      </td>`);
    }

    return `<tr>
      <td class="att-name-col">
        <div class="table-entity">
          <div class="table-entity-avatar" style="background:${col.bg};color:${col.text};">${esc(initials(s.name || '?'))}</div>
          <div><div class="table-entity-name">${esc(s.name || '—')}</div>
          <div class="table-entity-sub">${esc(s.role || '')}</div></div>
        </div>
      </td>
      ${cells.join('')}
      <td class="att-sum-col"><strong id="att-sum-${s.id}">${sum.paidDays}</strong><small>/ ${total}</small></td>
    </tr>`;
  },

  /** Click cycles through the three everyday marks, then clears. */
  async cycle(staffId, day) {
    const rec  = this._records[staffId] || { days: {}, ot: {} };
    const cur  = rec.days[String(day)] || null;
    const idx  = CYCLE.indexOf(cur);
    const next = CYCLE[(idx + 1) % CYCLE.length];
    await this._apply(staffId, day, next);
  },

  /** Right-click opens the full set, including leave and holiday. */
  pick(event, staffId, day) {
    event.preventDefault();
    document.getElementById('__att-menu')?.remove();

    const menu = document.createElement('div');
    menu.id = '__att-menu';
    menu.className = 'att-menu';
    menu.style.cssText = `top:${event.clientY}px;left:${event.clientX}px;`;
    menu.innerHTML = ATTENDANCE_ORDER.map(k => {
      const s = ATTENDANCE_STATUS[k];
      return `<button onclick="AttendancePage.setMark('${staffId}',${day},'${k}')">
        <span class="att-chip" style="background:${s.bg};color:${s.color};">${s.short}</span>${esc(s.label)}
      </button>`;
    }).join('') + `<button onclick="AttendancePage.setMark('${staffId}',${day},'')"><span class="att-chip">—</span>Clear</button>`;

    document.body.appendChild(menu);
    const close = (e) => { if (!menu.contains(e.target)) { menu.remove(); document.removeEventListener('click', close); } };
    setTimeout(() => document.addEventListener('click', close), 0);
    return false;
  },

  setMark(staffId, day, status) {
    document.getElementById('__att-menu')?.remove();
    this._apply(staffId, day, status || null);
  },

  /** Paints the cell first, then persists — a slow network shouldn't stall marking. */
  async _apply(staffId, day, status) {
    const rec = this._records[staffId] || (this._records[staffId] = { days: {}, ot: {} });
    const prev = rec.days[String(day)] || null;

    if (status) rec.days[String(day)] = status;
    else delete rec.days[String(day)];

    this._paintCell(staffId, day, status);
    this._paintSummary(staffId);

    try {
      await PayrollService.mark(staffId, this._month, day, status);
    } catch (e) {
      if (prev) rec.days[String(day)] = prev; else delete rec.days[String(day)];
      this._paintCell(staffId, day, prev);
      this._paintSummary(staffId);
      Toast.error('Could not save: ' + e.message);
    }
  },

  _paintCell(staffId, day, status) {
    const btn = document.getElementById(`att-${staffId}-${day}`);
    if (!btn) return;
    const cfg = status ? ATTENDANCE_STATUS[status] : null;
    btn.textContent = cfg ? cfg.short : '';
    btn.style.background = cfg ? cfg.bg : '';
    btn.style.color      = cfg ? cfg.color : '';
    btn.title = cfg ? cfg.label : 'Not marked';
  },

  _paintSummary(staffId) {
    const el = document.getElementById(`att-sum-${staffId}`);
    if (!el) return;
    el.textContent = PayrollService.summariseMonth(this._records[staffId], this._month).paidDays;
  },

  async fillAll(status) {
    const label = ATTENDANCE_STATUS[status]?.label || status;
    if (!confirm(`Fill every unmarked day this month as "${label}" for all ${this._staff.length} staff?`)) return;
    if (this._busy) return;
    this._busy = true;
    Toast.info('Filling attendance…');
    try {
      for (const s of this._staff) {
        const days = await PayrollService.fillMonth(s.id, this._month, status, true);
        this._records[s.id] = { ...(this._records[s.id] || { ot: {} }), days };
      }
      this._render();
      Toast.success('Attendance filled');
    } catch (e) {
      Toast.error('Failed: ' + e.message);
    } finally { this._busy = false; }
  },
};

export default AttendancePage;
