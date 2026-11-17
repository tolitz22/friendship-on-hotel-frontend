import {useQuery} from '@tanstack/react-query';
import {z} from 'zod';
import {getJson,requestJson} from './http';
import {hotelPath,readSession} from './session';
import {parseNightAudit} from './nightAuditPreview';

const id=z.string().regex(/^[1-9]\d*$/);
const review=z.object({
 id,hotelId:id,businessDate:z.iso.date(),status:z.enum(['reviewed','flagged']),
 managerNote:z.string(),reviewedBy:id,reviewedAt:z.string(),
 snapshotSha256:z.string().regex(/^[a-f0-9]{64}$/),
 snapshot:z.unknown(),
 financialDayClosed:z.literal(false),
 ledgerLocked:z.literal(false),
 taxesCalculated:z.literal(false),
 gatewaySettlementVerified:z.literal(false),
});
export type NightAuditReview=z.infer<typeof review>;
export function parseNightAuditReview(value:unknown,hotelId:string,date:string){
 const result=z.object({data:review.nullable()}).parse(value).data;
 if(result&&(result.hotelId!==hotelId||result.businessDate!==date))
  throw new Error('Night audit review does not belong to this hotel or date.');
 if(result){
  const snap=parseNightAudit({data:result.snapshot},hotelId,date);
  if((result.status==='reviewed')!==snap.preflightClear)
   throw new Error('Night audit review decision contradicts its recorded snapshot.');
 }
 return result;
}
export function useNightAuditReview(date:string,enabled:boolean){
 const {hotelId}=readSession();
 return useQuery({
  queryKey:['live','night-audit-review',hotelId,date],
  enabled:enabled&&!!hotelId&&/^\d{4}-\d{2}-\d{2}$/.test(date),
  queryFn:async()=>parseNightAuditReview(await getJson<unknown>(
   hotelPath('/night-audit/review'),{date}),hotelId!,date),
  retry:false,
 });
}
export async function createNightAuditReview(hotelId:string,date:string,input:{
 decision:'clear'|'flag';note:string;acknowledged:true;
}){
 if(readSession().hotelId!==hotelId)throw new Error('The hotel selection changed.');
 return parseNightAuditReview(await requestJson<unknown>(
  hotelPath('/night-audit/review'),{method:'POST',body:{...input,date}}
 ),hotelId,date);
}
