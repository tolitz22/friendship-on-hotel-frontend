import {getJson,requestJson} from './http';
import {hotelPath} from './session';

export type StaffRole='admin'|'front_desk'|'housekeeping'|'maintenance';
export interface HotelStaffMember{
 userId:string;name:string;email:string;role:StaffRole;isActive:boolean;accountActive:boolean;
}
export const listHotelStaff=()=>getJson<{data:HotelStaffMember[]}>(hotelPath('/staff'));
export const attachHotelStaff=(email:string,role:StaffRole)=>
 requestJson<{data:HotelStaffMember[]}>(hotelPath('/staff'),{method:'POST',body:{email,role}});
export const updateHotelStaff=(userId:string,body:Partial<{role:StaffRole;isActive:boolean}>)=>
 requestJson<{data:HotelStaffMember[]}>(hotelPath('/staff/'+encodeURIComponent(userId)),{method:'PATCH',body});
