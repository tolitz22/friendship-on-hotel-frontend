import {describe,expect,it} from 'vitest';
import {buildBookingPayload,makeBookingSubmission,parseBookingResult} from './liveBooking';

const selection={
 guestId:'23',roomTypeId:'9',ratePlanId:'7',
 checkIn:'2026-12-10',checkOut:'2026-12-12',
};
const submission=makeBookingSubmission('4',selection,'booking-uuid-00000001');
const booking={
 data:{
  id:'101',reference:'BK-EXAMPLE1234567890',
  hotelId:'4',guestId:'23',roomTypeId:'9',assignedRoomId:null,
  checkIn:'2026-12-10',checkOut:'2026-12-12',
  status:'confirmed',idempotentReplay:false,
 },
};

describe('Phase 31 live booking creation contract',()=>{
 it('builds the exact Laravel booking request in integer IDs',()=>{
  expect(buildBookingPayload(submission)).toEqual({
   idempotencyKey:'booking-uuid-00000001',
   guestId:23,roomTypeId:9,ratePlanId:7,
   checkIn:'2026-12-10',checkOut:'2026-12-12',
  });
 });
 it('freezes the selected guest, rate and stay in a retryable submission',()=>{
  const source={...selection};
  const attempt=makeBookingSubmission('4',source,'retry-key-000001');
  source.checkOut='2026-12-15';
  expect(buildBookingPayload(attempt).checkOut).toBe('2026-12-12');
  expect(buildBookingPayload(attempt).idempotencyKey).toBe('retry-key-000001');
 });
 it('accepts the actual confirmed booking response and safe replay',()=>{
  expect(parseBookingResult(booking,submission).status).toBe('confirmed');
  expect(parseBookingResult({
   data:{...booking.data,idempotentReplay:true},
  },submission).idempotentReplay).toBe(true);
 });
 it('rejects a success response for another hotel, guest or stay',()=>{
  expect(()=>parseBookingResult({
   data:{...booking.data,hotelId:'5'},
  },submission)).toThrow(/does not match/);
  expect(()=>parseBookingResult({
   data:{...booking.data,guestId:'99'},
  },submission)).toThrow(/does not match/);
  expect(()=>parseBookingResult({
   data:{...booking.data,checkOut:'2026-12-15'},
  },submission)).toThrow(/does not match/);
 });
 it('never treats an unsupported booking state as confirmation',()=>{
  expect(()=>parseBookingResult({
   data:{...booking.data,status:'pending'},
  },submission)).toThrow();
 });
 it('rejects invalid stay periods and absent rate plans before POST',()=>{
  expect(()=>buildBookingPayload(makeBookingSubmission('4',{
   ...selection,checkOut:selection.checkIn,
  },'idempotency-00000001'))).toThrow(/valid stay/);
  expect(()=>buildBookingPayload(makeBookingSubmission('4',{
   ...selection,ratePlanId:'',
  },'idempotency-00000001'))).toThrow(/Select a valid/);
 });
 it('rejects unsafe numeric identifiers and short request keys',()=>{
  expect(()=>buildBookingPayload(makeBookingSubmission('4',{
   ...selection,guestId:'9007199254740995',
  },'idempotency-00000001'))).toThrow(/supported integer range/);
  expect(()=>buildBookingPayload(makeBookingSubmission('4',selection,'short'))).toThrow(/request key/);
 });
});
