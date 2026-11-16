import {describe,expect,it} from 'vitest';
import type {FrontDeskEntry} from '../../api/types';
import {checklistFor,operationWarnings} from './operations';

const entry:FrontDeskEntry={
 reservation:{id:'res1',reference:'FOH-1',hotelId:'h1',primaryGuestId:'g1',primaryGuestName:'Sample Guest',roomTypeId:'standard',roomTypeName:'Standard',assignedRoomId:null,assignedRoomNumber:null,checkIn:'2026-11-17',checkOut:'2026-11-18',status:'pending',adults:1,children:0,total:{amountMinor:0,currency:'PHP'},createdAt:'2026-11-15T08:00:00+08:00'},
 room:null,readiness:'review_required',alerts:['No physical room assigned']
};
describe('front desk mock safeguards',()=>{
 it('has a separate checklist for check-in and check-out',()=>{
  expect(checklistFor('check_in')).toHaveLength(4);
  expect(checklistFor('check_out')).toHaveLength(4);
  expect(checklistFor('check_in')[1].label).not.toEqual(checklistFor('check_out')[1].label);
 });
 it('warns when a pending arrival has no assigned room',()=>{
  const warnings=operationWarnings(entry,'check_in');
  expect(warnings).toContain('No physical room assigned');
  expect(warnings).toContain('Only confirmed reservations proceed to check-in after server validation');
 });
 it('warns when a departure is not checked in',()=>{
  expect(operationWarnings(entry,'check_out')).toContain('Guest is not marked checked in');
 });
 it('does not infer eligibility from completed checklists',()=>{
  const warnings=operationWarnings({...entry,reservation:{...entry.reservation,status:'confirmed'}},'check_in');
  expect(warnings).toContain('No physical room assigned');
 });
});
