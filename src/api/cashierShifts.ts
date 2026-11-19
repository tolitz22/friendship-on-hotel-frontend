import {useQuery} from '@tanstack/react-query';
import {z} from 'zod';
import {getJson,requestJson} from './http';
import {hotelPath,readSession} from './session';

const id=z.string().regex(/^[1-9]\d*$/);
const receipt=z.object({
 id,paymentId:id,bookingId:id,reference:z.string(),amountMinor:z.number().int().nonnegative(),
 cashTenderedMinor:z.number().int().nonnegative().nullable(),
 changeGivenMinor:z.number().int().nonnegative().nullable(),
 netReceiptMinor:z.number().int().nonnegative().nullable(),
 paymentStatus:z.string(),
});
const shift=z.object({
 id,hotelId:id,cashierId:id,currency:z.string(),status:z.enum(['open','submitted','reconciled','flagged']),
 cashTenderTrackingSupported:z.boolean().optional().default(false),
 openingFloatMinor:z.number().int().nonnegative(),expectedCashMinor:z.number().int().nonnegative().nullable(),
 countedCashMinor:z.number().int().nonnegative().nullable(),varianceMinor:z.number().int().nullable(),
 receiptCount:z.number().int().nonnegative(),unconfirmedReceiptCount:z.number().int().nonnegative(),
 closingNote:z.string().nullable(),managerNote:z.string().nullable(),reviewedBy:id.nullable(),
 openedAt:z.string(),submittedAt:z.string().nullable(),reconciledAt:z.string().nullable(),
 receipts:z.array(receipt).optional(),
});
const list=z.object({
 data:z.array(shift),
 meta:z.object({page:z.number().int().positive(),perPage:z.number().int().positive(),
  total:z.number().int().nonnegative(),totalPages:z.number().int().nonnegative()}),
});
export type CashierShift=z.infer<typeof shift>;
export function parseShifts(raw:unknown,hotelId:string){
 const result=list.parse(raw);
 if(result.data.some(item=>item.hotelId!==hotelId))throw new Error('Cashier records crossed hotel boundaries.');
 return result;
}
export function useCashierShifts(enabled:boolean,page=1,status?:CashierShift['status']){
 const {hotelId}=readSession();
 return useQuery({
  queryKey:['live','cashier-shifts',hotelId,page,status],
  enabled:enabled&&!!hotelId,
  queryFn:async()=>parseShifts(await getJson<unknown>(hotelPath('/cashier-shifts'),{
   page,per_page:20,status,
  }),hotelId!),
  retry:false,
 });
}
/** Current user only, including administrators. Never use a hotel-wide list to select a drawer. */
export function useCurrentCashierShift(enabled:boolean){
 const {hotelId}=readSession();
 return useQuery({
  queryKey:['live','current-cashier-shift',hotelId],
  enabled:enabled&&!!hotelId,
  queryFn:async()=>{
   const result=z.object({data:shift.nullable()}).parse(
    await getJson<unknown>(hotelPath('/cashier-shifts/current'))).data;
   if(result&&(result.hotelId!==hotelId||result.status!=='open'))
    throw new Error('Current cashier shift does not match this hotel or is not open.');
   return result;
  },retry:false,
 });
}

export function useCashierShiftDetails(enabled:boolean,shiftId:string){
 const {hotelId}=readSession();
 return useQuery({
  queryKey:['live','cashier-shift-detail',hotelId,shiftId],
  enabled:enabled&&!!hotelId&&!!shiftId,
  queryFn:async()=>{
   const result=z.object({data:shift}).parse(await getJson<unknown>(
    hotelPath('/cashier-shifts/'+encodeURIComponent(shiftId)))).data;
   if(result.hotelId!==hotelId||result.id!==shiftId)
    throw new Error('Cashier shift detail came from another hotel or drawer.');
   return result;
  },
  retry:false,
 });
}
export async function openCashierShift(hotelId:string,openingFloatMinor:number){
 if(readSession().hotelId!==hotelId)throw new Error('Property changed.');
 const data=z.object({data:shift}).parse(await requestJson<unknown>(hotelPath('/cashier-shifts'),{
  method:'POST',body:{openingFloatMinor},
 })).data;
 if(data.hotelId!==hotelId)throw new Error('Wrong hotel in shift response.');
 return data;
}
export async function submitCashCount(hotelId:string,shiftId:string,countedCashMinor:number,note:string){
 if(readSession().hotelId!==hotelId)throw new Error('Property changed.');
 const data=z.object({data:shift}).parse(await requestJson<unknown>(
  hotelPath('/cashier-shifts/'+encodeURIComponent(shiftId)+'/close'),{
   method:'POST',body:{countedCashMinor,note},
  })).data;
 if(data.hotelId!==hotelId||data.id!==shiftId)throw new Error('Unexpected shift returned.');
 return data;
}
export async function reconcileCashShift(hotelId:string,shiftId:string,decision:'reconcile'|'flag',note:string){
 if(readSession().hotelId!==hotelId)throw new Error('Property changed.');
 const data=z.object({data:shift}).parse(await requestJson<unknown>(
  hotelPath('/cashier-shifts/'+encodeURIComponent(shiftId)+'/reconcile'),{
   method:'POST',body:{decision,note},
  })).data;
 if(data.hotelId!==hotelId||data.id!==shiftId)throw new Error('Unexpected shift returned.');
 return data;
}
export async function receiveCash(hotelId:string,shiftId:string,bookingId:string,payload:{
 requestKey:string;reference:string;amountMinor:number;
 cashTenderedMinor:number;changeGivenMinor:number;duplicateOverrideReason?:string;
}){
 if(readSession().hotelId!==hotelId)throw new Error('Property changed.');
 return z.object({data:z.object({
  paymentId:id,shiftId:id,status:z.string(),replayed:z.boolean(),
  cashTenderedMinor:z.number().int().nonnegative().nullable().optional(),
  changeGivenMinor:z.number().int().nonnegative().nullable().optional(),
  netReceiptMinor:z.number().int().nonnegative().nullable().optional(),
 })}).parse(await requestJson<unknown>(
  hotelPath('/cashier-shifts/'+encodeURIComponent(shiftId)+'/bookings/'+encodeURIComponent(bookingId)+'/cash-receipts'),
  {method:'POST',body:payload},
 )).data;
}
export async function getCashShiftHistory(hotelId:string,shiftId:string){
 if(readSession().hotelId!==hotelId)throw new Error('Property changed.');
 return z.object({data:z.array(z.object({
  id,actorId:id,actorName:z.string().nullable().optional(),event:z.string(),details:z.unknown(),createdAt:z.string(),
 }))}).parse(await getJson<unknown>(
  hotelPath('/cashier-shifts/'+encodeURIComponent(shiftId)+'/history')));
}
