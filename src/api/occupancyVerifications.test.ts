import {describe,expect,it} from 'vitest';
import {parseOccupancyList} from './occupancyVerifications';

const row={
 id:'6',hotelId:'1',roomId:'12',roomNumber:'101',
 inspectionDate:'2026-11-18',assignedUserId:'4',createdBy:'2',
 observedBy:'4',reviewedBy:null,status:'submitted',
 observedOccupancy:'occupied',expectedOccupancy:'vacant',
 discrepancy:'unexpected_occupied',expectedBookingIds:[],
 observationNote:'Occupied when inspected',reviewDecision:null,
 reviewNote:null,observedAt:'2026-11-18 14:00:00',reviewedAt:null,
 createdAt:'2026-11-18 08:00:00',
};
const payload={data:[row],meta:{page:1,perPage:20,total:1,totalPages:1,hotelDate:'2026-11-18'}};
describe('Phase 53 occupancy evidence response',()=>{
 it('retains hotel-local inspection date and independent observation discrepancy',()=>{
  const parsed=parseOccupancyList(payload,'1');
  expect(parsed.meta.hotelDate).toBe('2026-11-18');
  expect(parsed.data[0].discrepancy).toBe('unexpected_occupied');
  expect(parsed.data[0].expectedBookingIds).toEqual([]);
 });
 it('rejects cross-hotel evidence',()=>{
  expect(()=>parseOccupancyList(payload,'2')).toThrow(/another hotel/);
 });
 it('rejects unknown states and impossible identifiers',()=>{
  expect(()=>parseOccupancyList({...payload,data:[{...row,status:'ignored'}]},'1')).toThrow();
  expect(()=>parseOccupancyList({...payload,data:[{...row,roomId:'-3'}]},'1')).toThrow();
 });
 it('requires a valid ISO hotel date',()=>{
  expect(()=>parseOccupancyList({...payload,meta:{...payload.meta,hotelDate:'11/18/2026'}},'1')).toThrow();
 });
});
