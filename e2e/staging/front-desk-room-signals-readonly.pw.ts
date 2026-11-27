import {expect,test} from '@playwright/test';

/** Read-only operational signal acceptance. No booking, cleaning or maintenance writes. */
test('front desk separates current restrictions from reported room-impact notes',async({page})=>{
 const email=process.env.PMS_STAGING_ADMIN_EMAIL??process.env.PMS_STAGING_EMAIL;
 const password=process.env.PMS_STAGING_ADMIN_PASSWORD??process.env.PMS_STAGING_PASSWORD;
 if(!email||!password)throw Error('Supply dedicated staging staff credentials.');
 await page.goto('/');
 await page.getByRole('textbox',{name:'Email address'}).fill(email);
 await page.getByLabel('Password',{exact:true}).fill(password);
 await page.getByRole('button',{name:'Sign in',exact:true}).click();
 await expect(page.locator('.workspace-nav, .auth-hotel-list').first()).toBeVisible();
 if(await page.locator('.auth-hotel-list').isVisible())await page.locator('.auth-hotel-list button').first().click();
 await page.getByRole('navigation',{name:'Hotel workspace navigation'})
  .getByRole('link',{name:'Front desk',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Front desk',exact:true})).toBeVisible();
 await expect(page.getByText('Current room checks:',{exact:false})).toHaveCount(0);
 await expect(page.getByRole('region',{name:'Arrivals',exact:true})).toBeVisible();
 const rows=page.locator('.mdesk-guest');
 if(await rows.count()){
  const roomSignals=rows.locator('.mdesk-room-warning');
  if(await roomSignals.count()){
   const advisories=roomSignals.filter({hasText:'Maintenance note'});
   for(let n=0;n<Math.min(10,await advisories.count());n++){
    await expect(advisories.nth(n)).toContainText('(advisory)');
   }
  }
 }
 const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
 expect(overflow).toBeLessThanOrEqual(2);
});

test('different arrival date cannot reuse current room-readiness evidence',async({page})=>{
 const email=process.env.PMS_STAGING_ADMIN_EMAIL??process.env.PMS_STAGING_EMAIL;
 const password=process.env.PMS_STAGING_ADMIN_PASSWORD??process.env.PMS_STAGING_PASSWORD;
 if(!email||!password)throw Error('Supply dedicated staging staff credentials.');
 await page.goto('/');
 await page.getByRole('textbox',{name:'Email address'}).fill(email);
 await page.getByLabel('Password',{exact:true}).fill(password);
 await page.getByRole('button',{name:'Sign in',exact:true}).click();
 await expect(page.locator('.workspace-nav, .auth-hotel-list').first()).toBeVisible();
 if(await page.locator('.auth-hotel-list').isVisible())await page.locator('.auth-hotel-list button').first().click();
 await page.getByRole('navigation',{name:'Hotel workspace navigation'})
  .getByRole('link',{name:'Front desk',exact:true}).click();
 await page.getByRole('button',{name:'Next date'}).click();
 await expect(page.getByText(/In-house and overdue: current hotel status/)).toBeVisible();
 await expect(page.locator('.mdesk-room-warning')).toHaveCount(0);
});
