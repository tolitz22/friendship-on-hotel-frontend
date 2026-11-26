import {expect,test} from '@playwright/test';

test.beforeEach(async({page})=>{
 await page.addInitScript(()=>{sessionStorage.setItem('foh.staff.bearer.v1','mobile-calendar-fixture');sessionStorage.setItem('foh.staff.hotel.v1','1');});
 await page.route('**/api/v1/**',async route=>{
  const url=new URL(route.request().url());
  if(url.pathname.endsWith('/auth/me'))return route.fulfill({json:{data:{id:'1',name:'Demo manager',email:'manager@example.test',hotels:[{id:'1',name:'Demo hotel',role:'admin'}]}}});
  if(url.pathname.endsWith('/room-calendar'))return route.fulfill({json:{data:{hotelId:'1',start:url.searchParams.get('start'),end:url.searchParams.get('end'),focusedGroupId:null,rooms:[],bookings:[],blocks:[],unassignedBookings:0,unassignedGroupBookings:[],unassignedGroupTotal:0,unassignedGroupTruncated:false},meta:{page:1,perPage:30,total:0,totalPages:0,readOnly:true,checkoutDateExclusive:true,isActualPhysicalOccupancyEvidence:false}}});
  return route.fulfill({status:404,json:{message:'Outside mobile calendar fixture'}});
 });
});

for(const width of [320,390,760]){
 test('mobile room calendar uses day navigation at '+width+'px',async({page},testInfo)=>{
  test.skip(testInfo.project.name!=='mobile-chromium','Mobile layout regression');
  await page.setViewportSize({width,height:740});
  await page.goto('http://127.0.0.1:5174/room-calendar');
  const periods=page.getByRole('group',{name:'Calendar period'});
  const day=periods.getByRole('button',{name:'Day',exact:true});
  await expect(day).toHaveAttribute('aria-pressed','true');
  const date=page.getByLabel('Jump to calendar date');
  await date.fill('2026-11-27');
  await page.getByRole('button',{name:'Next period'}).click();
  await expect(date).toHaveValue('2026-11-28');
  await page.getByRole('button',{name:'Previous period'}).click();
  await expect(date).toHaveValue('2026-11-27');
  const filters=page.getByRole('button',{name:'Room filters',exact:true});
  await expect(filters).toHaveAttribute('aria-expanded','false');
  await filters.click();
  await expect(page.getByLabel('Search room number')).toBeVisible();
  await page.getByRole('button',{name:'Hide filters'}).click();
  await expect(page.getByLabel('Search room number')).toBeHidden();
  await periods.getByRole('button',{name:'Week',exact:true}).click();
  await expect(periods.getByRole('button',{name:'Week',exact:true})).toHaveAttribute('aria-pressed','true');
  await periods.getByRole('button',{name:'Month',exact:true}).click();
  await expect(periods.getByRole('button',{name:'Month',exact:true})).toHaveAttribute('aria-pressed','true');
  for(const name of ['Previous period','Next period']){
   const bounds=await page.getByRole('button',{name}).boundingBox();
   expect(bounds?.height).toBeGreaterThanOrEqual(44);
  }
  expect(await page.locator('.lrc-toolbar').evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBeTruthy();
 });
}
test('desktop room calendar retains week default and visible filters',async({page},testInfo)=>{
 test.skip(testInfo.project.name!=='desktop-chromium','Desktop layout regression');
 await page.goto('http://127.0.0.1:5174/room-calendar');
 await expect(page.getByRole('group',{name:'Calendar period'}).getByRole('button',{name:'Week',exact:true})).toHaveAttribute('aria-pressed','true');
 await expect(page.getByLabel('Search room number')).toBeVisible();
});
