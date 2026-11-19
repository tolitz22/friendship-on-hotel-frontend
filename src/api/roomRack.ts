import {useQuery} from '@tanstack/react-query';
import {z} from 'zod';
import {getJson} from './http';
import {hotelPath,readSession} from './session';

const id=z.string().regex(/^[1-9]\\d*$/);
const count=z.number().int().nonnegative();
const date=z.iso.date();
const flags=z.object({
 activeInventoryBlockToday:z.boolean(),
 activeRoomImpactMaintenance:z.boolean(),
 latestTurnoverIncomplete:z.boolean(),
 newTurnoverSinceInspection:z.boolean(),
 unfinishedHousekeeping:z.boolean(),
 newRoomWorkSinceInspection:z.boolean(),
});
const stay=z.object({
 bookingId:id,reference:z.string(),guestName:z.string().nullable(),
 checkIn:date,checkOut:date,
});
const arrival=stay.extend({
 assignedRoomId:id.nullable(),roomNumber:z.string().nullable(),
 risk:z.enum(['unassigned_room','room_record_missing','no_current_readiness_issue','inspection_or_blocker']),
 roomStatus:z.enum(['needs_inspection','awaiting_review','approved_current','blocked_or_stale']).nullable(),
 roomBlockers:flags.nullable(),
 openHousekeepingTaskId:id.nullable(),activeMaintenanceOrderId:id.nullable(),activeInventoryBlockId:id.nullable(),
});
const room=z.object({
 roomId:id,roomNumber:z.string(),roomTypeName:z.string(),roomTypeId:id,
 maxOccupancy:z.number().int().positive(),floor:z.number().int().nullable(),
 occupancy:z.enum(['vacant','occupied','due_for_checkout']),
 cleaning:z.enum(['checkout_cleaning','cleaning_in_progress','awaiting_inspection','ready','not_verified']),
 advisoryReady:z.boolean(),
 inspectionStatus:z.enum(['submitted','approved','rejected']).nullable(),
 inspectionId:id.nullable(),
 readinessStatus:z.enum(['needs_inspection','awaiting_review','approved_current','blocked_or_stale']),
 blockers:flags,
 openHousekeepingTaskId:id.nullable(),activeMaintenanceOrderId:id.nullable(),activeInventoryBlockId:id.nullable(),
 cleanedAt:z.string().nullable(),inspectedAt:z.string().nullable(),reviewedAt:z.string().nullable(),
 currentStay:stay.nullable(),upcomingStay:stay.nullable(),
});
const schema=z.object({
 data:z.object({
  hotelId:id,hotelDate:date,enforcedAtCheckIn:z.boolean(),
  rooms:z.array(room),arrivals:z.array(arrival),
  summary:z.object({
   totalRooms:count,pmsVacantRooms:count,pmsOccupiedRooms:count,
   arrivalsToday:count,departuresToday:count,
   roomsWithOpenHousekeeping:count,inspectionsAwaitingReview:count,activelyBlockedRooms:count,
  }),
 }),
 meta:z.object({
  page:z.number().int().positive(),perPage:z.number().int().positive(),
  total:count,totalPages:count,
  snapshotOnly:z.literal(true),availabilityGuaranteed:z.literal(false),
  physicalOccupancyVerified:z.literal(false),financialSettlementVerified:z.literal(false),
 }),
});
export type RoomRack=z.infer<typeof schema>;
export type RackRoom=RoomRack['data']['rooms'][number];
export type RackArrival=RoomRack['data']['arrivals'][number];

export function parseRoomRack(raw:unknown,hotelId:string,page:number){
 const parsed=schema.parse(raw);
 if(parsed.data.hotelId!==hotelId||parsed.meta.page!==page)
  throw new Error('Room rack response belongs to a different hotel or page.');
 const {rooms,summary}=parsed.data;
 if(new Set(rooms.map(room=>room.roomId)).size!==rooms.length||rooms.length>parsed.meta.perPage)
  throw new Error('Room rack contains duplicated or oversized room data.');
 if(summary.totalRooms!==parsed.meta.total||
  summary.pmsOccupiedRooms+summary.pmsVacantRooms!==summary.totalRooms)
  throw new Error('Hotel-wide PMS occupancy counts did not reconcile.');
 if(rooms.some(room=>
  (room.occupancy==='vacant')!== (room.currentStay===null)||
  (room.advisoryReady&&
    (room.inspectionStatus!=='approved'||Object.values(room.blockers).some(Boolean)))))
  throw new Error('Room rack occupancy or readiness conflicts with the source records.');
 return parsed;
}
export function useRoomRack(page:number,perPage:number,days=7,enabled=true){
 const {hotelId}=readSession();
 return useQuery({
  queryKey:['live','room-rack',hotelId,page,perPage,days],
  enabled:enabled&&!!hotelId,
  queryFn:async()=>parseRoomRack(await getJson<unknown>(
   hotelPath('/rooms/rack'),{page,per_page:perPage,days}
  ),hotelId!,page),
  retry:false,staleTime:0,
 });
}
