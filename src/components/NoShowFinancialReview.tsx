import {useEffect,useRef,useState} from 'react';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {z} from 'zod';
import {getJson,requestJson} from '../api/http';
import {hotelPath,readSession} from '../api/session';
import './NoShowFinancialOverview.css';
import {NoShowCorrectionPanel} from './NoShowCorrectionPanel';
import {NoShowRefundPanel} from './NoShowRefundPanel';
import {NoShowAllocationPanel} from './NoShowAllocationPanel';
import {NoShowDepositPanel} from './NoShowDepositPanel';
import {NoShowLedgerPanel} from './NoShowLedgerPanel';

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
  queryKey:['live','no-show-financial-review',hotelId,bookingId,userId],enabled:opened,retry:false,staleTime:0,
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
 useEffect(()=>{setExpanded(['ledger']);setReason('');setManualFee('');setTaxBasis('');setTaxClassification('');setError('');setNotice('');},[hotelId,bookingId,userId]);
 const data=query.isFetching||query.isError?undefined:query.data;
 const [expanded,setExpanded]=useState<string[]>(['ledger']);
 const [childBusy,setChildBusy]=useState(false);
 const [activeOperation,setActiveOperation]=useState<string|null>(null);
 function operation(key:string,value:boolean){setChildBusy(value);setActiveOperation(value?key:null);}
 const locked=busy||childBusy;
 const visibleData=query.isError&&!childBusy?undefined:query.data;
 function jump(target:string){
  const section=dialog.current?.querySelector<HTMLElement>('#'+target);
  if(section instanceof HTMLDetailsElement){section.open=true;}
  section?.scrollIntoView({block:'start'});
  section?.focus({preventScroll:true});
 }
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

 const pendingPayments=data?.currentFolioSummary.pendingReviewPaymentsMinor??0;
 const eligibility=data?.refundEligibility;
 const nextStep=!data?null:!data.recordedReviewId?
  {title:data.canApply||useManual?'Record financial adjustments':'Resolve review blockers',detail:'Confirm the booking policy and document the reason before recording the fee.',target:'no-show-review-details'}:
  !data.clearance?{title:!data.approvalEnabled?'Accounting approval unavailable':data.recordedBy===userId?'Waiting for another administrator':'Review fee and tax treatment',
   detail:'Accounting clearance requires an independent administrator.',target:'no-show-review-details'}:
  pendingPayments>0?{title:'Review pending payment evidence',detail:'Return to the guest bill to verify recorded payments before relying on settlement balances.',target:null}:
  !eligibility?.financialClearanceValid?{title:'Check financial reconciliation',detail:'The current clearance or settlement balances require review.',target:'no-show-accounting-details'}:
  eligibility.settled?{title:'Settlement recorded',detail:'Check matched accounting entries before treating the account as fully reconciled.',target:'no-show-accounting-details'}:
  (eligibility.maximumRefundRequestMinor>0)?{title:'Review eligible refund',detail:'Review refund eligibility and approval below. No funds are sent by the PMS.',target:'no-show-refund-details'}:
  (eligibility.remainingCollectionMinor??0)>0?{title:'Review outstanding collection',detail:'Return to the guest bill to review the remaining amount and payment evidence.',target:null}:
  {title:'Review allocation and settlement',detail:'Check unapplied deposits and remaining settlement steps below.',target:'no-show-allocation-details'};

 async function submit(approve:boolean){
  if(lock.current||childBusy||!data||readSession().hotelId!==hotelId||!(approve?canApprove:canApply))return;
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
    client.invalidateQueries({queryKey:['live','no-show-ledger-reconciliation',hotelId,bookingId]}),
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
   onCancel={event=>{if(locked)event.preventDefault();}} onClose={()=>setOpened(false)}>
   <header className="billing-action-modal-header no-show-sticky-header"><h3 id="no-show-review-title">No-show financial review</h3><button type="button" className="btn-inline" aria-label="Close financial review" disabled={locked} onClick={()=>dialog.current?.close()}>Close</button></header>
   {query.isFetching&&<p role="status">Loading current financial review…</p>}
   {query.isError&&<p role="alert">Unable to load financial review. <button type="button" onClick={()=>void query.refetch()}>Retry</button></p>}
   {data&&<>
    <section className="no-show-overview" aria-label="Financial overview">
     <div className="no-show-overview-heading"><div><h4>Financial overview</h4><p>Review the fee, payments and remaining actions.</p></div>
      <span className="no-show-overview-state">{data.clearance?'Clearance recorded':data.recordedReviewId?'Awaiting clearance':'Review required'}</span></div>
     <div className="no-show-overview-metrics">
      <div><span>No-show fee</span><strong>{money(fee)}</strong></div>
      <div><span>Verified funds</span><strong>{money(eligibility?.verifiedPaymentsMinor??verifiedMinor)}</strong></div>
      <div><span>To collect</span><strong>{money(eligibility?.financialClearanceValid?eligibility.remainingCollectionMinor:null)}</strong></div>
      <div><span>Eligible refund limit</span><strong>{money(eligibility?.financialClearanceValid?eligibility.maximumRefundRequestMinor:null)}</strong></div>
     </div>
     {nextStep&&<div className="no-show-next-step"><div><span>Recommended next step</span><h5>{nextStep.title}</h5><p>{nextStep.detail}</p></div>
      {nextStep.target?<button type="button" className="btn-inline" disabled={locked} onClick={()=>jump(nextStep.target!)}>Go to details</button>:
       <button type="button" className="btn-inline" disabled={locked} onClick={()=>dialog.current?.close()}>Return to guest bill</button>}</div>}
    </section>
    <div id="no-show-review-details">
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
     {data.refundEligibility?.settled?'Folio settlement complete.':'Accounting clearance recorded.'} VAT {money(data.clearance.vatMinor)}.
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
      <button type="submit" className="btn-primary" disabled={locked||!canApprove}>Approve accounting clearance</button>
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
      <button type="submit" className="btn-primary" disabled={locked||!canApply}>Record financial adjustments</button>
     </form>:<p>Financial adjustments are unavailable for this booking.</p>}
    </>}
    </div>
   </>}
   {opened&&visibleData&&<div className="no-show-workflow-sections" inert={busy}>
    {([
     ['corrections','no-show-correction-details','Room and fee corrections',<NoShowCorrectionPanel hotelId={hotelId} bookingId={bookingId} userId={userId} onBusyChange={value=>operation('corrections',value)}/>],
     ['deposits','no-show-deposit-details','Guest deposit accounting',<NoShowDepositPanel hotelId={hotelId} bookingId={bookingId} onBusyChange={value=>operation('deposits',value)}/>],
     ...(visibleData.clearance?[
      ['allocation','no-show-allocation-details','Deposit allocation and settlement',<NoShowAllocationPanel hotelId={hotelId} bookingId={bookingId} onBusyChange={value=>operation('allocation',value)}/>],
      ['refunds','no-show-refund-details','Refund processing and verification',<NoShowRefundPanel hotelId={hotelId} bookingId={bookingId} userId={userId} onBusyChange={value=>operation('refunds',value)}/>],
      ['ledger','no-show-accounting-details','Accounting ledger',<NoShowLedgerPanel hotelId={hotelId} bookingId={bookingId} userId={userId}/>],
     ]:[]),
    ] as [string,string,string,React.ReactNode][]).map(([key,id,label,content])=><details key={key} id={id} tabIndex={-1} className="no-show-workflow-section"
      open={expanded.includes(key)} inert={childBusy&&activeOperation!==key} onToggle={event=>{if(childBusy&&activeOperation===key&&!event.currentTarget.open){event.currentTarget.open=true;return;}const open=event.currentTarget.open;setExpanded(previous=>open?(previous.includes(key)?previous:[...previous,key]):previous.filter(k=>k!==key));}}>
      <summary onClick={event=>{if(locked)event.preventDefault();}}>{label}</summary>{expanded.includes(key)&&content}
     </details>)}
   </div>}
   {notice&&<p role="status">{notice}</p>}
   {error&&<p role="alert">{error}</p>}
   <div className="no-show-dialog-actions">
    <button type="button" className="btn-inline" disabled={busy} onClick={()=>dialog.current?.close()}>Close</button>
   </div>
  </dialog>
 </section>;
}
