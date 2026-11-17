import {describe,expect,it} from 'vitest';
import {parseCoverageReport} from './occupancyCoverageReport';

const sample={
 data:[{
  roomId:'19',roomNumber:'109',floor:1,verificationId:'42',
  status:'submitted',discrepancy:'unexpected_occupied',
  expectedOccupancy:'vacant',observedOccupancy:'occupied',
  assignedUserId:'3',observedBy:'3',reviewedBy:null,
  observedAt:'2026-11-18 09:00:00',reviewedAt:null,
 }],
 summary:{
  hotelId:'1',inspectionDate:'2026-11-18',hotelDate:'2026-11-18',
  roomCount:4,missing:1,assigned:1,submitted:1,verified:0,flagged:1,
  observed:2,checked:3,unexpectedOccupied:1,expectedOccupiedVacant:0,
  unverified:1,matching:0,coveragePercent:75,observationPercent:50,
  historicalSnapshotOnly:true,
 },
 meta:{page:1,perPage:25,total:4,totalPages:1,filter:'all'},
};
describe('Phase 55 occupancy report contract',()=>{
 it('accepts consistent coverage without claiming missing rooms are vacant',()=>{
  const report=parseCoverageReport(sample,'1','all','2026-11-18');
  expect(report.summary.missing).toBe(1);
  expect(report.summary.observed).toBe(2);
  expect(report.data[0].discrepancy).toBe('unexpected_occupied');
 });
 it('rejects cross-hotel, wrong-date and wrong-filter responses',()=>{
  expect(()=>parseCoverageReport(sample,'2','all')).toThrow(/another hotel/);
  expect(()=>parseCoverageReport(sample,'1','missing')).toThrow(/filter/);
  expect(()=>parseCoverageReport(sample,'1','all','2026-11-17')).toThrow(/date/);
 });
 it('rejects inconsistent report counts or forged vacant interpretation of missing rooms',()=>{
  expect(()=>parseCoverageReport({...sample,summary:{...sample.summary,missing:0}},'1','all')).toThrow(/inconsistent/);
  expect(()=>parseCoverageReport({...sample,data:[{...sample.data[0],status:'missing',verificationId:'42'}]},'1','all')).toThrow(/inconsistent/);
 });
 it('rejects impossible statuses and unsafe IDs',()=>{
  expect(()=>parseCoverageReport({...sample,data:[{...sample.data[0],status:'cleared'}]},'1','all')).toThrow();
  expect(()=>parseCoverageReport({...sample,data:[{...sample.data[0],roomId:'other'}]},'1','all')).toThrow();
 });
});
