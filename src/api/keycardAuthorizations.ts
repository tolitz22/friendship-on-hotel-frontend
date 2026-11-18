import {useQuery} from '@tanstack/react-query';
import {z} from 'zod';
import {getJson,requestJson} from './http';
import {hotelPath,readSession} from './session';

const id=z.string().regex(/^[1-9]\d*$/);
const auth=z.object({
 id,hotelId:id,bookingId:id.nullable(),roomId:id,
 kind:z.enum(['initial','replacement','emergency_access']),
 status:z.enum(['pending_manager','authorized_mock','rejected','revoked']),
 provider:z.literal('mock'),providerReference:z.string().nullable(),
 physicalCardEncoded:z.literal(false),requestedBy:id,
 reviewedBy:id.nullable(),revokedBy:id.nullable(),
 reason:z.string(),reviewNote:z.string().nullable(),revocationNote:z.string().nullable(),
 validFrom:z.string(),validUntil:z.string(),createdAt:z.string(),
 reviewedAt:z.string().nullable(),revokedAt:z.string().nullable(),
});
const list=z.object({data:z.array(auth),meta:z.object({
 page:z.number().int().positive(),perPage:z.number().int().positive(),
 total:z.number().int().nonnegative(),totalPages:z.number().int().nonnegative(),
})});
const eventSchema=z.object({id,actorId:id,actorName:z.string().nullable().optional(),event:z.string(),details:z.unknown(),createdAt:z.string()});
export type KeycardAuthorization=z.infer<typeof auth>;
export type KeycardKind=KeycardAuthorization['kind'];
export function parseKeycards(value:unknown,hotelId:string,bookingId?:string){
 const data=list.parse(value);
 if(data.data.some(x=>x.hotelId!==hotelId || (bookingId!==undefined&&x.bookingId!==bookingId)))
  throw new Error('Keycard authorization results belong to another hotel or booking.');
 return data;
}
export function useKeycardAuthorizations(enabled:boolean,page=1,status?:KeycardAuthorization['status'],bookingId?:string){
 const {hotelId}=readSession();
 return useQuery({
  queryKey:['live','keycard-authorizations',hotelId,page,status,bookingId],
  enabled:!!hotelId&&enabled,
  queryFn:async()=>parseKeycards(await getJson<unknown>(hotelPath('/keycard-authorizations'),{
   page,per_page:20,status,bookingId,
  }),hotelId!,bookingId),
  retry:false,
 });
}
export async function createKeycardRequest(hotelId:string,payload:{
 idempotencyKey:string;kind:KeycardKind;reason:string;bookingId?:number;roomId?:number;
}){
 if(readSession().hotelId!==hotelId)throw new Error('Selected hotel changed.');
 const result=z.object({data:auth}).parse(await requestJson<unknown>(
  hotelPath('/keycard-authorizations'),{method:'POST',body:payload}
 )).data;
 if(result.hotelId!==hotelId)throw new Error('Wrong hotel in keycard authorization response.');
 return result;
}
export async function reviewKeycard(hotelId:string,authorizationId:string,decision:'approve'|'reject',note:string){
 if(readSession().hotelId!==hotelId)throw new Error('Selected hotel changed.');
 const result=z.object({data:auth}).parse(await requestJson<unknown>(
  hotelPath('/keycard-authorizations/'+encodeURIComponent(authorizationId)+'/review'),
  {method:'POST',body:{decision,note}}
 )).data;
 if(result.hotelId!==hotelId||result.id!==authorizationId)throw new Error('Review response belongs to a different authorization.');
 return result;
}
export async function revokeKeycard(hotelId:string,authorizationId:string,note:string){
 if(readSession().hotelId!==hotelId)throw new Error('Selected hotel changed.');
 const result=z.object({data:auth}).parse(await requestJson<unknown>(
  hotelPath('/keycard-authorizations/'+encodeURIComponent(authorizationId)+'/revoke'),
  {method:'POST',body:{note}}
 )).data;
 if(result.hotelId!==hotelId||result.id!==authorizationId)throw new Error('Revocation response belongs to a different authorization.');
 return result;
}
export async function keycardHistory(hotelId:string,authorizationId:string){
 if(readSession().hotelId!==hotelId)throw new Error('Selected hotel changed.');
 return z.object({data:z.array(eventSchema)}).parse(await getJson<unknown>(
  hotelPath('/keycard-authorizations/'+encodeURIComponent(authorizationId)+'/history')
 ));
}
