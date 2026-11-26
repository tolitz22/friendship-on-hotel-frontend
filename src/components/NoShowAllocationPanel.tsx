import {useRef,useState} from 'react';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {z} from 'zod';
import {getJson,requestJson} from '../api/http';
import {hotelPath,readSession} from '../api/session';

const minor=z.number().int().safe();
const schema=z.object({data:z.object({
 bookingId:z.string(),currency:z.literal('PHP'),postingEnabled:z.boolean(),reconciled:z.boolean(),settled:z.boolean(),
 remainingFeeMinor:minor.nullable(),availableDepositMinor:minor.nullable(),maximumRefundMinor:minor,
 blocker:z.string().nullable(),payments:z.array(z.object({paymentId:z.string(),method:z.string(),availableMinor:minor.nonnegative(),maximumMinor:minor.nonnegative()})),
})});
const money=(n:number|null)=>n===null?'—':new Intl.NumberFormat('en-PH',{style:'currency',currency:'PHP'}).format(n/100);
export function NoShowAllocationPanel({hotelId,bookingId}:{hotelId:string;bookingId:string}){
 const client=useQueryClient();
 const [paymentId,setPaymentId]=useState('');
 const [amount,setAmount]=useState('');
 const [payerKind,setPayerKind]=useState('guest');
 const [payerReference,setPayerReference]=useState('');
 const [confirmed,setConfirmed]=useState(false);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [notice,setNotice]=useState('');
 const lock=useRef(false);
 const attempt=useRef<{payload:string;key:string}|null>(null);
 const path='/bookings/'+bookingId+'/no-show-allocations';
 const query=useQuery({queryKey:['live','no-show-allocations',hotelId,bookingId],retry:false,staleTime:0,queryFn:async()=>{
  if(readSession().hotelId!==hotelId)throw new Error('Hotel context changed.');
  const result=schema.parse(await getJson<unknown>(hotelPath(path))).data;
  if(result.bookingId!==bookingId||readSession().hotelId!==hotelId)throw new Error('Booking context changed.');
  return result;
 }});
 const data=query.isFetching||query.isError?undefined:query.data;
 const payment=data?.payments.find(p=>p.paymentId===paymentId);
 const amountMinor=/^\d+(\.\d{1,2})?$/.test(amount)?Math.round(Number(amount)*100):NaN;
 const valid=!!data?.postingEnabled&&data.reconciled&&!data.blocker&&!!payment&&Number.isSafeInteger(amountMinor)
  &&amountMinor>0&&amountMinor<=payment.maximumMinor&&payerReference.trim().length>=3&&payerReference.trim().length<=120;
 async function submit(){
  if(!valid||!confirmed||lock.current||readSession().hotelId!==hotelId)return;
  const payload={amountMinor,payerKind,payerReference:payerReference.trim(),acknowledged:true};
  const identity=JSON.stringify([paymentId,payload]);
  if(attempt.current?.payload!==identity)attempt.current={payload:identity,key:'no-show-ui-'+crypto.randomUUID()};
  lock.current=true;setBusy(true);setError('');setNotice('');
  try{
   await requestJson(hotelPath(path+'/'+paymentId),{method:'POST',body:{...payload,requestKey:attempt.current.key}});
   attempt.current=null;setPaymentId('');setAmount('');setNotice('Deposit allocation recorded.');
  }catch(cause){setError(cause instanceof Error?cause.message:'Allocation not confirmed. Refresh before retrying.');}
  finally{
   setConfirmed(false);
   await Promise.allSettled([query.refetch(),...['no-show-ledger-reconciliation','no-show-deposits','no-show-financial-review','settlement-statement','folio-ledger','billing-folios','financial-business-day'].map(key=>client.invalidateQueries({queryKey:['live',key,hotelId]}))]);
   lock.current=false;setBusy(false);
  }
 }
 return <section className="no-show-overview" aria-label="Deposit allocation and settlement">
  <div className="no-show-overview-heading"><div><h4>Deposit allocation and settlement</h4><p>Apply money already received toward the no-show fee.</p></div>
   <button type="button" className="btn-inline" disabled={busy||query.isFetching} onClick={()=>{setConfirmed(false);void query.refetch();}}>Refresh allocation</button></div>
  {query.isFetching?<p role="status">Checking allocation eligibility…</p>:query.isError?<p role="alert">Allocation information is unavailable. Refresh to retry.</p>:data&&<>
   <div className="no-show-overview-metrics">
    <div><span>Fee not yet allocated</span><strong>{money(data.remainingFeeMinor)}</strong></div>
    <div><span>Unallocated verified funds</span><strong>{money(data.availableDepositMinor)}</strong></div>
    <div><span>Eligible bank refund limit</span><strong>{money(data.maximumRefundMinor)}</strong></div>
    <div><span>Settlement status</span><strong>{data.settled?'Settled':data.reconciled?'Incomplete':'Review needed'}</strong></div>
   </div>
   {data.blocker?<p>{data.blocker}</p>:data.payments.some(p=>p.maximumMinor>0)?<form className="billing-payment-fields" onSubmit={event=>{event.preventDefault();void submit();}}>
    <label>Verified deposit<select className="wizard-input" value={paymentId} disabled={busy} onChange={event=>{
     const p=data.payments.find(x=>x.paymentId===event.target.value);setPaymentId(event.target.value);setAmount(p?(p.maximumMinor/100).toFixed(2):'');setConfirmed(false);
    }}><option value="">Select deposit</option>{data.payments.filter(p=>p.maximumMinor>0).map(p=><option key={p.paymentId} value={p.paymentId}>Payment #{p.paymentId} · {money(p.availableMinor)} available</option>)}</select></label>
    <label>Amount to apply (PHP)<input className="wizard-input" inputMode="decimal" value={amount} disabled={busy} onChange={event=>{setAmount(event.target.value);setConfirmed(false);}}/></label>
    {payment&&<p>Maximum applicable: {money(payment.maximumMinor)}</p>}
    <label>Payer type<select className="wizard-input" value={payerKind} disabled={busy} onChange={event=>{setPayerKind(event.target.value);setConfirmed(false);}}><option value="guest">Guest</option><option value="company">Company</option><option value="group">Group</option></select></label>
    <label>Payer name or reference<input className="wizard-input" value={payerReference} maxLength={120} disabled={busy} onChange={event=>{setPayerReference(event.target.value);setConfirmed(false);}}/></label>
    <label><input type="checkbox" checked={confirmed} disabled={busy||!valid} onChange={event=>setConfirmed(event.target.checked)}/> Apply this existing deposit to the fee; no new money is collected.</label>
    <button type="submit" className="btn-primary" disabled={busy||!valid||!confirmed}>{busy?'Applying…':'Apply deposit'}</button>
   </form>:<p>No eligible deposit allocation remains. Review settlement or refund requirements as applicable.</p>}
  </>}
  {notice&&<p role="status">{notice}</p>}{error&&<p role="alert">{error}</p>}
 </section>;
}
