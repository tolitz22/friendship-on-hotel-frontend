import {readSession} from '../../api/session';

export type ErrorKind='react_render'|'javascript_error'|'unhandled_rejection'|'api_server_error'|'api_network_error'|'api_invalid_response'|'route_error';
const screens=new Set(['front-desk','reservations','group-reservations','rooms','room-calendar','billing','housekeeping','maintenance','expenses','cashier-shifts','staff','messages','operational-exceptions','manager-approvals','reports','settings','rate-calendar','night-audit','folio-night-accounting','occupancy-verification','lost-found','my-expense-claims','guests']);
const types=new Set(['Error','TypeError','RangeError','ReferenceError','SyntaxError','URIError','EvalError','AggregateError','Unknown']);
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
type ErrorDetails={error?:unknown;status?:number;requestId?:string|null};
export function safeScreen(path:string):string{
 if(path==='/')return 'dashboard';
 if(['/login','/accept-invitation','/forgot-password','/reset-password','/change-password'].includes(path))return 'auth';
 if(/^\/expenses\/[1-9][0-9]*$/.test(path))return 'expenses';
 if(/^\/guests\/[1-9][0-9]*\/stays$/.test(path))return 'guests';
 const name=path.slice(1);
 return screens.has(name)?name:'other';
}
export function errorPayload(kind:ErrorKind,path:string,details:ErrorDetails={}){
 const name=details.error instanceof Error?details.error.name:'Unknown';
 const status=details.status;
 return {kind,screen:safeScreen(path),
  ...(details.error!==undefined?{error_type:types.has(name)?name:'Unknown'}:{}),
  ...(status!==undefined&&Number.isInteger(status)&&(status===0||(status>=500&&status<=599))?{status_code:status}:{}),
  ...(details.requestId&&uuid.test(details.requestId)?{related_request_id:details.requestId}:{}),
 };
}
const recent=new Map<string,number>();
let windowStart=0, sent=0, inFlight=0;
let installed=false;
const base=()=> (import.meta.env.VITE_API_URL??'http://localhost:8000/api/v1').replace(/\/$/,'');
function enabled(){
 return import.meta.env.PROD&&import.meta.env.VITE_DATA_SOURCE==='api'&&import.meta.env.VITE_FRONTEND_TELEMETRY!=='false';
}
export function reportFrontendError(kind:ErrorKind,details:ErrorDetails={}):void{
 try{
  if(!enabled()||typeof window==='undefined')return;
  const {token,hotelId}=readSession();
  const cookie=import.meta.env.VITE_AUTH_MODE==='cookie';
  // A selected hotel or bearer credential indicates a staff session.
  // Do not report from anonymous login or password reset screens.
  if(cookie?!hotelId:!token)return;
  const headers:Record<string,string>={Accept:'application/json','Content-Type':'application/json'};
  if(cookie){
   const csrf=document.cookie.split(';').map(part=>part.trim()).find(part=>part.startsWith('XSRF-TOKEN='));
   if(!csrf)return;
   headers['X-XSRF-TOKEN']=decodeURIComponent(csrf.slice('XSRF-TOKEN='.length));
  }else if(token){headers.Authorization='Bearer '+token;}
  const payload=errorPayload(kind,window.location.pathname,details);
  const now=Date.now();
  if(now-windowStart>=60000){windowStart=now;sent=0;}
  for(const [key,at] of recent)if(now-at>=30000)recent.delete(key);
  // Deduplicate repeated events per screen/type, not per request ID.
  const key=JSON.stringify([payload.kind,payload.screen,payload.error_type,payload.status_code]);
  if(sent>=8||inFlight>=2||recent.has(key))return;
  recent.set(key,now);sent++;inFlight++;
  // Deliberately bypass the normal HTTP wrapper: no recursion, auth-expiry
  // callback, retries, storage or user-visible error when reporting fails.
  void Promise.resolve().then(()=>fetch(base()+'/telemetry/frontend-errors',{
   method:'POST',headers,credentials:cookie?'include':'omit',body:JSON.stringify(payload),
   keepalive:true,signal:AbortSignal.timeout(5000),
  })).catch(()=>{}).finally(()=>{inFlight--;});
 }catch{/* Telemetry is always best-effort. */}
}
function isHandledApiError(error:unknown){
 return error instanceof Error&&error.name==='ApiError';
}
export function installFrontendErrorTracking(){
 if(installed||!enabled()||typeof window==='undefined')return;
 installed=true;
 window.addEventListener('error',event=>{
  if(!isHandledApiError(event.error))reportFrontendError('javascript_error',{error:event.error??null});
 });
 window.addEventListener('unhandledrejection',event=>{
  if(!isHandledApiError(event.reason))reportFrontendError('unhandled_rejection',{error:event.reason});
 });
}
