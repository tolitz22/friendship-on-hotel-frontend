import {requestJson} from '../../api/http';
import {z} from 'zod';

export const pushKey=import.meta.env.VITE_PUSH_PUBLIC_KEY?.trim()??'';
export const pushSupported=()=>typeof window!=='undefined'&&window.isSecureContext&&'serviceWorker' in navigator&&'PushManager' in window&&'Notification' in window;
const prefix='pms.push-device:v1:';
const recordSchema=z.object({userId:z.string(),hotelId:z.string(),id:z.string()});
type DeviceRecord=z.infer<typeof recordSchema>;
const path=(hotelId:string)=>'/hotels/'+encodeURIComponent(hotelId)+'/push-subscriptions';
function records():DeviceRecord[]{
 try{return z.array(recordSchema).parse(JSON.parse(localStorage.getItem(prefix)??'[]'));}catch{return [];}
}
function save(rows:DeviceRecord[]){localStorage.setItem(prefix,JSON.stringify(rows));}
export function registeredDevice(userId:string,hotelId:string){return records().find(r=>r.userId===userId&&r.hotelId===hotelId);}
export function decodePushKey(key:string):Uint8Array<ArrayBuffer>{
 const raw=atob(key.replace(/-/g,'+').replace(/_/g,'/').padEnd(Math.ceil(key.length/4)*4,'='));
 const bytes=new Uint8Array(raw.length);
 for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);
 if(bytes.length!==65||bytes[0]!==4)throw new Error('Invalid push public key.');
 return bytes;
}
async function registration(){
 const existing=await navigator.serviceWorker.getRegistration('/');
 if(existing&&existing.active&&!existing.active.scriptURL.endsWith('/pms-push-sw.js'))throw new Error('An existing app worker needs push integration.');
 await navigator.serviceWorker.register('/pms-push-sw.js',{scope:'/'});
 return navigator.serviceWorker.ready;
}
export async function enablePush(userId:string,hotelId:string){
 if(!pushSupported()||!pushKey)throw new Error('Push notifications are not configured on this device.');
 if(records().some(r=>r.userId!==userId))throw new Error('Remove the previous account’s device registration before enabling push.');
 const key=decodePushKey(pushKey);
 const permission=await Notification.requestPermission();
 if(permission!=='granted')throw new Error('Notification permission was not granted.');
 const reg=await registration();
 let sub=await reg.pushManager.getSubscription();
 const created=!sub;
 if(!sub)sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:key});
 try{
  const json=sub.toJSON();
  const data=z.object({data:z.object({id:z.string()})}).parse(await requestJson<unknown>(path(hotelId),{method:'POST',body:{endpoint:sub.endpoint,keys:json.keys,deviceName:(navigator.platform||'Browser').slice(0,100)}})).data;
  try{save([...records().filter(r=>r.userId!==userId||r.hotelId!==hotelId),{userId,hotelId,id:data.id}]);}
  catch(e){await requestJson(path(hotelId)+'/'+encodeURIComponent(data.id),{method:'DELETE'}).catch(()=>{});throw e;}
 }catch(e){if(created)await sub.unsubscribe().catch(()=>{});throw e;}
}
export async function disablePush(userId:string,hotelId:string){
 const row=registeredDevice(userId,hotelId);
 if(!row)return;
 await requestJson(path(hotelId)+'/'+encodeURIComponent(row.id),{method:'DELETE'});
 const remaining=records().filter(r=>r.userId!==userId||r.hotelId!==hotelId);
 save(remaining);
 if(!remaining.length)await unsubscribeBrowser();
}
export async function unsubscribeBrowser(){
 if(!pushSupported())return;
 const reg=await navigator.serviceWorker.getRegistration('/');
 const sub=await reg?.pushManager.getSubscription();
 if(sub)await sub.unsubscribe();
}
export async function revokeLocalPush(userId:string){
 try{
  for(const row of records().filter(r=>r.userId===userId)){
   try{await requestJson(path(row.hotelId)+'/'+encodeURIComponent(row.id),{method:'DELETE'});}catch{/* Browser unsubscribe is the fallback. */}
  }
 }finally{
  await unsubscribeBrowser();
  save(records().filter(r=>r.userId!==userId));
 }
}

/** A different account on the same browser must not inherit the previous owner's alerts. */
export async function resetPushForDifferentAccount(userId:string){
 const rows=records();
 if(!rows.some(row=>row.userId!==userId))return;
 await unsubscribeBrowser();
 save([]);
}
