import {expect,test} from '@playwright/test';
import type {Page} from '@playwright/test';

const base='http://127.0.0.1:5174';
async function session(page:Page){
 await page.addInitScript(()=>{
  sessionStorage.setItem('foh.staff.bearer.v1','expense-fixture');
  sessionStorage.setItem('foh.staff.hotel.v1','1');
 });
}
const meta={page:1,perPage:20,total:1,totalPages:1};
const voucher={id:'7',journalId:'9',recordedBy:'8',recordedByName:'Reception staff',shiftId:'4',
 payee:'Supply Shop',description:'Cleaning supplies',department:'rooms',category:'cleaning_supplies',
 serviceDate:'2026-11-24',businessDate:'2026-11-24',currency:'PHP',amountMinor:35000,
 paymentSource:'cashier_drawer',paymentStatus:'paid',reviewStatus:'pending',reviewReason:'above_limit',
 policyLimitMinor:10000,invoiceReference:null,createdAt:'2026-11-24T04:00:00Z'};

for(const fromExpenses of [false,true]){
test(`${fromExpenses?'Expenses':'Cashier shifts'} retries the same payout after a lost response`,async({page})=>{
 await session(page);
 const requests:Record<string,unknown>[]=[];
 let recorded=false;
 await page.route('**/api/v1/**',async route=>{
  const path=new URL(route.request().url()).pathname;
  if(path.endsWith('/auth/me'))return route.fulfill({json:{data:{id:'8',name:'Reception staff',email:'staff@example.test',
   hotels:[{id:'1',name:'Demo hotel',role:fromExpenses?'admin':'front_desk',permissions:['cashier.read','cashier.write','expense.record']}]}}});
  if(path.endsWith('/expense-payouts')){
   expect(path).toContain('/cashier-shifts/4/expense-payouts');
   requests.push(route.request().postDataJSON());
   if(!recorded){recorded=true;return route.abort('failed');}
   return route.fulfill({json:{data:{expenseId:'7',payoutId:'3',journalId:'9',replayed:true}}});
  }
  const shift={id:'4',hotelId:'1',cashierId:'8',currency:'PHP',status:'open',openingFloatMinor:500000,
   expectedCashMinor:null,countedCashMinor:null,varianceMinor:null,receiptCount:0,unconfirmedReceiptCount:0,
   closingNote:null,managerNote:null,reviewedBy:null,openedAt:'2026-11-24T03:00:00Z',submittedAt:null,reconciledAt:null,
   expensePostingEnabled:true,expensePayoutTotalMinor:recorded?35000:0,expensePayoutCount:recorded?1:0};
  if(path.endsWith('/expenses'))return route.fulfill({json:{
   data:recorded?[voucher]:[],meta,postingEnabled:true,
   summary:{businessDate:'2026-11-24',monthExpenseMinor:recorded?35000:0,pendingReviewCount:recorded?1:0,flaggedCount:0,supplierBalancesSupported:false},
  }});
  if(path.endsWith('/expenses/7'))return route.fulfill({json:{data:{...voucher,review:null}}});
  if(path.endsWith('/cashier-shifts/current'))return route.fulfill({json:{data:shift}});
  if(path.endsWith('/cashier-shifts'))return route.fulfill({json:{data:[],meta:{...meta,total:0,totalPages:0}}});
  return route.fulfill({status:404,json:{message:'Outside fixture'}});
 });
 const routePath=fromExpenses?'/expenses':'/cashier-shifts';
 await page.goto(base+routePath);
 if(fromExpenses){
  await page.getByRole('button',{name:'Record expense',exact:true}).click();
  await page.getByRole('button',{name:'Front-desk drawer paid'}).click();
 }else{
  await page.getByRole('button',{name:'Record cash paid out'}).click();
 }
 const dialog=page.getByRole('dialog',{name:'Record cash paid out'});
 await dialog.getByLabel('Amount (PHP)').fill('350.00');
 await dialog.getByLabel('Payee').fill('Supply Shop');
 await dialog.getByLabel('Purpose').fill('Cleaning supplies');
 await dialog.getByLabel('Purchase date').fill('2026-11-24');
 await dialog.getByRole('button',{name:'Record payout',exact:true}).click();
 await expect(dialog.getByRole('button',{name:'Retry original payout'})).toBeEnabled();
 await expect(dialog.getByLabel('Amount (PHP)')).toBeDisabled();
 await dialog.getByRole('button',{name:'Close (retry saved)'}).click();
 if(fromExpenses){
  await page.getByRole('button',{name:'Record expense',exact:true}).click();
  await page.getByRole('button',{name:'Front-desk drawer paid'}).click();
 }else{
  await page.getByRole('button',{name:'Record cash paid out'}).click();
 }
 await dialog.getByRole('button',{name:'Retry original payout'}).click();
 await expect(dialog).toHaveCount(0);
 expect(requests).toHaveLength(2);
 expect(requests[0]).toEqual(requests[1]);
 expect(requests[0].amountMinor).toBe(35000);
 await expect(page.getByText('Expense voucher #7 recorded.')).toBeVisible();
 if(fromExpenses){
  await expect(page).toHaveURL(/\/expenses\/7(?:\?|$)/);
  await expect(page.getByRole('region',{name:'Expense voucher'})).toContainText('Cleaning supplies');
 }else{
  await expect(page.locator('.cash-shift-metrics').first()).toContainText('₱350.00');
  await expect(page.getByText('Expected cash',{exact:true})).toHaveCount(0);
 }
});
}

