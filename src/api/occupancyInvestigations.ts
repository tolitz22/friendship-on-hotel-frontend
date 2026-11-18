import {useQuery} from '@tanstack/react-query';
import {z} from 'zod';
import {getJson,requestJson} from './http';
import {hotelPath,readSession} from './session';

const id=z.string().regex(/^[1-9]\d*$/);
const event=z.object({id,actorId:id,actorName:z.string().nullable(),event:z.enum(['opened','finding','reassigned','closed']),
 details:z.record(z.string(),z.unknown()),createdAt:z.string()});
const investigation=z.object({
 id,verificationId:id,status:z.enum(['open','closed']),
 ownerId:id,ownerName:z.string().nullable(),openedBy:id,openedByName:z.string().nullable(),
 closedBy:id.nullable(),closedByName:z.string().nullable(),
 resolution:z.enum(['registration_corrected','observation_unconfirmed','authorized_stay_confirmed','escalated_elsewhere']).nullable(),
 closingNote:z.string().nullable(),createdAt:z.string(),closedAt:z.string().nullable(),
 discrepancy:z.enum(['unverified','match','unexpected_occupied','expected_occupied_vacant']).nullable(),
 history:z.array(event),
});
export type OccupancyInvestigation=z.infer<typeof investigation>;
export const resolutions=[
 {value:'registration_corrected',label:'Registration record corrected separately'},
 {value:'observation_unconfirmed',label:'Observation could not be confirmed'},
 {value:'authorized_stay_confirmed',label:'Authorized stay confirmed'},
 {value:'escalated_elsewhere',label:'Referred to separate management process'},
] as const;

function assertHotel(hotelId:string){if(readSession().hotelId!==hotelId)throw Error('Hotel selection changed. Refresh before continuing.');}
function path(idValue:string){return hotelPath('/occupancy-verifications/'+encodeURIComponent(idValue)+'/investigation');}
function parseCase(value:unknown){return z.object({data:investigation.nullable()}).parse(value).data;}
export function useOccupancyInvestigation(enabled:boolean,hotelId:string|null|undefined,verificationId:string){
 return useQuery({queryKey:['occupancy-investigation',hotelId,verificationId],
  enabled:enabled&&!!hotelId,queryFn:async()=>parseCase(await getJson<unknown>(path(verificationId))),retry:false});
}
export async function openOccupancyInvestigation(hotelId:string,verificationId:string,ownerId:string,note:string){
 assertHotel(hotelId);
 return parseCase(await requestJson<unknown>(path(verificationId),{method:'POST',body:{ownerId,note}}));
}
export async function updateOccupancyInvestigation(hotelId:string,verificationId:string,input:{
 action:'note'|'assign'|'close';note:string;ownerId?:string;resolution?:string;evidenceReference?:string;
}){
 assertHotel(hotelId);
 return parseCase(await requestJson<unknown>(path(verificationId)+'/action',{method:'POST',body:input}));
}
