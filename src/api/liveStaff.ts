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

export interface StaffMembershipEvent{
 id:string;actorId:string;actorName?:string|null;targetUserId:string;targetName?:string|null;action:string;
 before:{role:StaffRole;isActive:boolean}|null;
 after:{role:StaffRole;isActive:boolean};createdAt:string;
}
export const getHotelStaffHistory=()=>getJson<{
 data:StaffMembershipEvent[];
 meta:{page:number;perPage:number;total:number;totalPages:number};
}>(hotelPath('/staff/history'));

export interface StaffInvitation{
 id:string;email:string;name:string;role:StaffRole;expiresAt:string;
 acceptedAt:string|null;revokedAt:string|null;createdAt:string;
}
export const listStaffInvitations=()=>getJson<{data:StaffInvitation[]}>(hotelPath('/staff/invitations'));
export const inviteNewStaff=(email:string,name:string,role:StaffRole)=>
 requestJson<{data:{id:string;email:string;expiresInHours:number};message:string}>(
  hotelPath('/staff/invitations'),{method:'POST',body:{email,name,role}});
export const revokeStaffInvitation=(id:string)=>
 requestJson<{message:string}>(hotelPath('/staff/invitations/'+encodeURIComponent(id)+'/revoke'),{method:'PATCH'});
