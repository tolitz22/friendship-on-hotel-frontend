import {describe,expect,it} from 'vitest';
import {parseCoverageReport} from './occupancyCoverageReport';

const sample={
 data:[{
  roomId:'19',roomNumber:'109',floor:1,verificationId:'42',
  status:'submitted',discrepancy:'unexpected_occupied',
  investigationStatus:null,investigationResolution:null,
  expectedOccupancy:'vacant',observedOccupancy:'occupied',
  assignedUserId:'3',assignedName:'Housekeeper A',observedBy:'3',observerName:'Housekeeper A',reviewedBy:null,reviewerName:null,
  observedAt:'2026-11-18 09:00:00',reviewedAt:null,
 }],
 summary:{
  hotelId:'1',inspectionDate:'2026-11-18',hotelDate:'2026-11-18',
  roomCount:4,missing:1,assigned:1,submitted:1,verified:0,flagged:1,
  observed:2,checked:3,reviewed:1,unresolved:4,resolvedInvestigations:0,unexpectedOccupied:1,expectedOccupiedVacant:0,
  unverified:1,matching:0,coveragePercent:75,observationPercent:50,
  historicalSnapshotOnly:true,roomCatalogAsOfReportRun:true,
 },
 meta:{page:1,perPage:25,total:4,totalPages:1,filter:'all'},
};
describe('Phase 55 occupancy report contract',()=>{
 it('accepts consistent coverage without claiming missing rooms are vacant',()=>{
  const report=parseCoverageReport(sample,'1','all','2026-11-18');
  expect(report.summary.missing).toBe(1);
  expect(report.summary.observed).toBe(2);
  expect(report.summary.reviewed).toBe(1);
  expect(report.summary.unresolved).toBe(4);
  expect(report.summary.resolvedInvestigations).toBe(0);
  expect(report.data[0].assignedName).toBe('Housekeeper A');
  expect(report.data[0].discrepancy).toBe('unexpected_occupied');
 });
 it('subtracts independently closed cases from outstanding actions without erasing flags',()=>{
  const closed={...sample,summary:{...sample.summary,resolvedInvestigations:1,unresolved:3},
   data:[{...sample.data[0],status:'flagged',investigationStatus:'closed',
    investigationResolution:'observation_unconfirmed'}]};
  const result=parseCoverageReport(closed,'1','all');
  expect(result.summary.unresolved).toBe(3);
  expect(result.data[0].investigationStatus).toBe('closed');
 });
 it('rejects cross-hotel, wrong-date and wrong-filter responses',()=>{
  expect(()=>parseCoverageReport(sample,'2','all')).toThrow(/another hotel/);
  expect(()=>parseCoverageReport(sample,'1','missing')).toThrow(/filter/);
  expect(()=>parseCoverageReport(sample,'1','all','2026-11-17')).toThrow(/date/);
 });
 it('rejects inconsistent report counts or forged vacant interpretation of missing rooms',()=>{
  expect(()=>parseCoverageReport({...sample,summary:{...sample.summary,missing:0}},'1','all')).toThrow(/inconsistent/);
  expect(()=>parseCoverageReport({...sample,summary:{...sample.summary,reviewed:2}},'1','all')).toThrow(/inconsistent/);
  expect(()=>parseCoverageReport({...sample,summary:{...sample.summary,unresolved:1}},'1','all')).toThrow(/inconsistent/);
  expect(()=>parseCoverageReport({...sample,data:[{...sample.data[0],status:'missing',verificationId:'42'}]},'1','all')).toThrow(/inconsistent/);
 });
 it('rejects impossible statuses and unsafe IDs',()=>{
  expect(()=>parseCoverageReport({...sample,data:[{...sample.data[0],status:'cleared'}]},'1','all')).toThrow();
  expect(()=>parseCoverageReport({...sample,data:[{...sample.data[0],roomId:'other'}]},'1','all')).toThrow();
 });
});
