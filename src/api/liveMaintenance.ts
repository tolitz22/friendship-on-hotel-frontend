import {getJson,requestJson} from './http';
import {hotelPath} from './session';
import type {CollectionResponse,ItemResponse} from './types';

export type MaintenancePriority='low'|'medium'|'high'|'urgent';
export type MaintenanceStatus='open'|'in_progress'|'resolved'|'closed';
export interface LiveWorkOrder{
 id:string;hotelId:string;roomId:string;roomNumber:string;title:string;description:string;
 priority:MaintenancePriority;status:MaintenanceStatus;assignedTo:string|null;assignedUserId:string|null;affectsRoom:boolean;
 revision:number;reportedAt:string;resolvedAt:string|null;
}
export interface MaintenanceEvent{
 id:string;actorId:string;action:string;before:Record<string,unknown>|null;
 after:Record<string,unknown>;note:string|null;createdAt:string;
}
export interface CreateMaintenanceInput{
 roomId:string;title:string;description:string;priority:MaintenancePriority;
 assignedTo:string|null;assignedUserId?:string|null;affectsRoom:boolean;note?:string|null;
}
export interface UpdateMaintenanceInput{
 expectedRevision:number;status?:MaintenanceStatus;priority?:MaintenancePriority;
 assignedTo?:string|null;assignedUserId?:string|null;affectsRoom?:boolean;note?:string|null;
}
export type MaintenanceList=CollectionResponse<LiveWorkOrder>&{
 meta:CollectionResponse<LiveWorkOrder>['meta']&{affectsRoomDoesNotBlockInventory:true};
};
export const listMaintenance=(page=1,perPage=50)=>getJson<MaintenanceList>(
 hotelPath('/maintenance-work-orders'),{page,per_page:perPage});
export const createMaintenance=(body:CreateMaintenanceInput)=>requestJson<ItemResponse<LiveWorkOrder>>(
 hotelPath('/maintenance-work-orders'),{method:'POST',body});
export const updateMaintenance=(id:string,body:UpdateMaintenanceInput)=>requestJson<ItemResponse<LiveWorkOrder>>(
 hotelPath('/maintenance-work-orders/'+encodeURIComponent(id)),{method:'PATCH',body});
export const maintenanceHistory=(id:string)=>getJson<CollectionResponse<MaintenanceEvent>>(
 hotelPath('/maintenance-work-orders/'+encodeURIComponent(id)+'/history'));
