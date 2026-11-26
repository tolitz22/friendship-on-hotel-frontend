import {expect,test,type Page} from '@playwright/test';

async function mockNoShow(page:Page, role:'admin'|'front_desk', options:{cleared?:boolean;permissions?:string[]}={}){
 await page.addInitScript(()=>{
  sessionStorage.setItem('foh.staff.bearer.v1','no-show-fixture');
  sessionStorage.setItem('foh.staff.hotel.v1','1');
 });
 let failRead=!options.cleared;
 let applied=!!options.cleared;
 let ledgerReads=0;
 let ledgerState:'settled'|'partial'|'mismatch'|'unavailable'|'forbidden'='settled';
 await page.route('**/api/v1/**',async route=>{
  const path=new URL(route.request().url()).pathname;
  if(path.endsWith('/auth/me'))return route.fulfill({json:{data:{
   id:'1',name:'Demo staff',email:'staff@example.test',hotels:[{id:'1',name:'Demo hotel',role,permissions:options.permissions}],
  }}});
  if(path.endsWith('/reservation-records/2'))return route.fulfill({json:{data:{
   id:'2',hotelId:'1',reference:'DEMO-NO-SHOW',guestName:'Demo guest',roomTypeId:'1',assignedRoomId:null,
   checkIn:'2026-11-24',checkOut:'2026-11-27',lifecycleState:'no_show',noShowReviewRequired:true,
  }}});
  if(path.endsWith('/bookings/2/settlement-statement'))return route.fulfill({json:{data:{
   hotelId:'1',bookingId:'2',folioId:'2',reservationReference:'DEMO-NO-SHOW',
   checkIn:'2026-11-24',checkOut:'2026-11-27',status:'no_show',currency:'PHP',
   charges:[{id:'1',type:'room_night',description:'Room charges',stayDate:null,amountMinor:600000}],
   adjustments:[],payments:[],allocations:[],taxAllocations:[],refunds:[],verifiedRefundsMinor:0,
   netRecordedChargesMinor:applied?200000:600000,verifiedPaymentsMinor:0,verifiedAllocatedMinor:0,
   unallocatedVerifiedDepositsMinor:0,remainingMinor:applied?200000:600000,
   blockers:[],canSignOff:false,signed:false,signedSnapshotIntegrity:false,signedSnapshotSha256:null,
   signedAt:null,signedBy:null,isTaxInvoice:false,bankOrGatewayApiVerified:false,
   paymentEvidenceIndependentlyReviewed:true,settlementWorkflowEnabled:true,
  }}});
  if(path.endsWith('/bookings/2/no-show-ledger-reconciliation')){
   ledgerReads++;
   expect(route.request().method()).toBe('GET');
   if(ledgerState==='unavailable'||ledgerState==='forbidden')return route.fulfill({
    status:ledgerState==='forbidden'?403:503,json:{message:'Synthetic ledger unavailable'},
   });
   const partial=ledgerState==='partial', mismatch=ledgerState==='mismatch';
   const expectedMinor={deposits:300000,fees:200000,allocations:partial?120000:200000,refunds:100000};
   const matchedJournalMinor={...expectedMinor,refunds:mismatch?0:100000};
   const expectedBalances={depositLiabilityMinor:partial?80000:0,receivableMinor:partial?80000:0};
   return route.fulfill({json:{data:{
    bookingId:'2',currency:'PHP',businessDate:'2026-11-26',scope:'current_no_show_matched_journals_only',
    expectedMinor,matchedJournalMinor,expectedBalances,
    matchedJournalBalances:{...expectedBalances,depositLiabilityMinor:mismatch?100000:expectedBalances.depositLiabilityMinor},
    issues:mismatch?[{kind:'refund',reference:'refund-evidence-42',reason:'missing_journal'}]:[],
    reconciled:!mismatch,settled:!partial&&!mismatch,readOnly:true,closingCertified:false,
   }}});
  }
  if(path.endsWith('/bookings/2/no-show-financial-review')){
   if(route.request().method()==='POST'){
    expect(route.request().postDataJSON()).toEqual({
     reviewFingerprint:'a'.repeat(64),reason:'Confirmed original booking agreement.',
    });
    applied=true;
    return route.fulfill({status:201,json:{data:{reviewId:'32',applied:true}}});
   }
   if(failRead){
    failRead=false;
    return route.fulfill({status:503,json:{message:'Synthetic service unavailable'}});
   }
   return route.fulfill({json:{data:{
    bookingId:'2',currency:'PHP',noShowKind:'fixed',
    originalRoomSubtotalMinor:600000,proposedNoShowFeeMinor:200000,proposedRoomCreditMinor:600000,
    currentFolioSummary:{pendingReviewPaymentsMinor:0},blockers:[],canApply:!applied,
    reviewFingerprint:'a'.repeat(64),approvalEnabled:true,
    recordedReviewId:applied?'32':null,recordedBy:applied?'1':null,recordedFeeMinor:applied?200000:null,
    ...(options.cleared?{clearance:{id:'1',vatMinor:0,revenueMinor:200000,businessDate:'2026-11-26'},
     refundEligibility:{financialClearanceValid:true,verifiedPaymentsMinor:300000,remainingCollectionMinor:0,maximumRefundRequestMinor:0,settled:true}}:{}),
   }}});
  }
  return route.fulfill({status:404,json:{message:'Outside no-show fixture'}});
 });
 return {setLedgerState:(state:typeof ledgerState)=>{ledgerState=state;},ledgerReads:()=>ledgerReads};
}

