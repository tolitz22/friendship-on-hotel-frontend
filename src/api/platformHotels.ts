import {getJson,requestJson} from './http';
export interface PlatformHotel{
 id:string;name:string;timezone:string;currency:string;createdAt:string|null;
 roomCount:number;activeStaffCount:number;activeAdminCount:number;
}
export interface HotelDirectory{data:PlatformHotel[];meta:{page:number;lastPage:number;total:number}}
export interface HotelOnboardingInput{name:string;adminName:string;adminEmail:string;password:string;password_confirmation:string}
export function fetchPlatformHotels(search:string,page:number,signal?:AbortSignal){
 return getJson<HotelDirectory>('/platform/hotels',{search,page},signal);
}
export function createPlatformHotel(input:HotelOnboardingInput){
 return requestJson<{data:{id:string;name:string;adminId:string;passwordChangeRequired:boolean}}>('/platform/hotels',{method:'POST',body:input});
}
