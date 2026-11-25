import {useEffect,useRef,useState} from 'react';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {z} from 'zod';
import {getJson,requestJson} from '../api/http';
import {hotelPath,readSession} from '../api/session';

const reviewSchema=z.object({
 bookingId:z.string(),currency:z.string(),noShowKind:z.string().nullable(),
 originalRoomSubtotalMinor:z.number().int(),proposedNoShowFeeMinor:z.number().int().nullable(),
 proposedRoomCreditMinor:z.number().int().nullable(),
 currentFolioSummary:z.object({pendingReviewPaymentsMinor:z.number()}),
 blockers:z.array(z.string()),canApply:z.boolean(),canApplyManual:z.boolean().default(false),
 reviewFingerprint:z.string().regex(/^[a-f0-9]{64}$/),
 recordedReviewId:z.string().nullable(),recordedBy:z.string().nullable().optional(),
 recordedFeeMinor:z.number().nullable().optional(),recordedReason:z.string().nullable().optional(),
 approvalEnabled:z.boolean().default(false),
 clearance:z.object({id:z.string(),vatMinor:z.number(),revenueMinor:z.number(),businessDate:z.string()}).nullable().optional(),
 refundEligibility:z.object({
  financialClearanceValid:z.boolean(),verifiedPaymentsMinor:z.number(),
  remainingCollectionMinor:z.number().nullable(),maximumRefundRequestMinor:z.number(),settled:z.boolean(),
 }).nullable().optional(),
});

type Props={hotelId:string;bookingId:string;userId:string;verifiedMinor:number;openOnLoad?:boolean};
const taxClassifications=[
 ['vat_standard','VAT-inclusive (12%)'],['vat_zero','Zero-rated VAT'],
 ['vat_exempt','VAT-exempt'],['non_vat','Outside VAT'],
] as const;
const policyLabels:Record<string,string>={
 none:'No penalty',fixed:'Fixed amount',first_night:'First night',full:'Full room charges',percent:'Percentage of room charges',
};

