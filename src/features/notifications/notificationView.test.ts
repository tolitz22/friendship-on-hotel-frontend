import {describe,expect,it} from 'vitest';
import {groupFor,priorityFor,visibleNotifications} from './notificationView';
const rows=[{id:'new',kind:'new_booking',date:'2026-11-27'},{id:'pay',kind:'payment_pending_review',date:'2026-11-27'},{id:'urgent',kind:'maintenance_urgent',date:'2026-11-26'}];
describe('notification center',()=>{
 it('keeps urgent and actionable items ahead of routine activity',()=>{
  expect(visibleNotifications(rows,new Set(),'all','all').map(x=>x.id)).toEqual(['urgent','pay','new']);
  expect(rows[0].id).toBe('new');
 });
 it('keeps a read urgent alert in requires attention',()=>{
  expect(visibleNotifications(rows,new Set(['urgent']),'attention','all').map(x=>x.id)).toEqual(['urgent','pay']);
  expect(visibleNotifications(rows,new Set(['urgent']),'unread','all').map(x=>x.id)).toEqual(['pay','new']);
 });
 it('filters by module and classifies daily closing separately from finance',()=>{
  expect(visibleNotifications(rows,new Set(),'all','Finance').map(x=>x.id)).toEqual(['pay']);
  expect(groupFor('closing_payment_pending')).toBe('Daily closing');
  expect(priorityFor('payment_verified')).toBe(0);
 });
});

it('prioritizes urgent arrivals and actionable housekeeping assignments',()=>{
 expect(priorityFor('hk_arrival_urgent')).toBe(2);
 expect(priorityFor('hk_assigned')).toBe(1);
 expect(priorityFor('hk_overdue')).toBe(1);
 expect(groupFor('lost_found_registered')).toBe('Operations');
});
