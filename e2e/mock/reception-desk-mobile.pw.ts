import {expect,test} from '@playwright/test';
for(const width of [320,390,430,1280]){
 test('reception desk retains overdue alert during searches at '+width+'px',async({page},testInfo)=>{
  test.skip(testInfo.project.name!==(width<768?'mobile-chromium':'desktop-chromium'));
  await page.setViewportSize({width,height:844});
  await page.addInitScript(()=>{sessionStorage.setItem('foh.staff.bearer.v1','reception-desk-fixture');sessionStorage.setItem('foh.staff.hotel.v1','1');});
  let writes=0;
  await page.route('**/api/v1/**',async route=>{
   const url=new URL(route.request().url()),path=url.pathname;
   if(route.request().method()!=='GET'){writes++;return route.fulfill({status:400,json:{message:'Read-only fixture'}});}
   if(path.endsWith('/auth/me'))return route.fulfill({json:{data:{id:'2',name:'Receptionist',email:'desk@example.test',hotels:[{id:'1',name:'Demo Hotel',role:'front_desk',permissions:['reservation.read','booking.create','booking.assign_room','booking.check_in','booking.check_out']}]}}});
   if(path.endsWith('/hotels/1'))return route.fulfill({json:{data:{id:'1',name:'Demo Hotel',timeZone:'Asia/Manila',currency:'PHP'}}});
   if(path.endsWith('/front-desk/notifications'))return route.fulfill({json:{data:{hotelId:'1',notifications:[{id:'overdue:2',kind:'checkout_overdue',bookingId:'2',reference:'BK-002',date:'2026-11-27'}],hasMore:false}}});
   if(path.endsWith('/front-desk/manifest')){
    const kind=url.searchParams.get('kind'),date=url.searchParams.get('date')??'2026-11-27',q=url.searchParams.get('q');
    const arrival=kind==='arrivals';
    const rows=q?[]:[{id:arrival?'1':'2',reference:arrival?'BK-001':'BK-002',guestId:'1',guestName:arrival?'Demo Arrival':'Demo Departure',assignedRoomId:arrival?'1':'2',roomNumber:arrival?'201':'202',checkIn:date,checkOut:date,status:arrival?'confirmed':'checked_in'}];
    return route.fulfill({json:{data:rows,meta:{date,kind,page:1,perPage:Number(url.searchParams.get('per_page')??20),total:rows.length,totalPages:1,determinesHousekeepingReadiness:false}}});
   }
   return route.fulfill({status:404,json:{message:'Outside desk fixture'}});
  });
  await page.goto('http://127.0.0.1:5174/front-desk');
  const desk=page.locator('.fdc-reception'),alert=desk.locator('.fdc-overdue-alert');
  await expect(desk.getByRole('region',{name:'Arrivals',exact:true})).toContainText('Demo Arrival');
  await expect(desk.getByRole('region',{name:'Departures',exact:true})).toContainText('Demo Departure');
  await expect(desk.getByRole('region',{name:'Arrivals',exact:true}).locator('.rd-room-warning')).toHaveText('Readiness not verified');
  await expect(desk.getByRole('region',{name:'Departures',exact:true}).locator('.rd-room-warning')).toHaveCount(0);
  await expect(desk.getByText('Current room checks:',{exact:true})).toHaveCount(0);
  await desk.getByRole('region',{name:'Arrivals',exact:true}).getByRole('button',{name:'View all'}).click();
  await expect(desk.getByText('Current room checks:',{exact:true})).toHaveCount(0);
  await desk.getByRole('group',{name:'Front desk views'}).getByRole('button',{name:'Today',exact:true}).click();
  await expect(desk.getByRole('region',{name:'Arrivals',exact:true})).toBeVisible();
  await expect(alert).toContainText('1 overdue checkout needs attention');
  if(width<768){
   const refresh=desk.getByRole('button',{name:'Refresh front desk'});
   const refreshSize=await refresh.boundingBox();
   expect(refreshSize!.width).toBeLessThanOrEqual(48);
   expect(refreshSize!.height).toBeGreaterThanOrEqual(44);
   const review=alert.getByRole('button',{name:'Review overdue checkouts'});
   const alertSize=await alert.boundingBox(),reviewSize=await review.boundingBox();
   expect(reviewSize!.width).toBeLessThan(alertSize!.width/2);
   expect(alertSize!.height).toBeLessThanOrEqual(115);
   const row=desk.locator('.rd-guest').first();
   expect((await row.boundingBox())!.height).toBeLessThan(170);
   await expect(row.getByRole('link',{name:/Review check-in/})).toBeVisible();
   const newBooking=desk.getByRole('link',{name:'New booking',exact:true});
   expect(await newBooking.evaluate(el=>getComputedStyle(el).position)).not.toBe('fixed');
   await expect(page.locator('.topbar .hk-mobile-brand')).toBeVisible();
   await expect(page.getByRole('button',{name:'Open navigation'})).toBeVisible();
  }
  const search=desk.getByRole('searchbox',{name:'Search guest, booking or room'});
  await search.fill('no match');
  await expect(desk.getByText('No matching bookings.')).toHaveCount(2);
  await expect(alert).toBeVisible();
  await alert.getByRole('button',{name:'Review overdue checkouts'}).click();
  await expect(desk.getByRole('heading',{name:'Overdue checkouts',exact:true})).toBeVisible();
  await expect(desk.getByText('Demo Departure')).toBeVisible();
  await search.fill('no match');
  await expect(desk.getByText('No matching overdue checkouts.')).toBeVisible();
  await expect(alert).toContainText('1 overdue checkout needs attention');
  expect(await desk.evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBeTruthy();
  if(width<768){
   const nav=page.getByRole('navigation',{name:'Front desk mobile navigation'});
   await expect(nav.getByRole('link',{name:'Front desk',exact:true})).toHaveAttribute('aria-current','page');
   await nav.getByRole('link',{name:'Overview'}).click();
  }else await page.getByRole('navigation',{name:'Hotel workspace navigation'}).getByRole('link',{name:'Overview'}).click();
  const toast=page.locator('.fd-overdue-toast');
  await expect(toast).toBeVisible();
  await toast.getByRole('button',{name:'Dismiss overdue checkout alert'}).click();
  await expect(toast).toHaveCount(0);
  await page.reload();
  await expect(page.locator('.fd-home')).toBeVisible();
  await expect(page.locator('.fd-overdue-toast')).toHaveCount(0);
  expect(writes).toBe(0);
 });
}
