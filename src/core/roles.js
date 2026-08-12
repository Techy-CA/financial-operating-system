export const ROLES = { FOUNDER:'founder', ADMIN:'admin', ACCOUNTANT:'accountant', SALES:'sales', OPERATIONS:'operations', AUDITOR:'auditor' };
export const ROLE_LABELS = { founder:'Founder', admin:'Admin', accountant:'Accountant', sales:'Sales', operations:'Operations', auditor:'Auditor' };

const P = {
  founder:    { dashboard:{r:1}, customers:{c:1,r:1,u:1,d:1}, vendors:{c:1,r:1,u:1,d:1}, products:{c:1,r:1,u:1,d:1}, inventory:{c:1,r:1,u:1,d:1,e:1}, quotations:{c:1,r:1,u:1,d:1,s:1}, invoices:{c:1,r:1,u:1,d:1,s:1,e:1}, collections:{r:1,s:1}, payments:{c:1,r:1,u:1,d:1}, expenses:{c:1,r:1,u:1,d:1}, ledger:{r:1,e:1}, gst:{r:1,e:1}, reports:{r:1,e:1}, settings:{c:1,r:1,u:1,d:1}, team:{c:1,r:1,u:1,d:1} },
  admin:      { dashboard:{r:1}, customers:{c:1,r:1,u:1,d:1}, vendors:{c:1,r:1,u:1,d:1}, products:{c:1,r:1,u:1,d:1}, inventory:{c:1,r:1,u:1,d:1,e:1}, quotations:{c:1,r:1,u:1,d:1,s:1}, invoices:{c:1,r:1,u:1,d:1,s:1,e:1}, collections:{r:1,s:1}, payments:{c:1,r:1,u:1}, expenses:{c:1,r:1,u:1,d:1}, ledger:{r:1,e:1}, gst:{r:1,e:1}, reports:{r:1,e:1}, settings:{r:1,u:1}, team:{r:1} },
  accountant: { dashboard:{r:1}, customers:{r:1}, vendors:{r:1,u:1}, products:{r:1}, inventory:{r:1,e:1}, quotations:{r:1}, invoices:{c:1,r:1,u:1,e:1}, collections:{r:1,s:1}, payments:{c:1,r:1,u:1}, expenses:{c:1,r:1,u:1}, ledger:{r:1,e:1}, gst:{r:1,e:1}, reports:{r:1,e:1}, settings:{r:1} },
  sales:      { dashboard:{r:1}, customers:{c:1,r:1,u:1}, vendors:{r:1}, products:{r:1}, inventory:{r:1}, quotations:{c:1,r:1,u:1,s:1}, invoices:{c:1,r:1,s:1}, collections:{r:1,s:1}, payments:{r:1}, expenses:{r:1}, reports:{r:1} },
  operations: { dashboard:{r:1}, vendors:{c:1,r:1,u:1}, products:{c:1,r:1,u:1}, inventory:{c:1,r:1,u:1,d:1,e:1}, expenses:{c:1,r:1,u:1}, payments:{c:1,r:1}, customers:{r:1}, invoices:{r:1}, ledger:{r:1}, gst:{r:1}, reports:{r:1} },
  auditor:    { dashboard:{r:1}, customers:{r:1}, vendors:{r:1}, products:{r:1}, inventory:{r:1,e:1}, quotations:{r:1}, invoices:{r:1,e:1}, collections:{r:1}, payments:{r:1}, expenses:{r:1}, ledger:{r:1,e:1}, gst:{r:1,e:1}, reports:{r:1,e:1}, settings:{r:1} },
};

export function getPermissions(role) { return P[role] || P.auditor; }
export function can(role, mod, action) { const map={create:'c',read:'r',update:'u',delete:'d',send:'s',export:'e'}; return !!(P[role]?.[mod]?.[map[action]||action]); }

export function getNavItems(role) {
  const p = P[role] || P.auditor;
  const has = (mod) => !!p[mod]?.r;
  return [
    { section:'Overview',   items: [has('dashboard')&&{id:'dashboard',label:'Dashboard',route:'/dashboard'},has('reports')&&{id:'reports',label:'Reports',route:'/reports'}].filter(Boolean) },
    { section:'Money In',   items: [has('invoices')&&{id:'invoices',label:'Invoices',route:'/invoices'},has('quotations')&&{id:'quotations',label:'Quotations',route:'/quotations'},has('collections')&&{id:'collections',label:'Collections',route:'/collections'}].filter(Boolean) },
    { section:'Money Out',  items: [has('expenses')&&{id:'expenses',label:'Expenses',route:'/expenses'},has('vendors')&&{id:'vendors',label:'Vendors',route:'/vendors'}].filter(Boolean) },
    { section:'Compliance', items: [has('gst')&&{id:'gst',label:'GST',route:'/gst'},has('ledger')&&{id:'ledger',label:'Ledger',route:'/ledger'}].filter(Boolean) },
    { section:'Stock',      items: [has('inventory')&&{id:'inventory',label:'Inventory',route:'/inventory'},has('inventory')&&{id:'stockledger',label:'Stock Ledger',route:'/inventory/movements'}].filter(Boolean) },
    { section:'Masters',    items: [has('customers')&&{id:'customers',label:'Customers',route:'/customers'},has('products')&&{id:'products',label:'Products',route:'/products'}].filter(Boolean) },
  ].filter(s=>s.items.length>0);
}

// Add bulk import to nav
export function getBulkImportNav(role) {
  return ['founder','admin'].includes(role);
}
