import {describe,expect,it} from 'vitest';
import {parseKeycards} from './keycardAuthorizations';

const sample={
 id:'1',hotelId:'5',bookingId:'21',roomId:'11',
 kind:'initial',status:'authorized_mock',provider:'mock',
 providerReference:'MOCK-5-1',physicalCardEncoded:false,
 requestedBy:'6',reviewedBy:null,revokedBy:null,
 reason:'Registered guest is currently checked in.',
 reviewNote:null,revocationNote:null,
 validFrom:'2026-11-18',validUntil:'2026-11-20',
 createdAt:'2026-11-18 09:00:00',reviewedAt:null,revokedAt:null,
};
const value={data:[sample],meta:{page:1,perPage:20,total:1,totalPages:1}};
describe('Phase 54 mock keycard authorization boundary',()=>{
 it('accepts only the selected property and booking',()=>{
  expect(parseKeycards(value,'5','21').data[0].physicalCardEncoded).toBe(false);
  expect(()=>parseKeycards(value,'6')).toThrow(/another hotel/);
  expect(()=>parseKeycards(value,'5','22')).toThrow(/another hotel/);
 });
 it('never accepts a response claiming real encoded cards or hardware providers',()=>{
  expect(()=>parseKeycards({...value,data:[{...sample,physicalCardEncoded:true}]},'5')).toThrow();
  expect(()=>parseKeycards({...value,data:[{...sample,provider:'real_lock'}]},'5')).toThrow();
 });
 it('rejects invented statuses and invalid numeric IDs',()=>{
  expect(()=>parseKeycards({...value,data:[{...sample,status:'physically_issued'}]},'5')).toThrow();
  expect(()=>parseKeycards({...value,data:[{...sample,roomId:'xx'}]},'5')).toThrow();
 });
});
