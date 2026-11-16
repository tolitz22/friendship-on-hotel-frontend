import {describe,expect,it} from 'vitest';
import type {HousekeepingTask,Room} from '../../api/types';
import {applyDrafts,nextStatus,roomAlerts,taskColumn} from './board';
const task:HousekeepingTask={id:'hk1',hotelId:'h',roomId:'r1',roomNumber:'201',type:'checkout_clean',status:'todo',assignedTo:null,dueAt:null};
const room:Room={id:'r1',hotelId:'h',number:'201',floor:2,roomTypeId:'standard',roomTypeName:'Standard',occupancyStatus:'occupied',housekeepingStatus:'dirty',maintenanceStatus:'out_of_order',maxOccupancy:2};
describe('mock housekeeping board',()=>{
 it('recognizes task stages without implying room readiness',()=>{
  expect(taskColumn(task)).toBe('todo');
  expect(nextStatus('todo')).toBe('in_progress');
  expect(nextStatus('in_progress')).toBe('done');
  expect(nextStatus('done')).toBe(null);
 });
 it('keeps room occupancy, housekeeping and maintenance independent',()=>{
  expect(roomAlerts(room)).toContain('Maintenance requires review');
  expect(roomAlerts(room)).toContain('Room currently marked occupied');
  expect(roomAlerts(room)).toContain('Housekeeping condition: dirty');
 });
 it('applies local draft changes without mutating original fixture tasks',()=>{
  const changed=applyDrafts([task],{hk1:{taskId:'hk1',status:'done',assignedTo:'Team B',note:'Preview only'}});
  expect(changed[0].status).toBe('done');
  expect(changed[0].assignedTo).toBe('Team B');
  expect(task.status).toBe('todo');
  expect(task.assignedTo).toBeNull();
 });
});
