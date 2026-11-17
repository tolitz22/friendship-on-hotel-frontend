import {useRef,useState} from 'react';
import {useQueryClient} from '@tanstack/react-query';
import {Link} from '@tanstack/react-router';
import {AlertTriangle,ClipboardCheck,Send} from 'lucide-react';
import type {LiveRecord} from '../api/liveReservations';
import {requestManagerApproval,useApprovalRequests} from '../api/managerApprovals';
import type {ApprovalAction} from '../api/managerApprovals';
import {readSession} from '../api/session';
import {QueryFeedback} from '../components/QueryFeedback';

export function ReservationApprovalRequests({record,canRequest,manager}:{
 record:LiveRecord;canRequest:boolean;manager:boolean;
}){
 const {hotelId}=readSession();
 const client=useQueryClient();
 const [action,setAction]=useState<ApprovalAction>('cancel_booking');
 const [reason,setReason]=useState('');
 const [checkIn,setCheckIn]=useState(record.checkIn);
 const [checkOut,setCheckOut]=useState(record.checkOut);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [success,setSuccess]=useState('');
 const submission=useRef<{
  idempotencyKey:string;action:ApprovalAction;reason:string;checkIn?:string;checkOut?:string;
 }|null>(null);
 const requests=useApprovalRequests({enabled:canRequest||manager,bookingId:record.id});
 const changed=()=>{submission.current=null;setError('');setSuccess('');};
 const valid=reason.trim().length>=10&&reason.trim().length<=1000&&(
  action!=='amend_dates'||(checkIn<checkOut&&!!checkIn&&!!checkOut)
 );
 async function submit(){
  if(!hotelId||!canRequest||busy||!valid||record.lifecycleState!=='confirmed')return;
  if(!submission.current){
   submission.current={idempotencyKey:crypto.randomUUID(),action,reason:reason.trim(),
    ...(action==='amend_dates'?{checkIn,checkOut}:{})};
  }
  setBusy(true);setError('');setSuccess('');
  try{
   const result=await requestManagerApproval(hotelId,record.id,submission.current);
   if(readSession().hotelId!==hotelId)return;
   setSuccess('Approval request #'+result.id+' submitted. No booking change has been made.');
   submission.current=null;setReason('');
   void client.invalidateQueries({queryKey:['live','approvals',hotelId]}).catch(()=>{});
  }catch(cause){
   if(readSession().hotelId===hotelId)
    setError(cause instanceof Error?cause.message:'Request outcome uncertain. Check the request list before retrying the same submission.');
  }finally{setBusy(false);}
 }
 return <section aria-label="Manager approval requests" className="stay-approval-panel">
  <div className="desk-tools">
   <h4><ClipboardCheck size={17}/> Manager approval requests</h4>
   {manager&&<Link to="/manager-approvals" className="text-link">Open manager inbox</Link>}
  </div>
  <p className="desk-muted">Request cancellation, date changes, or a day-early check-in. Early check-in requires a different manager's approval and is recorded separately. Cancellation and date changes have additional finance restrictions.</p>
  {canRequest&&record.lifecycleState==='confirmed'&&<div>
   <label htmlFor="approval-action" className="wizard-label">Requested exception</label>
   <select id="approval-action" className="wizard-input" value={action} disabled={busy}
    onChange={e=>{setAction(e.target.value as ApprovalAction);changed();}}>
    <option value="cancel_booking">Cancel booking</option>
    <option value="early_check_in">Early check-in (manager approval)</option>
    <option value="amend_dates">Change check-in / check-out dates</option>
   </select>
   {action==='amend_dates'&&<div className="wizard-fields">
    <label>Requested check-in<input className="wizard-input" type="date" value={checkIn} disabled={busy}
     onChange={e=>{setCheckIn(e.target.value);changed();}}/></label>
    <label>Requested check-out<input className="wizard-input" type="date" value={checkOut} disabled={busy}
     onChange={e=>{setCheckOut(e.target.value);changed();}}/></label>
   </div>}
   <label htmlFor="approval-reason" className="wizard-label">Reason for manager review (10–1000 characters)</label>
   <textarea id="approval-reason" className="wizard-input" rows={3} maxLength={1000}
    placeholder="Explain the guest request and what needs to change."
    value={reason} disabled={busy} onChange={e=>{setReason(e.target.value);changed();}}/>
   <button className="btn-primary" type="button" disabled={busy||!valid}
    onClick={()=>void submit()}><Send size={15}/>{busy?'Submitting…':error?'Retry same request':'Request manager approval'}</button>
  </div>}
  {error&&<p role="alert" className="auth-error"><AlertTriangle size={16}/>{error}
   {' '}If the result is uncertain, retry the same request without editing the fields.</p>}
  {success&&<p role="status">{success}</p>}
  <h4 className="stay-approval-subheading">Request history</h4>
  <QueryFeedback loading={requests.isPending} error={requests.error}
   empty={requests.isSuccess&&requests.data.data.length===0}
   onRetry={()=>void requests.refetch()}/>
  {requests.data?.data.map(request=><article key={request.id} className="ex-record">
   <p><strong>#{request.id} · {request.action==='cancel_booking'?'Cancellation':request.action==='early_check_in'?'Early check-in':'Date change'}</strong>
    {' · '}{request.status}</p>
   <p className="desk-muted">{request.reason}</p>
   {request.action==='amend_dates'&&<p>Requested stay: {request.payload.checkIn} → {request.payload.checkOut}</p>}
   {request.reviewNote&&<p>Manager note: {request.reviewNote}</p>}
   <small>Requested {request.createdAt} · Expires {request.expiresAt}</small>
  </article>)}
  {requests.data&&requests.data.meta.totalPages>1&&
   <p className="desk-muted">Showing the most recent 20 requests. {manager?'Open the manager inbox for all pages.':'Contact your manager for older requests.'}</p>}
 </section>;
}
