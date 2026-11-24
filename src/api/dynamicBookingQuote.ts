import {useQuery} from '@tanstack/react-query';
import {z} from 'zod';
import {requestJson} from './http';
import {hotelPath,readSession} from './session';
import type {BookingSelection} from './liveBooking';
import {validLiveStay} from './liveReservations';

export const dynamicBookingEnabled=import.meta.env.VITE_BOOKING_DYNAMIC_PRICING_ENABLED==='true';
const amount=z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const kind=z.enum(['none','fixed','first_night','full','percent']);
const schema=z.object({data:z.object({
 hotelId:z.string(),roomTypeId:z.string(),ratePlanId:z.string(),checkIn:z.iso.date(),checkOut:z.iso.date(),
 currency:z.string().regex(/^[A-Z]{3}$/),roomSubtotalMinor:amount,
 nightlyRates:z.array(z.object({date:z.iso.date(),amountMinor:amount,source:z.string(),ruleId:z.string().nullable()})),
 quoteToken:z.string().regex(/^[a-f0-9]{64}$/),corporateCode:z.string().nullable(),promoCode:z.string().nullable(),
 policyTerms:z.object({version:z.number().int().positive(),depositKind:kind,depositValue:amount,
 freeCancelDays:amount,lateCancelKind:kind,lateCancelValue:amount,noShowKind:kind,noShowValue:amount}).nullable(),
})});
export type Eligibility={corporateCode?:string;promoCode?:string};
export function parseDynamicQuote(value:unknown,hotelId:string,stay:BookingSelection,codes:Eligibility){
 const q=schema.parse(value).data;
 const nights=(Date.parse(stay.checkOut+'T00:00:00Z')-Date.parse(stay.checkIn+'T00:00:00Z'))/86400000;
 if(q.hotelId!==hotelId||q.roomTypeId!==stay.roomTypeId||q.ratePlanId!==stay.ratePlanId||
 q.checkIn!==stay.checkIn||q.checkOut!==stay.checkOut||q.corporateCode!==(codes.corporateCode??null)||q.promoCode!==(codes.promoCode??null)||
 q.nightlyRates.length!==nights||q.nightlyRates.some((night,i)=>Date.parse(night.date+'T00:00:00Z')!==Date.parse(stay.checkIn+'T00:00:00Z')+i*86400000)||
 q.nightlyRates.reduce((sum,n)=>sum+n.amountMinor,0)!==q.roomSubtotalMinor)
 throw new Error('The returned quote does not match the selected stay or pricing. Review again.');
 return q;
}
export function useDynamicBookingQuote(stay:BookingSelection|null,codes:Eligibility,reviewVersion=0){
 const {hotelId}=readSession();
 return useQuery({
 queryKey:['live','dynamic-booking-quote',hotelId,stay,codes,reviewVersion],
 enabled:dynamicBookingEnabled&&!!hotelId&&!!stay&&validLiveStay(stay)&&!!stay.ratePlanId,
 queryFn:async()=>parseDynamicQuote(await requestJson(hotelPath('/dynamic-room-quote'),{method:'POST',body:{
 roomTypeId:Number(stay!.roomTypeId),ratePlanId:Number(stay!.ratePlanId),checkIn:stay!.checkIn,checkOut:stay!.checkOut,...codes,
 }}),hotelId!,stay!,codes),retry:false,staleTime:0,refetchOnWindowFocus:false,refetchOnReconnect:false,
 });
}
