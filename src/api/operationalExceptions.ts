import {useQuery} from '@tanstack/react-query';
import {z} from 'zod';
import {getJson} from './http';
import {hotelPath,readSession} from './session';

const positiveId=z.string().regex(/^[1-9][0-9]*$/);
const item=z.object({
 id:z.string(),type:z.enum(['unassigned_arrival','in_house_without_room','assigned_room_overlap','payment_pending_review','room_inspection_review','occupancy_review','occupancy_investigation','cashier_shift_review']),
 severity:z.enum(['critical','attention','review']),
 bookingId:positiveId.nullable(),roomId:positiveId.nullable().optional(),checkDate:z.iso.date().optional(),
 ownerName:z.string().nullable().optional(),reference:z.string(),reason:z.string(),suggestion:z.string(),recordDate:z.string(),
});
const activity=z.object({
 id:positiveId,bookingId:positiveId,reference:z.string(),
 actorId:positiveId,actorName:z.string().nullable().optional(),eventType:z.string(),createdAt:z.string(),
});
const schema=z.object({
 data:z.object({
  hotelId:positiveId,asOfHotelDate:z.iso.date(),windowEndExclusive:z.iso.date(),
  summary:z.object({total:z.number().int().nonnegative(),critical:z.number().int().nonnegative(),
   attention:z.number().int().nonnegative(),review:z.number().int().nonnegative()}),
  items:z.array(item),activity:z.array(activity),
 }),
 meta:z.object({
  readOnly:z.literal(true),complete:z.literal(true),isFraudDetermination:z.literal(false),
  keycardLogsConnected:z.literal(false),cctvEventsConnected:z.literal(false),
  housekeepingPhysicalOccupancyConnected:z.literal(false),
  sourceLimit:z.number().int().positive(),notes:z.string(),
 }),
});
export type OperationalException=z.infer<typeof item>;
export type OperationalExceptionResponse=z.infer<typeof schema>;
export function parseOperationalExceptions(value:unknown,hotelId:string){
 const parsed=schema.parse(value);
 if(parsed.data.hotelId!==hotelId)throw new Error('Exception report belongs to another hotel.');
 const counts=parsed.data.items.reduce((acc,record)=>{
  acc[record.severity]++;
  return acc;
 },{critical:0,attention:0,review:0});
 if(parsed.data.summary.total!==parsed.data.items.length
  ||counts.critical!==parsed.data.summary.critical
  ||counts.attention!==parsed.data.summary.attention
  ||counts.review!==parsed.data.summary.review){
  throw new Error('Exception report totals do not match the returned records.');
 }
 return parsed;
}
export function useOperationalExceptions(days:number,enabled=true){
 const {hotelId}=readSession();
 return useQuery({
  queryKey:['live','operational-exceptions',hotelId,days],
  enabled:enabled&&!!hotelId&&days>=1&&days<=14,
  queryFn:()=>getJson<unknown>(hotelPath('/operational-exceptions'),{days})
   .then(value=>parseOperationalExceptions(value,hotelId!)),
  retry:false,refetchInterval:60000,refetchIntervalInBackground:false,
 });
}
