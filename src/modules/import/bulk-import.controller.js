/**
 * bulk-import.controller.js
 * Bulk import customers, products, invoices from CSV
 */

import Router from '../../core/router.js';
import Topbar from '../../components/Topbar.js';
import Toast  from '../../components/Toast.js';
import Store  from '../../core/store.js';

const BulkImportPage = {
  _type: 'customers',
  _parsed: [],

  init() {
    Topbar.render({ breadcrumb:[{label:'Bulk Import'}] });
    this._render();
  },

  _render() {
    Router.render(`
      <div class="page-header">
        <div class="page-header-left">
          <h1>Bulk Import</h1>
          <p>Import your existing data via CSV. Download the template, fill it, and upload.</p>
        </div>
      </div>

      <div class="grid-3 mb-5">
        ${[
          {id:'customers', label:'Customers', icon:'👤', desc:'Name, GSTIN, email, phone, address'},
          {id:'products',  label:'Products & Services', icon:'📦', desc:'Name, HSN/SAC, rate, GST%, unit'},
          {id:'invoices',  label:'Invoices (historical)', icon:'🧾', desc:'Past invoices for records'},
        ].map(t=>`
          <div onclick="BulkImportPage.setType('${t.id}')" style="padding:20px;border-radius:12px;border:2px solid ${this._type===t.id?'var(--brand-primary)':'var(--border-subtle)'};background:${this._type===t.id?'var(--brand-primary-light)':'white'};cursor:pointer;transition:all 0.12s;" onmouseover="this.style.borderColor='var(--brand-primary)'" onmouseout="this.style.borderColor='${this._type===t.id?'var(--brand-primary)':'var(--border-subtle)'}'">
            <div style="font-size:28px;margin-bottom:8px;">${t.icon}</div>
            <div style="font-size:14px;font-weight:700;color:var(--text-primary);margin-bottom:4px;">${t.label}</div>
            <div style="font-size:12px;color:var(--text-tertiary);">${t.desc}</div>
          </div>`).join('')}
      </div>

      <div class="card mb-4">
        <div class="card-header">
          <h2>Step 1 — Download template</h2>
        </div>
        <div class="card-body">
          <p style="font-size:13.5px;color:var(--text-secondary);margin-bottom:16px;">Download the CSV template for <strong>${this._type}</strong>, fill in your data, and upload below.</p>
          <button class="btn btn-secondary" onclick="BulkImportPage.downloadTemplate()">
            ⬇️ Download ${this._type} template (.csv)
          </button>
        </div>
      </div>

      <div class="card mb-4">
        <div class="card-header"><h2>Step 2 — Upload your CSV</h2></div>
        <div class="card-body">
          <div id="upload-area" style="border:2px dashed var(--border-default);border-radius:10px;padding:40px;text-align:center;cursor:pointer;transition:all 0.12s;background:var(--bg-subtle);"
            ondragover="event.preventDefault();this.style.borderColor='var(--brand-primary)';this.style.background='var(--brand-primary-light)'"
            ondragleave="this.style.borderColor='var(--border-default)';this.style.background='var(--bg-subtle)'"
            ondrop="event.preventDefault();this.style.borderColor='var(--border-default)';this.style.background='var(--bg-subtle)';BulkImportPage.handleFile(event.dataTransfer.files[0])"
            onclick="document.getElementById('csv-input').click()">
            <div style="font-size:36px;margin-bottom:10px;">📂</div>
            <div style="font-size:14px;font-weight:600;color:var(--text-primary);margin-bottom:4px;">Drop your CSV here or click to browse</div>
            <div style="font-size:12px;color:var(--text-tertiary);">Supports .csv files only</div>
          </div>
          <input type="file" id="csv-input" accept=".csv" style="display:none;" onchange="BulkImportPage.handleFile(this.files[0])" />
        </div>
      </div>

      <div id="preview-section" style="display:none;">
        <div class="card mb-4">
          <div class="card-header">
            <h2 id="preview-title">Preview</h2>
            <div style="display:flex;gap:8px;">
              <button class="btn btn-secondary btn-sm" onclick="BulkImportPage.clearPreview()">✕ Clear</button>
              <button class="btn btn-primary" id="btn-import" onclick="BulkImportPage.doImport()">⬆️ Import all</button>
            </div>
          </div>
          <div id="preview-table" class="table-wrapper"></div>
        </div>
      </div>

      <div id="import-result" style="display:none;"></div>
    `);
    window.BulkImportPage = this;
  },

  setType(type) { this._type=type; this._render(); },

  downloadTemplate() {
    const templates = {
      customers: `name,gstin,pan,email,phone,address,city,state,pincode,credit_days
Acme Pvt Ltd,22AAAAA0000A1Z5,ABCDE1234F,billing@acme.com,9876543210,"B-101 Main Street",Mumbai,Maharashtra,400001,30
Cloud Corp,,,,9123456789,"Plot 5 IT Park",Pune,Maharashtra,411014,15`,
      products: `name,type,hsn,sac,rate,unit,gstRate,description
Web Development,service,,998314,50000,Project,18,Full-stack web development
Graphic Design,service,,998311,15000,Project,18,Logo and branding design
Laptop,product,8471,,75000,Nos,18,Laptop computer
Office Chair,product,9401,,8500,Nos,18,Ergonomic office chair`,
      invoices: `invoiceNumber,customerName,invoiceDate,dueDate,grandTotal,status,notes
INV-0001,Acme Pvt Ltd,2026-01-15,2026-02-15,118000,paid,January consulting
INV-0002,Cloud Corp,2026-02-01,2026-03-01,59000,sent,February services`,
    };
    const csv = templates[this._type];
    const blob = new Blob([csv], {type:'text/csv'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `finos_${this._type}_template.csv`;
    a.click();
    Toast.success('Template downloaded!');
  },

  handleFile(file) {
    if (!file) return;
    if (!file.name.endsWith('.csv')) { Toast.error('Please upload a .csv file'); return; }
    const reader = new FileReader();
    reader.onload = (e) => this._parseCSV(e.target.result);
    reader.readAsText(file);
  },

  _parseCSV(text) {
    const lines = text.trim().split('\n').filter(l=>l.trim());
    if (lines.length < 2) { Toast.error('CSV must have a header row and at least one data row'); return; }
    const headers = lines[0].split(',').map(h=>h.trim().replace(/"/g,''));
    const rows = lines.slice(1).map(line => {
      const vals = [];
      let inQuote = false, cur = '';
      for (const ch of line) {
        if (ch==='"') { inQuote=!inQuote; }
        else if (ch===',' && !inQuote) { vals.push(cur.trim()); cur=''; }
        else { cur+=ch; }
      }
      vals.push(cur.trim());
      const obj = {};
      headers.forEach((h,i) => { obj[h] = vals[i]?.replace(/^"|"$/g,'')||''; });
      return obj;
    }).filter(r=>Object.values(r).some(v=>v));

    this._parsed = rows;
    this._showPreview(headers, rows);
  },

  _showPreview(headers, rows) {
    const section = document.getElementById('preview-section');
    const title   = document.getElementById('preview-title');
    const table   = document.getElementById('preview-table');
    if (!section||!title||!table) return;

    title.textContent = `Preview — ${rows.length} record${rows.length!==1?'s':''} to import`;
    table.innerHTML = `
      <table class="data-table">
        <thead><tr>${headers.map(h=>`<th>${h}</th>`).join('')}<th>Status</th></tr></thead>
        <tbody>
          ${rows.slice(0,20).map(row=>`
            <tr>
              ${headers.map(h=>`<td style="font-size:12px;max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${row[h]||'—'}</td>`).join('')}
              <td><span class="badge badge-neutral">Ready</span></td>
            </tr>`).join('')}
          ${rows.length>20?`<tr><td colspan="${headers.length+1}" style="text-align:center;color:var(--text-tertiary);font-size:12px;">... and ${rows.length-20} more rows</td></tr>`:''}
        </tbody>
      </table>`;
    section.style.display = 'block';
  },

  clearPreview() {
    this._parsed = [];
    document.getElementById('preview-section').style.display = 'none';
    document.getElementById('csv-input').value = '';
  },

  async doImport() {
    const btn = document.getElementById('btn-import');
    if (!this._parsed.length) { Toast.error('No data to import'); return; }
    btn.classList.add('loading');

    const { default: DB } = await import('../../services/firestore.js');
    let success = 0, errors = 0;

    try {
      for (const row of this._parsed) {
        try {
          if (this._type === 'customers') {
            await DB.create('customers', {
              name:        row.name||'Unknown',
              gstin:       row.gstin?.toUpperCase()||null,
              pan:         row.pan?.toUpperCase()||null,
              email:       row.email||null,
              phone:       row.phone||null,
              address:     row.address||null,
              city:        row.city||null,
              state:       row.state||null,
              pincode:     row.pincode||null,
              credit_days: parseInt(row.credit_days)||30,
              type:        'business',
            });
          } else if (this._type === 'products') {
            await DB.create('products', {
              name:        row.name||'Unknown',
              type:        row.type||'product',
              hsn:         row.hsn||null,
              sac:         row.sac||null,
              rate:        parseFloat(row.rate)||0,
              unit:        row.unit||'Nos',
              gstRate:     parseFloat(row.gstRate)||18,
              description: row.description||null,
            });
          } else if (this._type === 'invoices') {
            await DB.create('invoices', {
              invoiceNumber: row.invoiceNumber||null,
              customerName:  row.customerName||'Unknown',
              invoiceDate:   row.invoiceDate||null,
              dueDate:       row.dueDate||null,
              grandTotal:    parseFloat(row.grandTotal)||0,
              paidAmount:    row.status==='paid'?parseFloat(row.grandTotal)||0:0,
              balanceDue:    row.status==='paid'?0:parseFloat(row.grandTotal)||0,
              status:        row.status||'sent',
              notes:         row.notes||null,
              imported:      true,
            });
          }
          success++;
        } catch(e) { errors++; console.warn('Import row error:', e.message); }
      }

      btn.classList.remove('loading');
      document.getElementById('import-result').style.display = 'block';
      document.getElementById('import-result').innerHTML = `
        <div style="background:${errors===0?'var(--color-success-light)':'var(--color-warning-light)'};border:1px solid ${errors===0?'var(--color-success-mid)':'var(--color-warning-mid)'};border-radius:10px;padding:16px 20px;display:flex;align-items:center;gap:12px;">
          <div style="font-size:24px;">${errors===0?'✅':'⚠️'}</div>
          <div>
            <div style="font-weight:700;font-size:14px;color:var(--text-primary);">Import complete</div>
            <div style="font-size:13px;color:var(--text-secondary);margin-top:2px;">${success} records imported successfully${errors>0?`, ${errors} failed`:''}.</div>
          </div>
          <a href="#/${this._type}" class="btn btn-primary" style="margin-left:auto;">View ${this._type}</a>
        </div>`;

      this.clearPreview();
      Toast.success(`${success} ${this._type} imported!`);

      // Log activity
      try{const{default:N}=await import('../../components/Notifications.js');await N.log('import',`Imported ${success} ${this._type}`);}catch(e){}

    } catch(e) {
      btn.classList.remove('loading');
      Toast.error('Import failed: '+e.message);
    }
  },
};

export default BulkImportPage;
