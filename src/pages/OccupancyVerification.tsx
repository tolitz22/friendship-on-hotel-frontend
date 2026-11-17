import {useEffect,useState} from 'react';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {Link} from '@tanstack/react-router';
import {AlertTriangle,ClipboardCheck,RefreshCw,ShieldCheck} from 'lucide-react';
import {useHotelAuth} from '../components/AuthProvider';
import {Heading,Panel} from '../components/ui';
import {QueryFeedback} from '../components/QueryFeedback';
import {readSession} from '../api/session';
import {useLiveRooms} from '../api/liveCatalogQueries';
import {listHotelStaff} from '../api/liveStaff';
import {assignOccupancy,observeOccupancy,reviewOccupancy,occupancyHistory,useOccupancyVerifications} from '../api/occupancyVerifications';
import type {OccupancyVerification} from '../api/occupancyVerifications';

function CheckCard({check,manager,onChanged}:{check:OccupancyVerification;manager:boolean;onChanged:()=>void}){
 const {hotelId}=useHotelAuth();
 const [observed,setObserved]=useState<'occupied'|'vacant'|'unknown'>('unknown');
 const [note,setNote]=useState('');
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [message,setMessage]=useState('');
 const [showHistory,setShowHistory]=useState(false);
 const history=useQuery({
  queryKey:['live','occupancy-history',hotelId,check.id],
  enabled:showHistory&&!!hotelId,
  queryFn:()=>occupancyHistory(hotelId!,check.id),retry:false,
 });
 async function submit(action:'observe'|'verified'|'flagged'){
  if(!hotelId||busy||note.trim().length<5)return;
  setBusy(true);setError('');setMessage('');
  try{
   if(action==='observe')await observeOccupancy(hotelId,check.id,{observedOccupancy:observed,note:note.trim()});
   else await reviewOccupancy(hotelId,check.id,{decision:action,note:note.trim()});
   if(readSession().hotelId!==hotelId)return;
   setMessage('Recorded and audited.');setNote('');onChanged();
  }catch(e){setError(e instanceof Error?e.message:'Result uncertain. Refresh before retrying.');}
  finally{setBusy(false);}
 }
 return <article className="ex-record">
  <div className="desk-tools"><strong>Room {check.roomNumber} · {check.inspectionDate}</strong>
   <span>{check.status.replaceAll('_',' ')} · Verifier #{check.assignedUserId}</span></div>
  {check.status==='assigned'&&<p>Awaiting independent room observation. This does not require entering an occupied guest room.</p>}
  {check.status!=='assigned'&&<>
   <p><strong>Observed:</strong> {check.observedOccupancy} · <strong>Registered PMS state:</strong> {check.expectedOccupancy}</p>
   <p><strong>Comparison:</strong> {(check.discrepancy??'unavailable').replaceAll('_',' ')}
    {' · '}Linked checked-in reservations: {check.expectedBookingIds?.join(', ')||'none'}</p>
   <p className="desk-muted">Original observation: {check.observationNote}</p>
  </>}
  {check.status==='assigned'&&!manager&&<div className="wizard-fields">
   <label>Occupancy observed
    <select className="wizard-input" value={observed} onChange={e=>setObserved(e.target.value as typeof observed)}>
     <option value="unknown">Unable to verify</option><option value="occupied">Occupied (observed)</option>
     <option value="vacant">Vacant (observed)</option>
    </select></label>
   <label>Observation evidence and limitations
    <textarea className="wizard-input" maxLength={1500} rows={2} value={note}
     onChange={e=>setNote(e.target.value)} placeholder="What did you observe? Avoid guest identity or unnecessary personal details."/></label>
   <button className="btn-primary" type="button" disabled={busy||note.trim().length<5}
    onClick={()=>void submit('observe')}>Submit observation once</button>
  </div>}
  {check.status==='submitted'&&manager&&<div className="wizard-fields">
   <label>Manager investigation / review note
    <textarea className="wizard-input" value={note} maxLength={1500} rows={2}
     onChange={e=>setNote(e.target.value)} placeholder="Record independent checks and any limitations."/></label>
   <div className="desk-tools">
    <button type="button" className="btn-primary"
     disabled={busy||check.discrepancy!=='match'||note.trim().length<5}
     onClick={()=>void submit('verified')}><ShieldCheck size={16}/> Verify matching evidence</button>
    <button type="button" className="btn-inline" disabled={busy||note.trim().length<5}
     onClick={()=>void submit('flagged')}><AlertTriangle size={16}/> Flag for investigation</button>
   </div>
  </div>}
  {check.reviewNote&&<p>Manager note: {check.reviewNote}</p>}
  <button type="button" className="btn-inline" aria-expanded={showHistory}
   onClick={()=>setShowHistory(v=>!v)}>Show {showHistory?'less':'more'} audit history</button>
  {showHistory&&<div><QueryFeedback loading={history.isPending} error={history.error}/>
   {history.data?.data.map((event:{id:string;event:string;actorId:string;createdAt:string})=><p key={event.id} className="desk-muted">
    {event.event} · Staff #{event.actorId} · {event.createdAt}
   </p>)}</div>}
  {error&&<p role="alert" className="auth-error">{error}</p>}
  {message&&<p role="status">{message}</p>}
 </article>;
}

