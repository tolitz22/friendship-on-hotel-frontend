import {describe,expect,it} from 'vitest';
import {newHousekeepingAlerts,selectHousekeepingAttention,readDismissedHousekeepingAlerts,dismissHousekeepingAlert} from './housekeepingAttention';
const a={id:'hk_assigned:1',kind:'hk_assigned',reference:'Room 201',taskId:'1'};
const b={id:'hk_arrival_urgent:2',kind:'hk_arrival_urgent',reference:'Room 202',taskId:'2'};
describe('housekeeping attention',()=>{
 it('does not play old alerts on initial load and detects new assignments on refresh',()=>{
  const initial=newHousekeepingAlerts(null,[a],new Set());
  expect(initial.arrivals).toEqual([]);
  const next=newHousekeepingAlerts(initial.seen,[a,b],new Set());
  expect(next.arrivals).toEqual([b]);
  expect(newHousekeepingAlerts(next.seen,[a,b],new Set()).arrivals).toEqual([]);
 });
 it('prioritizes urgent unread tasks and ignores read alerts',()=>{
  expect(selectHousekeepingAttention([a,b],new Set())).toEqual([b,a]);
  expect(selectHousekeepingAttention([a,b],new Set([b.id]))).toEqual([a]);
 });
});

it('restores a dismissed alert after reload without hiding a new assignment',()=>{
 const stored=JSON.stringify(dismissHousekeepingAlert([],a.id));
 const restored=new Set(readDismissedHousekeepingAlerts(stored));
 expect(selectHousekeepingAttention([a],restored)).toEqual([]);
 expect(selectHousekeepingAttention([a,b],restored)).toEqual([b]);
 expect(newHousekeepingAlerts(new Set(),[a,b],restored).arrivals).toEqual([b]);
});
it('deduplicates dismissals and safely reads malformed browser storage',()=>{
 expect(dismissHousekeepingAlert([a.id,b.id],a.id)).toEqual([a.id,b.id]);
 expect(readDismissedHousekeepingAlerts('invalid')).toEqual([]);
 expect(readDismissedHousekeepingAlerts(JSON.stringify([a.id,42,null,a.id]))).toEqual([a.id]);
});
