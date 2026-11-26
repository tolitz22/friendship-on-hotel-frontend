import {useState} from 'react';
import {useQueryClient} from '@tanstack/react-query';
import {PushPreferencesPanel} from './PushPreferencesPanel';
import {BellRing} from 'lucide-react';
import {disablePush,enablePush,pushKey,pushSupported,registeredDevice} from '../features/notifications/pushDevice';

export function PushDeviceControl({userId,hotelId}:{userId:string;hotelId:string}){
 const [enabled,setEnabled]=useState(()=>!!registeredDevice(userId,hotelId));
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState('');
 const supported=pushSupported();
 const client=useQueryClient();
 async function toggle(){
  setBusy(true);setMessage('');
  try{
   if(enabled)await disablePush(userId,hotelId);
   else await enablePush(userId,hotelId);
   setEnabled(!enabled);
   await client.invalidateQueries({queryKey:['push-devices',hotelId,userId]});
   setMessage(enabled?'This device was removed.':'Device registered. Delivery requires an active push worker.');
  }catch(e){setMessage(e instanceof Error?e.message:'Unable to update push notifications.');}
  finally{setBusy(false);}
 }
 return <section aria-label="Device push notifications" style={{padding:'12px 0'}}>
  <strong><BellRing size={16} aria-hidden="true"/> Device notifications</strong>
  <p>{enabled?'This device is registered for this property.':!supported?'Push is unavailable in this browser. On iPhone, open an installed home-screen app.':!pushKey?'Push delivery is not configured yet.':'Receive hotel alerts when the PMS is closed.'}</p>
  <button type="button" className="btn-inline" disabled={busy||(!enabled&&(!supported||!pushKey))} onClick={()=>void toggle()}>{busy?'Updating…':enabled?'Disable on this device':'Enable push notifications'}</button>
  {message&&<p role="status">{message}</p>}
  <PushPreferencesPanel hotelId={hotelId} userId={userId} onRemoveCurrent={async()=>{await disablePush(userId,hotelId);setEnabled(false);}}/>
 </section>;
}
