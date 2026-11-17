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
const today=()=>new Intl.DateTimeFormat('en-CA',{
 timeZone:'Asia/Manila',year:'numeric',month:'2-digit',day:'2-digit',
}).format(new Date());
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
 await expect(page.getByRole('heading',{name:'Reservations'})).toBeVisible();
 await page.locator('#book-guest').selectOption(guestPayload.data.id);
 await page.locator('#book-roomtype').selectOption(env('PMS_STAGING_TEST_ROOM_TYPE_ID'));
 await page.locator('#book-checkin').fill(today());
 await page.locator('#book-checkout').fill(tomorrow());
 await page.locator('#book-rate').selectOption(env('PMS_STAGING_TEST_RATE_PLAN_ID'));
 await page.getByRole('button',{name:'Step 2 · Check availability and room subtotal'}).click();
 await expect(page.getByText('Currently bookable')).toBeVisible();
 await expect(page.getByText('Room subtotal:',{exact:false})).toBeVisible();
 const bookingPost=page.waitForResponse(response=>matching('/bookings','POST')(response));
 await page.getByRole('button',{name:'Step 3 · Confirm and create booking'}).click();
 const booked=await bookingPost;
 expect(booked.status()).toBe(201);
 const booking=await booked.json() as {data:{id:string;reference:string;status:string}};
 expect(booking.data.status).toBe('confirmed');
 await expect(page.getByText('Reservation confirmed by Laravel')).toBeVisible();

 await page.getByRole('link',{name:'Open this booking and assign a room'}).click();
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

 // This confirms an actual authenticated browser-to-Laravel write.
 // A staff confirmation is NOT proof of bank/gateway settlement.
 const paymentPath=apiBase+'/bookings/'+booking.data.id;
 let result:{status:string;reviewStatus:string;summary:FolioSummary};
 if(tokenMode){
  if(!bearerToken)throw new Error('No staging bearer token captured from login.');
  const headers={Authorization:'Bearer '+bearerToken,Accept:'application/json'};
  const record=await page.request.post(paymentPath+'/payment-records',{
   headers,data:{requestKey:'phase43-staging-'+suffix+'-payment',
    method:'cash',reference:'SYNTHETIC-'+suffix,amountMinor:100},
  });
  expect(record.status()).toBe(201);
  const payment=await record.json() as {data:{id:string;status:string}};
  const review=await page.request.post(paymentPath+'/payment-records/'+payment.data.id+'/review',{
   headers,data:{decision:'confirm',note:'Synthetic staging cash evidence review only'},
  });
  expect(review.status()).toBe(200);
  const reviewed=await review.json() as {data:{status:string}};
  const ledger=await page.request.get(paymentPath+'/folio-ledger',{headers});
  expect(ledger.status()).toBe(200);
  const body=await ledger.json() as {data:{summary:FolioSummary}};
  result={status:payment.data.status,reviewStatus:reviewed.data.status,summary:body.data.summary};
 }else{
  result=await page.evaluate(async(input)=>{
   const csrf=document.cookie.split(';').map(v=>v.trim()).find(v=>v.startsWith('XSRF-TOKEN='));
   if(!csrf)throw new Error('Staging requires same-site XSRF cookie.');
   const headers={'Accept':'application/json','Content-Type':'application/json',
    'X-XSRF-TOKEN':decodeURIComponent(csrf.slice('XSRF-TOKEN='.length))};
   const record=await fetch(input.path+'/payment-records',{
    method:'POST',credentials:'include',headers,
    body:JSON.stringify({requestKey:'phase43-staging-'+input.suffix+'-payment',
     method:'cash',reference:'SYNTHETIC-'+input.suffix,amountMinor:100}),
   });
   if(record.status!==201)throw new Error('Payment evidence HTTP '+record.status);
   const payment=await record.json() as {data:{id:string;status:string}};
   const review=await fetch(input.path+'/payment-records/'+payment.data.id+'/review',{
    method:'POST',credentials:'include',headers,
    body:JSON.stringify({decision:'confirm',note:'Synthetic staging cash evidence review only'}),
   });
   if(!review.ok)throw new Error('Payment review HTTP '+review.status);
   const reviewed=await review.json() as {data:{status:string}};
   const ledger=await fetch(input.path+'/folio-ledger',{credentials:'include',headers});
   if(!ledger.ok)throw new Error('Folio ledger HTTP '+ledger.status);
   const body=await ledger.json() as {data:{summary:{bankOrGatewayVerified:boolean;
    isSettled:boolean;staffConfirmedPaymentsMinor:number}}};
   return {status:payment.data.status,reviewStatus:reviewed.data.status,summary:body.data.summary};
  },{path:paymentPath,suffix});
 }
 expect(result.status).toBe('pending_review');
 expect(result.reviewStatus).toBe('staff_confirmed');
 expect(result.summary.staffConfirmedPaymentsMinor).toBeGreaterThanOrEqual(100);
 expect(result.summary.bankOrGatewayVerified).toBe(false);
 expect(result.summary.isSettled).toBe(false);
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