test('opens the direct no-show review link and recovers a failed load before recording a review',async({page})=>{
 await mockNoShow(page,'admin');
 await page.goto('http://127.0.0.1:5174/reservations?booking=2');
 await page.getByRole('link',{name:'Review no-show finances'}).click();
 await expect(page).toHaveURL(/\/billing\?.*action=no-show/);
 const dialog=page.getByRole('dialog',{name:'No-show financial review'});
 await expect(dialog).toBeVisible();
 await expect(dialog.getByRole('alert')).toContainText('Unable to load financial review');
 await dialog.getByRole('button',{name:'Retry'}).click();
 await expect(dialog.getByText('Unused room charges to reverse')).toBeVisible();
 await expect(dialog.getByText('₱6,000.00')).toHaveCount(2);
 const submit=dialog.getByRole('button',{name:'Record financial adjustments'});
 await expect(submit).toBeDisabled();
 await dialog.getByLabel('Review reason').fill('Confirmed original booking agreement.');
 await submit.click();
 await expect(dialog.getByText('Folio adjustments recorded. A second administrator must review the fee and tax treatment.')).toBeVisible();
 await expect(dialog.getByRole('button',{name:'Approve accounting clearance'})).toHaveCount(0);
 const box=await dialog.boundingBox();
 expect(box).not.toBeNull();
 expect(box!.x).toBeGreaterThan(0);
 expect(box!.x+box!.width).toBeLessThan(page.viewportSize()!.width);
});

test('reception can view the account but cannot open the financial review',async({page})=>{
 await mockNoShow(page,'front_desk');
 await page.goto('http://127.0.0.1:5174/billing?booking=2&action=no-show');
 await expect(page.getByText('No-show financial reconciliation requires an authorized hotel administrator.')).toBeVisible();
 await expect(page.getByRole('dialog',{name:'No-show financial review'})).toHaveCount(0);
});

test('renders settled, partial and mismatched ledger balances and recovers a failed refresh',async({page})=>{
 const fixture=await mockNoShow(page,'admin',{cleared:true,permissions:['finance.read']});
 await page.goto('http://127.0.0.1:5174/billing?booking=2&action=no-show');
 const dialog=page.getByRole('dialog',{name:'No-show financial review'});
 const ledger=dialog.getByRole('region',{name:'Accounting ledger reconciliation'});
 await expect(ledger.getByText('Ledger reconciled and settled',{exact:true})).toBeVisible();
 await expect(ledger.getByRole('row',{name:/Verified deposits/})).toContainText('₱3,000.00');
 await expect(ledger.getByText('Outstanding receivable',{exact:true})).toBeVisible();
 const before=fixture.ledgerReads();
 fixture.setLedgerState('partial');
 await ledger.getByRole('button',{name:'Refresh'}).click();
 await expect(ledger.getByText('Ledger reconciled · settlement incomplete')).toBeVisible();
 await expect(ledger.locator('dd').filter({hasText:'₱800.00'})).toHaveCount(2);
 expect(fixture.ledgerReads()).toBeGreaterThan(before);
 fixture.setLedgerState('mismatch');
 await ledger.getByRole('button',{name:'Refresh'}).click();
 await expect(ledger.getByText('Accounting review needed',{exact:true})).toBeVisible();
 await expect(ledger.getByText('Missing accounting journal',{exact:true})).toBeVisible();
 await expect(ledger.getByText('Refund evidence · refund-evidence-42')).toBeVisible();
 await expect(ledger.getByText(/Do not record the payment or refund again/)).toBeVisible();
 await expect(ledger.getByRole('row',{name:/Verified refunds/})).toContainText('Mismatch');
 await expect(ledger.getByText('Ledger reconciled and settled',{exact:true})).toHaveCount(0);
 fixture.setLedgerState('unavailable');
 await ledger.getByRole('button',{name:'Refresh'}).click();
 await expect(ledger.getByRole('alert')).toContainText('Accounting reconciliation is unavailable');
 await expect(ledger.getByRole('table')).toHaveCount(0);
 fixture.setLedgerState('settled');
 await ledger.getByRole('button',{name:'Refresh'}).click();
 await expect(ledger.getByText('Ledger reconciled and settled',{exact:true})).toBeVisible();
 fixture.setLedgerState('forbidden');
 await ledger.getByRole('button',{name:'Refresh'}).click();
 await expect(ledger.getByRole('alert')).toContainText('requires administrator access');
 await expect(ledger.getByRole('table')).toHaveCount(0);
});

