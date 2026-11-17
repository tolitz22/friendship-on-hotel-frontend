import {describe,expect,it} from 'vitest';
import {parseNightAuditReview} from './nightAuditReview';

const snapshot={
 hotelId:'1',businessDate:'2027-01-11',hotelDate:'2027-01-12',currency:'PHP',
 roomCount:12,scheduledRoomNights:0,currentCheckedInOnScheduledDate:0,
 pricedRoomNights:0,postedRoomChargesMinor:0,
 missingNightEntries:[],duplicateNightEntries:[],unpricedBookings:[],
 openCashierShifts:0,unreconciledCashierShifts:0,pendingPaymentEvidence:0,
 issues:[],preflightClear:true,roomEntriesAlreadyPostedAtBooking:true,
 financialDayClosed:false,bankOrGatewayVerified:false,
 historicalOccupancyVerified:false,taxesCalculated:false,
};
const reviewed={
 id:'1',hotelId:'1',businessDate:'2027-01-11',status:'reviewed',
 managerNote:'Reviewed all preflight items',reviewedBy:'3',
 reviewedAt:'2027-01-12 12:00:00',snapshotSha256:'a'.repeat(64),
 snapshot,financialDayClosed:false,ledgerLocked:false,
 taxesCalculated:false,gatewaySettlementVerified:false,
};
describe('Night audit review contract',()=>{
 it('accepts a manager review that never claims the ledger closed',()=>{
  const data=parseNightAuditReview({data:reviewed},'1','2027-01-11');
  expect(data?.financialDayClosed).toBe(false);
  expect(data?.ledgerLocked).toBe(false);
 });
 it('allows an unreviewed day',()=>{
  expect(parseNightAuditReview({data:null},'1','2027-01-11')).toBeNull();
 });
 it('rejects foreign hotel or date, false financial close and invalid snapshot',()=>{
  expect(()=>parseNightAuditReview({data:reviewed},'2','2027-01-11')).toThrow();
  expect(()=>parseNightAuditReview({data:reviewed},'1','2027-01-10')).toThrow();
  expect(()=>parseNightAuditReview({data:{...reviewed,ledgerLocked:true}},'1','2027-01-11')).toThrow();
  expect(()=>parseNightAuditReview({data:{...reviewed,financialDayClosed:true}},'1','2027-01-11')).toThrow();
  expect(()=>parseNightAuditReview({data:{...reviewed,status:'flagged'}},'1','2027-01-11')).toThrow();
 });
});
