import {expect,test} from '@playwright/test';

for(const width of [320,390,760]){
 test('mobile room calendar uses day navigation at '+width+'px',async({page},testInfo)=>{
  test.skip(testInfo.project.name!=='mobile-chromium','Mobile layout regression');
  await page.setViewportSize({width,height:740});
  await page.goto('/room-calendar');
  const periods=page.getByRole('group',{name:'Calendar period'});
  const day=periods.getByRole('button',{name:'Day',exact:true});
  await expect(day).toHaveAttribute('aria-pressed','true');
  const date=page.getByLabel('Jump to calendar date');
  await date.fill('2026-11-27');
  await page.getByRole('button',{name:'Next period'}).click();
  await expect(date).toHaveValue('2026-11-28');
  await page.getByRole('button',{name:'Previous period'}).click();
  await expect(date).toHaveValue('2026-11-27');
  const filters=page.getByRole('button',{name:'Room filters',exact:true});
  await expect(filters).toHaveAttribute('aria-expanded','false');
  await filters.click();
  await expect(page.getByLabel('Search room number')).toBeVisible();
  await page.getByRole('button',{name:'Hide filters'}).click();
  await expect(page.getByLabel('Search room number')).toBeHidden();
  await periods.getByRole('button',{name:'Week',exact:true}).click();
  await expect(periods.getByRole('button',{name:'Week',exact:true})).toHaveAttribute('aria-pressed','true');
  await periods.getByRole('button',{name:'Month',exact:true}).click();
  await expect(periods.getByRole('button',{name:'Month',exact:true})).toHaveAttribute('aria-pressed','true');
  for(const name of ['Previous period','Next period']){
   const bounds=await page.getByRole('button',{name}).boundingBox();
   expect(bounds?.height).toBeGreaterThanOrEqual(44);
  }
  expect(await page.locator('.lrc-toolbar').evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBeTruthy();
 });
}
test('desktop room calendar retains week default and visible filters',async({page},testInfo)=>{
 test.skip(testInfo.project.name!=='desktop-chromium','Desktop layout regression');
 await page.goto('/room-calendar');
 await expect(page.getByRole('group',{name:'Calendar period'}).getByRole('button',{name:'Week',exact:true})).toHaveAttribute('aria-pressed','true');
 await expect(page.getByLabel('Search room number')).toBeVisible();
});
