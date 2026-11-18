import {test,expect,type Page} from '@playwright/test';

/** Read-only staging QA: never submits inspection, booking, or room edits. */
async function enterRooms(page:Page,mobile=false){
 const email=process.env.PMS_STAGING_EMAIL;
 const password=process.env.PMS_STAGING_PASSWORD;
 if(!email||!password)throw new Error('Provide staging staff email/password through environment variables');
 await page.goto('/');
 await page.getByRole('textbox',{name:'Email address'}).fill(email);
 await page.getByLabel('Password',{exact:true}).fill(password);
 await page.getByRole('button',{name:'Sign in',exact:true}).click();
 await expect(page.locator('.workspace-nav, .auth-hotel-list').first()).toBeVisible();
 if(await page.locator('.auth-hotel-list').isVisible())
  await page.locator('.auth-hotel-list button').first().click();
 await expect(page.getByRole('navigation',{name:'Hotel workspace navigation'})).toBeAttached();
 if(mobile)await page.getByRole('button',{name:'Open navigation'}).click();
 await page.getByRole('navigation',{name:'Hotel workspace navigation'})
  .getByRole('link',{name:'Rooms & readiness'}).click();
 await expect(page.getByRole('heading',{name:'Rooms & readiness'}).first()).toBeVisible();
}
test('rooms catalogue supports safe filtering, summary and readiness navigation',async({page})=>{
 await enterRooms(page);
 await expect(page.getByRole('button',{name:/Room inventory/})).toHaveAttribute('aria-pressed','true');
 await expect(page.getByRole('heading',{name:'Find and inspect a room'})).toBeVisible();
 const search=page.getByRole('searchbox',{name:'Search room numbers'});
 await search.fill('room-number-not-present-abc999');
 await expect(page.getByRole('button',{name:'Clear filters'})).toBeVisible();
 await page.getByRole('button',{name:'Clear filters'}).click();
 await expect(search).toHaveValue('');
 await page.getByRole('button',{name:/Readiness & arrivals/}).click();
 await expect(page.getByRole('button',{name:/Readiness & arrivals/})).toHaveAttribute('aria-pressed','true');
 await expect(page.getByRole('heading',{name:'Room readiness · Operational dashboard'})).toBeVisible();
 await page.getByRole('button',{name:/Room inventory/}).click();
 await expect(page.getByRole('button',{name:/Room inventory/})).toHaveAttribute('aria-pressed','true');
 const widths=await page.evaluate(()=>({
  client:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth,
 }));
 expect(widths.scroll).toBeLessThanOrEqual(widths.client+2);
});
test('mobile rooms view shows operational controls without document overflow',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await enterRooms(page,true);
 await expect(page.getByRole('heading',{name:'Find and inspect a room'})).toBeVisible();
 await expect(page.getByRole('searchbox',{name:'Search room numbers'})).toBeVisible();
 await expect(page.getByRole('combobox',{name:'Filter room floor'})).toBeVisible();
 const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
 expect(overflow).toBeLessThanOrEqual(2);
});