test('manager can inspect and review a voucher and update the future payout limit',async({page})=>{
 await session(page);
 let approved=false;let limit=10000;
 await page.route('**/api/v1/**',async route=>{
  const path=new URL(route.request().url()).pathname;
  if(path.endsWith('/auth/me'))return route.fulfill({json:{data:{id:'1',name:'Demo manager',email:'manager@example.test',hotels:[{id:'1',name:'Demo hotel',role:'admin'}]}}});
  if(path.endsWith('/cashier-shifts/current'))return route.fulfill({json:{data:null}});
  if(path.endsWith('/expenses/policy')){
   if(route.request().method()==='PUT')limit=route.request().postDataJSON().routineLimitMinor;
   return route.fulfill({json:{data:{configured:true,routineLimitMinor:limit}}});
  }
  if(path.endsWith('/expenses/exceptions'))return route.fulfill({json:{data:{hotelId:'1',pendingCorrectionCount:0,pendingReturnCount:0,flaggedReturnCount:0,unresolvedClearingCount:0,items:[]}}});
  if(path.endsWith('/expenses/7/history'))return route.fulfill({json:{data:{hotelId:'1',expenseId:'7',correctionsEnabled:false,originalAmountMinor:35000,netRecordedExpenseMinor:35000,effectiveDepartment:'rooms',effectiveCategory:'cleaning_supplies',clearingBalanceMinor:0,cashReturnedMinor:0,unapprovedCashReturnCount:0,corrections:[],cashReturns:[]}}});
  if(path.endsWith('/expenses/7/review')){approved=true;return route.fulfill({json:{data:{expenseId:'7',reviewStatus:'approved',replayed:false}}});}
  const row={...voucher,reviewStatus:approved?'approved':'pending'};
  if(path.endsWith('/expenses/7'))return route.fulfill({json:{data:{...row,review:approved?{reviewedBy:'1',reviewedByName:'Demo manager',decision:'approve',note:'Invoice checked',createdAt:'2026-11-24T05:00:00Z'}:null}}});
  if(path.endsWith('/expenses'))return route.fulfill({json:{data:[row],meta,postingEnabled:true,summary:{businessDate:'2026-11-24',monthExpenseMinor:35000,pendingReviewCount:approved?0:1,flaggedCount:0,supplierBalancesSupported:false}}});
  return route.fulfill({status:404,json:{message:'Outside fixture'}});
 });
 await page.goto(base+'/expenses');
 await page.getByRole('button',{name:'Record expense',exact:true}).click();
 await page.getByRole('button',{name:'Front-desk drawer paid'}).click();
 await expect(page.getByRole('link',{name:'Go to Cashier shifts'})).toHaveAttribute('href','/cashier-shifts');
 const needsReview=page.getByRole('button',{name:/Needs review/});
 await needsReview.click();
 await expect(page.getByLabel('Review status')).toHaveValue('pending');
 const inspect=page.getByRole('link',{name:'Inspect expense'});
 await inspect.click();
 const voucherPanel=page.getByRole('region',{name:'Expense voucher'});
 await expect(voucherPanel).toBeFocused();
 await expect(page).toHaveURL(/\/expenses\/7(?:\?|$)/);
 await expect(voucherPanel.getByText('Amount paid')).toBeVisible();
 await page.reload();
 await expect(voucherPanel.getByRole('heading',{name:'Cleaning supplies'})).toBeVisible();
 await voucherPanel.getByRole('link',{name:'Back to expense register'}).click();
 await expect(page.getByLabel('Review status')).toHaveValue('pending');
 await inspect.click();
 await page.getByRole('button',{name:'Review expense',exact:true}).click();
 const review=page.getByRole('dialog',{name:'Review expense'});
 await review.getByLabel('Review note').fill('Invoice checked');
 await review.getByRole('button',{name:'Approve expense'}).click();
 await expect(page.getByText('Expense review recorded.')).toBeVisible();
 await expect(review).toBeHidden();
 await expect(page.getByText(/Demo manager · Approve/)).toBeVisible();
 await page.goto(base+'/expenses?expense=7&hotel=1&date=2026-11-24');
 await expect(page).toHaveURL(/\/expenses\/7(?:\?|$)/);
 await expect(voucherPanel.getByText(/Demo manager · Approve/)).toBeVisible();
 await voucherPanel.getByRole('link',{name:'Back to expense register'}).click();
 await expect(page.getByLabel('From business date')).toHaveValue('2026-11-24');
 await page.getByRole('button',{name:'Expense policy',exact:true}).click();
 const policy=page.getByRole('dialog',{name:'Expense policy'});
 await policy.getByLabel('Routine limit (PHP)').fill('500.00');
 await policy.getByLabel('Reason for change').fill('New routine limit');
 await policy.getByRole('button',{name:'Save policy'}).click();
 await expect(page.getByText('Routine payout limit: ₱500.00')).toBeVisible();
 expect(limit).toBe(50000);
});

