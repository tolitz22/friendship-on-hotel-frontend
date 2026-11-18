import {useQuery} from '@tanstack/react-query';
import {z} from 'zod';
import {getJson} from './http';
import {hotelPath} from './session';

const nullableInt=z.number().int().nullable();
const schema=z.object({
 hotelId:z.string(),businessDate:z.iso.date(),currency:z.string(),
 nightAudit:z.object({
  status:z.string(),reviewedAt:z.string().nullable(),
  snapshotIntegrityValid:z.boolean(),
  scheduledRoomNights:nullableInt,pricedRoomNights:nullableInt,
  roomCount:nullableInt,postedRoomChargesMinor:nullableInt,
 }),
 financialClose:z.object({
  status:z.string(),closedAt:z.string().nullable(),journalCount:z.number().int(),
  lineCount:z.number().int(),debitsMinor:z.number().int(),
  creditsMinor:z.number().int(),unbalancedJournalCount:z.number().int(),
  snapshotMatchesLedger:z.boolean(),
 }),
 kpis:z.object({
  verifiedOccupiedRoomNights:nullableInt,recognizedRoomRevenueMinor:nullableInt,
  vatLiabilityMovementMinor:nullableInt,adrMinor:nullableInt,revparMinor:nullableInt,
  occupancyPercent:z.number().nullable(),inspectionOccupiedRooms:nullableInt,
  inspectionOccupancyPercent:z.number().nullable(),inspectionRoomCount:z.number().int(),
  inspectionCoverageComplete:z.boolean(),
 }),
 cashier:z.object({
  submittedCount:z.number().int(),reconciledCount:z.number().int(),
  flaggedCount:z.number().int(),pendingCount:z.number().int(),
  varianceMinor:z.number().int(),reconciledCountedCashMinor:z.number().int(),
  scope:z.string(),
 }),
 limitations:z.array(z.string()),blockers:z.array(z.string()),
 financialJournalReconciled:z.boolean(),reportScope:z.string(),
});
export type NightAuditReconciliation=z.infer<typeof schema>;
export function useNightAuditReconciliation(hotelId:string|null,date:string,enabled:boolean){
 return useQuery({
  queryKey:['live','night-audit-reconciliation',hotelId,date],
  enabled:enabled&&!!hotelId&&/^\d{4}-\d{2}-\d{2}$/.test(date),
  retry:false,
  queryFn:async()=>{
   const data=z.object({data:schema}).parse(await getJson<unknown>(
    hotelPath('/finance/night-audit-reconciliation'),{date}
   )).data;
   if(data.hotelId!==hotelId||data.businessDate!==date)
    throw new Error('Report does not match selected property and date.');
   return data;
  },
 });
}
