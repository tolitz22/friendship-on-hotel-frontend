import {useQuery} from '@tanstack/react-query';
import {z} from 'zod';
import {getJson,requestJson} from './http';
import {hotelPath,readSession} from './session';

const id=z.string().regex(/^[1-9]\d*$/);
const groupRoom=z.object({
 bookingId:id,reference:z.string(),guestName:z.string().nullable(),
 roomTypeName:z.string(),roomNumber:z.string().nullable(),
 checkIn:z.iso.date(),checkOut:z.iso.date(),status:z.string().nullable(),
});
const group=z.object({
 id,hotelId:id,reference:z.string(),name:z.string(),contactName:z.string().nullable(),
 roomCount:z.number().int().nonnegative(),createdAt:z.string(),
 rooms:z.array(groupRoom),billingMode:z.literal('individual_folios'),
 groupBillingTransfersEnabled:z.literal(false),idempotentReplay:z.boolean(),
});
const list=z.object({
 data:z.array(z.object({id,reference:z.string(),name:z.string(),
  contactName:z.string().nullable(),roomCount:z.number().int().nonnegative(),
  createdAt:z.string()})),
 meta:z.object({page:z.number().int().positive(),total:z.number().int().nonnegative(),
  totalPages:z.number().int().nonnegative(),perPage:z.number().int().positive()}),
});
export type GroupBooking=z.infer<typeof group>;
export type GroupRoomInput={guestId:number;roomTypeId:number;ratePlanId?:number};
export type GroupBookingInput={
 idempotencyKey:string;name:string;contactName?:string;
 checkIn:string;checkOut:string;rooms:GroupRoomInput[];
};
export function useGroupBookings(page=1){
 const {hotelId}=readSession();
 return useQuery({
  queryKey:['live','group-reservations',hotelId,page],enabled:!!hotelId,
  queryFn:async()=>list.parse(await getJson<unknown>(hotelPath('/group-reservations'),{page})),
  retry:false,
 });
}
export function useGroupBooking(groupId:string|null){
 const {hotelId}=readSession();
 return useQuery({
  queryKey:['live','group-reservation',hotelId,groupId],
  enabled:!!hotelId&&!!groupId&&id.safeParse(groupId).success,
  queryFn:async()=>{
   const payload=z.object({data:group}).parse(await getJson<unknown>(
    hotelPath('/group-reservations/'+encodeURIComponent(groupId!))));
   if(payload.data.hotelId!==hotelId||payload.data.id!==groupId)
    throw new Error('The returned group does not match the selected hotel.');
   return payload.data;
  },retry:false,
 });
}
export async function createGroupBooking(input:GroupBookingInput):Promise<GroupBooking>{
 const payload=z.object({data:group}).parse(await requestJson<unknown>(
  hotelPath('/group-reservations'),{method:'POST',body:input}));
 if(payload.data.hotelId!==readSession().hotelId)
  throw new Error('The created group belongs to another hotel.');
 return payload.data;
}
