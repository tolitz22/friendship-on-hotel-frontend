import {queryOptions,useQuery} from '@tanstack/react-query';
import {z} from 'zod';
import {getJson} from './http';
import {hotelPath,readSession} from './session';

const minor=z.number().int().refine(Number.isSafeInteger);
const nonnegativeMinor=z.number().int().nonnegative().refine(Number.isSafeInteger);
const movements=z.object({
 deposits:nonnegativeMinor,fees:minor,allocations:nonnegativeMinor,refunds:nonnegativeMinor,
});
const balances=z.object({depositLiabilityMinor:minor,receivableMinor:minor});
const schema=z.object({
 bookingId:z.string(),currency:z.literal('PHP'),businessDate:z.iso.date().nullable(),
 scope:z.literal('current_no_show_matched_journals_only'),
 expectedMinor:movements,matchedJournalMinor:movements,
 expectedBalances:balances,matchedJournalBalances:balances,
 issues:z.array(z.object({kind:z.string(),reference:z.string(),reason:z.string(),journalIds:z.array(z.string()).optional()})),
 journalTrace:z.array(z.object({kind:z.string(),reference:z.string(),amountMinor:minor,journalIds:z.array(z.string()),status:z.string()})).optional(),
 reconciled:z.boolean(),settled:z.boolean(),readOnly:z.literal(true),closingCertified:z.literal(false),
}).superRefine((data,ctx)=>{
 const keys=['deposits','fees','allocations','refunds'] as const;
 for(const [amounts,result] of [[data.expectedMinor,data.expectedBalances],[data.matchedJournalMinor,data.matchedJournalBalances]] as const){
  if(result.depositLiabilityMinor!==amounts.deposits-amounts.allocations-amounts.refunds
   ||result.receivableMinor!==amounts.fees-amounts.allocations)
   ctx.addIssue({code:'custom',message:'Reconciliation balances do not match movements.'});
 }
 if(data.reconciled&&(data.issues.length>0||keys.some(key=>data.expectedMinor[key]!==data.matchedJournalMinor[key])))
  ctx.addIssue({code:'custom',message:'Reconciliation status conflicts with reported discrepancies.'});
 if(data.settled&&(!data.reconciled||data.expectedBalances.receivableMinor!==0||data.expectedBalances.depositLiabilityMinor!==0))
  ctx.addIssue({code:'custom',message:'Settlement status conflicts with outstanding balances.'});
});
export type NoShowLedgerReconciliation=z.infer<typeof schema>;

export function parseNoShowLedgerReconciliation(payload:unknown,bookingId:string):NoShowLedgerReconciliation{
 const data=z.object({data:schema}).parse(payload).data;
 if(data.bookingId!==bookingId)throw new Error('Reconciliation does not match the selected booking.');
 return data;
}

export function noShowLedgerReconciliationOptions(hotelId:string,bookingId:string,userId:string,enabled:boolean){
 return queryOptions({
  queryKey:['live','no-show-ledger-reconciliation',hotelId,bookingId,userId],
  enabled:enabled&&!!userId&&!!hotelId&&/^\d+$/.test(bookingId),
  retry:false,staleTime:0,gcTime:0,
  queryFn:async()=>{
   if(readSession().hotelId!==hotelId)throw new Error('Hotel context changed.');
   const payload=await getJson<unknown>(hotelPath('/bookings/'+encodeURIComponent(bookingId)+'/no-show-ledger-reconciliation'));
   if(readSession().hotelId!==hotelId)throw new Error('Hotel context changed.');
   return parseNoShowLedgerReconciliation(payload,bookingId);
  },
 });
}

export function useNoShowLedgerReconciliation(hotelId:string,bookingId:string,userId:string,enabled:boolean){
 return useQuery(noShowLedgerReconciliationOptions(hotelId,bookingId,userId,enabled));
}
