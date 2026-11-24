import {expect,test} from '@playwright/test';

const businessDate='2026-11-24';
const hotelDate='2026-11-26';

test('Daily Closing starts on the financial date and links to actionable blockers',async({page})=>{
 await page.addInitScript(()=>{
  sessionStorage.setItem('foh.staff.bearer.v1','daily-closing-fixture');
  sessionStorage.setItem('foh.staff.hotel.v1','1');
 });
 let ready=false;
 let closed=false;
 await page.route('**/api/v1/**',async route=>{
  const url=new URL(route.request().url());
  if(url.pathname.endsWith('/auth/me'))return route.fulfill({json:{data:{
   id:'8',name:'Demo manager',email:'manager@example.test',hotels:[{id:'1',name:'Demo hotel',role:'admin'}],
  }}});
  if(url.pathname.endsWith('/finance/business-day/close')){
   expect(route.request().postDataJSON()).toEqual({businessDate,acknowledged:true});
   closed=true;
   return route.fulfill({json:{data:{
    closedBusinessDate:businessDate,nextBusinessDate:'2026-11-25',
    reconciliationSnapshot:{journal_count:2,line_count:4,debits_minor:24000,credits_minor:24000,currency:'PHP',scope:'test'},
   }}});
  }
  if(url.pathname.endsWith('/finance/business-day'))return route.fulfill({json:{data:{
   businessDate:closed?'2026-11-25':businessDate,nextBusinessDate:closed?hotelDate:'2026-11-25',
   status:'open',version:closed?2:1,journalCount:closed?0:2,
   invalidJournalCount:0,nightAuditReview:null,openShiftIds:ready?[]:['2'],
   blockers:ready?[]:['An open cashier shift must be counted.'],canClose:ready&&!closed,readinessIsAdvisory:true,
  }}});
  if(url.pathname.endsWith('/night-audit/preview'))return route.fulfill({json:{data:{
   hotelId:'1',businessDate:url.searchParams.get('date'),hotelDate,currency:'PHP',roomCount:0,
   scheduledRoomNights:0,currentCheckedInOnScheduledDate:0,pricedRoomNights:0,postedRoomChargesMinor:0,
   missingNightEntries:[],duplicateNightEntries:[],unpricedBookings:[],
   openCashierShifts:1,unreconciledCashierShifts:0,pendingPaymentEvidence:1,
   issues:['There is unreviewed payment evidence.'],preflightClear:false,
   roomEntriesAlreadyPostedAtBooking:true,financialDayClosed:false,bankOrGatewayVerified:false,
   historicalOccupancyVerified:false,taxesCalculated:false,
  }}});
  return route.fulfill({status:404,json:{message:'Outside fixture'}});
 });
 await page.goto('http://127.0.0.1:5174/night-audit');
 const date=page.getByLabel('Date to review');
 await expect(date).toHaveValue(businessDate);
 await expect(page.getByRole('link',{name:'Review payment evidence'})).toHaveAttribute('href','/operational-exceptions');
 await expect(page.getByRole('link',{name:'Open cashier shift #2'})).toHaveAttribute('href',/shift=/);
 await page.getByRole('button',{name:'Review yesterday'}).click();
 await expect(date).toHaveValue('2026-11-25');
 const closePanel=page.getByRole('region',{name:'Financial business-date close'});
 await expect(closePanel.getByRole('link',{name:'Open cashier shift #2'})).toHaveCount(0);
 await closePanel.getByRole('button',{name:'Review current business date'}).click();
 await expect(date).toHaveValue(businessDate);
 await expect(closePanel.getByRole('link',{name:'Open cashier shift #2'})).toBeVisible();
 ready=true;
 await closePanel.getByRole('button',{name:'Refresh readiness'}).click();
 await closePanel.getByLabel('Type 2026-11-24 to confirm the exact date').fill(businessDate);
 await closePanel.getByRole('checkbox',{name:/I verified the manager review/}).check();
 await closePanel.getByRole('button',{name:'Close business day',exact:true}).click();
 await expect(closePanel.getByText('Closed 2026-11-24. New business date: 2026-11-25.',{exact:false})).toBeVisible();
 await expect(date).toHaveValue(businessDate);
 await closePanel.getByRole('button',{name:'Review current business date'}).click();
 await expect(date).toHaveValue('2026-11-25');
});
