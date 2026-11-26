import {ApiError,requestJson} from '../../api/http';
import {z} from 'zod';

export const pushKey=import.meta.env.VITE_PUSH_PUBLIC_KEY?.trim()??'';
export const pushSupported=()=>typeof window!=='undefined'&&window.isSecureContext&&'serviceWorker' in navigator&&'PushManager' in window&&'Notification' in window;
const prefix='pms.push-device:v1:';
const recordSchema=z.object({userId:z.string(),hotelId:z.string(),id:z.string(),endpointDigest:z.string().optional()});
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
export type DeviceHealth='not-registered'|'registered'|'repair-required'|'permission-blocked'|'unsupported'|'configuration-pending';
async function digest(endpoint:string){
 const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(endpoint));
 return Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('');
}
export function keyMatches(subscription:PushSubscription,key:Uint8Array<ArrayBuffer>){
 const existing=subscription.options.applicationServerKey;
 if(!existing)return false;
 const bytes=new Uint8Array(existing);
 return bytes.length===key.length&&bytes.every((value,i)=>value===key[i]);
}
export async function inspectPushDevice(userId:string,hotelId:string):Promise<DeviceHealth>{
 if(!pushSupported())return 'unsupported';
 if(Notification.permission==='denied')return 'permission-blocked';
 if(!pushKey)return 'configuration-pending';
 const row=registeredDevice(userId,hotelId);
 if(!row)return 'not-registered';
 if(Notification.permission!=='granted')return 'repair-required';
 const reg=await navigator.serviceWorker.getRegistration('/');
 if(!reg||!isPushWorker(reg))return 'repair-required';
 const subscription=await reg.pushManager.getSubscription();
 if(!subscription||!keyMatches(subscription,decodePushKey(pushKey))||
    (subscription.expirationTime!==null&&subscription.expirationTime<=Date.now())||
    row.endpointDigest!==await digest(subscription.endpoint))return 'repair-required';
 const devices=z.object({data:z.array(z.object({id:z.string()}))}).parse(await requestJson<unknown>(path(hotelId)));
 return devices.data.some(device=>device.id===row.id)?'registered':'repair-required';
}
async function registration(){
 const existing=await navigator.serviceWorker.getRegistration('/');
 if(existing&&(existing.active||existing.waiting||existing.installing)&&!isPushWorker(existing))throw new Error('An existing app worker needs push integration.');
 await navigator.serviceWorker.register('/pms-push-sw.js',{scope:'/',updateViaCache:'none'});
 let timer:ReturnType<typeof setTimeout>|undefined;
 try{
  const ready=await Promise.race([navigator.serviceWorker.ready,new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new Error('Push worker is not ready. Reload the PMS and try again.')),15000);})]);
  if(!isPushWorker(ready))throw new Error('An existing app worker needs push integration.');
  return ready;
 }finally{if(timer!==undefined)clearTimeout(timer);}
}
export async function enablePush(userId:string,hotelId:string){
 if(!pushSupported()||!pushKey)throw new Error('Push notifications are not configured on this device.');
 if(records().some(r=>r.userId!==userId))throw new Error('Remove the previous account’s device registration before enabling push.');
 const key=decodePushKey(pushKey);
 const permission=await Notification.requestPermission();
 if(permission!=='granted')throw new Error('Notification permission was not granted.');
 const reg=await registration();
 let sub=await reg.pushManager.getSubscription();
 if(sub&&(!keyMatches(sub,key)||(sub.expirationTime!==null&&sub.expirationTime<=Date.now()))){
  await sub.unsubscribe();
  if(await reg.pushManager.getSubscription())throw new Error('Unable to replace the old subscription. Reset notification permissions and retry.');
  sub=null;
 }
 const created=!sub;
 if(!sub)sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:key});
 try{
  const old=registeredDevice(userId,hotelId);
  const endpointDigest=await digest(sub.endpoint);
  const json=sub.toJSON();
  const data=z.object({data:z.object({id:z.string()})}).parse(await requestJson<unknown>(path(hotelId),{method:'POST',body:{endpoint:sub.endpoint,keys:json.keys,deviceName:(navigator.platform||'Browser').slice(0,100)}})).data;
  try{save([...records().filter(r=>r.userId!==userId||r.hotelId!==hotelId),{userId,hotelId,id:data.id,endpointDigest}]);}
  catch(e){await requestJson(path(hotelId)+'/'+encodeURIComponent(data.id),{method:'DELETE'}).catch(()=>{});throw e;}
  if(old&&old.id!==data.id)await requestJson(path(hotelId)+'/'+encodeURIComponent(old.id),{method:'DELETE'}).catch(()=>{});
 }catch(e){if(created)await sub.unsubscribe().catch(()=>{});throw e;}
}
export async function disablePush(userId:string,hotelId:string){
 const row=registeredDevice(userId,hotelId);
 if(!row)return;
 try{await requestJson(path(hotelId)+'/'+encodeURIComponent(row.id),{method:'DELETE'});}
 catch(e){if(!(e instanceof ApiError)||e.status!==404)throw e;}
 const remaining=records().filter(r=>r.userId!==userId||r.hotelId!==hotelId);
 save(remaining);
 if(!remaining.length)await unsubscribeBrowser();
}
function isPushWorker(reg:ServiceWorkerRegistration):boolean{
 const worker=reg.active??reg.waiting??reg.installing;
 if(!worker)return false;
 try{return new URL(worker.scriptURL).origin===location.origin&&new URL(worker.scriptURL).pathname==='/pms-push-sw.js';}
 catch{return false;}
}
export async function unsubscribeBrowser(){
 if(typeof navigator==='undefined'||!('serviceWorker' in navigator))return;
 const reg=await navigator.serviceWorker.getRegistration('/');
 if(!reg||!isPushWorker(reg))return;
 const sub=await reg.pushManager.getSubscription();
 if(sub){
  await sub.unsubscribe();
  if(await reg.pushManager.getSubscription())throw new Error('Unable to remove the previous browser push subscription. Reset notification permissions and try again.');
 }
 for(const notification of await reg.getNotifications())notification.close();
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
 // If storage was cleared, the surviving service worker has unknown ownership.
 // Never allow a new session to silently inherit an orphaned subscription.
 if(rows.length>0&&rows.every(row=>row.userId===userId))return;
 await unsubscribeBrowser();
 if(rows.length>0)save([]);
}
