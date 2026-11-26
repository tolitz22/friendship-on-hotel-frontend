import {expect,test} from '@playwright/test';

test('guest statement shows the pending transfer and applied amount on screen and print',async({page})=>{
 await page.addInitScript(()=>{
  sessionStorage.setItem('foh.staff.bearer.v1','statement-fixture');
  sessionStorage.setItem('foh.staff.hotel.v1','1');
 });
 await page.route('**/api/v1/**',async route=>{
  const path=new URL(route.request().url()).pathname;
  if(path.endsWith('/auth/me'))return route.fulfill({json:{data:{
   id:'1',name:'Demo manager',email:'manager@example.test',hotels:[{id:'1',name:'Demo hotel',role:'admin'}],
  }}});
  if(path.endsWith('/bookings/2/settlement-statement'))return route.fulfill({json:{data:{
   hotelId:'1',bookingId:'2',folioId:'2',reservationReference:'DEMO-STATEMENT',
   checkIn:'2026-11-24',checkOut:'2026-11-27',status:'confirmed',currency:'PHP',
   charges:[{id:'1',type:'room_night',description:'Room charges',stayDate:null,amountMinor:750000}],
   adjustments:[],payments:[{
    id:'4',method:'bank_transfer',reference:'DEMO-TRANSFER',amountMinor:250000,status:'pending_review',
    verificationStatus:null,verificationId:null,verificationPreparedBy:null,evidenceKind:null,evidenceReference:null,
   }],allocations:[],taxAllocations:[],refunds:[],verifiedRefundsMinor:0,netRecordedChargesMinor:750000,
   verifiedPaymentsMinor:0,verifiedAllocatedMinor:0,unallocatedVerifiedDepositsMinor:0,remainingMinor:750000,
   blockers:[],canSignOff:false,signed:false,signedSnapshotIntegrity:false,signedSnapshotSha256:null,
   signedAt:null,signedBy:null,isTaxInvoice:false,bankOrGatewayApiVerified:false,
   paymentEvidenceIndependentlyReviewed:false,settlementWorkflowEnabled:false,
  }}});
  await route.fulfill({status:404,json:{message:'Outside statement fixture'}});
 });
 await page.goto('http://127.0.0.1:5174/billing?booking=2');
 const paymentHub=page.getByRole('region',{name:'Front desk payment and checkout'});
 await expect(paymentHub.getByRole('button',{name:'Confirm recorded payment'})).toHaveClass('btn-primary');
 await expect(paymentHub.getByRole('button',{name:/Record additional payment/})).toHaveClass('rr-secondary-action');
 await page.getByText('View itemized bill and payment history',{exact:true}).click();
 const statement=page.getByLabel('Printable guest checkout statement');
 for(const media of ['screen','print'] as const){
  await page.emulateMedia({media});
  await expect(statement.getByText('₱2,500 bank transfer recorded; staff review pending.',{exact:true})).toBeVisible();
  await expect(statement.locator('.settlement-metric').filter({hasText:'Verified payments applied'}).locator('strong')).toHaveText('₱0.00');
  await expect(statement).not.toContainText('Payment evidence has been reviewed by staff');
 }
});
