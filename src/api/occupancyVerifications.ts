import {useQuery} from '@tanstack/react-query';
import {z} from 'zod';
import {getJson,requestJson} from './http';
import {hotelPath,readSession} from './session';

const id=z.string().regex(/^[1-9]\d*$/);
const item=z.object({
 id,hotelId:id,roomId:id,roomNumber:z.string(),inspectionDate:z.string(),
 assignedUserId:id,createdBy:id,observedBy:id.nullable(),reviewedBy:id.nullable(),
 status:z.enum(['assigned','submitted','verified','flagged']),
 observedOccupancy:z.enum(['occupied','vacant','unknown']).nullable(),
 expectedOccupancy:z.enum(['occupied','vacant']).nullable(),
 discrepancy:z.enum(['unverified','match','unexpected_occupied','expected_occupied_vacant']).nullable(),
 expectedBookingIds:z.array(id).nullable(),
 observationNote:z.string().nullable(),reviewDecision:z.string().nullable(),
 reviewNote:z.string().nullable(),observedAt:z.string().nullable(),
 reviewedAt:z.string().nullable(),createdAt:z.string(),
});
const list=z.object({data:z.array(item),meta:z.object({page:z.number().int().positive(),
 perPage:z.number().int().positive(),total:z.number().int().nonnegative(),totalPages:z.number().int().nonnegative(),hotelDate:z.iso.date()})});
export type OccupancyVerification=z.infer<typeof item>;
export function parseOccupancyList(value:unknown,hotelId:string){
 const result=list.parse(value);
 if(result.data.some(row=>row.hotelId!==hotelId))throw new Error('Occupancy evidence belongs to another hotel.');
 return result;
}
export function useOccupancyVerifications(enabled:boolean,page:number,status?:OccupancyVerification['status']){
 const {hotelId}=readSession();
 return useQuery({queryKey:['live','occupancy-verifications',hotelId,page,status],
  enabled:enabled&&!!hotelId,
  queryFn:async()=>parseOccupancyList(await getJson<unknown>(hotelPath('/occupancy-verifications'),{
   page,per_page:20,status,
  }),hotelId!),
  retry:false});
}
function verifyContext(hotelId:string){if(readSession().hotelId!==hotelId)throw new Error('Selected hotel changed.');}
function verifyItem(response:unknown,hotelId:string){
 const row=z.object({data:item}).parse(response).data;
 if(row.hotelId!==hotelId)throw new Error('Occupancy confirmation is scoped to another hotel.');
 return row;
}
export async function assignOccupancy(hotelId:string,input:{roomId:string;assignedUserId:string;inspectionDate:string}){
 verifyContext(hotelId);
 return verifyItem(await requestJson<unknown>(hotelPath('/occupancy-verifications'),{method:'POST',body:input}),hotelId);
}
export async function observeOccupancy(hotelId:string,id:string,input:{observedOccupancy:'occupied'|'vacant'|'unknown';note:string}){
 verifyContext(hotelId);
 return verifyItem(await requestJson<unknown>(hotelPath('/occupancy-verifications/'+encodeURIComponent(id)+'/observe'),{method:'POST',body:input}),hotelId);
}
export async function reviewOccupancy(hotelId:string,id:string,input:{decision:'verified'|'flagged';note:string}){
 verifyContext(hotelId);
 return verifyItem(await requestJson<unknown>(hotelPath('/occupancy-verifications/'+encodeURIComponent(id)+'/review'),{method:'POST',body:input}),hotelId);
}
const historySchema=z.object({data:z.array(z.object({
 id,actorId:id,actorName:z.string().nullable().optional(),event:z.string(),details:z.unknown(),createdAt:z.string(),
}))});
export function parseOccupancyHistory(value:unknown){
 return historySchema.parse(value);
}
export async function occupancyHistory(hotelId:string,verificationId:string){
 verifyContext(hotelId);
 return parseOccupancyHistory(await getJson<unknown>(
  hotelPath('/occupancy-verifications/'+encodeURIComponent(verificationId)+'/history'),
 ));
}
