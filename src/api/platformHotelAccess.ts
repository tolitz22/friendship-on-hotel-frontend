import {getJson,requestJson} from './http';
export type HotelAccessState='active'|'restricted'|'suspended';
export interface HotelAccessDetails{
 state:HotelAccessState;revision:number;
 blockers:{openReservations:number;activeHolds:number;unreconciledShifts:number};
 history:{revision:number;from:HotelAccessState;to:HotelAccessState;actorId:string|null;reason:string;createdAt:string}[];
}
const path=(id:string)=>'/platform/hotels/'+encodeURIComponent(id)+'/access';
export function fetchHotelAccess(id:string,page:number,signal?:AbortSignal){return getJson<{data:HotelAccessDetails;meta:{page:number;lastPage:number;total:number}}>(path(id),{page},signal);}
export function changeHotelAccess(id:string,input:{state:HotelAccessState;revision:number;reason:string;confirmed:boolean;clearanceConfirmed?:boolean}){
 return requestJson<{data:{state:HotelAccessState;revision:number}}>(path(id),{method:'PUT',body:input});
}
export const accessLabels:Record<HotelAccessState,string>={active:'Active',restricted:'Restricted',suspended:'Suspended'};
export function accessTransitions(state:HotelAccessState):HotelAccessState[]{return state==='active'?['restricted']:state==='restricted'?['active','suspended']:['active','restricted'];}
