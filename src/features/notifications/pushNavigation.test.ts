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
  expect(requestedNotificationHotel('/billing','?hotel=1&booking=9&push=1',hotels)).toBe('1');
  expect(requestedNotificationHotel('/billing','?hotel=2&booking=9&push=1',hotels)).toBeNull();
  expect(requestedNotificationHotel('/expenses','?hotel=1&expense=7&push=1',hotels)).toBe('1');
  expect(requestedNotificationHotel('/cashier-shifts','?hotel=1&shift=8&push=1',hotels)).toBe('1');
  expect(requestedNotificationHotel('/expenses','?hotel=3&expense=7&push=1',hotels)).toBeNull();
  expect(requestedNotificationHotel('/reservations','?hotel=1&booking=abc',hotels)).toBeNull();
 });
});

it('validates operational push destinations and administrator access',()=>{
 const hotels=[{id:'1',role:'admin'},{id:'2',role:'front_desk'}];
 expect(requestedNotificationHotel('/maintenance','?hotel=1&order=8&push=1',hotels)).toBe('1');
 expect(requestedNotificationHotel('/housekeeping','?hotel=2&task=8&push=1',hotels)).toBeNull();
 expect(requestedNotificationHotel('/room-calendar','?hotel=1&room=101-A&push=1',hotels)).toBe('1');
 expect(requestedNotificationHotel('/manager-approvals','?hotel=1&approval=3&push=1',hotels)).toBe('1');
});
