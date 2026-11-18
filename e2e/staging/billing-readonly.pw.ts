import {expect,test,type Page} from '@playwright/test';

/** Staging-only read-only billing QA: no charges, payment records or sign-offs submitted. */
async function openBilling(page:Page,email:string,password:string,mobile=false){
 await page.goto('/');
 await page.getByRole('textbox',{name:'Email address'}).fill(email);
 await page.getByLabel('Password',{exact:true}).fill(password);
 await page.getByRole('button',{name:'Sign in',exact:true}).click();
 await expect(page.locator('.workspace-nav, .auth-hotel-list').first()).toBeVisible();
 if(await page.locator('.auth-hotel-list').isVisible())
  await page.locator('.auth-hotel-list button').first().click();
 if(mobile)await page.getByRole('button',{name:'Open navigation'}).click();
 await page.getByRole('navigation',{name:'Hotel workspace navigation'})
  .getByRole('link',{name:/Billing|Guest folios/i}).click();
 await expect(page.getByRole('heading',{name:'Guest billing'})).toBeVisible();
}
test('real priced folio directory and settlement statement are accessible without writes',async({page})=>{
 const email=process.env.PMS_STAGING_ADMIN_EMAIL??process.env.PMS_STAGING_EMAIL;
 const password=process.env.PMS_STAGING_ADMIN_PASSWORD??process.env.PMS_STAGING_PASSWORD;
 if(!email||!password)throw Error('Provide dedicated staging finance staff account.');
 await openBilling(page,email,password);
 await expect(page.getByRole('heading',{name:'Who would you like to bill?'})).toBeVisible();
 await expect(page.locator('text=Sample folio overview')).toHaveCount(0);
 const search=page.getByRole('searchbox',{name:'Search folios'});
 await search.fill('nonexistent-folio-999891');
 await expect(page.getByText('No matching guest accounts')).toBeVisible();
 await page.getByRole('button',{name:'Clear search'}).click();
 await expect(search).toHaveValue('');
 const row=page.locator('.billing-folio-row').first();
 if(await row.count()){
  await row.getByRole('link',{name:/Open folio for booking/}).click();
  await expect(page.locator('.billing-account-overview')).toBeVisible();
  await page.getByRole('button',{name:'Record payment',exact:true}).click();
  const payment=page.getByRole('dialog',{name:'Record guest payment'});
  if(await payment.count()){
   await expect(payment.getByRole('button',{name:'Cash',exact:true})).toBeVisible();
   if(await payment.getByLabel('Payment amount (₱)').count()){
    await payment.getByLabel('Payment amount (₱)').fill('2500');
    await payment.getByLabel('Cash handed to you (₱)').fill('3000');
    await expect(payment.getByText('₱500.00')).toBeVisible();
    await expect(payment.getByRole('button',{name:/Record cash payment/})).toBeDisabled();
   }
  }
  await payment.getByRole('button',{name:'Close dialog'}).click();
  await page.locator('.billing-statement-details > summary').click();
  await expect(page.getByRole('heading',{name:'Guest account statement'})).toBeVisible();
  await expect(page.getByText('This is an internal PMS guest-account statement',{exact:false})).toBeVisible();
  await page.getByRole('button',{name:'Back to guest accounts'}).click();
  await expect(page.getByRole('heading',{name:'Guest account statement'})).toHaveCount(0);
 }
 const sizes=await page.evaluate(()=>[document.documentElement.scrollWidth,document.documentElement.clientWidth]);
 expect(sizes[0]).toBeLessThanOrEqual(sizes[1]+2);
});
test('manager can preview adding charges without submitting financial writes',async({page})=>{
 const email=process.env.PMS_STAGING_ADMIN_EMAIL,password=process.env.PMS_STAGING_ADMIN_PASSWORD;
 test.skip(!email||!password,'Dedicated administrator staging account required');
 await openBilling(page,email!,password!);
 const row=page.locator('.billing-folio-row').first();
 if(!await row.count())return;
 await row.getByRole('link',{name:/Open folio for booking/}).click();
 const add=page.getByRole('button',{name:'Add charge or correction'});
 if(!await add.count())return; // Signed accounts cannot be adjusted.
 await add.click();
 const manager=page.getByRole('dialog',{name:'Update guest bill'}); // Signed accounts do not permit new charges.
 await expect(manager.getByRole('button',{name:/Add a charge/})).toHaveAttribute('aria-pressed','true');
 await manager.getByLabel('Description of charge').fill('Two bottled waters');
 await manager.getByLabel('Amount to add (₱)').fill('100.00');
 await expect(manager.getByText('Updated recorded charges')).toBeVisible();
 await expect(manager.getByRole('button',{name:'Add charge to guest bill'})).toBeDisabled();
 await manager.getByRole('button',{name:/Apply a correction/}).click();
 await expect(manager.getByText('This is not a refund',{exact:false})).toBeVisible();
 await expect(manager.getByRole('button',{name:'Apply bill correction'})).toBeDisabled();
});

