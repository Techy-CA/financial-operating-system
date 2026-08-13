/**
 * payroll.service.js — Staff, attendance and salary
 *
 * Attendance is stored one document per staff member per month
 * (`attendance/{staffId}_{YYYY-MM}`) holding a day-keyed map. A month of marks
 * is then one read instead of thirty, which is what makes the register grid
 * feel instant even on a slow connection.
 *
 * Salary is computed, never stored half-done: a payroll run records the inputs
 * (days, rate, overtime, advances) alongside the result, so an old payslip can
 * still be explained months later even after the staff member's rate changes.
 */

import Store from '../../core/store.js';
import DB    from '../../services/firestore.js';
import { ATTENDANCE_STATUS } from '../../utils/constants.js';

const COL_STAFF    = 'staff';
const COL_ATT      = 'attendance';
const COL_ADVANCES = 'staffAdvances';
const COL_RUNS     = 'payrollRuns';

const num  = (v) => { const n = parseFloat(v); return isNaN(n) ? 0 : n; };
const mRnd = (v) => Math.round(num(v) * 100) / 100;

function companyId() {
  const cid = Store.get('companyId');
  if (!cid) throw new Error('No company selected. Go to Settings to set up your company.');
  return cid;
}

export function monthKey(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function daysInMonth(key) {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m, 0).getDate();
}

export function monthLabel(key) {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
}

