import {describe,expect,it} from 'vitest';
import {requestedNotificationHotel} from './pushNavigation';
describe('notification hotel routing',()=>{
 const hotels=[{id:'1',role:'admin'},{id:'2',role:'front_desk'}];
 it('selects only authorized admin properties',()=>{
  expect(requestedNotificationHotel('/reservations','?hotel=1&booking=9',hotels)).toBe('1');
  expect(requestedNotificationHotel('/reservations','?hotel=2&booking=9',hotels)).toBeNull();
  expect(requestedNotificationHotel('/reservations','?hotel=3&booking=9',hotels)).toBeNull();
 });
 it('rejects malformed or unrelated links',()=>{
  expect(requestedNotificationHotel('/billing','?hotel=1&booking=9',hotels)).toBeNull();
  expect(requestedNotificationHotel('/reservations','?hotel=1&booking=abc',hotels)).toBeNull();
 });
});
