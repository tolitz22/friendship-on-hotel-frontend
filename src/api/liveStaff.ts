import {getJson,requestJson} from './http';
import {hotelPath} from './session';

export type StaffRole='admin'|'front_desk'|'housekeeping'|'maintenance';
export interface HotelStaffMember{
 userId:string;name:string;email:string;role:StaffRole;isActive:boolean;accountActive:boolean;
 permissions:string[];customPermissions:boolean;
}
export const listHotelStaff=()=>getJson<{data:HotelStaffMember[]}>(hotelPath('/staff'));
export const createHotelStaffAccount=(name:string,email:string,role:StaffRole,password:string,passwordConfirmation:string)=>
 requestJson<{message:string;data:HotelStaffMember[]}>(hotelPath('/staff/create-account'),{
  method:'POST',body:{name,email,role,password,password_confirmation:passwordConfirmation},
 });
export const attachHotelStaff=(email:string,role:StaffRole)=>
 requestJson<{data:HotelStaffMember[]}>(hotelPath('/staff'),{method:'POST',body:{email,role}});
export const updateHotelStaff=(userId:string,body:Partial<{role:StaffRole;isActive:boolean;expectedRole:StaffRole;expectedIsActive:boolean;permissions:string[];expectedPermissions:string[]}>)=>
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

export interface RolePermissionProfile{
 key:StaffRole;label:string;description:string;permissions:string[];editablePermissions:string[];activeStaff:number;
}
export interface HotelRolePermissions{
 roles:RolePermissionProfile[];
 capabilities:{key:string;label:string;group:string}[];
 note:string;editable:boolean;editScope?:string;
}
export const getHotelRolePermissions=()=>getJson<{data:HotelRolePermissions}>(hotelPath('/staff/permissions'));
