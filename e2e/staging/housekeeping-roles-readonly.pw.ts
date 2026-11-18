import {expect,test,type Page} from '@playwright/test';

/** Read-only permissions and housekeeping workflow acceptance on dedicated staging. */
async function signInAndOpenHousekeeping(page:Page,email:string,password:string){
 await page.goto('/');
 await page.getByRole('textbox',{name:'Email address'}).fill(email);
 await page.getByLabel('Password',{exact:true}).fill(password);
 await page.getByRole('button',{name:'Sign in',exact:true}).click();
 await expect(page.locator('.workspace-nav, .auth-hotel-list').first()).toBeVisible();
 if(await page.locator('.auth-hotel-list').isVisible())
  await page.locator('.auth-hotel-list button').first().click();
 await page.getByRole('navigation',{name:'Hotel workspace navigation'})
  .getByRole('link',{name:'Housekeeping',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Housekeeping',exact:true})).toBeVisible();
}
test('hotel administrator sees assignment and management controls',async({page})=>{
 const email=process.env.PMS_STAGING_ADMIN_EMAIL;
 const password=process.env.PMS_STAGING_ADMIN_PASSWORD;
 test.skip(!email||!password,'Dedicated administrator staging account is required.');
 await signInAndOpenHousekeeping(page,email!,password!);
 await expect(page.getByRole('button',{name:'New cleaning task'})).toBeVisible();
 const card=page.locator('.hk-cleaning-card').first();
 if(await card.count()){
  await card.locator('.hk-open-task').click();
  const dialog=page.getByRole('dialog');
  await expect(dialog.getByRole('combobox',{name:'Assign staff member'})).toBeVisible();
  await expect(dialog.getByRole('combobox',{name:'Cleaning progress'})).toBeEnabled();
  await expect(dialog.getByRole('button',{name:'Save task updates'})).toBeVisible();
  await dialog.getByRole('button',{name:'Close',exact:true}).first().click();
 }
});
test('housekeeping account can update only assigned tasks',async({page})=>{
 const email=process.env.PMS_STAGING_HOUSEKEEPING_EMAIL;
 const password=process.env.PMS_STAGING_HOUSEKEEPING_PASSWORD;
 test.skip(!email||!password,'Dedicated housekeeping staging account is required.');
 await signInAndOpenHousekeeping(page,email!,password!);
 await expect(page.getByRole('button',{name:'New cleaning task'})).toHaveCount(0);
 const cards=page.locator('.hk-cleaning-card');
 const count=await cards.count();
 for(let i=0;i<Math.min(12,count);i++){
  const card=cards.nth(i);
  const label=(await card.locator('.hk-open-task').innerText()).trim();
  await card.locator('.hk-open-task').click();
  const dialog=page.getByRole('dialog');
  await expect(dialog.getByRole('combobox',{name:'Assign staff member'})).toHaveCount(0);
  const status=dialog.getByRole('combobox',{name:'Cleaning progress'});
  if(/View task details/i.test(label)){
   await expect(status).toBeDisabled();
   await expect(dialog.getByRole('button',{name:'Save task updates'})).toHaveCount(0);
  }else if(/Start or update task|Update cleaning progress/i.test(label)){
   await expect(status).toBeEnabled();
   await expect(dialog.getByRole('button',{name:'Save task updates'})).toBeVisible();
  }
  await dialog.getByRole('button',{name:'Close',exact:true}).first().click();
 }
});
test('overdue flag is visible on a task card when the page includes a past-due open task',async({page})=>{
 const email=process.env.PMS_STAGING_ADMIN_EMAIL;
 const password=process.env.PMS_STAGING_ADMIN_PASSWORD;
 test.skip(!email||!password,'Dedicated administrator staging account is required.');
 await signInAndOpenHousekeeping(page,email!,password!);
 const cards=page.locator('.hk-cleaning-card.hk-cleaning-overdue');
 for(let i=0;i<Math.min(10,await cards.count());i++){
  await expect(cards.nth(i).getByText('Follow up on this overdue task.')).toBeVisible();
 }
});
