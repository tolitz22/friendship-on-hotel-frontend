import {describe,it,expect} from 'vitest';
import {recommendedDeskAction,pageAttentionCount} from './deskActions';
import type {ManifestEntry} from '../../api/liveFrontDesk';
const fixture=(changes:Partial<ManifestEntry>={}):ManifestEntry=>({
 id:'1',reference:'DEMO-1',guestId:'5',guestName:'Synthetic Guest',
 assignedRoomId:'12',roomNumber:'101',checkIn:'2026-11-18',
 checkOut:'2026-11-19',status:'confirmed',...changes,
});
describe('Phase 46 context actions',()=>{
 it('routes unassigned arrivals to assignment, not direct check-in',()=>{
  expect(recommendedDeskAction('arrivals',fixture({assignedRoomId:null,roomNumber:null})).kind).toBe('assign');
  expect(recommendedDeskAction('arrivals',fixture()).kind).toBe('check-in');
 });
 it('routes due checked-in departures to guarded checkout review',()=>{
  expect(recommendedDeskAction('departures',fixture({status:'checked_in'})).kind).toBe('check-out');
  expect(recommendedDeskAction('in_house',fixture({status:'checked_in'})).kind).toBe('view');
 });
 it('counts only known unassigned confirmed arrivals',()=>{
  expect(pageAttentionCount([fixture(),fixture({assignedRoomId:null}),fixture({status:'checked_in',assignedRoomId:null})])).toBe(1);
 });
});
