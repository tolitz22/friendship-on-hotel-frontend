import {test,expect,type Page} from '@playwright/test';

/**
 * Phase 43: actual React UI and deployed Laravel, never mocked responses.
 * This suite mutates only an explicitly allowlisted disposable staging hotel.
 * No screenshots, trace, video or personally identifiable real guest data.
 */
const env=(name:string)=>process.env[name]!;
const hotelId=env('PMS_STAGING_TEST_HOTEL_ID');
const apiOrigin=new URL(env('PMS_STAGING_API_URL')).origin;
const apiBase=apiOrigin+'/api/v1/hotels/'+hotelId;
const tokenMode=process.env.PMS_STAGING_AUTH_MODE==='token';
type FolioSummary={bankOrGatewayVerified:boolean;isSettled:boolean;staffConfirmedPaymentsMinor:number};
const matching=(path:string,method:string)=> (response:{url():string;request():{method():string}})=>
 response.url().startsWith(apiBase+path)&&response.request().method()===method;
const today=()=>{
 const parts=new Intl.DateTimeFormat('en-US',{
  timeZone:'Asia/Manila',year:'numeric',month:'2-digit',day:'2-digit',
 }).formatToParts(new Date());
 const value=(key:string)=>parts.find(part=>part.type===key)!.value;
 return value('year')+'-'+value('month')+'-'+value('day');
};
const tomorrow=()=>{
 const parts=today().split('-').map(Number);
 return new Date(Date.UTC(parts[0],parts[1]-1,parts[2]+1)).toISOString().slice(0,10);
};
async function signIn(page:Page):Promise<string|null>{
 await page.goto('/');
 await expect(page.getByText(tokenMode?'Staff sign-in · Laravel API development environment':'Staff sign-in · Secure Laravel browser session')).toBeVisible();
 await page.getByLabel('Email address').fill(env('PMS_STAGING_STAFF_EMAIL'));
 await page.getByLabel('Password').fill(env('PMS_STAGING_STAFF_PASSWORD'));
 const loginResponse=tokenMode?page.waitForResponse(r=>
  r.url()===apiOrigin+'/api/v1/auth/login'&&r.request().method()==='POST'
 ):null;
 await page.getByRole('button',{name:'Sign in',exact:true}).click();
 let bearerToken:string|null=null;
 if(loginResponse){
  const login=await loginResponse;
  expect(login.status()).toBe(200);
  const json=await login.json() as {data:{token:string}};
  bearerToken=json.data.token;
  expect(bearerToken.length).toBeGreaterThan(10);
 }
 const chooser=page.getByRole('heading',{name:'Choose a property'});
 await Promise.race([
  chooser.waitFor({state:'visible'}),
  page.getByText('LIVE HOTEL DATA').first().waitFor({state:'visible'}),
 ]);
 if(await chooser.isVisible()){
  // Only the dedicated configured hotel may be selected.
  const choice=page.locator('.auth-hotel-list button').filter({hasText:env('PMS_STAGING_TEST_HOTEL_NAME')});
  await expect(choice).toHaveCount(1);
  await choice.click();
 }
 await expect(page.getByText('LIVE HOTEL DATA').first()).toBeVisible();
 await expect(page.getByLabel('Selected hotel')).toHaveValue(hotelId);
 return bearerToken;
}
test('real React guest → booking → room assignment → check-in and Laravel payment evidence',async({page})=>{
 const bearerToken=await signIn(page);
 const suffix=Date.now().toString(36);
 const first='Synthetic';
 const last='Staging'+suffix;
 await page.getByRole('navigation',{name:'Hotel workspace navigation'}).getByRole('link',{name:'Guests'}).click();
 await page.getByRole('button',{name:'Add guest'}).click();
 const dialog=page.getByRole('dialog',{name:'Add guest'});
 await dialog.getByLabel('First name').fill(first);
 await dialog.getByLabel('Last name').fill(last);
 await dialog.getByLabel('Email').fill('synthetic-'+suffix+'@example.test');
 const guestPost=page.waitForResponse(response=>matching('/guests','POST')(response));
 await dialog.getByRole('button',{name:'Save guest'}).click();
 const guestResponse=await guestPost;
 expect(guestResponse.status()).toBe(201);
 const guestPayload=await guestResponse.json() as {data:{id:string}};
 expect(guestPayload.data.id).toMatch(/^[1-9]\d*$/);

 await page.getByRole('navigation',{name:'Hotel workspace navigation'}).getByRole('link',{name:'Reservations'}).click();
 await expect(page.getByRole('heading',{name:'Reservations'}).first()).toBeVisible();
 await page.locator('#book-guest').selectOption(guestPayload.data.id);
 await page.locator('#book-roomtype').selectOption(env('PMS_STAGING_TEST_ROOM_TYPE_ID'));
 await page.locator('#book-checkin').fill(today());
 await page.locator('#book-checkout').fill(tomorrow());
 await page.locator('#book-rate').selectOption(env('PMS_STAGING_TEST_RATE_PLAN_ID'));
 await page.getByRole('button',{name:'Check availability'}).click();
 await expect(page.getByText('Available',{exact:true})).toBeVisible();
 await expect(page.getByText('Room subtotal',{exact:true})).toBeVisible();
 const bookingPost=page.waitForResponse(response=>matching('/bookings','POST')(response));
 await page.getByRole('button',{name:'Confirm reservation'}).click();
 const booked=await bookingPost;
 expect(booked.status()).toBe(201);
 const booking=await booked.json() as {data:{id:string;reference:string;status:string}};
 expect(booking.data.status).toBe('confirmed');
 await expect(page.getByText('Reservation confirmed')).toBeVisible();

 await page.getByRole('link',{name:'Assign room'}).click();
 await expect(page.getByText('Selected booking · #'+booking.data.id)).toBeVisible();
 await page.locator('#operation-room').selectOption(env('PMS_STAGING_TEST_ROOM_ID'));
 const assignment=page.waitForResponse(response=>matching('/bookings/'+booking.data.id+'/assign-room','PATCH')(response));
 await page.getByRole('button',{name:'Assign selected room'}).click();
 expect((await assignment).status()).toBe(200);
 await expect(page.getByRole('button',{name:'Confirm guest check-in'})).toBeVisible();

 await page.getByLabel('I have separately checked the guest identity, physical room and housekeeping readiness.').check();
 await expect(page.getByRole('button',{name:'Confirm guest check-in'})).toBeEnabled();
 const checkIn=page.waitForResponse(response=>matching('/bookings/'+booking.data.id+'/check-in','POST')(response));
 await page.getByRole('button',{name:'Confirm guest check-in'}).click();
 expect((await checkIn).status()).toBe(200);
 await expect(page.getByText('In house', {exact:true})).toBeVisible();

 // Phase 62.5: cash is NEVER created through direct payment-records.
 // It must belong to this employee's open shift and remain pending independent review.
 const shiftBase=apiBase+'/cashier-shifts';
 const ledgerPath=apiBase+'/bookings/'+booking.data.id+'/folio-ledger';
 const cashReference='SYNTHETIC-CASH-'+suffix;
 const paymentKey='phase625-cash-'+suffix;
 type CashAcceptance={shiftId:string;paymentId:string;replayed:boolean;
  pendingStatus:string;summary:FolioSummary};
 let cash:CashAcceptance;
 if(tokenMode){
  if(!bearerToken)throw new Error('Missing staging login token.');
  const headers={Authorization:'Bearer '+bearerToken,Accept:'application/json'};
  const opened=await page.request.post(shiftBase,{headers,data:{openingFloatMinor:10000}});
  expect(opened.status()).toBe(201);
  const shift=await opened.json() as {data:{id:string;status:string}};
  expect(shift.data.status).toBe('open');
  const url=shiftBase+'/'+shift.data.id+'/bookings/'+booking.data.id+'/cash-receipts';
  const input={requestKey:paymentKey,reference:cashReference,amountMinor:100};
  const recorded=await page.request.post(url,{headers,data:input});
  expect(recorded.status()).toBe(201);
  const receipt=await recorded.json() as {data:{paymentId:string;status:string;replayed:boolean}};
  const replay=await page.request.post(url,{headers,data:input});
  expect(replay.status()).toBe(200);
  const repeated=await replay.json() as {data:{paymentId:string;replayed:boolean}};
  expect(repeated.data.paymentId).toBe(receipt.data.paymentId);
  const ledger=await page.request.get(ledgerPath,{headers});
  expect(ledger.status()).toBe(200);
  const body=await ledger.json() as {data:{summary:FolioSummary}};
  cash={shiftId:shift.data.id,paymentId:receipt.data.paymentId,
   pendingStatus:receipt.data.status,replayed:repeated.data.replayed,summary:body.data.summary};
 }else{
  cash=await page.evaluate(async input=>{
   const csrf=document.cookie.split(';').map(v=>v.trim()).find(v=>v.startsWith('XSRF-TOKEN='));
   if(!csrf)throw Error('Missing staging XSRF cookie.');
   const headers={'Accept':'application/json','Content-Type':'application/json',
    'X-XSRF-TOKEN':decodeURIComponent(csrf.slice('XSRF-TOKEN='.length))};
   const call=async(url:string,data:object)=>{
    const response=await fetch(url,{method:'POST',credentials:'include',headers,body:JSON.stringify(data)});
    if(!response.ok)throw Error('Staging request failed: HTTP '+response.status);
    return {status:response.status,body:await response.json()};
   };
   const opened=await call(input.shiftBase,{openingFloatMinor:10000});
   if(opened.status!==201)throw Error('Expected newly opened synthetic cash shift.');
   const shift=opened.body as {data:{id:string;status:string}};
   const url=input.shiftBase+'/'+shift.data.id+'/bookings/'+input.bookingId+'/cash-receipts';
   const payload={requestKey:input.paymentKey,reference:input.cashReference,amountMinor:100};
   const receiptCall=await call(url,payload);
   if(receiptCall.status!==201)throw Error('Expected new cash receipt.');
   const receipt=receiptCall.body as {data:{paymentId:string;status:string;replayed:boolean}};
   const replay=await call(url,payload);
   if(replay.status!==200)throw Error('Expected idempotent replay.');
   const repeated=replay.body as {data:{paymentId:string;replayed:boolean}};
   if(repeated.data.paymentId!==receipt.data.paymentId)throw Error('Cash receipt duplicated.');
   const ledger=await fetch(input.ledgerPath,{credentials:'include',headers});
   if(!ledger.ok)throw Error('Unable to verify folio ledger: '+ledger.status);
   const body=await ledger.json() as {data:{summary:FolioSummary}};
   return {shiftId:shift.data.id,paymentId:receipt.data.paymentId,
    pendingStatus:receipt.data.status,replayed:repeated.data.replayed,summary:body.data.summary};
  },{shiftBase,ledgerPath,bookingId:booking.data.id,paymentKey,cashReference});
 }
 expect(cash.shiftId).toMatch(/^[1-9]\d*$/);
 expect(cash.paymentId).toMatch(/^[1-9]\d*$/);
 expect(cash.pendingStatus).toBe('pending_review');
 expect(cash.replayed).toBe(true);
 expect(cash.summary.staffConfirmedPaymentsMinor).toBe(0);
 expect(cash.summary.bankOrGatewayVerified).toBe(false);
 expect(cash.summary.isSettled).toBe(false);
 // DO NOT self-approve a cash receipt or auto-reconcile a synthetic drawer.
 // Independent manager review is tested with separate identities in Laravel integration tests.

});

