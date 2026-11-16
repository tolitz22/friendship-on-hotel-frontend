import {describe,expect,it} from 'vitest';
import {mockDataSource} from '../../api/mock/dataSource';

describe('front desk board mock data contract',()=>{
 it('returns the expected sample arrival and departure queues',async()=>{
  const board=await mockDataSource.getFrontDeskBoard('2026-11-17');
  expect(board.meta.date).toBe('2026-11-17');
  expect(board.data.arrivals.some(entry=>entry.reservation.reference==='FOH-1007')).toBe(true);
  expect(board.data.departures.some(entry=>entry.reservation.reference==='FOH-1003')).toBe(true);
  expect(board.data.inHouse.some(entry=>entry.reservation.reference==='FOH-1005')).toBe(true);
 });
 it('does not treat pending bookings as checked-in guests',async()=>{
  const board=await mockDataSource.getFrontDeskBoard('2026-11-20');
  expect(board.data.inHouse.every(entry=>entry.reservation.status==='checked_in')).toBe(true);
 });
 it('does not mutate reservation state after reading the board',async()=>{
  const before=await mockDataSource.listReservations({perPage:100});
  await mockDataSource.getFrontDeskBoard('2026-11-17');
  const after=await mockDataSource.listReservations({perPage:100});
  expect(after).toEqual(before);
 });
});
