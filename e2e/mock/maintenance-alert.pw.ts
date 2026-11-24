import {expect,test} from '@playwright/test';

test('a Room 303 maintenance alert opens WO-1 ahead of the Room 201 queue entry',async({page})=>{
 const order={id:'1',hotelId:'1',roomId:'13',roomNumber:'303',title:'Air-conditioning repair',
  description:'Air conditioner needs repair',priority:'urgent',status:'in_progress',assignedTo:null,
  assignedUserId:null,affectsRoom:true,revision:1,reportedAt:'2026-11-24',resolvedAt:null};
 const first={...order,id:'2',roomId:'12',roomNumber:'201',title:'Door latch repair'};
 const meta={page:1,perPage:20,total:2,totalPages:1};
 await page.addInitScript(()=>{
  sessionStorage.setItem('foh.staff.bearer.v1','maintenance-fixture');
  sessionStorage.setItem('foh.staff.hotel.v1','1');
 });
 await page.route('**/api/v1/**',async route=>{
  const url=new URL(route.request().url());
  const path=url.pathname;
  if(path.endsWith('/auth/me'))return route.fulfill({json:{data:{
   id:'1',name:'Demo manager',email:'manager@example.test',hotels:[{id:'1',name:'Demo hotel',role:'admin'}],
  }}});
  if(path.endsWith('/operational-exceptions'))return route.fulfill({json:{
   data:{hotelId:'1',asOfHotelDate:'2026-11-24',windowEndExclusive:'2026-12-01',
    summary:{total:1,critical:1,attention:0,review:0},activity:[],items:[{
     id:'maintenance:1',type:'maintenance_blocker',severity:'critical',bookingId:null,roomId:'13',
     roomNumber:'303',reference:'Room 303',reason:order.title,suggestion:'Review work order',recordDate:order.reportedAt,
    }]},
   meta:{readOnly:true,complete:true,isFraudDetermination:false,keycardLogsConnected:false,
    cctvEventsConnected:false,housekeepingPhysicalOccupancyConnected:false,sourceLimit:100,notes:''},
  }});
  if(path.endsWith('/maintenance-work-orders'))return route.fulfill({json:{
   data:[first,order],meta:{...meta,affectsRoomDoesNotBlockInventory:true},
  }});
  if(path.endsWith('/maintenance-work-orders/1'))return route.fulfill({json:{data:order}});
  if(path.endsWith('/inventory-blocks'))return route.fulfill({json:{
   data:url.searchParams.get('roomId')==='13'?[{id:'7',roomId:'13',roomTypeId:'3',checkIn:'2020-01-01',
    checkOut:'2099-01-01',reason:'AC repair',active:true,createdBy:'1',releasedBy:null,
    createdAt:order.reportedAt,updatedAt:order.reportedAt}]:[],meta,
  }});
  await route.fulfill({status:404,json:{message:'Outside work-order fixture'}});
 });
 await page.goto('http://127.0.0.1:5174/operational-exceptions');
 await page.getByRole('link',{name:'Open work order WO-1'}).click();
 const dialog=page.getByRole('dialog',{name:'Work order WO-1 · Room 303'});
 await expect(dialog.getByLabel('Title',{exact:true})).toHaveValue(order.title);
 await expect(page.locator('.mnt-work-card').first()).toContainText('Room 201');
 await page.reload();
 const block=dialog.getByRole('link',{name:'View room block'});
 await expect(block).toBeVisible();
 await block.click();
 await expect(page.getByRole('textbox',{name:'Search room number'})).toHaveValue('303');
 await expect(page).toHaveURL(/\/room-calendar\?/);
});
