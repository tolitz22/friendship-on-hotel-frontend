import {readSession} from './session';
import {reportFrontendError} from '../features/telemetry/frontendErrors';

export class ApiError extends Error {
 constructor(public status:number,public code:string,message:string,public fieldErrors?:Record<string,string[]>,public requestId?:string){
  super(message);this.name='ApiError';
 }
}

const base=(import.meta.env.VITE_API_URL??'http://localhost:8000/api/v1').replace(/\/$/,'');
export const isCookieAuth=()=>import.meta.env.VITE_AUTH_MODE==='cookie';
let sessionExpiredHandler:(()=>void)|null=null;
export function onSpaSessionExpired(handler:(()=>void)|null){sessionExpiredHandler=handler;}
type JsonOptions={
 method?:'GET'|'POST'|'PATCH'|'PUT'|'DELETE';body?:unknown;authenticated?:boolean;
 params?:Record<string,string|number|undefined>;
};

function xsrfToken():string|null{
 if(typeof document==='undefined')return null;
 const entry=document.cookie.split(';').map(part=>part.trim())
  .find(part=>part.startsWith('XSRF-TOKEN='));
 if(!entry)return null;
 try{return decodeURIComponent(entry.substring('XSRF-TOKEN='.length));}
 catch{return null;}
}

export async function initializeSpaCsrf():Promise<void>{
 if(!isCookieAuth())return;
 const endpoint=new URL('/sanctum/csrf-cookie',base).toString();
 let response:Response;
 try{
  response=await fetch(endpoint,{method:'GET',credentials:'include',headers:{Accept:'application/json'}});
 }catch{
  throw new ApiError(0,'NETWORK_ERROR','Unable to initialize Laravel session security. Check the API and CORS settings.');
 }
 if(!response.ok)throw new ApiError(response.status,'CSRF_SETUP_FAILED','Could not initialize secure session cookies.');
 if(!xsrfToken())throw new ApiError(419,'CSRF_COOKIE_MISSING','CSRF cookie is missing. Use the same site/domain for Laravel and the frontend.');
}

export async function requestJson<T>(path:string,options:JsonOptions={}):Promise<T>{
 const url=new URL(base+path);
 Object.entries(options.params??{}).forEach(([key,value])=>{
  if(value!==undefined&&value!=='')url.searchParams.set(key,String(value));
 });
 const cookie=isCookieAuth();
 const token=readSession().token;
 if(!cookie&&options.authenticated!==false&&!token)
  throw new ApiError(401,'AUTH_REQUIRED','Sign in to continue.');
 const headers:Record<string,string>={Accept:'application/json'};
 if(options.body!==undefined)headers['Content-Type']='application/json';
 if(!cookie&&options.authenticated!==false&&token)headers.Authorization='Bearer '+token;
 const method=options.method??'GET';
 if(cookie&&method!=='GET'){
  const csrf=xsrfToken();
  if(!csrf)throw new ApiError(419,'CSRF_COOKIE_MISSING','Secure session CSRF cookie missing. Reload the login page and try again.');
  headers['X-XSRF-TOKEN']=csrf;
 }
 let response:Response;
 try{
  response=await fetch(url.toString(),{
   method,headers,credentials:cookie?'include':'omit',
   ...(options.body!==undefined?{body:JSON.stringify(options.body)}:{}),
  });
 }catch(error){
  reportFrontendError('api_network_error',{error,status:0});
  throw new ApiError(0,'NETWORK_ERROR','Unable to reach the Laravel API. Check VITE_API_URL and CORS.');
 }
 const requestId=response.headers?.get('X-Request-ID')??undefined;
 if(!response.ok){
  if(response.status>=500)reportFrontendError('api_server_error',{status:response.status,requestId});
  if(cookie&&options.authenticated!==false&&(response.status===401||response.status===419)){
   sessionExpiredHandler?.();
  }
  const payload:unknown=await response.json().catch(()=>null);
  const obj=payload&&typeof payload==='object'?payload as Record<string,unknown>:{};
  throw new ApiError(response.status,typeof obj.code==='string'?obj.code:'HTTP_ERROR',
   typeof obj.message==='string'?obj.message:response.status===419?'Session expired or CSRF validation failed. Reload and sign in again.':
   response.status===401?'Session expired. Sign in again.':'The request failed.',
   obj.errors&&typeof obj.errors==='object'?obj.errors as Record<string,string[]>:undefined,requestId);
 }
 try{return await response.json() as T;}
 catch(error){reportFrontendError('api_invalid_response',{error,requestId});throw error;}
}
export function getJson<T>(path:string,params:Record<string,string|number|undefined>={}):Promise<T>{
 return requestJson<T>(path,{params});
}

/** Download protected files without exposing credentials in a URL. */
export async function downloadPrivateFile(path:string,filename:string):Promise<void>{
 const cookie=isCookieAuth(),token=readSession().token;
 if(!cookie&&!token)throw new ApiError(401,'AUTH_REQUIRED','Sign in to continue.');
 const headers:Record<string,string>={Accept:'application/octet-stream'};
 if(!cookie&&token)headers.Authorization='Bearer '+token;
 let response:Response;
 try{response=await fetch(base+path,{headers,credentials:cookie?'include':'omit',cache:'no-store'});}
 catch{throw new ApiError(0,'NETWORK_ERROR','Unable to download. Check your connection.');}
 if(!response.ok){
  if(response.status>=500)reportFrontendError('api_server_error',{status:response.status,requestId:response.headers?.get('X-Request-ID')});
  if(cookie&&(response.status===401||response.status===419))sessionExpiredHandler?.();
  throw new ApiError(response.status,'DOWNLOAD_FAILED','Unable to download this attachment.');
 }
 if(response.headers.get('Content-Type')?.split(';')[0]!=='application/octet-stream')throw new ApiError(0,'INVALID_DOWNLOAD','Unexpected attachment response.');
 const url=URL.createObjectURL(await response.blob());
 const link=document.createElement('a');
 link.href=url;link.download=filename.replace(/[^a-zA-Z0-9 _.-]/g,'_')||'attachment';
 document.body.appendChild(link);
 try{link.click();}finally{link.remove();window.setTimeout(()=>URL.revokeObjectURL(url),1000);}
}
