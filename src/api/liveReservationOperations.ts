import {useQuery} from '@tanstack/react-query';
import {z} from 'zod';
import {getJson,requestJson} from './http';
import {hotelPath,readSession} from './session';
import type {LiveRecord} from './liveReservations';

const id=z.string().regex(/^[1-9]\d*$/);
const roomSchema=z.object({
 id,hotelId:id,roomTypeId:id,number:z.string(),
 roomTypeName:z.string(),maxOccupancy:z.number().int().positive(),
 floor:z.number().int().nonnegative().nullable(),
});
const roomsSchema=z.object({
 data:z.array(roomSchema),
 meta:z.object({page:z.number().int().positive(),perPage:z.number().int().positive(),
 total:z.number().int().nonnegative(),totalPages:z.number().int().nonnegative()}),
});
const blockSchema=z.object({
 id,roomId:id,roomTypeId:id,checkIn:z.iso.date(),checkOut:z.iso.date(),
 reason:z.string(),active:z.boolean(),createdBy:id,releasedBy:id.nullable(),
 createdAt:z.string(),updatedAt:z.string(),
});
const blocksSchema=z.object({
 data:z.array(blockSchema),
 meta:z.object({page:z.number().int().positive(),perPage:z.number().int().positive(),
 total:z.number().int().nonnegative(),totalPages:z.number().int().nonnegative()}),
});
const assignSchema=z.object({data:z.object({
 bookingId:id,roomId:id,unchanged:z.boolean(),
})});
const transitionSchema=z.object({data:z.object({
 id,reference:z.string(),status:z.enum(['checked_in','checked_out']),
 assignedRoomId:id.nullable(),
})});

export type LiveRoom=z.infer<typeof roomSchema>;
export type LiveInventoryBlock=z.infer<typeof blockSchema>;
export type Operation='check-in'|'check-out';

function checkHotel(hotelId:string){
 if(readSession().hotelId!==hotelId)throw new Error('Selected hotel changed. Reload reservation operations.');
}

export function parseRooms(value:unknown,hotelId:string,roomTypeId:string){
 const result=roomsSchema.parse(value);
 if(result.data.some(r=>r.hotelId!==hotelId))
  throw new Error('The server returned rooms from another hotel.');
 return {...result,data:result.data.filter(r=>r.roomTypeId===roomTypeId)};
}
export function parseBlocks(value:unknown,roomId:string){
 const result=blocksSchema.parse(value);
 if(result.data.some(r=>r.roomId!==roomId))
  throw new Error('The server returned blocks for a different room.');
 return result;
}
export function hasActiveStayBlock(blocks:LiveInventoryBlock[],stay:Pick<LiveRecord,'checkIn'|'checkOut'>){
 return blocks.some(b=>b.active&&b.checkIn<stay.checkOut&&b.checkOut>stay.checkIn);
}
export function allowedOperation(record:LiveRecord,operation:Operation,today:string):boolean{
 if(operation==='check-in')
  return record.lifecycleState==='confirmed'&&record.assignedRoomId!==null
   &&record.checkIn<=today&&today<record.checkOut;
 return record.lifecycleState==='checked_in'&&today>=record.checkOut;
}
export function parseAssignment(value:unknown,booking:Pick<LiveRecord,'id'>,roomId:string){
 const result=assignSchema.parse(value).data;
 if(result.bookingId!==booking.id||result.roomId!==roomId)
  throw new Error('Room assignment response did not match the requested booking or room.');
 return result;
}
export function parseTransition(value:unknown,record:LiveRecord,operation:Operation){
 const result=transitionSchema.parse(value).data;
 const expected=operation==='check-in'?'checked_in':'checked_out';
 if(result.id!==record.id||result.reference!==record.reference
  ||result.status!==expected||result.assignedRoomId!==record.assignedRoomId)
  throw new Error('Reservation transition response differs from the expected booking. Refresh records.');
 return result;
}

export function useLiveAssignableRooms(record:LiveRecord|null,page:number){
 const {hotelId}=readSession();
 return useQuery({
  queryKey:['live','assignable-rooms',hotelId,record?.roomTypeId,page],
  enabled:!!hotelId&&!!record&&record.lifecycleState==='confirmed',
  queryFn:async()=>parseRooms(await getJson<unknown>(hotelPath('/rooms'),{
   page,per_page:100,
  }),hotelId!,record!.roomTypeId),
  retry:false,
 });
}
export function useLiveRoomBlocks(roomId:string|null){
 const {hotelId}=readSession();
 return useQuery({
  queryKey:['live','room-blocks',hotelId,roomId],
  enabled:!!hotelId&&!!roomId,
  queryFn:async()=>parseBlocks(await getJson<unknown>(hotelPath('/inventory-blocks'),{
   roomId:roomId!,per_page:100,
  }),roomId!),
  retry:false,
 });
}

export async function assignLiveRoom(hotelId:string,record:LiveRecord,roomId:string){
 checkHotel(hotelId);
 if(record.lifecycleState!=='confirmed')throw new Error('Only confirmed reservations can receive an assignment.');
 if(!id.safeParse(roomId).success)throw new Error('Select a valid physical room.');
 const response=await requestJson<unknown>(
  hotelPath('/bookings/'+encodeURIComponent(record.id)+'/assign-room'),
  {method:'PATCH',body:{roomId:Number(roomId)}}
 );
 return parseAssignment(response,record,roomId);
}
export async function transitionLiveStay(hotelId:string,record:LiveRecord,operation:Operation){
 checkHotel(hotelId);
 const response=await requestJson<unknown>(
  hotelPath('/bookings/'+encodeURIComponent(record.id)+'/'+operation),
  {method:'POST'}
 );
 return parseTransition(response,record,operation);
}