test('deployed React checks out a pre-seeded due synthetic stay and exposes turnover',async({page})=>{
 test.skip(!process.env.PMS_STAGING_CHECKOUT_BOOKING_ID,
  'Provide a fresh checked-in, departure-due synthetic reservation before testing checkout.');
 await signIn(page);
 // The fixture must already be checked_in, assigned to a room, and due on/before today.
 // This is distinct from the arrival-today booking above; no server clock bypass.
 const bookingId=env('PMS_STAGING_CHECKOUT_BOOKING_ID');
 await page.getByRole('navigation',{name:'Hotel workspace navigation'}).getByRole('link',{name:'Reservations'}).click();
 // Navigate the existing SPA records without reloading, which would clear memory-only tokens.
 const row=page.locator('tr').filter({has:page.getByText('Record #'+bookingId,{exact:true})});
 for(let index=0;index<30&&await row.count()===0;index++){
  const next=page.getByRole('button',{name:'Next page'});
  if(!await next.isEnabled())break;
  await next.click();
 }
 await expect(row).toHaveCount(1);
 await row.locator('button.reservation-reference-button').click();
 await expect(page.getByText('Selected booking · #'+bookingId)).toBeVisible();
 await expect(page.getByRole('button',{name:'Confirm guest check-out'})).toBeVisible();
 await page.getByLabel('I have independently reviewed departure timing and any financial follow-up.').check();
 const checkout=page.waitForResponse(response=>matching('/bookings/'+bookingId+'/check-out','POST')(response));
 await page.getByRole('button',{name:'Confirm guest check-out'}).click();
 expect((await checkout).status()).toBe(200);
 await expect(page.getByText('Checked out', {exact:true})).toBeVisible();
 await expect(page.getByRole('link',{name:/Open checkout task #/})).toBeVisible();
});


test('room calendar multi-night booking and inline synthetic guest registration',async({page})=>{
 await signIn(page);
 const arrivalDate=new Date(today()+'T00:00:00Z');
 arrivalDate.setUTCDate(arrivalDate.getUTCDate()+3);
 const arrival=arrivalDate.toISOString().slice(0,10);
 arrivalDate.setUTCDate(arrivalDate.getUTCDate()+2);
 const departure=arrivalDate.toISOString().slice(0,10);
 const suffix=Date.now().toString(36);
 const guestLastName='Calendar'+suffix;

 await page.getByRole('navigation',{name:'Hotel workspace navigation'})
  .getByRole('link',{name:'Room calendar'}).click();
 await page.getByRole('button',{name:'Month',exact:true}).click();
 if(arrival.slice(0,7)!==today().slice(0,7)){
  await page.getByRole('button',{name:'Next period'}).click();
 }
 const cell=page.getByRole('button',{name:new RegExp('^Room P43-101 on '+arrival+':')});
 await expect(cell).toBeVisible();
 await cell.click();
 const details=page.getByRole('dialog',{name:'Room P43-101'});
 await expect(details).toBeVisible();
 await details.locator('#room-departure').fill(departure);
 await expect(details.getByText('2 night(s)')).toBeVisible();
 await details.getByRole('link',{name:'Create reservation'}).click();
 await expect(page.locator('#book-checkin')).toHaveValue(arrival);
 await expect(page.locator('#book-checkout')).toHaveValue(departure);
 await expect(page.locator('#book-roomtype')).toHaveValue(env('PMS_STAGING_TEST_ROOM_TYPE_ID'));

 await page.getByRole('button',{name:'New guest'}).click();
 const guestDialog=page.getByRole('dialog',{name:'Register a guest'});
 await expect(guestDialog).toBeVisible();
 await guestDialog.getByLabel('First name').fill('Synthetic');
 await guestDialog.getByLabel('Last name').fill(guestLastName);
 await guestDialog.getByLabel('Email (optional)').fill('phase44-'+suffix+'@example.test');
 const guestPost=page.waitForResponse(response=>matching('/guests','POST')(response));
 await guestDialog.getByRole('button',{name:'Save and select guest'}).click();
 const guestResponse=await guestPost;
 expect(guestResponse.status()).toBe(201);
 const guest=await guestResponse.json() as {data:{id:string}};
 await expect(page.locator('#book-guest')).toHaveValue(guest.data.id);

 await page.locator('#book-rate').selectOption(env('PMS_STAGING_TEST_RATE_PLAN_ID'));
 await page.getByRole('button',{name:'Check availability'}).click();
 await expect(page.getByText('Available',{exact:true})).toBeVisible();
 const bookingPost=page.waitForResponse(response=>matching('/bookings','POST')(response));
 await page.getByRole('button',{name:'Confirm reservation'}).click();
 const bookingResponse=await bookingPost;
 expect(bookingResponse.status()).toBe(201);
 const booking=await bookingResponse.json() as {data:{id:string;reference:string}};
 await page.getByRole('link',{name:'Assign room'}).click();
 await expect(page.locator('#operation-room')).toHaveValue(env('PMS_STAGING_TEST_ROOM_ID'));
 const assigned=page.waitForResponse(response=>matching('/bookings/'+booking.data.id+'/assign-room','PATCH')(response));
 await page.getByRole('button',{name:'Assign selected room'}).click();
 expect((await assigned).status()).toBe(200);

 await page.getByRole('navigation',{name:'Hotel workspace navigation'})
  .getByRole('link',{name:'Room calendar'}).click();
 await page.getByRole('button',{name:'Month',exact:true}).click();
 if(arrival.slice(0,7)!==today().slice(0,7)){
  await page.getByRole('button',{name:'Next period'}).click();
 }
 await page.getByRole('button',{name:new RegExp('^Room P43-101 on '+arrival+':')}).click();
 const bookedDialog=page.getByRole('dialog',{name:'Room P43-101'});
 await expect(bookedDialog.getByText(guestLastName,{exact:false})).toBeVisible();
 await expect(bookedDialog.getByRole('link',{name:'View folio'})).toBeVisible();
});
