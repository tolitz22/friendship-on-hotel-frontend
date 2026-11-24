import {expect,test} from '@playwright/test';

const base='http://127.0.0.1:5174';

test('staff see personal claims and lose access when switching to a restricted property',async({page,isMobile})=>{
 await page.addInitScript(()=>{
  sessionStorage.setItem('foh.staff.bearer.v1','employee-claims-fixture');
  sessionStorage.setItem('foh.staff.hotel.v1','1');
 });
 const requestedHotels:string[]=[];
 await page.route('**/api/v1/**',async route=>{
  const path=new URL(route.request().url()).pathname;
  if(path.endsWith('/auth/me'))return route.fulfill({json:{data:{
   id:'8',name:'Room attendant',email:'attendant@example.test',
   hotels:[
    {id:'1',name:'Claim property',role:'housekeeping',permissions:['reimbursement.read_own','reimbursement.submit']},
    {id:'2',name:'Restricted property',role:'housekeeping',permissions:[]},
   ],
  }}});
  const claimRegister=path.match(/\/hotels\/(\d+)\/employee-reimbursements$/);
  if(claimRegister){
   requestedHotels.push(claimRegister[1]);
   return route.fulfill({json:{data:[],meta:{page:1,totalPages:1,total:0},postingEnabled:true}});
  }
  return route.fulfill({status:404,json:{message:'Outside fixture'}});
 });
 await page.goto(base+'/my-expense-claims');
 await expect(page.getByText('No claims yet.')).toBeVisible();
 await expect(page.getByRole('button',{name:'Submit expense claim'})).toBeEnabled();
 const nav=page.getByRole('navigation',{name:'Hotel workspace navigation'});
 if(isMobile)await page.getByRole('button',{name:'Open navigation'}).click();
 await expect(nav.getByRole('link',{name:'My expense claims'})).toBeVisible();
 await expect(nav.getByRole('link',{name:'Expenses',exact:true})).toHaveCount(0);
 if(isMobile)await page.getByRole('button',{name:'Close menu'}).click();
 await page.getByRole('combobox',{name:'Selected hotel'}).selectOption('2');
 await expect(page.getByRole('button',{name:'Submit expense claim'})).toHaveCount(0);
 if(isMobile)await page.getByRole('button',{name:'Open navigation'}).click();
 await expect(nav.getByRole('link',{name:'My expense claims'})).toHaveCount(0);
 expect(requestedHotels.length).toBeGreaterThan(0);
 expect(new Set(requestedHotels)).toEqual(new Set(['1']));
});
