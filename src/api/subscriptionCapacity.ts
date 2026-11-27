import {getJson} from './http';
export interface CapacityResource{used:number;limit:number|null;remaining:number|null;state:'unlimited'|'available'|'near'|'full'|'over'}
export interface SubscriptionCapacity{assigned:boolean;enforced:boolean;rooms:CapacityResource;staff:CapacityResource}
export function fetchSubscriptionCapacity(hotelId:string,signal?:AbortSignal){
 return getJson<{data:SubscriptionCapacity}>('/hotels/'+encodeURIComponent(hotelId)+'/subscription-capacity',{},signal);
}
export function capacityBlocked(capacity:SubscriptionCapacity|undefined,resource:'rooms'|'staff'){
 return !!capacity?.enforced&&['full','over'].includes(capacity[resource].state);
}
