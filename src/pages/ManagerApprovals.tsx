import {useState} from 'react';
import {Link} from '@tanstack/react-router';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {AlertTriangle,CheckCircle2,History,RefreshCw,ShieldCheck} from 'lucide-react';
import {useHotelAuth} from '../components/AuthProvider';
import {Heading,Panel} from '../components/ui';
import {QueryFeedback} from '../components/QueryFeedback';
import {getApprovalHistory,reviewManagerApproval,useApprovalRequests} from '../api/managerApprovals';
import type {Approval,ApprovalStatus} from '../api/managerApprovals';

function ApprovalCard({item,hotelId}:{item:Approval;hotelId:string}){
 const client=useQueryClient();
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
  if(busy||item.status!=='pending'||(decision==='approve'&&(!confirmed||(item.action==='early_check_in'&&note.trim().length<10)))
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
   ]).catch(()=>{});
  }catch(cause){setError(cause instanceof Error?cause.message:'Review result unknown. Refresh before retrying.');}
  finally{setBusy(false);}
 }
 return <article className={'stay-review-card'+(item.action==='early_check_in'?' stay-review-early':'')}>
  <div className="desk-tools"><strong>{item.action==='cancel_booking'?'Cancel reservation':item.action==='early_check_in'?'Early check-in · Manager review':'Change stay dates'} <small>#{item.id}</small></strong>
   <span className="table-count">{item.status.toUpperCase()}</span></div>
  <p><Link to="/reservations" search={{booking:item.bookingId}}>Reservation #{item.bookingId}</Link>
   {' · '}Requested by staff #{item.requestedBy} · {item.createdAt}</p>
  <p><strong>Reason:</strong> {item.reason}</p>
  <p><strong>Recorded booking:</strong> {item.snapshot.checkIn} → {item.snapshot.checkOut}
   {' · '}{item.snapshot.status} · Room {item.snapshot.assignedRoomId??'unassigned'}</p>
  {item.action==='amend_dates'&&<p><strong>Requested dates:</strong> {item.payload.checkIn} → {item.payload.checkOut}</p>}
  <p className="desk-muted">Expires: {item.expiresAt}. For early check-in, approval immediately records the guest as checked in and an early-arrival audit record. Room availability, readiness and date rules are rechecked; payment is not changed.</p>
  {item.status==='pending'&&<>
   <label className="wizard-label" htmlFor={'review-note-'+item.id}>Manager decision note</label>
   <textarea id={'review-note-'+item.id} className="wizard-input" rows={2} maxLength={1000}
    value={note} onChange={e=>setNote(e.target.value)} disabled={busy} placeholder={item.action==='early_check_in'?'Describe verified guest arrival, room readiness and pricing follow-up':'Reason for decision (required for rejection)'}/>
   {item.action==='early_check_in'&&<p className="stay-early-inbox-tip">Approving immediately records the guest as checked in early. The original scheduled dates remain on the booking.</p>}
   <label className="wizard-label">
    <input type="checkbox" checked={confirmed} disabled={busy}
     onChange={e=>setConfirmed(e.target.checked)}/>
    I independently confirmed the request, guest identity, assigned room, readiness and potential additional-night charges.
   </label>
   <div className="desk-tools">
    <button type="button" className="btn-primary" disabled={busy||!confirmed||(item.action==='early_check_in'&&note.trim().length<10)}
     onClick={()=>void decide('approve')}>{busy?'Reviewing…':item.action==='early_check_in'?'Approve & check in early':'Approve and execute'}</button>
    <button type="button" className="btn-inline" disabled={busy||!note.trim()}
     onClick={()=>void decide('reject')}>Reject request</button>
   </div>
  </>}
  {item.status!=='pending'&&<p><CheckCircle2 size={16}/> Reviewed by #{item.reviewedBy} · {item.reviewNote||'No additional note'}</p>}
  {error&&<p role="alert" className="auth-error"><AlertTriangle size={16}/>{error} Check booking history before retrying.</p>}
  <button className="btn-inline" type="button" aria-expanded={showHistory}
   onClick={()=>setShowHistory(v=>!v)}><History size={15}/> {showHistory?'Hide audit':'Show audit trail'}</button>
  {showHistory&&<div>
   <QueryFeedback loading={log.isPending} error={log.error} onRetry={()=>void log.refetch()}/>
   {log.data?.data.map(entry=><p key={entry.id} className="desk-muted">
    {entry.event} · Staff #{entry.actorId} · {entry.createdAt}
   </p>)}
  </div>}
 </article>;
}

export function ManagerApprovals(){
 const {hotelId,user}=useHotelAuth();
 const manager=!!hotelId&&!!user?.hotels.some(h=>h.id===hotelId&&h.role==='admin');
 const [filter,setFilter]=useState<'all'|ApprovalStatus>('pending');
 const [page,setPage]=useState(1);
 const approvals=useApprovalRequests({enabled:manager,page,status:filter==='all'?undefined:filter});
 if(!manager)return <><Heading title="Manager approvals" description="Only authorized hotel managers can review staff exceptions."/>
  <Panel title="Restricted"><p role="status"><ShieldCheck size={18}/> Manager access is required. Laravel enforces this restriction.</p></Panel></>;
 return <>
  <div className="ex-heading"><Heading title="Manager approvals" description="Independently review and execute narrow reservation exceptions with an audit trail."/>
   <button className="btn-inline" type="button" onClick={()=>void approvals.refetch()}><RefreshCw size={15}/> Refresh</button></div>
  <Panel title="Approval inbox">
   <div className="desk-tools">
    <label>Request status{' '}<select className="wizard-input" value={filter}
     onChange={e=>{setFilter(e.target.value as typeof filter);setPage(1);}}>
     <option value="pending">Pending</option><option value="executed">Executed</option>
     <option value="rejected">Rejected</option><option value="all">All</option>
    </select></label>
    <span>Review may fail if the booking changed, funds were recorded, the requester was deactivated, or hotel inventory is no longer eligible.</span>
   </div>
   <QueryFeedback loading={approvals.isPending} error={approvals.error}
    onRetry={()=>void approvals.refetch()}
    empty={approvals.isSuccess&&approvals.data.data.length===0}/>
   {approvals.data?.data.map(item=><ApprovalCard key={hotelId+'-'+item.id} item={item} hotelId={hotelId!}/>)}
   {approvals.data&&<div className="desk-tools">
    <span>Page {approvals.data.meta.page} of {Math.max(1,approvals.data.meta.totalPages)}
     {' · '}{approvals.data.meta.total} requests</span>
    <div className="desk-date-nav">
     <button type="button" className="btn-inline" disabled={page<=1} onClick={()=>setPage(p=>p-1)}>Previous</button>
     <button type="button" className="btn-inline" disabled={page>=approvals.data.meta.totalPages} onClick={()=>setPage(p=>p+1)}>Next</button>
    </div></div>}
  </Panel>
  <p className="desk-preview-note"><AlertTriangle size={16}/> An approved early check-in is recorded as an exception to the scheduled arrival date. It still requires an available, ready room. Payments and refunds remain on their separate manager-only flows.</p>
 </>;
}
