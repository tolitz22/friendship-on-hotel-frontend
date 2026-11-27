import {getJson,requestJson} from './http';
import type {Paginated} from './platformPlans';
export type SubscriptionStatus='unassigned'|'trial'|'active'|'expired';
export type BillingCycle='monthly'|'annual';
export interface HotelSubscription {
 id:string;planId:string;planRevision:number;planName:string;currency:'PHP';cycle:BillingCycle;priceMinor:number;
 roomLimit:number|null;staffLimit:number|null;kind:'trial'|'paid';startsOn:string;expiresOn:string;
 status:Exclude<SubscriptionStatus,'unassigned'>;trialUsed:boolean;revision:number;
}
export interface SubscriptionHotel{hotelId:string;hotelName:string;currency:string;subscription:HotelSubscription|null}
export type SubscriptionInput={action:'renew';revision:number}|{action:'assign'|'trial';revision:number;planId:string;planRevision:number;cycle:BillingCycle;trialDays?:number};
export interface SubscriptionRevision{revision:number;action:'trial'|'assign'|'renew';actorId:string|null;createdAt:string;snapshot:HotelSubscription}
const path='/platform/hotel-subscriptions';
export function fetchHotelSubscriptions(status:SubscriptionStatus|'all',search:string,page:number,signal?:AbortSignal){
 return getJson<Paginated<SubscriptionHotel>&{today:string}>(path,{status,search,page},signal);
}
export function saveHotelSubscription(hotelId:string,input:SubscriptionInput){
 return requestJson<{data:HotelSubscription}>(path+'/'+encodeURIComponent(hotelId),{method:'PUT',body:input});
}
export function fetchSubscriptionHistory(hotelId:string,page:number,signal?:AbortSignal){
 return getJson<Paginated<SubscriptionRevision>>(path+'/'+encodeURIComponent(hotelId)+'/history',{page},signal);
}
