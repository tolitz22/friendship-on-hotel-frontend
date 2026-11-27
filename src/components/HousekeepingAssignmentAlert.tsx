import {useEffect,useRef,useState} from 'react';
import {Link} from '@tanstack/react-router';
import {BellRing,Volume2,VolumeX,X,ArrowRight} from 'lucide-react';
import {newHousekeepingAlerts,selectHousekeepingAttention,readDismissedHousekeepingAlerts,dismissHousekeepingAlert,type HousekeepingAlert} from '../features/notifications/housekeepingAttention';

function chime(context:AudioContext|null){
 if(context?.state!=='running')return false;
 try{
  const start=context.currentTime;
  for(const [index,frequency] of [523,659,784].entries()){
   const oscillator=context.createOscillator(),gain=context.createGain(),at=start+index*.16;
   oscillator.frequency.value=frequency;gain.gain.setValueAtTime(.001,at);
   gain.gain.exponentialRampToValueAtTime(.12,at+.025);
   gain.gain.exponentialRampToValueAtTime(.001,at+.15);
   oscillator.connect(gain);gain.connect(context.destination);
   oscillator.onended=()=>{oscillator.disconnect();gain.disconnect();};
   oscillator.start(at);oscillator.stop(at+.16);
  }
  return true;
 }catch{return false;}
}
export function HousekeepingAssignmentAlert({scope,alerts,read,onRead,dialogOpen}:{scope:string;alerts:readonly HousekeepingAlert[]|undefined;read:readonly string[];onRead:(ids:string[])=>void;dialogOpen:boolean}){
 const soundKey=scope+':sound';
 const [muted,setMuted]=useState(()=>{try{return localStorage.getItem(soundKey)==='off';}catch{return false;}});
 const [unlocked,setUnlocked]=useState(false);
 const dismissKey=scope+':dismissed:v1';
 const [dismissed,setDismissed]=useState<string[]>(()=>{try{return readDismissedHousekeepingAlerts(localStorage.getItem(dismissKey));}catch{return [];}});
 useEffect(()=>{
  const sync=(event:StorageEvent)=>{if(event.key===dismissKey||event.key===null)setDismissed(readDismissedHousekeepingAlerts(event.key===null?null:event.newValue));};
  window.addEventListener('storage',sync);
  return ()=>window.removeEventListener('storage',sync);
 },[dismissKey]);
 function dismiss(id:string){
  let next=dismissHousekeepingAlert(dismissed,id);
  try{
   next=dismissHousekeepingAlert([...dismissed,...readDismissedHousekeepingAlerts(localStorage.getItem(dismissKey))],id);
   localStorage.setItem(dismissKey,JSON.stringify(next));
  }catch{/* Keep dismissal in memory if browser storage is unavailable. */}
  setDismissed(next);
 }
 const previous=useRef<Set<string>|null>(null);
 const heard=useRef(new Set<string>());
 const audio=useRef<AudioContext|null>(null);
 const muteRef=useRef(muted);muteRef.current=muted;
 useEffect(()=>{
  function unlock(){
   if(muteRef.current)return;
   try{
    if(!audio.current&&typeof AudioContext!=='undefined')audio.current=new AudioContext();
    const context=audio.current;
    if(context?.state==='running')setUnlocked(true);
    else if(context)void context.resume().then(()=>setUnlocked(context.state==='running')).catch(()=>{});
   }catch{/* Visual alert remains available. */}
  }
  window.addEventListener('pointerdown',unlock);window.addEventListener('keydown',unlock);
  return ()=>{window.removeEventListener('pointerdown',unlock);window.removeEventListener('keydown',unlock);const context=audio.current;audio.current=null;if(context)void context.close().catch(()=>{});};
 },[]);
 useEffect(()=>{
  if(!alerts)return;
  const {seen,arrivals}=newHousekeepingAlerts(previous.current,alerts,new Set([...read,...dismissed]));
  previous.current=seen;
  const fresh=arrivals.filter(item=>!heard.current.has(item.id));
  for(const item of fresh)heard.current.add(item.id);
  if(fresh.length&&!muteRef.current)chime(audio.current);
 },[alerts,read,dismissed]);
 async function toggleSound(){
  const next=!muted;setMuted(next);muteRef.current=next;
  try{localStorage.setItem(soundKey,next?'off':'on');}catch{}
  if(!next){
   try{
    if(!audio.current&&typeof AudioContext!=='undefined')audio.current=new AudioContext();
    const context=audio.current;
    if(context){await context.resume();setUnlocked(chime(context));}
   }catch{}
  }
 }
 const unread=selectHousekeepingAttention(alerts??[],new Set([...read,...dismissed]));
 const first=unread[0];
 if(dialogOpen||!first)return null;
 const title=first.kind==='hk_arrival_urgent'?'Urgent arrival cleaning':first.kind==='hk_assigned'?'New housekeeping assignment':'Housekeeping task overdue';
 return <aside className="hk-assignment-toast" aria-label="Housekeeping attention">
  <div className="hk-assignment-toast-heading"><span className="hk-assignment-toast-icon"><BellRing size={23}/></span><div><strong role="status" aria-live="polite">{title}</strong><span>{first.reference}{unread.length>1?' · '+unread.length+' unread alerts':''}</span></div>
   <button type="button" className="hk-assignment-dismiss" aria-label="Dismiss alert without marking read" onClick={()=>dismiss(first.id)}><X size={19}/></button></div>
  <div className="hk-assignment-toast-actions"><Link to="/housekeeping" search={{task:first.taskId}} onClick={()=>onRead([first.id])} className="hk-assignment-open">Open task <ArrowRight size={17}/></Link>
   <button type="button" className="hk-assignment-sound" aria-label={muted?'Enable assignment sound':'Mute assignment sound'} aria-pressed={muted} onClick={()=>void toggleSound()}>{muted?<VolumeX size={18}/>:<Volume2 size={18}/>}</button></div>
  {!muted&&!unlocked&&<small>Tap or press a key in the PMS to allow alert sounds on this device.</small>}
 </aside>;
}
