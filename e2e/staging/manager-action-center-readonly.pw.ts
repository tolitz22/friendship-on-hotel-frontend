import {expect,test,type Page} from '@playwright/test';

/** Read-only Phase 62.6 smoke; never approves, charges, assigns or closes a case. */
async function signInManager(page:Page){
 const email=process.env.PMS_STAGING_ADMIN_EMAIL;
 const password=process.env.PMS_STAGING_ADMIN_PASSWORD;
 if(!email||!password)throw Error('Use a dedicated staging manager account.');
 await page.goto('/');
 await page.getByRole('textbox',{name:'Email address'}).fill(email);
 await page.getByLabel('Password',{exact:true}).fill(password);
 await page.getByRole('button',{name:'Sign in',exact:true}).click();
 await expect(page.locator('.workspace-nav, .auth-hotel-list').first()).toBeVisible();
 if(await page.locator('.auth-hotel-list').isVisible())
  await page.locator('.auth-hotel-list button').first().click();
 await page.getByRole('navigation',{name:'Hotel workspace navigation'})
  .getByRole('link',{name:/Review exceptions|Manager action center|Exceptions/}).click();
 await expect(page.getByRole('heading',{name:'What needs your attention?'})).toBeVisible();
}
for(const viewport of [{width:1440,height:900},{width:390,height:844}]){
 test('manager sees readable issue queues at '+viewport.width+'px',async({page})=>{
  test.skip(!process.env.PMS_STAGING_ADMIN_EMAIL||!process.env.PMS_STAGING_ADMIN_PASSWORD,
   'Staging manager credentials not configured.');
  await page.setViewportSize(viewport);
  await signInManager(page);
  // Summary is an accessible section; never infer availability from missing counts.
  await expect(page.getByRole('button',{name:/All tasks/})).toBeVisible();
  await expect(page.getByRole('button',{name:/Urgent/})).toBeVisible();
  await expect(page.getByRole('button',{name:/Needs action/})).toBeVisible();
  await expect(page.getByRole('button',{name:/Finance review/})).toBeVisible();
  await page.getByRole('button',{name:/Urgent/}).click();
  await expect(page.getByRole('button',{name:/Urgent/})).toHaveAttribute('aria-pressed','true');
  await page.getByRole('button',{name:/All tasks/}).click();
  const history=page.getByRole('button',{name:/Recent reservation activity/});
  await expect(history).toHaveAttribute('aria-expanded','false');
  await history.click();
  await expect(history).toHaveAttribute('aria-expanded','true');
  await history.click();
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(2);
 });
}