test('records a paid hotel-card expense without loading a cashier shift',async({page})=>{
 await session(page);
 const paidVoucher={...voucher,recordedBy:'1',shiftId:null,description:'Electricity',
  paymentSource:'hotel_card',paymentReference:'CARD-123'};
 let payload:Record<string,unknown>|undefined;
 let drawerRequests=0;
 await page.route('**/api/v1/**',async route=>{
  const path=new URL(route.request().url()).pathname;
  if(path.endsWith('/auth/me'))return route.fulfill({json:{data:{id:'1',name:'Demo manager',email:'manager@example.test',
   hotels:[{id:'1',name:'Demo hotel',role:'admin'}]}}});
  if(path.includes('/cashier-shifts'))drawerRequests++;
  if(path.endsWith('/expenses')&&route.request().method()==='POST'){
   payload=route.request().postDataJSON();
   return route.fulfill({status:201,json:{data:{expenseId:'7',journalId:'9',replayed:false}}});
  }
  if(path.endsWith('/expenses'))return route.fulfill({json:{data:[],meta,postingEnabled:true,
   summary:{businessDate:'2026-11-24',monthExpenseMinor:0,pendingReviewCount:0,flaggedCount:0,supplierBalancesSupported:false}}});
  if(path.endsWith('/expenses/7'))return route.fulfill({json:{data:{...paidVoucher,review:null}}});
  return route.fulfill({status:404,json:{message:'Outside fixture'}});
 });
 await page.goto(base+'/expenses');
 await page.getByRole('button',{name:'Record expense',exact:true}).click();
 await page.getByRole('button',{name:'Hotel bank account or card paid'}).click();
 const form=page.getByRole('dialog',{name:'Record expense paid by hotel'});
 await form.getByLabel('Amount (PHP)').fill('350.00');
 await form.getByLabel('Payee').fill('Utility Company');
 await form.getByLabel('Purpose').fill('Electricity');
 await form.getByLabel('Payment method').selectOption('hotel_card');
 await form.getByLabel('Payment reference').fill('CARD-123');
 await form.getByRole('button',{name:'Record expense',exact:true}).click();
 await expect(page).toHaveURL(/\/expenses\/7(?:\?|$)/);
 await expect(page.getByRole('region',{name:'Expense voucher'})).toContainText('CARD-123');
 expect(payload).toMatchObject({amountMinor:35000,paymentSource:'hotel_card',paymentReference:'CARD-123'});
 expect(drawerRequests).toBe(0);
});
