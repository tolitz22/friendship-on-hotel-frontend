import {expect,test,type Page} from '@playwright/test';

/** Staging smoke coverage is read-only: never opens, closes or reconciles a real shift. */
async function openCashierPage(page:Page,email:string,password:string){
 await page.goto('/');
 await page.getByRole('textbox',{name:'Email address'}).fill(email);
 await page.getByLabel('Password',{exact:true}).fill(password);
 await page.getByRole('button',{name:'Sign in',exact:true}).click();
 await expect(page.locator('.workspace-nav, .auth-hotel-list').first()).toBeVisible();
 if(await page.locator('.auth-hotel-list').isVisible())
  await page.locator('.auth-hotel-list button').first().click();
 await page.getByRole('navigation',{name:'Hotel workspace navigation'})
  .getByRole('link',{name:/Cashier shifts|Cash reconciliation/i}).click();
 await expect(page.getByText('My cash drawer')).toBeVisible();
}

test('manager has their own cash drawer and a separate independent review queue',async({page})=>{
 const email=process.env.PMS_STAGING_ADMIN_EMAIL,password=process.env.PMS_STAGING_ADMIN_PASSWORD;
 test.skip(!email||!password,'Dedicated administrator staging account required');
 await openCashierPage(page,email!,password!);
 await expect(page.getByText('All hotel cashier shifts')).toBeVisible();
 const ownDrawer=page.getByRole('heading',{name:'My cash drawer'}).locator('..');
 if(await ownDrawer.getByRole('button',{name:'Open my cashier shift'}).count()){
  await expect(ownDrawer.getByRole('button',{name:'Open my cashier shift'})).toBeVisible();
 }else{
  await expect(ownDrawer.getByText(/Your open shift/)).toBeVisible();
 }
 // Never submit a shift, receipt, count or reconciliation in smoke tests.
});

test('front desk employee sees only their own active cash shift',async({page})=>{
 const email=process.env.PMS_STAGING_FRONT_DESK_EMAIL,password=process.env.PMS_STAGING_FRONT_DESK_PASSWORD;
 test.skip(!email||!password,'Dedicated front desk staging account required');
 await openCashierPage(page,email!,password!);
 await expect(page.getByText('My shift history')).toBeVisible();
 await expect(page.getByText('All hotel cashier shifts')).toHaveCount(0);
 await expect(page.getByRole('button',{name:'Reconcile balanced shift'})).toHaveCount(0);
});
