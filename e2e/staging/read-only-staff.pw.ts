import {test,expect} from '@playwright/test';

test('staging staff can navigate live hotel records without creating or changing data',async({page})=>{
 const email=process.env.PMS_STAGING_EMAIL;
 const password=process.env.PMS_STAGING_PASSWORD;
 if(!email||!password)
  throw new Error('Provide PMS_STAGING_EMAIL and PMS_STAGING_PASSWORD for a dedicated read-only staff account.');

 await page.goto('/');
 const emailField=page.getByRole('textbox',{name:'Email address'});
 await expect(emailField).toBeVisible();
 await emailField.fill(email);
 await page.getByLabel('Password',{exact:true}).fill(password);
 await page.getByRole('button',{name:'Sign in',exact:true}).click();

 const chooser=page.getByRole('heading',{name:'Choose a property'});
 if(await chooser.isVisible()){
  const property=page.locator('.auth-hotel-list button').first();
  await expect(property).toBeVisible();
  await property.click();
 }
 await expect(page.getByRole('navigation',{name:'Hotel workspace navigation'})).toBeVisible();
 await expect(page.getByText('LIVE HOTEL DATA').first()).toBeVisible();

 // These are all GET-only smoke assertions. Never click new booking,
 // room assignment, readiness policy, guest editing, or checkout controls.
 for(const [route,heading] of [
  ['/guests','Guest directory'],
  ['/front-desk','Front desk'],
  ['/reservations','Reservations'],
  ['/rooms','Rooms'],
  ['/housekeeping','Housekeeping'],
  ['/maintenance','Maintenance'],
 ] as const){
  await page.goto(route);
  await expect(page.getByRole('heading',{name:heading,exact:true}).first()).toBeVisible();
  await expect(page.getByText('DESIGN PREVIEW')).toHaveCount(0);
  await expect(page.getByText('Unable to load this information')).toHaveCount(0);
 }
});
