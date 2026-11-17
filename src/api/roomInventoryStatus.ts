import {useQuery} from '@tanstack/react-query';
import {z} from 'zod';
import {getJson} from './http';
import {hotelPath,readSession} from './session';

const id=z.string().regex(/^[1-9]\d*$/);
const optionalId=id.nullable();
const roomStatus=z.object({
 roomId:id,roomNumber:z.string(),
 occupancy:z.enum(['vacant','occupied','due_for_checkout']),
 activeStayId:optionalId,
 cleaning:z.enum([
  'checkout_cleaning','cleaning_in_progress','awaiting_inspection','ready','not_verified',
 ]),
 turnoverTaskId:optionalId,
 turnoverStatus:z.enum(['todo','in_progress','done']).nullable(),
 assignedHousekeeperId:optionalId,assignedHousekeeperName:z.string().nullable(),
 cleanedById:optionalId,cleanedByName:z.string().nullable(),
 cleanedAt:z.string().nullable(),
 inspectionId:optionalId,
 inspectionStatus:z.enum(['submitted','approved','rejected']).nullable(),
 inspectedById:optionalId,inspectedByName:z.string().nullable(),
 inspectedAt:z.string().nullable(),
 reviewedById:optionalId,reviewedByName:z.string().nullable(),
 reviewedAt:z.string().nullable(),
 advisoryReady:z.boolean(),maintenanceBlocked:z.boolean(),inventoryBlockedToday:z.boolean(),
});
const response=z.object({
 data:z.array(roomStatus),
 meta:z.object({hotelId:id,hotelDate:z.iso.date(),
  snapshotOnly:z.literal(true),advisoryOnly:z.literal(true),
  physicalOccupancyVerified:z.literal(false)}),
});
export type InventoryRoomStatus=z.infer<typeof roomStatus>;
export function parseRoomInventoryStatus(raw:unknown,hotelId:string,ids:string[]){
 const result=response.parse(raw);
 if(result.meta.hotelId!==hotelId||result.data.length!==ids.length||
   result.data.some(row=>!ids.includes(row.roomId))||
   new Set(result.data.map(row=>row.roomId)).size!==ids.length)
  throw new Error('Room inventory status is incomplete or belongs to another hotel or room.');
 if(result.data.some(row=>
  (row.occupancy==='vacant')!== (row.activeStayId===null)||
  (row.cleaning==='ready'&&(!row.advisoryReady||row.maintenanceBlocked||row.inventoryBlockedToday))||
  (row.cleaning==='checkout_cleaning'&&row.turnoverStatus!=='todo')||
  (row.cleaning==='cleaning_in_progress'&&row.turnoverStatus!=='in_progress')))
  throw new Error('Room inventory status contradicts its underlying housekeeping or occupancy records.');
 return result;
}
export function useRoomInventoryStatus(ids:string[],enabled:boolean){
 const {hotelId}=readSession();
 return useQuery({
  queryKey:['live','room-inventory-status',hotelId,ids.join(',')],
  enabled:!!hotelId&&enabled&&ids.length>0&&ids.length<=100,
  queryFn:async()=>parseRoomInventoryStatus(await getJson<unknown>(
   hotelPath('/room-inventory-status'),{room_ids:ids.join(',')}
  ),hotelId!,ids),
  retry:false,staleTime:0,
 });
}
export const cleaningLabel=(status:InventoryRoomStatus['cleaning'])=>({
 checkout_cleaning:'Checkout cleaning required',
 cleaning_in_progress:'Cleaning in progress',
 awaiting_inspection:'Cleaned · awaiting inspection',
 ready:'Clean · inspection approved',
 not_verified:'Readiness not verified',
})[status];
export const occupancyLabel=(status:InventoryRoomStatus['occupancy'])=>({
 vacant:'Vacant in PMS',
 occupied:'Occupied in PMS',
 due_for_checkout:'Due for checkout today',
})[status];
