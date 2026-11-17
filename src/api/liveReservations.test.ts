import {describe,expect,it} from 'vitest';
import {parseAvailability,parseQuote,parseRecords,validLiveStay} from './liveReservations';

const stay={roomTypeId:'9',checkIn:'2026-12-10',checkOut:'2026-12-12'};
const records={
 data:[{
  id:'1',hotelId:'4',reference:'FOH-1',roomTypeId:'9',
  assignedRoomId:null,checkIn:'2026-12-10',
  checkOut:'2026-12-12',lifecycleState:'confirmed',
 }],
 meta:{page:1,perPage:20,total:1,totalPages:1,isAvailability:false},
};
const availability={
 data:{
  hotelId:'4',roomTypeId:'9',
  checkIn:'2026-12-10',checkOut:'2026-12-12',
  nights:[
   {date:'2026-12-10',physicalRooms:2,reserved:1,blocked:0,remaining:1,overcommitted:false},
   {date:'2026-12-11',physicalRooms:2,reserved:1,blocked:1,remaining:0,overcommitted:false},
  ],
  canBook:false,includesMaintenanceBlocks:true,
  includesHousekeepingReadiness:false,includesPricing:false,
 },
 meta:{
  scope:'registered_room_type_inventory',
  housekeepingReadinessVerified:false,pricingIncluded:false,
 },
};
const quote={
 data:{
  ratePlanId:'7',roomTypeId:'9',currency:'PHP',
  nightlyMinor:250000,nights:['2026-12-10','2026-12-11'],
  roomSubtotalMinor:500000,taxesCalculated:false,
  feesCalculated:false,depositCalculated:false,isFinalPayableTotal:false,
 },
};

describe('Phase 30 live reservation wire contracts',()=>{
 it('accepts scoped structural records without requiring mock fields',()=>{
  expect(parseRecords(records,'4').data[0].assignedRoomId).toBeNull();
 });
 it('keeps guest and room labels for the actionable reservation list',()=>{
  const booking={...records.data[0],
   guestName:'Maria Santos',roomTypeName:'Standard',
   assignedRoomNumber:'201',assignedRoomId:'55'};
  const result=parseRecords({...records,data:[booking]},'4');
  expect(result.data[0].guestName).toBe('Maria Santos');
  expect(result.data[0].assignedRoomNumber).toBe('201');
  expect(result.data[0].roomTypeName).toBe('Standard');
 });
 it('rejects cross-property structural data',()=>{
  expect(()=>parseRecords(records,'5')).toThrow(/another hotel/);
 });
 it('does not treat structural record listings as availability',()=>{
  expect(()=>parseRecords({...records,meta:{...records.meta,isAvailability:true}},'4')).toThrow();
 });
 it('requires valid 1 to 31-night windows',()=>{
  expect(validLiveStay(stay)).toBe(true);
  expect(validLiveStay({...stay,checkOut:stay.checkIn})).toBe(false);
  expect(validLiveStay({...stay,checkOut:'2027-02-20'})).toBe(false);
  expect(validLiveStay({...stay,roomTypeId:'not-an-id'})).toBe(false);
 });
 it('honors nightly inventory, blocks and non-readiness flags',()=>{
  const result=parseAvailability(availability,'4',stay);
  expect(result.data.canBook).toBe(false);
  expect(result.data.nights[1].remaining).toBe(0);
  expect(result.data.includesHousekeepingReadiness).toBe(false);
 });
 it('rejects another property or different queried stay',()=>{
  expect(()=>parseAvailability(availability,'999',stay)).toThrow(/different hotel or stay/);
  expect(()=>parseAvailability(availability,'4',{...stay,checkOut:'2026-12-13'}))
   .toThrow(/different hotel or stay/);
 });
 it('rejects any unsupported assertion of housekeeping readiness',()=>{
  expect(()=>parseAvailability({
   ...availability,data:{...availability.data,includesHousekeepingReadiness:true},
  },'4',stay)).toThrow();
 });
 it('accepts an incomplete room subtotal without calling it a final payable total',()=>{
  const result=parseQuote(quote,stay,'7');
  expect(result.data.roomSubtotalMinor).toBe(500000);
  expect(result.data.taxesCalculated).toBe(false);
  expect(result.data.isFinalPayableTotal).toBe(false);
 });
 it('rejects rate mismatch, wrong length and invented taxes',()=>{
  expect(()=>parseQuote(quote,stay,'8')).toThrow(/different rate or room type/);
  expect(()=>parseQuote({
   ...quote,data:{...quote.data,nights:['2026-12-10']},
  },stay,'7')).toThrow(/inconsistent/);
  expect(()=>parseQuote({
   ...quote,data:{...quote.data,taxesCalculated:true},
  },stay,'7')).toThrow();
 });
});
