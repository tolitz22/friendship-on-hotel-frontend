import {describe,expect,it} from 'vitest';
import type {RackArrival,RackRoom} from '../../api/roomRack';
import {matchRackQuick,matchRackSearch,roomNextAction,roomPriority,roomProblem,roomTone,sortRackRooms} from './roomRackModel';

const flags={
 activeInventoryBlockToday:false,activeRoomImpactMaintenance:false,
 latestTurnoverIncomplete:false,newTurnoverSinceInspection:false,
 unfinishedHousekeeping:false,newRoomWorkSinceInspection:false,
};
const room=(id:string,overrides:Partial<RackRoom>={}):RackRoom=>({
 roomId:id,roomNumber:id,roomTypeName:'Standard',roomTypeId:'2',floor:1,maxOccupancy:2,
 occupancy:'vacant',cleaning:'not_verified',advisoryReady:false,
 inspectionStatus:null,inspectionId:null,readinessStatus:'needs_inspection',
 blockers:{...flags},openHousekeepingTaskId:null,activeMaintenanceOrderId:null,
 activeInventoryBlockId:null,cleanedAt:null,inspectedAt:null,reviewedAt:null,
 currentStay:null,upcomingStay:null,...overrides,
});
const arrival=(roomId:string|null,date='2026-11-19'):RackArrival=>({
 bookingId:'89',reference:'BK-89',guestName:'Guest Example',checkIn:date,checkOut:'2026-11-20',
 assignedRoomId:roomId,roomNumber:roomId,risk:roomId?'inspection_or_blocker':'unassigned_room',
 roomStatus:roomId?'needs_inspection':null,roomBlockers:roomId?flags:null,
 openHousekeepingTaskId:null,activeMaintenanceOrderId:null,activeInventoryBlockId:null,
});
const date='2026-11-19';
describe('hotel room rack status mapping',()=>{
 it('distinguishes occupied, future reserved, vacant approved, blocked and unknown',()=>{
  expect(roomTone(room('1',{occupancy:'occupied',currentStay:{
   bookingId:'71',reference:'R-71',guestName:'Guest',checkIn:'2026-11-18',checkOut:'2026-11-20',
  }}))).toBe('occupied');
  expect(roomTone(room('2',{upcomingStay:{
   bookingId:'72',reference:'R-72',guestName:'Guest',checkIn:'2026-11-20',checkOut:'2026-11-22',
  }}))).toBe('reserved');
  expect(roomTone(room('3',{advisoryReady:true,readinessStatus:'approved_current',inspectionStatus:'approved'})))
   .toBe('approved');
  expect(roomTone(room('4',{blockers:{...flags,activeRoomImpactMaintenance:true}}))).toBe('blocked');
  expect(roomTone(room('5',{cleaning:'cleaning_in_progress'}))).toBe('attention');
  expect(roomTone(room('6',{readinessStatus:'blocked_or_stale',cleaning:'not_verified'}))).toBe('attention');
 });
 it('never labels PMS vacancy as reservation availability',()=>{
  expect(roomNextAction(room('1',{advisoryReady:true}))).toBe('View room');
  expect(roomProblem(room('2',{blockers:{...flags,activeInventoryBlockToday:true}})))
   .toBe('Inventory block active');
 });
});
describe('room rack task priority and filtering',()=>{
 it('prioritizes blocked arrivals over cleaning, departures, occupied and inspected vacant',()=>{
  const blockedArrival=room('101',{blockers:{...flags,activeInventoryBlockToday:true}});
  const cleaning=room('102',{cleaning:'cleaning_in_progress'});
  const departure=room('103',{occupancy:'due_for_checkout',currentStay:{
   bookingId:'74',reference:'R-74',guestName:'Guest',checkIn:'2026-11-17',checkOut:date,
  }});
  const occupied=room('104',{occupancy:'occupied',currentStay:{
   bookingId:'75',reference:'R-75',guestName:'Guest',checkIn:'2026-11-17',checkOut:'2026-11-22',
  }});
  const ready=room('105',{advisoryReady:true,readinessStatus:'approved_current',inspectionStatus:'approved'});
  const results=sortRackRooms([ready,occupied,departure,cleaning,blockedArrival],[arrival('101')],date);
  expect(results.map(x=>x.roomId)).toEqual(['101','102','103','104','105']);
  expect(roomPriority(blockedArrival,[arrival('101')],date)).toBe(0);
 });
 it('filters cleaning and blocked independently of PMS occupancy',()=>{
  const dirty=room('1',{cleaning:'checkout_cleaning',occupancy:'occupied'});
  const blocked=room('2',{blockers:{...flags,activeRoomImpactMaintenance:true}});
  expect(matchRackQuick(dirty,'cleaning',date,[])).toBe(true);
  expect(matchRackQuick(dirty,'in_house',date,[])).toBe(true);
  expect(matchRackQuick(dirty,'vacant_approved',date,[])).toBe(false);
  expect(matchRackQuick(blocked,'blocked',date,[])).toBe(true);
  expect(matchRackQuick(blocked,'cleaning',date,[])).toBe(false);
 });
 it('does not search guest names without permission',()=>{
  const sensitive=room('201',{currentStay:{
   bookingId:'83',reference:'R-83',guestName:'Secret Guest',checkIn:date,checkOut:'2026-11-20',
  }});
  expect(matchRackSearch(sensitive,'secret',false)).toBe(false);
  expect(matchRackSearch(sensitive,'secret',true)).toBe(true);
  expect(matchRackSearch(sensitive,'201',false)).toBe(true);
 });
});
