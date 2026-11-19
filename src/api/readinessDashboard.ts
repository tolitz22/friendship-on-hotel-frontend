import {useQuery} from '@tanstack/react-query';
import {z} from 'zod';
import {getJson} from './http';
import {hotelPath,readSession} from './session';

const id=z.string().regex(/^[1-9]\d*$/);
const day=z.iso.date();
const count=z.number().int().nonnegative();
const blockerFlags=z.object({
 activeInventoryBlockToday:z.boolean(),
 activeRoomImpactMaintenance:z.boolean(),
 latestTurnoverIncomplete:z.boolean(),
 newTurnoverSinceInspection:z.boolean(),
 unfinishedHousekeeping:z.boolean(),
 newRoomWorkSinceInspection:z.boolean(),
});
const roomStatus=z.enum(['needs_inspection','awaiting_review','approved_current','blocked_or_stale']);
const report=z.object({
 data:z.object({
  hotelId:id,
  asOfHotelDate:day,
  arrivalWindowDays:z.number().int().min(1).max(14),
  arrivalWindowEndExclusive:day,
  enforceAtCheckIn:z.boolean(),
  summary:z.object({
   totalRooms:count,approvedCurrent:count,awaitingReview:count,
   needsInspection:count,blockedOrStale:count,
  }),
  rooms:z.array(z.object({
   roomId:id,roomNumber:z.string(),roomTypeId:id,status:roomStatus,
   latestInspectionId:id.nullable(),
   openHousekeepingTaskId:id.nullable(),activeMaintenanceOrderId:id.nullable(),
   activeInventoryBlockId:id.nullable(),
   inspectionStatus:z.enum(['submitted','approved','rejected']).nullable(),
   blockers:blockerFlags,
  })),
  arrivals:z.array(z.object({
   bookingId:id,reference:z.string(),guestName:z.string().nullable(),checkIn:day,checkOut:day,
   assignedRoomId:id.nullable(),roomNumber:z.string().nullable(),
   risk:z.enum([
    'unassigned_room','room_record_missing',
    'no_current_readiness_issue','inspection_or_blocker',
   ]),
   roomStatus:roomStatus.nullable(),roomBlockers:blockerFlags.nullable(),
   openHousekeepingTaskId:id.nullable(),activeMaintenanceOrderId:id.nullable(),
   activeInventoryBlockId:id.nullable(),
  })),
 }),
 meta:z.object({
  roomPage:z.number().int().positive(),
  roomPerPage:z.number().int().positive(),
  roomTotalPages:count,arrivalTotal:count,
  snapshotOnly:z.literal(true),
  futureRoomReadinessGuaranteed:z.literal(false),
  inventoryGuaranteed:z.literal(false),
  guestOrPaymentVerified:z.literal(false),
 }),
});
export type ReadinessDashboard=z.infer<typeof report>;
export type DashboardRoom=ReadinessDashboard['data']['rooms'][number];
export type DashboardArrival=ReadinessDashboard['data']['arrivals'][number];

export function parseReadinessDashboard(value:unknown,hotelId:string,days:number,page:number){
 const result=report.parse(value);
 const {data,meta}=result;
 const s=data.summary;
 if(data.hotelId!==hotelId||data.arrivalWindowDays!==days||meta.roomPage!==page)
  throw new Error('The readiness report was returned for another hotel or reporting window.');
 if(s.totalRooms!==s.approvedCurrent+s.awaitingReview+s.needsInspection+s.blockedOrStale)
  throw new Error('The room readiness summary does not reconcile to its hotel-wide total.');
 if(data.rooms.some(room=>room.status==='approved_current'
   &&(room.inspectionStatus!=='approved'||Object.values(room.blockers).some(Boolean))))
  throw new Error('The server claims a room is ready despite an unapproved or blocked inspection.');
 if(data.arrivals.length!==meta.arrivalTotal)
  throw new Error('Arrival report is incomplete. Do not represent its totals as hotel-wide.');
 if(data.arrivals.some(a=>a.checkIn<data.asOfHotelDate||
  a.checkIn>=data.arrivalWindowEndExclusive))
  throw new Error('Arrivals outside the requested window were returned.');
 return result;
}

export function useReadinessDashboard(days:number,page:number){
 const {hotelId}=readSession();
 return useQuery({
  queryKey:['live','readiness-dashboard',hotelId,days,page],
  enabled:!!hotelId&&Number.isInteger(days)&&days>=1&&days<=14&&page>=1,
  queryFn:async()=>parseReadinessDashboard(await getJson<unknown>(
   hotelPath('/readiness/dashboard'),{
    days,room_page:page,room_per_page:20,
   }
  ),hotelId!,days,page),
  retry:false,staleTime:0,
 });
}
