import type {HousekeepingTask,Room,TaskStatus} from '../../api/types';

export type TaskColumn='todo'|'in_progress'|'done';
export type DraftUpdate={taskId:string;assignedTo:string|null;status:TaskStatus;note:string};
export function taskColumn(task:HousekeepingTask):TaskColumn {return task.status;}
export const columns:ReadonlyArray<{status:TaskColumn;label:string}>=[
 {status:'todo',label:'To do'},{status:'in_progress',label:'In progress'},{status:'done',label:'Completed'}
];
export function nextStatus(status:TaskStatus):TaskStatus|null{
 if(status==='todo')return 'in_progress';
 if(status==='in_progress')return 'done';
 return null;
}
export function roomAlerts(room:Room|undefined):string[]{
 if(!room)return ['Room record not found'];
 const messages:string[]=[];
 if(room.maintenanceStatus!=='available')messages.push('Maintenance requires review');
 if(room.occupancyStatus==='occupied')messages.push('Room currently marked occupied');
 if(room.housekeepingStatus==='dirty')messages.push('Housekeeping condition: dirty');
 if(room.housekeepingStatus==='inspecting')messages.push('Room awaiting inspection');
 return messages;
}
export function applyDrafts(tasks:HousekeepingTask[],updates:Record<string,DraftUpdate>):HousekeepingTask[]{
 return tasks.map(task=>updates[task.id]?{...task,status:updates[task.id].status,assignedTo:updates[task.id].assignedTo}:task);
}
