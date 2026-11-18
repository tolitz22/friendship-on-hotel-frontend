import {expect,test} from '@playwright/test';

/** Cross-workspace navigational smoke test. No writes. */
test('maintenance work order links to the matching room readiness directory',async({page})=>{
 const email=process.env.PMS_STAGING_ADMIN_EMAIL??process.env.PMS_STAGING_EMAIL;
 const password=process.env.PMS_STAGING_ADMIN_PASSWORD??process.env.PMS_STAGING_PASSWORD;
 if(!email||!password)throw Error('Supply dedicated staging administrator credentials');
 await page.goto('/');
 await page.getByRole('textbox',{name:'Email address'}).fill(email);
 await page.getByLabel('Password',{exact:true}).fill(password);
 await page.getByRole('button',{name:'Sign in',exact:true}).click();
 await expect(page.locator('.workspace-nav, .auth-hotel-list').first()).toBeVisible();
 if(await page.locator('.auth-hotel-list').isVisible())await page.locator('.auth-hotel-list button').first().click();
 const nav=page.getByRole('navigation',{name:'Hotel workspace navigation'});
 await nav.getByRole('link',{name:'Maintenance',exact:true}).click();
 const first=page.locator('.mnt-work-card').first();
 if(await first.count()){
  const roomText=await first.locator('.mnt-work-card-head small').innerText();
  const number=roomText.split('Room ')[1]?.trim();
  await first.getByRole('link',{name:'Check room readiness'}).click();
  await expect(page.getByRole('heading',{name:'Find and inspect a room'})).toBeVisible();
  if(number)await expect(page.getByRole('searchbox',{name:'Search room numbers'})).toHaveValue(number);
 }
});
