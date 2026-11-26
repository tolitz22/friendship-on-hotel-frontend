import {useEffect,useState} from 'react';
import {useQueryClient} from '@tanstack/react-query';
import {PushPreferencesPanel} from './PushPreferencesPanel';
import {BellRing} from 'lucide-react';
import {disablePush,enablePush,inspectPushDevice,pushKey,pushSupported,registeredDevice,type DeviceHealth} from '../features/notifications/pushDevice';

export function PushDeviceControl({userId,hotelId,active=true}:{userId:string;hotelId:string;active?:boolean}){
 const [enabled,setEnabled]=useState(()=>!!registeredDevice(userId,hotelId));
 const [health,setHealth]=useState<DeviceHealth|null>(null);
 const [healthError,setHealthError]=useState(false);
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState('');
 const supported=pushSupported();
 const permission=supported?Notification.permission:'unsupported';
 const client=useQueryClient();
 useEffect(()=>{
  if(!active||busy)return;
  let cancelled=false;let generation=0;
  const refresh=async()=>{
   const current=++generation;
   try{const result=await inspectPushDevice(userId,hotelId);if(!cancelled&&generation===current){setHealth(result);setHealthError(false);setEnabled(!!registeredDevice(userId,hotelId));}}
   catch{if(!cancelled&&generation===current)setHealthError(true);}
  };
  const onVisible=()=>{if(document.visibilityState==='visible')void refresh();};
  const onWorker=(event:MessageEvent)=>{if(event.data?.type==='pms-push-subscription-changed')void refresh();};
  void refresh();
  window.addEventListener('focus',onVisible);document.addEventListener('visibilitychange',onVisible);
  navigator.serviceWorker?.addEventListener('message',onWorker);
  return()=>{cancelled=true;window.removeEventListener('focus',onVisible);document.removeEventListener('visibilitychange',onVisible);navigator.serviceWorker?.removeEventListener('message',onWorker);};
 },[active,busy,userId,hotelId]);
 const repair=health==='repair-required';
 async function toggle(){
  setBusy(true);setMessage('');
  try{
   if(enabled&&!repair)await disablePush(userId,hotelId);
   else await enablePush(userId,hotelId);
   setEnabled(!enabled||repair);setHealth(null);
   await client.invalidateQueries({queryKey:['push-devices',hotelId,userId]});
   setMessage(enabled&&!repair?'This device was removed.':'Device registered. Alerts remain enabled after logout once delivery is activated.');
  }catch(e){setMessage(e instanceof Error?e.message:'Unable to update push notifications.');}
  finally{setBusy(false);}
 }
 return <section aria-label="Device push notifications" className="push-device-control">
  <div className="push-device-heading"><BellRing size={20} aria-hidden="true"/><div><strong>Device notifications</strong><small>{healthError?'Registration could not be verified':health==='repair-required'?'Registration needs repair':health==='registered'?'Registration verified':!supported?'Unsupported browser':permission==='denied'||health==='permission-blocked'?'Permission blocked':!pushKey?'Configuration pending':enabled?'Checking registration…':'Not registered'}</small></div></div>
  <p>{!supported?'Push is unavailable in this browser. On iPhone, open an installed home-screen app.':permission==='denied'?'Allow notifications in your browser or device settings to receive alerts.':!pushKey?'Push delivery is not configured yet.':repair?'Your browser subscription or server registration changed. Repair this device to resume delivery.':enabled?'Device registration alone does not guarantee delivery. The server worker and enabled preferences are also required.':'Receive hotel alerts even when signed out. Enable only on a personal or trusted device.'}</p>
  <p className="push-device-note">Signing out keeps opted-in device alerts enabled. Disable this device before sharing it.</p>
  <button type="button" className="btn-inline" disabled={busy||((!enabled||repair)&&(!supported||!pushKey||permission==='denied'))} onClick={()=>void toggle()}>{busy?'Updating…':repair?'Repair device notifications':enabled?'Disable on this device':'Enable push notifications'}</button>
  {repair&&enabled&&<button type="button" className="btn-inline" disabled={busy} onClick={async()=>{setBusy(true);try{await disablePush(userId,hotelId);setEnabled(false);setHealth(null);setMessage('This device was removed.');}catch{setMessage('Unable to remove this device. Try again.');}finally{setBusy(false);}}}>Remove registration</button>}
  {message&&<p role="status">{message}</p>}
  <PushPreferencesPanel hotelId={hotelId} userId={userId} active={active} onRemoveCurrent={async()=>{await disablePush(userId,hotelId);setEnabled(false);}}/>
 </section>;
}
