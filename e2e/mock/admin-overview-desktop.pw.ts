import {expect,test} from '@playwright/test';
test('admin desktop overview uses hotel totals, preserves navigation and provides working shortcuts',async({page},testInfo)=>{
 test.skip(testInfo.project.name!=='desktop-chromium');
 await page.setViewportSize({width:1600,height:950});
 await page.addInitScript(()=>{sessionStorage.setItem('foh.staff.bearer.v1','admin-overview-fixture');sessionStorage.setItem('foh.staff.hotel.v1','1');});
 let writes=0;
 const date=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Manila',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 await page.route('**/api/v1/**',async route=>{
  const url=new URL(route.request().url()),path=url.pathname;
  if(route.request().method()!=='GET'){writes++;return route.fulfill({status:400,json:{message:'Read-only fixture'}});}
  if(path.endsWith('/auth/me'))return route.fulfill({json:{data:{id:'1',name:'Demo Manager',email:'manager@example.test',hotels:[{id:'1',name:'Demo Hotel',role:'admin'}]}}});
  if(path.endsWith('/hotels/1'))return route.fulfill({json:{data:{id:'1',name:'Demo Hotel',timeZone:'Asia/Manila',currency:'PHP'}}});
  if(path.endsWith('/rooms/rack'))return route.fulfill({json:{data:{hotelId:'1',hotelDate:date,enforcedAtCheckIn:true,allowedActions:{completeInspection:true},rooms:[],arrivals:[],summary:{totalRooms:30,pmsVacantRooms:12,pmsOccupiedRooms:18,arrivalsToday:6,departuresToday:4,roomsNeedingCleaning:5,legacyPendingInspections:0,activelyBlockedRooms:0}},meta:{page:1,perPage:1,total:30,totalPages:30,snapshotOnly:true,availabilityGuaranteed:false,physicalOccupancyVerified:false,financialSettlementVerified:false}}}});
  if(path.endsWith('/front-desk/manifest')){
   const kind=url.searchParams.get('kind'),day=url.searchParams.get('date'),total=kind==='arrivals'?6:kind==='departures'?4:kind==='overdue'?1:18;
   const rows=[{id:'1',reference:'BK-001',guestId:'1',guestName:'Demo Guest',assignedRoomId:'1',roomNumber:'201',checkIn:day,checkOut:day,status:kind==='arrivals'?'confirmed':'checked_in'}];
   return route.fulfill({json:{data:rows,meta:{date:day,kind,page:1,perPage:Number(url.searchParams.get('per_page')??5),total,totalPages:total,determinesHousekeepingReadiness:false}}});
  }
  if(path.endsWith('/operational-exceptions'))return route.fulfill({json:{data:{hotelId:'1',asOfHotelDate:date,windowEndExclusive:date,summary:{total:0,critical:0,attention:0,review:0},items:[],activity:[{id:'1',bookingId:'1',reference:'BK-001',actorId:'1',actorName:'Demo Manager',eventType:'checked_in',createdAt:date+'T08:00:00Z'}]},meta:{readOnly:true,complete:true,isFraudDetermination:false,keycardLogsConnected:false,cctvEventsConnected:false,housekeepingPhysicalOccupancyConnected:false,sourceLimit:100,notes:'Fixture'}}});
  if(path.endsWith('/maintenance-work-orders'))return route.fulfill({json:{data:[],meta:{page:1,perPage:1,total:0,totalPages:0,affectsRoomDoesNotBlockInventory:true}}});
  if(path.endsWith('/approval-requests'))return route.fulfill({json:{data:[],meta:{page:1,perPage:20,total:0,totalPages:0}}});
  if(path.endsWith('/catalog-summary'))return route.fulfill({json:{data:{hotelId:'1',totalRooms:30,totalRoomTypes:0,roomTypes:[],floors:[]},meta:{isAvailability:false,isOccupancy:false,scope:'hotel'}}});
  if(path.endsWith('/reservation-records'))return route.fulfill({json:{data:[],meta:{page:1,perPage:20,total:0,totalPages:0,isAvailability:false}}});
  return route.fulfill({status:404,json:{message:'Outside overview fixture'}});
 });
 await page.goto('http://127.0.0.1:5174/');
 const home=page.locator('.ao-page');
 await expect(home.getByRole('heading',{name:'Overview',exact:true})).toBeVisible();
 await expect(home.locator('.ao-ring')).toContainText('60%');
 await expect(home.getByRole('link',{name:/Occupied in PMS/})).toContainText('18 / 30');
 await expect(home.locator('.ao-attention-row').first()).toContainText('1');
 await expect(home.getByRole('region',{name:'Recent activity'})).toContainText('Demo Manager');
 await expect(home.getByRole('link',{name:'Record expense'})).toHaveAttribute('href',/record=true/);
 await expect(home.getByRole('link',{name:'Assign room'})).toHaveAttribute('href',/filter=needs_room/);
 await expect(page.getByRole('navigation',{name:'Hotel workspace navigation'}).getByRole('link',{name:'Daily Closing'})).toBeVisible();
 const top=page.locator('.topbar');
 await expect(top.getByLabel('Selected hotel')).toBeVisible();
 await expect(top.getByRole('button',{name:/^Notifications/})).toBeVisible();
 await top.locator('.admin-profile summary').click();
 await expect(top.getByRole('link',{name:'Account security'})).toBeVisible();
 await top.locator('.admin-profile summary').press('Escape');
 await expect(top.getByRole('link',{name:'Account security'})).toBeHidden();
 await expect(home.getByRole('button',{name:'Departures (4)'})).toBeVisible();
 await home.getByRole('button',{name:'Departures (4)'}).click();
 await expect(home.getByRole('link',{name:'Check out',exact:true}).first()).toBeVisible();
 expect(await home.evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBeTruthy();
 const search=top.getByRole('textbox',{name:'Search bookings'});
 await search.fill('Demo Guest');
 await search.press('Enter');
 await expect(page).toHaveURL(/q=Demo/);
 expect(writes).toBe(0);
});
