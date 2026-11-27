import {expect,test} from '@playwright/test';

const origin='http://127.0.0.1:5174';
const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Manila',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const checkedAt=today+'T06:00:00Z';
const meta={page:1,perPage:20,total:1,totalPages:1};

test.beforeEach(async({page})=>{
 await page.addInitScript(()=>{
  sessionStorage.setItem('foh.staff.bearer.v1','shift-pages-test');
  sessionStorage.setItem('foh.staff.hotel.v1','1');
 });
});

function employee(permissions=['housekeeping.assigned','occupancy.read','occupancy.observe']){
 return {data:{id:'2',name:'Demo Housekeeper',email:'housekeeping@example.test',hotels:[{id:'1',name:'Synthetic Hotel',role:'housekeeping',permissions}]}};
}

test('records an assigned occupancy check with a reachable save action and preserves an offline draft',async({page},testInfo)=>{
 test.skip(testInfo.project.name!=='mobile-chromium');
 await page.setViewportSize({width:320,height:720});
 let observed=false;
 let submitted:unknown;
 const check={id:'5',hotelId:'1',roomId:'7',roomNumber:'301',inspectionDate:today,assignedUserId:'2',createdBy:'1',
  reviewedBy:null,expectedBookingIds:null,reviewDecision:null,reviewNote:null,reviewedAt:null,createdAt:checkedAt};
 await page.route('**/api/v1/**',async route=>{
  const url=new URL(route.request().url());
  if(url.pathname.endsWith('/auth/me'))return route.fulfill({json:employee()});
  if(url.pathname.endsWith('/observe')){
   submitted=route.request().postDataJSON();observed=true;
   return route.fulfill({json:{data:{...check,observedBy:'2',status:'submitted',observedOccupancy:'unknown',
    expectedOccupancy:'vacant',discrepancy:'unverified',observationNote:'Room access was unavailable.',observedAt:checkedAt}}});
  }
  if(url.pathname.endsWith('/occupancy-verifications'))return route.fulfill({json:{data:[observed
   ?{...check,observedBy:'2',status:'submitted',observedOccupancy:'unknown',expectedOccupancy:'vacant',discrepancy:'unverified',
    observationNote:'Room access was unavailable.',observedAt:checkedAt}
   :{...check,observedBy:null,status:'assigned',observedOccupancy:null,expectedOccupancy:null,discrepancy:null,observationNote:null,observedAt:null}],
   meta:{...meta,hotelDate:today}}});
  return route.fulfill({status:404,json:{message:'Outside the occupancy fixture'}});
 });
 await page.goto(origin+'/occupancy-verification');
 await page.getByRole('button',{name:'Record observation',exact:true}).click();
 const dialog=page.getByRole('dialog',{name:'Record room observation'});
 await expect(dialog.getByRole('button',{name:'Close dialog'})).toBeFocused();
 await dialog.getByLabel('Observation notes').fill('Room access was unavailable.');
 const save=dialog.getByRole('button',{name:'Submit observation',exact:true});
 await expect(save).toBeDisabled();
 await dialog.getByRole('radio',{name:'Could not verify'}).check();
 await expect(save).toBeEnabled();
 await page.evaluate(()=>{
  Object.defineProperty(navigator,'onLine',{configurable:true,get:()=>false});window.dispatchEvent(new Event('offline'));
 });
 await expect(save).toBeDisabled();
 await expect(dialog.getByLabel('Observation notes')).toHaveValue('Room access was unavailable.');
 expect(await dialog.evaluate(el=>el.clientWidth===320&&el.scrollWidth<=el.clientWidth+1)).toBe(true);
 await page.evaluate(()=>{
  Object.defineProperty(navigator,'onLine',{configurable:true,get:()=>true});window.dispatchEvent(new Event('online'));
 });
 await save.click();
 await expect(dialog).toBeHidden();
 await expect(page.getByText('Observation saved for manager review.')).toBeVisible();
 await expect(page.getByText('Manager review needed')).toBeVisible();
 expect(submitted).toEqual({observedOccupancy:'unknown',note:'Room access was unavailable.'});
});

test('opens room repair search and a read-only history on a phone',async({page},testInfo)=>{
 test.skip(testInfo.project.name!=='mobile-chromium');
 await page.setViewportSize({width:390,height:760});
 const order={id:'7',hotelId:'1',roomId:'7',roomNumber:'301',title:'Leaking sink',description:'Water visible under sink',
  priority:'urgent',status:'open',assignedTo:null,assignedUserId:null,affectsRoom:true,revision:1,reportedAt:checkedAt,resolvedAt:null};
 let search='';
 await page.route('**/api/v1/**',async route=>{
  const url=new URL(route.request().url());
  if(url.pathname.endsWith('/auth/me'))return route.fulfill({json:employee()});
  if(url.pathname.endsWith('/maintenance-work-orders')){
   search=url.searchParams.get('q')??'';
   return route.fulfill({json:{data:[order],meta:{...meta,affectsRoomDoesNotBlockInventory:true}}});
  }
  if(url.pathname.endsWith('/maintenance-work-orders/7/history'))return route.fulfill({json:{data:[],meta:{...meta,total:0}}});
  return route.fulfill({status:404,json:{message:'Outside the repair fixture'}});
 });
 await page.goto(origin+'/maintenance?room=%22301%22');
 await expect(page.getByRole('searchbox',{name:'Search work orders'})).toHaveValue('301');
 await page.getByRole('button',{name:'View work order'}).click();
 const repair=page.getByRole('dialog',{name:'Leaking sink'});
 await expect(repair.getByRole('combobox')).toHaveCount(0);
 await expect(repair.getByText('Water visible under sink')).toBeVisible();
 await repair.getByRole('button',{name:'Repair history'}).click();
 await expect(repair.getByText('No repair activity recorded.')).toBeVisible();
 await page.keyboard.press('Escape');
 await expect(page.getByRole('button',{name:'View work order'})).toBeFocused();
 expect(search).toBe('301');
});
