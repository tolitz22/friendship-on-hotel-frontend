import {describe,expect,it} from 'vitest';
import {parsePersonalHousekeepingDashboard} from './liveHousekeeping';
const task={id:'10',hotelId:'1',roomId:'2',roomNumber:'101',type:'checkout_clean',status:'todo',
 assignedTo:null,assignedUserId:'3',dueAt:null,completedAt:null,revision:1,createdAt:'2026-12-10 01:00:00',priority:'arrival_today'};
const sample=()=>({data:{hotelId:'1',userId:'3',hotelDate:'2026-12-10',
 summary:{todo:1,inProgress:0,urgentRooms:1,completedToday:4},activeTotal:1,tasks:[{...task}]}});
describe('HK-02 personal dashboard',()=>{
 it('accepts a reconciled personal queue',()=>expect(parsePersonalHousekeepingDashboard(sample(),'1','3').summary.completedToday).toBe(4));
 it('rejects another hotel or staff member',()=>{
  expect(()=>parsePersonalHousekeepingDashboard(sample(),'2','3')).toThrow();
  expect(()=>parsePersonalHousekeepingDashboard(sample(),'1','4')).toThrow();
  const value=sample();value.data.tasks[0].assignedUserId='4';
  expect(()=>parsePersonalHousekeepingDashboard(value,'1','3')).toThrow();
 });
 it('rejects incomplete or invalid active counts',()=>{
  const value=sample();value.data.summary.todo=2;
  expect(()=>parsePersonalHousekeepingDashboard(value,'1','3')).toThrow();
  const completed=sample();completed.data.tasks[0].status='done';
  expect(()=>parsePersonalHousekeepingDashboard(completed,'1','3')).toThrow();
 });
});
