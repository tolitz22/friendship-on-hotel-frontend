import {useRef,useState} from 'react';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {z} from 'zod';
import {getJson,requestJson} from '../api/http';
import {hotelPath,readSession} from '../api/session';

const schema=z.object({data:z.object({
 bookingId:z.string(),currency:z.literal('PHP'),workflowEnabled:z.boolean(),postingEnabled:z.boolean(),reconciliationValid:z.boolean(),
 maximumRefundMinor:z.number().int(),payments:z.array(z.object({paymentId:z.string(),maximumRequestMinor:z.number().int()})),
 refunds:z.array(z.object({id:z.string(),paymentId:z.string(),amountMinor:z.number().int(),reason:z.string(),status:z.string(),
 requestedBy:z.string(),reviewedBy:z.string().nullable(),evidenceRecordedBy:z.string().nullable(),evidenceId:z.string().nullable(),
 evidenceStatus:z.string().nullable(),externalReference:z.string().nullable()})),
})});
const money=(minor:number)=>new Intl.NumberFormat('en-PH',{style:'currency',currency:'PHP'}).format(minor/100);
type Action={kind:'approval'|'record'|'verify';id:string};
export function NoShowRefundPanel({hotelId,bookingId,userId}:{hotelId:string;bookingId:string;userId:string}){
 const client=useQueryClient();
 const [paymentId,setPaymentId]=useState('');
 const [amount,setAmount]=useState('');
 const [reason,setReason]=useState('');
 const [action,setAction]=useState<Action|null>(null);
 const [note,setNote]=useState('');
 const [confirmed,setConfirmed]=useState(false);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [notice,setNotice]=useState('');
 const lock=useRef(false);
 const attempt=useRef<{payload:string;key:string}|null>(null);
 const base='/bookings/'+bookingId;
 const query=useQuery({queryKey:['live','no-show-refunds',hotelId,bookingId],retry:false,staleTime:0,queryFn:async()=>{
  if(readSession().hotelId!==hotelId)throw new Error('Hotel context changed.');
  const result=schema.parse(await getJson<unknown>(hotelPath(base+'/no-show-refunds'))).data;
  if(result.bookingId!==bookingId||readSession().hotelId!==hotelId)throw new Error('Booking context changed.');
  return result;
 }});
 const data=query.isFetching||query.isError?undefined:query.data;
 const payment=data?.payments.find(p=>p.paymentId===paymentId);
 const minor=/^\d+(\.\d{1,2})?$/.test(amount)?Math.round(Number(amount)*100):NaN;
 const valid=!!data?.workflowEnabled&&data.reconciliationValid&&!!payment&&Number.isSafeInteger(minor)&&minor>0
  &&minor<=Math.min(payment.maximumRequestMinor,data.maximumRefundMinor,100000000000)&&reason.trim().length>=5&&reason.trim().length<=500;
 const refund=data?.refunds.find(r=>r.id===action?.id);
 const openAction=(next:Action)=>{setAction(next);setNote('');setConfirmed(false);setError('');};
 async function write(path:string,body:Record<string,unknown>,success:string,onSuccess?:()=>void){
  if(lock.current||readSession().hotelId!==hotelId||!data?.workflowEnabled)return;
  lock.current=true;setBusy(true);setError('');setNotice('');
  try{
   await requestJson(hotelPath(base+path),{method:'POST',body});
   setNotice(success);setAction(null);setNote('');onSuccess?.();
  }catch(cause){setError(cause instanceof Error?cause.message:'Outcome not confirmed. Refresh and review before retrying.');}
  finally{
   setConfirmed(false);
   await Promise.allSettled([query.refetch(),...['no-show-financial-review','no-show-ledger-reconciliation','no-show-deposits','no-show-allocations','settlement-statement','folio-ledger','billing-folios','financial-business-day'].map(key=>client.invalidateQueries({queryKey:['live',key,hotelId]}))]);
   lock.current=false;setBusy(false);
  }
 }
 function requestRefund(){
  if(!valid||!confirmed||action||lock.current)return;
  const body={paymentRecordId:paymentId,amountMinor:minor,reason:reason.trim()};
  const identity=JSON.stringify(body);
  if(attempt.current?.payload!==identity)attempt.current={payload:identity,key:'no-show-refund-'+crypto.randomUUID()};
  void write('/refund-requests',{...body,requestKey:attempt.current.key},'Refund requested. No funds have been sent.',()=>{attempt.current=null;setPaymentId('');setAmount('');setReason('');});
 }
 function act(decision?:'approve'|'reject'|'verify'){
  if(!refund||!action||!confirmed||!data?.workflowEnabled)return;
  const value=note.trim();
  if(action.kind==='approval'&&refund.status==='requested'&&value.length>=5&&value.length<=500&&(decision==='reject'||(decision==='approve'&&refund.requestedBy!==userId))){
   void write('/refund-requests/'+refund.id+'/review',{decision,note:value},decision==='approve'?'Refund approved. Funds have not been sent by the PMS.':'Refund rejected.');
  }else if(action.kind==='record'&&refund.status==='approved'&&!refund.evidenceId&&value.length>=8&&value.length<=160){
   void write('/refund-requests/'+refund.id+'/disbursement-evidence',{externalReference:value},'External refund evidence recorded. Independent verification is required.');
  }else if(action.kind==='verify'&&refund.status==='approved'&&refund.evidenceStatus==='pending'&&refund.evidenceId&&value.length>=10&&value.length<=2000
   &&(decision==='reject'||(decision==='verify'&&data.postingEnabled&&refund.evidenceRecordedBy!==userId))){
   void write('/refund-disbursements/'+refund.evidenceId+'/review',{decision,note:value},decision==='verify'?'External refund evidence verified. Review accounting reconciliation.':'Refund evidence rejected.');
  }
 }
 return <section className="no-show-overview" aria-label="Refund processing and verification">
  <div className="no-show-overview-heading"><div><h4>Refund processing and verification</h4><p>Request, approve and document an external bank refund. The PMS does not send money.</p></div>
   <button type="button" className="btn-inline" disabled={busy||query.isFetching} onClick={()=>{setConfirmed(false);void query.refetch();}}>Refresh refunds</button></div>
  {query.isFetching?<p role="status">Checking refund eligibility…</p>:query.isError?<p role="alert">Refund information unavailable. Refresh to retry.</p>:data&&<>
   <div className="no-show-overview-metrics"><div><span>Maximum eligible bank refund</span><strong>{money(data.maximumRefundMinor)}</strong></div><div><span>Financial reconciliation</span><strong>{data.reconciliationValid?'Valid':'Review needed'}</strong></div></div>
   {!data.workflowEnabled&&<p>Refund changes are unavailable for this booking or business date.</p>}
   {!data.postingEnabled&&<p>Refund accounting posting is disabled. Final evidence verification is unavailable in this interface.</p>}
   {data.workflowEnabled&&data.reconciliationValid&&data.maximumRefundMinor>0&&!action&&<form className="billing-payment-fields" onSubmit={event=>{event.preventDefault();requestRefund();}}>
    <label>Original bank deposit<select className="wizard-input" value={paymentId} disabled={busy} onChange={event=>{const p=data.payments.find(x=>x.paymentId===event.target.value);setPaymentId(event.target.value);setAmount(p?(Math.min(p.maximumRequestMinor,data.maximumRefundMinor,100000000000)/100).toFixed(2):'');setConfirmed(false);}}>
     <option value="">Select payment</option>{data.payments.filter(p=>p.maximumRequestMinor>0).map(p=><option key={p.paymentId} value={p.paymentId}>Payment #{p.paymentId} · {money(p.maximumRequestMinor)} eligible</option>)}</select></label>
    <label>Refund amount (PHP)<input className="wizard-input" inputMode="decimal" value={amount} disabled={busy} onChange={event=>{setAmount(event.target.value);setConfirmed(false);}}/></label>
    <label>Refund reason<textarea value={reason} maxLength={500} disabled={busy} onChange={event=>{setReason(event.target.value);setConfirmed(false);}}/></label>
    <label><input type="checkbox" checked={confirmed} disabled={busy||!valid} onChange={event=>setConfirmed(event.target.checked)}/> Request review only; no funds will be sent.</label>
    <button type="submit" className="btn-primary" disabled={busy||!valid||!confirmed}>Request refund</button>
   </form>}
   <h5>Refund history</h5>
   {data.refunds.length===0?<p>No refund requests recorded.</p>:data.refunds.map(r=><div className="no-show-deposit-row" key={r.id}>
    <div className="no-show-overview-heading"><strong>{money(r.amountMinor)} · Refund #{r.id}</strong><span className="no-show-overview-state">{r.evidenceStatus==='verified'?'Evidence verified':r.evidenceStatus==='pending'?'Evidence awaiting review':r.evidenceStatus==='rejected'?'Evidence rejected':r.status==='approved'?'Approved · evidence required':r.status==='requested'?'Awaiting approval':r.status}</span></div>
    <p>Original payment #{r.paymentId} · {r.reason}</p>
    {r.externalReference&&<p>External bank reference: {r.externalReference}</p>}
    {r.evidenceStatus==='rejected'&&<p>Ask a finance administrator to resolve rejected evidence. Do not send another refund.</p>}
    {data.workflowEnabled&&!action&&r.status==='requested'&&(r.requestedBy===userId?<p>A different administrator must approve this request.</p>:<button type="button" className="btn-inline" disabled={busy} onClick={()=>openAction({kind:'approval',id:r.id})}>Review refund #{r.id}</button>)}
    {data.workflowEnabled&&!action&&r.status==='approved'&&!r.evidenceId&&<button type="button" className="btn-inline" disabled={busy} onClick={()=>openAction({kind:'record',id:r.id})}>Record external refund #{r.id}</button>}
    {data.workflowEnabled&&!action&&r.evidenceStatus==='pending'&&(r.evidenceRecordedBy===userId?<p>A different administrator must verify this evidence.</p>:<button type="button" className="btn-inline" disabled={busy} onClick={()=>openAction({kind:'verify',id:r.id})}>Review evidence #{r.id}</button>)}
   </div>)}
   {action&&refund&&<div className="billing-payment-fields">
    <h5>{action.kind==='approval'?'Review refund request':action.kind==='record'?'Record completed external bank transfer':'Review external bank evidence'} · {money(refund.amountMinor)}</h5>
    <p>{action.kind==='record'?'Enter a reference only after the approved refund has actually been sent outside the PMS.':action.kind==='verify'?'Compare the bank statement with the approved amount and original payment.':'Approval does not transfer funds.'}</p>
    <label>{action.kind==='record'?'External bank reference':'Review note'}<textarea value={note} maxLength={action.kind==='record'?160:action.kind==='approval'?500:2000} disabled={busy} onChange={event=>{setNote(event.target.value);setConfirmed(false);}}/></label>
    <label><input type="checkbox" checked={confirmed} disabled={busy} onChange={event=>setConfirmed(event.target.checked)}/> I confirm the details above.</label>
    {action.kind==='record'?<button type="button" className="btn-primary" disabled={busy||!confirmed||note.trim().length<8} onClick={()=>act()}>Save external evidence</button>:<>
     <button type="button" className="btn-primary" disabled={busy||!confirmed||note.trim().length<(action.kind==='approval'?5:10)||(action.kind==='verify'&&!data.postingEnabled)} onClick={()=>act(action.kind==='approval'?'approve':'verify')}>{action.kind==='approval'?'Approve refund':'Verify external refund'}</button>
     <button type="button" className="btn-inline" disabled={busy||!confirmed||note.trim().length<(action.kind==='approval'?5:10)} onClick={()=>act('reject')}>Reject</button>
    </>}
    <button type="button" className="btn-inline" disabled={busy} onClick={()=>{setAction(null);setConfirmed(false);}}>Cancel</button>
   </div>}
  </>}
  {notice&&<p role="status">{notice}</p>}{error&&<p role="alert">{error}</p>}
 </section>;
}
