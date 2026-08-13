/**
 * insights.controller.js — What the data implies
 *
 * Every card states the signal, the number behind it, and the action. Nothing
 * is shown without the evidence that produced it.
 */

import Router from '../../core/router.js';
import Icon   from '../../utils/icons.js';
import InsightsService from './insights.service.js';
import { formatCurrency, formatCurrencyShort, formatDate, initials, avatarColor } from '../../utils/formatters.js';
import { EXPENSE_CATEGORY_MAP } from '../../utils/constants.js';

const money = (v) => formatCurrency(v);
const esc   = (s) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const URGENCY = {
  out:      { label: 'Out of stock', tone: 'high' },
  critical: { label: 'Under a week', tone: 'high' },
  soon:     { label: 'Reorder soon', tone: 'medium' },
  ok:       { label: 'Healthy',      tone: 'good' },
};

const InsightsPage = {
  _data: null, _risks: [], _forecast: [], _anomalies: [], _margins: [], _tab: 'all',

  async init() {
    window.InsightsPage = this;
    Router.render(`
      <div class="page-header">
        <div class="page-header-left">
          <h1>Insights</h1>
          <p>Signals computed from what the business has already done</p>
        </div>
      </div>
      <div id="ins-body">
        <div class="card" style="padding:44px;text-align:center;">
          <div class="spinner-sm"></div>
          <p style="margin-top:12px;font-size:13px;color:var(--text-tertiary);">Reading history…</p>
        </div>
      </div>
    `);

    const { default: Inventory } = await import('../inventory/inventory.service.js');
    if (!(await Inventory.waitForCompany())) {
      document.getElementById('ins-body').innerHTML = `<div class="empty-state"><h3>No company selected</h3><p>Set up your company in Settings first.</p></div>`;
      return;
    }

    try {
      this._data      = await InsightsService.load();
      this._risks     = InsightsService.paymentRisk(this._data);
      this._forecast  = InsightsService.stockForecast(this._data);
      this._anomalies = InsightsService.spendAnomalies(this._data);
      this._margins   = InsightsService.margins(this._data);
    } catch (e) {
      document.getElementById('ins-body').innerHTML = `<div class="empty-state"><h3>Could not compute insights</h3><p>${esc(e.message)}</p></div>`;
      return;
    }
    this._render();
  },

  _render() {
    const health = InsightsService.collectionHealth(this._risks, this._data.invoices);
    const critical = this._forecast.filter(f => f.urgency === 'critical' || f.urgency === 'out');
    const soon     = this._forecast.filter(f => f.urgency === 'soon');
    const highRisk = this._risks.filter(r => r.band === 'high' && r.outstanding > 0);

    const card = (label, value, sub, tone) => `
      <div class="metric-card">
        <div class="metric-label">${label}</div>
        <div class="metric-value" ${tone ? `style="color:${tone};"` : ''}>${value}</div>
        ${sub ? `<div class="metric-subtext">${sub}</div>` : ''}
      </div>`;

    document.getElementById('ins-body').innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px;margin-bottom:18px;">
        ${card('Average time to get paid', health.avgDelay === null ? '—' : `${health.avgDelay} days`, `across ${health.customers} customers`)}
        ${card('Outstanding', formatCurrencyShort(health.outstanding), 'receivable right now')}
        ${card('At risk', formatCurrencyShort(health.atRisk), `${health.atRiskPct}% of receivables`, health.atRisk > 0 ? 'var(--color-danger)' : null)}
        ${card('Running out', critical.length, `${soon.length} more need reordering`, critical.length ? 'var(--color-danger)' : null)}
      </div>

      ${this._alertsHTML(highRisk, critical, this._anomalies)}

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;align-items:start;" class="ins-split">
        ${this._riskTableHTML()}
        ${this._forecastTableHTML()}
      </div>

      ${this._marginHTML()}
    `;
  },

  // ── HEADLINE ALERTS ──────────────────────────────────────────────────────
  _alertsHTML(highRisk, critical, anomalies) {
    const items = [];

    for (const r of highRisk.slice(0, 3)) {
      items.push({
        tone: 'high', icon: 'alertTriangle',
        title: `${r.name} — ${money(r.outstanding)} outstanding, likely to slip`,
        why: r.thin
          ? `Oldest unpaid invoice is ${r.oldestUnpaidDays} days past due. Not enough settled history yet to judge their pattern.`
          : `Pays ${r.avgDelay} days after invoice on average and has been late on ${r.lateRate}% of settled bills. Oldest unpaid is ${r.oldestUnpaidDays} days past due.`,
        action: `<a href="#/khata/customer/${r.customerId}" class="btn btn-secondary btn-sm">Open khata</a>`,
      });
    }

    for (const f of critical.slice(0, 3)) {
      items.push({
        tone: f.urgency === 'out' ? 'high' : 'medium', icon: 'box',
        title: f.urgency === 'out'
          ? `${f.name} is out of stock`
          : `${f.name} runs out in ${f.daysLeft} day${f.daysLeft === 1 ? '' : 's'}`,
        why: f.perDay > 0
          ? `Selling ${f.perDay} ${f.unit}/day. ${f.stockQty} ${f.unit} left${f.runsOut ? ` — empty around ${formatDate(f.runsOut, 'short')}` : ''}.`
          : `No recent sales recorded, but stock is at ${f.stockQty} ${f.unit}.`,
        action: f.suggestedOrder > 0
          ? `<a href="#/purchases/new" class="btn btn-secondary btn-sm">Order ~${f.suggestedOrder} ${esc(f.unit)}</a>` : '',
      });
    }

    for (const a of anomalies.slice(0, 2)) {
      const label = EXPENSE_CATEGORY_MAP[a.category]?.label || a.category;
      items.push({
        tone: 'medium', icon: 'trendingUp',
        title: `${label} spending is ${a.pct}% above its usual`,
        why: `${money(a.current)} this month against a ${money(a.mean)} average — ${a.z} standard deviations out.`,
        action: `<a href="#/expenses" class="btn btn-secondary btn-sm">Review expenses</a>`,
      });
    }

    if (items.length === 0) {
      return `<div class="insight-card good">
        <div class="insight-ico">${Icon.checkCircle(16)}</div>
        <div class="insight-body">
          <div class="insight-title">Nothing needs attention</div>
          <div class="insight-why">No high-risk receivables, no items about to run out, and spending is within its normal range.</div>
        </div>
      </div>`;
    }

    return `
      <h3 style="font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.6px;color:var(--text-tertiary);margin:0 0 9px;">Needs attention</h3>
      <div style="margin-bottom:20px;">
        ${items.map(i => `
          <div class="insight-card ${i.tone}">
            <div class="insight-ico">${(Icon[i.icon] || Icon.info)(16)}</div>
            <div class="insight-body">
              <div class="insight-title">${esc(i.title)}</div>
              <div class="insight-why">${esc(i.why)}</div>
              ${i.action ? `<div class="insight-act">${i.action}</div>` : ''}
            </div>
          </div>`).join('')}
      </div>`;
  },

  // ── PAYMENT RISK ─────────────────────────────────────────────────────────
  _riskTableHTML() {
    const rows = this._risks.filter(r => r.outstanding > 0 || r.avgDelay !== null).slice(0, 12);
    if (rows.length === 0) return '<div></div>';

    return `
      <div class="card">
        <div class="card-header">
          <div>
            <h3 style="margin:0;font-size:15px;">Payment behaviour</h3>
            <p style="margin:2px 0 0;font-size:11.5px;color:var(--text-tertiary);">Scored on actual settlement history, not credit limits</p>
          </div>
        </div>
        <div class="table-wrapper"><table class="data-table">
          <thead><tr><th>Customer</th><th class="text-right">Avg delay</th><th class="text-right">Outstanding</th><th style="width:110px;">Risk</th></tr></thead>
          <tbody>
            ${rows.map(r => {
              const col = avatarColor(r.name);
              const tone = r.band === 'high' ? 'var(--color-danger)' : r.band === 'medium' ? 'var(--color-warning)' : 'var(--color-success)';
              return `<tr style="cursor:pointer;" onclick="location.hash='#/khata/customer/${r.customerId}'">
                <td>
                  <div class="table-entity">
                    <div class="table-entity-avatar" style="background:${col.bg};color:${col.text};">${esc(initials(r.name))}</div>
                    <div>
                      <div class="table-entity-name">${esc(r.name)}</div>
                      <div class="table-entity-sub">${r.invoiceCount} invoice${r.invoiceCount === 1 ? '' : 's'}${r.thin ? ' · limited history' : ''}</div>
                    </div>
                  </div>
                </td>
                <td class="text-right muted">${r.avgDelay === null ? '—' : `${r.avgDelay}d`}</td>
                <td class="col-amount">${r.outstanding > 0 ? money(r.outstanding) : '—'}</td>
                <td>
                  <div style="font-size:11.5px;font-weight:700;color:${tone};">${r.score}</div>
                  <div class="risk-bar"><span style="width:${Math.max(4, r.score)}%;background:${tone};"></span></div>
                </td>
              </tr>`;
            }).join('')}
          </tbody>
        </table></div>
      </div>`;
  },

  // ── STOCK FORECAST ───────────────────────────────────────────────────────
  _forecastTableHTML() {
    const rows = this._forecast.filter(f => f.urgency !== 'ok' || f.perDay > 0).slice(0, 12);
    if (rows.length === 0) return '<div></div>';

    return `
      <div class="card">
        <div class="card-header">
          <div>
            <h3 style="margin:0;font-size:15px;">Stock runway</h3>
            <p style="margin:2px 0 0;font-size:11.5px;color:var(--text-tertiary);">Days of cover at the current sales rate</p>
          </div>
        </div>
        <div class="table-wrapper"><table class="data-table">
          <thead><tr><th>Item</th><th class="text-right">Rate</th><th class="text-right">On hand</th><th class="text-right">Runway</th></tr></thead>
          <tbody>
            ${rows.map(f => {
              const u = URGENCY[f.urgency];
              const tone = u.tone === 'high' ? 'var(--color-danger)' : u.tone === 'medium' ? 'var(--color-warning)' : 'var(--text-tertiary)';
              return `<tr>
                <td>
                  <div class="table-entity-name" style="font-size:12.5px;">${esc(f.name)}</div>
                  <div class="table-entity-sub">${esc(u.label)}</div>
                </td>
                <td class="text-right muted">${f.perDay > 0 ? `${f.perDay}/day` : '—'}</td>
                <td class="text-right">${f.stockQty} ${esc(f.unit)}</td>
                <td class="text-right" style="color:${tone};font-weight:700;">
                  ${f.urgency === 'out' ? 'Empty' : f.daysLeft === null ? '—' : `${f.daysLeft}d`}
                </td>
              </tr>`;
            }).join('')}
          </tbody>
        </table></div>
      </div>`;
  },

  // ── MARGINS ──────────────────────────────────────────────────────────────
  _marginHTML() {
    const rows = this._margins;
    if (rows.length === 0) return '';
    const best  = rows.slice(0, 5);
    const worst = rows.slice().sort((a, b) => a.marginPct - b.marginPct).slice(0, 3);

    return `
      <div class="card" style="margin-top:14px;">
        <div class="card-header">
          <div>
            <h3 style="margin:0;font-size:15px;">Where the profit comes from</h3>
            <p style="margin:2px 0 0;font-size:11.5px;color:var(--text-tertiary);">Revenue against the actual cost the stock ledger valued each sale at</p>
          </div>
        </div>
        <div class="table-wrapper"><table class="data-table">
          <thead><tr><th>Item</th><th class="text-right">Sold</th><th class="text-right">Revenue</th><th class="text-right">Cost</th><th class="text-right">Profit</th><th class="text-right">Margin</th></tr></thead>
          <tbody>
            ${best.map(m => `
              <tr>
                <td style="font-size:12.5px;font-weight:500;">${esc(m.name)}</td>
                <td class="text-right muted">${m.qty}</td>
                <td class="col-amount">${money(m.revenue)}</td>
                <td class="col-amount muted">${money(m.cost)}</td>
                <td class="col-amount" style="color:var(--color-success);font-weight:700;">${money(m.profit)}</td>
                <td class="text-right" style="font-weight:600;">${m.marginPct}%</td>
              </tr>`).join('')}
            ${worst.filter(w => !best.find(b => b.id === w.id)).map(m => `
              <tr style="background:var(--color-danger-light);">
                <td style="font-size:12.5px;font-weight:500;">${esc(m.name)} <span class="badge badge-danger" style="margin-left:4px;">thin margin</span></td>
                <td class="text-right muted">${m.qty}</td>
                <td class="col-amount">${money(m.revenue)}</td>
                <td class="col-amount muted">${money(m.cost)}</td>
                <td class="col-amount" style="font-weight:700;">${money(m.profit)}</td>
                <td class="text-right" style="font-weight:600;color:var(--color-danger);">${m.marginPct}%</td>
              </tr>`).join('')}
          </tbody>
        </table></div>
      </div>`;
  },
};

export default InsightsPage;