test('front-desk account can review folios without manager-only financial write controls',async({page})=>{
 const email=process.env.PMS_STAGING_FRONT_DESK_EMAIL;
 const password=process.env.PMS_STAGING_FRONT_DESK_PASSWORD;
 test.skip(!email||!password,'Dedicated reception staging account required.');
 await openBilling(page,email!,password!);
 await expect(page.getByRole('heading',{name:'Who would you like to bill?'})).toBeVisible();
 const row=page.locator('.billing-folio-row').first();
 if(await row.count()){
  await row.getByRole('link',{name:/Open folio for booking/}).click();
  await expect(page.locator('.billing-account-overview')).toBeVisible();
  await expect(page.getByRole('region',{name:'Manager folio actions'})).toHaveCount(0);
  await page.getByRole('button',{name:'Record payment',exact:true}).click();
  const payment=page.getByRole('dialog',{name:'Record guest payment'});
  if(await payment.count())
   await expect(payment.getByRole('button',{name:/Bank transfer/})).toBeDisabled();
 }
});
test('mobile folio directory avoids horizontal page overflow',async({page})=>{
 const email=process.env.PMS_STAGING_ADMIN_EMAIL??process.env.PMS_STAGING_EMAIL;
 const password=process.env.PMS_STAGING_ADMIN_PASSWORD??process.env.PMS_STAGING_PASSWORD;
 if(!email||!password)throw Error('Provide dedicated staging account.');
 await page.setViewportSize({width:390,height:844});
 await openBilling(page,email,password,true);
 await expect(page.getByRole('searchbox',{name:'Search folios'})).toBeVisible();
 const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
 expect(overflow).toBeLessThanOrEqual(2);
});

test('unavailable billing list offers safe reservation lookup without fabricated balances',async({page})=>{
 const email=process.env.PMS_STAGING_ADMIN_EMAIL??process.env.PMS_STAGING_EMAIL;
 const password=process.env.PMS_STAGING_ADMIN_PASSWORD??process.env.PMS_STAGING_PASSWORD;
 if(!email||!password)throw Error('Provide dedicated staging account.');
 await page.route('**/finance/folios**',route=>route.fulfill({
  status:503,contentType:'application/json',
  body:JSON.stringify({message:'Account directory unavailable'}),
 }));
 await openBilling(page,email,password);
 await expect(page.getByText('Guest account list is unavailable')).toBeVisible();
 await expect(page.getByRole('button',{name:'Retry account list'})).toBeVisible();
 await expect(page.getByText('These are reservation records, not bills.')).toBeVisible();
 await expect(page.locator('.billing-folio-amount')).toHaveCount(0);
 await page.getByRole('searchbox',{name:'Search folios'}).fill('12345');
 await expect(page.getByRole('button',{name:'Open booking #12345'})).toBeVisible();
});
