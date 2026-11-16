export class ApiError extends Error {
 constructor(public status:number,public code:string,message:string,public fieldErrors?:Record<string,string[]>){super(message);this.name='ApiError';}
}
const base=(import.meta.env.VITE_API_URL??'http://localhost:8000/api/v1').replace(/\/$/,'');
export async function getJson<T>(path:string,params:Record<string,string|number|undefined>={}):Promise<T>{
 const url=new URL(base+path);
 Object.entries(params).forEach(([key,value])=>{if(value!==undefined&&value!=='')url.searchParams.set(key,String(value));});
 let response:Response;
 try{response=await fetch(url.toString(),{credentials:'include',headers:{Accept:'application/json'}});}
 catch{throw new ApiError(0,'NETWORK_ERROR','Unable to reach the hotel API.');}
 if(!response.ok){
  const payload:unknown=await response.json().catch(()=>null);
  const obj=payload&&typeof payload==='object'?payload as Record<string,unknown>:{};
  throw new ApiError(response.status,typeof obj.code==='string'?obj.code:'HTTP_ERROR',typeof obj.message==='string'?obj.message:'The request failed.',obj.errors as Record<string,string[]>|undefined);
 }
 return response.json() as Promise<T>;
}
