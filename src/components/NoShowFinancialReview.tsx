import {useRef,useState} from 'react';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {z} from 'zod';
import {getJson,requestJson} from '../api/http';
import {hotelPath,readSession} from '../api/session';

const reviewSchema=z.object({
 bookingId:z.string(),currency:z.string(),noShowKind:z.string().nullable(),
 originalRoomSubtotalMinor:z.number().int(),proposedNoShowFeeMinor:z.number().int().nullable(),
 proposedRoomCreditMinor:z.number().int().nullable(),
 currentFolioSummary:z.object({staffConfirmedPaymentsMinor:z.number(),pendingReviewPaymentsMinor:z.number()}),
 blockers:z.array(z.string()),canApply:z.boolean(),reviewFingerprint:z.string().regex(/^[a-f0-9]{64}$/),
 recordedReviewId:z.string().nullable(),recordedBy:z.string().nullable().optional(),
 recordedFeeMinor:z.number().nullable().optional(),approvalEnabled:z.boolean().default(false),
 clearance:z.object({id:z.string(),vatMinor:z.number(),revenueMinor:z.number(),businessDate:z.string()}).nullable().optional(),
});
export function NoShowFinancialReview({hotelId,bookingId,userId,verifiedMinor}:{hotelId:string;bookingId:string;userId:string;verifiedMinor:number}){
 const client=useQueryClient();
 const dialog=useRef<HTMLDialogElement>(null);
 const lock=useRef(false);
 const [opened,setOpened]=useState(false);
 const [reason,setReason]=useState('');
 const [taxBasis,setTaxBasis]=useState('');
 const [vat,setVat]=useState('');
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const path='/bookings/'+bookingId+'/no-show-financial-review';
 const query=useQuery({queryKey:['live','no-show-financial-review',hotelId,bookingId],enabled:opened,retry:false,staleTime:0,
  queryFn:async()=>{
   if(readSession().hotelId!==hotelId)throw new Error('Hotel context changed.');
   const data=z.object({data:reviewSchema}).parse(await getJson<unknown>(hotelPath(path))).data;
   if(data.bookingId!==bookingId||readSession().hotelId!==hotelId)throw new Error('Booking context changed.');
   return data;
  }});
 const data=query.isFetching?undefined:query.data;
 const money=(amount:number|null|undefined)=>amount==null?'Requires review':new Intl.NumberFormat('en-PH',{style:'currency',currency:data?.currency??'PHP'}).format(amount/100);
 const vatMinor=/^\d+(\.\d{1,2})?$/.test(vat)?Math.round(Number(vat)*100):NaN;
 const canApprove=!!data?.recordedReviewId&&!!data.recordedBy&&data.recordedBy!==userId&&data.approvalEnabled&&!data.clearance&&Number.isSafeInteger(vatMinor)&&vatMinor>=0&&vatMinor<=(data.recordedFeeMinor??-1)&&taxBasis.trim().length>=12;
 async function submit(approve:boolean){
  if(lock.current||!data||readSession().hotelId!==hotelId)return;
  if(approve?!canApprove:!data.canApply||reason.trim().length<12)return;
  lock.current=true;setBusy(true);setError('');
  try{
   await requestJson(hotelPath(approve?path+'/'+data.recordedReviewId+'/approve':path),{method:'POST',body:approve?{vatMinor,taxBasis:taxBasis.trim()}:{reviewFingerprint:data.reviewFingerprint,reason:reason.trim()}});
   setReason('');setVat('');setTaxBasis('');
  }catch(cause){setError(cause instanceof Error?cause.message:'Unable to complete review.');}
  finally{
   await Promise.allSettled([query.refetch(),client.invalidateQueries({queryKey:['live','settlement-statement',hotelId,bookingId]})]);
   lock.current=false;setBusy(false);
  }
 }
 return <section className="stay-operation-impact" aria-label="No-show financial reconciliation">
  <h3>No-show financial reconciliation</h3>
  <p>Review the agreed penalty and unused room charges. Existing deposits are preserved; refunds require separate approval.</p>
  <button type="button" className="btn-primary" onClick={()=>{setOpened(true);setError('');dialog.current?.showModal();}}>Review no-show finances</button>
  <dialog ref={dialog} className="billing-action-modal" aria-label="No-show financial review" onCancel={e=>{if(busy)e.preventDefault();}} onClose={()=>setOpened(false)}>
   <header className="billing-action-modal-header"><h3>No-show financial review</h3></header>
   {query.isFetching&&<p role="status">Loading current financial review…</p>}
   {query.isError&&<p role="alert">Unable to load financial review. <button type="button" onClick={()=>void query.refetch()}>Retry</button></p>}
   {data&&<>
    <p>Policy: {data.noShowKind?.replaceAll('_',' ')??'Manual policy review required'}</p>
    {([['Original room charges',data.originalRoomSubtotalMinor],['Proposed net room credit',data.proposedRoomCreditMinor],['No-show fee',data.recordedFeeMinor??data.proposedNoShowFeeMinor],['Verified payments',verifiedMinor],['Pending staff review',data.currentFolioSummary.pendingReviewPaymentsMinor]] as const).map(([label,value])=><div className="rb-summary-row" key={label}><span>{label}</span><strong>{money(value)}</strong></div>)}
    {data.clearance?<p role="status">Accounting clearance recorded on {data.clearance.businessDate}. VAT: {money(data.clearance.vatMinor)}.</p>:data.recordedReviewId?<>
     <p>Financial adjustments recorded. Independent accounting approval required.</p>
     {data.recordedBy===userId?<p>Another authorized administrator must approve this review.</p>:<div className="billing-payment-fields">
      <label>Reviewed VAT amount (PHP)<input className="wizard-input" inputMode="decimal" value={vat} disabled={busy} onChange={e=>setVat(e.target.value)}/></label>
      <label>Documented tax treatment<textarea value={taxBasis} disabled={busy} maxLength={1000} onChange={e=>setTaxBasis(e.target.value)}/></label>
      <button type="button" className="btn-primary" disabled={busy||!canApprove} onClick={()=>void submit(true)}>Approve accounting clearance</button>
     </div>}
    </>:<>
     {data.blockers.map((message,i)=><p role="alert" key={i}>{message}</p>)}
     {!data.canApply&&<p>Financial adjustment confirmation is unavailable for this review.</p>}
     <label>Review reason<textarea value={reason} disabled={busy||!data.canApply} maxLength={500} onChange={e=>setReason(e.target.value)}/></label>
     <button type="button" className="btn-primary" disabled={busy||!data.canApply||reason.trim().length<12} onClick={()=>void submit(false)}>Confirm financial adjustments</button>
    </>}
   </>}
   {error&&<p role="alert">{error}</p>}
   <button type="button" className="btn-inline" disabled={busy} onClick={()=>dialog.current?.close()}>Close</button>
  </dialog>
 </section>;
}
