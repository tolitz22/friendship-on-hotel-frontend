import {test,expect} from '@playwright/test';

for(const width of [320,390,430,1280]){
 test('reception overview shows live metrics and role-safe navigation at '+width+'px',async({page},testInfo)=>{
  test.skip(testInfo.project.name!==(width<768?'mobile-chromium':'desktop-chromium'));
  await page.setViewportSize({width,height:844});
  await page.addInitScript(()=>{sessionStorage.setItem('foh.staff.bearer.v1','reception-overview-fixture');sessionStorage.setItem('foh.staff.hotel.v1','1');});
  const date=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Manila',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  let writes=0;
  await page.route('**/api/v1/**',async route=>{
   const url=new URL(route.request().url()),path=url.pathname;
   if(route.request().method()!=='GET'){writes++;return route.fulfill({status:400,json:{message:'Read-only fixture'}});}
   if(path.endsWith('/auth/me'))return route.fulfill({json:{data:{id:'2',name:'Receptionist',email:'desk@example.test',hotels:[{id:'1',name:'Demo Hotel',role:'front_desk',permissions:['reservation.read','booking.create','booking.check_in','booking.check_out','guest.read','finance.read']}]}}});
   if(path.endsWith('/hotels/1'))return route.fulfill({json:{data:{id:'1',name:'Demo Hotel',timeZone:'Asia/Manila',currency:'PHP'}}});
   if(path.endsWith('/rooms/rack'))return route.fulfill({json:{data:{hotelId:'1',hotelDate:date,enforcedAtCheckIn:true,allowedActions:{completeInspection:false},rooms:[],arrivals:[],summary:{totalRooms:30,pmsOccupiedRooms:18,pmsVacantRooms:12,arrivalsToday:6,departuresToday:4,roomsNeedingCleaning:1,legacyPendingInspections:0,activelyBlockedRooms:0}},meta:{page:1,perPage:1,total:30,totalPages:30,snapshotOnly:true,availabilityGuaranteed:false,physicalOccupancyVerified:false,financialSettlementVerified:false}}}});
   if(path.endsWith('/front-desk/manifest')){
    const kind=url.searchParams.get('kind'),total=kind==='arrivals'?6:kind==='departures'?4:kind==='overdue'?1:18;
    return route.fulfill({json:{data:[],meta:{date:url.searchParams.get('date'),kind,page:1,perPage:1,total,totalPages:total,determinesHousekeepingReadiness:false}}});
   }
   return route.fulfill({status:404,json:{message:'Outside overview fixture'}});
  });
  await page.goto('http://127.0.0.1:5174/');
  const home=page.locator('.fd-home');
  await expect(home.getByRole('heading',{name:'Front desk overview'})).toBeVisible();
  await expect(home.getByRole('link',{name:/Occupied in PMS/})).toContainText('18 / 30');
  await expect(home.getByRole('link',{name:/Vacant in PMS/})).toContainText('12');
  await expect(home.getByRole('link',{name:/Arrivals today/})).toContainText('6');
  await expect(home.getByRole('link',{name:/Departures today/})).toContainText('4');
  await expect(home.getByRole('link',{name:'New booking'})).toHaveAttribute('href',/mode=new/);
  await expect(home.getByRole('link',{name:'Check in',exact:true})).toHaveAttribute('href',/queue=arrivals/);
  await expect(home.getByRole('link',{name:'Check out',exact:true})).toHaveAttribute('href',/queue=departures/);
  await expect(home.getByRole('link',{name:'Extend stay'})).toHaveAttribute('href',/queue=in_house/);
  await expect(home.getByRole('link',{name:/Overdue checkouts/})).toBeVisible();
  if(width<768){
   const nav=page.getByRole('navigation',{name:'Front desk mobile navigation'});
   await expect(nav).toBeVisible();
   await expect(nav.getByRole('link',{name:'Overview'})).toHaveAttribute('aria-current','page');
   await expect(nav.getByRole('link',{name:'Reports'})).toHaveCount(0);
   await expect(page.getByRole('button',{name:'Open navigation'})).toBeVisible();
   await expect(page.locator('.hk-mobile-brand')).toContainText('Demo Hotel');
   await nav.getByRole('button',{name:'Profile'}).click();
   await expect(page.getByRole('dialog',{name:'Workspace navigation'}).getByText('Current hotel')).toBeVisible();
   await page.getByRole('button',{name:'Close menu'}).click();
   await expect(nav.getByRole('button',{name:'Profile'})).toBeFocused();
  }
  expect(await home.evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBeTruthy();
  expect(writes).toBe(0);
 });
}
