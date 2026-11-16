import type {MaintenanceWorkOrder,Room,WorkOrderStatus} from '../../api/types';
export const stages:ReadonlyArray<{status:WorkOrderStatus;label:string}>=[{status:'open',label:'Open'},{status:'in_progress',label:'In progress'},{status:'resolved',label:'Resolved'},{status:'closed',label:'Closed'}];
export type WorkOrderDraft={status:WorkOrderStatus;assignedTo:string|null;note:string};
export function applyWorkOrderDrafts(orders:MaintenanceWorkOrder[],drafts:Record<string,WorkOrderDraft>):MaintenanceWorkOrder[]{
 return orders.map(order=>drafts[order.id]?{...order,status:drafts[order.id].status,assignedTo:drafts[order.id].assignedTo}:order);
}
export function roomImpact(order:MaintenanceWorkOrder,room:Room|undefined):string[]{
 const warnings:string[]=[];
 if(!room)return ['Room details unavailable'];
 if(order.affectsRoom)warnings.push('Work order flagged as potentially affecting the room');
 if(room.maintenanceStatus!=='available')warnings.push('Room currently marked '+room.maintenanceStatus.replaceAll('_',' '));
 if(room.occupancyStatus==='occupied')warnings.push('Room currently occupied — coordinate with front desk');
 return warnings;
}
export function priorityRank(p:MaintenanceWorkOrder['priority']):number{return {urgent:0,high:1,medium:2,low:3}[p];}
