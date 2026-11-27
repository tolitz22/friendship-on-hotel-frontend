import {expect,test} from '@playwright/test';

for(const width of [320,390,760]){
 test('housekeeping room board is private and usable at '+width+'px',async({page},testInfo)=>{
  test.skip(testInfo.project.name!=='mobile-chromium','Mobile housekeeping board regression');
  await page.setViewportSize({width,height:740});
  await page.addInitScript(()=>{sessionStorage.setItem('foh.staff.bearer.v1','hk09-mobile-fixture');sessionStorage.setItem('foh.staff.hotel.v1','1');});
  const room={roomId:'1',roomNumber:'201',roomType:'Standard',floor:2,occupancy:'vacant',stage:'dirty',arrivalToday:true,maintenanceBlocked:false,inventoryBlocked:false,task:{id:'7',type:'checkout_clean',status:'todo',assignment:'mine'}};
  let rackRequests=0;
  await page.route('**/api/v1/**',async route=>{
   const path=new URL(route.request().url()).pathname;
   if(path.endsWith('/auth/me'))return route.fulfill({json:{data:{id:'2',name:'Demo cleaner',email:'cleaner@example.test',hotels:[{id:'1',name:'Demo hotel',role:'housekeeping',permissions:['housekeeping.assigned','occupancy.read','occupancy.observe']}]}}});
   if(path.endsWith('/housekeeping/room-board'))return route.fulfill({json:{data:{hotelId:'1',userId:'2',hotelDate:'2026-11-27',rooms:[room,{...room,roomId:'2',roomNumber:'302',floor:3,stage:'ready',arrivalToday:false,task:null}]},meta:{total:2,snapshotOnly:true,physicalOccupancyVerified:false}}});
   if(path.endsWith('/housekeeping/notifications'))return route.fulfill({json:{data:{hotelId:'1',notifications:[],hasMore:false}}});
   if(path.endsWith('/rooms/rack'))rackRequests++;
   return route.fulfill({status:404,json:{message:'Outside mobile housekeeping fixture'}});
  });
  await page.goto('http://127.0.0.1:5174/rooms');
  const board=page.locator('.hk-room-board');
  await expect(board.getByRole('heading',{name:'Room 201',exact:true})).toBeVisible();
  await expect(board.getByRole('heading',{name:'Room 302',exact:true})).toBeVisible();
  await expect(board.getByText('Confirmed arrival today')).toBeVisible();
  await expect(board.getByRole('link',{name:'Open my task'})).toHaveAttribute('href',/housekeeping.*task=(?:%22)?7(?:%22)?(?:&|$)/);
  await board.getByRole('group',{name:'Room status filters'}).getByRole('button',{name:'My tasks'}).click();
  await expect(board.getByRole('heading',{name:'Room 302',exact:true})).toHaveCount(0);
  await expect(board.getByText('1 of 2 rooms')).toBeVisible();
  expect(await board.evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBeTruthy();
  const target=board.getByRole('link',{name:'Open my task'});
  expect((await target.boundingBox())?.height??0).toBeGreaterThanOrEqual(44);
  expect(rackRequests).toBe(0);
 });
}
