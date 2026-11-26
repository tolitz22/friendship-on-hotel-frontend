import {expect,test} from '@playwright/test';

for(const width of [320,390,760]){
 test('guest directory cards fit at '+width+'px',async({page},testInfo)=>{
  test.skip(testInfo.project.name!=='mobile-chromium','Mobile layout regression');
  await page.setViewportSize({width,height:740});
  await page.goto('/guests');
  const cards=page.locator('.guest-mobile-cards');
  await expect(cards).toBeVisible();
  await expect(cards.locator('.guest-mobile-card').first()).toBeVisible();
  await expect(page.locator('.guest-directory-table')).toBeHidden();
  expect(await cards.evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBeTruthy();
  await expect(page.getByRole('textbox',{name:'Search guests'})).toBeVisible();
 });
}
test('desktop guest directory retains table',async({page},testInfo)=>{
 test.skip(testInfo.project.name!=='desktop-chromium','Desktop layout regression');
 await page.goto('/guests');
 await expect(page.locator('.guest-directory-table')).toBeVisible();
 await expect(page.locator('.guest-mobile-cards')).toBeHidden();
});
