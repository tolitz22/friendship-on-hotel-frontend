import {expect,test,type Page} from '@playwright/test';

/** Staging-only read-only acceptance; does not change cleaning or room status. */
async function openHousekeeping(page:Page,mobile=false){
 const email=process.env.PMS_STAGING_EMAIL;
 const password=process.env.PMS_STAGING_PASSWORD;
 if(!email||!password)throw new Error('Supply a staging staff email and password via environment variables.');
 await page.goto('/');
 await page.getByRole('textbox',{name:'Email address'}).fill(email);
 await page.getByLabel('Password',{exact:true}).fill(password);
 await page.getByRole('button',{name:'Sign in',exact:true}).click();
 await expect(page.locator('.workspace-nav, .auth-hotel-list').first()).toBeVisible();
 if(await page.locator('.auth-hotel-list').isVisible())await page.locator('.auth-hotel-list button').first().click();
 if(mobile)await page.getByRole('button',{name:'Open navigation'}).click();
 await page.getByRole('navigation',{name:'Hotel workspace navigation'})
  .getByRole('link',{name:'Housekeeping',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Housekeeping',exact:true})).toBeVisible();
}
test('housekeeping list supports focused task filters and read-only task review',async({page})=>{
 await openHousekeeping(page);
 await expect(page.getByRole('heading',{name:'Cleaning workload'})).toBeVisible();
 await expect(page.getByRole('heading',{name:'Cleaning task queue'})).toBeVisible();
 await expect(page.getByRole('group',{name:'Task status'})).toBeVisible();
 await expect(page.getByText('Cleaning done is not room approved.')).toBeVisible();
 const search=page.getByRole('searchbox',{name:'Search tasks on this page'});
 await search.fill('room-not-found-987123');
 await expect(page.getByRole('button',{name:'Clear filters'})).toBeVisible();
 await page.getByRole('button',{name:'Clear filters'}).click();
 await expect(search).toHaveValue('');
 await page.getByRole('group',{name:'Task status'}).getByRole('button',{name:'To do'}).click();
 await expect(page.getByRole('group',{name:'Task status'}).getByRole('button',{name:'To do'}))
  .toHaveAttribute('aria-pressed','true');
 await page.getByRole('group',{name:'Task status'}).getByRole('button',{name:'All tasks'}).click();
 const card=page.locator('.hk-cleaning-card').first();
 if(await card.count()){
  await card.locator('.hk-open-task').click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('dialog').getByText('Cleaning record only.')).toBeVisible();
  await page.getByRole('dialog').getByRole('button',{name:'Close',exact:true}).first().click();
 }
 const sizes=await page.evaluate(()=>[document.documentElement.scrollWidth,document.documentElement.clientWidth]);
 expect(sizes[0]).toBeLessThanOrEqual(sizes[1]+2);
});
test('housekeeping mobile queue fits without document horizontal overflow',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await openHousekeeping(page,true);
 await expect(page.getByRole('searchbox',{name:'Search tasks on this page'})).toBeVisible();
 await expect(page.getByRole('combobox',{name:'Filter task type'})).toBeVisible();
 const sizes=await page.evaluate(()=>[document.documentElement.scrollWidth,document.documentElement.clientWidth]);
 expect(sizes[0]).toBeLessThanOrEqual(sizes[1]+2);
});
