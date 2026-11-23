import {useEffect,useId,useRef,useState} from 'react';
import {ArrowRight,X} from 'lucide-react';
import {requestJson} from '../api/http';
import type {LiveRecord} from '../api/liveReservations';
import {hotelPath,readSession} from '../api/session';
import {addDays} from '../features/reservations/calendarDate';
import {dateLabel} from '../lib/format';

type ExtensionQuote = {
 checkOut:string;nights:number;nightlyMinor:number;subtotalMinor:number;currency:string;saved:boolean;
};

export function StayExtensionModal({hotelId,record,today,openOnEntry=false,disabled=false,hideTrigger=false,onDismiss,onSaved}:{
 hotelId:string;record:Pick<LiveRecord,'id'|'reference'|'checkOut'>;today:string;
 openOnEntry?:boolean;disabled?:boolean;hideTrigger?:boolean;onDismiss?:()=>void;onSaved:()=>void;
}){
 const titleId=useId();
 const dialog=useRef<HTMLDialogElement>(null);
 const trigger=useRef<HTMLButtonElement>(null);
 const minimum=addDays(record.checkOut>today?record.checkOut:today,1);
 const [date,setDate]=useState(minimum);
 const [quote,setQuote]=useState<ExtensionQuote|null>(null);
 const [message,setMessage]=useState('');
 const [error,setError]=useState('');
 const [busy,setBusy]=useState(false);
 const requestInProgress=useRef(false);
 const quoteDeparture=useRef('');
 useEffect(()=>{
  if(openOnEntry&&!dialog.current?.open)dialog.current?.showModal();
 },[openOnEntry]);

 function open(){
  setDate(minimum);setQuote(null);setError('');setMessage('');
  dialog.current?.showModal();
 }

 async function submit(save:boolean){
  if(requestInProgress.current||date<minimum||readSession().hotelId!==hotelId)return;
  if(save&&(!quote||quoteDeparture.current!==record.checkOut))return;
  requestInProgress.current=true;setBusy(true);setError('');setMessage('');
  try{
   const result=await requestJson<{data:ExtensionQuote}>(hotelPath('/bookings/'+record.id+'/extend-stay'),{
    method:'POST',body:{
     expectedCheckOut:record.checkOut,checkOut:date,
     ...(save?{expectedNightlyMinor:quote!.nightlyMinor}:{}),
    },
   });
   if(readSession().hotelId!==hotelId)return;
   if(result.data.saved){
    setQuote(null);setMessage('Stay extended. New departure: '+dateLabel(result.data.checkOut)+'. The added nights are on the guest bill.');
    onSaved();
   }else{
    quoteDeparture.current=record.checkOut;setQuote(result.data);
   }
  }catch(cause){
   setQuote(null);setError(cause instanceof Error?cause.message:'Could not extend this stay.');
  }finally{requestInProgress.current=false;setBusy(false);}
 }
 const canConfirm=!!quote&&quoteDeparture.current===record.checkOut;
 const currency=new Intl.NumberFormat('en-PH',{style:'currency',currency:quote?.currency??'PHP'});
 return <>
  {!hideTrigger&&<button ref={trigger} type="button" className="btn-inline" aria-haspopup="dialog" disabled={disabled}
   onClick={open}>Extend stay <ArrowRight size={15}/></button>}
  <dialog ref={dialog} className="billing-action-modal" aria-labelledby={titleId}
   style={{margin:'auto',width:'min(480px, calc(100% - 32px))',color:'var(--text)'}}
   onCancel={event=>{if(requestInProgress.current)event.preventDefault();}}
   onClose={()=>{trigger.current?.focus();onDismiss?.();}}>
   <header className="billing-action-modal-header">
    <div><h3 id={titleId}>Extend stay</h3>
     <p>{record.reference} · Current departure {dateLabel(record.checkOut)}</p></div>
    <button type="button" className="billing-modal-dismiss" aria-label="Close extend stay"
     disabled={busy} onClick={()=>dialog.current?.close()}><X size={20}/></button>
   </header>
  {message?<div><p role="status" className="stay-feedback-success">{message}</p>
   <button type="button" className="btn-primary" onClick={()=>dialog.current?.close()}>Done</button></div>:
  <form className="billing-payment-fields" onSubmit={event=>{event.preventDefault();void submit(canConfirm);}}>
   <label className="night-audit-date">New departure date
    <input className="wizard-input" type="date" required min={minimum} value={date} disabled={busy}
     onChange={event=>{setDate(event.target.value);setQuote(null);setError('');setMessage('');}}/>
   </label>
   {canConfirm&&<p role="status">{quote.nights} added {quote.nights===1?'night':'nights'} at {currency.format(quote.nightlyMinor/100)} per night.
    {' '}<strong>{currency.format(quote.subtotalMinor/100)} room subtotal.</strong></p>}
   <button type="submit" className="btn-primary" disabled={busy||date<minimum}>
    {busy?'Working…':canConfirm?'Confirm extension':'Check availability and rate'}
   </button>
   {error&&<p role="alert" className="stay-feedback-error">{error}</p>}
  </form>}
  </dialog>
 </>;
}
