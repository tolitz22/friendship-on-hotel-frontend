import {getJson,requestJson} from './http';
import {hotelPath} from './session';
import type {CollectionResponse,ItemResponse} from './types';

export type HousekeepingType='checkout_clean'|'stayover'|'inspection';
export type HousekeepingStatus='todo'|'in_progress'|'done';
export interface LiveHousekeepingTask{
 id:string;hotelId:string;roomId:string;roomNumber:string;type:HousekeepingType;
 status:HousekeepingStatus;assignedTo:string|null;assignedUserId:string|null;dueAt:string|null;completedAt:string|null;
 revision:number;createdAt:string;
}
export interface HousekeepingEvent{
 id:string;actorId:string;action:string;
 before:Record<string,unknown>|null;after:Record<string,unknown>;note:string|null;createdAt:string;
}
export type HousekeepingList=CollectionResponse<LiveHousekeepingTask>&{
 meta:CollectionResponse<LiveHousekeepingTask>['meta']&{determinesRoomReadiness:false};
};
export interface CreateHousekeepingInput{
 roomId:string;type:HousekeepingType;assignedTo:string|null;assignedUserId?:string|null;dueAt:string|null;note?:string|null;
}
export interface UpdateHousekeepingInput{
 expectedRevision:number;status?:HousekeepingStatus;
 assignedTo?:string|null;assignedUserId?:string|null;dueAt?:string|null;note?:string|null;
}
export const listHousekeepingTasks=(page=1,perPage=50)=>getJson<HousekeepingList>(
 hotelPath('/housekeeping-tasks'),{page,per_page:perPage});
export const createHousekeepingTask=(body:CreateHousekeepingInput)=>requestJson<ItemResponse<LiveHousekeepingTask>>(
 hotelPath('/housekeeping-tasks'),{method:'POST',body});
export const updateHousekeepingTask=(id:string,body:UpdateHousekeepingInput)=>
 requestJson<ItemResponse<LiveHousekeepingTask>>(
 hotelPath('/housekeeping-tasks/'+encodeURIComponent(id)),{method:'PATCH',body});
export const getHousekeepingHistory=(id:string)=>getJson<CollectionResponse<HousekeepingEvent>>(
 hotelPath('/housekeeping-tasks/'+encodeURIComponent(id)+'/history'));
