import {describe,expect,it} from 'vitest';
import {parseHousekeepingManagerReport} from './housekeepingManagerReport';
const daily={date:'2026-11-27',checkoutCompleted:1,stayoverCompleted:0,inspectionsCompleted:1,cleaningSamples:0,turnoverSamples:1,averageCleaningMinutes:null,averageTurnoverMinutes:42};
const raw={data:{hotelId:'1',hotelDate:daily.date,days:1,summary:{...daily,todo:0,inProgress:0,overdue:0,unassigned:0,pendingInspection:0},staff:[{userId:'2',todo:0,inProgress:0,overdue:0,completed:1,checkoutCompleted:1,stayoverCompleted:0,cleaningSamples:0,averageCleaningMinutes:null}],daily:[daily]},meta:{snapshotOnly:true,durationBasis:'recorded_events'}};
describe('HK-07 manager report',()=>{
 it('distinguishes unavailable timing from zero',()=>expect(parseHousekeepingManagerReport(raw,'1',1).summary.averageCleaningMinutes).toBeNull());
 it('rejects inconsistent totals and wrong hotel',()=>{
  expect(()=>parseHousekeepingManagerReport(raw,'2',1)).toThrow();
  expect(()=>parseHousekeepingManagerReport({...raw,data:{...raw.data,summary:{...raw.data.summary,checkoutCompleted:2}}},'1',1)).toThrow();
 });
});
