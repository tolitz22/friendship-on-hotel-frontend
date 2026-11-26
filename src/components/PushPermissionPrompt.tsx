import {useEffect,useState} from 'react';
import {useQueryClient} from '@tanstack/react-query';
import {BellRing,ShieldCheck,X} from 'lucide-react';
import {enablePush,pushKey,pushSupported,registeredDevice} from '../features/notifications/pushDevice';
import {currentPushPrompt,snoozePushPrompt,type PushPromptState} from '../features/notifications/pushPrompt';

export function PushPermissionPrompt({userId,hotelId,active,onSettings}:{userId:string;hotelId:string;active:boolean;onSettings:()=>void}){
 const [prompt,setPrompt]=useState<PushPromptState>(null);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const client=useQueryClient();
 useEffect(()=>{
  if(!active||busy)return;
  const refresh=()=>{
   const supported=pushSupported();
   setPrompt(currentPushPrompt(userId,hotelId,{admin:true,supported,configured:!!pushKey,registered:!!registeredDevice(userId,hotelId),permission:supported?Notification.permission:'default'}));
  };
  // Wait until the authenticated workspace has mounted. Never invoke the
  // native permission dialog without an explicit user gesture.
  const timer=window.setTimeout(refresh,900);
  const visible=()=>{if(document.visibilityState==='visible')refresh();};
  window.addEventListener('focus',visible);document.addEventListener('visibilitychange',visible);
  window.addEventListener('storage',refresh);
  return()=>{window.clearTimeout(timer);window.removeEventListener('focus',visible);document.removeEventListener('visibilitychange',visible);window.removeEventListener('storage',refresh);};
 },[userId,hotelId,active,busy]);
 const dismiss=()=>{snoozePushPrompt(userId,hotelId);setPrompt(null);setError('');};
 async function accept(){
  setBusy(true);setError('');
  try{
   await enablePush(userId,hotelId);
   setPrompt(null);
   await client.invalidateQueries({queryKey:['push-devices',hotelId,userId]});
  }catch{
   if(pushSupported()&&Notification.permission==='denied'){
    setPrompt('blocked');setError('');
   }else setError('Notifications could not be enabled. Try again or open notification settings.');
  }finally{setBusy(false);}
 }
 if(!active||!prompt)return null;
 return <aside className="push-permission-prompt" aria-label="Enable hotel notifications">
  <header><span className="push-prompt-icon"><BellRing size={22} aria-hidden="true"/></span><button type="button" className="icon-btn" aria-label="Dismiss notification reminder" disabled={busy} onClick={dismiss}><X size={18}/></button></header>
  <h2>{prompt==='blocked'?'Notifications are blocked':prompt==='repair'?'Restore device notifications':'Stay updated with hotel notifications'}</h2>
  <p>{prompt==='blocked'?'Allow notifications for this site in your browser or device settings, then return to the PMS to enable them.':prompt==='repair'?'Your browser permission has changed. Restore notifications for the selected hotel.':'Receive booking, payment, operational and staff alerts for the selected hotel, even after signing out.'}</p>
  <div className="push-prompt-privacy"><ShieldCheck size={17} aria-hidden="true"/><span>Enable only on a personal or trusted device. You can disable notifications anytime from the bell settings.</span></div>
  {error&&<p role="alert" className="push-prompt-error">{error}</p>}
  <div className="push-prompt-actions">
   <button type="button" className="btn-primary" disabled={busy} onClick={prompt==='blocked'?onSettings:()=>void accept()}>{busy?'Enabling…':prompt==='blocked'?'Notification settings':prompt==='repair'?'Restore notifications':'Enable notifications'}</button>
   <button type="button" className="btn-inline" disabled={busy} onClick={dismiss}>Not now</button>
  </div>
 </aside>;
}
