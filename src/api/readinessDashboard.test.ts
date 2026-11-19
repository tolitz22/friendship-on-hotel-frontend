import {describe,expect,it} from 'vitest';
import {parseReadinessDashboard} from './readinessDashboard';

const base={
 data:{
  hotelId:'4',asOfHotelDate:'2026-12-10',
  arrivalWindowDays:7,arrivalWindowEndExclusive:'2026-12-17',
  enforceAtCheckIn:true,
  summary:{totalRooms:2,approvedCurrent:1,awaitingReview:0,needsInspection:1,blockedOrStale:0},
  rooms:[{
   roomId:'11',roomNumber:'101',roomTypeId:'8',
   status:'approved_current',latestInspectionId:'33',inspectionStatus:'approved',
   openHousekeepingTaskId:null,activeMaintenanceOrderId:null,activeInventoryBlockId:null,
   blockers:{
    activeInventoryBlockToday:false,activeRoomImpactMaintenance:false,
    latestTurnoverIncomplete:false,newTurnoverSinceInspection:false,
    unfinishedHousekeeping:false,newRoomWorkSinceInspection:false,
   },
  }],
  arrivals:[{
   bookingId:'51',reference:'BK-ONE',guestName:'Arrival Guest',checkIn:'2026-12-11',checkOut:'2026-12-12',
   assignedRoomId:null,roomNumber:null,risk:'unassigned_room',roomStatus:null,
   roomBlockers:null,openHousekeepingTaskId:null,activeMaintenanceOrderId:null,activeInventoryBlockId:null,
  }],
 },
 meta:{
  roomPage:1,roomPerPage:20,roomTotalPages:1,arrivalTotal:1,
  snapshotOnly:true,futureRoomReadinessGuaranteed:false,
  inventoryGuaranteed:false,guestOrPaymentVerified:false,
 },
};

describe('Phase 37 operational readiness report contract',()=>{
 it('accepts full-hotel room totals with paginated room and unassigned arrival',()=>{
  const value=parseReadinessDashboard(base,'4',7,1);
  expect(value.data.summary.totalRooms).toBe(2);
  expect(value.data.rooms).toHaveLength(1);
  expect(value.data.arrivals[0].risk).toBe('unassigned_room');
  expect(value.data.arrivals[0].guestName).toBe('Arrival Guest');
  expect(value.data.arrivals[0].roomBlockers).toBeNull();
  expect(value.data.enforceAtCheckIn).toBe(true);
 });
 it('rejects cross-hotel or other reporting windows and pages',()=>{
  expect(()=>parseReadinessDashboard(base,'5',7,1)).toThrow(/another hotel/);
  expect(()=>parseReadinessDashboard(base,'4',14,1)).toThrow(/reporting window/);
  expect(()=>parseReadinessDashboard(base,'4',7,2)).toThrow(/reporting window/);
 });
 it('rejects fabricated or non-reconciling hotel-wide summary',()=>{
  expect(()=>parseReadinessDashboard({
   ...base,data:{...base.data,summary:{...base.data.summary,totalRooms:3}},
  },'4',7,1)).toThrow(/does not reconcile/);
 });
 it('rejects a supposedly approved room with a current blocker',()=>{
  expect(()=>parseReadinessDashboard({
   ...base,data:{...base.data,rooms:[{
    ...base.data.rooms[0],
    blockers:{...base.data.rooms[0].blockers,newRoomWorkSinceInspection:true},
   }]},
  },'4',7,1)).toThrow(/claims a room is ready/);
 });
 it('rejects partial arrivals that would mislead hotel staff',()=>{
  expect(()=>parseReadinessDashboard({
   ...base,meta:{...base.meta,arrivalTotal:2},
  },'4',7,1)).toThrow(/incomplete/);
 });
 it('rejects arrivals outside the chosen future window',()=>{
  expect(()=>parseReadinessDashboard({
   ...base,data:{...base.data,arrivals:[{...base.data.arrivals[0],checkIn:'2026-12-18'}]},
  },'4',7,1)).toThrow(/outside the requested window/);
 });
 it('rejects invented guarantees or verification claims',()=>{
  expect(()=>parseReadinessDashboard({
   ...base,meta:{...base.meta,inventoryGuaranteed:true},
  },'4',7,1)).toThrow();
  expect(()=>parseReadinessDashboard({
   ...base,meta:{...base.meta,guestOrPaymentVerified:true},
  },'4',7,1)).toThrow();
  expect(()=>parseReadinessDashboard({
   ...base,meta:{...base.meta,snapshotOnly:false},
  },'4',7,1)).toThrow();
 });
});
