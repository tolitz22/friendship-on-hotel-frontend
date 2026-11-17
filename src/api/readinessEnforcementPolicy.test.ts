import {describe,expect,it} from 'vitest';
import {parseReadinessPolicy} from './readinessEnforcementPolicy';

const policy={data:{
 hotelId:'4',enforceAtCheckIn:false,revision:0,
 changedBy:null,updatedAt:null,
 requiresIndependentRoomInspection:true,
 paymentsOrIdentityVerified:false,
}};

describe('Phase 36 hotel readiness enforcement policy contract',()=>{
 it('defaults to off without claiming identity, finance or inventory verification',()=>{
  const result=parseReadinessPolicy(policy,'4');
  expect(result.enforceAtCheckIn).toBe(false);
  expect(result.revision).toBe(0);
  expect(result.requiresIndependentRoomInspection).toBe(true);
  expect(result.paymentsOrIdentityVerified).toBe(false);
 });
 it('recognizes an explicitly active hotel policy with a revision',()=>{
  const result=parseReadinessPolicy({
   data:{...policy.data,enforceAtCheckIn:true,revision:2,
    changedBy:'21',updatedAt:'2026-11-17 12:00:00'},
  },'4');
  expect(result.enforceAtCheckIn).toBe(true);
  expect(result.revision).toBe(2);
 });
 it('rejects policy responses from another hotel',()=>{
  expect(()=>parseReadinessPolicy(policy,'5')).toThrow(/different hotel/);
 });
 it('rejects unsupported assertions of identity and finance verification',()=>{
  expect(()=>parseReadinessPolicy({
   data:{...policy.data,paymentsOrIdentityVerified:true},
  },'4')).toThrow();
 });
 it('rejects malformed revisions and hotel IDs',()=>{
  expect(()=>parseReadinessPolicy({
   data:{...policy.data,revision:-1},
  },'4')).toThrow();
  expect(()=>parseReadinessPolicy({
   data:{...policy.data,hotelId:'other'},
  },'4')).toThrow();
 });
});
