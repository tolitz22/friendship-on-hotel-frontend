import {expect,test} from '@playwright/test';

test('manager recovers supplier payment after lost response without duplicate posting',async({page})=>{
 await page.addInitScript(()=>{
  sessionStorage.setItem('foh.staff.bearer.v1','supplier-fixture');
  sessionStorage.setItem('foh.staff.hotel.v1','1');
 });
 const requests:unknown[]=[];
 let paid=0;
 const meta={page:1,perPage:20,total:1,totalPages:1};
 const bill={id:'7',supplierId:'3',supplierName:'Laundry Supplier',invoiceReference:'INV-65',
  description:'Laundry services',department:'rooms',category:'laundry',invoiceDate:'2026-11-24',
  serviceDate:'2026-11-24',dueDate:'2026-11-24',businessDate:'2026-11-24',currency:'PHP',
  amountMinor:480000,journalId:'9',recordedBy:'1',createdAt:'2026-11-24T04:00:00Z'};
 await page.route('**/api/v1/**',async route=>{
  const path=new URL(route.request().url()).pathname;
  if(path.endsWith('/auth/me'))return route.fulfill({json:{data:{id:'1',name:'Demo manager',email:'manager@example.test',hotels:[{id:'1',name:'Demo hotel',role:'admin'}]}}});
  if(path.endsWith('/expenses/policy'))return route.fulfill({json:{data:{configured:true,routineLimitMinor:10000}}});
  if(path.endsWith('/expenses/exceptions'))return route.fulfill({json:{data:{hotelId:'1',pendingCorrectionCount:0,pendingReturnCount:0,flaggedReturnCount:0,unresolvedClearingCount:0,items:[]}}});
  if(path.endsWith('/expenses'))return route.fulfill({json:{data:[],meta:{...meta,total:0,totalPages:0},postingEnabled:true,summary:{businessDate:'2026-11-24',monthExpenseMinor:0,pendingReviewCount:0,flaggedCount:0,supplierBalancesSupported:false}}});
  if(path.endsWith('/supplier-bills/7/payments')){
   requests.push(route.request().postDataJSON());
   if(!paid){paid=200000;return route.abort('failed');}
   return route.fulfill({json:{data:{billId:'7',paymentId:'8',journalId:'10',paidMinor:paid,outstandingMinor:480000-paid,paymentStatus:'partially_paid',replayed:true}}});
  }
  const row={...bill,paidMinor:paid,outstandingMinor:480000-paid,paymentStatus:paid?'partially_paid':'unpaid',overdue:false};
  if(path.endsWith('/supplier-bills/7'))return route.fulfill({json:{data:{...row,payments:paid?[{id:'8',journalId:'10',amountMinor:paid,paymentSource:'hotel_bank',shiftId:null,evidenceReference:'BANK-65',businessDate:'2026-11-24',recordedBy:'1',recordedByName:'Demo manager',createdAt:'2026-11-24T05:00:00Z'}]:[]}}});
  if(path.endsWith('/supplier-bills'))return route.fulfill({json:{data:[row],meta,postingEnabled:true,summary:{businessDate:'2026-11-24',outstandingMinor:480000-paid,outstandingCount:1,overdueMinor:0,overdueCount:0,inconsistentCount:0}}});
  return route.fulfill({status:404,json:{message:'Outside fixture'}});
 });
 await page.goto('http://127.0.0.1:5174/expenses');
 await page.getByRole('button',{name:'Supplier bills',exact:true}).click();
 await page.getByRole('button',{name:'View bill',exact:true}).click();
 await page.getByRole('button',{name:'Record supplier payment',exact:true}).click();
 const dialog=page.getByRole('dialog',{name:'Record supplier payment'});
 await dialog.getByLabel('Amount (PHP)').fill('4800.01');
 await dialog.getByLabel('Payment evidence reference').fill('BANK-65');
 await dialog.getByRole('checkbox').check();
 await expect(dialog.getByRole('button',{name:'Record payment',exact:true})).toBeDisabled();
 await dialog.getByLabel('Amount (PHP)').fill('2000.00');
 await dialog.getByRole('button',{name:'Record payment',exact:true}).click();
 await expect(dialog.getByRole('button',{name:'Retry original payment'})).toBeEnabled();
 await dialog.getByRole('button',{name:'Close (retry saved)'}).click();
 await page.getByRole('button',{name:'Recover supplier payment'}).click();
 await dialog.getByRole('button',{name:'Retry original payment'}).click();
 await expect(page.getByText('Supplier payment recorded.',{exact:true})).toBeVisible();
 await expect(dialog).toBeHidden();
 expect(requests).toHaveLength(2);
 expect(requests[0]).toEqual(requests[1]);
 await expect(page.getByText(/Evidence: BANK-65/)).toBeVisible();
 await expect(page.getByRole('cell',{name:'₱2,800.00',exact:true})).toBeVisible();
});
