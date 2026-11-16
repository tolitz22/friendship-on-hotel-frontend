import {describe,expect,it} from 'vitest';
import type {Room,TimelineBlock} from '../../api/types';
import {blocksForNight,nightLabel,roomMatches} from './timelineUtils';
const room:Room={id:'room-301',hotelId:'hotel-demo-001',number:'301',floor:3,roomTypeId:'deluxe',roomTypeName:'Deluxe',occupancyStatus:'vacant',housekeepingStatus:'dirty',maintenanceStatus:'available',maxOccupancy:3};
const booking:TimelineBlock={id:'b1',kind:'reservation',roomId:'room-301',from:'2026-11-17',to:'2026-11-19',reservationId:'res1',reference:'FOH-101',guestName:'Sample Guest',status:'confirmed'};
const repair:TimelineBlock={id:'m1',kind:'maintenance',roomId:'room-301',from:'2026-11-18',to:'2026-11-20',reason:'Mock maintenance'};
describe('physical room timeline display rules',()=>{
 it('excludes checkout night and does not attribute another room booking',()=>{
  expect(blocksForNight([booking],room.id,'2026-11-18')).toEqual([booking]);
  expect(blocksForNight([booking],room.id,'2026-11-19')).toEqual([]);
  expect(blocksForNight([booking],'other-room','2026-11-17')).toEqual([]);
 });
 it('distinguishes maintenance from assigned reservations',()=>{
  expect(nightLabel([booking])).toBe('reservation');
  expect(nightLabel([repair])).toBe('maintenance');
  expect(nightLabel([])).toBe('unknown');
 });
 it('highlights overlapping records for review without asserting availability',()=>{
  expect(nightLabel([booking,repair])).toBe('overlap');
  expect(nightLabel([booking,{...booking,id:'b2'}])).toBe('overlap');
 });
 it('filters by room type, floor and search',()=>{
  expect(roomMatches(room,'301','deluxe','3')).toBe(true);
  expect(roomMatches(room,'dirty','all','all')).toBe(true);
  expect(roomMatches(room,'suite','all','all')).toBe(false);
  expect(roomMatches(room,'','standard','all')).toBe(false);
  expect(roomMatches(room,'','all','2')).toBe(false);
 });
});