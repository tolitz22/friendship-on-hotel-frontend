import {useQuery} from '@tanstack/react-query';
import {z} from 'zod';
import {getJson,requestJson} from './http';
import {hotelPath,readSession} from './session';

const id=z.string().regex(/^[1-9]\d*$/);
const approval=z.object({
 id,hotelId:id,bookingId:id,requestedBy:id,reviewedBy:id.nullable(),executedBy:id.nullable(),
 action:z.enum(['cancel_booking','amend_dates','early_check_in','early_check_out']),
 status:z.enum(['pending','rejected','executed']),
 reason:z.string(),
 // Older Laravel deployments serialize an empty associative payload as [].
 // Accept ONLY the empty legacy representation; malformed nonempty arrays
 // remain invalid rather than silently hiding approval request data.
 payload:z.preprocess(
  raw=>Array.isArray(raw)&&raw.length===0?{}:raw,
  z.object({checkIn:z.string(),checkOut:z.string()}).partial(),
 ),
 snapshot:z.object({checkIn:z.string(),checkOut:z.string(),status:z.string(),
  roomTypeId:id,assignedRoomId:id.nullable()}),
 reviewNote:z.string().nullable(),
 expiresAt:z.string(),createdAt:z.string(),reviewedAt:z.string().nullable(),executedAt:z.string().nullable(),
});
const list=z.object({
 data:z.array(approval),
 meta:z.object({page:z.number().int().positive(),perPage:z.number().int().positive(),
  total:z.number().int().nonnegative(),totalPages:z.number().int().nonnegative()}),
});
const history=z.object({data:z.array(z.object({
 id,event:z.enum(['requested','approved','rejected','executed']),
 actorId:id,actorName:z.string().nullable().optional(),details:z.unknown().nullable(),createdAt:z.string(),
}))});
export type Approval=z.infer<typeof approval>;
export type ApprovalAction=Approval['action'];
export type ApprovalStatus=Approval['status'];
export function parseApprovals(raw:unknown,hotelId:string,bookingId?:string){
 const value=list.parse(raw);
 if(value.data.some(item=>item.hotelId!==hotelId||(bookingId!==undefined&&item.bookingId!==bookingId)))
  throw new Error('An approval record does not belong to the selected hotel or reservation.');
 return value;
}
export function useApprovalRequests(options:{enabled:boolean;bookingId?:string;status?:ApprovalStatus;page?:number}){
 const {hotelId}=readSession();
 return useQuery({
  queryKey:['live','approvals',hotelId,options.bookingId,options.status,options.page??1],
  enabled:!!hotelId&&options.enabled,
  queryFn:async()=>parseApprovals(await getJson<unknown>(hotelPath('/approval-requests'),{
   ...(options.bookingId?{bookingId:options.bookingId}:{}),
   ...(options.status?{status:options.status}:{}),
   page:options.page??1,per_page:20,
  }),hotelId!,options.bookingId),
  retry:false,
 });
}
export async function requestManagerApproval(
 hotelId:string,bookingId:string,
 input:{idempotencyKey:string;action:ApprovalAction;reason:string;checkIn?:string;checkOut?:string},
){
 if(readSession().hotelId!==hotelId)throw new Error('Selected property changed.');
 const result=z.object({data:approval}).parse(await requestJson<unknown>(
  hotelPath('/bookings/'+encodeURIComponent(bookingId)+'/approval-requests'),
  {method:'POST',body:input},
 )).data;
 if(result.hotelId!==hotelId||result.bookingId!==bookingId)
  throw new Error('Approval confirmation does not match the selected reservation.');
 return result;
}
export async function reviewManagerApproval(hotelId:string,approvalId:string,decision:'approve'|'reject',note?:string){
 if(readSession().hotelId!==hotelId)throw new Error('Selected property changed.');
 const result=z.object({data:approval}).parse(await requestJson<unknown>(
  hotelPath('/approval-requests/'+encodeURIComponent(approvalId)+'/review'),
  {method:'POST',body:{decision,note:note||undefined}},
 )).data;
 if(result.hotelId!==hotelId||result.id!==approvalId)
  throw new Error('Approval review response is for a different request.');
 return result;
}
export async function getApprovalHistory(hotelId:string,approvalId:string){
 if(readSession().hotelId!==hotelId)throw new Error('Selected property changed.');
 return history.parse(await getJson<unknown>(
  hotelPath('/approval-requests/'+encodeURIComponent(approvalId)+'/history')));
}
