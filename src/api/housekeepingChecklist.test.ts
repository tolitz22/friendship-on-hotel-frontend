import {describe,expect,it} from 'vitest';
import {canFinishCleaningChecklist,parseUpdatedHousekeeping,type LiveHousekeepingTask} from './liveHousekeeping';
const task:LiveHousekeepingTask={id:'1',hotelId:'2',roomId:'3',roomNumber:'101',type:'checkout_clean',status:'in_progress',
 assignedTo:null,assignedUserId:'4',dueAt:null,completedAt:null,revision:2,createdAt:'2026-11-27',
 checklist:[{key:'trash',label:'Remove trash',checkedBy:'4',checkedAt:'2026-11-27T03:00:00Z'},{key:'linens',label:'Replace linens',checkedBy:null,checkedAt:null}]};
describe('HK-04 checklist evidence',()=>{
 it('requires the complete server-provided checklist before completion',()=>{
  expect(canFinishCleaningChecklist(task,['trash'])).toBe(false);
  expect(canFinishCleaningChecklist(task,['trash','unknown'])).toBe(false);
  expect(canFinishCleaningChecklist(task,['trash','trash'])).toBe(false);
  expect(canFinishCleaningChecklist(task,['trash','linens'])).toBe(true);
  expect(canFinishCleaningChecklist({...task,checklist:undefined},[])).toBe(false);
 });
 it('preserves persisted evidence and rejects duplicate or incomplete items',()=>{
  expect(parseUpdatedHousekeeping({data:task},'2','1').checklist).toEqual(task.checklist);
  expect(()=>parseUpdatedHousekeeping({data:{...task,checklist:[task.checklist![0],task.checklist![0]]}},'2','1')).toThrow();
  expect(()=>parseUpdatedHousekeeping({data:{...task,checklist:[{...task.checklist![0],checkedBy:null}]}},'2','1')).toThrow();
 });
});
