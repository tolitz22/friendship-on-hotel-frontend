import {useEffect,useState} from 'react';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {Link,useSearch,useNavigate} from '@tanstack/react-router';
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
import {useLiveProperty} from '../api/liveCatalogQueries';
import {hotelToday} from '../features/reservations/calendarDate';
import {ShiftDialog} from '../features/housekeeping/ShiftDialog';
import {useNetworkStatus} from '../features/housekeeping/useNetworkStatus';
import {OccupancyInvestigationPanel} from '../components/OccupancyInvestigationPanel';

function CheckCard({check,manager,isCurrentDate,onChanged}:{check:OccupancyVerification;manager:boolean;isCurrentDate:boolean;onChanged:()=>void}){
 const {hotelId,user}=useHotelAuth();
 const online=useNetworkStatus();
 const canRecord=user?.hotels.find(hotel=>hotel.id===hotelId)?.permissions?.includes('occupancy.observe')!==false;
 const staff=useQuery({queryKey:['hotel-staff',hotelId],queryFn:listHotelStaff,enabled:manager&&!!hotelId});
 const actor=(id:string,name?:string|null)=>auditActorName(id,name??staff.data?.data.find(m=>m.userId===id)?.name,user?.id,user?.name);
 const [observed,setObserved]=useState<'occupied'|'vacant'|'unknown'|null>(null);
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
  if(!hotelId||!online||busy||note.trim().length<5||action==='observe'&&(!canObserve||!observed))return;
  setBusy(true);setError('');setMessage('');
  try{
   if(action==='observe'&&observed)await observeOccupancy(hotelId,check.id,{observedOccupancy:observed,note:note.trim()});
   else if(action!=='observe')await reviewOccupancy(hotelId,check.id,{decision:action,note:note.trim()});
   if(readSession().hotelId!==hotelId)return;
   setMessage(action==='observe'?'Observation saved for manager review.':action==='verified'?'Matching observation reviewed.':'Investigation flag recorded.');setNote('');setObserved(null);setWorkDialog(false);onChanged();
  }catch(e){setError(e instanceof Error?e.message:'Result uncertain. Refresh before retrying.');}
  finally{setBusy(false);}
 }
 const statusText=check.status==='assigned'?'Observation needed':check.status==='submitted'
  ?'Manager review needed':check.status==='verified'?'Reviewed · matches PMS':'Flagged observation';
 const mismatch=check.discrepancy==='unexpected_occupied'?'Observed occupied, PMS has no checked-in stay':
  check.discrepancy==='expected_occupied_vacant'?'Observed vacant, PMS has a checked-in stay':
  check.discrepancy==='unverified'?'Could not confirm occupancy':'Observation matches PMS snapshot';
 const canObserve=check.status==='assigned'&&!manager&&isCurrentDate&&canRecord&&check.assignedUserId===user?.id;
 const canReview=check.status==='submitted'&&manager;
 const independent=check.observedBy!==user?.id;
 return <article className={manager?'occ-check-card':'hk-shift-card hk-occupancy-card'}>
  <div className="occ-check-header">
   <div><h3>Room {check.roomNumber}</h3><small>{readableDate(check.inspectionDate)}{manager?' · Assigned to '+actor(check.assignedUserId):''}</small></div>
   <span className={'occ-status '+(check.status==='flagged'||(check.discrepancy!==null&&check.discrepancy!=='match'&&check.discrepancy!=='unverified')?'occ-danger':
    check.status==='verified'?'occ-success':'occ-attention')}>{statusText}</span>
  </div>
  {check.status!=='assigned'&&<div className="occ-check-comparison">
   <div><small>What staff observed</small><strong>{statusLabel(check.observedOccupancy??'unknown')}</strong></div>
   <div><small>Registered in the PMS at observation</small><strong>{statusLabel(check.expectedOccupancy??'unknown')}</strong></div>
  </div>}
  {check.status!=='assigned'&&<p className="occ-check-result">
   <Info size={15}/>{mismatch}{manager?'. This is evidence for review, not proof of an unregistered stay.':''}</p>}
  {check.status==='assigned'&&!canObserve&&<p className="occ-check-result"><Info size={15}/>
   {isCurrentDate?(manager?'Waiting for the assigned employee.':'Your account can view this check.'):'The observation window for this date has ended.'}</p>}
  <div className={manager?'occ-check-actions':'hk-shift-actions'}>
   {(canObserve||canReview)&&<button type="button" className="btn-primary"
    disabled={!online} onClick={()=>{setError('');setMessage('');setWorkDialog(true);}}>
    {canObserve?'Record observation':'Review observation'} <ArrowRight size={15}/></button>}
   <button type="button" className="rr-secondary-action" aria-expanded={showHistory}
    onClick={()=>setShowHistory(v=>!v)}>{showHistory?'Hide':'View'} activity</button>
  </div>
  {workDialog&&canObserve&&<ShiftDialog title="Record room observation" context={'Room '+check.roomNumber+' · '+readableDate(check.inspectionDate)}
   busy={busy} onClose={()=>setWorkDialog(false)} actions={
    <button form={'observe-room-'+check.id} type="submit" className="btn-primary" disabled={!online||busy||!observed||note.trim().length<5}>
     {busy?'Saving…':'Submit observation'}
    </button>
   }>
   <form id={'observe-room-'+check.id} className="hk-shift-fields" onSubmit={event=>{event.preventDefault();void submit('observe');}}>
    <p className="hk-shift-muted">Enter a room only with permission and under your hotel’s procedures. If you’re unsure, choose Could not verify.</p>
    {!online&&<p role="status" className="hk-network-alert">You’re offline. Your draft is still open.</p>}
    <fieldset disabled={busy} className="hk-shift-choices">
     <legend>Was the room occupied?</legend>
     {([['occupied','Occupied'],['vacant','Vacant'],['unknown','Could not verify']] as const).map(([value,label])=>
      <label key={value} className="hk-shift-choice"><input type="radio" name={'occupancy-'+check.id} checked={observed===value}
       onChange={()=>setObserved(value)}/>{label}</label>)}
    </fieldset>
    <label>Observation notes<textarea rows={3} maxLength={1500} value={note} disabled={busy} onChange={event=>setNote(event.target.value)}
     placeholder="What did you observe? Leave out guest names and personal details."/></label>
    {error&&<p role="alert" className="auth-error">{error}</p>}
   </form>
  </ShiftDialog>}
  {workDialog&&canReview&&<div className="billing-modal-backdrop"><section role="dialog" aria-modal="true"
   aria-label="Review room observation" className="billing-action-modal occ-check-dialog">
   <div className="billing-action-modal-header"><div><span className="rr-eyebrow">ROOM {check.roomNumber}</span>
    <h3>Review the observation</h3><p>{readableDate(check.inspectionDate)} · {mismatch}</p></div>
    <button type="button" className="billing-modal-dismiss" aria-label="Close dialog" disabled={busy}
     onClick={()=>setWorkDialog(false)}><X size={19}/></button></div>
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
  {check.status==='flagged'&&manager&&<OccupancyInvestigationPanel
   verificationId={check.id} roomNumber={check.roomNumber}/>} 

  {showHistory&&<div><QueryFeedback loading={history.isPending} error={history.error} onRetry={()=>void history.refetch()} empty={history.isSuccess&&!history.data.data.length} emptyMessage="No activity recorded."/>
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
  {error&&!workDialog&&<p role="alert" className="auth-error">{error}</p>}
  {message&&<p role="status">{message}</p>}
 </article>;
}

export function OccupancyVerification(){
 const {room:linkedRoom,date:linkedDate}=useSearch({from:'/occupancy-verification'});
 const navigate=useNavigate();
 const {hotelId,user}=useHotelAuth();
 const role=user?.hotels.find(h=>h.id===hotelId)?.role;
 const manager=role==='admin';
 const online=useNetworkStatus();
 const allowed=role==='admin'||role==='housekeeping';
 const [page,setPage]=useState(1);
 const [selectedDate,setSelectedDate]=useState('');
 const property=useLiveProperty();
 const hotelDate=hotelToday(new Date(),property.data?.data.timeZone??'Asia/Manila');
 const displayDate=selectedDate||linkedDate||hotelDate;
 const [status,setStatus]=useState('all');
 const [roomId,setRoomId]=useState('');
 const [assignee,setAssignee]=useState('');
 const [error,setError]=useState('');
 const [message,setMessage]=useState('');
 const [saving,setSaving]=useState(false);
 const [showAssign,setShowAssign]=useState(false);
 const client=useQueryClient();
 const checks=useOccupancyVerifications(allowed,page,status==='all'?undefined:status as OccupancyVerification['status'],displayDate,linkedRoom);
 const rooms=useLiveRooms({page:1,perPage:100},!!linkedRoom||showAssign);
 const staff=useQuery({queryKey:['hotel-staff',hotelId],queryFn:listHotelStaff,enabled:manager});
 const eligible=staff.data?.data.filter(person=>person.role==='housekeeping'&&person.isActive)??[];
 useEffect(()=>{setPage(1);setStatus('all');setSelectedDate('');setRoomId('');setAssignee('');setError('');setMessage('');},[hotelId]);
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
 return <div className={manager?undefined:'hk-shift hk-occupancy-page'}>
  <div className="hk-shift-header"><div><h2>Occupancy checks</h2><p>{manager?'Assign and review independent room checks.':'Record an observation for your assigned rooms.'}</p></div>
   {manager&&displayDate===hotelDate&&<button type="button" className="btn-primary occ-nav-link" onClick={()=>{if(linkedRoom)setRoomId(linkedRoom);setShowAssign(true);}}>
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
  {!online&&<p role="status" className="hk-network-alert">You’re offline. {checks.data?'Showing the last loaded checks. Reconnect to submit observations.':'Reconnect to load your assigned room checks.'}</p>}
  <Panel title={linkedRoom?'Selected room checks':manager?'Room checks':'My assigned rooms'}>
   {linkedRoom&&<div className="occ-room-deeplink">
    <span>Showing room {rooms.data?.data.find(room=>room.id===linkedRoom)?.number??'selected'} on {readableDate(displayDate)}</span>
    <button type="button" className="btn-inline" onClick={()=>void navigate({to:'/occupancy-verification',search:{}})}>Show all rooms</button>
   </div>}
   <div className="hk-shift-toolbar">
    <label>Check date
     <input className="wizard-input" type="date" max={hotelDate}
      value={displayDate} onChange={e=>{setSelectedDate(e.target.value||hotelDate);setPage(1);}}/>
    </label>
    {displayDate!==hotelDate&&<button type="button" className="btn-inline"
     onClick={()=>{setSelectedDate(hotelDate);setPage(1);}}>Show today</button>}
    <label>Filter status{' '}
     <select className="wizard-input" value={status} onChange={e=>{setPage(1);setStatus(e.target.value);}}>
      <option value="all">All checks</option><option value="assigned">Observation needed</option>
      <option value="submitted">Needs review</option><option value="verified">Verified</option>
      <option value="flagged">Flagged</option>
     </select></label>
    <button type="button" className="btn-inline" disabled={!online||checks.isFetching} onClick={()=>void checks.refetch()}><RefreshCw size={16}/> Refresh</button>
   </div>
   {online&&<QueryFeedback loading={checks.isPending} error={checks.error} onRetry={()=>void checks.refetch()}
    empty={checks.isSuccess&&checks.data.data.length===0}
    emptyMessage={!manager&&status==='all'?'No room checks assigned to you for this date.':'No room checks match this view.'}/>}
   {checks.data&&<div className={manager?undefined:'hk-shift-cards'}>
    {checks.data.data.map(check=><CheckCard key={hotelId+'-'+check.id} check={check} manager={manager}
     isCurrentDate={check.inspectionDate===hotelDate} onChanged={refresh}/>)}
   </div>}
   {online&&checks.isSuccess&&checks.data.meta.totalPages>1&&<div className="hk-shift-actions">
    <span>Page {checks.data.meta.page} of {Math.max(1,checks.data.meta.totalPages)}</span>
    <div className="desk-date-nav">
     <button className="btn-inline" type="button" disabled={page<=1} onClick={()=>setPage(p=>p-1)}>Previous</button>
     <button className="btn-inline" type="button" disabled={page>=checks.data.meta.totalPages}
      onClick={()=>setPage(p=>p+1)}>Next</button>
    </div>
   </div>}
  </Panel>
  {manager&&<p className="occ-privacy-footnote"><AlertTriangle size={16}/>
   This compares staff observations with registered checked-in reservations, not actual payments or independent access logs. A mismatch is a lead for investigation, not proof of fraud. Never enter a guest's room without consent and hotel procedure.</p>}
 </div>;
}
