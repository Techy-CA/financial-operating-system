/**
 * dashboard.service.js
 * Aggregates all data needed for the Founder Dashboard.
 * Single place to fetch all KPIs — fast, parallel queries.
 */

import DB             from '../../services/firestore.js';
import Store          from '../../core/store.js';
import InvoiceService from '../invoices/invoices.service.js';

const DashboardService = {

  /**
   * Load all dashboard data in parallel.
   * Returns everything the dashboard needs in one call.
   */
  async loadAll() {
    const fy = Store.get('fy');

    const [
      revenueStats,
      outstandingData,
      overdueData,
      recentPayments,
      upcomingDues,
      topCustomers,
      gstSummary,
      expenseSummary,
      recentActivity,
    ] = await Promise.all([
      this.getRevenueStats(fy),
      this.getOutstanding(),
      this.getOverdue(),
      this.getRecentPayments(5),
      this.getUpcomingDues(7),
      this.getTopCustomers(5),
      this.getGSTSummary(fy),
      this.getExpenseSummary(fy),
      this.getRecentActivity(8),
    ]);

    return {
      revenueStats,
      outstandingData,
      overdueData,
      recentPayments,
      upcomingDues,
      topCustomers,
      gstSummary,
      expenseSummary,
      recentActivity,
    };
  },

  async getRevenueStats(fy) {
    // This month
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const monthEnd   = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

    const [thisMonthPaid, fyPaid] = await Promise.all([
      DB.getAll('invoices', [
        DB.where('status', 'in', ['paid', 'partial']),
        DB.where('invoiceDate', '>=', monthStart),
        DB.where('invoiceDate', '<=', monthEnd),
      ]),
      DB.getAll('invoices', [
        DB.where('status', 'in', ['paid', 'partial']),
        DB.where('invoiceDate', '>=', fy.start),
        DB.where('invoiceDate', '<=', fy.end),
      ]),
    ]);

    const thisMonth = thisMonthPaid.reduce((s, i) => s + (i.paidAmount || 0), 0);
    const fyTotal   = fyPaid.reduce((s, i) => s + (i.paidAmount || 0), 0);

    // Today
    const today = new Date().toISOString().split('T')[0];
    const todayPayments = await DB.getAll('payments', [
      DB.where('paymentDate', '>=', today),
      DB.where('paymentDate', '<=', today),
    ]);
    const todayRevenue = todayPayments.reduce((s, p) => s + (p.amount || 0), 0);

    return { thisMonth, fyTotal, todayRevenue };
  },

  async getOutstanding() {
    const invoices = await DB.getAll('invoices', [
      DB.where('status', 'in', ['sent', 'partial']),
    ]);
    const total = invoices.reduce((s, i) => s + (i.balanceDue || 0), 0);
    return { total, count: invoices.length, invoices };
  },

  async getOverdue() {
    const invoices = await DB.getAll('invoices', [
      DB.where('status', '==', 'overdue'),
    ]);
    const total = invoices.reduce((s, i) => s + (i.balanceDue || 0), 0);
    return { total, count: invoices.length, invoices };
  },

  async getRecentPayments(n = 5) {
    return DB.getAll('payments', [
      DB.orderBy('createdAt', 'desc'),
      DB.limit(n),
    ]);
  },

  async getUpcomingDues(days = 7) {
    const today  = new Date().toISOString().split('T')[0];
    const future = new Date(Date.now() + days * 86400000).toISOString().split('T')[0];

    return DB.getAll('invoices', [
      DB.where('status', 'in', ['sent', 'partial']),
      DB.where('dueDate', '>=', today),
      DB.where('dueDate', '<=', future),
      DB.orderBy('dueDate', 'asc'),
    ]);
  },

  async getTopCustomers(n = 5) {
    const fy = Store.get('fy');
    const invoices = await DB.getAll('invoices', [
      DB.where('invoiceDate', '>=', fy.start),
      DB.where('invoiceDate', '<=', fy.end),
    ]);

    // Aggregate by customer
    const map = {};
    invoices.forEach(inv => {
      if (!inv.customerId) return;
      if (!map[inv.customerId]) {
        map[inv.customerId] = {
          customerId:   inv.customerId,
          customerName: inv.customerName || 'Unknown',
          total:        0,
          invoiceCount: 0,
        };
      }
      map[inv.customerId].total        += inv.grandTotal || 0;
      map[inv.customerId].invoiceCount += 1;
    });

    return Object.values(map)
      .sort((a, b) => b.total - a.total)
      .slice(0, n);
  },

  async getGSTSummary(fy) {
    const [gstRecords, expenses] = await Promise.all([
      DB.getAll('gstRecords', [
        DB.where('period', '>=', fy.start),
        DB.where('period', '<=', fy.end),
      ]),
      DB.getAll('expenses', [
        DB.where('category', '==', 'gst'),
        DB.where('expenseDate', '>=', fy.start),
        DB.where('expenseDate', '<=', fy.end),
      ]),
    ]);

    const collected = gstRecords.reduce((s, r) => s + (r.gstCollected || 0), 0);
    const itc       = gstRecords.reduce((s, r) => s + (r.itc || 0), 0);
    const paid      = expenses.reduce((s, e) => s + (e.amount || 0), 0);
    const payable   = Math.max(0, collected - itc - paid);

    return { collected, itc, paid, payable };
  },

  async getExpenseSummary(fy) {
    const expenses = await DB.getAll('expenses', [
      DB.where('expenseDate', '>=', fy.start),
      DB.where('expenseDate', '<=', fy.end),
    ]);

    const total = expenses.reduce((s, e) => s + (e.amount || 0), 0);

    // Group by category
    const byCategory = {};
    expenses.forEach(e => {
      const cat = e.category || 'other';
      byCategory[cat] = (byCategory[cat] || 0) + (e.amount || 0);
    });

    const topCategories = Object.entries(byCategory)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([cat, amount]) => ({ category: cat, amount }));

    return { total, topCategories };
  },

  async getRecentActivity(n = 8) {
    return DB.getAll('activityLogs', [
      DB.orderBy('createdAt', 'desc'),
      DB.limit(n),
    ]);
  },

  async getCashBalance() {
    const accounts = await DB.getAll('bankAccounts');
    return accounts.reduce((s, a) => s + (a.balance || 0), 0);
  },

  async getBusinessHealthScore() {
    // Simple weighted score — 0 to 100
    const [outstanding, overdue, gst] = await Promise.all([
      this.getOutstanding(),
      this.getOverdue(),
      this.getGSTSummary(Store.get('fy')),
    ]);

    let score = 85; // start healthy

    // Deduct for overdue receivables
    if (overdue.count > 5)  score -= 15;
    else if (overdue.count > 2) score -= 8;

    // Deduct for high outstanding ratio
    if (outstanding.total > 0 && overdue.total / outstanding.total > 0.4) score -= 10;

    // Deduct for unpaid GST
    if (gst.payable > 500000) score -= 5;

    return Math.max(0, Math.min(100, score));
  },
};

export default DashboardService;
