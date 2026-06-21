/**
 * expenses.service.js
 */

import DB from '../../services/firestore.js';

const ExpensesService = {
  async getAll(filters = {}) {
    const constraints = [];
    if (filters.category) constraints.push(DB.where('category', '==', filters.category));
    if (filters.startDate) constraints.push(DB.where('expenseDate', '>=', filters.startDate));
    if (filters.endDate)   constraints.push(DB.where('expenseDate', '<=', filters.endDate));
    constraints.push(DB.orderBy('expenseDate', 'desc'));
    return DB.getAll('expenses', constraints);
  },

  async getById(id) { return DB.getOne('expenses', id); },

  async create(data) { return DB.create('expenses', data); },

  async update(id, data) { return DB.update('expenses', id, data); },

  async delete(id) { return DB.delete('expenses', id); },

  async getCategorySummary(fy) {
    const expenses = await this.getAll({ startDate: fy.start, endDate: fy.end });
    const map = {};
    expenses.forEach(e => {
      map[e.category] = (map[e.category] || 0) + (e.amount || 0);
    });
    return map;
  },
};

export default ExpensesService;
