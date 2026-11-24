import {useQuery} from '@tanstack/react-query';
import {z} from 'zod';
import {getJson} from './http';
import {hotelPath,readSession} from './session';

const id=z.string().regex(/^[1-9]\d*$/);
const day=z.iso.date();
const natural=z.number().int().nonnegative();
const pagination=z.object({
 page:z.number().int().positive(),
 perPage:z.number().int().positive(),
 total:natural,
 totalPages:natural,
});
const record=z.object({
 id,hotelId:id,reference:z.string(),roomTypeId:id,
 guestName:z.string().nullable().optional(),
 guestPhone:z.string().nullable().optional(),
 roomTypeName:z.string().nullable().optional(),
 assignedRoomNumber:z.string().nullable().optional(),
 assignedRoomId:id.nullable(),
 checkIn:day,checkOut:day,
 createdAt:z.string().nullable().optional(),updatedAt:z.string().nullable().optional(),createdDate:day.nullable().optional(),
 lifecycleState:z.string().nullable(),
 earlyCheckIn:z.object({
  scheduledCheckIn:day,actualCheckInDate:day,actualCheckedInAt:z.string(),
  approvalRequestId:id,requestedBy:id,approvedBy:id,checkedInBy:id,
  reason:z.string(),managerNote:z.string(),
 }).nullable().optional(),
});
const recordsSchema=z.object({
 data:z.array(record),
 meta:pagination.extend({isAvailability:z.literal(false)}),
});
const typeSchema=z.object({
 id,hotelId:id,name:z.string(),maxOccupancy:z.number().int().positive(),
});
const typesSchema=z.object({data:z.array(typeSchema)});
const rateSchema=z.object({
 id,roomTypeId:id,name:z.string(),currency:z.string().regex(/^[A-Z]{3}$/),
 nightlyMinor:natural,active:z.boolean(),
});
const ratesSchema=z.object({data:z.array(rateSchema)});
const nightSchema=z.object({
 date:day,physicalRooms:natural,reserved:natural,blocked:natural,
 remaining:natural,overcommitted:z.boolean(),
});
const availabilitySchema=z.object({
 data:z.object({
  hotelId:id,roomTypeId:id,checkIn:day,checkOut:day,
  nights:z.array(nightSchema),canBook:z.boolean(),
  includesMaintenanceBlocks:z.literal(true),
  includesHousekeepingReadiness:z.literal(false),
  includesPricing:z.literal(false),
 }),
 meta:z.object({
  scope:z.literal('registered_room_type_inventory'),
  housekeepingReadinessVerified:z.literal(false),
  pricingIncluded:z.literal(false),
 }),
});
const quoteSchema=z.object({
 data:z.object({
  ratePlanId:id,roomTypeId:id,currency:z.string().regex(/^[A-Z]{3}$/),
  nightlyMinor:natural,nights:z.array(day),
  roomSubtotalMinor:natural,
  taxesCalculated:z.literal(false),feesCalculated:z.literal(false),
  depositCalculated:z.literal(false),isFinalPayableTotal:z.literal(false),
 }),
});

export type LiveRecord=z.infer<typeof record>;
export type LiveRate=z.infer<typeof rateSchema>;
export type LiveAvailability=z.infer<typeof availabilitySchema>;
export type LiveQuote=z.infer<typeof quoteSchema>;
export type LiveRoomType=z.infer<typeof typeSchema>;
export type LiveStay={roomTypeId:string;checkIn:string;checkOut:string};

const safeNumber=(n:number)=>Number.isSafeInteger(n)&&n>=0;
export function validLiveStay(stay:LiveStay):boolean{
 if(!id.safeParse(stay.roomTypeId).success
  ||!day.safeParse(stay.checkIn).success
  ||!day.safeParse(stay.checkOut).success
  ||stay.checkOut<=stay.checkIn)return false;
 const start=Date.parse(stay.checkIn+'T00:00:00Z');
 const end=Date.parse(stay.checkOut+'T00:00:00Z');
 const nights=(end-start)/86400000;
 return Number.isInteger(nights)&&nights>=1&&nights<=31;
}
export function parseRecords(value:unknown,hotelId:string){
 const result=recordsSchema.parse(value);
 if(result.data.some(r=>r.hotelId!==hotelId))
  throw new Error('The server returned another hotel’s reservation records.');
 return result;
}
export function parseAvailability(value:unknown,hotelId:string,stay:LiveStay){
 const result=availabilitySchema.parse(value);
 if(result.data.hotelId!==hotelId||result.data.roomTypeId!==stay.roomTypeId
  ||result.data.checkIn!==stay.checkIn||result.data.checkOut!==stay.checkOut)
  throw new Error('The server returned availability for a different hotel or stay.');
 return result;
}
export function parseQuote(value:unknown,stay:LiveStay,ratePlanId:string){
 const result=quoteSchema.parse(value);
 if(result.data.roomTypeId!==stay.roomTypeId||result.data.ratePlanId!==ratePlanId)
  throw new Error('The server returned a quote for a different rate or room type.');
 if(!safeNumber(result.data.nightlyMinor)||!safeNumber(result.data.roomSubtotalMinor)
  ||result.data.nights.length!==((Date.parse(stay.checkOut+'T00:00:00Z')-Date.parse(stay.checkIn+'T00:00:00Z'))/86400000))
  throw new Error('The server returned inconsistent quote amounts or stay nights.');
 return result;
}

