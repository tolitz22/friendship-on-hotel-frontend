import {describe,expect,it} from 'vitest';
import {parseRoomRack} from './roomRack';

const valid=()=>({
 data:{
  hotelId:'1',hotelDate:'2026-11-19',enforcedAtCheckIn:false,
  allowedActions:{completeInspection:false},
  rooms:[{
   roomId:'42',roomNumber:'402',roomTypeId:'2',roomTypeName:'Standard',
   maxOccupancy:2,floor:4,occupancy:'vacant',cleaning:'not_verified',
   advisoryReady:false,inspectionStatus:null,inspectionId:null,
   readinessStatus:'needs_inspection',blockers:{
    activeInventoryBlockToday:false,activeRoomImpactMaintenance:false,
    latestTurnoverIncomplete:false,newTurnoverSinceInspection:false,
    unfinishedHousekeeping:false,newRoomWorkSinceInspection:false,
   },
   openHousekeepingTaskId:null,activeMaintenanceOrderId:null,activeInventoryBlockId:null,
   cleanedAt:null,inspectedAt:null,reviewedAt:null,currentStay:null,upcomingStay:null,
  }],
  arrivals:[],
  summary:{totalRooms:1,pmsVacantRooms:1,pmsOccupiedRooms:0,
   arrivalsToday:0,departuresToday:0,roomsNeedingCleaning:0,
   legacyPendingInspections:0,activelyBlockedRooms:0},
 },
 meta:{page:1,perPage:100,total:1,totalPages:1,snapshotOnly:true,
  availabilityGuaranteed:false,physicalOccupancyVerified:false,
  financialSettlementVerified:false},
});
describe('Room rack API response verification',()=>{
 it('accepts real stringified Laravel IDs for hotel, room and room type',()=>{
  expect(parseRoomRack(valid(),'1',1).data.rooms[0].roomId).toBe('42');
 });
 it('rejects invalid IDs and cross-hotel responses',()=>{
  const wrong=valid();wrong.data.rooms[0].roomId='42x';
  expect(()=>parseRoomRack(wrong,'1',1)).toThrow();
  expect(()=>parseRoomRack(valid(),'2',1)).toThrow(/different hotel/);
 });
 it('does not misrepresent occupancy and readiness from contradictory data',()=>{
  const wrong=valid();wrong.data.rooms[0].advisoryReady=true;
  expect(()=>parseRoomRack(wrong,'1',1)).toThrow(/conflicts/);
 });
});
