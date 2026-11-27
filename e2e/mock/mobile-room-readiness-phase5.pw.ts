import {expect,test} from '@playwright/test';

test.beforeEach(async({page})=>{
 await page.addInitScript(()=>{sessionStorage.setItem('foh.staff.bearer.v1','mobile-room-rack-fixture');sessionStorage.setItem('foh.staff.hotel.v1','1');});
 await page.route('**/api/v1/**',async route=>{
  const path=new URL(route.request().url()).pathname;
  if(path.endsWith('/auth/me'))return route.fulfill({json:{data:{id:'1',name:'Demo manager',email:'manager@example.test',hotels:[{id:'1',name:'Demo hotel',role:'admin'}]}}});
  if(path.endsWith('/rooms/rack'))return route.fulfill({json:{data:{
   hotelId:'1',hotelDate:'2026-11-27',enforcedAtCheckIn:true,allowedActions:{completeInspection:true},
   rooms:[{roomId:'1',roomNumber:'101',roomTypeName:'Standard room',roomTypeId:'1',maxOccupancy:2,floor:1,
    occupancy:'vacant',cleaning:'checkout_cleaning',advisoryReady:false,inspectionStatus:null,inspectionId:null,
    readinessStatus:'needs_inspection',blockers:{activeInventoryBlockToday:false,activeRoomImpactMaintenance:false,
    latestTurnoverIncomplete:true,newTurnoverSinceInspection:false,unfinishedHousekeeping:true,newRoomWorkSinceInspection:false},
    openHousekeepingTaskId:'1',activeMaintenanceOrderId:null,activeInventoryBlockId:null,
    cleanedAt:null,inspectedAt:null,reviewedAt:null,currentStay:null,upcomingStay:null}],
   arrivals:[],summary:{totalRooms:1,pmsVacantRooms:1,pmsOccupiedRooms:0,arrivalsToday:0,departuresToday:0,roomsNeedingCleaning:1,legacyPendingInspections:0,activelyBlockedRooms:0}
  },meta:{page:1,perPage:100,total:1,totalPages:1,snapshotOnly:true,availabilityGuaranteed:false,physicalOccupancyVerified:false,financialSettlementVerified:false}}});
  return route.fulfill({status:404,json:{message:'Outside room rack fixture'}});
 });
});
for(const width of [320,390,760]){
 test('mobile room rack lists blockers and opens room drawer at '+width+'px',async({page},testInfo)=>{
  test.skip(testInfo.project.name!=='mobile-chromium','Mobile layout regression');
  await page.setViewportSize({width,height:740});
  await page.goto('http://127.0.0.1:5174/rooms');
  const rack=page.getByRole('region',{name:'Live hotel room rack'});
  await expect(rack.getByRole('button',{name:'List',exact:true})).toHaveAttribute('aria-pressed','true');
  const tile=rack.locator('.rack-tile').first();
  await expect(tile).toContainText('Cleaning: checkout cleaning');
  await expect(tile.locator('.rack-tile-problem')).toBeVisible();
  expect(await tile.evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBeTruthy();
  await rack.getByRole('button',{name:'Filters',exact:true}).click();
  await expect(rack.getByRole('combobox',{name:'Room type',exact:true})).toBeVisible();
  await rack.getByRole('button',{name:'Done · Hide filters'}).click();
  await expect(rack.getByRole('combobox',{name:'Room type',exact:true})).toBeHidden();
  await tile.click();
  const drawer=page.getByRole('dialog',{name:'Room 101 details'});
  await expect(drawer).toBeVisible();
  await drawer.getByRole('button',{name:'Close room details'}).click();
  await expect(tile).toBeFocused();
  await page.getByRole('button',{name:'Readiness & arrivals',exact:true}).click();
  await expect(page.locator('.rack-readiness-queue')).toHaveAttribute('open','');
 });
}
test('desktop room rack retains grid default',async({page},testInfo)=>{
 test.skip(testInfo.project.name!=='desktop-chromium','Desktop layout regression');
 await page.goto('http://127.0.0.1:5174/rooms');
 await expect(page.getByRole('button',{name:'Grid',exact:true})).toHaveAttribute('aria-pressed','true');
 await expect(page.locator('.rack-grid .rack-tile')).toBeVisible();
});
