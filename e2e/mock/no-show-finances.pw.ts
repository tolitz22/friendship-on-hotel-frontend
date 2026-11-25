import {expect,test,type Page} from '@playwright/test';

async function mockNoShow(page:Page, role:'admin'|'front_desk'){
 await page.addInitScript(()=>{
  sessionStorage.setItem('foh.staff.bearer.v1','no-show-fixture');
  sessionStorage.setItem('foh.staff.hotel.v1','1');
 });
 let failRead=true;
 let applied=false;
 await page.route('**/api/v1/**',async route=>{
  const path=new URL(route.request().url()).pathname;
  if(path.endsWith('/auth/me'))return route.fulfill({json:{data:{
   id:'1',name:'Demo staff',email:'staff@example.test',hotels:[{id:'1',name:'Demo hotel',role}],
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
   }}});
  }
  return route.fulfill({status:404,json:{message:'Outside no-show fixture'}});
 });
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
