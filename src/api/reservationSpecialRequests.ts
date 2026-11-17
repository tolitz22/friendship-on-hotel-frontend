import {useQuery} from '@tanstack/react-query';
import {z} from 'zod';
import {getJson,requestJson} from './http';
import {hotelPath,readSession} from './session';
const id=z.string().regex(/^[1-9]\d*$/);
export const requestTags=['late_arrival','quiet_room','extra_bedding','accessibility','connecting_rooms','other'] as const;
export type SpecialRequestTag=typeof requestTags[number];
const entry=z.object({
 id,bookingId:id,tag:z.enum(requestTags),note:z.string(),createdBy:id,createdAt:z.string(),
 isGuaranteed:z.literal(false),chargesAutomaticallyPosted:z.literal(false),
});
const list=z.object({data:z.array(entry),meta:z.object({
 hotelId:id,bookingId:id,page:z.number().int().positive(),total:z.number().int().nonnegative(),
 totalPages:z.number().int().nonnegative(),
})});
export type SpecialRequest=z.infer<typeof entry>;
export function parseSpecialRequests(value:unknown,hotelId:string,bookingId:string){
 const parsed=list.parse(value);
 if(parsed.meta.hotelId!==hotelId||parsed.meta.bookingId!==bookingId
  ||parsed.data.some(item=>item.bookingId!==bookingId))
  throw new Error('Special requests belong to a different reservation or hotel.');
 return parsed;
}
export function useSpecialRequests(bookingId:string,enabled=true){
 const {hotelId}=readSession();
 return useQuery({
  queryKey:['live','special-requests',hotelId,bookingId],
  enabled:enabled&&!!hotelId&&!!bookingId,
  queryFn:async()=>parseSpecialRequests(await getJson<unknown>(
   hotelPath('/bookings/'+bookingId+'/special-requests')),hotelId!,bookingId),
  retry:false,
 });
}
export async function addSpecialRequest(hotelId:string,bookingId:string,
 input:{idempotencyKey:string;tag:SpecialRequestTag;note:string}){
 if(readSession().hotelId!==hotelId)throw new Error('The selected hotel changed.');
 const result=z.object({data:entry}).parse(await requestJson<unknown>(
  hotelPath('/bookings/'+bookingId+'/special-requests'),
  {method:'POST',body:input},
 )).data;
 if(result.bookingId!==bookingId)throw new Error('Saved request belongs to a different reservation.');
 return result;
}
