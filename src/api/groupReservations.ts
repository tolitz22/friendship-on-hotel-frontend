import {useQuery} from '@tanstack/react-query';
import {z} from 'zod';
import {getJson,requestJson} from './http';
import {hotelPath,readSession} from './session';

const id=z.string().regex(/^[1-9]\d*$/);
const groupRoom=z.object({
 bookingId:id,reference:z.string(),guestName:z.string().nullable(),
 roomTypeName:z.string(),roomNumber:z.string().nullable(),roomId:id.nullable(),
 checkIn:z.iso.date(),checkOut:z.iso.date(),status:z.string().nullable(),
});
const group=z.object({
 id,hotelId:id,reference:z.string(),name:z.string(),contactName:z.string().nullable(),
 roomCount:z.number().int().nonnegative(),createdAt:z.string(),
 createdByName:z.string().nullable(),
 activity:z.array(z.object({
  id,action:z.string(),before:z.string().nullable(),after:z.string().nullable(),
  actorId:id,actorName:z.string().nullable(),
  bookingReference:z.string(),guestName:z.string().nullable(),at:z.string(),
 })),
 activityHasMore:z.boolean(),
 relatedOperationalEvents:z.array(z.object({
  id:z.string(),source:z.enum(['housekeeping','manager_approval','room_inspection']),
  action:z.string(),actorName:z.string().nullable(),at:z.string(),
  bookingId:id.nullable(),recordId:id,roomId:id.optional(),
 })),
 relatedOperationalEventsLimited:z.boolean(),
 operations:z.object({
  assignedCount:z.number().int().nonnegative(),readinessAdvisoryReadyCount:z.number().int().nonnegative(),
  readinessCheckedCount:z.number().int().nonnegative(),checkedInOrOutCount:z.number().int().nonnegative(),
  checkedOutCount:z.number().int().nonnegative(),checkoutCleaningCompleteCount:z.number().int().nonnegative(),
  checkoutCleaningPendingCount:z.number().int().nonnegative(),checkoutCleaningUnassignedCount:z.number().int().nonnegative(),
  checkoutCleaningNoTaskCount:z.number().int().nonnegative(),
  readinessIsAdvisoryOnly:z.literal(true),
 }),
 checkIn:z.iso.date().nullable(),checkOut:z.iso.date().nullable(),
 rooms:z.array(groupRoom),billingMode:z.literal('individual_folios'),
 groupBillingTransfersEnabled:z.literal(false),idempotentReplay:z.boolean(),
});
export const groupStatuses=['all','confirmed','partially_checked_in','fully_checked_in',
 'partially_checked_out','checked_out','cancelled'] as const;
export type GroupStatusFilter=typeof groupStatuses[number];
export type DerivedGroupStatus=Exclude<GroupStatusFilter,'all'>;
export function deriveGroupStatus(states:(string|null)[]):DerivedGroupStatus {
 const total=states.length;
 const cancelled=states.filter(s=>s==='cancelled').length;
 const active=total-cancelled;
 const departed=states.filter(s=>s==='checked_out').length;
 const inHouse=states.filter(s=>s==='checked_in').length;
 if(total>0&&cancelled===total)return 'cancelled';
 if(active>0&&departed===active)return 'checked_out';
 if(departed>0)return 'partially_checked_out';
 if(active>0&&inHouse===active)return 'fully_checked_in';
 if(inHouse>0)return 'partially_checked_in';
 return 'confirmed';
}
export const groupStatusLabel=(status:DerivedGroupStatus)=>({
 confirmed:'Confirmed',partially_checked_in:'Partially checked in',
 fully_checked_in:'Fully checked in',partially_checked_out:'Partially checked out',
 checked_out:'Checked out',cancelled:'Cancelled',
}[status]);

const list=z.object({
 data:z.array(z.object({id,reference:z.string(),name:z.string(),
  contactName:z.string().nullable(),roomCount:z.number().int().nonnegative(),
  createdAt:z.string(),checkIn:z.iso.date().nullable(),checkOut:z.iso.date().nullable(),
  status:z.enum(['confirmed','partially_checked_in','fully_checked_in',
   'partially_checked_out','checked_out','cancelled']),
  statusCounts:z.object({confirmed:z.number().int().nonnegative(),
   checkedIn:z.number().int().nonnegative(),checkedOut:z.number().int().nonnegative(),
   cancelled:z.number().int().nonnegative()}),
  })),
 meta:z.object({page:z.number().int().positive(),total:z.number().int().nonnegative(),
  totalPages:z.number().int().nonnegative(),perPage:z.number().int().positive(),
  summary:z.object({
   totalGroups:z.number().int().nonnegative(),upcomingArrivals:z.number().int().nonnegative(),
   inHouseGroups:z.number().int().nonnegative(),attentionGroups:z.number().int().nonnegative(),
   upcomingWindowStart:z.iso.date(),upcomingWindowEnd:z.iso.date(),
  }),
 }),
});
export type GroupBooking=z.infer<typeof group>;
export type GroupRoomInput={guestId:number;roomTypeId:number;ratePlanId?:number};
export type GroupBookingInput={
 idempotencyKey:string;name:string;contactName?:string;allotmentId?:number;
 checkIn:string;checkOut:string;rooms:GroupRoomInput[];
};
export function useGroupBookings(page=1,search='',status:GroupStatusFilter='all'){
 const {hotelId}=readSession();
 return useQuery({
  queryKey:['live','group-reservations',hotelId,page,search,status],enabled:!!hotelId,
  queryFn:async()=>list.parse(await getJson<unknown>(hotelPath('/group-reservations'),{
   page,...(search?{search}:{}),...(status!=='all'?{status}:{})
  })),
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
