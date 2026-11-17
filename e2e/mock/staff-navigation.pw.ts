import {test,expect} from '@playwright/test';

test.describe('staff workspace navigation in mock preview',()=>{
 test('exposes honest preview labels and daily operations navigation',async({page,isMobile})=>{
  await page.goto('/');
  await expect(page.getByText('DESIGN PREVIEW').first()).toBeVisible();
  const nav=page.getByRole('navigation',{name:'Hotel workspace navigation'});
  if(isMobile)await page.getByRole('button',{name:'Open navigation'}).click();
  await expect(nav.getByRole('link',{name:'Front desk'})).toBeVisible();
  await expect(nav.getByRole('link',{name:'Reservations'})).toBeVisible();
  await expect(nav.getByRole('link',{name:'Rooms & readiness'})).toBeVisible();
  await expect(nav.getByRole('link',{name:'Housekeeping'})).toBeVisible();
  await nav.getByRole('link',{name:'Reservations'}).click();
  await expect(page).toHaveURL(/\/reservations(?:\?|$)/);
  await expect(page.getByText('DESIGN PREVIEW').first()).toBeVisible();
  await expect(page.getByRole('button',{name:'Preview new booking'})).toBeVisible();
 });
 test('renders route-specific preview controls without relying on backend credentials',async({page})=>{
  await page.goto('/reservations');
  await page.getByRole('button',{name:'List',exact:true}).click();
  await expect(page.getByRole('textbox',{name:'Search reservations'})).toBeVisible();
  await page.getByRole('button',{name:'Calendar',exact:true}).click();
  await expect(page.getByRole('button',{name:'List',exact:true})).toHaveAttribute('aria-pressed','false');

  await page.goto('/rooms');
  await page.getByRole('button',{name:'Grid',exact:true}).click();
  await expect(page.getByRole('textbox',{name:'Search rooms'})).toBeVisible();
  await expect(page.getByRole('combobox',{name:'Floor'})).toBeVisible();
 });
 test('allows opening and closing navigation on a narrow screen',async({page,isMobile})=>{
  test.skip(!isMobile,'Mobile navigation behavior is validated on the narrow viewport.');
  await page.goto('/front-desk');
  const menu=page.getByRole('button',{name:'Open navigation'});
  await menu.click();
  const nav=page.getByRole('navigation',{name:'Hotel workspace navigation'});
  await expect(nav.getByRole('link',{name:'Housekeeping'})).toBeVisible();
  await nav.getByRole('link',{name:'Housekeeping'}).click();
  await expect(page).toHaveURL(/\/housekeeping(?:\?|$)/);
  await expect(menu).toBeVisible();
  await menu.click();
  await page.getByRole('button',{name:'Close menu'}).click();
  await expect(menu).toBeVisible();
 });
 test('changes preview theme without losing the selected page',async({page})=>{
  await page.goto('/front-desk');
  const toggle=page.getByRole('button',{name:/Switch to (dark|light) mode/});
  await toggle.click();
  await expect(page).toHaveURL(/\/front-desk(?:\?|$)/);
  await expect(page.locator('html')).toHaveAttribute('data-theme',/(light|dark)/);
 });
});
