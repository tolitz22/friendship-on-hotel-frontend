import {expect,test} from '@playwright/test';

/**
 * Read-only UI acceptance. Uses a dedicated staging user, never submits a
 * reservation or interacts with checkout/payment mutations.
 */
test('reservations filters, search, and mobile layout stay usable',async({page})=>{
 const email=process.env.PMS_STAGING_EMAIL;
 const password=process.env.PMS_STAGING_PASSWORD;
 if(!email||!password)throw new Error('Set dedicated PMS_STAGING_EMAIL and PMS_STAGING_PASSWORD');

 await page.goto('/');
 await expect(page.getByRole('textbox',{name:'Email address'})).toBeVisible();
 await page.getByRole('textbox',{name:'Email address'}).fill(email);
 await page.getByLabel('Password',{exact:true}).fill(password);
 await page.getByRole('button',{name:'Sign in',exact:true}).click();
 await expect(page.locator('.workspace-nav, .auth-hotel-list').first()).toBeVisible();
 if(await page.locator('.auth-hotel-list').isVisible()){
  await page.locator('.auth-hotel-list button').first().click();
 }
 const nav=page.getByRole('navigation',{name:'Hotel workspace navigation'});
 await expect(nav).toBeAttached();
 await nav.getByRole('link',{name:'Reservations',exact:true}).click();

 await expect(page.getByRole('heading',{name:'Reservations',exact:true}).first()).toBeVisible();
 const finder=page.getByRole('textbox',{name:'Search all reservations'});
 await expect(finder).toBeVisible();
 await page.getByRole('button',{name:'Needs room'}).click();
 await expect(page.getByRole('button',{name:'Needs room'})).toHaveAttribute('aria-pressed','true');
 await expect(page.getByRole('button',{name:'Clear filters'})).toBeVisible();
 await finder.fill('unlikely-reservation-123xyz');
 await expect(page.getByRole('button',{name:'Clear reservation search'})).toBeVisible();
 await page.getByRole('button',{name:'Clear reservation search'}).click();
 await expect(finder).toHaveValue('');
 await page.getByRole('button',{name:'Clear filters'}).click();
 await expect(page.getByRole('button',{name:'All',exact:true})).toHaveAttribute('aria-pressed','true');
 await expect(page.getByRole('button',{name:'Clear filters'})).toHaveCount(0);

 const dimensions=await page.evaluate(()=>({
  clientWidth:document.documentElement.clientWidth,
  scrollWidth:document.documentElement.scrollWidth,
 }));
 expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth+2);
});

test('mobile reservations actions fit the viewport without booking writes',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 const email=process.env.PMS_STAGING_EMAIL;
 const password=process.env.PMS_STAGING_PASSWORD;
 if(!email||!password)throw new Error('Set dedicated staging user credentials');
 await page.goto('/');
 await page.getByRole('textbox',{name:'Email address'}).fill(email);
 await page.getByLabel('Password',{exact:true}).fill(password);
 await page.getByRole('button',{name:'Sign in',exact:true}).click();
 await expect(page.locator('.workspace-nav, .auth-hotel-list').first()).toBeVisible();
 if(await page.locator('.auth-hotel-list').isVisible()){
  await page.locator('.auth-hotel-list button').first().click();
 }
 await page.getByRole('button',{name:'Open navigation'}).click();
 await page.getByRole('navigation',{name:'Hotel workspace navigation'})
  .getByRole('link',{name:'Reservations',exact:true}).click();
 await expect(page.getByRole('textbox',{name:'Search all reservations'})).toBeVisible();
 await expect(page.getByRole('group',{name:'Reservation status filter'})).toBeVisible();
 const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
 expect(overflow).toBeLessThanOrEqual(2);
});
