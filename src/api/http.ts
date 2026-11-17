import {readSession} from './session';
export class ApiError extends Error {
 constructor(public status:number,public code:string,message:string,public fieldErrors?:Record<string,string[]>){super(message);this.name='ApiError';}
}
const base=(import.meta.env.VITE_API_URL??'http://localhost:8000/api/v1').replace(/\/$/,'');
type JsonOptions={method?:'GET'|'POST'|'PATCH';body?:unknown;authenticated?:boolean;params?:Record<string,string|number|undefined>};
export async function requestJson<T>(path:string,options:JsonOptions={}):Promise<T>{
 const url=new URL(base+path);
 Object.entries(options.params??{}).forEach(([key,value])=>{
  if(value!==undefined&&value!=='')url.searchParams.set(key,String(value));
 });
 const token=readSession().token;
 if(options.authenticated!==false&&!token)throw new ApiError(401,'AUTH_REQUIRED','Sign in to continue.');
 const headers:Record<string,string>={Accept:'application/json'};
 if(options.body!==undefined)headers['Content-Type']='application/json';
 if(options.authenticated!==false&&token)headers.Authorization='Bearer '+token;
 let response:Response;
 try{
  response=await fetch(url.toString(),{
   method:options.method??'GET',headers,
   ...(options.body!==undefined?{body:JSON.stringify(options.body)}:{})
  });
 }catch{throw new ApiError(0,'NETWORK_ERROR','Unable to reach the Laravel API. Check VITE_API_URL and CORS.');}
 if(!response.ok){
  const payload:unknown=await response.json().catch(()=>null);
  const obj=payload&&typeof payload==='object'?payload as Record<string,unknown>:{};
  throw new ApiError(response.status,typeof obj.code==='string'?obj.code:'HTTP_ERROR',
   typeof obj.message==='string'?obj.message:response.status===401?'Session expired. Sign in again.':'The request failed.',
   obj.errors&&typeof obj.errors==='object'?obj.errors as Record<string,string[]>:undefined);
 }
 return response.json() as Promise<T>;
}
export function getJson<T>(path:string,params:Record<string,string|number|undefined>={}):Promise<T>{
 return requestJson<T>(path,{params});
}
