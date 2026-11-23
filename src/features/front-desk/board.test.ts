import {describe,expect,it} from 'vitest';
import {mockDataSource} from '../../api/mock/dataSource';
import {demoDay,demoToday} from '../../api/mock/fixtures';

describe('front desk board mock data contract',()=>{
 it('returns the expected sample arrival and departure queues',async()=>{
  const board=await mockDataSource.getFrontDeskBoard(demoToday);
  expect(board.meta.date).toBe(demoToday);
  expect(board.data.arrivals.some(entry=>entry.reservation.reference==='FOH-1007')).toBe(true);
  expect(board.data.departures.some(entry=>entry.reservation.reference==='FOH-1003')).toBe(true);
  expect(board.data.inHouse.some(entry=>entry.reservation.reference==='FOH-1005')).toBe(true);
 });
 it('does not treat pending bookings as checked-in guests',async()=>{
  const board=await mockDataSource.getFrontDeskBoard(demoDay(3));
  expect(board.data.inHouse.every(entry=>entry.reservation.status==='checked_in')).toBe(true);
 });
 it('does not mutate reservation state after reading the board',async()=>{
  const before=await mockDataSource.listReservations({perPage:100});
  await mockDataSource.getFrontDeskBoard(demoToday);
  const after=await mockDataSource.listReservations({perPage:100});
  expect(after).toEqual(before);
 });
});
