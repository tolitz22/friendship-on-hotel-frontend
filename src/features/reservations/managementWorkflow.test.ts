import {describe,expect,it} from 'vitest';
import {nextReservationAction,reservationActionHint} from './managementWorkflow';

describe('Reservation management UX guidance',()=>{
 it('prioritizes room assignment before arrival for unassigned confirmed bookings',()=>{
  const booking={lifecycleState:'confirmed',assignedRoomId:null};
  expect(nextReservationAction(booking)).toBe('Assign a room');
  expect(reservationActionHint(booking)).toMatch(/before check-in/);
 });
 it('directs room-assigned guests toward arrival checks, not repeated assignment',()=>{
  const booking={lifecycleState:'confirmed',assignedRoomId:'51'};
  expect(nextReservationAction(booking)).toBe('Review arrival');
  expect(reservationActionHint(booking)).toMatch(/readiness/);
 });
 it('uses plain terms for in-house, departed and inactive reservations',()=>{
  expect(nextReservationAction({lifecycleState:'checked_in',assignedRoomId:'51'}))
   .toBe('Manage in-house stay');
  expect(nextReservationAction({lifecycleState:'checked_out',assignedRoomId:'51'}))
   .toBe('View completed stay');
  expect(nextReservationAction({lifecycleState:'cancelled',assignedRoomId:null}))
   .toBe('View reservation');
 });
});
