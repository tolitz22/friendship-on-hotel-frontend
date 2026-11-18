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
 id:string;actorId:string;actorName?:string|null;action:string;
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
export const listHousekeepingTasks=(page=1,perPage=50,filter:TaskFilter={})=>getJson<HousekeepingList>(
 hotelPath('/housekeeping-tasks'),{page,per_page:perPage,status:filter.status,type:filter.type});
export const createHousekeepingTask=(body:CreateHousekeepingInput)=>requestJson<ItemResponse<LiveHousekeepingTask>>(
 hotelPath('/housekeeping-tasks'),{method:'POST',body});
export const updateHousekeepingTask=(id:string,body:UpdateHousekeepingInput)=>
 requestJson<ItemResponse<LiveHousekeepingTask>>(
 hotelPath('/housekeeping-tasks/'+encodeURIComponent(id)),{method:'PATCH',body});
export const getHousekeepingHistory=(id:string,page=1)=>getJson<CollectionResponse<HousekeepingEvent>>(
 hotelPath('/housekeeping-tasks/'+encodeURIComponent(id)+'/history'),{page,per_page:20});


// Phase 33 validated queries and cautious revisioned transitions.
import {useQuery} from '@tanstack/react-query';
import {z} from 'zod';
import {readSession} from './session';

const idSchema=z.string().regex(/^[1-9]\d*$/);
const taskSchema=z.object({
 id:idSchema,hotelId:idSchema,roomId:idSchema,roomNumber:z.string(),
 type:z.enum(['checkout_clean','stayover','inspection']),
 status:z.enum(['todo','in_progress','done']),
 assignedTo:z.string().nullable(),assignedUserId:idSchema.nullable(),
 dueAt:z.string().nullable(),completedAt:z.string().nullable(),
 revision:z.number().int().positive(),createdAt:z.string(),
});
const listSchema=z.object({
 data:z.array(taskSchema),
 meta:z.object({
  page:z.number().int().positive(),perPage:z.number().int().positive(),
  total:z.number().int().nonnegative(),totalPages:z.number().int().nonnegative(),
  determinesRoomReadiness:z.literal(false),
 }),
});
const historySchema=z.object({
 data:z.array(z.object({
  id:idSchema,actorId:idSchema,actorName:z.string().nullable().optional(),action:z.string(),before:z.record(z.string(),z.unknown()).nullable(),
  after:z.record(z.string(),z.unknown()),note:z.string().nullable(),createdAt:z.string(),
 })),
 meta:z.object({
  page:z.number().int().positive(),perPage:z.number().int().positive(),
  total:z.number().int().nonnegative(),totalPages:z.number().int().nonnegative(),
 }),
});
export type TaskFilter={status?:HousekeepingStatus;type?:HousekeepingType};

export function parseLiveHousekeeping(value:unknown,hotelId:string){
 const result=listSchema.parse(value);
 if(result.data.some(item=>item.hotelId!==hotelId))
  throw new Error('Housekeeping response contains tasks belonging to another hotel.');
 return result;
}
export function parseUpdatedHousekeeping(value:unknown,hotelId:string,taskId:string){
 const task=taskSchema.parse(z.object({data:taskSchema}).parse(value).data);
 if(task.hotelId!==hotelId||task.id!==taskId)
  throw new Error('Housekeeping update response has a different hotel or task.');
 return task;
}
export function parseHousekeepingHistory(value:unknown){return historySchema.parse(value);}
export function nextLiveHousekeepingStatus(current:HousekeepingStatus):HousekeepingStatus|null{
 return current==='todo'?'in_progress':current==='in_progress'?'done':null;
}
export function canProgressHousekeeping(task:LiveHousekeepingTask,admin:boolean,userId:string|null){
 return task.status!=='done'&&(admin||userId!==null&&task.assignedUserId===userId);
}
export function useLiveHousekeeping(page:number,filter:TaskFilter){
 const {hotelId}=readSession();
 return useQuery({
  queryKey:['live','housekeeping',hotelId,page,filter.status??'',filter.type??''],
  enabled:!!hotelId,
  queryFn:async()=>parseLiveHousekeeping(await getJson<unknown>(
   hotelPath('/housekeeping-tasks'),{
    page,per_page:20,status:filter.status,type:filter.type,
   }),hotelId!),
  retry:false,
 });
}
export function useLiveHousekeepingHistory(taskId:string|null,page:number){
 const {hotelId}=readSession();
 return useQuery({
  queryKey:['live','housekeeping-history',hotelId,taskId,page],
  enabled:!!hotelId&&!!taskId,
  queryFn:async()=>parseHousekeepingHistory(await getJson<unknown>(
   hotelPath('/housekeeping-tasks/'+encodeURIComponent(taskId!)+'/history'),
   {page,per_page:20}
  )),
  retry:false,
 });
}
export async function patchLiveHousekeeping(hotelId:string,task:LiveHousekeepingTask,update:UpdateHousekeepingInput){
 if(readSession().hotelId!==hotelId)throw new Error('Hotel changed. Reload housekeeping before saving.');
 if(!Number.isSafeInteger(update.expectedRevision)||update.expectedRevision!==task.revision)
  throw new Error('Invalid revision; reload the housekeeping task.');
 const result=await updateHousekeepingTask(task.id,update);
 return parseUpdatedHousekeeping(result,hotelId,task.id);
}


/** Load one housekeeping task even if it is outside the current task page. */
export function useDirectHousekeepingTask(taskId:string|null){
 const {hotelId}=readSession();
 return useQuery({
  queryKey:['live','housekeeping-direct-task',hotelId,taskId],
  enabled:!!hotelId&&!!taskId&&idSchema.safeParse(taskId).success,
  queryFn:async()=>parseUpdatedHousekeeping(await getJson<unknown>(
   hotelPath('/housekeeping-tasks/'+encodeURIComponent(taskId!))
  ),hotelId!,taskId!),
  retry:false,staleTime:0,
 });
}
