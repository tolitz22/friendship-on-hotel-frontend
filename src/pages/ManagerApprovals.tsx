import {useState} from 'react';
import {Link} from '@tanstack/react-router';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {AlertTriangle,CheckCircle2,History,RefreshCw,ShieldCheck} from 'lucide-react';
import {useHotelAuth} from '../components/AuthProvider';
import {Heading,Panel} from '../components/ui';
import {QueryFeedback} from '../components/QueryFeedback';
import {getApprovalHistory,reviewManagerApproval,useApprovalRequests} from '../api/managerApprovals';
import type {Approval,ApprovalStatus} from '../api/managerApprovals';
import {readableDate,readableDateTime,statusLabel} from '../lib/format';
import {auditActorName} from '../components/ReadableAuditEvent';
import {listHotelStaff} from '../api/liveStaff';

const filters: {value:'history'|ApprovalStatus;label:string}[]=[{value:'pending',label:'Pending review'},{value:'executed',label:'Executed'},{value:'rejected',label:'Rejected'},{value:'expired',label:'Expired'},{value:'history',label:'All history'}];

function ApprovalCard({item,hotelId}:{item:Approval;hotelId:string}){
 const client=useQueryClient();
 const {user}=useHotelAuth();
 const staff=useQuery({queryKey:['hotel-staff',hotelId],queryFn:listHotelStaff,enabled:!!hotelId});
 const actor=(id:string,serverName?:string|null)=>auditActorName(id,serverName??staff.data?.data.find(m=>m.userId===id)?.name,user?.id,user?.name);
 const [expanded,setExpanded]=useState(false);
 const [note,setNote]=useState('');
 const [confirmed,setConfirmed]=useState(false);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [showHistory,setShowHistory]=useState(false);
 const log=useQuery({
  queryKey:['live','approval-history',hotelId,item.id],
  enabled:showHistory,
  queryFn:()=>getApprovalHistory(hotelId,item.id),
  retry:false,
 });
 async function decide(decision:'approve'|'reject'){
  if(busy||item.status!=='pending'||(decision==='approve'&&(!confirmed||((item.action==='early_check_in'||item.action==='early_check_out')&&note.trim().length<10)))
   ||(decision==='reject'&&!note.trim()))return;
  setBusy(true);setError('');
  try{
   await reviewManagerApproval(hotelId,item.id,decision,note.trim()||undefined);
   void Promise.all([
    client.invalidateQueries({queryKey:['live','approvals',hotelId]}),
    client.invalidateQueries({queryKey:['live','approval-history',hotelId,item.id]}),
    client.invalidateQueries({queryKey:['live','reservation-records',hotelId]}),
    client.invalidateQueries({queryKey:['live','reservation-detail',hotelId]}),
    client.invalidateQueries({queryKey:['live','front-desk','manifest',hotelId]}),
    client.invalidateQueries({queryKey:['live','reservation-history',hotelId]}),
    client.invalidateQueries({queryKey:['live','room-rack',hotelId]}),
    client.invalidateQueries({queryKey:['live','readiness-dashboard',hotelId]}),
    client.invalidateQueries({queryKey:['live','housekeeping',hotelId]}),
    client.invalidateQueries({queryKey:['live','booking-turnover',hotelId]}),
    client.invalidateQueries({queryKey:['live','room-calendar',hotelId]}),
   ]).catch(()=>{});
  }catch(cause){setError(cause instanceof Error?cause.message:'Review result unknown. Refresh before retrying.');}
  finally{setBusy(false);}
 }
 return <article className="stay-review-card rounded-xl border border-slate-200 p-4 sm:p-5">
  <div className="desk-tools"><strong>{item.action==='cancel_booking'?'Cancel reservation':item.action==='early_check_in'?'Early check-in · Manager review':item.action==='early_check_out'?'Early checkout · Manager review':'Change stay dates'} <small>#{item.id}</small></strong>
   <span className={'rounded-full px-3 py-1 text-xs font-medium '+(item.status==='pending'?'bg-amber-50 text-amber-800':item.status==='executed'?'bg-emerald-50 text-emerald-800':'bg-slate-100 text-slate-700')}>{statusLabel(item.status)}</span></div>
  <p><Link to="/reservations" search={{booking:item.bookingId}}>Reservation #{item.bookingId}</Link>
   {' · '}Requested by {actor(item.requestedBy)} · {readableDateTime(item.createdAt)}</p>
  <div className="my-3 rounded-lg bg-slate-50 p-3"><p className="text-xs font-medium text-slate-600">Request reason</p><p className="mt-1 whitespace-pre-wrap break-words text-sm">{item.reason}</p></div>
  <p><strong>Recorded booking:</strong> {readableDate(item.snapshot.checkIn)} → {readableDate(item.snapshot.checkOut)}
   {' · '}{item.snapshot.status} · Room {item.snapshot.assignedRoomId??'unassigned'}</p>
  {item.action==='amend_dates'&&<p><strong>Requested dates:</strong> {readableDate(item.payload.checkIn)} → {readableDate(item.payload.checkOut)}</p>}
  <p className="desk-muted">Expires: {readableDateTime(item.expiresAt)}</p>
  {item.status==='pending'&&<div className="mt-4 border-t border-slate-200 pt-3">
   <button type="button" className="btn-inline" aria-expanded={expanded} disabled={busy} onClick={()=>setExpanded(v=>!v)}>{expanded?'Hide decision form':'Review request'}</button>
   {expanded&&<div className="mt-3 space-y-3">
   <h4 className="font-semibold">Make a decision</h4>
   <p className="text-sm">Approval attempts to execute the requested change immediately. Existing booking and financial safeguards still apply.</p>
   <p className="text-xs text-slate-600">{item.action==='early_check_in'||item.action==='early_check_out'?'Approval requires a note of at least 10 characters.':'Approval requires confirmation.'} Rejection requires a reason.</p>
   <label className="wizard-label" htmlFor={'review-note-'+item.id}>Manager decision note</label>
   <textarea id={'review-note-'+item.id} className="wizard-input" rows={2} maxLength={1000}
    value={note} onChange={e=>setNote(e.target.value)} disabled={busy} placeholder={item.action==='early_check_in'?'Describe verified guest arrival, room readiness and pricing follow-up':item.action==='early_check_out'?'Confirm actual departure, guest request and financial follow-up':'Reason for decision (required for rejection)'}/>
   {item.action==='early_check_in'&&<p className="stay-early-inbox-tip">Approving immediately records the guest as checked in early. The original scheduled dates remain on the booking.</p>}
   {item.action==='early_check_out'&&<p className="stay-early-inbox-tip">Approving immediately checks out the guest, revokes recorded keycard authorizations, and creates checkout cleaning. Scheduled dates and posted charges remain unchanged; no refund is generated. All configured settlement rules still apply.</p>}
   <label className="wizard-label">
    <input type="checkbox" checked={confirmed} disabled={busy}
     onChange={e=>setConfirmed(e.target.checked)}/>
    {item.action==='early_check_out'
     ?'I verified the guest has departed, reviewed applicable financial checkout requirements, and understand this immediately ends the registered stay without an automatic refund.'
     :'I independently confirmed the request, guest identity, assigned room, readiness and potential additional-night charges.'}
   </label>
   <div className="desk-tools">
    <button type="button" className="btn-primary" disabled={busy||!confirmed||((item.action==='early_check_in'||item.action==='early_check_out')&&note.trim().length<10)}
     onClick={()=>void decide('approve')}>{busy?'Reviewing…':item.action==='early_check_in'?'Approve & check in early':item.action==='early_check_out'?'Approve & check out early':'Approve and execute'}</button>
    <button type="button" className="btn-inline" disabled={busy||!note.trim()}
     onClick={()=>void decide('reject')}>Reject request</button>
   </div>
   </div>}
  </div>}
  {item.status==='expired'&&<p>Open the booking to submit a fresh request if the guest still needs this exception.</p>}
  {(item.status==='executed'||item.status==='rejected')&&<p><CheckCircle2 size={16}/> Reviewed by {item.reviewedBy?actor(item.reviewedBy):'Manager name unavailable'} · {item.reviewNote||'No additional note'}</p>}
  {error&&<p role="alert" className="auth-error"><AlertTriangle size={16}/>{error} Check booking history before retrying.</p>}
  <button className="btn-inline" type="button" aria-expanded={showHistory}
   onClick={()=>setShowHistory(v=>!v)}><History size={15}/> {showHistory?'Hide audit':'Show audit trail'}</button>
  {showHistory&&<div>
   <QueryFeedback loading={log.isPending} error={log.error} onRetry={()=>void log.refetch()}/>
   {log.data?.data.map(entry=>{
    const eventDetails=entry.details&&typeof entry.details==='object'&&!Array.isArray(entry.details)
     ?entry.details as Record<string,unknown>:null;
    const note=typeof eventDetails?.note==='string'?eventDetails.note:null;
    const title:Record<string,string>={
     requested:'Requested manager approval',approved:'Approved the request',
     rejected:'Rejected the request',executed:'Applied the approved change',
    };
    return <article key={entry.id} className="readable-audit-event">
     <strong>{title[entry.event]??statusLabel(entry.event)}</strong>
     <p className="readable-audit-context">{actor(entry.actorId,entry.actorName)}
      {' · '}{readableDateTime(entry.createdAt)}</p>
     {note&&<p className="readable-audit-note"><strong>Decision note:</strong> {note}</p>}
     {entry.event==='requested'&&<p className="readable-audit-context">
      Requested action: {item.action==='cancel_booking'?'Cancel reservation':
       item.action==='amend_dates'?'Change stay dates':item.action==='early_check_out'?'Early checkout':'Early check-in'}</p>}
    </article>;
   })}
  </div>}
 </article>;
}

