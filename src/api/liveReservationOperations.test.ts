import {describe,expect,it} from 'vitest';
import {
 allowedOperation,hasActiveStayBlock,parseAssignment,parseBlocks,parseHistory,
 parseRooms,parseTransition,
} from './liveReservationOperations';
import type {LiveRecord} from './liveReservations';

const booking:LiveRecord={
 id:'33',hotelId:'4',reference:'BK-PHASE32',roomTypeId:'7',
 assignedRoomId:null,checkIn:'2026-12-10',checkOut:'2026-12-12',
 lifecycleState:'confirmed',
};
const rooms={
 data:[
  {id:'1',hotelId:'4',roomTypeId:'7',number:'101',
   roomTypeName:'Standard',floor:1,maxOccupancy:2},
  {id:'2',hotelId:'4',roomTypeId:'8',number:'102',
   roomTypeName:'Deluxe',floor:1,maxOccupancy:3},
 ],
 meta:{page:1,perPage:100,total:2,totalPages:1},
};
const block={
 id:'5',roomId:'1',roomTypeId:'7',checkIn:'2026-12-11',checkOut:'2026-12-13',
 reason:'Maintenance',active:true,createdBy:'10',releasedBy:null,
 createdAt:'2026-11-17 08:00:00',updatedAt:'2026-11-17 08:00:00',
};
const history={
 data:[{
  id:'15',reservationId:'33',eventType:'room_assigned',
  oldState:'confirmed',newState:'confirmed',actorId:'10',
  createdAt:'2026-11-17 08:00:00',
 }],
 meta:{page:1,perPage:20,total:1,totalPages:1,hotelId:'4',reservationId:'33'},
};

describe('Phase 32 room assignment and lifecycle contracts',()=>{
 it('filters physical rooms by room type and rejects another hotel',()=>{
  const parsed=parseRooms(rooms,'4','7');
  expect(parsed.data.map(r=>r.id)).toEqual(['1']);
  expect(()=>parseRooms({...rooms,data:[{...rooms.data[0],hotelId:'5'}]},'4','7'))
   .toThrow(/another hotel/);
 });
 it('recognizes half-open dated room blocks and ignores released blocks',()=>{
  expect(hasActiveStayBlock([block],booking)).toBe(true);
  expect(hasActiveStayBlock([{...block,active:false}],booking)).toBe(false);
  expect(hasActiveStayBlock([{...block,checkIn:'2026-12-12',checkOut:'2026-12-13'}],booking)).toBe(false);
  expect(hasActiveStayBlock([{...block,checkIn:'2026-12-09',checkOut:'2026-12-10'}],booking)).toBe(false);
 });
 it('rejects room block data from a different selected room',()=>{
  expect(parseBlocks({
   data:[block],
   meta:{page:1,perPage:100,total:1,totalPages:1},
  },'1').data).toHaveLength(1);
  expect(()=>parseBlocks({
   data:[block],
   meta:{page:1,perPage:100,total:1,totalPages:1},
  },'2')).toThrow(/different room/);
 });
 it('restricts check-in to arrival-through-night-before-departure and assigned rooms',()=>{
  expect(allowedOperation(booking,'check-in','2026-12-10')).toBe(false);
  const assigned={...booking,assignedRoomId:'1'};
  expect(allowedOperation(assigned,'check-in','2026-12-09')).toBe(false);
  expect(allowedOperation(assigned,'check-in','2026-12-10')).toBe(true);
  expect(allowedOperation(assigned,'check-in','2026-12-11')).toBe(true);
  expect(allowedOperation(assigned,'check-in','2026-12-12')).toBe(false);
 });
 it('allows checkout only for checked-in reservations on or after departure',()=>{
  const checkedIn={...booking,assignedRoomId:'1',lifecycleState:'checked_in'};
  expect(allowedOperation(checkedIn,'check-out','2026-12-11')).toBe(false);
  expect(allowedOperation(checkedIn,'check-out','2026-12-12')).toBe(true);
  expect(allowedOperation(checkedIn,'check-out','2026-12-13')).toBe(true);
  expect(allowedOperation(booking,'check-out','2026-12-12')).toBe(false);
 });
 it('validates exact assignment target and lifecycle response',()=>{
  expect(parseAssignment({data:{bookingId:'33',roomId:'1',unchanged:false}},booking,'1')
   .unchanged).toBe(false);
  expect(()=>parseAssignment({data:{bookingId:'44',roomId:'1',unchanged:false}},booking,'1'))
   .toThrow(/did not match/);
  const assigned={...booking,assignedRoomId:'1'};
  expect(parseTransition({
   data:{id:'33',reference:'BK-PHASE32',status:'checked_in',assignedRoomId:'1'},
  },assigned,'check-in').status).toBe('checked_in');
  expect(()=>parseTransition({
   data:{id:'33',reference:'BK-PHASE32',status:'checked_out',assignedRoomId:'1'},
  },assigned,'check-in')).toThrow(/differs/);
 });
 it('enforces property and reservation scope for history',()=>{
  expect(parseHistory(history,'4','33').data[0].eventType).toBe('room_assigned');
  expect(()=>parseHistory(history,'5','33')).toThrow(/another hotel or booking/);
  expect(()=>parseHistory(history,'4','34')).toThrow(/another hotel or booking/);
  expect(()=>parseHistory({...history,data:[{...history.data[0],reservationId:'99'}]},'4','33'))
   .toThrow(/another hotel or booking/);
 });
});
