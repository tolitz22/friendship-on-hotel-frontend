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

export function requestPasswordReset(email:string){
 return requestJson<{message:string}>('/auth/forgot-password',{
  method:'POST',body:{email},authenticated:false,
 });
}
export function resetStaffPassword(email:string,token:string,password:string,passwordConfirmation:string){
 return requestJson<{message:string}>('/auth/reset-password',{
  method:'POST',authenticated:false,
  body:{email,token,password,password_confirmation:passwordConfirmation},
 });
}
export function changeStaffPassword(currentPassword:string,password:string,passwordConfirmation:string){
 return requestJson<{message:string}>('/auth/change-password',{
  method:'POST',body:{currentPassword,password,password_confirmation:passwordConfirmation},
 });
}
