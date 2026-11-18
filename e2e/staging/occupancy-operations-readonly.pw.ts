import {expect,test,type Page} from '@playwright/test';

/** Read-only manager and housekeeping acceptance. Never assign, observe, or resolve a real check. */
async function login(page:Page,email:string,password:string){
 await page.goto('/');
 await page.getByRole('textbox',{name:'Email address'}).fill(email);
 await page.getByLabel('Password',{exact:true}).fill(password);
 await page.getByRole('button',{name:'Sign in',exact:true}).click();
 await expect(page.locator('.workspace-nav, .auth-hotel-list').first()).toBeVisible();
 if(await page.locator('.auth-hotel-list').isVisible())await page.locator('.auth-hotel-list button').first().click();
}

test('manager report separates observed, reviewed and unresolved checks',async({page})=>{
 const email=process.env.PMS_STAGING_ADMIN_EMAIL,password=process.env.PMS_STAGING_ADMIN_PASSWORD;
 test.skip(!email||!password,'Dedicated manager staging credentials required');
 await login(page,email!,password!);
 await page.getByRole('navigation',{name:'Hotel workspace navigation'})
  .getByRole('link',{name:/Occupancy report|Occupancy coverage/}).click();
 await expect(page.getByRole('heading',{name:'Room occupancy report'})).toBeVisible();
 await expect(page.getByText('Observed',{exact:true}).first()).toBeVisible();
 await expect(page.getByText('Manager reviewed',{exact:true})).toBeVisible();
 await expect(page.getByText('Still needs action',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Show report methodology'}).click();
 await expect(page.getByText(/Historical reports use the/)).toBeVisible();
 const first=page.locator('.occ-report-row').first();
 if(await first.count()){
  await first.getByRole('link',{name:'Open checks'}).click();
  await expect(page.getByRole('heading',{name:'Room occupancy checks'})).toBeVisible();
  await expect(page.getByText(/Showing room/)).toBeVisible();
 }
 const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
 expect(overflow).toBeLessThanOrEqual(2);
});

test('manager assignment dialog is read-only until deliberately submitted',async({page})=>{
 const email=process.env.PMS_STAGING_ADMIN_EMAIL,password=process.env.PMS_STAGING_ADMIN_PASSWORD;
 test.skip(!email||!password,'Dedicated manager staging credentials required');
 await login(page,email!,password!);
 await page.getByRole('navigation',{name:'Hotel workspace navigation'})
  .getByRole('link',{name:/Occupancy checks|Occupancy verification/}).click();
 await expect(page.getByRole('heading',{name:'Room occupancy checks'})).toBeVisible();
 const assign=page.getByRole('button',{name:'Assign a room check'});
 if(await assign.count()){
  await assign.click();
  const dialog=page.getByRole('dialog',{name:'Assign a room check'});
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button',{name:/Assign today’s check|Assign today's check/})).toBeDisabled();
  await dialog.getByRole('button',{name:'Close dialog'}).click();
 }
});

test('housekeeping sees observation action but not manager verification controls',async({page})=>{
 const email=process.env.PMS_STAGING_HOUSEKEEPING_EMAIL,password=process.env.PMS_STAGING_HOUSEKEEPING_PASSWORD;
 test.skip(!email||!password,'Dedicated housekeeping staging credentials required');
 await login(page,email!,password!);
 await page.getByRole('navigation',{name:'Hotel workspace navigation'})
  .getByRole('link',{name:/Occupancy checks|Occupancy verification/}).click();
 await expect(page.getByRole('heading',{name:'Room occupancy checks'})).toBeVisible();
 await expect(page.getByRole('button',{name:'Assign a room check'})).toHaveCount(0);
 const action=page.getByRole('button',{name:/Record observation/}).first();
 if(await action.count()){
  await action.click();
  const dialog=page.getByRole('dialog',{name:'Record room observation'});
  await expect(dialog.getByRole('button',{name:'Submit observation for review'})).toBeDisabled();
  await dialog.getByRole('button',{name:'Close dialog'}).click();
 }
});
