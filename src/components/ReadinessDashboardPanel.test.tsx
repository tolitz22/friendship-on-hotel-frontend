import {describe,expect,it} from 'vitest';
import {arrivalUrgency,readinessProblem} from './ReadinessDashboardPanel';
import type {DashboardArrival,DashboardRoom} from '../api/readinessDashboard';

const emptyFlags:DashboardRoom['blockers']={
 activeInventoryBlockToday:false,activeRoomImpactMaintenance:false,
 latestTurnoverIncomplete:false,newTurnoverSinceInspection:false,
 unfinishedHousekeeping:false,newRoomWorkSinceInspection:false,
};
const arrival=(risk:DashboardArrival['risk'],date='2026-11-19'):DashboardArrival=>({
 bookingId:'11',reference:'BK-11',guestName:'Test Guest',checkIn:date,checkOut:'2026-11-21',
 assignedRoomId:risk==='unassigned_room'?null:'12',roomNumber:risk==='unassigned_room'?null:'1201',
 risk,roomStatus:risk==='unassigned_room'?null:'needs_inspection',
 roomBlockers:risk==='unassigned_room'?null:emptyFlags,
 openHousekeepingTaskId:null,activeMaintenanceOrderId:null,activeInventoryBlockId:null,
});
describe('Readiness & arrivals operational priorities',()=>{
 it('places today unassigned ahead of today blocked, then future arrivals',()=>{
  expect(arrivalUrgency(arrival('unassigned_room'),'2026-11-19')).toBe(0);
  expect(arrivalUrgency(arrival('inspection_or_blocker'),'2026-11-19')).toBe(1);
  expect(arrivalUrgency(arrival('unassigned_room','2026-11-20'),'2026-11-19')).toBe(2);
  expect(arrivalUrgency(arrival('inspection_or_blocker','2026-11-20'),'2026-11-19')).toBe(3);
 });
 it('distinguishes real blockers, missing approvals and independent review',()=>{
  expect(readinessProblem({...emptyFlags,activeInventoryBlockToday:true},'blocked_or_stale'))
   .toBe('Inventory block active today');
  expect(readinessProblem({...emptyFlags,activeRoomImpactMaintenance:true},'blocked_or_stale'))
   .toBe('Maintenance restriction active');
  expect(readinessProblem({...emptyFlags,unfinishedHousekeeping:true},'needs_inspection'))
   .toBe('Housekeeping incomplete');
  expect(readinessProblem(emptyFlags,'awaiting_review')).toBe('Waiting for independent review');
  expect(readinessProblem(emptyFlags,'needs_inspection')).toBe('Approved inspection missing or outdated');
 });
});
