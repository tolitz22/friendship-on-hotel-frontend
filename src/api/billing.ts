import {useQuery} from '@tanstack/react-query';
import {z} from 'zod';
import {getJson,requestJson} from './http';
import {hotelPath,readSession} from './session';

const id=z.string().regex(/^[1-9]\d*$/);
const row=z.object({
 bookingId:id,folioId:id,reference:z.string(),checkIn:z.string(),checkOut:z.string(),
 status:z.string(),currency:z.string(),
 netRecordedChargesMinor:z.number().int(),
 staffConfirmedPaymentsMinor:z.number().int(),
 pendingReviewPaymentsMinor:z.number().int(),
 signed:z.boolean(),provisionalOnly:z.literal(true),
});
const list=z.object({
 data:z.array(row),
 meta:z.object({
  page:z.number().int().positive(),perPage:z.number().int().positive(),
  total:z.number().int().nonnegative(),totalPages:z.number().int().nonnegative(),
  amountsProvisional:z.literal(true),paymentEvidenceNotIndependentlyVerified:z.literal(true),
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
export function recordBankEvidence(bookingId:string,requestKey:string,reference:string,amountMinor:number){
 return requestJson<unknown>(hotelPath('/bookings/'+bookingId+'/payment-records'),{
  method:'POST',body:{requestKey,method:'bank_transfer',reference,amountMinor},
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
