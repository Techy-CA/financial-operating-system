import DB    from '../../services/firestore.js';
import Store from '../../core/store.js';

function clean(obj){const o={};for(const[k,v]of Object.entries(obj)){if(v!==undefined&&v!==null)o[k]=v;}return o;}

const InvoiceService = {

  async getNextNumber(prefix='INV') {
    try {
      const cid=Store.get('companyId');
      const{doc,getDoc,setDoc,serverTimestamp,runTransaction}=await import('https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js');
      const db=window.fbDB;
      const ref=doc(db,'companies',cid,'settings','invoice_counter');
      let next=1;
      await runTransaction(db,async tx=>{const snap=await tx.get(ref);next=(snap.exists()?snap.data().last:0)+1;tx.set(ref,{last:next,updatedAt:serverTimestamp()});});
      return `${prefix}-${String(next).padStart(4,'0')}`;
    }catch(e){return `${prefix}-${String(Date.now()).slice(-4)}`;}
  },

  async create(data) {
    if(!data.invoiceNumber){const prefix=Store.get('company')?.invoicePrefix||'INV';data.invoiceNumber=await this.getNextNumber(prefix);}
    const cid = Store.get('companyId');
    return DB.create('invoices',clean({...data,companyId:cid||null,paidAmount:0,balanceDue:data.grandTotal||0}));
  },

  async update(id,data){return DB.update('invoices',id,clean(data));},

  async delete(id) {
    try{const items=await DB.getAll('invoiceItems',[DB.where('invoiceId','==',id)]);for(const i of items)await DB.delete('invoiceItems',i.id);}catch(e){}
    return DB.delete('invoices',id);
  },

  async saveLineItems(invoiceId, items) {
    // Delete existing items first
    try{
      const existing=await DB.getAll('invoiceItems',[DB.where('invoiceId','==',invoiceId)]);
      for(const i of existing) await DB.delete('invoiceItems',i.id);
    }catch(e){}
    // Save new items one by one
    for(let i=0;i<items.length;i++){
      const item=items[i];
      const gross=(parseFloat(item.qty)||0)*(parseFloat(item.rate)||0);
      const disc=gross*((parseFloat(item.discount)||0)/100);
      const lineNet=gross-disc;
      const lineTotal=lineNet*(1+(parseFloat(item.gstRate)||0)/100);
      await DB.create('invoiceItems',clean({
        description: item.description||'',
        hsn:         item.hsn||null,
        qty:         parseFloat(item.qty)||0,
        unit:        item.unit||'Nos',
        rate:        parseFloat(item.rate)||0,
        discount:    parseFloat(item.discount)||0,
        gstRate:     parseFloat(item.gstRate)||0,
        lineNet:     lineNet,
        lineTotal:   lineTotal,
        invoiceId,
        position:    i,
      }));
    }
  },
};
export default InvoiceService;
