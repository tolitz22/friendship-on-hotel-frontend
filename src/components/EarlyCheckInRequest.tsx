import {useRef,useState} from 'react';
import {useQueryClient} from '@tanstack/react-query';
import {Link} from '@tanstack/react-router';
import {AlertTriangle,Clock3,Send,ShieldCheck} from 'lucide-react';
import type {LiveRecord} from '../api/liveReservations';
import {requestManagerApproval,useApprovalRequests} from '../api/managerApprovals';
import {readSession} from '../api/session';
import {useHotelAuth} from './AuthProvider';
import {dateLabel} from '../lib/format';

export function EarlyCheckInRequest({record,today}:{record:LiveRecord;today:string}){
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
 const pending=requests.data?.data.some(request=>request.action==='early_check_in')??false;
 const arrivalUTC=Date.parse(record.checkIn+'T00:00:00Z');
 const oneDayBefore=new Date(arrivalUTC-86400000).toISOString().slice(0,10);
 const eligible=record.lifecycleState==='confirmed'&&!!record.assignedRoomId&&oneDayBefore===today;
 const change=(value:string)=>{setReason(value);retry.current=null;setError('');setSuccess('');};
 async function submit(){
  if(!hotelId||busy||!eligible||pending||reason.trim().length<10)return;
  const submission=retry.current??{key:crypto.randomUUID(),reason:reason.trim()};
  retry.current=submission;
  setBusy(true);setError('');
  try{
   const result=await requestManagerApproval(hotelId,record.id,{
    idempotencyKey:submission.key,action:'early_check_in',reason:submission.reason,
   });
   if(readSession().hotelId!==hotelId)return;
   setSuccess('Early check-in request #'+result.id+' sent for independent manager review. The guest is not checked in yet.');
   retry.current=null;setOpen(false);setReason('');
   void client.invalidateQueries({queryKey:['live','approvals',hotelId]}).catch(()=>{});
  }catch(e){setError(e instanceof Error?e.message:'Unable to confirm this request. Review the manager inbox before retrying.');}
  finally{setBusy(false);}
 }
 return <div className="stay-early-request">
  <div className="stay-early-request-icon"><Clock3 size={19}/></div>
  <div className="stay-early-request-content">
   <strong>Guest arriving before the booked date?</strong>
   <p>Scheduled check-in: {dateLabel(record.checkIn)}. Early arrival requires another manager's approval and will be recorded as <b>Early check-in</b>.</p>
   {requests.isError&&<p role="alert" className="stay-feedback-error">Could not check existing requests. Refresh before submitting a duplicate.</p>}
   {pending&&<p className="stay-early-pending"><ShieldCheck size={15}/> Early check-in awaiting manager review. No check-in has been recorded.
    <button type="button" className="stay-text-button" onClick={()=>void requests.refetch()}>Refresh</button>
   </p>}
   {!pending&&eligible&&!open&&<button type="button" className="btn-inline"
    disabled={busy||requests.isPending||requests.isError}
    onClick={()=>setOpen(true)}>Request early check-in <Send size={14}/></button>}
   {!eligible&&<p className="stay-early-hint">{record.assignedRoomId
    ?'Requests open on the day before the scheduled arrival date.'
    :'Assign a room first to request an early check-in.'}</p>}
   {open&&eligible&&!pending&&<div className="stay-early-form">
    <label htmlFor="early-check-in-reason">Why is this guest arriving early?</label>
    <textarea id="early-check-in-reason" className="wizard-input" rows={3} maxLength={1000}
     disabled={busy} value={reason} onChange={e=>change(e.target.value)}
     placeholder="Explain the guest's early arrival and any additional-night fee consideration."/>
    <small>A different manager must verify the request and room availability. Approval records check-in immediately; no charge is created automatically.</small>
    <div className="stay-early-form-actions">
     <button type="button" className="btn-primary" disabled={busy||reason.trim().length<10}
      onClick={()=>void submit()}>{busy?'Submitting…':'Send for manager approval'}</button>
     <button type="button" className="btn-inline" disabled={busy} onClick={()=>{setOpen(false);setError('');}}>Cancel</button>
    </div>
   </div>}
   {success&&<p role="status" className="stay-feedback-success">{success}</p>}
   {error&&<p role="alert" className="stay-feedback-error"><AlertTriangle size={15}/>{error}</p>}
   {manager?<Link to="/manager-approvals" className="stay-early-inbox">Open manager approval inbox</Link>
    :<span className="stay-early-hint">A hotel manager other than the requesting staff member must approve.</span>}
  </div>
 </div>;
}