const PayrollService = {

  async waitForCompany(timeout = 5000) {
    const step = 150;
    for (let waited = 0; waited < timeout; waited += step) {
      if (Store.get('companyId')) return true;
      await new Promise(r => setTimeout(r, step));
    }
    return !!Store.get('companyId');
  },

  // ── STAFF ────────────────────────────────────────────────────────────────
  async listStaff(includeInactive = false) {
    const rows = await DB.getAll(COL_STAFF, []).catch(() => []);
    return rows
      .filter(s => includeInactive || s.isActive !== false)
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  },

  getStaff(id) { return DB.getOne(COL_STAFF, id); },

  saveStaff(id, data) {
    const payload = {
      ...data,
      salary:     mRnd(data.salary),
      otRate:     mRnd(data.otRate),
      companyId:  companyId(),
    };
    return id ? DB.update(COL_STAFF, id, payload) : DB.create(COL_STAFF, payload);
  },

  /** Staff are deactivated, not deleted — their past payslips must stay valid. */
  deactivateStaff(id) { return DB.update(COL_STAFF, id, { isActive: false, exitDate: new Date().toISOString().split('T')[0] }); },
  reactivateStaff(id) { return DB.update(COL_STAFF, id, { isActive: true, exitDate: null }); },

  // ── ATTENDANCE ───────────────────────────────────────────────────────────
  _attId(staffId, month) { return `${staffId}_${month}`; },

  async getMonth(staffId, month) {
    const doc = await DB.getOne(COL_ATT, this._attId(staffId, month)).catch(() => null);
    return { days: doc?.days || {}, ot: doc?.ot || {}, staffId, month };
  },

  /** Whole-month attendance for everyone, keyed by staff id. */
  async getMonthAll(staffIds, month) {
    const results = await Promise.all(
      staffIds.map(id => this.getMonth(id, month).catch(() => ({ days: {}, ot: {}, staffId: id, month })))
    );
    return Object.fromEntries(results.map(r => [r.staffId, r]));
  },

  /** Marks one day. Passing null clears the mark. */
  async mark(staffId, month, day, status) {
    const id  = this._attId(staffId, month);
    const cur = await this.getMonth(staffId, month);
    const days = { ...cur.days };
    if (status) days[String(day)] = status;
    else delete days[String(day)];
    await DB.set(COL_ATT, id, { staffId, month, days, ot: cur.ot, companyId: companyId() });
    return days;
  },

  async setOvertime(staffId, month, day, hours) {
    const id  = this._attId(staffId, month);
    const cur = await this.getMonth(staffId, month);
    const ot  = { ...cur.ot };
    if (num(hours) > 0) ot[String(day)] = num(hours);
    else delete ot[String(day)];
    await DB.set(COL_ATT, id, { staffId, month, days: cur.days, ot, companyId: companyId() });
    return ot;
  },

  /** Fills every unmarked day up to today with one status — the "mark all present" shortcut. */
  async fillMonth(staffId, month, status, onlyEmpty = true) {
    const cur   = await this.getMonth(staffId, month);
    const total = daysInMonth(month);
    const now   = new Date();
    const isCurrentMonth = month === monthKey(now);
    const lastDay = isCurrentMonth ? now.getDate() : total;

    const days = { ...cur.days };
    for (let d = 1; d <= lastDay; d++) {
      if (onlyEmpty && days[String(d)]) continue;
      days[String(d)] = status;
    }
    await DB.set(COL_ATT, this._attId(staffId, month), { staffId, month, days, ot: cur.ot, companyId: companyId() });
    return days;
  },

  /** Counts each mark and the payable-day total for a month. */
  summariseMonth(record, month) {
    const days  = record?.days || {};
    const ot    = record?.ot   || {};
    const counts = Object.fromEntries(Object.keys(ATTENDANCE_STATUS).map(k => [k, 0]));
    let paidDays = 0;

    for (const status of Object.values(days)) {
      if (!ATTENDANCE_STATUS[status]) continue;
      counts[status] += 1;
      paidDays += ATTENDANCE_STATUS[status].payFactor;
    }

    const otHours = Object.values(ot).reduce((s, h) => s + num(h), 0);
    return {
      counts,
      paidDays:   Math.round(paidDays * 100) / 100,
      markedDays: Object.keys(days).length,
      totalDays:  daysInMonth(month),
      otHours:    Math.round(otHours * 100) / 100,
    };
  },

  // ── ADVANCES ─────────────────────────────────────────────────────────────
  async listAdvances(staffId = null) {
    const rows = await DB.getAll(COL_ADVANCES, []).catch(() => []);
    const list = staffId ? rows.filter(a => a.staffId === staffId) : rows;
    return list.sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
  },

  giveAdvance({ staffId, staffName, amount, date, notes }) {
    return DB.create(COL_ADVANCES, {
      staffId, staffName,
      amount:    mRnd(amount),
      recovered: 0,
      date:      date || new Date().toISOString().split('T')[0],
      notes:     notes || null,
      companyId: companyId(),
    });
  },

  /** Advance still to be recovered from future salary. */
  outstandingAdvance(advances) {
    return mRnd((advances || []).reduce((s, a) => s + (num(a.amount) - num(a.recovered)), 0));
  },

  /** Applies a recovery across the oldest advances first. */
  async recoverAdvance(staffId, amount) {
    let left = mRnd(amount);
    if (left <= 0) return;
    const rows = (await this.listAdvances(staffId)).slice().reverse(); // oldest first
    for (const a of rows) {
      if (left <= 0) break;
      const due = mRnd(num(a.amount) - num(a.recovered));
      if (due <= 0) continue;
      const take = Math.min(due, left);
      await DB.update(COL_ADVANCES, a.id, { recovered: mRnd(num(a.recovered) + take) });
      left = mRnd(left - take);
    }
  },

  // ── SALARY CALCULATION ───────────────────────────────────────────────────
  /**
   * Works out one staff member's pay for a month.
   *
   * Monthly staff are paid pro-rata on calendar days, which is the convention
   * PagarBook and most Indian small businesses use: salary ÷ days-in-month ×
   * payable days. Daily and hourly staff are paid on what they actually worked.
   */
  computeSalary(staff, summary, { advanceOutstanding = 0, recoverAdvance = 0, bonus = 0, otherDeduction = 0 } = {}) {
    const type    = staff.salaryType || 'monthly';
    const rate    = num(staff.salary);
    const days    = summary.totalDays || 30;
    const paid    = summary.paidDays  || 0;
    const otHours = summary.otHours   || 0;

    let base = 0, perDay = 0, workedLabel = '';
    if (type === 'monthly') {
      perDay = mRnd(rate / days);
      base   = mRnd(perDay * paid);
      workedLabel = `${paid} of ${days} days`;
    } else if (type === 'daily') {
      perDay = rate;
      base   = mRnd(rate * paid);
      workedLabel = `${paid} days`;
    } else if (type === 'hourly') {
      // Hourly staff are paid purely on recorded hours
      base   = mRnd(rate * otHours);
      perDay = rate;
      workedLabel = `${otHours} hours`;
    } else { // piece rate — units are recorded as overtime hours on the register
      base   = mRnd(rate * otHours);
      perDay = rate;
      workedLabel = `${otHours} units`;
    }

    // Overtime only applies where hours are extra to a day rate
    const otRate = num(staff.otRate) || (type === 'monthly' ? mRnd(perDay / 8) : 0);
    const otPay  = (type === 'hourly' || type === 'piece') ? 0 : mRnd(otRate * otHours);

    const gross     = mRnd(base + otPay + num(bonus));
    const recovery  = mRnd(Math.min(num(recoverAdvance), num(advanceOutstanding), gross));
    const deduction = mRnd(recovery + num(otherDeduction));
    const net       = mRnd(gross - deduction);

    return {
      salaryType: type, rate, perDay, workedLabel,
      paidDays: paid, totalDays: days, otHours, otRate,
      base, otPay, bonus: mRnd(bonus),
      gross, advanceRecovered: recovery, otherDeduction: mRnd(otherDeduction),
      totalDeduction: deduction, net: Math.max(0, net),
      advanceOutstanding: mRnd(advanceOutstanding),
    };
  },

  // ── PAYROLL RUNS ─────────────────────────────────────────────────────────
  async listRuns(month = null) {
    const rows = await DB.getAll(COL_RUNS, []).catch(() => []);
    const list = month ? rows.filter(r => r.month === month) : rows;
    return list.sort((a, b) => String(b.month || '').localeCompare(String(a.month || '')));
  },

  /**
   * Records a payslip and, when marked paid, books the salary as an expense so
   * it lands in P&L and cash flow without anyone re-keying it.
   */
  async savePayslip({ staff, month, breakdown, status = 'paid', paymentMethod = 'cash', notes }) {
    const existing = (await this.listRuns(month)).find(r => r.staffId === staff.id);

    const payload = {
      staffId:   staff.id,
      staffName: staff.name,
      month,
      monthLabel: monthLabel(month),
      ...breakdown,
      status,
      paymentMethod,
      paidDate: status === 'paid' ? new Date().toISOString().split('T')[0] : null,
      notes: notes || null,
      companyId: companyId(),
    };

    const runId = existing
      ? (await DB.update(COL_RUNS, existing.id, payload), existing.id)
      : await DB.create(COL_RUNS, payload);

    if (status === 'paid') {
      if (breakdown.advanceRecovered > 0) {
        await this.recoverAdvance(staff.id, breakdown.advanceRecovered).catch(() => {});
      }
      // Only book the expense once, even if the payslip is re-saved
      if (!existing || existing.status !== 'paid') {
        await DB.create('expenses', {
          category:    'salary',
          description: `Salary — ${staff.name} · ${monthLabel(month)}`,
          amount:      breakdown.net,
          expenseDate: payload.paidDate,
          paymentMethod,
          vendorName:  staff.name,
          refType:     'payroll',
          refId:       runId,
        }).catch(() => {});
      }
    }

    return runId;
  },

  deleteRun(id) { return DB.delete(COL_RUNS, id); },

  /** Month-level totals for the payroll header. */
  runStats(runs) {
    const paid = (runs || []).filter(r => r.status === 'paid');
    return {
      count:      (runs || []).length,
      paidCount:  paid.length,
      grossTotal: mRnd((runs || []).reduce((s, r) => s + num(r.gross), 0)),
      netTotal:   mRnd((runs || []).reduce((s, r) => s + num(r.net), 0)),
      paidTotal:  mRnd(paid.reduce((s, r) => s + num(r.net), 0)),
    };
  },
};

export default PayrollService;
