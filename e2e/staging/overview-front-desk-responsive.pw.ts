import {test,expect,type Page} from '@playwright/test';

/**
 * Read-only acceptance of the real live UI. Credentials come exclusively
 * from environment variables; no traces, screenshots or guest data exports.
 * Runs against both a desktop viewport and a narrow mobile viewport.
 */
async function login(page:Page){
 const email=process.env.PMS_STAGING_EMAIL;
 const password=process.env.PMS_STAGING_PASSWORD;
 if(!email||!password)throw new Error('Set PMS_STAGING_EMAIL and PMS_STAGING_PASSWORD');
 await page.goto('/');
 await expect(page.getByRole('textbox',{name:'Email address'})).toBeVisible();
 await page.getByRole('textbox',{name:'Email address'}).fill(email);
 await page.getByLabel('Password',{exact:true}).fill(password);
 await page.getByRole('button',{name:'Sign in',exact:true}).click();
 await expect(page.locator('.workspace-nav, .auth-hotel-list').first()).toBeVisible();
 const chooser=page.locator('.auth-hotel-list');
 if(await chooser.isVisible()){
  await chooser.locator('button').first().click();
 }
 await expect(page.getByRole('navigation',{name:'Hotel workspace navigation'})).toBeAttached();
}

async function noHorizontalOverflow(page:Page){
 const metrics=await page.evaluate(()=>({
  viewport:document.documentElement.clientWidth,
  scrollWidth:document.documentElement.scrollWidth,
 }));
 expect(metrics.scrollWidth,'Page should not require horizontal scrolling').toBeLessThanOrEqual(metrics.viewport+2);
}

for(const viewport of [
 {name:'desktop',width:1440,height:900},
 {name:'mobile',width:390,height:844},
] as const){
 test.describe('live Overview and Front Desk — '+viewport.name,()=>{
  test.use({viewport:{width:viewport.width,height:viewport.height},
   isMobile:viewport.name==='mobile',hasTouch:viewport.name==='mobile'});

  test('overview tasks and deep-linked queues are legible and read-only',async({page})=>{
   await login(page);
   // Only hotel managers receive the LiveDashboard; reception uses RoleHome.
   const isManager=await page.getByRole('heading',{name:/Good day,/}).isVisible();
   if(!isManager)test.skip(true,'Selected staff role has a different authorized home screen.');
   await expect(page.getByRole('heading',{name:'Front desk today'})).toBeVisible();
   await expect(page.getByRole('heading',{name:'Quick actions'})).toBeVisible();
   await expect(page.getByRole('heading',{name:'Registered room inventory'})).toBeVisible();
   await expect(page.getByRole('link',{name:'New reservation'})).toHaveAttribute('href',/mode=new/);
   await noHorizontalOverflow(page);
   for(const [name,queue,pressed] of [
    ['View expected arrivals','arrivals','Arrivals'],
    ['View due departures','departures','Departures'],
    ['View in-house reservations','in_house','In-house'],
   ] as const){
    // Return via the app UI to preserve in-memory bearer auth.
    const card=page.getByRole('link',{name});
    await card.click();
    await expect(page).toHaveURL(new RegExp('queue='+queue));
    await expect(page.getByRole('button',{name:new RegExp('^'+pressed+'\\s')})).toHaveAttribute('aria-pressed','true');
    await expect(page.getByRole('heading',{name:'Front desk',exact:true}).first()).toBeVisible();
    await noHorizontalOverflow(page);
    if(viewport.name==='mobile'){
     await page.getByRole('button',{name:'Open navigation'}).click();
     await expect(page.getByRole('navigation',{name:'Hotel workspace navigation'})).toBeVisible();
     await page.getByRole('navigation',{name:'Hotel workspace navigation'})
      .getByRole('link',{name:'Overview'}).click();
    }else{
     await page.getByRole('navigation',{name:'Hotel workspace navigation'})
      .getByRole('link',{name:'Overview'}).click();
    }
    await expect(page.getByRole('heading',{name:/Good day,/})).toBeVisible();
   }
  });

  test('front desk date and queue search controls work without changing records',async({page})=>{
   await login(page);
   // Navigate through in-app links to preserve access tokens in memory-only sessions.
   if(viewport.name==='mobile')await page.getByRole('button',{name:'Open navigation'}).click();
   await page.getByRole('navigation',{name:'Hotel workspace navigation'})
    .getByRole('link',{name:'Front desk',exact:true}).click();
   await expect(page.getByRole('heading',{name:'Front desk',exact:true}).first()).toBeVisible();
   const date=page.getByLabel('Front desk operational date');
   await expect(date).toBeVisible();
   await page.getByRole('button',{name:'Next date'}).click();
   await page.getByRole('button',{name:'Today',exact:true}).click();
   await page.getByRole('button',{name:/^Departures\s/}).first().click();
   await expect(page.getByRole('button',{name:/^Departures\s/}).first()).toHaveAttribute('aria-pressed','true');
   const search=page.getByRole('textbox',{name:'Search current manifest page'});
   await search.fill('unlikely-search-term-123xyz');
   await expect(page.getByRole('button',{name:'Clear search'})).toBeVisible();
   await page.getByRole('button',{name:'Clear search'}).click();
   await expect(search).toHaveValue('');
   await noHorizontalOverflow(page);
  });
 });
}
