import {useQuery} from '@tanstack/react-query';
import {z} from 'zod';
import {getJson,requestJson} from './http';
import {hotelPath,readSession} from './session';

const id=z.string().regex(/^[1-9]\d*$/);
const allotment=z.object({
 id,reference:z.string(),name:z.string(),roomTypeId:id,roomTypeName:z.string(),
 quantity:z.number().int().positive(),checkIn:z.iso.date(),checkOut:z.iso.date(),
 expiresAt:z.string(),createdByName:z.string().nullable(),
 releasedByName:z.string().nullable(),status:z.enum(['held','expired','released','converted']),
 convertedGroupId:id.nullable(),
});
export type GroupAllotment=z.infer<typeof allotment>;
export type GroupHoldInput={idempotencyKey:string;name:string;roomTypeId:number;quantity:number;
 checkIn:string;checkOut:string;holdMinutes:number};
export function useGroupAllotments(){
 const {hotelId}=readSession();
 return useQuery({
  queryKey:['live','group-allotments',hotelId],enabled:!!hotelId,
  queryFn:()=>getJson<unknown>(hotelPath('/group-allotments'))
   .then(raw=>z.object({data:z.array(allotment),
    meta:z.object({limit:z.number(),hasMore:z.boolean()})}).parse(raw)),
  retry:false,
 });
}
export async function createGroupAllotment(payload:GroupHoldInput){
 return z.object({data:z.object({id,replayed:z.boolean()})}).parse(
  await requestJson<unknown>(hotelPath('/group-allotments'),{method:'POST',body:payload})).data;
}
export async function releaseGroupAllotment(allotmentId:string){
 return z.object({data:z.object({id,status:z.literal('released')})}).parse(
  await requestJson<unknown>(hotelPath('/group-allotments/'+encodeURIComponent(allotmentId)+'/release'),
   {method:'POST'})).data;
}
