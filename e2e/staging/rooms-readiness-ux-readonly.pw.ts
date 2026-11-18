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
 const firstRoom=page.locator('.rr-room-card').first();
 if(await firstRoom.count()){
  // Every room exposes its own inspection history, regardless of operational state.
  await expect(firstRoom.getByText('Next step')).toBeVisible();
  await expect(firstRoom.getByRole('button',{name:'View inspection history'})).toBeVisible();
  await firstRoom.getByRole('button',{name:'View inspection history'}).click();
  const drawer=page.getByRole('dialog',{name:/inspection and readiness/});
  await expect(drawer).toBeVisible();
  await expect(drawer.getByText('Operational blockers')).toBeVisible();
  await expect(drawer.getByText('Inspection history')).toBeVisible();
  await expect(drawer.locator('.rr-readiness-steps')).toBeVisible();
  const currentApproval=drawer.getByText('Inspection is current.');
  if(await currentApproval.count()){
   await expect(drawer.getByRole('button',{name:'Submit inspection for supervisor review'})).toHaveCount(0);
  }
  // Close without submitting an inspection or editing the room.
  await drawer.getByRole('button',{name:'Close',exact:true}).click();
  await expect(drawer).toHaveCount(0);
 }
 await page.getByRole('button',{name:/Readiness & arrivals/}).click();
 await expect(page.getByRole('button',{name:/Readiness & arrivals/})).toHaveAttribute('aria-pressed','true');
 await expect(page.getByRole('heading',{name:'What needs attention?'})).toBeVisible();
 await expect(page.getByRole('heading',{name:'Arrivals that may need action'})).toBeVisible();
 await expect(page.getByRole('heading',{name:'Rooms to inspect or clear'})).toBeVisible();
 await expect(page.getByRole('group',{name:'Filter arriving reservations'})).toBeVisible();
 await page.getByRole('button',{name:/^All \(/}).first().click();
 await expect(page.getByRole('group',{name:'Filter arriving reservations'}).getByRole('button',{name:/^All/}))
  .toHaveAttribute('aria-pressed','true');
 const findRoom=page.getByRole('button',{name:'Find room in inventory'}).first();
 if(await findRoom.count()){
  await findRoom.click();
  await expect(page.getByRole('button',{name:/Room inventory/})).toHaveAttribute('aria-pressed','true');
  await expect(page.getByRole('searchbox',{name:'Search room numbers'})).not.toHaveValue('');
 }
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
