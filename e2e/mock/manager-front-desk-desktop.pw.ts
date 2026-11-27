import {expect,test} from '@playwright/test';
test('manager front desk keeps four queues, date controls and guarded actions',async({page},testInfo)=>{
 test.skip(testInfo.project.name!=='desktop-chromium');
 await page.setViewportSize({width:1600,height:950});
 await page.addInitScript(()=>{sessionStorage.setItem('foh.staff.bearer.v1','manager-desk-fixture');sessionStorage.setItem('foh.staff.hotel.v1','1');});
 let writes=0;
 const date=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Manila',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 await page.route('**/api/v1/**',async route=>{
  const url=new URL(route.request().url()),path=url.pathname;
  if(route.request().method()!=='GET'){writes++;return route.fulfill({status:400,json:{message:'Read-only fixture'}});}
  if(path.endsWith('/auth/me'))return route.fulfill({json:{data:{id:'1',name:'Demo Manager',email:'manager@example.test',hotels:[{id:'1',name:'Demo Hotel',role:'admin'}]}}});
  if(path.endsWith('/hotels/1'))return route.fulfill({json:{data:{id:'1',name:'Demo Hotel',timeZone:'Asia/Manila',currency:'PHP'}}});
  if(path.endsWith('/rooms/rack'))return route.fulfill({json:{data:{hotelId:'1',hotelDate:date,enforcedAtCheckIn:true,allowedActions:{completeInspection:true},rooms:[],arrivals:[],summary:{totalRooms:30,pmsVacantRooms:12,pmsOccupiedRooms:18,arrivalsToday:6,departuresToday:4,roomsNeedingCleaning:5,legacyPendingInspections:0,activelyBlockedRooms:0}},meta:{page:1,perPage:1,total:30,totalPages:30,snapshotOnly:true,availabilityGuaranteed:false,physicalOccupancyVerified:false,financialSettlementVerified:false}}});
  if(path.endsWith('/front-desk/manifest')){
   const kind=url.searchParams.get('kind'),day=url.searchParams.get('date'),total=kind==='arrivals'?(day===date?6:2):kind==='departures'?4:kind==='overdue'?1:18;
   const rows=url.searchParams.get('q')?[]:[{id:'1',reference:'BK-001',guestId:'1',guestName:'Demo Guest',assignedRoomId:'1',roomNumber:'201',checkIn:day,checkOut:day,status:kind==='arrivals'?'confirmed':'checked_in'},...(kind==='arrivals'?[{id:'2',reference:'BK-002',guestId:'2',guestName:'Unassigned Guest',assignedRoomId:null,roomNumber:null,checkIn:day,checkOut:day,status:'confirmed'}]:[])];
   return route.fulfill({json:{data:rows,meta:{date:day,kind,page:1,perPage:Number(url.searchParams.get('per_page')??5),total:url.searchParams.get('q')?0:total,queueTotal:total,unassignedCount:kind==='arrivals'?1:0,totalPages:1,determinesHousekeepingReadiness:false}}});
  }
  if(path.endsWith('/operational-exceptions'))return route.fulfill({json:{data:{hotelId:'1',asOfHotelDate:date,windowEndExclusive:date,summary:{total:0,critical:0,attention:0,review:0},items:[],activity:[{id:'1',bookingId:'1',reference:'BK-001',actorId:'1',actorName:'Demo Manager',eventType:'checked_in',createdAt:date+'T08:00:00Z'}]},meta:{readOnly:true,complete:true,isFraudDetermination:false,keycardLogsConnected:false,cctvEventsConnected:false,housekeepingPhysicalOccupancyConnected:false,sourceLimit:100,notes:'Fixture'}}});
  if(path.endsWith('/maintenance-work-orders'))return route.fulfill({json:{data:[],meta:{page:1,perPage:1,total:0,totalPages:0,affectsRoomDoesNotBlockInventory:true}}});
  if(path.endsWith('/approval-requests'))return route.fulfill({json:{data:[],meta:{page:1,perPage:20,total:0,totalPages:0}}});
  if(path.endsWith('/catalog-summary'))return route.fulfill({json:{data:{hotelId:'1',totalRooms:30,totalRoomTypes:0,roomTypes:[],floors:[]},meta:{isAvailability:false,isOccupancy:false,scope:'hotel'}}});
  if(path.endsWith('/reservation-records'))return route.fulfill({json:{data:[],meta:{page:1,perPage:20,total:0,totalPages:0,isAvailability:false}}});
  return route.fulfill({status:404,json:{message:'Outside overview fixture'}});
 });
 await page.goto('http://127.0.0.1:5174/front-desk');
 const desk=page.locator('.mdesk');
 await expect(desk.getByRole('heading',{name:'Front desk',exact:true})).toBeVisible();
 await expect(page.getByRole('navigation',{name:'Hotel workspace navigation'}).getByRole('link',{name:'Overview',exact:true})).toBeVisible();
 for(const name of ['Arrivals','Departures','In-house guests','Overdue checkouts'])await expect(desk.getByRole('region',{name,exact:true})).toBeVisible();
 await expect(desk.getByRole('region',{name:'Arrivals',exact:true}).getByRole('link',{name:'Assign room · Unassigned Guest'})).toHaveAttribute('href',/deskAction=assign/);
 await expect(desk.getByRole('region',{name:'Arrivals',exact:true}).getByRole('link',{name:/Review check-in/})).toHaveAttribute('href',/deskAction=check-in/);
 await expect(desk.getByRole('region',{name:'Overdue checkout priority'})).toContainText('1 overdue checkout');
 await expect(desk.getByRole('link',{name:'Walk-in booking'})).toHaveAttribute('href',new RegExp('checkIn='+date));
 await expect(desk.getByText('Current room checks:',{exact:false})).toHaveCount(0);
 await desk.getByRole('button',{name:'Next date'}).click();
 await expect(desk.getByRole('button',{name:'Arrivals 2',exact:true})).toBeVisible();
 await expect(desk.getByRole('region',{name:'Overdue checkout priority'})).toContainText('1 overdue checkout');
 await expect(desk.locator('.mdesk-room-warning')).toHaveCount(0);
 await desk.getByRole('button',{name:'Review overdue checkouts'}).click();
 const overdue=desk.getByRole('region',{name:'Overdue checkouts',exact:true});
 await expect(overdue.getByText('Flag for follow-up')).toBeVisible();
 const search=desk.getByRole('textbox',{name:'Search the selected manifest'});
 await search.fill('no match');
 await expect(overdue.getByText('No matching bookings.')).toBeVisible();
 await expect(desk.getByRole('region',{name:'Overdue checkout priority'})).toContainText('1 overdue checkout');
 await desk.getByRole('button',{name:'Clear search'}).click();
 await overdue.getByRole('button',{name:'All queues'}).click();
 await expect(desk.getByRole('region',{name:'Arrivals',exact:true})).toBeVisible();
 expect(await desk.evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBeTruthy();
 expect(writes).toBe(0);
});
