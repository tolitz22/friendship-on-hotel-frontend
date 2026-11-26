import {expect,test} from '@playwright/test';

test('refreshes the checkout bill before staff can dismiss a saved extension',async({page})=>{
 await page.clock.setFixedTime(new Date('2026-11-26T04:00:00Z'));
 await page.addInitScript(()=>{
  sessionStorage.setItem('foh.staff.bearer.v1','extension-fixture');
  sessionStorage.setItem('foh.staff.hotel.v1','1');
 });
 let saved=false;
 let releaseBill!:()=>void;
 const billPending=new Promise<void>(resolve=>{releaseBill=resolve;});
 await page.route('**/api/v1/**',async route=>{
  const path=new URL(route.request().url()).pathname;
  if(path.endsWith('/auth/me'))return route.fulfill({json:{data:{
   id:'1',name:'Demo staff',email:'staff@example.test',hotels:[{id:'1',name:'Demo hotel',role:'admin'}],
  }}});
  if(path.endsWith('/reservation-records/2'))return route.fulfill({json:{data:{
   id:'2',hotelId:'1',reference:'TEST-EXTENSION',guestName:'Demo guest',roomTypeId:'1',
   assignedRoomId:'1',assignedRoomNumber:'203',checkIn:'2026-11-26',
   checkOut:saved?'2026-11-28':'2026-11-27',lifecycleState:'checked_in',
  }}});
  if(path.endsWith('/bookings/2/extend-stay')){
   const body=route.request().postDataJSON();
   saved=body.expectedNightlyMinor===250000;
   return route.fulfill({json:{data:{
    checkOut:'2026-11-28',nights:1,nightlyMinor:250000,subtotalMinor:250000,currency:'PHP',saved,
   }}});
  }
  if(path.endsWith('/bookings/2/settlement-statement')){
   if(saved)await billPending;
   const amount=saved?500000:250000;
   return route.fulfill({json:{data:{
    hotelId:'1',bookingId:'2',folioId:'2',reservationReference:'TEST-EXTENSION',
    checkIn:'2026-11-26',checkOut:saved?'2026-11-28':'2026-11-27',status:'checked_in',currency:'PHP',
    charges:[{id:'1',type:'room_night',description:'Room charges',stayDate:null,amountMinor:amount}],
    adjustments:[],payments:[],allocations:[],taxAllocations:[],refunds:[],verifiedRefundsMinor:0,
    netRecordedChargesMinor:amount,verifiedPaymentsMinor:0,verifiedAllocatedMinor:0,
    unallocatedVerifiedDepositsMinor:0,remainingMinor:amount,
    blockers:[],canSignOff:false,signed:false,signedSnapshotIntegrity:false,signedSnapshotSha256:null,
    signedAt:null,signedBy:null,isTaxInvoice:false,bankOrGatewayApiVerified:false,
    paymentEvidenceIndependentlyReviewed:true,settlementWorkflowEnabled:true,
   }}});
  }
  return route.fulfill({status:404,json:{message:'Outside extension fixture'}});
 });
 await page.goto('http://127.0.0.1:5174/reservations?booking=2');
 const bill=page.locator('[aria-label="Guest bill and payment status"]');
 await expect(bill).toContainText('₱2,500.00');
 await page.getByRole('button',{name:'Extend stay',exact:true}).click();
 const dialog=page.getByRole('dialog',{name:'Extend stay'});
 await dialog.getByRole('button',{name:'Check availability and rate'}).click();
 const refresh=page.waitForRequest(request=>saved&&request.url().endsWith('/bookings/2/settlement-statement'));
 await dialog.getByRole('button',{name:'Confirm extension'}).click();
 await refresh;
 try{
  await expect(dialog.getByRole('button',{name:'Done',exact:true})).toBeHidden();
 }finally{
  releaseBill();
 }
 await dialog.getByRole('button',{name:'Done',exact:true}).click();
 await expect(dialog).toBeHidden();
 await expect(bill).toContainText('₱5,000.00');
 await expect(bill).not.toContainText('₱2,500.00');
});