export type ReservationListFilter='all'|'needs_room'|'arrivals'|'in_house'|'completed'|'checked_out'|'cancelled';
export type BookingDateOptions={field:'created_at'|'updated_at'|'check_in'|'check_out'|'stay';from:string;to:string;sortBy:'created_at'|'updated_at'|'check_in'|'check_out';direction:'asc'|'desc'};
export const defaultBookingDates:BookingDateOptions={field:'created_at',from:'',to:'',sortBy:'created_at',direction:'desc'};
export function useLiveReservationRecords(page:number,search='',filter:ReservationListFilter='all',dates:BookingDateOptions=defaultBookingDates){
 const {hotelId}=readSession();
 return useQuery({
  queryKey:['live','reservation-records',hotelId,page,search,filter,dates],
  enabled:!!hotelId,
  queryFn:async()=>parseRecords(await getJson<unknown>(
   hotelPath('/reservation-records'),{page,per_page:20,search:search||undefined,filter,date_field:dates.field,date_from:dates.from||undefined,date_to:dates.to||undefined,sort_by:dates.sortBy,sort_dir:dates.direction}
  ),hotelId!),
  retry:false,
 });
}
export function useLiveRoomTypes(){
 const {hotelId}=readSession();
 return useQuery({
  queryKey:['live','room-types',hotelId],
  enabled:!!hotelId,
  queryFn:async()=>{
   const response=typesSchema.parse(await getJson<unknown>(hotelPath('/room-types')));
   if(response.data.some(t=>t.hotelId!==hotelId))
    throw new Error('The server returned room types from another hotel.');
   return response;
  },
  retry:false,
 });
}
export function useLiveRatePlans(){
 const {hotelId}=readSession();
 return useQuery({
  queryKey:['live','room-rate-plans',hotelId],
  enabled:!!hotelId,
  queryFn:async()=>ratesSchema.parse(await getJson<unknown>(hotelPath('/rate-plans'))),
  retry:false,
 });
}
export function useLiveAvailability(stay:LiveStay|null){
 const {hotelId}=readSession();
 const valid=stay!==null&&validLiveStay(stay);
 return useQuery({
  queryKey:['live','availability',hotelId,stay?.roomTypeId,stay?.checkIn,stay?.checkOut],
  enabled:!!hotelId&&valid,
  queryFn:async()=>parseAvailability(await getJson<unknown>(
   hotelPath('/room-type-availability'),{
    roomTypeId:stay!.roomTypeId,
    checkIn:stay!.checkIn,checkOut:stay!.checkOut,
   }),hotelId!,stay!),
  retry:false,staleTime:0,
 });
}
export function useLiveRoomQuote(stay:LiveStay|null,ratePlanId:string){
 const {hotelId}=readSession();
 const valid=stay!==null&&validLiveStay(stay)&&id.safeParse(ratePlanId).success;
 return useQuery({
  queryKey:['live','room-quote',hotelId,stay?.roomTypeId,stay?.checkIn,stay?.checkOut,ratePlanId],
  enabled:!!hotelId&&valid,
  queryFn:async()=>parseQuote(await getJson<unknown>(
   hotelPath('/room-quotes'),{
    roomTypeId:stay!.roomTypeId,ratePlanId,
    checkIn:stay!.checkIn,checkOut:stay!.checkOut,
   }),stay!,ratePlanId),
  retry:false,staleTime:0,
 });
}


/** Fetch one booking without relying on the currently loaded reservation page. */
export function parseReservationDetail(value:unknown,hotelId:string,bookingId:string):LiveRecord{
 const result=z.object({data:record}).parse(value).data;
 if(result.hotelId!==hotelId||result.id!==bookingId)
  throw new Error('The reservation belongs to another hotel or does not match the requested booking.');
 return result;
}
export function useLiveReservationDetail(bookingId:string|null){
 const {hotelId}=readSession();
 return useQuery({
  queryKey:['live','reservation-detail',hotelId,bookingId],
  enabled:!!hotelId&&!!bookingId&&id.safeParse(bookingId).success,
  queryFn:async()=>parseReservationDetail(await getJson<unknown>(
   hotelPath('/reservation-records/'+encodeURIComponent(bookingId!))
  ),hotelId!,bookingId!),
  retry:false,staleTime:0,
 });
}
