import {describe,expect,it} from 'vitest';
import {roomHasConflict,validRoomStay} from './roomCalendarRange';

describe('front desk room calendar date selection',()=>{
 it('accepts one to 31 nights including month boundaries',()=>{
  expect(validRoomStay('2026-11-30','2026-12-01')).toBe(true);
  expect(validRoomStay('2026-11-17','2026-12-18')).toBe(true);
  expect(validRoomStay('2026-11-17','2026-12-19')).toBe(false);
  expect(validRoomStay('2026-11-17','2026-11-17')).toBe(false);
  expect(validRoomStay('2026-11-17','2026-11-16')).toBe(false);
  expect(validRoomStay('2026-02-30','2026-03-01')).toBe(false);
 });
 it('does not count checkout date as occupied',()=>{
  const bookings=[{roomId:'11',checkIn:'2026-11-17',checkOut:'2026-11-19'}];
  expect(roomHasConflict('11','2026-11-19','2026-11-20',bookings,[])).toBe(false);
  expect(roomHasConflict('11','2026-11-18','2026-11-20',bookings,[])).toBe(true);
  expect(roomHasConflict('22','2026-11-18','2026-11-20',bookings,[])).toBe(false);
 });
 it('includes maintenance blocks and rejects invalid ranges',()=>{
  const blocks=[{roomId:'11',checkIn:'2026-11-21',checkOut:'2026-11-23'}];
  expect(roomHasConflict('11','2026-11-20','2026-11-22',[],blocks)).toBe(true);
  expect(roomHasConflict('11','2026-11-23','2026-11-24',[],blocks)).toBe(false);
  expect(roomHasConflict('11','2026-11-20','2026-11-20',[],blocks)).toBe(true);
 });
});
