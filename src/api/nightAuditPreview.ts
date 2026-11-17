import {useQuery} from '@tanstack/react-query';
import {z} from 'zod';
import {getJson} from './http';
import {hotelPath,readSession} from './session';

const id=z.string().regex(/^[1-9]\d*$/);
const problem=z.object({bookingId:id,reference:z.string(),reason:z.string().optional()});
const dataSchema=z.object({
 hotelId:id,businessDate:z.iso.date(),hotelDate:z.iso.date(),currency:z.string().length(3),
 roomCount:z.number().int().nonnegative(),
 scheduledRoomNights:z.number().int().nonnegative(),
 currentCheckedInOnScheduledDate:z.number().int().nonnegative(),
 pricedRoomNights:z.number().int().nonnegative(),
 postedRoomChargesMinor:z.number().int().nonnegative(),
 missingNightEntries:z.array(problem),duplicateNightEntries:z.array(problem),
 unpricedBookings:z.array(problem),openCashierShifts:z.number().int().nonnegative(),
 unreconciledCashierShifts:z.number().int().nonnegative(),
 pendingPaymentEvidence:z.number().int().nonnegative(),
 issues:z.array(z.string()),preflightClear:z.boolean(),
 roomEntriesAlreadyPostedAtBooking:z.literal(true),
 financialDayClosed:z.literal(false),
 bankOrGatewayVerified:z.literal(false),
 historicalOccupancyVerified:z.literal(false),
 taxesCalculated:z.literal(false),
});
export type NightAuditPreview=z.infer<typeof dataSchema>;
export function parseNightAudit(value:unknown,hotelId:string,date:string){
 const parsed=z.object({data:dataSchema}).parse(value).data;
 if(parsed.hotelId!==hotelId||parsed.businessDate!==date)throw new Error('Night audit preflight has unexpected hotel or date.');
 if(parsed.pricedRoomNights>parsed.scheduledRoomNights||
  parsed.currentCheckedInOnScheduledDate>parsed.scheduledRoomNights||
  (parsed.preflightClear&&parsed.issues.length>0))
  throw new Error('Night audit preflight returned inconsistent totals.');
 return parsed;
}
export function useNightAuditPreview(date:string,enabled:boolean){
 const {hotelId}=readSession();
 return useQuery({
  queryKey:['live','night-audit-preview',hotelId,date],
  enabled:enabled&&!!hotelId&&/^\d{4}-\d{2}-\d{2}$/.test(date),
  queryFn:async()=>parseNightAudit(await getJson<unknown>(
   hotelPath('/night-audit/preview'),{date}
  ),hotelId!,date),retry:false,
 });
}
