import {useState,type FormEvent} from 'react';
import {useQueryClient} from '@tanstack/react-query';
import {Link} from '@tanstack/react-router';
import {requestJson} from '../api/http';
import {hotelPath,readSession} from '../api/session';
import type {LiveWorkOrder} from '../api/liveMaintenance';
import {addDays} from '../features/reservations/calendarDate';

export function RoomOutOfOrderForm({order,hotelId,today}:{
 order:LiveWorkOrder;hotelId:string;today:string;
}){
 const client=useQueryClient();
 const [from,setFrom]=useState(today);
 const [until,setUntil]=useState(()=>addDays(today,1));
 const [reason,setReason]=useState(()=>('WO-'+order.id+' · '+order.title).slice(0,300));
 const [busy,setBusy]=useState(false);
 const [result,setResult]=useState<{message:string;success:boolean}|null>(null);

 async function blockRoom(event:FormEvent<HTMLFormElement>){
  event.preventDefault();
  if(busy||readSession().hotelId!==hotelId)return;
  setBusy(true);
  setResult(null);
  try{
   await requestJson(hotelPath('/inventory-blocks'),{
    method:'POST',body:{roomId:order.roomId,checkIn:from,checkOut:until,reason:reason.trim()},
   });
   setResult({success:true,message:'Room '+order.roomNumber+' is out of order from '+from+' through '+addDays(until,-1)+'.'});
   const affected=['room-blocks','room-calendar','availability','room-choices','room-readiness',
    'room-inventory-status','room-rack','readiness-dashboard','operational-exceptions'];
   await client.invalidateQueries({predicate:({queryKey})=>
    queryKey[0]==='live'&&queryKey[2]===hotelId&&typeof queryKey[1]==='string'&&affected.includes(queryKey[1])});
  }catch(error){
   setResult({success:false,message:error instanceof Error?error.message:'Check the room calendar before retrying.'});
  }finally{setBusy(false);}
 }

 return <details>
  <summary>Mark room out of order</summary>
  <form onSubmit={event=>void blockRoom(event)}>
   <p>Take this room out of sellable inventory for the selected nights. Put the first night the room can return to service in the end date.</p>
   <label className="wizard-label">First blocked night
    <input className="wizard-input" type="date" required min={today} value={from}
     onChange={event=>setFrom(event.target.value)} disabled={busy}/>
   </label>
   <label className="wizard-label">End date
    <input className="wizard-input" type="date" required min={from?addDays(from,1):undefined}
     value={until} onChange={event=>setUntil(event.target.value)} disabled={busy}/>
   </label>
   <label className="wizard-label">Reason
    <input className="wizard-input" value={reason} onChange={event=>setReason(event.target.value)}
     minLength={3} maxLength={300} required disabled={busy}/>
   </label>
   <button className="btn-primary" type="submit" disabled={busy||reason.trim().length<3||from<today||until<=from}>
    {busy?'Blocking room…':'Confirm out-of-order block'}
   </button>
   {result&&<p role={result.success?'status':'alert'}>{result.message}</p>}
   <Link to="/room-calendar" search={{date:from||today,room:order.roomNumber}}>View room calendar</Link>
  </form>
 </details>;
}
