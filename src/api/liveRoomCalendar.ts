import {useQuery} from '@tanstack/react-query';
import {z} from 'zod';
import {getJson} from './http';
import {hotelPath,readSession} from './session';

const id=z.string().regex(/^[1-9]\d*$/);
const day=z.iso.date();
const resultSchema=z.object({
 data:z.object({
  hotelId:id,start:day,end:day,
  rooms:z.array(z.object({id,number:z.string(),floor:z.number().nullable(),roomTypeId:id,roomTypeName:z.string()})),
  bookings:z.array(z.object({id,reference:z.string(),roomId:id,checkIn:day,checkOut:day,status:z.string().nullable()})),
  blocks:z.array(z.object({id,roomId:id,checkIn:day,checkOut:day,reason:z.string()})),
  unassignedBookings:z.number().int().nonnegative(),
 }),
 meta:z.object({page:z.number().int().positive(),perPage:z.number().int().positive(),
  total:z.number().int().nonnegative(),totalPages:z.number().int().nonnegative(),
  readOnly:z.literal(true),checkoutDateExclusive:z.literal(true),
  isActualPhysicalOccupancyEvidence:z.literal(false)}),
});
export type RoomCalendarData=z.infer<typeof resultSchema>['data'];
export function useRoomCalendar(params:{
 start:string;end:string;page:number;floor:string;roomTypeId:string;search:string;
}){
 const {hotelId}=readSession();
 return useQuery({
  queryKey:['live','room-calendar',hotelId,params],
  enabled:!!hotelId,
  queryFn:async()=>{
   const response=resultSchema.parse(await getJson<unknown>(hotelPath('/room-calendar'),{
    start:params.start,end:params.end,page:params.page,per_page:30,
    floor:params.floor==='all'?undefined:params.floor,
    room_type_id:params.roomTypeId||undefined,
    search:params.search.trim()||undefined,
   }));
   if(response.data.hotelId!==hotelId||response.data.start!==params.start||response.data.end!==params.end)
    throw new Error('Room calendar returned data for another property or date range.');
   const selected=new Set(response.data.rooms.map(r=>r.id));
   if(response.data.bookings.some(r=>!selected.has(r.roomId))
    ||response.data.blocks.some(r=>!selected.has(r.roomId)))
    throw new Error('Room calendar contains records outside the selected rooms.');
   return response;
  },
  retry:false,staleTime:0,
 });
}
