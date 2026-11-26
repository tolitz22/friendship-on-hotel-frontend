import {test,expect} from '@playwright/test';

test.describe('staff workspace navigation in mock preview',()=>{
 test('exposes honest preview labels and daily operations navigation',async({page,isMobile})=>{
  await page.goto('/');
  const nav=page.getByRole('navigation',{name:'Hotel workspace navigation'});
  const menu=page.getByRole('button',{name:'Open navigation'});
  if(isMobile)await menu.click();
  await expect(page.getByText('Design preview only',{exact:true})).toBeVisible();
  await expect(nav.getByRole('link',{name:'Front desk'})).toBeVisible();
  await expect(nav.getByRole('link',{name:'Bookings',exact:true})).toBeVisible();
  await expect(nav.getByRole('link',{name:'Rooms & readiness'})).toBeVisible();
  await nav.getByRole('button',{name:'More operations'}).click();
  await expect(nav.getByRole('link',{name:'Housekeeping'})).toBeVisible();
  await nav.getByRole('link',{name:'Bookings',exact:true}).click();
  await expect(page).toHaveURL(/\/reservations(?:\?|$)/);
  if(isMobile){
   await menu.click();
   await expect(page.getByText('Design preview only',{exact:true})).toBeVisible();
   await page.getByRole('button',{name:'Close menu'}).click();
  }else{
   await expect(page.getByText('DESIGN PREVIEW',{exact:true})).toBeVisible();
  }
  await expect(page.getByRole('button',{name:'Preview new booking'})).toBeVisible();
 });
 test('renders route-specific preview controls without relying on backend credentials',async({page})=>{
  await page.goto('/reservations');
  await page.getByRole('button',{name:'List',exact:true}).click();
  await expect(page.getByRole('textbox',{name:'Search bookings'})).toBeVisible();
  await page.getByRole('button',{name:'Calendar',exact:true}).click();
  await expect(page.getByRole('button',{name:'List',exact:true})).toHaveAttribute('aria-pressed','false');

  await page.goto('/rooms');
  await page.getByRole('button',{name:'Grid',exact:true}).click();
  await expect(page.getByRole('textbox',{name:'Search rooms'})).toBeVisible();
  await expect(page.getByRole('combobox',{name:'Floor'})).toBeVisible();
 });
 test('opens a simulated booking as a clearly non-persistent preview',async({page})=>{
  await page.goto('/reservations');
  await page.getByRole('button',{name:'Preview new booking'}).click();
  const dialog=page.getByRole('dialog',{name:'New reservation preview'});
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('No reservation will be created or saved.')).toBeVisible();
  await dialog.getByRole('button',{name:'Close booking wizard'}).click();
  await expect(dialog).toHaveCount(0);
 });
 test('allows opening and closing navigation on a narrow screen',async({page,isMobile})=>{
  test.skip(!isMobile,'Mobile navigation behavior is validated on the narrow viewport.');
  await page.goto('/front-desk');
  const menu=page.getByRole('button',{name:'Open navigation'});
  await menu.click();
  const nav=page.getByRole('navigation',{name:'Hotel workspace navigation'});
  await nav.getByRole('button',{name:'More operations'}).click();
  await expect(nav.getByRole('link',{name:'Housekeeping'})).toBeVisible();
  await nav.getByRole('link',{name:'Housekeeping'}).click();
  await expect(page).toHaveURL(/\/housekeeping(?:\?|$)/);
  await expect(menu).toBeVisible();
  await menu.click();
  await page.getByRole('button',{name:'Close menu'}).click();
  await expect(menu).toBeVisible();
 });
 test('keeps keyboard focus in mobile navigation and returns it on Escape',async({page,isMobile})=>{
  test.skip(!isMobile,'Mobile navigation behavior is validated on the narrow viewport.');
  await page.goto('/front-desk');
  const menu=page.getByRole('button',{name:'Open navigation'});
  const nav=page.getByRole('navigation',{name:'Hotel workspace navigation'});
  await expect(nav).toBeHidden();
  await page.keyboard.press('Tab');
  await expect(menu).toBeFocused();
  await page.keyboard.press('Enter');
  const drawer=page.getByRole('dialog',{name:'Workspace navigation'});
  const close=drawer.getByRole('button',{name:'Close menu'});
  await expect(close).toBeFocused();
  await expect(page.locator('main')).toHaveAttribute('inert','');
  await page.keyboard.press('Shift+Tab');
  await expect(nav.getByRole('link').last()).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(close).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(nav.getByRole('link',{name:'Overview'})).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(nav).toBeHidden();
  await expect(menu).toBeFocused();
 });
 test('does not throw browser runtime errors while navigating daily previews',async({page})=>{
  const errors:string[]=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto('/');
  for(const [route,title] of [['/front-desk','Front desk'],['/reservations','Bookings'],
   ['/rooms','Rooms & readiness'],['/guests','Guests'],['/housekeeping','Housekeeping']]){
   await page.goto(route);
   await expect(page.getByRole('heading',{name:title,level:1,exact:true})).toBeVisible();
  }
  expect(errors).toEqual([]);
 });
 test('changes preview theme without losing the selected page',async({page})=>{
  await page.goto('/front-desk');
  const toggle=page.getByRole('button',{name:/Switch to (dark|light) mode/});
  await toggle.click();
  await expect(page).toHaveURL(/\/front-desk(?:\?|$)/);
  await expect(page.locator('html')).toHaveAttribute('data-theme',/(light|dark)/);
 });
});
