import {useEffect,useRef,useState} from 'react';
import {Link} from '@tanstack/react-router';
import {MessageCircle,X} from 'lucide-react';
import {messageArrivals,type ArrivalConversation} from '../features/messages/messageArrivals';

export function MessageArrivalAlert({conversations,userId}:{conversations:readonly ArrivalConversation[]|undefined;userId:string}){
 const previous=useRef<Map<number,number>|null>(null);
 const audio=useRef<AudioContext|null>(null);
 const [pending,setPending]=useState<number[]>([]);
 // Browsers only permit audible playback after a user gesture.
 useEffect(()=>{
  const unlock=()=>{
   try{
    if(!audio.current&&typeof AudioContext!=='undefined')audio.current=new AudioContext();
    if(audio.current?.state==='suspended')void audio.current.resume().catch(()=>{});
   }catch{/* The visual alert remains available. */}
  };
  window.addEventListener('pointerdown',unlock);
  window.addEventListener('keydown',unlock);
  return ()=>{
   window.removeEventListener('pointerdown',unlock);window.removeEventListener('keydown',unlock);
   const context=audio.current;audio.current=null;
   if(context)void context.close().catch(()=>{});
  };
 },[]);
 useEffect(()=>{
  if(!conversations)return;
  const {next,arrivals}=messageArrivals(previous.current,conversations,userId);
  previous.current=next;
  if(!arrivals.length)return;
  setPending(old=>[...new Set([...old,...arrivals])]);
  const context=audio.current;
  if(context?.state!=='running')return;
  try{
   const start=context.currentTime;
   for(const [index,frequency] of [660,880].entries()){
    const tone=context.createOscillator(),gain=context.createGain();
    const at=start+index*.14;
    tone.frequency.value=frequency;gain.gain.setValueAtTime(.001,at);
    gain.gain.exponentialRampToValueAtTime(.12,at+.025);
    gain.gain.exponentialRampToValueAtTime(.001,at+.13);
    tone.connect(gain);gain.connect(context.destination);
    tone.onended=()=>{tone.disconnect();gain.disconnect();};
    tone.start(at);tone.stop(at+.14);
   }
  }catch{/* Playback may be blocked or suspended by the browser. */}
 },[conversations,userId]);
 if(!pending.length)return null;
 return <aside className="message-arrival-alert" aria-label="Incoming staff messages">
  <MessageCircle size={24} aria-hidden="true"/>
  <div className="message-arrival-copy">
   <strong role="status" aria-live="polite">{pending.length===1?'New staff message':'New messages in '+pending.length+' conversations'}</strong>
   <Link to="/messages" search={pending.length===1?{conversation:String(pending[0])}:{}} onClick={()=>setPending([])}>{pending.length===1?'Open conversation':'Open messages'}</Link>
  </div>
  <button type="button" aria-label="Dismiss message alert" onClick={()=>setPending([])}><X size={19}/></button>
 </aside>;
}
