import {useState} from 'react';
import {useQueryClient} from '@tanstack/react-query';
import {PushPreferencesPanel} from './PushPreferencesPanel';
import {BellRing} from 'lucide-react';
import {disablePush,enablePush,pushKey,pushSupported,registeredDevice} from '../features/notifications/pushDevice';

export function PushDeviceControl({userId,hotelId,active=true}:{userId:string;hotelId:string;active?:boolean}){
 const [enabled,setEnabled]=useState(()=>!!registeredDevice(userId,hotelId));
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState('');
 const supported=pushSupported();
 const permission=supported?Notification.permission:'unsupported';
 const client=useQueryClient();
 async function toggle(){
  setBusy(true);setMessage('');
  try{
   if(enabled)await disablePush(userId,hotelId);
   else await enablePush(userId,hotelId);
   setEnabled(!enabled);
   await client.invalidateQueries({queryKey:['push-devices',hotelId,userId]});
   setMessage(enabled?'This device was removed.':'Device registered. Alerts remain enabled after logout once delivery is activated.');
  }catch(e){setMessage(e instanceof Error?e.message:'Unable to update push notifications.');}
  finally{setBusy(false);}
 }
 return <section aria-label="Device push notifications" className="push-device-control">
  <div className="push-device-heading"><BellRing size={20} aria-hidden="true"/><div><strong>Device notifications</strong><small>{enabled?'Registered in this browser':!supported?'Unsupported browser':permission==='denied'?'Permission blocked':!pushKey?'Configuration pending':'Not registered'}</small></div></div>
  <p>{!supported?'Push is unavailable in this browser. On iPhone, open an installed home-screen app.':permission==='denied'?'Allow notifications in your browser or device settings to receive alerts.':!pushKey?'Push delivery is not configured yet.':enabled?'Device registered. Delivery requires the server worker and enabled preferences.':'Receive hotel alerts even when signed out. Enable only on a personal or trusted device.'}</p>
  <p className="push-device-note">Signing out keeps opted-in device alerts enabled. Disable this device before sharing it.</p>
  <button type="button" className="btn-inline" disabled={busy||(!enabled&&(!supported||!pushKey||permission==='denied'))} onClick={()=>void toggle()}>{busy?'Updating…':enabled?'Disable on this device':'Enable push notifications'}</button>
  {message&&<p role="status">{message}</p>}
  <PushPreferencesPanel hotelId={hotelId} userId={userId} active={active} onRemoveCurrent={async()=>{await disablePush(userId,hotelId);setEnabled(false);}}/>
 </section>;
}
