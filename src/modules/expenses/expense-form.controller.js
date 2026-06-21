import Router from '../../core/router.js';
import Topbar from '../../components/Topbar.js';
import Toast  from '../../components/Toast.js';
import { EXPENSE_CATEGORIES, GST_RATE_OPTIONS } from '../../utils/constants.js';

function clean(obj){const o={};for(const[k,v]of Object.entries(obj)){if(v!==undefined&&v!==''&&v!==null)o[k]=v;}return o;}

const ExpenseFormPage = {
  async init(id) {
    this._id=id;
    let expense={};
    if(id){try{const{default:DB}=await import('../../services/firestore.js');expense=await DB.getOne('expenses',id)||{};}catch(e){}}
    Topbar.render({breadcrumb:[{label:'Expenses',route:'/expenses'},{label:id?'Edit expense':'New expense'}]});
    const e=expense;
    const today=new Date().toISOString().split('T')[0];
    const catOpts=EXPENSE_CATEGORIES.map(c=>`<option value="${c.id}" ${e.category===c.id?'selected':''}>${c.label}</option>`).join('');
    const gstOpts=GST_RATE_OPTIONS.map(r=>`<option value="${r.value}" ${e.gstRate==r.value?'selected':''}>${r.label}</option>`).join('');

    Router.render(`
      <div style="max-width:600px;">
        <div class="page-header">
          <div class="page-header-left"><h1>${id?'Edit expense':'New expense'}</h1></div>
          <div class="page-header-actions"><a href="#/expenses" class="btn btn-secondary">Cancel</a></div>
        </div>
        <div class="card">
          <div class="card-body">
            <form id="exp-form">
              <div class="form-row mb-4">
                <div class="form-group">
                  <label class="form-label">Category <span class="required">*</span></label>
                  <select class="select" name="category" required>${catOpts}</select>
                </div>
                <div class="form-group">
                  <label class="form-label">Date <span class="required">*</span></label>
                  <input class="input" type="date" name="expenseDate" value="${e.expenseDate||today}" required />
                </div>
              </div>
              <div class="form-group mb-4">
                <label class="form-label">Description <span class="required">*</span></label>
                <input class="input" name="description" value="${e.description||''}" placeholder="What was this for?" required />
              </div>
              <div class="form-row mb-4">
                <div class="form-group">
                  <label class="form-label">Amount (₹) <span class="required">*</span></label>
                  <div class="input-wrapper">
                    <span class="input-rupee-prefix">₹</span>
                    <input class="input input-rupee" type="number" name="amount" value="${e.amount||''}" min="0" step="0.01" required />
                  </div>
                </div>
                <div class="form-group">
                  <label class="form-label">GST rate</label>
                  <select class="select" name="gstRate">${gstOpts}</select>
                </div>
              </div>
              <div class="form-row mb-4">
                <div class="form-group">
                  <label class="form-label">Vendor / Paid to</label>
                  <input class="input" name="vendorName" value="${e.vendorName||''}" placeholder="Vendor name" />
                </div>
                <div class="form-group">
                  <label class="form-label">Reference / Bill no.</label>
                  <input class="input" name="reference" value="${e.reference||''}" placeholder="Bill number" />
                </div>
              </div>
              <div class="form-group mb-4">
                <label class="form-label">Notes</label>
                <textarea class="textarea" name="notes" rows="2">${e.notes||''}</textarea>
              </div>
              <div style="display:flex;gap:12px;">
                <button type="submit" id="btn-save" class="btn btn-primary btn-lg"><i class="ti ti-check"></i> ${id?'Save changes':'Add expense'}</button>
                <a href="#/expenses" class="btn btn-ghost btn-lg">Cancel</a>
              </div>
            </form>
          </div>
        </div>
      </div>
    `);

    document.getElementById('exp-form')?.addEventListener('submit', async ev=>{
      ev.preventDefault();
      const btn  = document.getElementById('btn-save');
      const data = Object.fromEntries(new FormData(ev.target));
      if(!data.description?.trim()||!data.amount){Toast.error('Fill in all required fields');return;}
      btn.classList.add('loading');
      try{
        const{default:DB}=await import('../../services/firestore.js');
        const amount=parseFloat(data.amount)||0;
        const gstRate=parseFloat(data.gstRate)||0;
        const payload=clean({
          category:    data.category,
          expenseDate: data.expenseDate,
          description: data.description.trim(),
          amount,
          gstRate,
          gstAmount:   amount*(gstRate/(100+gstRate)),
          vendorName:  data.vendorName?.trim()||null,
          reference:   data.reference?.trim()||null,
          notes:       data.notes?.trim()||null,
        });
        if(id) await DB.update('expenses',id,payload);
        else   await DB.create('expenses',payload);
        Toast.success(id?'Expense updated':'Expense added');
        window.location.hash='#/expenses';
      }catch(err){btn.classList.remove('loading');Toast.error('Failed: '+err.message);}
    });
  },
};
export default ExpenseFormPage;
