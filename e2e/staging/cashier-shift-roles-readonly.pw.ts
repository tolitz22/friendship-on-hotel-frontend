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
 await expect(page.getByText('Review other shifts and history')).toBeVisible();
 const ownDrawer=page.getByRole('region',{name:'My cash drawer'});
 if(await ownDrawer.getByRole('button',{name:'Open my cashier shift'}).count()){
  await expect(ownDrawer.getByRole('button',{name:'Open my cashier shift'})).toBeVisible();
 }else{
  await expect(ownDrawer.getByText('Ready to accept guest cash payments')).toBeVisible();
  await expect(ownDrawer.getByRole('link',{name:/Find a guest and record payment/})).toBeVisible();
  await expect(ownDrawer.getByRole('button',{name:/End cashier shift/})).toHaveAttribute('aria-expanded','false');
 }
 // Never submit a shift, receipt, count or reconciliation in smoke tests.
});

test('front desk employee sees only their own active cash shift',async({page})=>{
 const email=process.env.PMS_STAGING_FRONT_DESK_EMAIL,password=process.env.PMS_STAGING_FRONT_DESK_PASSWORD;
 test.skip(!email||!password,'Dedicated front desk staging account required');
 await openCashierPage(page,email!,password!);
 await expect(page.getByText('Previous cashier shifts')).toBeVisible();
 await expect(page.getByText('Review other shifts and history')).toHaveCount(0);
 await expect(page.getByRole('button',{name:'Reconcile balanced shift'})).toHaveCount(0);
});

/** A user can explore closing their shift without submitting any cash count. */
test('end-shift cash counting is collapsed by default and requires confirmation',async({page})=>{
 const email=process.env.PMS_STAGING_ADMIN_EMAIL,password=process.env.PMS_STAGING_ADMIN_PASSWORD;
 test.skip(!email||!password,'Dedicated administrator staging account required');
 await openCashierPage(page,email!,password!);
 const toggle=page.getByRole('button',{name:/End cashier shift/});
 if(await toggle.count()){
  await expect(toggle).toHaveAttribute('aria-expanded','false');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded','true');
  const send=page.getByRole('dialog',{name:'End cashier shift'}).getByRole('button',{name:'Submit count and end shift'});
  await expect(send).toBeDisabled();
  await page.getByLabel('Actual cash counted (₱)').fill('0.00');
  await expect(send).toBeDisabled();
  await page.getByRole('dialog',{name:'End cashier shift'}).getByRole('button',{name:'Cancel',exact:true}).click();
  await expect(toggle).toHaveAttribute('aria-expanded','false');
 }
});
