import {describe,expect,it} from 'vitest';
import {parseManifest} from './liveFrontDesk';

const date='2026-11-21';
const response={
 data:[{
  id:'42',
  reference:'FOH-0042',
  guestId:'12',
  guestName:'Sample Guest',
  assignedRoomId:null,
  roomNumber:null,
  checkIn:'2026-11-21',
  checkOut:'2026-11-23',
  status:'confirmed',
 }],
 meta:{
  date,
  kind:'arrivals',
  page:1,
  perPage:20,
  total:1,
  totalPages:1,
  determinesHousekeepingReadiness:false,
 },
};

describe('live front desk manifest contract',()=>{
 it('preserves nullable room and server total without guessing readiness',()=>{
  const actual=parseManifest(response,date,'arrivals');
  expect(actual.data[0].assignedRoomId).toBeNull();
  expect(actual.data[0].roomNumber).toBeNull();
  expect(actual.meta.total).toBe(1);
  expect(actual.meta.determinesHousekeepingReadiness).toBe(false);
 });

 it('rejects a manifest returned for another operational date',()=>{
  expect(()=>parseManifest(response,'2026-11-22','arrivals')).toThrow(/different date or queue/);
 });

 it('rejects another queue even when its date matches',()=>{
  expect(()=>parseManifest(response,date,'departures')).toThrow(/different date or queue/);
 });

 it('rejects a response that claims housekeeping readiness',()=>{
  expect(()=>parseManifest({
   ...response,
   meta:{...response.meta,determinesHousekeepingReadiness:true},
  },date,'arrivals')).toThrow();
 });

 it('rejects invalid dates and unsupported status instead of displaying invented data',()=>{
  expect(()=>parseManifest({
   ...response,data:[{...response.data[0],checkIn:'21/11/2026',status:'paid'}],
  },date,'arrivals')).toThrow();
 });

 it('preserves the shift handoff on an overdue checked-in stay',()=>{
  const parsed=parseManifest({
   data:[{...response.data[0],checkOut:date,status:'checked_in',departureFollowUp:'Awaiting guest confirmation'}],
   meta:{...response.meta,kind:'overdue'},
  },date,'overdue');
  expect(parsed.data[0].departureFollowUp).toBe('Awaiting guest confirmation');
 });

 it('supports a paginated empty in-house manifest',()=>{
  const parsed=parseManifest({
   data:[],meta:{
    ...response.meta,kind:'in_house',total:0,totalPages:0,
   },
  },date,'in_house');
  expect(parsed.data).toEqual([]);
  expect(parsed.meta.totalPages).toBe(0);
 });
});
