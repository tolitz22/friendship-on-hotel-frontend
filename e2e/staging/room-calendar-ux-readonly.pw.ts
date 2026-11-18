import {test,expect} from '@playwright/test';

/** Read-only staging checks. Does not create or modify bookings. */
test('room rack calendar controls and filters are usable',async({page})=>{
 const email=process.env.PMS_STAGING_EMAIL;
 const password=process.env.PMS_STAGING_PASSWORD;
 if(!email||!password)throw new Error('Set dedicated PMS_STAGING_EMAIL and PMS_STAGING_PASSWORD');
 await page.goto('/');
 await page.getByRole('textbox',{name:'Email address'}).fill(email);
 await page.getByLabel('Password',{exact:true}).fill(password);
 await page.getByRole('button',{name:'Sign in',exact:true}).click();
 await expect(page.locator('.workspace-nav, .auth-hotel-list').first()).toBeVisible();
 if(await page.locator('.auth-hotel-list').isVisible())await page.locator('.auth-hotel-list button').first().click();
 const navigation=page.getByRole('navigation',{name:'Hotel workspace navigation'});
 await expect(navigation).toBeAttached();
 await navigation.getByRole('link',{name:'Room calendar',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Room rack'})).toBeVisible();
 const jump=page.getByLabel('Jump to calendar date');
 await expect(jump).toBeVisible();
 await jump.fill('2026-12-03');
 await expect(jump).toHaveValue('2026-12-03');
 await page.getByRole('button',{name:'Month',exact:true}).click();
 await expect(page.getByRole('button',{name:'Month',exact:true})).toHaveAttribute('aria-pressed','true');
 await page.getByRole('button',{name:'Week',exact:true}).click();
 await expect(page.getByRole('button',{name:'Week',exact:true})).toHaveAttribute('aria-pressed','true');
 const roomSearch=page.getByRole('textbox',{name:'Search room number'});
 await roomSearch.fill('impossible-test-room-999zzz');
 await expect(page.getByRole('button',{name:'Clear filters'})).toBeVisible();
 await page.getByRole('button',{name:'Clear filters'}).click();
 await expect(roomSearch).toHaveValue('');
 await expect(page.getByRole('button',{name:'Clear filters'})).toHaveCount(0);
 const widths=await page.evaluate(()=>({
  window:document.documentElement.clientWidth,
  content:document.documentElement.scrollWidth,
 }));
 expect(widths.content).toBeLessThanOrEqual(widths.window+2);
});

test('room rack mobile controls fit and scrolling stays inside the rack',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 const email=process.env.PMS_STAGING_EMAIL;
 const password=process.env.PMS_STAGING_PASSWORD;
 if(!email||!password)throw new Error('Set dedicated staging test user');
 await page.goto('/');
 await page.getByRole('textbox',{name:'Email address'}).fill(email);
 await page.getByLabel('Password',{exact:true}).fill(password);
 await page.getByRole('button',{name:'Sign in',exact:true}).click();
 await expect(page.locator('.workspace-nav, .auth-hotel-list').first()).toBeVisible();
 if(await page.locator('.auth-hotel-list').isVisible())await page.locator('.auth-hotel-list button').first().click();
 await page.getByRole('button',{name:'Open navigation'}).click();
 await page.getByRole('navigation',{name:'Hotel workspace navigation'})
  .getByRole('link',{name:'Room calendar',exact:true}).click();
 await expect(page.getByLabel('Jump to calendar date')).toBeVisible();
 await expect(page.getByRole('group',{name:'Calendar period'})).toBeVisible();
 const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
 expect(overflow).toBeLessThanOrEqual(2);
});
