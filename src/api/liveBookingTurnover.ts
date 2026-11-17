import {useQuery} from '@tanstack/react-query';
import {z} from 'zod';
import {getJson} from './http';
import {hotelPath,readSession} from './session';

const id=z.string().regex(/^[1-9][0-9]*$/);
const schema=z.object({data:z.object({
 hotelId:id,bookingId:id,
 task:z.object({
  id,roomId:id,type:z.literal('checkout_clean'),
  status:z.enum(['todo','in_progress','done']),
  revision:z.number().int().positive(),
 }).nullable(),
 determinesRoomReadiness:z.literal(false),
})});

export function parseTurnover(value:unknown,hotelId:string,bookingId:string){
 const result=schema.parse(value).data;
 if(result.hotelId!==hotelId||result.bookingId!==bookingId)
  throw new Error('Checkout task response belongs to another hotel or reservation.');
 return result;
}
export function useBookingTurnover(bookingId:string|null,checkedOut:boolean){
 const {hotelId}=readSession();
 return useQuery({
  queryKey:['live','booking-turnover',hotelId,bookingId],
  enabled:!!hotelId&&!!bookingId&&checkedOut&&id.safeParse(bookingId).success,
  queryFn:async()=>parseTurnover(await getJson<unknown>(
   hotelPath('/bookings/'+encodeURIComponent(bookingId!)+'/turnover')
  ),hotelId!,bookingId!),
  retry:false,
 });
}
