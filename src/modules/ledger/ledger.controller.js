import Router from '../../core/router.js';
import Store  from '../../core/store.js';
import Toast  from '../../components/Toast.js';
import { formatCurrency, formatCurrencyShort, formatDate } from '../../utils/formatters.js';
import Icon from '../../utils/icons.js';

const LedgerPage = {
  _entries: [],

  async init() {
    Router.render(`<div class="page-header"><div class="page-header-left"><h1>Ledger</h1></div></div><div class="skeleton" style="height:400px;border-radius:12px;margin-top:16px;"></div>`);

    let invoices=[], payments=[], expenses=[];
    try {
      const { default: DB } = await import('../../services/firestore.js');
      [invoices, payments, expenses] = await Promise.all([
        DB.getAll('invoices', []).catch(()=>[]),
        DB.getAll('payments', []).catch(()=>[]),
        DB.getAll('expenses', []).catch(()=>[]),
      ]);
    } catch(e) { console.warn('[Ledger]', e.message); }

    // Build journal from all 3 sources
    const entries = [];

    invoices.filter(i => i.status !== 'draft').forEach(inv => {
      entries.push({
        date:        inv.invoiceDate || '',
        type:        'Invoice',
        ref:         inv.invoiceNumber || inv.id?.slice(-6) || '',
        description: `Invoice to ${inv.customerName||'Unknown'}${inv.invoiceCategory?' · '+inv.invoiceCategory:''}`,
        debit:       inv.grandTotal || 0,
        credit:      0,
        tag:         'income',
        linkId:      inv.id,
        deletable:   false, // delete from Invoices page
      });
    });

    payments.forEach(pay => {
      entries.push({
        id:          pay.id,
        date:        pay.paymentDate || '',
        type:        'Payment',
        ref:         pay.reference  || pay.id?.slice(-6) || '',
        description: `Payment from ${pay.customerName||'Customer'} via ${pay.method||'—'}`,
        debit:       0,
        credit:      pay.amount || 0,
        tag:         'receipt',
        deletable:   true,  // can delete orphan payments here
        invoiceId:   pay.invoiceId,
      });
    });

    expenses.forEach(exp => {
      entries.push({
        id:          exp.id,
        date:        exp.expenseDate || '',
        type:        'Expense',
        ref:         exp.reference  || exp.id?.slice(-6) || '',
        description: `${exp.category||'Expense'}: ${exp.description||'—'}${exp.vendorName?' ('+exp.vendorName+')':''}`,
        debit:       0,
        credit:      exp.amount || 0,
        tag:         'expense',
        deletable:   true,
        editHref:    `#/expenses/${exp.id}/edit`,
      });
    });

    // Sort newest first
    entries.sort((a,b) => new Date(b.date||0) - new Date(a.date||0));

    // Running balance (oldest → newest → reverse)
    let balance = 0;
    const withBalance = [...entries].reverse().map(e => {
      if (e.tag === 'income')   balance += e.debit;
      if (e.tag === 'receipt')  balance += e.credit;
      if (e.tag === 'expense')  balance -= e.credit;
      return { ...e, balance };
    }).reverse();

    this._entries = withBalance;
    const totalInvoiced = entries.filter(e=>e.tag==='income').reduce((s,e)=>s+(e.debit||0),0);
    const totalReceived = entries.filter(e=>e.tag==='receipt').reduce((s,e)=>s+(e.credit||0),0);
    const totalExpenses = entries.filter(e=>e.tag==='expense').reduce((s,e)=>s+(e.credit||0),0);

    Router.render(`
      <div class="page-header">
        <div class="page-header-left"><h1>Ledger</h1><p>Auto-generated from invoices, payments &amp; expenses</p></div>
        <div class="page-header-actions">
          <button class="btn btn-secondary btn-sm" onclick="LedgerPage.exportCSV()">${Icon.download(14)} Export CSV</button>
        </div>
      </div>

      <div class="grid-3 mb-5">
        <div class="metric-card"><div class="metric-label">Total invoiced</div><div class="metric-value">₹${formatCurrencyShort(totalInvoiced)}</div><div class="metric-subtext">${entries.filter(e=>e.tag==='income').length} invoices</div></div>
        <div class="metric-card"><div class="metric-label">Payments received</div><div class="metric-value success">₹${formatCurrencyShort(totalReceived)}</div></div>
        <div class="metric-card"><div class="metric-label">Total expenses</div><div class="metric-value danger">₹${formatCurrencyShort(totalExpenses)}</div></div>
      </div>

      <div style="background:var(--color-info-light);border:1px solid var(--color-info-mid);border-radius:10px;padding:12px 16px;margin-bottom:16px;font-size:13px;color:var(--color-info-text);display:flex;gap:8px;">
        ${Icon.info(15)} <span><strong>Delete entries:</strong> Delete invoices from the <a href="#/invoices" style="color:var(--color-info-text);font-weight:700;">Invoices page</a>. Orphan payments and expenses can be deleted here using the delete button.</span>
      </div>

      <div class="card">
        <div class="card-header">
          <h2>Journal (${withBalance.length} entries)</h2>
        </div>
        ${withBalance.length === 0 ? `
          <div class="empty-state" style="padding:48px;">
            <div class="empty-state-icon">${Icon.fileText(24)}</div>
            <h3>No entries yet</h3>
            <p>Create invoices, record payments, and add expenses — they appear here automatically.</p>
          </div>` : `
          <div class="table-wrapper">
            <table class="data-table">
              <thead>
                <tr>
                  <th style="width:100px;">Date</th>
                  <th style="width:90px;">Type</th>
                  <th style="width:110px;">Reference</th>
                  <th>Description</th>
                  <th class="text-right" style="width:110px;">Debit (₹)</th>
                  <th class="text-right" style="width:110px;">Credit (₹)</th>
                  <th class="text-right" style="width:110px;">Balance (₹)</th>
                  <th style="width:80px;"></th>
                </tr>
              </thead>
              <tbody>
                ${withBalance.map(e => `<tr id="ledger-row-${e.id||''}">
                  <td style="font-size:12px;white-space:nowrap;color:var(--text-tertiary);">${e.date || '—'}</td>
                  <td><span class="badge ${e.tag==='income'?'badge-info':e.tag==='receipt'?'badge-success':'badge-danger'} badge-dot">${e.type}</span></td>
                  <td style="font-family:var(--font-mono);font-size:11px;color:var(--text-tertiary);">${e.ref || '—'}</td>
                  <td style="font-size:12.5px;">${e.linkId ? `<a href="#/invoices/${e.linkId}" style="color:var(--brand-primary);">${e.description}</a>` : e.description}</td>
                  <td class="col-amount" style="color:${e.debit>0?'var(--color-info)':'var(--text-disabled)'};">${e.debit>0?'₹'+formatCurrency(e.debit):'—'}</td>
                  <td class="col-amount" style="color:${e.credit>0?(e.tag==='expense'?'var(--color-danger)':'var(--color-success)'):'var(--text-disabled)'};">${e.credit>0?'₹'+formatCurrency(e.credit):'—'}</td>
                  <td class="col-amount" style="font-weight:700;color:${e.balance>=0?'var(--text-primary)':'var(--color-danger)'};">₹${formatCurrency(e.balance)}</td>
                  <td>
                    ${e.deletable && e.id ? `
                      <button class="btn btn-ghost btn-icon btn-sm" style="color:var(--color-danger);"
                        onclick="LedgerPage.delEntry('${e.id}','${e.type}','${(e.description||'').slice(0,30).replace(/'/g,"\\'")}',this)"
                        title="Delete this ${e.type.toLowerCase()}">${Icon.trash(14)}</button>` : ''}
                    ${e.editHref ? `<a href="${e.editHref}" class="btn btn-ghost btn-icon btn-sm" title="Edit">${Icon.edit(14)}</a>` : ''}
                  </td>
                </tr>`).join('')}
              </tbody>
              <tfoot>
                <tr style="background:var(--bg-subtle);border-top:2px solid var(--border-default);">
                  <td colspan="4" style="padding:10px 14px;font-weight:700;">Totals</td>
                  <td class="col-amount" style="font-weight:700;color:var(--color-info);">₹${formatCurrency(totalInvoiced)}</td>
                  <td class="col-amount" style="font-weight:700;color:var(--color-danger);">₹${formatCurrency(totalExpenses)}</td>
                  <td class="col-amount" style="font-weight:700;">₹${formatCurrency(totalInvoiced-totalExpenses)}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>`}
      </div>
    `);

    window.LedgerPage = this;
  },

  async delEntry(id, type, desc, btn) {
    if (!confirm(`Delete this ${type.toLowerCase()} entry?\n"${desc}"\n\nThis cannot be undone.`)) return;
    btn?.classList?.add('loading');
    try {
      const { default: DB } = await import('../../services/firestore.js');
      const colName = type === 'Payment' ? 'payments' : 'expenses';
      await DB.delete(colName, id);
      const row = document.getElementById(`ledger-row-${id}`);
      if (row) { row.style.background='#FEF2F2'; setTimeout(()=>row.remove(), 300); }
      Toast.success(`${type} deleted from ledger`);
    } catch(e) { Toast.error('Delete failed: ' + e.message); }
  },

  exportCSV() {
    if (!this._entries?.length) { Toast.info('No data to export'); return; }
    const csv = 'Date,Type,Reference,Description,Debit,Credit,Balance\n' +
      this._entries.map(e =>
        `${e.date},"${e.type}","${e.ref||''}","${(e.description||'').replace(/"/g,"'")}",${ e.debit||0},${e.credit||0},${e.balance||0}`
      ).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], {type:'text/csv'}));
    a.download = `finos_ledger_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    Toast.success('Ledger exported!');
  },
};
export default LedgerPage;
