import {useState,type FormEvent} from 'react';
import {useQueryClient} from '@tanstack/react-query';
import {AlertTriangle,CalendarDays,CheckCircle2,LockKeyhole,Unlock} from 'lucide-react';
import {useLiveRoomBlocks} from '../api/liveReservationOperations';
import {requestJson} from '../api/http';
import {hotelPath,readSession} from '../api/session';
import {addDays} from '../features/reservations/calendarDate';
import {readableDate} from '../lib/format';

type Notice={kind:'success'|'error';message:string};
export function RoomInventoryBlockManager({hotelId,roomId,roomNumber,today,onChanged}:{
 hotelId:string;roomId:string;roomNumber:string;today:string;onChanged:()=>void;
}){
 const client=useQueryClient();
 const blocks=useLiveRoomBlocks(roomId,true);
 const [mode,setMode]=useState<'view'|'create'|'release'>('view');
 const [from,setFrom]=useState(today);
 const [until,setUntil]=useState(()=>addDays(today,1));
 const [reason,setReason]=useState('Maintenance repair');
 const [releaseId,setReleaseId]=useState<string|null>(null);
 const [busy,setBusy]=useState(false);
 const [notice,setNotice]=useState<Notice|null>(null);
 const active=blocks.data?.data.filter(block=>block.active&&block.checkOut>today)??[];
 const current=active.filter(block=>block.checkIn<=today);
 const upcoming=active.filter(block=>block.checkIn>today);
 const selected=active.find(block=>block.id===releaseId);
 const refresh=async()=>{
  await Promise.all([
   client.invalidateQueries({queryKey:['live','room-blocks',hotelId,roomId]}),
   client.invalidateQueries({queryKey:['live','room-rack',hotelId]}),
   client.invalidateQueries({queryKey:['live','room-readiness',hotelId,roomId]}),
   client.invalidateQueries({predicate:({queryKey})=>queryKey[0]==='live'&&queryKey[2]===hotelId
    &&['room-calendar','availability','room-choices','readiness-dashboard','room-inventory-status','operational-exceptions','booking-forecast'].includes(String(queryKey[1]))}),
  ]);
  onChanged();
 };
 const consistent=()=>readSession().hotelId===hotelId;
 async function create(event:FormEvent<HTMLFormElement>){
  event.preventDefault();
  if(busy||!consistent()||until<=from||from<today||reason.trim().length<3)return;
  setBusy(true);setNotice(null);
  try{
   await requestJson(hotelPath('/inventory-blocks'),{
    method:'POST',body:{roomId,checkIn:from,checkOut:until,reason:reason.trim()},
   });
   setMode('view');
   setNotice({kind:'success',message:'Room '+roomNumber+' blocked. Availability and room assignment now exclude the selected nights.'});
   await refresh();
  }catch(cause){
   setNotice({kind:'error',message:cause instanceof Error?cause.message:'Could not block the room. Review existing reservations and try again.'});
  }finally{setBusy(false);}
 }
 async function release(){
  if(busy||!consistent()||!selected)return;
  setBusy(true);setNotice(null);
  try{
   await requestJson(hotelPath('/inventory-blocks/'+selected.id+'/release'),{method:'POST'});
   setReleaseId(null);setMode('view');
   setNotice({kind:'success',message:'Inventory restriction released. Verify cleaning, inspection and maintenance readiness before allocating this room.'});
   await refresh();
  }catch(cause){
   setNotice({kind:'error',message:cause instanceof Error?cause.message:'Could not release this room block.'});
  }finally{setBusy(false);}
 }
 return <section className="room-block-manager" aria-label={'Room '+roomNumber+' inventory restrictions'}>
  <div className="room-block-manager-title">
   <div><h3><LockKeyhole size={17}/> Inventory restrictions</h3>
    <p>Take this room out of sellable inventory while maintenance is underway.</p></div>
  </div>
  {blocks.isPending&&<p role="status" className="desk-muted">Checking active inventory blocks…</p>}
  {blocks.isError&&<div><p role="alert" className="auth-error">Unable to check existing restrictions.</p>
   <button type="button" className="btn-inline" onClick={()=>void blocks.refetch()}>Retry</button></div>}
  {blocks.isSuccess&&<>
   {active.length===0?<p className="room-block-clear"><CheckCircle2 size={16}/> No active or upcoming inventory blocks</p>:
    <div className="room-block-list">
     {active.map(block=><div className="room-block-item" key={block.id}>
      <span className="room-block-item-icon"><LockKeyhole size={16}/></span>
      <div><strong>{block.reason}</strong>
       <small>{readableDate(block.checkIn)} – {readableDate(addDays(block.checkOut,-1))}</small>
       <small>{block.checkIn<=today?'Blocked now':'Scheduled block'}</small></div>
      <button type="button" className="btn-inline" disabled={busy}
       onClick={()=>{setReleaseId(block.id);setMode('release');setNotice(null);}}>Release</button>
     </div>)}
    </div>}
   {mode==='view'&&<button type="button" className="btn-inline room-block-create"
    onClick={()=>{setMode('create');setNotice(null);}}>
    <LockKeyhole size={16}/> Block room for maintenance
   </button>}
   {mode==='create'&&<form className="room-block-form" onSubmit={event=>void create(event)}>
    <strong>Schedule a room block</strong>
    <p>Bookings and room assignment will be prevented for these nights. The end date is the first night the room may return to inventory.</p>
    <label>First blocked night
     <input type="date" required value={from} min={today} onChange={event=>{
      const value=event.target.value;setFrom(value);
      if(until<=value)setUntil(addDays(value,1));
     }} disabled={busy}/>
    </label>
    <label>Return-to-inventory date (exclusive)
     <input type="date" required value={until} min={addDays(from,1)}
      onChange={event=>setUntil(event.target.value)} disabled={busy}/>
    </label>
    <label>Reason for restriction
     <textarea required rows={2} minLength={3} maxLength={300} value={reason}
      onChange={event=>setReason(event.target.value)} disabled={busy}/>
    </label>
    {(current.length>0||upcoming.length>0)&&<p className="room-block-hint">
     An existing block overlaps some dates; the server will reject overlapping restrictions.</p>}
    <div className="room-block-actions">
     <button type="button" className="btn-inline" disabled={busy} onClick={()=>setMode('view')}>Cancel</button>
     <button type="submit" className="btn-primary" disabled={busy||until<=from||from<today||reason.trim().length<3}>
      {busy?'Blocking…':'Confirm room block'}</button>
    </div>
   </form>}
   {mode==='release'&&selected&&<div className="room-block-release">
    <strong><AlertTriangle size={17}/> Return room to inventory?</strong>
    <p>Release “{selected.reason}” for {readableDate(selected.checkIn)} through {readableDate(addDays(selected.checkOut,-1))}.</p>
    <p>Only proceed after confirming repairs and physical safety. Releasing an inventory block does not complete housekeeping or inspection.</p>
    <div className="room-block-actions">
     <button type="button" className="btn-inline" disabled={busy} onClick={()=>{setMode('view');setReleaseId(null);}}>Cancel</button>
     <button type="button" className="btn-primary" disabled={busy} onClick={()=>void release()}>
      <Unlock size={15}/>{busy?'Releasing…':'Release block'}</button>
    </div>
   </div>}
  </>}
  {notice&&<p role={notice.kind==='error'?'alert':'status'} className={notice.kind==='error'?'auth-error':'guest-info'}>{notice.message}</p>}
  <p className="room-block-hint"><CalendarDays size={14}/> Restriction dates exclude the return-to-inventory day. Existing checked-in stays and reserved rooms cannot be blocked without resolving their reservation conflicts.</p>
 </section>;
}
