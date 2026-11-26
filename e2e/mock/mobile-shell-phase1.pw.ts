import {expect,test} from '@playwright/test';

for(const width of [320,390,760]){
 test('mobile shell remains usable at '+width+'px',async({page},testInfo)=>{
  test.skip(testInfo.project.name!=='mobile-chromium','Mobile viewport regression');
  await page.setViewportSize({width,height:740});
  await page.goto('/');
  const header=page.locator('.topbar');
  const menu=page.getByRole('button',{name:'Open navigation'});
  await expect(menu).toBeVisible();
  const bounds=await menu.boundingBox();
  expect(bounds?.width).toBeGreaterThanOrEqual(44);
  expect(bounds?.height).toBeGreaterThanOrEqual(44);
  const headerFits=await header.evaluate(el=>el.scrollWidth<=el.clientWidth+1);
  expect(headerFits).toBeTruthy();
  await menu.click();
  const drawer=page.getByRole('dialog',{name:'Workspace navigation'});
  await expect(drawer).toBeVisible();
  await expect(page.locator('.main-area')).toHaveAttribute('inert','');
  await expect(drawer.getByRole('link',{name:'Bookings',exact:true})).toBeVisible();
  expect(await page.evaluate(()=>getComputedStyle(document.body).overflow)).toBe('hidden');
  await drawer.getByRole('button',{name:'Close menu'}).click();
  await expect(drawer).toHaveCount(0);
  await expect(menu).toBeFocused();
  await expect(page.locator('.main-area')).not.toHaveAttribute('inert','');
  await menu.click();
  await drawer.getByRole('link',{name:'Bookings',exact:true}).click();
  await expect(page).toHaveURL(/\/reservations(?:\?|$)/);
  await expect(page.getByRole('heading',{name:'Bookings',exact:true,level:1})).toBeVisible();
  await expect(drawer).toHaveCount(0);
 });
}
