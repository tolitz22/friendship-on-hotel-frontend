import {useQuery} from '@tanstack/react-query';
import {z} from 'zod';
import {getJson} from './http';
import {hotelPath,readSession} from './session';
const id=z.string().regex(/^[1-9]\d*$/);
const room=z.object({
 roomId:id,roomNumber:z.string(),roomType:z.string(),floor:z.number().int().nonnegative().nullable(),
 occupancy:z.enum(['vacant','occupied','due_for_checkout']),
 stage:z.enum(['blocked','cleaning','dirty','service_due','occupied','ready','inspection_due','unverified']),
 arrivalToday:z.boolean(),maintenanceBlocked:z.boolean(),inventoryBlocked:z.boolean(),
 task:z.object({id,type:z.enum(['checkout_clean','stayover','inspection']),status:z.enum(['todo','in_progress','done']),assignment:z.enum(['mine','other','unassigned'])}).nullable(),
});
const schema=z.object({data:z.object({hotelId:id,userId:id,hotelDate:z.iso.date(),rooms:z.array(room).max(1000)}),
 meta:z.object({total:z.number().int().nonnegative(),snapshotOnly:z.literal(true),physicalOccupancyVerified:z.literal(false)})});
export type HousekeepingBoardRoom=z.infer<typeof room>;
export function parseHousekeepingRoomBoard(value:unknown,hotelId:string,userId:string){
 const result=schema.parse(value);
 if(result.data.hotelId!==hotelId||result.data.userId!==userId||
  result.data.rooms.length!==result.meta.total||new Set(result.data.rooms.map(r=>r.roomId)).size!==result.meta.total||
  result.data.rooms.some(r=>r.stage==='ready'&&(r.occupancy!=='vacant'||r.maintenanceBlocked||r.inventoryBlocked||r.task!==null)||
   (r.maintenanceBlocked||r.inventoryBlocked)!==(r.stage==='blocked')))
  throw new Error('Room board data is incomplete, inconsistent or belongs to another hotel or employee.');
 return result;
}
export function useHousekeepingRoomBoard(hotelId:string,userId:string){
 return useQuery({queryKey:['live','housekeeping-room-board',hotelId,userId],enabled:!!hotelId&&!!userId,
  queryFn:async()=>{
   if(readSession().hotelId!==hotelId)throw new Error('Selected hotel changed.');
   return parseHousekeepingRoomBoard(await getJson<unknown>(hotelPath('/housekeeping/room-board')),hotelId,userId);
  },retry:false,refetchInterval:30000,refetchIntervalInBackground:false,staleTime:0});
}
export const boardStageLabel:Record<HousekeepingBoardRoom['stage'],string>={
 blocked:'Blocked',cleaning:'Cleaning in progress',dirty:'Cleaning required',service_due:'Service due',occupied:'Occupied',ready:'Ready',inspection_due:'Inspection due',unverified:'Readiness unverified',
};
export function groupHousekeepingRooms(rooms:HousekeepingBoardRoom[]){
 const groups=new Map<number|null,HousekeepingBoardRoom[]>();
 for(const room of rooms){const group=groups.get(room.floor)??[];group.push(room);groups.set(room.floor,group);}
 return [...groups.entries()].sort(([a],[b])=>a===null?b===null?0:1:b===null?-1:a-b)
  .map(([floor,items])=>({floor,rooms:items.sort((a,b)=>Number(b.arrivalToday&&b.stage!=='ready')-Number(a.arrivalToday&&a.stage!=='ready')||a.roomNumber.localeCompare(b.roomNumber,undefined,{numeric:true}))}));
}
