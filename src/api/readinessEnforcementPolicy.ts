import {useQuery} from '@tanstack/react-query';
import {z} from 'zod';
import {getJson,requestJson} from './http';
import {hotelPath,readSession} from './session';

const id=z.string().regex(/^[1-9]\d*$/);
const policy=z.object({data:z.object({
 hotelId:id,enforceAtCheckIn:z.boolean(),
 revision:z.number().int().nonnegative(),
 changedBy:id.nullable(),updatedAt:z.string().nullable(),
 requiresIndependentRoomInspection:z.literal(true),
 paymentsOrIdentityVerified:z.literal(false),
})});
const history=z.object({
 data:z.array(z.object({
  id,actorId:id,previousEnabled:z.boolean(),nextEnabled:z.boolean(),
  revision:z.number().int().positive(),reason:z.string(),createdAt:z.string(),
 })),
 meta:z.object({
  page:z.number().int().positive(),perPage:z.number().int().positive(),
  total:z.number().int().nonnegative(),totalPages:z.number().int().nonnegative(),
 }),
});
export type ReadinessPolicy=z.infer<typeof policy>['data'];

export function parseReadinessPolicy(value:unknown,hotelId:string){
 const data=policy.parse(value).data;
 if(data.hotelId!==hotelId)throw new Error('Readiness policy belongs to a different hotel.');
 return data;
}
export function useReadinessPolicy(){
 const {hotelId}=readSession();
 return useQuery({
  queryKey:['live','readiness-policy',hotelId],
  enabled:!!hotelId,
  queryFn:async()=>parseReadinessPolicy(await getJson<unknown>(
   hotelPath('/readiness/enforcement-policy')
  ),hotelId!),
  retry:false,
 });
}
export function useReadinessPolicyHistory(page:number){
 const {hotelId}=readSession();
 return useQuery({
  queryKey:['live','readiness-policy-history',hotelId,page],
  enabled:!!hotelId,
  queryFn:async()=>history.parse(await getJson<unknown>(
   hotelPath('/readiness/enforcement-policy/history'),{page}
  )),
  retry:false,
 });
}
export async function changeReadinessPolicy(
 hotelId:string,revision:number,enabled:boolean,reason:string
):Promise<ReadinessPolicy>{
 if(readSession().hotelId!==hotelId)
  throw new Error('Selected hotel changed; reload readiness settings.');
 if(!Number.isSafeInteger(revision)||revision<0||reason.trim().length<10)
  throw new Error('Invalid revision or insufficient change reason.');
 return parseReadinessPolicy(await requestJson<unknown>(
  hotelPath('/readiness/enforcement-policy'),{
   method:'PATCH',body:{expectedRevision:revision,enforceAtCheckIn:enabled,reason:reason.trim()},
  }
 ),hotelId);
}
