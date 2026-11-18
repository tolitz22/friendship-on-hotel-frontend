import {useEffect,useState} from 'react';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {AlertTriangle,CheckCircle2,LockKeyhole} from 'lucide-react';
import {useHotelAuth} from './AuthProvider';
import {useNightAuditReview,createNightAuditReview} from '../api/nightAuditReview';
import {QueryFeedback} from './QueryFeedback';
import type {NightAuditPreview} from '../api/nightAuditPreview';
import {readSession} from '../api/session';
import {readableDateTime} from '../lib/format';
import {listHotelStaff} from '../api/liveStaff';
import {auditActorName} from './ReadableAuditEvent';

export function NightAuditReviewPanel({date,preflight}:{date:string;preflight:NightAuditPreview}){
 const {hotelId,user}=useHotelAuth();
 const staff=useQuery({queryKey:['hotel-staff',hotelId],queryFn:listHotelStaff,enabled:!!hotelId});
 const client=useQueryClient();
 const report=useNightAuditReview(date,!!hotelId);
 const [note,setNote]=useState('');
 const [ack,setAck]=useState(false);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [success,setSuccess]=useState('');
 useEffect(()=>{setNote('');setAck(false);setError('');setSuccess('');},[hotelId,date]);
 const past=date<preflight.hotelDate;
 async function record(){
  if(!hotelId||readSession().hotelId!==hotelId||busy||!ack||note.trim().length<15||
   !past||report.data||!report.isSuccess)return;
  setBusy(true);setError('');setSuccess('');
  try{
   const result=await createNightAuditReview(hotelId,date,{
    decision:preflight.preflightClear?'clear':'flag',
    note:note.trim(),acknowledged:true,
   });
   if(readSession().hotelId!==hotelId)return;
   await client.invalidateQueries({queryKey:['live','night-audit-review',hotelId,date]});
   setSuccess('Manager review #'+result?.id+' recorded. No financial close or ledger lock was performed.');
  }catch(e){setError(e instanceof Error?e.message:'Unable to record business-day review. Refresh before retrying.');}
  finally{setBusy(false);}
 }
 return <section className="night-review-panel" aria-label="Business-day manager review">
  <div className="night-review-header"><LockKeyhole size={18}/>
   <div><h3>Manager review record</h3>
    <p>One immutable decision per hotel business date; not a tax or accounting close.</p>
   </div>
  </div>
  <QueryFeedback loading={report.isPending} error={report.error} onRetry={()=>void report.refetch()}/>
  {report.data&&<div className="night-review-record">
   <strong><CheckCircle2 size={16}/> {report.data.status==='reviewed'?'Preflight reviewed':'Exceptions flagged for investigation'}</strong>
   <p>{report.data.managerNote}</p>
   <small>Reviewed by {auditActorName(report.data.reviewedBy,
    staff.data?.data.find(m=>m.userId===report.data?.reviewedBy)?.name,user?.id,user?.name)}
    {' · '}{readableDateTime(report.data.reviewedAt)}</small>
   <small>Snapshot hash: {report.data.snapshotSha256}</small>
   <p>This review did not itself close the financial day, lock journals, calculate taxes or settle payments. See the financial-close status below for the current business date.</p>
  </div>}
  {report.isSuccess&&!report.data&&<>
   {!past?<p className="desk-muted">Only a completed prior hotel-local date can receive a manager review. Select yesterday or an earlier date.</p>:<>
    <label className="night-review-note">Manager's findings and follow-up
     <textarea className="wizard-input" rows={3} maxLength={2000} disabled={busy}
      value={note} onChange={e=>setNote(e.target.value)}
      placeholder="Document discrepancies, staff follow-up, and why this review was completed."/>
    </label>
    <label className="night-review-ack"><input type="checkbox" checked={ack} disabled={busy}
      onChange={e=>setAck(e.target.checked)}/>
     <span>I reviewed the listed exceptions and understand that this records a snapshot only. It does not settle payments, calculate taxes, lock ledgers, or roll the hotel's business date.</span></label>
    <button type="button" className="btn-primary"
     disabled={!ack||note.trim().length<15||busy||report.isFetching}
     onClick={()=>void record()}>{busy?'Recording…':preflight.preflightClear?'Record reviewed preflight':'Flag exceptions for investigation'}</button>
   </>}
  </>}
  {success&&<p role="status" className="stay-feedback-success">{success}</p>}
  {error&&<p role="alert" className="stay-feedback-error"><AlertTriangle size={15}/>{error}</p>}
 </section>;
}