test('does not request the ledger when finance permission is explicitly absent',async({page})=>{
 const fixture=await mockNoShow(page,'admin',{cleared:true,permissions:[]});
 await page.goto('http://127.0.0.1:5174/billing?booking=2&action=no-show');
 await expect(page.getByText('No-show financial reconciliation requires an authorized hotel administrator.')).toBeVisible();
 await expect(page.getByRole('dialog',{name:'No-show financial review'})).toHaveCount(0);
 expect(fixture.ledgerReads()).toBe(0);
});

test('keeps ledger comparison inside the mobile review dialog',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await mockNoShow(page,'admin',{cleared:true});
 await page.goto('http://127.0.0.1:5174/billing?booking=2&action=no-show');
 const dialog=page.getByRole('dialog',{name:'No-show financial review'});
 const ledger=dialog.getByRole('region',{name:'Accounting ledger reconciliation'});
 await expect(ledger.getByText('Ledger reconciled and settled',{exact:true})).toBeVisible();
 const box=await dialog.boundingBox();
 expect(box).not.toBeNull();
 expect(box!.x).toBeGreaterThanOrEqual(0);
 expect(box!.x+box!.width).toBeLessThanOrEqual(391);
 expect(await ledger.evaluate(node=>node.scrollWidth<=node.clientWidth+1)).toBe(true);
 await expect(ledger.getByRole('button',{name:'Refresh'})).toBeEnabled();
});

test('shows the financial overview and directs administrators to the independent review step',async({page})=>{
 await mockNoShow(page,'admin');
 await page.goto('http://127.0.0.1:5174/billing?booking=2&action=no-show');
 const dialog=page.getByRole('dialog',{name:'No-show financial review'});
 await dialog.getByRole('button',{name:'Retry'}).click();
 const overview=dialog.getByRole('region',{name:'Financial overview'});
 await expect(overview.getByText('Record financial adjustments',{exact:true})).toBeVisible();
 await expect(overview.getByText('To collect',{exact:true})).toBeVisible();
 await expect(overview.getByText('—',{exact:true})).toHaveCount(2);
 await overview.getByRole('button',{name:'Go to details'}).click();
 await dialog.getByLabel('Review reason').fill('Confirmed original booking agreement.');
 await dialog.getByRole('button',{name:'Record financial adjustments'}).click();
 await expect(overview.getByText('Waiting for another administrator')).toBeVisible();
});

test('shows settlement as recorded without claiming ledger certification',async({page})=>{
 await mockNoShow(page,'admin',{cleared:true});
 await page.goto('http://127.0.0.1:5174/billing?booking=2&action=no-show');
 const overview=page.getByRole('region',{name:'Financial overview'});
 await expect(overview.getByText('Settlement recorded',{exact:true})).toBeVisible();
 await expect(overview.getByText(/Check matched accounting entries/)).toBeVisible();
});


