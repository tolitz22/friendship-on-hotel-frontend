import {describe,expect,it} from 'vitest';
import {parseReadiness,parseReadinessEvents} from './liveRoomReadiness';

const sample={
 data:{
  hotelId:'4',roomId:'7',
  inspection:{
   id:'12',roomId:'7',revision:2,status:'approved',
   checks:{cleaningVerified:true,safetyVerified:true,amenitiesVerified:true},
   inspectorNote:'Physically inspected room',inspectedBy:'2',
   reviewedBy:'3',reviewNote:'Approved after inspection',
   createdAt:'2026-11-17 10:00:00',
  },
  blockers:{
   activeInventoryBlockToday:false,
   activeRoomImpactMaintenance:false,
   latestTurnoverIncomplete:false,
   newTurnoverSinceInspection:false,
   unfinishedHousekeeping:false,
   newRoomWorkSinceInspection:false,
  },
  advisoryReady:true,enforcedAtCheckIn:false,inventoryGuaranteed:false,
 },
};
describe('Phase 35 live room-readiness API contract',()=>{
 it('accepts independently reviewed advisory readiness without claiming booking eligibility',()=>{
  const parsed=parseReadiness(sample,'4','7');
  expect(parsed.advisoryReady).toBe(true);
  expect(parsed.enforcedAtCheckIn).toBe(false);
  expect(parsed.inventoryGuaranteed).toBe(false);
  expect(parsed.inspection?.reviewedBy).toBe('3');
 });
 it('rejects another property or room',()=>{
  expect(()=>parseReadiness(sample,'5','7')).toThrow(/selected hotel or room/);
  expect(()=>parseReadiness(sample,'4','8')).toThrow(/selected hotel or room/);
 });
 it('rejects the assertion of readiness when any blocker is active',()=>{
  expect(()=>parseReadiness({
   data:{...sample.data,blockers:{
    ...sample.data.blockers,newTurnoverSinceInspection:true,
   }},
  },'4','7')).toThrow(/contradicts/);
 });
 it('accepts opt-in enforced check-in but still rejects guaranteed inventory',()=>{
  expect(parseReadiness({
   data:{...sample.data,enforcedAtCheckIn:true},
  },'4','7').enforcedAtCheckIn).toBe(true);
  expect(()=>parseReadiness({
   data:{...sample.data,inventoryGuaranteed:true},
  },'4','7')).toThrow();
 });
 it('rejects advisoryReady without approved inspection',()=>{
  expect(()=>parseReadiness({
   data:{...sample.data,inspection:{...sample.data.inspection,status:'submitted'}},
  },'4','7')).toThrow(/contradicts/);
 });
 it('accepts no inspections as an explicitly unapproved room',()=>{
  const result=parseReadiness({
   data:{...sample.data,inspection:null,advisoryReady:false},
  },'4','7');
  expect(result.inspection).toBeNull();
  expect(result.advisoryReady).toBe(false);
 });
 it('validates tenant-independent paginated audit event format',()=>{
  const audit={data:[{
   id:'18',inspectionId:'12',actorId:'3',action:'approved',
   details:{note:'Physical review accepted'},
   createdAt:'2026-11-17 13:00:00',
  }],meta:{page:1,perPage:20,total:1,totalPages:1}};
  expect(parseReadinessEvents(audit).data[0].actorId).toBe('3');
  expect(()=>parseReadinessEvents({
   ...audit,data:[{...audit.data[0],action:'paid'}],
  })).toThrow();
 });
});
