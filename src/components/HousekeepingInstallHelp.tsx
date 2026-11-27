import {useEffect,useState} from 'react';
type InstallEvent=Event&{prompt:()=>Promise<void>;userChoice:Promise<{outcome:'accepted'|'dismissed'}>};
export function HousekeepingInstallHelp(){
 const [event,setEvent]=useState<InstallEvent|null>(null);
 const [installed,setInstalled]=useState(()=>window.matchMedia('(display-mode: standalone)').matches||Boolean((navigator as Navigator&{standalone?:boolean}).standalone));
 const [open,setOpen]=useState(false);
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState('');
 useEffect(()=>{
  const capture=(e:Event)=>{e.preventDefault();setEvent(e as InstallEvent);};
  const done=()=>{setInstalled(true);setEvent(null);};
  window.addEventListener('beforeinstallprompt',capture);
  window.addEventListener('appinstalled',done);
  return ()=>{window.removeEventListener('beforeinstallprompt',capture);window.removeEventListener('appinstalled',done);};
 },[]);
 if(installed)return null;
 async function install(){
  if(!event||busy)return;
  setBusy(true);setMessage('');
  try{await event.prompt();const result=await event.userChoice;setMessage(result.outcome==='accepted'?'Installation requested.':'Installation dismissed. You can use your browser menu.');}
  catch{setMessage('Installation prompt unavailable. Use your browser menu.');}
  finally{setEvent(null);setBusy(false);}
 }
 return <section className="hk-install-help" aria-label="Install housekeeping workspace">
  <button type="button" className="btn-inline" aria-expanded={open} onClick={()=>setOpen(v=>!v)}>{open?'Hide app installation help':'Install PMS on this device'}</button>
  {open&&<><p>Open your housekeeping workspace from your home screen. A network connection is still required to load or save hotel records.</p>
   {event?<button className="btn-primary" type="button" disabled={busy} onClick={()=>void install()}>{busy?'Opening installer…':'Install app'}</button>:<p>On Android, use your browser menu and choose Install app or Add to Home screen if available. On iPhone, open Safari, tap Share, then Add to Home Screen.</p>}
   {message&&<p role="status">{message}</p>}
  </>}
 </section>;
}
