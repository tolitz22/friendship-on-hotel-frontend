import {useQuery} from '@tanstack/react-query';
import {z} from 'zod';
import {getJson,requestJson} from './http';
import {hotelPath,readSession} from './session';

const id=z.string().regex(/^[1-9]\d*$/);
const inspection=z.object({
 id,roomId:id,revision:z.number().int().positive(),
 status:z.enum(['submitted','approved','rejected']),
 checks:z.object({
  cleaningVerified:z.boolean(),safetyVerified:z.boolean(),
  amenitiesVerified:z.boolean(),
 }),
 inspectorNote:z.string(),inspectedBy:id,
 reviewedBy:id.nullable(),reviewNote:z.string().nullable(),
 createdAt:z.string(),
});
const readiness=z.object({data:z.object({
 hotelId:id,roomId:id,inspection:inspection.nullable(),
 blockers:z.object({
  activeInventoryBlockToday:z.boolean(),
  activeRoomImpactMaintenance:z.boolean(),
  latestTurnoverIncomplete:z.boolean(),
  newTurnoverSinceInspection:z.boolean(),
 }),
 advisoryReady:z.boolean(),
 enforcedAtCheckIn:z.boolean(),
 inventoryGuaranteed:z.literal(false),
})});
const events=z.object({
 data:z.array(z.object({
  id,inspectionId:id,actorId:id,action:z.enum(['submitted','approved','rejected']),
  details:z.record(z.string(),z.unknown()),createdAt:z.string(),
 })),
 meta:z.object({
  page:z.number().int().positive(),perPage:z.number().int().positive(),
  total:z.number().int().nonnegative(),totalPages:z.number().int().nonnegative(),
 }),
});
export type LiveReadiness=z.infer<typeof readiness>['data'];
export type InspectionInput={
 cleaningVerified:boolean;safetyVerified:boolean;amenitiesVerified:boolean;note:string;
};
export type ReviewInput={expectedRevision:number;decision:'approve'|'reject';note:string};
export function parseReadiness(value:unknown,hotelId:string,roomId:string){
 const data=readiness.parse(value).data;
 if(data.hotelId!==hotelId||data.roomId!==roomId
  ||(data.inspection!==null&&data.inspection.roomId!==roomId))
  throw new Error('Room-readiness response does not match the selected hotel or room.');
 if(data.advisoryReady&&(
  data.inspection?.status!=='approved'||Object.values(data.blockers).some(Boolean)))
  throw new Error('Room-readiness approval contradicts the reported blockers.');
 return data;
}
export function parseReadinessEvents(value:unknown){return events.parse(value);}
export function useLiveReadiness(roomId:string|null){
 const {hotelId}=readSession();
 return useQuery({
  queryKey:['live','room-readiness',hotelId,roomId],
  enabled:!!hotelId&&!!roomId,
  queryFn:async()=>parseReadiness(await getJson<unknown>(
   hotelPath('/rooms/'+encodeURIComponent(roomId!)+'/readiness')
  ),hotelId!,roomId!),
  retry:false,staleTime:0,
 });
}
export function useLiveReadinessHistory(roomId:string|null,page:number){
 const {hotelId}=readSession();
 return useQuery({
  queryKey:['live','room-readiness-history',hotelId,roomId,page],
  enabled:!!hotelId&&!!roomId,
  queryFn:async()=>parseReadinessEvents(await getJson<unknown>(
   hotelPath('/rooms/'+encodeURIComponent(roomId!)+'/readiness/history'),{page}
  )),retry:false,
 });
}
function confirmHotel(hotelId:string){
 if(readSession().hotelId!==hotelId)throw new Error('Selected hotel changed. Reload the room before continuing.');
}
export async function submitRoomInspection(hotelId:string,roomId:string,body:InspectionInput){
 confirmHotel(hotelId);
 return parseReadiness(await requestJson<unknown>(
  hotelPath('/rooms/'+encodeURIComponent(roomId)+'/readiness/inspections'),
  {method:'POST',body}
 ),hotelId,roomId);
}
export async function reviewRoomInspection(hotelId:string,roomId:string,inspectionId:string,body:ReviewInput){
 confirmHotel(hotelId);
 return parseReadiness(await requestJson<unknown>(
  hotelPath('/rooms/'+encodeURIComponent(roomId)+'/readiness/inspections/'+encodeURIComponent(inspectionId)+'/review'),
  {method:'POST',body}
 ),hotelId,roomId);
}
