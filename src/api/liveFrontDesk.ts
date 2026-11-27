import {useQuery} from '@tanstack/react-query';
import {z} from 'zod';
import {getJson} from './http';
import {hotelPath,readSession} from './session';

export const manifestKinds=['arrivals','departures','in_house','overdue'] as const;
export type ManifestKind=typeof manifestKinds[number];

const manifestEntrySchema=z.object({
 id:z.string(),
 reference:z.string(),
 guestId:z.string().nullable(),
 guestName:z.string().nullable(),
 assignedRoomId:z.string().nullable(),
 roomNumber:z.string().nullable(),
 checkIn:z.iso.date(),
 checkOut:z.iso.date(),
 departureFollowUp:z.string().nullish(),
 status:z.enum(['confirmed','checked_in']),
});
const manifestSchema=z.object({
 data:z.array(manifestEntrySchema),
 meta:z.object({
  date:z.iso.date(),
  kind:z.enum(manifestKinds),
  page:z.number().int().positive(),
  perPage:z.number().int().positive(),
  total:z.number().int().nonnegative(),
  queueTotal:z.number().int().nonnegative().optional(),
  unassignedCount:z.number().int().nonnegative().optional(),
  totalPages:z.number().int().nonnegative(),
  determinesHousekeepingReadiness:z.literal(false),
 }),
});
export type ManifestEntry=z.infer<typeof manifestEntrySchema>;
export type ManifestResponse=z.infer<typeof manifestSchema>;

export function parseManifest(payload:unknown,expectedDate:string,kind:ManifestKind):ManifestResponse{
 const parsed=manifestSchema.parse(payload);
 if(parsed.meta.date!==expectedDate || parsed.meta.kind!==kind){
  throw new Error('The server returned a manifest for a different date or queue.');
 }
 return parsed;
}

export function useLiveManifest(date:string,kind:ManifestKind,page:number,perPage=20,search?:string,enabled=true){
 const {hotelId}=readSession();
 return useQuery({
  queryKey:['live','front-desk','manifest',hotelId,date,kind,page,perPage,search],
  enabled:enabled&&!!hotelId&&/^\d{4}-\d{2}-\d{2}$/.test(date),
  queryFn:async()=>parseManifest(await getJson<unknown>(
   hotelPath('/front-desk/manifest'),
   {date,kind,page,per_page:perPage,q:search||undefined}
  ),date,kind),
  retry:false,
  staleTime:0,
  refetchInterval:30000,
  refetchIntervalInBackground:false,
 });
}
