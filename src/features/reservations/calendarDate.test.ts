import {describe,it,expect} from 'vitest';
import {addDays,overlapsStay,reservationOnNight,startOfWeek,visibleDays} from './calendarDate';

describe('hotel reservation calendar dates',()=>{
 it('uses Monday as the first day of the week',()=>{
  expect(startOfWeek('2026-11-17')).toBe('2026-11-16');
  expect(visibleDays('2026-11-17','week')).toEqual([
   '2026-11-16','2026-11-17','2026-11-18','2026-11-19','2026-11-20','2026-11-21','2026-11-22'
  ]);
 });
 it('moves across month/year boundaries without browser timezone shifts',()=>{
  expect(addDays('2026-12-31',1)).toBe('2027-01-01');
  expect(addDays('2027-01-01',-1)).toBe('2026-12-31');
 });
 it('does not count checkout night as occupied',()=>{
  const booking={checkIn:'2026-12-10',checkOut:'2026-12-12'};
  expect(reservationOnNight(booking,'2026-12-10')).toBe(true);
  expect(reservationOnNight(booking,'2026-12-11')).toBe(true);
  expect(reservationOnNight(booking,'2026-12-12')).toBe(false);
 });
 it('treats adjacent reservations as non-overlapping',()=>{
  const booking={checkIn:'2026-12-10',checkOut:'2026-12-12'};
  expect(overlapsStay(booking,'2026-12-12','2026-12-13')).toBe(false);
  expect(overlapsStay(booking,'2026-12-11','2026-12-13')).toBe(true);
 });
 it('shows a spanning reservation when it overlaps only one boundary',()=>{
  const booking={checkIn:'2026-11-12',checkOut:'2026-11-19'};
  expect(overlapsStay(booking,'2026-11-16','2026-11-23')).toBe(true);
  expect(overlapsStay(booking,'2026-11-19','2026-11-23')).toBe(false);
 });
});
