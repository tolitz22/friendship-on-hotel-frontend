import {requestJson} from './http';

export interface StaffHotel{id:string;name:string;role:string;}
export interface StaffProfile{id:string;name:string;email:string;hotels:StaffHotel[];}
export interface AuthLoginResponse{data:{token:string;tokenType:'Bearer';user:{id:string;name:string;email:string}};}
export interface StaffProfileResponse{data:StaffProfile;}

export function loginStaff(email:string,password:string){
 return requestJson<AuthLoginResponse>('/auth/login',{method:'POST',body:{email,password},authenticated:false});
}
export function fetchStaffProfile(){
 return requestJson<StaffProfileResponse>('/auth/me');
}
export function logoutStaff(){
 return requestJson<{message:string}>('/auth/logout',{method:'POST'});
}
