import {describe,expect,it} from 'vitest';
import {parseApprovals} from './managerApprovals';

const row={
 id:'5',hotelId:'1',bookingId:'12',requestedBy:'2',reviewedBy:null,executedBy:null,
 action:'amend_dates',status:'pending',
 reason:'Guest needs an additional night.',
 payload:{checkIn:'2026-12-10',checkOut:'2026-12-12'},
 snapshot:{checkIn:'2026-12-10',checkOut:'2026-12-11',status:'confirmed',
  roomTypeId:'3',assignedRoomId:null},
 reviewNote:null,
 expiresAt:'2026-11-20 00:00:00',createdAt:'2026-11-18 00:00:00',
 reviewedAt:null,executedAt:null,
};
const data={data:[row],meta:{page:1,perPage:20,total:1,totalPages:1}};

describe('Phase 51 approval response safety',()=>{
 it('validates selected hotel and booking and preserves the request snapshot',()=>{
  const parsed=parseApprovals(data,'1','12');
  expect(parsed.data[0].snapshot.checkOut).toBe('2026-12-11');
  expect(parsed.data[0].payload.checkOut).toBe('2026-12-12');
 });
 it('rejects records scoped to a different property or booking',()=>{
  expect(()=>parseApprovals(data,'2')).toThrow(/selected hotel/);
  expect(()=>parseApprovals(data,'1','13')).toThrow(/reservation/);
 });
 it('recognizes early check-in as an explicit manager approval action',()=>{
  const early={...row,action:'early_check_in',payload:{},
   snapshot:{...row.snapshot,assignedRoomId:'41'}};
  const result=parseApprovals({...data,data:[early]},'1','12');
  expect(result.data[0].action).toBe('early_check_in');
  expect(result.data[0].status).toBe('pending');
  expect(result.data[0].snapshot.checkIn).toBe('2026-12-10');
 });
 it('rejects unknown statuses, malformed IDs and missing review metadata',()=>{
  expect(()=>parseApprovals({...data,data:[{...row,status:'secretly_approved'}]},'1')).toThrow();
  expect(()=>parseApprovals({...data,data:[{...row,hotelId:'abc'}]},'1')).toThrow();
  expect(()=>parseApprovals({...data,data:[{...row,reviewedBy:undefined}]},'1')).toThrow();
 });
});
