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

 // Sign-in is asynchronous; allow either immediate workspace access or
 // the hotel chooser without checking visibility before auth has settled.
 await expect(page.locator('.workspace-nav, .auth-hotel-list').first()).toBeVisible();
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
 const navigation=page.getByRole('navigation',{name:'Hotel workspace navigation'});
 for(const [linkName,route,heading] of [
  ['Guests','/guests','Guest directory'],
  ['Front desk','/front-desk','Front desk'],
  ['Reservations','/reservations','Reservations'],
  ['Rooms & readiness','/rooms','Rooms'],
  ['Housekeeping','/housekeeping','Housekeeping'],
  ['Maintenance','/maintenance','Maintenance'],
 ] as const){
  // Route through TanStack Router to preserve an in-memory bearer session.
  await navigation.getByRole('link',{name:linkName,exact:true}).click();
  await expect(page).toHaveURL(new RegExp(route.replace('/','\\/')+'(?:\\?|$)'));
  await expect(page.getByRole('heading',{name:heading,exact:true}).first()).toBeVisible();
  await expect(page.getByText('DESIGN PREVIEW')).toHaveCount(0);
  // Wait for any currently rendered record loading indication to settle,
  // then fail on the shared API error state rather than merely checking headings.
  await expect(page.getByText('Loading hotel records…')).toHaveCount(0);
  await expect(page.locator('.query-feedback.error')).toHaveCount(0);
 }
});
