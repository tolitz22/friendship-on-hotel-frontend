import {useRef,useState} from 'react';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {z} from 'zod';
import {getJson,requestJson} from '../api/http';
import {hotelPath,readSession} from '../api/session';

const schema=z.object({data:z.object({
 bookingId:z.string(),currency:z.literal('PHP'),businessDate:z.string().nullable(),postingEnabled:z.boolean(),
 payments:z.array(z.object({paymentId:z.string(),method:z.string(),amountMinor:z.number().int(),verified:z.boolean(),
 status:z.enum(['ready','recognized','historical','blocked','reconcile']),reason:z.string(),journalId:z.string().nullable(),canRecognize:z.boolean()})),
})});
const labels={ready:'Ready for accounting',recognized:'Recognized',historical:'Historical review required',blocked:'Not ready',reconcile:'Reconciliation required'};
const money=(minor:number)=>new Intl.NumberFormat('en-PH',{style:'currency',currency:'PHP'}).format(minor/100);
type Props={hotelId:string;bookingId:string;onBusyChange?:(busy:boolean)=>void};
export function NoShowDepositPanel({hotelId,bookingId,onBusyChange}:Props){
 const client=useQueryClient();
 const [selected,setSelected]=useState<string|null>(null);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const lock=useRef(false);
 const path='/bookings/'+bookingId+'/no-show-deposits';
 const query=useQuery({queryKey:['live','no-show-deposits',hotelId,bookingId],retry:false,staleTime:0,queryFn:async()=>{
  if(readSession().hotelId!==hotelId)throw new Error('Hotel context changed.');
  const result=schema.parse(await getJson<unknown>(hotelPath(path))).data;
  if(result.bookingId!==bookingId||readSession().hotelId!==hotelId)throw new Error('Booking context changed.');
  return result;
 }});
 const data=query.isFetching||query.isError?undefined:query.data;
 const item=data?.payments.find(p=>p.paymentId===selected&&p.canRecognize&&p.status==='ready');
 async function recognize(){
  if(!item||lock.current||readSession().hotelId!==hotelId)return;
  lock.current=true;setBusy(true);onBusyChange?.(true);setError('');
  try{
   await requestJson(hotelPath(path+'/'+item.paymentId+'/recognize'),{method:'POST',body:{acknowledged:true}});
  }catch(cause){setError(cause instanceof Error?cause.message:'Recognition unavailable. Refresh before retrying.');}
  finally{
   setSelected(null);
   await Promise.allSettled([query.refetch(),...['no-show-ledger-reconciliation','no-show-financial-review','settlement-statement','folio-ledger','billing-folios','financial-business-day'].map(key=>client.invalidateQueries({queryKey:['live',key,hotelId]}))]);
   lock.current=false;setBusy(false);onBusyChange?.(false);
  }
 }
 return <section className="no-show-overview" aria-label="Guest deposit accounting">
  <div className="no-show-overview-heading"><div><h4>Guest deposit accounting</h4><p>Recognize existing receipts in accounting, not as a new payment.</p></div>
   <button type="button" className="btn-inline" disabled={busy||query.isFetching} onClick={()=>{setSelected(null);void query.refetch();}}>Refresh deposits</button></div>
  {query.isFetching?<p role="status">Checking deposits…</p>:query.isError?<p role="alert">Deposit accounting is unavailable. Refresh to retry.</p>:data&&<>
   {!data.postingEnabled&&<p>Deposit posting is currently disabled. You can still review recorded entries.</p>}
   {data.payments.length===0?<p>No recorded deposits for this booking.</p>:data.payments.map(payment=><div className="no-show-deposit-row" key={payment.paymentId}>
    <div className="no-show-overview-heading"><strong>{money(payment.amountMinor)} · {payment.method==='bank_transfer'?'Bank transfer':payment.method==='cash'?'Cash':payment.method}</strong><span className="no-show-overview-state">{labels[payment.status]}</span></div>
    <p>Payment #{payment.paymentId} · {payment.verified?'Independently verified':'Verification required'}{payment.journalId?' · Journal #'+payment.journalId:''}</p>
    <p>{payment.reason}</p>
    {payment.canRecognize&&payment.status==='ready'&&data.postingEnabled&&<button type="button" className="btn-inline" disabled={busy} onClick={()=>setSelected(payment.paymentId)}>Recognize deposit #{payment.paymentId}</button>}
   </div>)}
   {item&&<div className="no-show-next-step"><div><h5>Confirm accounting recognition</h5><p>Record {money(item.amountMinor)} for payment #{item.paymentId}. This does not collect money or change the cash drawer.</p></div>
    <div><button type="button" className="btn-primary" disabled={busy} onClick={()=>void recognize()}>{busy?'Recording…':'Confirm recognition'}</button> <button type="button" className="btn-inline" disabled={busy} onClick={()=>setSelected(null)}>Cancel</button></div></div>}
  </>}
  {error&&<p role="alert">{error}</p>}
 </section>;
}
