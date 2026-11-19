import {useRef,useState} from 'react';
import {useQueryClient} from '@tanstack/react-query';
import {Link} from '@tanstack/react-router';
import {AlertTriangle,Clock3,Send,ShieldCheck} from 'lucide-react';
import type {LiveRecord} from '../api/liveReservations';
import {requestManagerApproval,useApprovalRequests} from '../api/managerApprovals';
import {readSession} from '../api/session';
import {useHotelAuth} from './AuthProvider';
import {dateLabel} from '../lib/format';

/**
 * Request only. Checkout occurs after independent manager approval through
 * the original server-side checkout transaction, never from a client override.
 */
export function EarlyCheckOutRequest({record,today}:{record:LiveRecord;today:string}){
 const {hotelId}=readSession();
 const {user}=useHotelAuth();
 const manager=!!user?.hotels.some(h=>h.id===hotelId&&h.role==='admin');
 const client=useQueryClient();
 const requests=useApprovalRequests({enabled:!!hotelId,bookingId:record.id,status:'pending'});
 const [reason,setReason]=useState('');
 const [open,setOpen]=useState(false);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [success,setSuccess]=useState('');
 const retry=useRef<{key:string;reason:string}|null>(null);
 const pending=requests.data?.data.some(r=>r.action==='early_check_out')??false;
 const eligible=record.lifecycleState==='checked_in'&&today>=record.checkIn&&today<record.checkOut;
 async function submit(){
  if(!hotelId||!eligible||requests.isError||requests.isPending||pending||busy||reason.trim().length<10)return;
  const value=retry.current??{key:crypto.randomUUID(),reason:reason.trim()};
  retry.current=value;setBusy(true);setError('');setSuccess('');
  try{
   const result=await requestManagerApproval(hotelId,record.id,{
    idempotencyKey:value.key,action:'early_check_out',reason:value.reason,
   });
   if(readSession().hotelId!==hotelId)return;
   retry.current=null;setOpen(false);setReason('');
   setSuccess('Early checkout request #'+result.id+' submitted. The guest remains checked in until an independent manager approves.');
   void client.invalidateQueries({queryKey:['live','approvals',hotelId]}).catch(()=>{});
  }catch(cause){
   if(readSession().hotelId===hotelId)setError(cause instanceof Error?cause.message:
    'Unable to confirm request. Review pending approvals before resubmitting.');
  }finally{setBusy(false);}
 }
 if(!eligible)return null;
 return <section className="stay-early-request" aria-label="Request early checkout">
  <div className="stay-early-request-icon"><Clock3 size={19}/></div>
  <div className="stay-early-request-content">
   <strong>Guest leaving before the scheduled checkout?</strong>
   <p>Scheduled departure: {dateLabel(record.checkOut)}. Request an early checkout for the actual hotel business date. An independent manager must review it.</p>
   <p className="desk-muted">Approval ends the recorded stay and creates the checkout-cleaning task. Booked dates and charges are not shortened or refunded automatically. Financial checkout requirements still apply.</p>
   {requests.isPending&&<p role="status">Checking outstanding early checkout requests…</p>}
   {requests.isError&&<p role="alert" className="stay-feedback-error">
    Could not verify pending approvals. Retry before creating another request.
    <button type="button" className="btn-inline" onClick={()=>void requests.refetch()}>Retry</button></p>}
   {pending&&<p className="stay-early-pending"><ShieldCheck size={15}/>
    Early checkout awaiting manager review. Guest remains checked in.
    <button type="button" className="stay-text-button" onClick={()=>void requests.refetch()}>Refresh</button></p>}
   {!pending&&!open&&<button type="button" className="btn-inline"
    disabled={busy||requests.isPending||requests.isError} onClick={()=>setOpen(true)}>
    Request early checkout <Send size={14}/></button>}
   {open&&!pending&&<div className="stay-early-form">
    <label htmlFor="early-checkout-reason">Reason for leaving early (at least 10 characters)</label>
    <textarea id="early-checkout-reason" className="wizard-input" rows={3} maxLength={1000}
     disabled={busy} value={reason} onChange={e=>{setReason(e.target.value);retry.current=null;setError('');setSuccess('');}}
     placeholder="Record the guest's request, actual departure and any agreed financial follow-up."/>
    <p className="desk-muted">Submitting the request does not check out the guest or change the bill. The manager will review the recorded departure and outstanding balance.</p>
    <div className="stay-early-form-actions">
     <button type="button" className="btn-primary" disabled={busy||reason.trim().length<10}
      onClick={()=>void submit()}>{busy?'Sending…':'Send for manager review'}</button>
     <button type="button" className="btn-inline" disabled={busy}
      onClick={()=>{setOpen(false);setError('');}}>Cancel</button>
    </div>
   </div>}
   {success&&<p role="status" className="stay-feedback-success">{success}</p>}
   {error&&<p role="alert" className="stay-feedback-error"><AlertTriangle size={15}/>{error}</p>}
   {manager?<Link to="/manager-approvals" className="stay-early-inbox">Open manager inbox</Link>:
    <span className="stay-early-hint">A different authorized hotel manager must approve this request.</span>}
  </div>
 </section>;
}
