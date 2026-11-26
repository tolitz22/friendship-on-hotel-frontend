import {expect,test} from '@playwright/test';

test('a notification reminder leaves the guest registration action clickable',async({page})=>{
 await page.addInitScript(()=>{
  sessionStorage.setItem('foh.staff.bearer.v1','notification-prompt-fixture');
  sessionStorage.setItem('foh.staff.hotel.v1','1');
  Object.defineProperty(Notification,'permission',{get:()=> 'denied'});
 });
 await page.route('**/api/v1/**',async route=>{
  const path=new URL(route.request().url()).pathname;
  if(path.endsWith('/auth/me'))return route.fulfill({json:{data:{
   id:'1',name:'Demo staff',email:'staff@example.test',hotels:[{id:'1',name:'Demo hotel',role:'admin'}],
  }}});
  return route.fulfill({status:404,json:{message:'Outside notification reminder fixture'}});
 });
 await page.goto('http://127.0.0.1:5175/guests');
 const reminder=page.getByRole('complementary',{name:'Enable hotel notifications'});
 await expect(reminder.getByRole('heading',{name:'Notifications are blocked'})).toBeVisible();
 const addGuest=page.getByRole('button',{name:'Add guest',exact:true});
 const reminderBox=await reminder.boundingBox();
 const actionBox=await addGuest.boundingBox();
 expect(reminderBox).not.toBeNull();
 expect(actionBox).not.toBeNull();
 expect(reminderBox!.y+reminderBox!.height).toBeLessThanOrEqual(actionBox!.y);
 await addGuest.click();
 await expect(page.getByRole('dialog',{name:'Add guest',exact:true})).toBeVisible();
});
