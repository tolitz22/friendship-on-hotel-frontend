import {expect,test} from '@playwright/test';

for(const width of [320,390,430,768,1280]){
 test('housekeeping home prioritizes assigned tasks and unfinished inspections at '+width+'px',async({page},testInfo)=>{
  test.skip(testInfo.project.name!==(width>=768?'desktop-chromium':'mobile-chromium'),'Dashboard viewport');
  await page.setViewportSize({width,height:800});
  await page.addInitScript(()=>{sessionStorage.setItem('foh.staff.bearer.v1','housekeeping-home-fixture');sessionStorage.setItem('foh.staff.hotel.v1','1');});
  const common={hotelId:'1',assignedTo:null,assignedUserId:'2',type:'checkout_clean',dueAt:'2026-11-27 14:00:00',completedAt:null,revision:1,createdAt:'2026-11-27'};
  const next={...common,id:'7',roomId:'1',roomNumber:'201',status:'todo',priority:'arrival_today',checklist:[{key:'trash',label:'Remove trash',checkedAt:null,checkedBy:null}]};
  const ongoing={...common,id:'8',roomId:'2',roomNumber:'202',status:'in_progress',priority:'in_progress'};
  const inspection={...common,id:'9',roomId:'3',roomNumber:'203',status:'done',completedAt:'2026-11-27 09:00:00',pendingInspection:true};
  let writes=0;
  await page.route('**/api/v1/**',async route=>{
   const url=new URL(route.request().url()),path=url.pathname;
   if(route.request().method()!=='GET'){writes++;return route.fulfill({status:400,json:{message:'Read-only layout fixture'}});}
   if(path.endsWith('/auth/me'))return route.fulfill({json:{data:{id:'2',name:'Demo cleaner',email:'cleaner@example.test',hotels:[{id:'1',name:'Demo hotel',role:'housekeeping',permissions:['housekeeping.assigned','occupancy.read','occupancy.observe']}]}}});
   if(path.endsWith('/housekeeping/dashboard'))return route.fulfill({json:{data:{hotelId:'1',userId:'2',hotelDate:'2026-11-27',summary:{todo:1,inProgress:1,urgentRooms:1,completedToday:1},activeTotal:2,tasks:[next,ongoing]}}});
   if(path.endsWith('/housekeeping-tasks'))return route.fulfill({json:{data:[inspection],meta:{page:1,perPage:5,total:1,totalPages:1,determinesRoomReadiness:false,pendingInspectionCount:1}}});
   if(path.endsWith('/housekeeping/notifications'))return route.fulfill({json:{data:{hotelId:'1',notifications:[],hasMore:false}}});
   if(path.endsWith('/push-access'))return route.fulfill({json:{data:{allowed:false}}});
   return route.fulfill({status:404,json:{message:'Outside dashboard fixture'}});
  });
  await page.goto('http://127.0.0.1:5174/');
  const home=page.locator('.hk-dash');
  await expect(home.getByRole('heading',{name:'Housekeeping',exact:true})).toBeVisible();
  await expect(home.getByRole('region',{name:'Your next room'}).getByRole('heading',{name:'Room 201'})).toBeVisible();
  await expect(home.getByRole('region',{name:'Your next room'}).getByRole('button',{name:'Start cleaning'})).toBeEnabled();
  await expect(home.getByRole('link',{name:/Inspection due/})).toHaveAttribute('href',/queue=(?:%22)?pending_inspection/);
  await expect(home.getByRole('link',{name:/Inspection due/})).toHaveAttribute('href',/mine=true/);
  await expect(home.getByRole('region',{name:'Up next'}).getByRole('link',{name:/Room 202/})).toBeVisible();
  await expect(home.locator('.hk-minimal-metric')).toHaveCount(3);
  await expect(home.getByRole('region',{name:'Quick actions'})).toHaveCount(0);
  expect(await home.evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBeTruthy();
  if(width<768){
   await page.evaluate(()=>window.scrollTo(0,0));
   const action=await home.getByRole('button',{name:'Start cleaning'}).boundingBox();
   expect(action).not.toBeNull();
   expect(action!.height).toBeGreaterThanOrEqual(52);
   const nav=page.getByRole('navigation',{name:'Housekeeping mobile navigation'});
   await expect(nav).toBeVisible();
   await expect(nav.getByRole('link',{name:'Home',exact:true})).toHaveAttribute('aria-current','page');
   for(const label of ['Tasks','Rooms','Messages'])await expect(nav.getByRole('link',{name:label,exact:true})).toBeVisible();
   const navBounds=await nav.boundingBox();
   expect(navBounds!.y+navBounds!.height).toBeGreaterThanOrEqual(799);
   await nav.getByRole('button',{name:'Profile'}).click();
   await expect(page.getByRole('dialog',{name:'Workspace navigation'}).getByRole('link',{name:'Lost & found'})).toBeVisible();
   await page.getByRole('button',{name:'Close menu'}).click();
   await expect(nav.getByRole('button',{name:'Profile'})).toBeFocused();
   expect(action!.y+action!.height).toBeLessThan(600);
   await expect(page.getByRole('button',{name:'Refresh assignments'})).toBeVisible();
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  }
  expect(writes).toBe(0);
 });
}
