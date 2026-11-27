import {initializeSpaCsrf,isCookieAuth,requestJson} from './http';

export interface StaffHotel{id:string;name:string;role:string;permissions?:string[];}
export interface StaffProfile{id:string;name:string;email:string;hotels:StaffHotel[];mustChangePassword?:boolean;platformAdmin?:boolean;}
export interface AuthLoginResponse{data:{token:string;tokenType:'Bearer';user:{id:string;name:string;email:string}};}
export interface StaffProfileResponse{data:StaffProfile;}

export interface SpaLoginResponse{data:{authenticated:true;authMode:'cookie';user:{id:string;name:string;email:string}};}
export async function loginStaff(email:string,password:string):Promise<AuthLoginResponse|SpaLoginResponse>{
 if(isCookieAuth()){
  await initializeSpaCsrf();
  return requestJson<SpaLoginResponse>('/auth/spa-login',{method:'POST',body:{email,password},authenticated:false});
 }
 return requestJson<AuthLoginResponse>('/auth/login',{method:'POST',body:{email,password},authenticated:false});
}
export function fetchStaffProfile(){
 return requestJson<StaffProfileResponse>('/auth/me');
}
export function logoutStaff(){
 return requestJson<{message:string}>(isCookieAuth()?'/auth/spa-logout':'/auth/logout',{method:'POST'});
}

export async function requestPasswordReset(email:string){
 if(isCookieAuth())await initializeSpaCsrf();
 return requestJson<{message:string}>('/auth/forgot-password',{
  method:'POST',body:{email},authenticated:false,
 });
}
export async function resetStaffPassword(email:string,token:string,password:string,passwordConfirmation:string){
 if(isCookieAuth())await initializeSpaCsrf();
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

export async function acceptStaffInvitation(token:string,password:string,passwordConfirmation:string){
 if(isCookieAuth())await initializeSpaCsrf();
 return requestJson<{message:string;data:{hotelId:string}}>('/auth/accept-invitation',{
  method:'POST',authenticated:false,
  body:{token,password,password_confirmation:passwordConfirmation},
 });
}
