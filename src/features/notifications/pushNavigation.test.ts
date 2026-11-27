import {describe,expect,it} from 'vitest';
import {requestedNotificationHotel,hasScopedBookingLink} from './pushNavigation';
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

it('scopes message notification links to the intended administrator property',()=>{
 const hotels=[{id:'1',role:'admin'},{id:'2',role:'front_desk'}];
 expect(requestedNotificationHotel('/messages','?hotel=1&conversation=9&push=1',hotels)).toBe('1');
 expect(requestedNotificationHotel('/messages','?hotel=2&conversation=9&push=1',hotels)).toBeNull();
 expect(requestedNotificationHotel('/messages','?hotel=1&conversation=invalid&push=1',hotels)).toBeNull();
});

it('validates financial closing dates and property access',()=>{
 const hotels=[{id:'1',role:'admin'},{id:'2',role:'front_desk'}];
 expect(requestedNotificationHotel('/night-audit','?hotel=1&date=2026-11-26&push=1',hotels)).toBe('1');
 expect(requestedNotificationHotel('/night-audit','?hotel=2&date=2026-11-26&push=1',hotels)).toBeNull();
 expect(requestedNotificationHotel('/night-audit','?hotel=1&date=2026-02-30&push=1',hotels)).toBeNull();
});

it('accepts router-encoded decimal IDs without weakening hotel authorization',()=>{
 const hotels=[{id:'1',role:'admin'},{id:'2',role:'front_desk'}];
 expect(requestedNotificationHotel('/expenses','?hotel=%221%22&expense=%227%22',hotels)).toBe('1');
 expect(requestedNotificationHotel('/cashier-shifts','?hotel=%221%22&shift=%222%22',hotels)).toBe('1');
 expect(requestedNotificationHotel('/messages','?hotel=%222%22&conversation=%229%22&push=1',hotels)).toBeNull();
 expect(requestedNotificationHotel('/expenses','?hotel=%223%22&expense=%227%22',hotels)).toBeNull();
 expect(requestedNotificationHotel('/expenses','?hotel=1&expense=%22invalid%22',hotels)).toBeNull();
});

it('rejects ambiguous property links and recognizes incomplete push destinations',()=>{
 const hotels=[{id:'1',role:'admin'}];
 expect(requestedNotificationHotel('/billing','?hotel=1&hotel=2&booking=9&push=1',hotels)).toBeNull();
 expect(requestedNotificationHotel('/billing','?hotel=1&booking=9&booking=10&push=1',hotels)).toBeNull();
 expect(hasScopedBookingLink('/billing','?push=1&booking=9')).toBe(true);
 expect(requestedNotificationHotel('/billing','?push=1&booking=9',hotels)).toBeNull();
});

it('does not allow encoded or malformed push markers to bypass administrator authorization',()=>{
 const hotels=[{id:'1',role:'admin'},{id:'2',role:'front_desk'}];
 expect(requestedNotificationHotel('/billing','?hotel=2&booking=9&push=%221%22',hotels)).toBeNull();
 expect(requestedNotificationHotel('/billing','?hotel=1&booking=9&push=%221%22',hotels)).toBe('1');
 expect(requestedNotificationHotel('/billing','?hotel=1&booking=9&push=0',hotels)).toBeNull();
});

it('validates found-item push links and preserves administrator authorization',()=>{
 const hotels=[{id:'1',role:'admin'},{id:'2',role:'housekeeping'}];
 expect(requestedNotificationHotel('/lost-found','?hotel=1&item=7&push=1',hotels)).toBe('1');
 expect(requestedNotificationHotel('/lost-found','?hotel=2&item=7&push=1',hotels)).toBeNull();
 expect(requestedNotificationHotel('/lost-found','?hotel=1&item=7&item=8&push=1',hotels)).toBeNull();
 expect(requestedNotificationHotel('/lost-found','?hotel=1&item=bad&push=1',hotels)).toBeNull();
});

it('allows only staff-specific push destinations',()=>{
 const hotels=[{id:'1',role:'housekeeping'},{id:'2',role:'front_desk'}];
 expect(requestedNotificationHotel('/housekeeping','?hotel=1&task=7&push=1',hotels)).toBe('1');
 expect(requestedNotificationHotel('/rooms','?hotel=2&room=101&push=1',hotels)).toBe('2');
 expect(requestedNotificationHotel('/billing','?hotel=1&booking=7&push=1',hotels)).toBeNull();
 expect(requestedNotificationHotel('/lost-found','?hotel=1&item=7&push=1',hotels)).toBeNull();
 expect(requestedNotificationHotel('/housekeeping','?hotel=2&task=7&push=1',hotels)).toBeNull();
});
