import {useRef,useState} from 'react';
import {useQueryClient} from '@tanstack/react-query';
import {ClipboardList,Plus} from 'lucide-react';
import {useHotelAuth} from './AuthProvider';
import {QueryFeedback} from './QueryFeedback';
import {addSpecialRequest,requestTags,useSpecialRequests} from '../api/reservationSpecialRequests';
import type {SpecialRequestTag} from '../api/reservationSpecialRequests';
import {readSession} from '../api/session';

const labels:Record<SpecialRequestTag,string>={
 late_arrival:'Late arrival',quiet_room:'Quiet room',extra_bedding:'Extra bedding',
 accessibility:'Accessibility request',connecting_rooms:'Connecting rooms',
 other:'Other request',
};

export function ReservationSpecialRequests({bookingId,canEdit}:{
 bookingId:string;canEdit:boolean;
}){
 const {hotelId}=useHotelAuth();
 const client=useQueryClient();
 const [tag,setTag]=useState<SpecialRequestTag>('quiet_room');
 const [note,setNote]=useState('');
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [success,setSuccess]=useState('');
 const retry=useRef<{idempotencyKey:string;tag:SpecialRequestTag;note:string}|null>(null);
 const list=useSpecialRequests(bookingId);
 async function save(){
  const current=readSession().hotelId;
  if(!hotelId||current!==hotelId||!canEdit||busy||note.trim().length<5)return;
  const input=retry.current??{idempotencyKey:crypto.randomUUID(),tag,note:note.trim()};
  retry.current=input;
  setBusy(true);setError('');setSuccess('');
  try{
   await addSpecialRequest(hotelId,bookingId,input);
   if(readSession().hotelId!==hotelId)return;
   await client.invalidateQueries({queryKey:['live','special-requests',hotelId,bookingId]});
   setSuccess('Special request saved with staff attribution. It is not a guarantee or charge.');
   setNote('');retry.current=null;
  }catch(e){setError(e instanceof Error?e.message:'Could not save special request.');}
  finally{setBusy(false);}
 }
 return <div className="special-request-workspace">
  <div className="desk-tools"><h4><ClipboardList size={16}/> Guest special requests</h4>
   <button type="button" className="btn-inline" onClick={()=>void list.refetch()}>Refresh</button></div>
  <QueryFeedback loading={list.isPending} error={list.error} onRetry={()=>void list.refetch()}/>
  {list.data?.data.length===0&&<p className="desk-muted">No special requests recorded for this reservation.</p>}
  {list.data?.data.map(item=><article key={item.id} className="special-request-item">
   <strong>{labels[item.tag]}</strong><p>{item.note}</p>
   <small>Recorded by staff #{item.createdBy} · {item.createdAt}</small>
  </article>)}
  {list.data&&list.data.meta.total>list.data.data.length&&
   <p className="desk-muted">Showing latest 30 requests. Earlier records remain in the database.</p>}
  {canEdit&&<div className="special-request-form">
   <label>Request category
    <select className="wizard-input" value={tag} disabled={busy}
     onChange={e=>{setTag(e.target.value as SpecialRequestTag);retry.current=null;setError('');}}>
     {requestTags.map(value=><option key={value} value={value}>{labels[value]}</option>)}
    </select>
   </label>
   <label>Guest instructions or special requirement
    <textarea className="wizard-input" rows={3} maxLength={1000} value={note}
     disabled={busy} onChange={e=>{setNote(e.target.value);retry.current=null;setError('');}}
     placeholder="Record the request without entering IDs, payment credentials or unnecessary sensitive details."/>
   </label>
   <button type="button" className="btn-primary" disabled={busy||note.trim().length<5}
    onClick={()=>void save()}><Plus size={15}/> {busy?'Saving…':'Record special request'}</button>
   <p className="desk-muted">Requests are recorded, not promised. They do not automatically reserve another room, change the booking, or post a fee. Avoid unnecessary medical or identity data.</p>
   {error&&<p role="alert" className="stay-feedback-error">{error}</p>}
   {success&&<p role="status" className="stay-feedback-success">{success}</p>}
  </div>}
 </div>;
}
