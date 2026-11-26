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
