import {describe,expect,it} from 'vitest';
import {parseNightAudit} from './nightAuditPreview';

const sample={
 data:{
  hotelId:'1',businessDate:'2027-01-10',hotelDate:'2027-01-10',currency:'PHP',
  roomCount:10,scheduledRoomNights:2,currentCheckedInOnScheduledDate:1,pricedRoomNights:2,
  postedRoomChargesMinor:360000,
  missingNightEntries:[],duplicateNightEntries:[],unpricedBookings:[],
  openCashierShifts:0,unreconciledCashierShifts:0,pendingPaymentEvidence:0,
  issues:[],preflightClear:true,roomEntriesAlreadyPostedAtBooking:true,
  financialDayClosed:false,bankOrGatewayVerified:false,historicalOccupancyVerified:false,
  taxesCalculated:false,
 },
};
describe('Night audit manager preflight contract',()=>{
 it('accepts a strictly provisional no-double-posting view',()=>{
  const parsed=parseNightAudit(sample,'1','2027-01-10');
  expect(parsed.roomEntriesAlreadyPostedAtBooking).toBe(true);
  expect(parsed.financialDayClosed).toBe(false);
  expect(parsed.postedRoomChargesMinor).toBe(360000);
 });
 it('rejects cross-hotel and mismatched dates',()=>{
  expect(()=>parseNightAudit(sample,'2','2027-01-10')).toThrow(/hotel or date/);
  expect(()=>parseNightAudit(sample,'1','2027-01-09')).toThrow(/hotel or date/);
 });
 it('rejects invented settlement or day-close claims',()=>{
  expect(()=>parseNightAudit({data:{...sample.data,financialDayClosed:true}},'1','2027-01-10')).toThrow();
  expect(()=>parseNightAudit({data:{...sample.data,bankOrGatewayVerified:true}},'1','2027-01-10')).toThrow();
 });
 it('detects inconsistent room-night and exception counts',()=>{
  expect(()=>parseNightAudit({data:{...sample.data,pricedRoomNights:3}},'1','2027-01-10')).toThrow();
  expect(()=>parseNightAudit({data:{...sample.data,issues:['Unreviewed cash'],preflightClear:true}},'1','2027-01-10')).toThrow();
 });
});
