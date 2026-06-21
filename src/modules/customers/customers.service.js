/**
 * customers.service.js
 */

import DB from '../../services/firestore.js';

const CustomersService = {
  async getAll(search = '') {
    const customers = await DB.getAll('customers', [DB.orderBy('name', 'asc')]);
    if (!search) return customers;
    const q = search.toLowerCase();
    return customers.filter(c =>
      c.name?.toLowerCase().includes(q) ||
      c.gstin?.toLowerCase().includes(q) ||
      c.email?.toLowerCase().includes(q) ||
      c.phone?.includes(q)
    );
  },

  async getById(id) {
    return DB.getOne('customers', id);
  },

  async create(data) {
    return DB.create('customers', { ...data, totalBilled: 0, totalReceived: 0 });
  },

  async update(id, data) {
    return DB.update('customers', id, data);
  },

  async delete(id) {
    return DB.delete('customers', id);
  },

  async getStats(customerId) {
    const [invoices, payments] = await Promise.all([
      DB.getAll('invoices', [DB.where('customerId', '==', customerId)]),
      DB.getAll('payments', [DB.where('customerId', '==', customerId)]),
    ]);
    return {
      totalInvoiced:  invoices.reduce((s, i) => s + (i.grandTotal || 0), 0),
      totalReceived:  payments.reduce((s, p) => s + (p.amount || 0), 0),
      invoiceCount:   invoices.length,
      overdueCount:   invoices.filter(i => i.status === 'overdue').length,
    };
  },
};

export default CustomersService;
