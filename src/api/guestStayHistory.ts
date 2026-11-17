import {useQuery} from '@tanstack/react-query';
import {z} from 'zod';
import {getJson} from './http';
import {hotelPath,readSession} from './session';

const id=z.string().regex(/^[1-9]\d*$/);
const response=z.object({
 data:z.array(z.object({
  id,reference:z.string(),checkIn:z.iso.date(),checkOut:z.iso.date(),
  status:z.string().nullable(),roomTypeName:z.string().nullable(),
  roomNumber:z.string().nullable(),
 })),
 meta:z.object({hotelId:id,guestId:id,page:z.number().int().positive(),
  perPage:z.number().int().positive(),total:z.number().int().nonnegative(),
  totalPages:z.number().int().nonnegative(),
  excludesUnverifiedLifetimeSpend:z.literal(true)}),
});
export function parseGuestStayHistory(raw:unknown,hotelId:string,guestId:string){
 const parsed=response.parse(raw);
 if(parsed.meta.hotelId!==hotelId||parsed.meta.guestId!==guestId)
  throw new Error('Guest history does not match the selected hotel and profile.');
 return parsed;
}
export function useGuestStayHistory(guestId:string|null,page:number){
 const {hotelId}=readSession();
 return useQuery({
  queryKey:['live','guest-stay-history',hotelId,guestId,page],
  enabled:!!hotelId&&!!guestId,
  queryFn:async()=>parseGuestStayHistory(await getJson<unknown>(
   hotelPath('/guests/'+guestId+'/stays'),{page,per_page:10}
  ),hotelId!,guestId!),retry:false,
 });
}
