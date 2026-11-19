import {useQuery} from '@tanstack/react-query';
import {z} from 'zod';
import {getJson,requestJson} from './http';
import {hotelPath,readSession} from './session';

const id=z.string().regex(/^[1-9]\d*$/);
const amount=z.number().int().refine(Number.isSafeInteger,'Amount exceeds safe integer range');
const currency=z.object({
 currency:z.string(),netRecordedChargesMinor:amount,
 pendingReviewPaymentsMinor:amount,recordedPaymentsMinor:amount,balanceAfterRecordedPaymentsMinor:amount,
 staffConfirmedPaymentsMinor:amount,verifiedAllocatedMinor:amount,
 verifiedGroupPayerAllocatedMinor:amount,unallocatedNetChargesMinor:amount,
 pricedFolioCount:z.number().int().nonnegative(),
});
const room=z.discriminatedUnion('priced',[
 z.object({bookingId:id,reference:z.string(),priced:z.literal(false)}),
 z.object({bookingId:id,reference:z.string(),priced:z.literal(true),
  folioId:id,currency:z.string(),netRecordedChargesMinor:amount,
  pendingReviewPaymentsMinor:amount,recordedPaymentsMinor:amount,balanceAfterRecordedPaymentsMinor:amount,
  pendingReviewPaymentCount:z.number().int().nonnegative(),
  staffConfirmedPaymentCount:z.number().int().nonnegative(),
  independentlyVerifiedPaymentCount:z.number().int().nonnegative(),
  staffConfirmedPaymentsMinor:amount,verifiedAllocatedMinor:amount,
  verifiedGroupPayerAllocatedMinor:amount,unallocatedNetChargesMinor:amount,
  signed:z.boolean(),eligiblePayments:z.array(z.object({
   paymentId:id,reference:z.string(),remainingMinor:amount,
  }))}),
]);
const schema=z.object({data:z.object({hotelId:id,groupId:id,
 currencies:z.array(currency),rooms:z.array(room)}),
 meta:z.object({readOnly:z.literal(true),finalInvoice:z.literal(false),
 postsTransactions:z.literal(false),verifiedMeansIndependentStaffEvidenceReview:z.literal(true),
 bankOrGatewayVerificationClaimed:z.literal(false),
 groupPayerAllocationEndpoint:z.string()})});
export function useGroupFinancialSummary(groupId:string){
 const {hotelId}=readSession();
 return useQuery({
  queryKey:['live','group-finance',hotelId,groupId],
  enabled:!!hotelId&&id.safeParse(groupId).success,
  queryFn:async()=>{
   const report=schema.parse(await getJson<unknown>(
    hotelPath('/group-reservations/'+encodeURIComponent(groupId)+'/financial-summary')));
   if(report.data.hotelId!==hotelId||report.data.groupId!==groupId)
    throw new Error('Group finance response belongs to another hotel or group.');
   return report.data;
  },retry:false,
 });
}
export async function allocateVerifiedGroupPayment(groupId:string,bookingId:string,paymentId:string,
 input:{requestKey:string;amountMinor:number;folioEntryId?:number}){
 return z.object({data:z.object({id,replayed:z.boolean()})}).parse(
  await requestJson<unknown>(hotelPath('/group-reservations/'+encodeURIComponent(groupId)
   +'/bookings/'+encodeURIComponent(bookingId)+'/payments/'+encodeURIComponent(paymentId)
   +'/allocations'),{method:'POST',body:input})).data;
}
