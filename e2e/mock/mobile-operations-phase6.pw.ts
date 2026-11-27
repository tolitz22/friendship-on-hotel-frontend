import {expect,test} from '@playwright/test';

for(const width of [320,390,760]){
 test('mobile housekeeping and maintenance editors at '+width+'px',async({page},testInfo)=>{
  test.skip(testInfo.project.name!=='mobile-chromium','Mobile layout regression');
  await page.setViewportSize({width,height:740});
  await page.addInitScript(()=>{sessionStorage.setItem('foh.staff.bearer.v1','mobile-operations-fixture');sessionStorage.setItem('foh.staff.hotel.v1','1');});
  const task={id:'1',hotelId:'1',roomId:'1',roomNumber:'101',type:'checkout_clean',status:'todo',
   assignedTo:null,assignedUserId:'1',dueAt:null,completedAt:null,revision:1,createdAt:'2026-11-27',
   checklist:[{key:'trash',label:'Remove trash',checkedBy:null,checkedAt:null},{key:'linens',label:'Replace bed linens',checkedBy:null,checkedAt:null}]};
  const order={id:'2',hotelId:'1',roomId:'1',roomNumber:'101',title:'Repair air conditioning',description:'Cooling issue',
   priority:'urgent',status:'open',assignedTo:null,assignedUserId:'1',affectsRoom:true,revision:1,reportedAt:'2026-11-27',resolvedAt:null};
  let writes=0;
  await page.route('**/api/v1/**',async route=>{
   const url=new URL(route.request().url()),path=url.pathname;
   if(route.request().method()!=='GET'){writes++;return route.fulfill({status:400,json:{message:'No writes in this layout fixture'}});}
   if(path.endsWith('/auth/me'))return route.fulfill({json:{data:{id:'1',name:'Demo manager',email:'manager@example.test',hotels:[{id:'1',name:'Demo hotel',role:'admin'}]}}});
   const meta={page:1,perPage:20,total:1,totalPages:1};
   if(path.endsWith('/housekeeping-tasks'))return route.fulfill({json:{data:[task],meta:{...meta,determinesRoomReadiness:false}}});
   if(path.endsWith('/maintenance-work-orders'))return route.fulfill({json:{data:[order],meta:{...meta,affectsRoomDoesNotBlockInventory:true}}});
   return route.fulfill({status:404,json:{message:'Outside mobile operations fixture'}});
  });
  await page.goto('http://127.0.0.1:5174/housekeeping');
  await page.getByRole('button',{name:'Task type filter',exact:true}).click();
  await expect(page.getByLabel('Filter task type')).toBeVisible();
  await page.getByRole('button',{name:'Hide task type',exact:true}).click();
  await expect(page.getByLabel('Filter task type')).toBeHidden();
  await page.getByRole('button',{name:'Start or update task'}).click();
  const hk=page.getByRole('dialog',{name:'Housekeeping task HK-1'});
  await expect(hk).toBeVisible();
  await expect(hk.getByRole('combobox',{name:'Room',exact:true})).toHaveCount(0);
  await expect(hk.getByRole('combobox',{name:'Task type',exact:true})).toHaveCount(0);
  await expect(hk.locator('.hk-task-detail').filter({hasText:'Room 101'})).toBeVisible();
  const completed=hk.getByRole('group',{name:'Quick cleaning progress'}).getByRole('button',{name:'Cleaning completed'});
  await expect(completed).toBeDisabled();
  await hk.getByRole('checkbox',{name:'Remove trash',exact:true}).check();
  await expect(completed).toBeDisabled();
  await hk.getByRole('checkbox',{name:'Replace bed linens',exact:true}).check();
  await expect(completed).toBeEnabled();
  await completed.click();
  await expect(hk.getByRole('combobox',{name:'Cleaning progress',exact:true})).toHaveValue('done');
  const save=hk.getByRole('button',{name:'Save cleaning & continue'});
  await expect(save).toBeVisible();
  await page.evaluate(()=>{Object.defineProperty(navigator,'onLine',{configurable:true,get:()=>false});window.dispatchEvent(new Event('offline'));});
  await expect(hk.getByText('You are offline. Changes are not saved. Reconnect to submit.')).toBeVisible();
  await expect(save).toBeDisabled();
  await expect(hk.getByRole('checkbox',{name:'Remove trash',exact:true})).toBeChecked();
  await page.evaluate(()=>{Object.defineProperty(navigator,'onLine',{configurable:true,get:()=>true});window.dispatchEvent(new Event('online'));});
  await expect(save).toBeEnabled();
  await expect(hk.getByText('Step 1: Finish cleaning and save the task before inspecting Room 101.')).toBeVisible();
  expect(await hk.evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBeTruthy();
  await hk.getByRole('button',{name:'Close',exact:true}).first().click();
  await page.goto('http://127.0.0.1:5174/maintenance');
  await page.getByRole('button',{name:'Priority filter',exact:true}).click();
  await expect(page.getByLabel('Filter maintenance priority')).toBeVisible();
  await page.getByRole('button',{name:'Start or update work'}).click();
  const mnt=page.getByRole('dialog',{name:'Work order WO-2 · Room 101'});
  await expect(mnt).toBeVisible();
  await mnt.getByRole('group',{name:'Quick repair progress'}).getByRole('button',{name:'Resolved',exact:true}).click();
  await expect(mnt.getByRole('combobox',{name:'Status',exact:true})).toHaveValue('resolved');
  expect(await mnt.evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBeTruthy();
  expect(writes).toBe(0);
 });
}