export function ManagerApprovals(){
 const {hotelId,user}=useHotelAuth();
 const manager=!!hotelId&&!!user?.hotels.some(h=>h.id===hotelId&&h.role==='admin');
 const [filter,setFilter]=useState<'history'|ApprovalStatus>('pending');
 const [page,setPage]=useState(1);
 const approvals=useApprovalRequests({enabled:manager,page,status:filter});
 if(!manager)return <><Heading title="Manager approvals" description="Only authorized hotel managers can review staff exceptions."/>
  <Panel title="Restricted"><p role="status"><ShieldCheck size={18}/> Only authorized managers can access this page.</p></Panel></>;
 return <>
  <div className="ex-heading"><Heading title="Manager approvals" description="Review booking exceptions, confirm decisions, and track their audit history."/>
   <button className="btn-inline" type="button" disabled={approvals.isFetching} onClick={()=>void approvals.refetch()}><RefreshCw size={15} className={approvals.isFetching?'animate-spin':''}/> {approvals.isFetching?'Refreshing…':'Refresh'}</button></div>
  <Panel title={filter==='pending'?'Approval inbox':'Approval history'}>
   <div className="mb-4 flex flex-wrap items-center gap-2" role="group" aria-label="Filter approval requests">
    {filters.map(option=><button key={option.value} type="button" aria-pressed={filter===option.value}
     className={'rounded-lg border px-3 py-2 text-sm font-medium '+(filter===option.value?'border-slate-900 bg-slate-900 text-white':'border-slate-200 bg-white text-slate-700 hover:bg-slate-50')}
     onClick={()=>{setFilter(option.value);setPage(1);}}>{option.label}</button>)}
   </div>
   {approvals.isSuccess&&<div className="mb-4 flex items-baseline gap-2"><strong className="text-2xl tabular-nums">{approvals.data.meta.total}</strong><span className="text-sm text-slate-600">{filter==='pending'?'requests awaiting review':'matching requests'}</span></div>}
   <QueryFeedback loading={approvals.isPending} error={approvals.error} onRetry={()=>void approvals.refetch()}/>
   {approvals.isSuccess&&approvals.data.data.length===0&&<div role="status" className="rounded-xl border border-dashed border-slate-300 p-8 text-center"><ShieldCheck className="mx-auto mb-2 text-slate-500" size={28}/><h3 className="font-semibold">{filter==='pending'?'No pending approvals':'No matching requests'}</h3><p className="mt-1 text-sm text-slate-500">{filter==='pending'?'New exception requests will appear here.':'Choose another status to view more requests.'}</p></div>}
   <div className="space-y-3">
   {approvals.data?.data.map(item=><ApprovalCard key={hotelId+'-'+item.id} item={item} hotelId={hotelId!}/>)}
   </div>
   {approvals.data&&<div className="desk-tools">
    <span>Page {approvals.data.meta.page} of {Math.max(1,approvals.data.meta.totalPages)}
     {' · '}{approvals.data.meta.total} requests</span>
    <div className="desk-date-nav">
     <button type="button" className="btn-inline" disabled={page<=1} onClick={()=>setPage(p=>p-1)}>Previous</button>
     <button type="button" className="btn-inline" disabled={page>=approvals.data.meta.totalPages} onClick={()=>setPage(p=>p+1)}>Next</button>
    </div></div>}
  </Panel>
  <p className="desk-preview-note"><AlertTriangle size={16}/> Early arrivals and departures are audited exceptions. Early checkout runs the usual financial checkout safeguards and housekeeping handoff; it does not refund unused nights automatically.</p>
 </>;
}
