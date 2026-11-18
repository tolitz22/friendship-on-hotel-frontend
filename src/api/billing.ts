import {useQuery} from '@tanstack/react-query';
import {z} from 'zod';
import {getJson,requestJson} from './http';
import {hotelPath,readSession} from './session';
import {parseRecords} from './liveReservations';

const id=z.string().regex(/^[1-9]\d*$/);
const row=z.object({
 bookingId:id,folioId:id,reference:z.string(),guestName:z.string().nullable(),checkIn:z.string(),checkOut:z.string(),
 status:z.string(),currency:z.string(),
 netRecordedChargesMinor:z.number().int(),
 staffConfirmedPaymentsMinor:z.number().int(),
 pendingReviewPaymentsMinor:z.number().int(),
 signed:z.boolean().nullable(),provisionalOnly:z.literal(true),
});
const list=z.object({
 data:z.array(row),
 meta:z.object({
  page:z.number().int().positive(),perPage:z.number().int().positive(),
  total:z.number().int().nonnegative(),totalPages:z.number().int().nonnegative(),
  amountsProvisional:z.literal(true),paymentEvidenceNotIndependentlyVerified:z.literal(true),
  signoffRecordsAvailable:z.boolean().optional(),
 }),
});
export type BillingFolioRow=z.infer<typeof row>;
export function useBillingFolios(page:number,search:string){
 const {hotelId}=readSession();
 return useQuery({
  queryKey:['live','billing-folios',hotelId,page,search],
  enabled:!!hotelId,
  queryFn:async()=>{
   const result=list.parse(await getJson<unknown>(hotelPath('/finance/folios'),{
    page,per_page:20,search:search||undefined,
   }));
   return result;
  },retry:false,
 });
}
export function formatBillingMoney(minor:number,code:string){
 return code==='PHP'
  ?new Intl.NumberFormat('en-PH',{currency:'PHP',style:'currency'}).format(minor/100)
  :new Intl.NumberFormat('en-US').format(minor)+' '+code+' minor units';
}
export function parseBillingAmount(amount:string){
 if(!/^(?:0|[1-9]\d{0,8})(?:\.\d{1,2})?$/.test(amount))return null;
 const minor=Math.round(Number(amount)*100);
 return Number.isSafeInteger(minor)&&minor>0?minor:null;
}
/** Calculate cash change using integer minor units; never post tendered cash as the net receipt. */
export function calculateCashChange(paymentMinor:number|null,tenderedMinor:number|null):number|null{
 if(paymentMinor===null||tenderedMinor===null||!Number.isSafeInteger(paymentMinor)
  ||!Number.isSafeInteger(tenderedMinor)||paymentMinor<=0||tenderedMinor<paymentMinor)return null;
 return tenderedMinor-paymentMinor;
}
const paymentSafetyResult=z.object({data:z.object({
 currency:z.string(),
 payments:z.array(z.object({
  id,reference:z.string(),method:z.enum(['cash','bank_transfer']),
  amountMinor:z.number().int().nonnegative(),
  status:z.string(),createdAt:z.string(),
  recordedByName:z.string().nullable(),
 })),
 recentMatchingPaymentIds:z.array(id),hasMore:z.boolean(),
 provisionalOnly:z.literal(true),
})});
export type PaymentSafety=z.infer<typeof paymentSafetyResult>['data'];
export function usePaymentSafety(bookingId:string,method?:'cash'|'bank_transfer',amountMinor?:number|null){
 const {hotelId}=readSession();
 return useQuery({
  queryKey:['live','payment-safety',hotelId,bookingId,method,amountMinor],
  enabled:!!hotelId&&/^[1-9]\d*$/.test(bookingId),
  queryFn:async()=>paymentSafetyResult.parse(await getJson<unknown>(
   hotelPath('/bookings/'+encodeURIComponent(bookingId)+'/payment-safety'),{
    method,amountMinor:amountMinor??undefined,
   })).data,
  retry:false,
 });
}
export async function voidFolioPayment(bookingId:string,paymentId:string,requestKey:string,reason:string){
 const response=await requestJson<unknown>(
  hotelPath('/bookings/'+encodeURIComponent(bookingId)+'/payment-records/'
   +encodeURIComponent(paymentId)+'/void'),{method:'POST',body:{requestKey,reason}});
 return z.object({data:z.object({
  paymentId:id,status:z.literal('voided'),replayed:z.boolean(),
 })}).parse(response).data;
}
export function recordBankEvidence(bookingId:string,requestKey:string,reference:string,
 amountMinor:number,duplicateOverrideReason?:string){
 return requestJson<unknown>(hotelPath('/bookings/'+bookingId+'/payment-records'),{
  method:'POST',body:{requestKey,method:'bank_transfer',reference,amountMinor,
   ...(duplicateOverrideReason?{duplicateOverrideReason}:{})},
 });
}
export function recordFolioAdjustment(bookingId:string,requestKey:string,kind:'credit'|'debit',amountMinor:number,reason:string){
 return requestJson<unknown>(hotelPath('/bookings/'+bookingId+'/folio-adjustments'),{
  method:'POST',body:{requestKey,kind,amountMinor,reason},
 });
}
export function reviewFolioPayment(bookingId:string,paymentId:string,decision:'confirm'|'reject',note:string){
 return requestJson<unknown>(hotelPath('/bookings/'+bookingId+'/payment-records/'+paymentId+'/review'),{
  method:'POST',body:{decision,note},
 });
}

/** If the billing index cannot load, offer the actual reservation directory as
 * navigation only. Never compute or guess charges for this fallback. */
export function useBillingReservationFallback(enabled:boolean,page:number,search:string){
 const {hotelId}=readSession();
 return useQuery({
  queryKey:['live','billing-reservation-fallback',hotelId,page,search],
  enabled:enabled&&!!hotelId,
  queryFn:async()=>parseRecords(await getJson<unknown>(hotelPath('/reservation-records'),{
   page,per_page:20,search:search||undefined,filter:'all',
  }),hotelId!),
  retry:false,
 });
}