test('recognizes deposits, locks the financial dialog during writes, and applies partial and full allocations',async({page})=>{
 await mockNoShow(page,'admin',{cleared:true,permissions:['finance.read']});
 let recognized=false,allocated=0,recognitionWrites=0;
 let release:()=>void=()=>{};
 const gate=new Promise<void>(resolve=>{release=resolve;});
 const requests:Record<string,unknown>[]=[];
 await page.route('**/bookings/2/no-show-deposits',route=>route.fulfill({json:{data:{
  bookingId:'2',currency:'PHP',businessDate:'2026-11-26',postingEnabled:true,
  payments:[{paymentId:'42',method:'bank_transfer',amountMinor:300000,verified:true,
   status:recognized?'recognized':'ready',reason:'Verified bank receipt',journalId:recognized?'105':null,canRecognize:!recognized}],
 }}}));
 await page.route('**/bookings/2/no-show-deposits/42/recognize',async route=>{
  recognitionWrites++;
  expect(route.request().postDataJSON()).toEqual({acknowledged:true});
  await gate;recognized=true;
  await route.fulfill({status:201,json:{data:{journalId:'105'}}});
 });
 await page.route('**/bookings/2/no-show-allocations',route=>route.fulfill({json:{data:{
  bookingId:'2',currency:'PHP',postingEnabled:true,reconciled:recognized,settled:false,
  remainingFeeMinor:200000-allocated,availableDepositMinor:300000-allocated,maximumRefundMinor:100000,
  blocker:recognized?null:'Recognize deposit first.',
  payments:[{paymentId:'42',method:'bank_transfer',availableMinor:300000-allocated,maximumMinor:recognized?200000-allocated:0}],
 }}}));
 await page.route('**/bookings/2/no-show-allocations/42',async route=>{
  const body=route.request().postDataJSON();requests.push(body);
  expect(body.requestKey).toMatch(/^no-show-ui-/);
  expect(body.acknowledged).toBe(true);
  allocated+=body.amountMinor;
  await route.fulfill({status:201,json:{data:{replayed:false}}});
 });
 await page.goto('http://127.0.0.1:5174/billing?booking=2&action=no-show');
 const dialog=page.getByRole('dialog',{name:'No-show financial review'});
 await dialog.locator('#no-show-deposit-details > summary').click();
 const deposit=dialog.getByRole('region',{name:'Guest deposit accounting'});
 await deposit.getByRole('button',{name:'Recognize deposit #42'}).click();
 await deposit.getByRole('button',{name:'Confirm recognition'}).click();
 try{
  await expect.poll(()=>recognitionWrites).toBe(1);
  await expect(dialog.getByRole('button',{name:'Close financial review'})).toBeDisabled();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeVisible();
 }finally{release();}
 await expect(deposit.getByText('Recognized',{exact:true})).toBeVisible();
 await expect(dialog.getByRole('button',{name:'Close financial review'})).toBeEnabled();
 await dialog.locator('#no-show-allocation-details > summary').click();
 const allocation=dialog.getByRole('region',{name:'Deposit allocation and settlement'});
 for(const amount of ['1200','800']){
  await allocation.getByLabel('Verified deposit').selectOption('42');
  await allocation.getByLabel('Amount to apply (PHP)').fill(amount);
  await allocation.getByLabel('Payer name or reference').fill('Demo guest');
  await expect(allocation.getByRole('button',{name:'Apply deposit'})).toBeDisabled();
  await allocation.getByRole('checkbox').check();
  await allocation.getByRole('button',{name:'Apply deposit'}).click();
  await expect.poll(()=>requests.length).toBe(amount==='1200'?1:2);
  await expect(dialog.getByRole('button',{name:'Close financial review'})).toBeEnabled();
 }
 expect(requests.map(x=>x.amountMinor)).toEqual([120000,80000]);
 expect(requests[0].requestKey).not.toBe(requests[1].requestKey);
 await expect(allocation.getByText(/No eligible deposit allocation remains/)).toBeVisible();
});

test('validates refund limit and hides self approval after submitting a refund request',async({page})=>{
 await mockNoShow(page,'admin',{cleared:true,permissions:['finance.read']});
 let requested=false;
 let writes=0;
 await page.route('**/bookings/2/no-show-refunds',route=>route.fulfill({json:{data:{
  bookingId:'2',currency:'PHP',workflowEnabled:true,postingEnabled:true,reconciliationValid:true,
  maximumRefundMinor:requested?0:100000,payments:[{paymentId:'42',maximumRequestMinor:requested?0:100000}],
  refunds:requested?[{id:'9',paymentId:'42',amountMinor:100000,reason:'Return excess deposit',status:'requested',
   requestedBy:'1',reviewedBy:null,evidenceRecordedBy:null,evidenceId:null,evidenceStatus:null,externalReference:null}]:[],
 }}}));
 await page.route('**/bookings/2/refund-requests',async route=>{
  writes++;
  const body=route.request().postDataJSON();
  expect(body).toMatchObject({paymentRecordId:'42',amountMinor:100000,reason:'Return excess deposit'});
  expect(body.requestKey).toMatch(/^no-show-refund-/);
  requested=true;
  await route.fulfill({status:201,json:{data:{id:'9'}}});
 });
 await page.goto('http://127.0.0.1:5174/billing?booking=2&action=no-show');
 const dialog=page.getByRole('dialog',{name:'No-show financial review'});
 await dialog.locator('#no-show-refund-details > summary').click();
 const refund=dialog.getByRole('region',{name:'Refund processing and verification'});
 await refund.getByLabel('Original bank deposit').selectOption('42');
 await refund.getByLabel('Refund reason').fill('Return excess deposit');
 await refund.getByLabel('Refund amount (PHP)').fill('1000.01');
 await expect(refund.getByRole('button',{name:'Request refund'})).toBeDisabled();
 await refund.getByLabel('Refund amount (PHP)').fill('1000');
 await refund.getByRole('checkbox').check();
 await refund.getByRole('button',{name:'Request refund'}).click();
 await expect(refund.getByText('A different administrator must approve this request.')).toBeVisible();
 await expect(refund.getByRole('button',{name:'Review refund #9'})).toHaveCount(0);
 expect(writes).toBe(1);
});
