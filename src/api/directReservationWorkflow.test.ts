import {describe,expect,it} from 'vitest';
import {parseReservationDetail} from './liveReservations';

const response={data:{
 id:'49',hotelId:'7',reference:'FOH-49',roomTypeId:'3',
 assignedRoomId:'18',checkIn:'2026-12-10',checkOut:'2026-12-12',
 lifecycleState:'confirmed',
}};

describe('Phase 39 exact reservation handoff',()=>{
 it('accepts the specific booking from the currently selected hotel',()=>{
  const record=parseReservationDetail(response,'7','49');
  expect(record.reference).toBe('FOH-49');
  expect(record.assignedRoomId).toBe('18');
 });
 it('blocks a booking from another hotel',()=>{
  expect(()=>parseReservationDetail(response,'8','49')).toThrow(/another hotel/);
 });
 it('blocks the wrong booking identity even when the hotel matches',()=>{
  expect(()=>parseReservationDetail(response,'7','50')).toThrow(/requested booking/);
 });
 it('rejects unsupported or malformed backend booking statuses',()=>{
  expect(()=>parseReservationDetail({
   data:{...response.data,checkIn:'tomorrow'},
  },'7','49')).toThrow();
 });
 it('supports post-checkout state without treating it as payment proof',()=>{
  const record=parseReservationDetail({
   data:{...response.data,lifecycleState:'checked_out'},
  },'7','49');
  expect(record.lifecycleState).toBe('checked_out');
 });
});