export function NoShowFinancialReview({hotelId,bookingId,userId,verifiedMinor,openOnLoad}:Props){
 const client=useQueryClient();
 const dialog=useRef<HTMLDialogElement>(null);
 const lock=useRef(false);
 const [opened,setOpened]=useState(false);
 const [reason,setReason]=useState('');
 const [manualFee,setManualFee]=useState('');
 const [taxBasis,setTaxBasis]=useState('');
 const [taxClassification,setTaxClassification]=useState('');
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [notice,setNotice]=useState('');
 const path='/bookings/'+bookingId+'/no-show-financial-review';
 const query=useQuery({
  queryKey:['live','no-show-financial-review',hotelId,bookingId],enabled:opened,retry:false,staleTime:0,
  queryFn:async()=>{
   if(readSession().hotelId!==hotelId)throw new Error('Hotel context changed.');
   const data=z.object({data:reviewSchema}).parse(await getJson<unknown>(hotelPath(path))).data;
   if(data.bookingId!==bookingId||readSession().hotelId!==hotelId)throw new Error('Booking context changed.');
   return data;
  },
 });
 useEffect(()=>{
  if(openOnLoad&&!dialog.current?.open){
   dialog.current?.showModal();
   setOpened(true);
  }
 },[openOnLoad]);
 const data=query.isFetching||query.isError?undefined:query.data;
 const money=(amount:number|null|undefined)=>amount==null?'—':
  new Intl.NumberFormat('en-PH',{style:'currency',currency:data?.currency??'PHP'}).format(amount/100);
 const manualFeeMinor=/^\d+(\.\d{1,2})?$/.test(manualFee)?Math.round(Number(manualFee)*100):NaN;
 const useManual=data?.canApplyManual===true;
 const canApply=(data?.canApply||(useManual&&Number.isSafeInteger(manualFeeMinor)
  &&manualFeeMinor<=data.originalRoomSubtotalMinor))&&reason.trim().length>=12;
 const canApprove=!!data?.recordedReviewId&&!!data.recordedBy&&data.recordedBy!==userId
  &&data.approvalEnabled&&!data.clearance&&!!taxClassification&&taxBasis.trim().length>=12;
 const fee=data?.recordedFeeMinor??data?.proposedNoShowFeeMinor
  ??(useManual&&Number.isSafeInteger(manualFeeMinor)?manualFeeMinor:null);

 async function submit(approve:boolean){
  if(lock.current||!data||readSession().hotelId!==hotelId||!(approve?canApprove:canApply))return;
  lock.current=true;
  setBusy(true);
  setError('');
  setNotice('');
  try{
   await requestJson(hotelPath(approve?path+'/'+data.recordedReviewId+'/approve':path),{
    method:'POST',
    body:approve?{taxClassification,taxBasis:taxBasis.trim()}:{
     reviewFingerprint:data.reviewFingerprint,reason:reason.trim(),...(useManual?{manualFeeMinor}:{}),
    },
   });
   setNotice(approve?'Accounting clearance recorded.':'Folio adjustments recorded.');
   setReason('');
   setManualFee('');
   setTaxClassification('');
   setTaxBasis('');
  }catch(cause){
   setError(cause instanceof Error?cause.message:'Unable to complete review.');
  }finally{
   await Promise.allSettled([
    query.refetch(),
    ...['settlement-statement','folio-ledger','billing-folios','financial-business-day','night-audit-reconciliation']
     .map(key=>client.invalidateQueries({queryKey:['live',key,hotelId]})),
   ]);
   lock.current=false;
   setBusy(false);
  }
 }

 return <section className="stay-operation-impact" aria-label="No-show financial reconciliation">
  <h3>No-show financial reconciliation</h3>
  <button type="button" className="btn-primary" onClick={()=>{
   setOpened(true);
   setError('');
   dialog.current?.showModal();
  }}>Review no-show finances</button>
  <dialog ref={dialog} className="billing-action-modal no-show-dialog" aria-labelledby="no-show-review-title"
   onCancel={event=>{if(busy)event.preventDefault();}} onClose={()=>setOpened(false)}>
   <header className="billing-action-modal-header"><h3 id="no-show-review-title">No-show financial review</h3></header>
   {query.isFetching&&<p role="status">Loading current financial review…</p>}
   {query.isError&&<p role="alert">Unable to load financial review. <button type="button" onClick={()=>void query.refetch()}>Retry</button></p>}
   {data&&<>
    <p>{data.noShowKind&&policyLabels[data.noShowKind]?policyLabels[data.noShowKind]:'No saved penalty policy. Document the basis for any fee.'}</p>
    {([
     ['Room charges before review',data.originalRoomSubtotalMinor],
     ['Unused room charges to reverse',data.proposedRoomCreditMinor],
     ['No-show penalty',fee],
     ['Verified payments',data.refundEligibility?.verifiedPaymentsMinor??verifiedMinor],
     ['Payments awaiting staff review',data.currentFolioSummary.pendingReviewPaymentsMinor],
     ...(data.refundEligibility?.financialClearanceValid?[
      ['Outstanding balance',data.refundEligibility.remainingCollectionMinor] as const,
      ['Maximum eligible bank refund',data.refundEligibility.maximumRefundRequestMinor] as const,
     ]:[]),
    ] as const).map(([label,value])=><div className="rb-summary-row" key={label}>
     <span>{label}</span><strong>{money(value)}</strong>
    </div>)}
    {data.clearance?<p role="status">
     {data.refundEligibility?.settled?'Financially settled.':'Accounting clearance recorded.'} VAT {money(data.clearance.vatMinor)}.
    </p>:data.recordedReviewId?<>
     <p>Folio adjustments recorded. A second administrator must review the fee and tax treatment.</p>
     {data.recordedReason&&<p>{data.recordedReason}</p>}
     {data.recordedBy!==userId&&data.approvalEnabled&&<form className="billing-payment-fields" onSubmit={event=>{
      event.preventDefault();
      void submit(true);
     }}>
      <label>Tax treatment<select className="wizard-input" value={taxClassification} disabled={busy}
       onChange={event=>setTaxClassification(event.target.value)}>
       <option value="">Select approved treatment</option>
       {taxClassifications.map(([value,label])=><option key={value} value={value}>{label}</option>)}
      </select></label>
      <label>Tax policy reference and justification<textarea value={taxBasis} disabled={busy} maxLength={1000}
       onChange={event=>setTaxBasis(event.target.value)}/></label>
      <button type="submit" className="btn-primary" disabled={busy||!canApprove}>Approve accounting clearance</button>
     </form>}
    </>:<>
     {data.blockers.map(message=><p role="alert" key={message}>{message}</p>)}
     {(data.canApply||useManual)?<form className="billing-payment-fields" onSubmit={event=>{
      event.preventDefault();
      void submit(false);
     }}>
      {useManual&&<label>Documented penalty (PHP)<input className="wizard-input" inputMode="decimal"
       value={manualFee} disabled={busy} onChange={event=>setManualFee(event.target.value)}/></label>}
      <label>Review reason<textarea value={reason} disabled={busy} maxLength={500}
       onChange={event=>setReason(event.target.value)}/></label>
      <button type="submit" className="btn-primary" disabled={busy||!canApply}>Record financial adjustments</button>
     </form>:<p>Financial adjustments are unavailable for this booking.</p>}
    </>}
   </>}
   {notice&&<p role="status">{notice}</p>}
   {error&&<p role="alert">{error}</p>}
   <div className="no-show-dialog-actions">
    <button type="button" className="btn-inline" disabled={busy} onClick={()=>dialog.current?.close()}>Close</button>
   </div>
  </dialog>
 </section>;
}
