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
 id:string;actorId:string;actorName?:string|null;action:string;before:Record<string,unknown>|null;
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
export const listMaintenance=(page=1,perPage=50,filters:MaintenanceFilters={})=>getJson<MaintenanceList>(
 hotelPath('/maintenance-work-orders'),{page,per_page:perPage,status:filters.status,priority:filters.priority,q:filters.q,mine:filters.mine });
export const createMaintenance=(body:CreateMaintenanceInput)=>requestJson<ItemResponse<LiveWorkOrder>>(
 hotelPath('/maintenance-work-orders'),{method:'POST',body});
export const updateMaintenance=(id:string,body:UpdateMaintenanceInput)=>requestJson<ItemResponse<LiveWorkOrder>>(
 hotelPath('/maintenance-work-orders/'+encodeURIComponent(id)),{method:'PATCH',body});
export const maintenanceHistory=(id:string,page=1)=>getJson<CollectionResponse<MaintenanceEvent>>(
 hotelPath('/maintenance-work-orders/'+encodeURIComponent(id)+'/history'),{page,per_page:20});


// Phase 34: Validate the backend's actual paginated maintenance contract.
import {z} from 'zod';
import {readSession} from './session';

export type MaintenanceFilters={q?:string;mine?:number;status?:MaintenanceStatus;priority?:MaintenancePriority};
const id=z.string().regex(/^[1-9]\d*$/);
const workOrder=z.object({
 id,hotelId:id,roomId:id,roomNumber:z.string(),
 title:z.string(),description:z.string(),
 priority:z.enum(['low','medium','high','urgent']),
 status:z.enum(['open','in_progress','resolved','closed']),
 assignedTo:z.string().nullable(),assignedUserId:id.nullable(),
 affectsRoom:z.boolean(),revision:z.number().int().positive(),
 reportedAt:z.string(),resolvedAt:z.string().nullable(),
});
const pagination=z.object({
 page:z.number().int().positive(),perPage:z.number().int().positive(),
 total:z.number().int().nonnegative(),totalPages:z.number().int().nonnegative(),
});
const maintenanceList=z.object({
 data:z.array(workOrder),
 meta:pagination.extend({affectsRoomDoesNotBlockInventory:z.literal(true)}),
});
const maintenanceEvent=z.object({
 id,actorId:id,actorName:z.string().nullable().optional(),action:z.string(),
 before:z.record(z.string(),z.unknown()).nullable(),
 after:z.record(z.string(),z.unknown()),
 note:z.string().nullable(),createdAt:z.string(),
});
const events=z.object({data:z.array(maintenanceEvent),meta:pagination});

export function parseLiveMaintenance(value:unknown,hotelId:string){
 const result=maintenanceList.parse(value);
 if(result.data.some(order=>order.hotelId!==hotelId))
  throw new Error('Maintenance response contains work orders for another hotel.');
 return result;
}
export function parseUpdatedMaintenance(value:unknown,hotelId:string,orderId:string){
 const result=z.object({data:workOrder}).parse(value).data;
 if(result.hotelId!==hotelId||result.id!==orderId)
  throw new Error('Maintenance update response does not match the selected hotel or order.');
 return result;
}
export function parseMaintenanceHistory(value:unknown){return events.parse(value);}
export function nextLiveMaintenanceStatus(current:MaintenanceStatus):MaintenanceStatus|null{
 return current==='open'?'in_progress':current==='in_progress'?'resolved':
 current==='resolved'?'closed':null;
}
export function mayUpdateMaintenance(order:LiveWorkOrder,admin:boolean,role:string|undefined,userId:string|null){
 return admin||(role==='maintenance'&&userId!==null&&order.assignedUserId===userId);
}
export async function patchValidatedMaintenance(hotelId:string,order:LiveWorkOrder,input:UpdateMaintenanceInput){
 if(readSession().hotelId!==hotelId)throw new Error('Hotel changed. Reload maintenance before saving.');
 if(!Number.isSafeInteger(input.expectedRevision)||input.expectedRevision!==order.revision)
  throw new Error('Stale or invalid work-order revision.');
 const result=await updateMaintenance(order.id,input);
 return parseUpdatedMaintenance(result,hotelId,order.id);
}

/** Resolve a specific work order through the hotel-scoped server endpoint. */
export async function fetchMaintenanceOrder(orderId:string):Promise<LiveWorkOrder>{
 if(!id.safeParse(orderId).success)throw new Error('Invalid maintenance order reference.');
 const hotelId=readSession().hotelId;
 if(!hotelId)throw new Error('Select a hotel before opening maintenance.');
 const payload=await getJson<unknown>(hotelPath('/maintenance-work-orders/'+encodeURIComponent(orderId)));
 return parseUpdatedMaintenance(payload,hotelId,orderId);
}
