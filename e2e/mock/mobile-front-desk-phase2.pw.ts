import {expect,test} from '@playwright/test';

for(const width of [320,390,760]){
 test('front desk mobile date and queue controls fit at '+width+'px',async({page},testInfo)=>{
  test.skip(testInfo.project.name!=='mobile-chromium','Mobile layout regression');
  await page.setViewportSize({width,height:740});
  await page.goto('/front-desk');
  const dateInput=page.locator('input[aria-label="Front desk operational date"]');
  await expect(dateInput).toBeVisible();
  const dateNav=page.locator('.desk-date-nav');
  const queue=page.getByRole('group',{name:'Front desk queue'});
  await expect(queue).toBeVisible();
  for(const element of [dateNav,queue,page.locator('.desk-summary')]){
   expect(await element.evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBeTruthy();
  }
  for(const name of ['Previous date','Next date']){
   const bounds=await page.getByRole('button',{name}).boundingBox();
   expect(bounds?.height).toBeGreaterThanOrEqual(44);
  }
  const departures=queue.getByRole('button',{name:/Departures/});
  await departures.click();
  await expect(departures).toHaveAttribute('aria-pressed','true');
  expect((await departures.boundingBox())?.height).toBeGreaterThanOrEqual(44);
  await expect(page.getByRole('textbox',{name:'Search front desk queue'})).toBeVisible();
 });
}
