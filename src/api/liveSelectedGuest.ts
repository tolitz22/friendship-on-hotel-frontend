import {useQuery} from '@tanstack/react-query';
import {z} from 'zod';
import {getJson} from './http';
import {hotelPath,readSession} from './session';

const id=z.string().regex(/^[1-9][0-9]*$/);
const guest=z.object({
 id,hotelId:id,firstName:z.string().min(1),lastName:z.string().min(1),
 email:z.string().nullable(),phone:z.string().nullable(),
 nationality:z.string().nullable(),createdAt:z.string(),
});
export type LiveSelectedGuest=z.infer<typeof guest>;

export function parseSelectedGuest(value:unknown,hotelId:string,guestId:string):LiveSelectedGuest{
 const data=z.object({data:guest}).parse(value).data;
 if(data.hotelId!==hotelId||data.id!==guestId)
  throw new Error('Selected guest response does not match the active hotel and guest.');
 return data;
}

/** The direct link resolves the guest even when they are not in the first
 * page of the guest directory, without broadening hotel authorization. */
export function useSelectedGuest(guestId:string|null){
 const {hotelId}=readSession();
 return useQuery({
  queryKey:['live','selected-guest',hotelId,guestId],
  enabled:!!hotelId&&!!guestId&&id.safeParse(guestId).success,
  queryFn:async()=>parseSelectedGuest(await getJson<unknown>(
   hotelPath('/guests/'+encodeURIComponent(guestId!))
  ),hotelId!,guestId!),
  retry:false,staleTime:0,
 });
}
