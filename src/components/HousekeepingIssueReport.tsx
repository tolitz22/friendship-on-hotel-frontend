import {useState,type FormEvent} from 'react';
import {useQueryClient} from '@tanstack/react-query';
import {Link} from '@tanstack/react-router';
import {reportHousekeepingMaintenance,type MaintenancePriority} from '../api/liveMaintenance';
import {readSession} from '../api/session';
import type {LiveHousekeepingTask} from '../api/liveHousekeeping';
export function HousekeepingIssueReport({hotelId,task,disabled}:{hotelId:string;task:LiveHousekeepingTask;disabled:boolean}){
 const client=useQueryClient();
 const [open,setOpen]=useState(false);
 const [title,setTitle]=useState('');
 const [description,setDescription]=useState('');
 const [priority,setPriority]=useState<MaintenancePriority>('medium');
 const [impact,setImpact]=useState(false);
 const [key,setKey]=useState(()=>crypto.randomUUID());
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [created,setCreated]=useState<string|null>(null);
 async function submit(event:FormEvent){
  event.preventDefault();if(busy||disabled||!title.trim()||!description.trim())return;
  setBusy(true);setError('');
  try{
   const order=await reportHousekeepingMaintenance(hotelId,task.id,task.roomId,{title:title.trim(),description:description.trim(),priority,affectsRoom:impact,requestKey:key});
   if(readSession().hotelId!==hotelId)return;
   setCreated(order.id);setOpen(false);setTitle('');setDescription('');setPriority('medium');setImpact(false);setKey(crypto.randomUUID());
   void Promise.all([['live-maintenance',hotelId],['live-maintenance-status-totals',hotelId],['live','maintenance-for-housekeeping',hotelId],['live','housekeeping-room-board',hotelId],['live','room-readiness',hotelId],['live','readiness-dashboard',hotelId],['live','room-rack',hotelId],['live','room-inventory-status',hotelId]].map(queryKey=>client.invalidateQueries({queryKey}))).catch(()=>{});
  }catch(e){setError(e instanceof Error?e.message:'Unable to report issue. Retry the same report.');}
  finally{setBusy(false);}
 }
 return <section className="hk-report-panel" aria-label="Report room issues">
  <div className="hk-report-actions"><button className="btn-inline" type="button" disabled={disabled||busy} onClick={()=>setOpen(v=>!v)}>{open?'Hide maintenance form':'Report maintenance issue'}</button>
   <Link to="/lost-found" search={{room:task.roomId}} className="btn-inline">Register found item</Link></div>
  {created&&<p role="status">Work order #{created} recorded. <Link to="/maintenance" search={{order:created}}>View work order</Link></p>}
  {open&&<form className="hk-report-form" onSubmit={event=>void submit(event)}>
   <label>Issue title<input required maxLength={160} value={title} disabled={busy} onChange={e=>setTitle(e.target.value)} placeholder="e.g. Water leak"/></label>
   <label>Details<textarea required maxLength={5000} value={description} disabled={busy} onChange={e=>setDescription(e.target.value)}/></label>
   <label>Severity<select value={priority} disabled={busy} onChange={e=>setPriority(e.target.value as MaintenancePriority)}>{['low','medium','high','urgent'].map(p=><option key={p} value={p}>{p}</option>)}</select></label>
   <label className="hk-report-check"><input type="checkbox" checked={impact} disabled={busy} onChange={e=>setImpact(e.target.checked)}/> Prevents the room from being marked ready</label>
   <small>Room-impacting issues block readiness; reception must separately manage inventory restrictions. Urgent hazards should also be reported directly to the duty manager.</small>
   {error&&<p role="alert">{error}</p>}
   <button type="submit" className="btn-primary" disabled={busy||disabled||!title.trim()||!description.trim()}>{busy?'Submitting…':'Submit work order'}</button>
  </form>}
 </section>;
}
