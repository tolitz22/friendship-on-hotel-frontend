import {describe,expect,it} from 'vitest';
import {parseHousekeepingWorkload,parseLiveHousekeeping} from './liveHousekeeping';
describe('HK-03 assignment queue',()=>{
 it('validates full scoped workload and rejects cross-hotel and duplicate rows',()=>{
  const sample={data:[{userId:'7',todo:2,inProgress:1}],meta:{hotelId:'1'}};
  expect(parseHousekeepingWorkload(sample,'1')).toEqual(sample.data);
  expect(()=>parseHousekeepingWorkload(sample,'2')).toThrow();
  expect(()=>parseHousekeepingWorkload({...sample,data:[...sample.data,...sample.data]},'1')).toThrow();
 });
 it('preserves server inspection and overdue evidence',()=>{
  const data={id:'1',hotelId:'1',roomId:'2',roomNumber:'101',type:'checkout_clean',status:'done',
   assignedTo:null,assignedUserId:'7',dueAt:null,completedAt:'2026-12-10',revision:2,createdAt:'2026-12-09',
   arrivalToday:false,overdue:false,pendingInspection:true};
  const result=parseLiveHousekeeping({data:[data],meta:{page:1,perPage:20,total:1,totalPages:1,determinesRoomReadiness:false,pendingInspectionCount:1}},'1');
  expect(result.data[0].pendingInspection).toBe(true);
  expect(result.meta.pendingInspectionCount).toBe(1);
 });
});
