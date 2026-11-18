import {useEffect,useState} from 'react';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {Link} from '@tanstack/react-router';
import {AlertTriangle,ArrowRight,ClipboardCheck,Info,Plus,RefreshCw,ShieldCheck,X} from 'lucide-react';
import {useHotelAuth} from '../components/AuthProvider';
import {Heading,Panel} from '../components/ui';
import {QueryFeedback} from '../components/QueryFeedback';
import {readSession} from '../api/session';
import {useLiveRooms} from '../api/liveCatalogQueries';
import {listHotelStaff} from '../api/liveStaff';
import {assignOccupancy,observeOccupancy,reviewOccupancy,occupancyHistory,useOccupancyVerifications} from '../api/occupancyVerifications';
import type {OccupancyVerification} from '../api/occupancyVerifications';
import {readableDate,readableDateTime,statusLabel} from '../lib/format';
import {auditActorName} from '../components/ReadableAuditEvent';

function CheckCard({check,manager,onChanged}:{check:OccupancyVerification;manager:boolean;onChanged:()=>void}){
 const {hotelId,user}=useHotelAuth();
 const staff=useQuery({queryKey:['hotel-staff',hotelId],queryFn:listHotelStaff,enabled:manager&&!!hotelId});
 const actor=(id:string,name?:string|null)=>auditActorName(id,name??staff.data?.data.find(m=>m.userId===id)?.name,user?.id,user?.name);
 const [observed,setObserved]=useState<'occupied'|'vacant'|'unknown'>('unknown');
 const [note,setNote]=useState('');
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [message,setMessage]=useState('');
 const [showHistory,setShowHistory]=useState(false);
 const [workDialog,setWorkDialog]=useState(false);
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
   setMessage(action==='observe'?'Observation saved for manager review.':action==='verified'?'Matching observation reviewed.':'Investigation flag recorded.');setNote('');setWorkDialog(false);onChanged();
  }catch(e){setError(e instanceof Error?e.message:'Result uncertain. Refresh before retrying.');}
  finally{setBusy(false);}
 }
 const statusText=check.status==='assigned'?'Observation needed':check.status==='submitted'
  ?'Manager review needed':check.status==='verified'?'Reviewed · matches PMS':'Investigation needed';
 const mismatch=check.discrepancy==='unexpected_occupied'?'Observed occupied, PMS has no checked-in stay':
  check.discrepancy==='expected_occupied_vacant'?'Observed vacant, PMS has a checked-in stay':
  check.discrepancy==='unverified'?'Could not confirm occupancy':'Observation matches PMS snapshot';
 const canObserve=check.status==='assigned'&&!manager;
 const canReview=check.status==='submitted'&&manager;
 const independent=check.observedBy!==user?.id;
 return <article className="occ-check-card">
  <div className="occ-check-header">
   <div><strong>Room {check.roomNumber}</strong><small>{readableDate(check.inspectionDate)} · Assigned to {actor(check.assignedUserId)}</small></div>
   <span className={'occ-status '+(check.status==='flagged'||(check.discrepancy!==null&&check.discrepancy!=='match'&&check.discrepancy!=='unverified')?'occ-danger':
    check.status==='verified'?'occ-success':'occ-attention')}>{statusText}</span>
  </div>
  {check.status!=='assigned'&&<div className="occ-check-comparison">
   <div><small>What staff observed</small><strong>{statusLabel(check.observedOccupancy??'unknown')}</strong></div>
   <div><small>Registered in the PMS at observation</small><strong>{statusLabel(check.expectedOccupancy??'unknown')}</strong></div>
  </div>}
  {check.status!=='assigned'&&<p className="occ-check-result">
   <Info size={15}/>{mismatch}. This is evidence for review, not proof of an unregistered stay.</p>}
  {check.status==='assigned'&&<p className="occ-check-result"><Info size={15}/>
   Awaiting an independent observation. Follow privacy and safe room-access procedures.</p>}
  <div className="occ-check-actions">
   {(canObserve||canReview)&&<button type="button" className="btn-primary"
    onClick={()=>{setError('');setMessage('');setWorkDialog(true);}}>
    {canObserve?'Record observation':'Review observation'} <ArrowRight size={15}/></button>}
   <button type="button" className="rr-secondary-action" aria-expanded={showHistory}
    onClick={()=>setShowHistory(v=>!v)}>{showHistory?'Hide':'View'} activity</button>
  </div>
  {workDialog&&<div className="billing-modal-backdrop"><section role="dialog" aria-modal="true"
   aria-label={canObserve?'Record room observation':'Review room observation'} className="billing-action-modal occ-check-dialog">
   <div className="billing-action-modal-header"><div><span className="rr-eyebrow">ROOM {check.roomNumber}</span>
    <h3>{canObserve?'Record what you observed':'Review the observation'}</h3>
    <p>{readableDate(check.inspectionDate)} · {canReview?mismatch:'Only record what you can safely verify.'}</p></div>
    <button type="button" className="billing-modal-dismiss" aria-label="Close dialog" disabled={busy}
     onClick={()=>setWorkDialog(false)}><X size={19}/></button></div>
   {canObserve&&<div className="occ-dialog-form">
    <p className="occ-dialog-guidance"><Info size={15}/> Do not enter a guest room without permission and approved procedures. If uncertain, choose Could not verify.</p>
    <label>Was the room physically occupied?
     <select className="wizard-input" value={observed} disabled={busy}
      onChange={e=>setObserved(e.target.value as typeof observed)}>
      <option value="unknown">Could not verify</option>
      <option value="occupied">Yes, occupied</option><option value="vacant">No, vacant</option>
     </select></label>
    <label>What did you observe?
     <textarea className="wizard-input" rows={3} maxLength={1500} value={note} disabled={busy}
      onChange={e=>setNote(e.target.value)} placeholder="Describe the observation method and any limitations. Avoid guest personal details."/></label>
    <button type="button" className="btn-primary" disabled={busy||note.trim().length<5}
     onClick={()=>void submit('observe')}>{busy?'Saving…':'Submit observation for review'}</button>
   </div>}
   {canReview&&<div className="occ-dialog-form">
    <p className="occ-dialog-guidance"><Info size={15}/>
     {independent?'Review the original observation and reservation snapshot.':'You cannot review an observation you submitted.'}
     {' '}A mismatch or unknown observation must be investigated, not marked verified.</p>
    <p className="occ-check-result">{mismatch}</p>
    <label>Review findings / next steps
     <textarea className="wizard-input" rows={3} maxLength={1500} value={note} disabled={busy}
      onChange={e=>setNote(e.target.value)} placeholder="Document independent evidence, follow-up and limitations."/></label>
    <div className="occ-dialog-buttons">
     <button type="button" className="btn-primary" disabled={busy||!independent||check.discrepancy!=='match'||note.trim().length<5}
      onClick={()=>void submit('verified')}><ShieldCheck size={16}/> Verify matching observation</button>
     <button type="button" className="rr-secondary-action" disabled={busy||!independent||note.trim().length<5}
      onClick={()=>void submit('flagged')}><AlertTriangle size={16}/> Flag for investigation</button>
    </div>
   </div>}
   {error&&<p className="auth-error" role="alert">{error}</p>}
  </section></div>}
  {check.reviewNote&&<p className="occ-manager-note"><strong>Manager review:</strong> {check.reviewNote}</p>}
  {message&&<p role="status" className="occ-check-result">{message}</p>}
  {showHistory&&<div><QueryFeedback loading={history.isPending} error={history.error}/>
   {history.data?.data.map(event=>{
    const details=event.details&&typeof event.details==='object'&&!Array.isArray(event.details)
     ?event.details as Record<string,unknown>:null;
    const titles:Record<string,string>={assigned:'Assigned room occupancy check',observed:'Recorded physical room observation',
     reviewed:'Manager reviewed room observation'};
    const note=typeof details?.note==='string'?details.note:null;
    return <article key={event.id} className="readable-audit-event">
     <strong>{titles[event.event]??statusLabel(event.event)}</strong>
     <p className="readable-audit-context">{actor(event.actorId,event.actorName)} · {readableDateTime(event.createdAt)}</p>
     {note&&<p className="readable-audit-note"><strong>Observation or decision note:</strong> {note}</p>}
     {typeof details?.observedOccupancy==='string'&&<p className="readable-audit-context">
      Observed: {statusLabel(details.observedOccupancy)}</p>}
     {typeof details?.decision==='string'&&<p className="readable-audit-context">
      Decision: {statusLabel(details.decision)}</p>}
    </article>;
   })}</div>}
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
 const [showAssign,setShowAssign]=useState(false);
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
   setMessage('Room check assigned.');setRoomId('');setAssignee('');setShowAssign(false);refresh();
  }catch(e){setError(e instanceof Error?e.message:'Unable to assign room check.');}
  finally{setSaving(false);}
 }
 if(!allowed)return <><Heading title="Independent occupancy verification" description="Only assigned housekeeping and managers may use this workspace."/>
  <Panel title="Access restricted"><p>This page is available only to staff with the required permissions and assignments.</p></Panel></>;
 return <>
  <div className="occ-page-heading"><div><span className="rr-eyebrow">ROOM OPERATIONS</span>
   <Heading title="Room occupancy checks" description={manager
    ?'Assign independent room observations and review what differs from the hotel records.'
    :'Report what you can safely observe in your assigned rooms.'}/></div>
   {manager&&<button type="button" className="btn-primary occ-nav-link" onClick={()=>setShowAssign(true)}>
    <Plus size={16}/> Assign a room check</button>}</div>
  {manager&&<div className="occ-report-link"><Link to="/occupancy-coverage">
   View room occupancy report <ArrowRight size={15}/></Link></div>}
  {manager&&showAssign&&<div className="billing-modal-backdrop">
   <section className="billing-action-modal" role="dialog" aria-modal="true" aria-label="Assign a room check">
    <div className="billing-action-modal-header"><div><h3>Assign a room check</h3>
     <p>Assign today's independent observation to an active housekeeping employee.</p></div>
     <button type="button" className="billing-modal-dismiss" aria-label="Close dialog"
      disabled={saving} onClick={()=>setShowAssign(false)}><X size={19}/></button></div>
   <Panel title="Observation assignment">
   <p>One check per room per hotel day. Observations must be completed independently of front desk.</p>
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
   </Panel></section></div>}
  <Panel title={manager?'Room checks':'My assigned rooms'}>
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
  <p className="occ-privacy-footnote"><AlertTriangle size={16}/>
   This compares staff observations with registered checked-in reservations, not actual payments or independent access logs. A mismatch is a lead for investigation, not proof of fraud. Never enter a guest's room without consent and hotel procedure.</p>
 </>;
}