export function OccupancyVerification(){
 const {hotelId,user}=useHotelAuth();
 const role=user?.hotels.find(h=>h.id===hotelId)?.role;
 const manager=role==='admin';
 const allowed=role==='admin'||role==='housekeeping';
 const [page,setPage]=useState(1);
 const [status,setStatus]=useState('all');
 const [roomId,setRoomId]=useState('');
 const [assignee,setAssignee]=useState('');
 const [error,setError]=useState('');
 const [message,setMessage]=useState('');
 const [saving,setSaving]=useState(false);
 const client=useQueryClient();
 const checks=useOccupancyVerifications(allowed,page,status==='all'?undefined:status as OccupancyVerification['status']);
 const rooms=useLiveRooms({page:1,perPage:100});
 const staff=useQuery({queryKey:['hotel-staff',hotelId],queryFn:listHotelStaff,enabled:manager});
 const eligible=staff.data?.data.filter(person=>person.role==='housekeeping'&&person.isActive)??[];
 useEffect(()=>{setPage(1);setStatus('all');setRoomId('');setAssignee('');setError('');setMessage('');},[hotelId]);
 const refresh=()=>{if(hotelId)void client.invalidateQueries({queryKey:['live','occupancy-verifications',hotelId]});};
 async function assign(){
  if(!hotelId||saving||!roomId||!assignee)return;
  setSaving(true);setError('');setMessage('');
  try{
   // Local hotel date is the same basis as the existing front desk date helper.
   const hotelDate=checks.data?.meta.hotelDate;
   if(!hotelDate)throw new Error('Load the hotel verification list before assigning inspections.');
   await assignOccupancy(hotelId,{roomId,assignedUserId:assignee,inspectionDate:hotelDate});
   if(readSession().hotelId!==hotelId)return;
   setMessage('Daily check assigned.');setRoomId('');setAssignee('');refresh();
  }catch(e){setError(e instanceof Error?e.message:'Unable to assign room check.');}
  finally{setSaving(false);}
 }
 if(!allowed)return <><Heading title="Independent occupancy verification" description="Only assigned housekeeping and managers may use this workspace."/>
  <Panel title="Access restricted"><p>Laravel enforces role and per-assignment access.</p></Panel></>;
 return <>
  <Heading title="Independent occupancy verification" description={manager
   ?'Assign physical room checks and investigate mismatches against recorded check-ins.'
   :'Record an independent, factual room observation on each assigned check.'}/>
  {manager&&<div className="desk-tools"><Link to="/occupancy-coverage" className="btn-inline">
   View daily occupancy coverage and discrepancies
  </Link></div>}
  {manager&&<Panel title="Assign a room inspection">
   <p>One independent observation per room per hotel-local date. Assign an active housekeeping staff member, not the front desk.</p>
   <div className="wizard-fields">
    <label>Room
     <select className="wizard-input" value={roomId} onChange={e=>setRoomId(e.target.value)}>
      <option value="">Choose registered room</option>
      {rooms.data?.data.map(room=><option key={room.id} value={room.id}>{room.number}</option>)}
     </select></label>
    <label>Independent verifier
     <select className="wizard-input" value={assignee} onChange={e=>setAssignee(e.target.value)}>
      <option value="">Choose housekeeping staff</option>
      {eligible.map(person=><option key={person.userId} value={person.userId}>{person.name}</option>)}
     </select></label>
    <button type="button" className="btn-primary" disabled={saving||!roomId||!assignee}
     onClick={()=>void assign()}><ClipboardCheck size={16}/> Assign today's check</button>
   </div>
   {rooms.data?.meta.total!==undefined&&rooms.data.meta.total>100&&
    <p className="desk-muted">Only the first 100 rooms are listed. Use the rooms page or add room search before inspecting larger properties.</p>}
   <QueryFeedback loading={staff.isPending} error={staff.error}/>
   {error&&<p role="alert" className="auth-error">{error}</p>}
   {message&&<p role="status">{message}</p>}
  </Panel>}
  <Panel title={manager?'Hotel verification records':'My assigned room checks'}>
   <div className="desk-tools">
    <label>Filter status{' '}
     <select className="wizard-input" value={status} onChange={e=>{setPage(1);setStatus(e.target.value);}}>
      <option value="all">All</option><option value="assigned">Assigned</option>
      <option value="submitted">Needs review</option><option value="verified">Verified</option>
      <option value="flagged">Flagged</option>
     </select></label>
    <button type="button" className="btn-inline" onClick={()=>void checks.refetch()}><RefreshCw size={16}/> Refresh</button>
   </div>
   <QueryFeedback loading={checks.isPending} error={checks.error}
    empty={checks.isSuccess&&checks.data.data.length===0}/>
   {checks.data?.data.map(check=><CheckCard key={hotelId+'-'+check.id} check={check}
    manager={manager} onChanged={refresh}/>)}
   {checks.data&&<div className="desk-tools">
    <span>Page {checks.data.meta.page} of {Math.max(1,checks.data.meta.totalPages)}</span>
    <div className="desk-date-nav">
     <button className="btn-inline" type="button" disabled={page<=1} onClick={()=>setPage(p=>p-1)}>Previous</button>
     <button className="btn-inline" type="button" disabled={page>=checks.data.meta.totalPages}
      onClick={()=>setPage(p=>p+1)}>Next</button>
    </div>
   </div>}
  </Panel>
  <p className="desk-preview-note"><AlertTriangle size={16}/>
   This compares staff observations with registered checked-in reservations, not actual payments or independent access logs. A mismatch is a lead for investigation, not proof of fraud. Never enter a guest's room without consent and hotel procedure.</p>
 </>;
}
