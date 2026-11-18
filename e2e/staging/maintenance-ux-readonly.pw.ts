import {expect,test,type Page} from '@playwright/test';

/** Read-only maintenance acceptance: never updates orders, priority, or room inventory. */
async function enterMaintenance(page:Page,email:string,password:string,mobile=false){
 await page.goto('/');
 await page.getByRole('textbox',{name:'Email address'}).fill(email);
 await page.getByLabel('Password',{exact:true}).fill(password);
 await page.getByRole('button',{name:'Sign in',exact:true}).click();
 await expect(page.locator('.workspace-nav, .auth-hotel-list').first()).toBeVisible();
 if(await page.locator('.auth-hotel-list').isVisible())await page.locator('.auth-hotel-list button').first().click();
 if(mobile)await page.getByRole('button',{name:'Open navigation'}).click();
 await page.getByRole('navigation',{name:'Hotel workspace navigation'})
  .getByRole('link',{name:'Maintenance',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Maintenance',exact:true})).toBeVisible();
}
test('maintenance work order status totals remain stable when filtering the queue',async({page})=>{
 const email=process.env.PMS_STAGING_EMAIL,password=process.env.PMS_STAGING_PASSWORD;
 if(!email||!password)throw Error('Set PMS_STAGING_EMAIL and PMS_STAGING_PASSWORD.');
 await enterMaintenance(page,email,password);
 await expect(page.getByRole('heading',{name:'Maintenance workload'})).toBeVisible();
 await expect(page.getByRole('heading',{name:'Maintenance work queue'})).toBeVisible();
 const totals=page.locator('.mnt-work-metrics > div');
 await expect(totals.nth(3).locator('strong')).toHaveText(/^\d+$/);
 const baseline=await Promise.all([0,1,2,3].map(async n=>totals.nth(n).locator('strong').innerText()));
 const tabs=page.getByRole('group',{name:'Maintenance status'});
 await tabs.getByRole('button',{name:'In progress',exact:true}).click();
 await expect(tabs.getByRole('button',{name:'In progress'})).toHaveAttribute('aria-pressed','true');
 for(let i=0;i<4;i++)await expect(totals.nth(i).locator('strong')).toHaveText(baseline[i]);
 await tabs.getByRole('button',{name:'Closed'}).click();
 for(let i=0;i<4;i++)await expect(totals.nth(i).locator('strong')).toHaveText(baseline[i]);
 await tabs.getByRole('button',{name:'All orders'}).click();
 const search=page.getByRole('searchbox',{name:'Search work orders on this page'});
 await search.fill('no-such-room-9981181');
 await expect(page.getByRole('button',{name:'Clear filters'})).toBeVisible();
 await page.getByRole('button',{name:'Clear filters'}).click();
 await expect(search).toHaveValue('');
 const card=page.locator('.mnt-work-card').first();
 if(await card.count()){
  await card.locator('.mnt-work-action').click();
  const dialog=page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('Repair record only.')).toBeVisible();
  await dialog.getByRole('button',{name:'Close',exact:true}).first().click();
 }
 const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
 expect(overflow).toBeLessThanOrEqual(2);
});
test('maintenance mobile queue fits narrow viewport',async({page})=>{
 const email=process.env.PMS_STAGING_EMAIL,password=process.env.PMS_STAGING_PASSWORD;
 if(!email||!password)throw Error('Set PMS_STAGING_EMAIL and PMS_STAGING_PASSWORD.');
 await page.setViewportSize({width:390,height:844});
 await enterMaintenance(page,email,password,true);
 await expect(page.getByRole('searchbox',{name:'Search work orders on this page'})).toBeVisible();
 await expect(page.getByRole('combobox',{name:'Filter maintenance priority'})).toBeVisible();
 const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
 expect(overflow).toBeLessThanOrEqual(2);
});
test('administrator can manage assignments while maintenance staff cannot edit other orders',async({page})=>{
 const email=process.env.PMS_STAGING_ADMIN_EMAIL,password=process.env.PMS_STAGING_ADMIN_PASSWORD;
 test.skip(!email||!password,'Dedicated administrator staging login required');
 await enterMaintenance(page,email!,password!);
 await expect(page.getByRole('button',{name:'New work order'})).toBeVisible();
 const card=page.locator('.mnt-work-card').first();
 if(await card.count()){
  await card.locator('.mnt-work-action').click();
  await expect(page.getByRole('dialog').getByRole('combobox',{name:'Assign technician'})).toBeVisible();
  await page.getByRole('dialog').getByRole('button',{name:'Close',exact:true}).first().click();
 }
});
test('maintenance staff are restricted to assigned orders',async({page})=>{
 const email=process.env.PMS_STAGING_MAINTENANCE_EMAIL,password=process.env.PMS_STAGING_MAINTENANCE_PASSWORD;
 test.skip(!email||!password,'Dedicated maintenance staging login required');
 await enterMaintenance(page,email!,password!);
 await expect(page.getByRole('button',{name:'New work order'})).toHaveCount(0);
 const card=page.locator('.mnt-work-card').first();
 if(await card.count()){
  const editable=await card.locator('.mnt-work-action').innerText();
  await card.locator('.mnt-work-action').click();
  const dialog=page.getByRole('dialog');
  await expect(dialog.getByRole('combobox',{name:'Assign technician'})).toHaveCount(0);
  if(editable.includes('View work order')){
   await expect(dialog.getByRole('button',{name:'Save work order'})).toHaveCount(0);
  }
  await dialog.getByRole('button',{name:'Close',exact:true}).first().click();
 }
});
