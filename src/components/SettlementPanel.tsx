import {useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {Link} from '@tanstack/react-router';
import {z} from 'zod';
import {AlertTriangle,CheckCircle2,ClipboardCheck,Printer,RefreshCw,ShieldCheck,Wallet,Banknote,ArrowRight,X} from 'lucide-react';
import {getJson,requestJson} from '../api/http';
import {hotelPath,readSession} from '../api/session';
import {useHotelAuth} from './AuthProvider';
import {QueryFeedback} from './QueryFeedback';
import {BillingActions} from './BillingActions';
import {RecordGuestPayment} from './RecordGuestPayment';
import {parseBillingAmount} from '../api/billing';
import {readableDate,readableDateTime} from '../lib/format';
import './settlement-print.css';

const id=z.string().regex(/^[1-9]\d*$/);
const charge=z.object({
 id,type:z.string(),description:z.string(),stayDate:z.string().nullable(),
 amountMinor:z.number().int(),
});
const adjustment=z.object({
 id,kind:z.string(),description:z.string(),amountMinor:z.number().int(),
});
const payment=z.object({
 id,method:z.string(),reference:z.string(),amountMinor:z.number().int(),
 status:z.string(),verificationStatus:z.string().nullable(),
 verificationId:id.nullable(),verificationPreparedBy:id.nullable(),
 evidenceKind:z.string().nullable(),evidenceReference:z.string().nullable(),
});
const paymentHandoff=z.object({
 paymentId:id,recordedBy:id.nullable(),recordedByName:z.string().nullable(),
 verificationPreparedByName:z.string().nullable(),
 cashShiftId:id.nullable(),cashierId:id.nullable(),cashShiftStatus:z.enum([
  'open','submitted','reconciled','flagged','unlinked','not_applicable',
 ]),
 cashierName:z.string().nullable(),reconciledByName:z.string().nullable(),
 reconciledBy:id.nullable(),
});
const allocation=z.object({
 id,paymentId:id,folioEntryId:id.nullable(),payerKind:z.string(),
 payerReference:z.string(),amountMinor:z.number().int(),
});
const refund=z.object({
 id,paymentId:id,amountMinor:z.number().int(),reason:z.string(),
 status:z.string(),requestedBy:id,reviewedBy:id.nullable(),
 evidenceId:id.nullable(),evidenceStatus:z.string().nullable(),
 evidenceRecordedBy:id.nullable(),evidenceReviewedBy:id.nullable(),
 externalReference:z.string().nullable(),
});
const tax=z.object({
 folioEntryId:id,stayDate:z.string(),status:z.string(),grossMinor:z.number(),
 vatMinor:z.number(),roomRevenueMinor:z.number(),folioCreditMinor:z.number(),benefitKind:z.string(),
});
const statement=z.object({
 hotelId:id,bookingId:id,folioId:id,reservationReference:z.string(),
 checkIn:z.string(),checkOut:z.string(),status:z.string(),currency:z.string(),
 charges:z.array(charge),adjustments:z.array(adjustment),
 payments:z.array(payment),cashShiftContexts:z.array(paymentHandoff),
 allocations:z.array(allocation),taxAllocations:z.array(tax),
 refunds:z.array(refund),verifiedRefundsMinor:z.number().int(),
 netRecordedChargesMinor:z.number().int(),
 verifiedPaymentsMinor:z.number().int(),verifiedAllocatedMinor:z.number().int(),
 unallocatedVerifiedDepositsMinor:z.number().int(),remainingMinor:z.number().int(),
 blockers:z.array(z.string()),canSignOff:z.boolean(),signed:z.boolean(),
 signedSnapshotIntegrity:z.boolean(),signedSnapshotSha256:z.string().nullable(),
 signedAt:z.string().nullable(),signedBy:id.nullable(),
 isTaxInvoice:z.literal(false),bankOrGatewayApiVerified:z.literal(false),
 paymentEvidenceIndependentlyReviewed:z.boolean(),settlementWorkflowEnabled:z.boolean(),
});
type Statement=z.infer<typeof statement>;
type Payment=z.infer<typeof payment>;
function money(value:number,currency:string){
 return currency==='PHP'
  ?new Intl.NumberFormat('en-PH',{style:'currency',currency:'PHP'}).format(value/100)
  :value.toLocaleString()+' '+currency+' minor units';
}
function KeyValue({label,value}:{label:string;value:string}){
 return <div className="settlement-metric"><small>{label}</small><strong>{value}</strong></div>;
}

export function SettlementPanel({bookingId}:{bookingId:string}){
 const {hotelId,user}=useHotelAuth();
 const client=useQueryClient();
 const manager=!!hotelId&&!!user?.hotels.some(h=>h.id===hotelId&&h.role==='admin');
 const [selected,setSelected]=useState('');
 const [reviewStage,setReviewStage]=useState<'confirmation'|'allocation'>('confirmation');
 const [activeDialog,setActiveDialog]=useState<'payment'|'charges'|'review'|'refunds'|'signoff'|null>(null);
 const dialogCloser=useRef<HTMLButtonElement>(null);
 const dialogOpener=useRef<HTMLElement|null>(null);
 const busyRef=useRef(false);
 const [reference,setReference]=useState('');
 const [reviewNote,setReviewNote]=useState('');
 const [payerKind,setPayerKind]=useState('guest');
 const [payerRef,setPayerRef]=useState('');
 const [amount,setAmount]=useState('');
 const [entryId,setEntryId]=useState('');
 const [requestKey,setRequestKey]=useState(()=>crypto.randomUUID());
 const [refundPayment,setRefundPayment]=useState('');
 const [refundAmount,setRefundAmount]=useState('');
 const [refundReason,setRefundReason]=useState('');
 const [refundKey,setRefundKey]=useState(()=>crypto.randomUUID());
 const [refundEvidence,setRefundEvidence]=useState('');
 const [refundNote,setRefundNote]=useState('');

 const [ack,setAck]=useState(false);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [success,setSuccess]=useState('');
 const valid=!!hotelId&&/^[1-9]\d*$/.test(bookingId);
 const endpoint='/bookings/'+bookingId;
 useEffect(()=>{
  setActiveDialog(null);setReviewStage('confirmation');setSelected('');setReference('');setReviewNote('');setPayerKind('guest');
  setPayerRef('');setAmount('');setEntryId('');setAck(false);setBusy(false);
  setError('');setSuccess('');setRequestKey(crypto.randomUUID());
  setRefundPayment('');setRefundAmount('');setRefundReason('');
  setRefundKey(crypto.randomUUID());setRefundEvidence('');setRefundNote('');
 },[hotelId,bookingId]);
 const query=useQuery({
  queryKey:['live','settlement-statement',hotelId,bookingId],
  enabled:valid,
  queryFn:async():Promise<Statement>=>{
   const result=z.object({data:statement}).parse(
    await getJson<unknown>(hotelPath(endpoint+'/settlement-statement'))).data;
   if(result.hotelId!==hotelId||result.bookingId!==bookingId)
    throw new Error('Unexpected reservation or hotel in settlement statement.');
   return result;
  },
  retry:false,
 });
 const data=query.data;
 busyRef.current=busy;
 useEffect(()=>{
  if(data?.signed&&activeDialog&&['review','refunds','signoff'].includes(activeDialog)){
   setActiveDialog(null);
  }
 },[data?.signed,activeDialog]);
 const paymentRow=data?.payments.find(p=>p.id===selected);
 const accounted=data?.allocations.filter(a=>a.paymentId===selected)
  .reduce((sum,a)=>sum+a.amountMinor,0)??0;
 const available=paymentRow?paymentRow.amountMinor-accounted:0;
 const minorInput=(text:string):number|null=>data?.currency==='PHP'
  ?parseBillingAmount(text)
  :/^\d+$/.test(text)&&Number.isSafeInteger(Number(text))&&Number(text)>0?Number(text):null;
 const allocationMinor=minorInput(amount);
 const refundMinor=minorInput(refundAmount);
 const recordedActive=data?.payments.filter(p=>p.status==='pending_review'||p.status==='staff_confirmed')??[];
 const recordedTotal=recordedActive.reduce((sum,p)=>sum+p.amountMinor,0);
 const confirmedPendingVerification=data?.payments.filter(p=>p.status==='staff_confirmed'
  &&p.verificationStatus!=='verified')??[];
 const verifiedTotal=data?.verifiedPaymentsMinor??0;
 const unconfirmed=data?.payments.filter(p=>p.status==='pending_review')??[];
 const unverified=data?.payments.filter(p=>p.status==='staff_confirmed'
  &&p.verificationStatus!=='verified')??[];
 const allocatedByPayment=new Map<string,number>();
 for(const row of data?.allocations??[])
  allocatedByPayment.set(row.paymentId,(allocatedByPayment.get(row.paymentId)??0)+row.amountMinor);
 const verifiedUnallocated=(data?.payments??[]).filter(p=>p.status==='staff_confirmed'
  &&p.verificationStatus==='verified'
  &&p.amountMinor>(allocatedByPayment.get(p.id)??0));
 const nextPayment=unverified[0]??verifiedUnallocated[0]??null;
 const pendingOtherReviewer=nextPayment?.verificationStatus==='pending'
  &&nextPayment.verificationPreparedBy===user?.id;
 const nextTask=data?.signed?'signed':unconfirmed.length>0?'confirmation'
  :!data?.settlementWorkflowEnabled?'disabled':unverified.length>0?'verification'
  :verifiedUnallocated.length>0?'allocation':data?.canSignOff?'signoff':'review';
 const nextCashPayment=nextTask==='verification'&&nextPayment?.method==='cash'
  ?nextPayment:null;
 const handoff=nextCashPayment
  ?data?.cashShiftContexts.find(row=>row.paymentId===nextCashPayment.id):undefined;
 const cashShiftStatus=handoff?.cashShiftStatus??'unlinked';
 const ownCashierShift=handoff?.cashierId===user?.id;
 const cashNeedsReconciliation=!!nextCashPayment&&cashShiftStatus!=='reconciled';
 const recorderIsCurrent=!!nextPayment&&
  data?.cashShiftContexts.find(row=>row.paymentId===nextPayment.id)?.recordedBy===user?.id;
 const cannotVerifyOwn=!!nextPayment&&(pendingOtherReviewer||recorderIsCurrent);
 const hasExistingMoney=recordedTotal>0;
 const nextHeading=data?.signed?'Financial account signed'
  :nextTask==='disabled'?'Final settlement is unavailable'
  :nextTask==='confirmation'?'Manager must confirm payment evidence'
  :nextTask==='verification'&&cashNeedsReconciliation
   ?cashShiftStatus==='open'?'Cashier must submit the cash count'
    :cashShiftStatus==='submitted'?'Manager must reconcile the cashier shift'
    :cashShiftStatus==='flagged'?'Cashier shift requires investigation'
    :'Cash receipt needs investigation'
  :nextTask==='verification'&&cannotVerifyOwn?'Awaiting another authorized manager'
  :nextTask==='verification'?'Independent payment verification required'
  :nextTask==='allocation'?'Apply verified payment to the bill'
  :nextTask==='signoff'?'Manager must sign off the guest account'
  :'Resolve remaining settlement checks';
 const nextDescription=nextTask==='disabled'
  ?'Payment records remain on file. Final settlement cannot proceed until the hotel enables approved verification controls.'
  :nextTask==='confirmation'
   ?'The payment is recorded but still needs manager confirmation. Do not collect the same payment again.'
  :nextTask==='verification'&&cashNeedsReconciliation
   ?cashShiftStatus==='open'
    ?'Cashier shift '+(handoff?.cashShiftId??'unknown')+
     ' is open'+(handoff?.cashierName?' under '+handoff.cashierName:'')+
     '. The cashier must count and submit physical cash before a different manager reconciles it.'
    :cashShiftStatus==='submitted'
     ?'Cashier shift '+(handoff?.cashShiftId??'unknown')+
      (ownCashierShift
       ?' was submitted. Another authorized manager must reconcile your shift; you cannot approve your own cash count.'
       :' was submitted and needs independent manager reconciliation before cash verification.')
    :cashShiftStatus==='flagged'
     ?'This cash shift was flagged for a discrepancy. A manager must investigate; it cannot be treated as reconciled.'
    :'This payment has no matching cashier shift receipt. Ask a manager to investigate; do not create another payment record.'
  :nextTask==='verification'&&cannotVerifyOwn
   ?'The payment recorder or verification preparer cannot independently approve this evidence. Another authorized manager must review it.'
  :nextTask==='verification'
   ?'Review the prepared evidence independently, or prepare verification if it has not been submitted yet.'
  :nextTask==='allocation'
   ?'The payment is independently verified but not yet fully applied to the guest charges.'
  :nextTask==='signoff'
   ?'The folio is eligible for final authorized sign-off. Confirm it separately before checkout.'
  :'Review outstanding checks before completing settlement. A recorded payment is not proof of external settlement.';

 function openDialog(which:'payment'|'charges'|'review'|'refunds'|'signoff'){
  dialogOpener.current=document.activeElement instanceof HTMLElement?document.activeElement:null;
  setActiveDialog(which);
 }
 function openPaymentReview(){
  if(nextPayment)selectPayment(nextPayment);
  setReviewStage(nextTask==='confirmation'?'confirmation':'allocation');
  openDialog(nextTask==='signoff'?'signoff':'review');
 }
 function closeDialog(){if(!busyRef.current)setActiveDialog(null);}
 const dialogOpen=activeDialog!==null;
 useEffect(()=>{
  if(!dialogOpen)return;
  const previousOverflow=document.body.style.overflow;
  document.body.style.overflow='hidden';
  dialogCloser.current?.focus();
  const handleKey=(event:KeyboardEvent)=>{
   // The confirmation dialog opened from the review list owns keyboard focus
   // until it closes; do not close or trap its underlying manager dialog.
   if(document.querySelector('.billing-review-backdrop'))return;
   if(event.key==='Escape'&&!busyRef.current){setActiveDialog(null);return;}
   if(event.key!=='Tab')return;
   const dlg=document.getElementById('settlement-current-dialog');
   if(!dlg)return;
   const controls=Array.from(dlg.querySelectorAll<HTMLElement>(
    'button:not([disabled]),input:not([disabled]),textarea:not([disabled]),select:not([disabled]),a[href]'
   ));
   if(controls.length===0)return;
   if(event.shiftKey&&document.activeElement===controls[0]){
    event.preventDefault();controls[controls.length-1].focus();
   }else if(!event.shiftKey&&document.activeElement===controls[controls.length-1]){
    event.preventDefault();controls[0].focus();
   }
  };
  document.addEventListener('keydown',handleKey);
  return()=>{document.removeEventListener('keydown',handleKey);
   document.body.style.overflow=previousOverflow;dialogOpener.current?.focus();};
 },[dialogOpen]);

 const active=()=>!!hotelId&&readSession().hotelId===hotelId;
 async function mutation(path:string,body:Record<string,unknown>,message:string):Promise<boolean>{
  if(!active()||!manager||!data?.settlementWorkflowEnabled||busy||data.signed)return false;
  setBusy(true);setError('');setSuccess('');
  try{
   await requestJson<unknown>(hotelPath(path),{method:'POST',body});
   if(!active())return false;
   setAck(false);setReviewNote('');setSuccess(message);
   // Financial write already succeeded. Cache refresh failures must not
   // make a committed action appear unsaved or invite duplicate submission.
   void Promise.all([
    client.invalidateQueries({queryKey:['live','settlement-statement',hotelId,bookingId]}),
    client.invalidateQueries({queryKey:['live','folio-ledger',hotelId]}),
    client.invalidateQueries({queryKey:['live','billing-folios',hotelId]}),
    client.invalidateQueries({queryKey:['live','payment-safety',hotelId,bookingId]}),
    client.invalidateQueries({queryKey:['live','cashier-shifts',hotelId]}),
   ]).catch(()=>{});
   return true;
  }catch(e){if(active())setError(e instanceof Error?e.message:'Settlement action failed.');return false;}
  finally{setBusy(false);}
 }
 function selectPayment(p:Payment){
  setSelected(p.id);setReference(p.evidenceReference??'');setAmount(data?.currency==='PHP'?(p.amountMinor/100).toFixed(2):String(p.amountMinor));
  setPayerRef('');setPayerKind('guest');setEntryId('');setAck(false);
  setError('');setSuccess('');
 }
 if(!valid)return null;
 return <section className="settlement-page">
  <div className="billing-compact-toolbar">
   <span>Guest account</span>
   <button type="button" className="btn-inline" disabled={busy||query.isFetching}
    onClick={()=>void query.refetch()}><RefreshCw size={15}/> Refresh</button>
  </div>
  <QueryFeedback loading={query.isPending} error={query.error} onRetry={()=>void query.refetch()}/>
  {data&&<>
   <div className="billing-account-overview billing-account-compact" aria-label="Guest account overview">
    <div className="billing-account-overview-head">
     <div><span className="rr-eyebrow">ACCOUNT SUMMARY</span>
      <h3>{data.reservationReference}</h3><p>{readableDate(data.checkIn)} to {readableDate(data.checkOut)} · Guest account</p></div>
     <span className={'billing-account-tag '+(data.signed?'complete':'pending')}>
      {data.signed?'Settlement signed':'Settlement not final'}</span>
    </div>
   </div>
   <section className="frontdesk-payment-hub" aria-label="Front desk payment status">
    <div className="frontdesk-payment-amounts" aria-label="Guest bill and recorded payment">
     <div><small>Total recorded charges</small>
      <strong>{money(data.netRecordedChargesMinor,data.currency)}</strong></div>
     <div><small>Payment evidence already recorded</small>
      <strong>{money(recordedTotal,data.currency)}</strong>
      <span>{recordedTotal>0?'Already on file · do not collect again without checking':'No active payment evidence recorded'}</span></div>
    </div>
    <div className="frontdesk-payment-status" role="status">
     <div className="frontdesk-payment-status-title">
      <div><span className="rr-eyebrow">NEXT STEP</span>
       <h3>{data.signed?(data.signedSnapshotIntegrity?'Financial sign-off completed':'Signed statement needs investigation'):nextHeading}</h3></div>
      <span className="checkout-guide-status">{data.signed
       ?data.signedSnapshotIntegrity?'Signed':'Integrity issue'
       :nextTask==='signoff'?'Ready for sign-off':'Action needed'}</span>
     </div>
     <p>{data.signed
      ?data.signedSnapshotIntegrity?'The signed financial statement passed its integrity check. Operational checkout remains separate.'
       :'The signed financial statement failed its integrity check. Stop and request independent investigation.'
      :nextDescription}</p>
     {!data.signed&&<div className="frontdesk-payment-primary">
      {nextTask==='verification'&&cashNeedsReconciliation
       ?<Link to="/cashier-shifts" search={{booking:bookingId,hotel:hotelId??undefined}}
         className="btn-primary">{cashShiftStatus==='open'?'Open cash count'
          :cashShiftStatus==='submitted'
           ?ownCashierShift?'View submitted cash shift':'Review shift reconciliation'
           :'Investigate cashier shift'}
          <ArrowRight size={16}/></Link>
       :!manager&&hasExistingMoney
       ?<button type="button" className="rr-secondary-action" onClick={()=>{
          const history=document.getElementById('billing-account-history');
          if(history instanceof HTMLDetailsElement)history.open=true;
          history?.scrollIntoView({behavior:'smooth',block:'start'});
         }}>View recorded payment <ArrowRight size={16}/></button>
       :manager&&nextTask==='verification'&&cannotVerifyOwn
       ?<span className="frontdesk-payment-waiting"><ShieldCheck size={16}/>
        Another authorized manager must complete the review</span>
       :manager&&nextTask!=='disabled'&&hasExistingMoney
       ?<button type="button" className="btn-primary" disabled={busy}
         onClick={openPaymentReview}><ShieldCheck size={16}/>
         {nextTask==='confirmation'?'Review payment evidence'
          :nextTask==='verification'?'Review payment verification'
          :nextTask==='allocation'?'Apply verified payment'
          :nextTask==='signoff'?'Authorize final settlement':'Review settlement checks'}</button>
       :hasExistingMoney
       ?<button type="button" className="rr-secondary-action" onClick={()=>{
          const history=document.getElementById('billing-account-history');
          if(history instanceof HTMLDetailsElement)history.open=true;
          history?.scrollIntoView({behavior:'smooth',block:'start'});
         }}>View existing payment <ArrowRight size={16}/></button>
       :<button type="button" className="btn-primary" disabled={busy}
        onClick={()=>openDialog('payment')}><Banknote size={16}/> Record a new payment</button>}
     </div>}
     {data.signed&&data.signedSnapshotIntegrity&&<Link to="/reservations"
      search={{booking:bookingId}}>Continue operational checkout <ArrowRight size={15}/></Link>}
    </div>
    {!data.signed&&<div className="frontdesk-payment-stages" aria-label="Payment review stages">
     <div><CheckCircle2 size={15}/> Payment record
      <strong>{hasExistingMoney?'On file':'Not recorded'}</strong></div>
     <div><ShieldCheck size={15}/> Independent review
      <strong>{data.verifiedPaymentsMinor>0?'Verified'
       :confirmedPendingVerification.length>0?'Staff-confirmed · awaiting verification'
       :unconfirmed.length>0?'Awaiting confirmation':'Not verified'}</strong></div>
     <div><ClipboardCheck size={15}/> Applied to bill
      <strong>{data.verifiedAllocatedMinor>0
       ?money(data.verifiedAllocatedMinor,data.currency):'Not yet applied'}</strong></div>
    </div>}
    {nextCashPayment&&<div className="frontdesk-payment-shift">
     <div><strong>Cash receipt · {handoff?.cashShiftId?'Shift '+handoff.cashShiftId:'Shift not linked'}</strong>
      <span>{cashShiftStatus==='open'?'Cash drawer open; count not submitted'
       :cashShiftStatus==='submitted'?'Cash count submitted; awaiting independent review'
       :cashShiftStatus==='reconciled'?'Shift independently reconciled'
       :cashShiftStatus==='flagged'?'Discrepancy flagged for investigation'
       :'No matching shift receipt found'}</span>
      {handoff?.cashierName&&<small>Cashier: {handoff.cashierName}</small>}
      {handoff?.reconciledByName&&<small>Reconciled by: {handoff.reconciledByName}</small>}
     </div>
     <Link to="/cashier-shifts" search={{booking:bookingId,hotel:hotelId??undefined}}>
      View cashier shifts <ArrowRight size={14}/></Link>
    </div>}
    {data.blockers.length>0&&!data.signed&&<details className="checkout-guide-blockers">
     <summary>{data.blockers.length} settlement check{data.blockers.length===1?'':'s'} outstanding</summary>
     <ul>{data.blockers.map((blocker,i)=><li key={i}>{blocker}</li>)}</ul>
    </details>}
   </section>
   <details className="billing-figures-details">
    <summary>How are these payment amounts calculated?</summary>
    <div className="billing-account-totals">
     <div><span>Recorded charges</span><strong>{money(data.netRecordedChargesMinor,data.currency)}</strong></div>
     <div><span>Recorded payment evidence</span><strong>{money(recordedTotal,data.currency)}</strong></div>
     <div><span>Independently reviewed funds</span><strong>{money(verifiedTotal,data.currency)}</strong></div>
     <div><span>Verified funds applied to charges</span><strong>{money(data.verifiedAllocatedMinor,data.currency)}</strong></div>
     <div className="billing-account-difference"><span>Charges not covered by verified allocations — not an instruction to charge again</span>
      <strong>{money(data.remainingMinor,data.currency)}</strong></div>
    </div>
    <p className="desk-muted">Payment evidence, staff confirmation, independent verification and allocation
     are separate stages. An unallocated amount does not mean the guest needs to pay twice.</p>
   </details>
   {(activeDialog==='payment'||activeDialog==='charges')&&<div className="billing-modal-backdrop">
    <section id="settlement-current-dialog" className="billing-action-modal" role="dialog" aria-modal="true"
     aria-label={activeDialog==='payment'?'Record guest payment':'Update guest bill'}>
     <div className="billing-action-modal-header">
      <div><span className="rr-eyebrow">BOOKING {data.reservationReference}</span>
       <h3>{activeDialog==='payment'?'Record guest payment':'Add a charge or correction'}</h3>
       <p>Current recorded difference: {money(data.remainingMinor,data.currency)} · Not a final amount due</p>
      </div>
      <button type="button" ref={dialogCloser} className="billing-modal-dismiss" aria-label="Close dialog"
       onClick={closeDialog}><X size={20}/></button>
     </div>
     {activeDialog==='payment'
      ?<RecordGuestPayment key={hotelId+'-payment-'+bookingId} bookingId={bookingId}
        currency={data.currency} signed={data.signed} recordedDifferenceMinor={data.remainingMinor}
        onDone={()=>{closeDialog();void query.refetch();}}/>
      :<BillingActions bookingId={bookingId} signed={data.signed}/>}
    </section>
   </div>}
   <details id="billing-account-history" className="billing-statement-details">
    <summary><span><strong>View itemized bill and payment history</strong>
     <small>Room charges, payment reviews, refunds and printable statement</small></span>
     <span className="billing-expand-hint">Show details</span></summary>
   <div className="settlement-print-area" aria-label="Printable guest checkout statement">
    <div className="settlement-heading">
     <div><p className="eyebrow">FRIENDSHIP ON HOTEL · RESERVATION ACCOUNT</p>
      <h3>Guest account statement</h3>
      <p>Booking {data.reservationReference} · Folio #{data.folioId} · {data.currency}</p>
     </div>
     <strong className="settlement-status">{data.signed?'SIGNED ACCOUNT':'PROVISIONAL · NOT SETTLED'}</strong>
    </div>
    <div className="settlement-metrics">
     <KeyValue label="Arrival" value={readableDate(data.checkIn)}/>
     <KeyValue label="Departure" value={readableDate(data.checkOut)}/>
     <KeyValue label="Recorded charges" value={money(data.netRecordedChargesMinor,data.currency)}/>
     <KeyValue label="Verified payments applied" value={money(data.verifiedAllocatedMinor,data.currency)}/>
     <KeyValue label="Recorded difference (not final)" value={money(data.remainingMinor,data.currency)}/>
     <KeyValue label="Verified deposits not yet applied" value={money(data.unallocatedVerifiedDepositsMinor,data.currency)}/>
    </div>
    <h4>What was charged</h4>
    <div className="table-scroll"><table className="settlement-table">
     <thead><tr><th>Date</th><th>Description</th><th>Amount</th></tr></thead>
     <tbody>{data.charges.map(c=><tr key={c.id}>
      <td>{readableDate(c.stayDate)}</td><td>{c.description} <small>#{c.id}</small></td>
      <td>{money(c.amountMinor,data.currency)}</td>
     </tr>)}{data.charges.length===0&&<tr><td colSpan={3}>No posted charges.</td></tr>}</tbody>
    </table></div>
    {data.taxAllocations.length>0&&<>
     <h4>Approved room-night tax allocations (informational)</h4>
     <div className="table-scroll"><table className="settlement-table">
      <thead><tr><th>Night</th><th>VAT portion</th><th>Net room revenue</th><th>Benefit</th></tr></thead>
      <tbody>{data.taxAllocations.map(t=><tr key={t.folioEntryId}>
       <td>{readableDate(t.stayDate)} · {t.status}</td>
       <td>{money(t.vatMinor,data.currency)}</td>
       <td>{money(t.roomRevenueMinor,data.currency)}</td>
       <td>{t.benefitKind} · {money(t.folioCreditMinor,data.currency)}</td>
      </tr>)}</tbody>
     </table></div>
    </>}
    {data.adjustments.length>0&&<>
     <h4>Credits and adjustments</h4>
     <div className="table-scroll"><table className="settlement-table">
      <thead><tr><th>Type</th><th>Reason</th><th>Amount</th></tr></thead>
      <tbody>{data.adjustments.map(a=><tr key={a.id}>
       <td>{a.kind}</td><td>{a.description}</td>
       <td>{a.kind==='credit'?'−':'+'}{money(a.amountMinor,data.currency)}</td>
      </tr>)}</tbody>
     </table></div>
    </>}
    <h4>Payments and their review status</h4>
    <div className="table-scroll"><table className="settlement-table">
     <thead><tr><th>Method / reference</th><th>Status</th><th>Amount</th></tr></thead>
     <tbody>{data.payments.map(p=><tr key={p.id}>
      <td>{p.method} · {p.reference}</td>
      <td>{p.status} · {p.verificationStatus??'not reviewed'}</td>
      <td>{money(p.amountMinor,data.currency)}</td>
     </tr>)}{data.payments.length===0&&<tr><td colSpan={3}>No payment evidence recorded.</td></tr>}</tbody>
    </table></div>
    {data.allocations.length>0&&<>
     <h4>Guest / company / group payment attribution</h4>
     <div className="table-scroll"><table className="settlement-table">
      <thead><tr><th>Payer</th><th>Payment / charge</th><th>Allocated</th></tr></thead>
      <tbody>{data.allocations.map(a=><tr key={a.id}>
       <td>{a.payerKind} · {a.payerReference}</td>
       <td>Payment #{a.paymentId}{a.folioEntryId?' · Night #'+a.folioEntryId:''}</td>
       <td>{money(a.amountMinor,data.currency)}</td>
      </tr>)}</tbody>
     </table></div>
    </>}
    {data.refunds.length>0&&<>
     <h4>Refund requests and external disbursement evidence</h4>
     <div className="table-scroll"><table className="settlement-table">
      <thead><tr><th>Payment / reason</th><th>Review status</th><th>Amount</th></tr></thead>
      <tbody>{data.refunds.map(r=><tr key={r.id}>
       <td>Payment #{r.paymentId} · {r.reason}</td>
       <td>{r.status} · {r.evidenceStatus??'no disbursement proof'}</td>
       <td>{money(r.amountMinor,data.currency)}</td>
      </tr>)}</tbody>
     </table></div>
    </>}
    <div className="settlement-signature">
     <p>{data.signed?'Signed settlement: '+readableDateTime(data.signedAt)+' · Manager #'+data.signedBy:
      'This statement is not yet an approved settlement.'}</p>
     {data.signed&&<p><small>Signed financial snapshot SHA-256: {data.signedSnapshotSha256}</small></p>}
     <small>This is an internal PMS guest-account statement, NOT a BIR tax invoice, bank receipt,
      payment gateway confirmation, or proof that a refund has been disbursed.
      Payment evidence has been reviewed by staff, not confirmed via a live bank/PSP API.</small>
    </div>
   </div>
   <div className="desk-tools settlement-controls">
    <button type="button" className="btn-inline"
     disabled={data.signed&&!data.signedSnapshotIntegrity}
     onClick={()=>window.print()}>
     <Printer size={16}/> Print guest statement
    </button>
    {data.signed&&!data.signedSnapshotIntegrity?<p role="alert" className="stay-feedback-error">
     <AlertTriangle size={16}/> Signed statement integrity failed. Printing and checkout are blocked pending independent investigation.
    </p>:data.signed?<p className="night-audit-clean"><CheckCircle2 size={16}/>
     Signed by manager #{data.signedBy}. Financial snapshot integrity confirmed.</p>
     :<p className="desk-muted">Printable for review. Unsigned statements remain provisional.</p>}
   </div>
   {data.blockers.length>0&&<div className="night-audit-issues" role="status">
    <h4><AlertTriangle size={17}/> What still needs attention before checkout</h4>
    <ul>{data.blockers.map((b,i)=><li key={i}>{b}</li>)}</ul>
   </div>}
   </details>
   {manager&&!data.signed&&activeDialog&&['review','refunds','signoff'].includes(activeDialog)&&
    createPortal(<div className="billing-modal-backdrop settlement-task-backdrop"
     onMouseDown={event=>{if(event.target===event.currentTarget)closeDialog();}}>
     <section id="settlement-current-dialog" className="billing-action-modal settlement-task-modal"
      role="dialog" aria-modal="true" aria-labelledby="settlement-task-title">
      <div className="billing-action-modal-header">
       <div><span className="rr-eyebrow">BOOKING {data.reservationReference}</span>
        <h3 id="settlement-task-title">{activeDialog==='review'?'Review payments'
         :activeDialog==='refunds'?'Refund requests and evidence':'Final settlement authorization'}</h3>
        <p>Changes stay subject to independent manager approval and folio safeguards.</p>
       </div>
       <button type="button" ref={dialogCloser} className="billing-modal-dismiss"
        aria-label="Close settlement review" disabled={busy} onClick={closeDialog}><X size={20}/></button>
      </div>
      <nav className="settlement-task-tabs" aria-label="Manager finance tasks">
       <button type="button" disabled={busy} aria-pressed={activeDialog==='review'}
        className={activeDialog==='review'?'active':''} onClick={()=>setActiveDialog('review')}>
        Review & allocate</button>
       <button type="button" disabled={busy} aria-pressed={activeDialog==='refunds'}
        className={activeDialog==='refunds'?'active':''} onClick={()=>setActiveDialog('refunds')}>
        Refunds</button>
       <button type="button" disabled={busy} aria-pressed={activeDialog==='signoff'}
        className={activeDialog==='signoff'?'active':''} onClick={()=>setActiveDialog('signoff')}>
        Final sign-off</button>
      </nav>
      <div className="settlement-task-modal-body">
       {success&&<p className="stay-feedback-success" role="status">{success}</p>}
       {error&&<p className="stay-feedback-error" role="alert"><AlertTriangle size={16}/>{error}</p>}
       {activeDialog==='review'&&<>
    {!data.settlementWorkflowEnabled&&<div className="night-audit-warning" role="status">
     <AlertTriangle size={18}/>
     Final settlement is not yet enabled for this hotel. A finance administrator must complete the required checks before activating it. You can still review the recorded statement.
    </div>}
    <div className="settlement-review-steps" role="group" aria-label="Payment review steps">
     <button type="button" disabled={busy} aria-pressed={reviewStage==='confirmation'}
      className={reviewStage==='confirmation'?'active':''}
      onClick={()=>setReviewStage('confirmation')}>
      1 · Confirm recorded evidence {unconfirmed.length>0?'('+unconfirmed.length+')':''}</button>
     <button type="button" disabled={busy} aria-pressed={reviewStage==='allocation'}
      className={reviewStage==='allocation'?'active':''}
      onClick={()=>setReviewStage('allocation')}>2 · Verify & allocate</button>
    </div>
    {reviewStage==='confirmation'&&<BillingActions bookingId={bookingId} signed={data.signed} mode="review"/>}
    {reviewStage==='allocation'&&<>
    <h4>Verification & payment allocation</h4>
    <p className="desk-muted">Bank transfer evidence requires a different administrator to verify the supporting statement. Cash evidence requires a reconciled shift. These controls never initiate a bank payment or refund.</p>
    <div className="settlement-payment-choice">
     {data.payments.map(p=><button type="button" key={p.id} className={'btn-inline'+(selected===p.id?' active':'')}
      disabled={busy} onClick={()=>selectPayment(p)}>
      <Wallet size={15}/> #{p.id} · {p.method} · {money(p.amountMinor,data.currency)} · {p.verificationStatus??'needs review'}
     </button>)}
    </div>
    {paymentRow&&<div className="settlement-action-panel">
     <h4>Payment #{paymentRow.id}: {paymentRow.method}</h4>
     <p>Verified: {paymentRow.verificationStatus??'not yet'} · Unallocated payment balance: {money(available,data.currency)}</p>
     {paymentRow.status!=='staff_confirmed'
      ?<p role="status">This payment must first be confirmed through the existing manager payment review process.</p>
      :paymentRow.verificationStatus===null?<>
       <label>Verification reference
        <input className="wizard-input" value={reference} maxLength={160}
         onChange={e=>setReference(e.target.value)}
         placeholder={paymentRow.method==='cash'
          ?'shift-<actual reconciled cashier shift ID>'
          :'Internal bank statement evidence reference'}/>
       </label>
       {paymentRow.method==='cash'&&<p className="desk-muted">
        Use the actual reconciled shift reference in the form <code>shift-123</code>
        (replace 123 with its cashier shift ID). The same payment's cash receipt must
        belong to that reconciled shift.
        {' '}<Link to="/cashier-shifts" search={{booking:bookingId,hotel:hotelId??undefined}}>
         Open cashier shifts <ArrowRight size={13}/></Link>
       </p>}
       <button type="button" className="btn-primary"
        disabled={busy||!data.settlementWorkflowEnabled||reference.trim().length<6}
        onClick={()=>void mutation(endpoint+'/payment-records/'+paymentRow.id+'/verification',{
         evidenceKind:paymentRow.method==='cash'?'cash_shift':'bank_statement',
         evidenceReference:reference.trim(),
        },'Verification submitted. Independent manager review is required.')}>
        Submit independent verification request
       </button>
      </>:paymentRow.verificationStatus==='pending'?<>
       <p>Prepared by manager #{paymentRow.verificationPreparedBy}. A different manager must approve it.</p>
       <label>Independent review note
        <textarea className="wizard-input" rows={2} value={reviewNote} onChange={e=>setReviewNote(e.target.value)}/>
       </label>
       <div className="desk-tools">
        <button type="button" className="btn-primary" disabled={busy||!data.settlementWorkflowEnabled||
         reviewNote.trim().length<10||paymentRow.verificationPreparedBy===user?.id}
         onClick={()=>void mutation(endpoint+'/settlement-verifications/'+paymentRow.verificationId+'/review',{
          decision:'verify',note:reviewNote.trim(),
         },'Supporting payment evidence independently reviewed.')}>
         <ShieldCheck size={15}/> Verify evidence
        </button>
        <button type="button" className="btn-inline" disabled={busy||!data.settlementWorkflowEnabled||reviewNote.trim().length<10}
         onClick={()=>void mutation(endpoint+'/settlement-verifications/'+paymentRow.verificationId+'/review',{
          decision:'reject',note:reviewNote.trim(),
         },'Payment evidence rejected; manager follow-up required.')}>
         Reject evidence
        </button>
       </div>
      </>:paymentRow.verificationStatus==='verified'?<>
       <p className="night-audit-clean"><CheckCircle2 size={15}/> Independently reviewed evidence. Allocate this verified payment to the guest, company, or group.</p>
       <div className="desk-tools">
        <label>Payer
         <select className="wizard-input" value={payerKind} onChange={e=>setPayerKind(e.target.value)}>
          <option value="guest">Guest</option><option value="company">Company</option><option value="group">Group</option>
         </select>
        </label>
        <label>Payer reference
         <input className="wizard-input" value={payerRef} maxLength={120}
          onChange={e=>setPayerRef(e.target.value)} placeholder="Guest/organization reference"/>
        </label>
        <label>Allocation amount ({data.currency==='PHP'?'PHP':'minor units'})
         <input className="wizard-input" inputMode={data.currency==='PHP'?'decimal':'numeric'} value={amount}
          onChange={e=>setAmount(e.target.value)}/>
        </label>
        <label>Charge line (optional)
         <select className="wizard-input" value={entryId} onChange={e=>setEntryId(e.target.value)}>
          <option value="">Unspecified / deposit allocation</option>
          {data.charges.map(c=><option value={c.id} key={c.id}>
           #{c.id} · {c.description}
          </option>)}
         </select>
        </label>
       </div>
       <button type="button" className="btn-primary"
        disabled={busy||!data.settlementWorkflowEnabled||available<1||
         allocationMinor===null||allocationMinor>available||payerRef.trim().length<3}
        onClick={()=>void (async()=>{
         const priorKey=requestKey;
         const ok=await mutation(endpoint+'/payment-records/'+paymentRow.id+'/allocations',{
          requestKey:priorKey,payerKind,payerReference:payerRef.trim(),
          amountMinor:allocationMinor,folioEntryId:entryId?Number(entryId):null,
         },'Verified payment allocation recorded.');
         if(ok){
          // The same key must not be reused for a different allocation.
          setRequestKey(crypto.randomUUID());
          setAmount('');
         }
        })()}>
        Allocate verified payment
       </button>
      </>:<p role="alert">Rejected verification cannot be allocated. Manager investigation required.</p>}
    </div>}
    </>}

   <details className="settlement-progress" aria-label="Detailed financial settlement stages">
    <summary className="settlement-progress-title"><ClipboardCheck size={17}/>
     <strong>Detailed verification and allocation statuses</strong></summary>
    <ol>
     <li><strong>1. Staff confirmation</strong><span>{data.payments.some(p=>p.status==='staff_confirmed')
      ?'Staff-confirmed payment recorded':'Awaiting a staff-confirmed payment'}</span></li>
     <li><strong>2. Independent evidence review</strong><span>{data.payments.some(p=>p.status==='staff_confirmed'&&p.verificationStatus==='verified')
      ?'At least one payment reviewed independently':'No independently reviewed payment yet'}</span></li>
     <li><strong>3. Payment allocation</strong><span>{data.verifiedAllocatedMinor>0
      ?money(data.verifiedAllocatedMinor,data.currency)+' allocated to recorded charges'
      :'No verified funds allocated yet'}</span></li>
     <li><strong>4. Settlement sign-off</strong><span>{data.signed
      ?data.signedSnapshotIntegrity?'Signed; snapshot integrity checked':'Signed; integrity review required'
      :data.canSignOff?'Ready for authorized sign-off':'Not yet eligible for sign-off'}</span></li>
    </ol>
    {data.unallocatedVerifiedDepositsMinor>0&&<p role="status" className="settlement-progress-unallocated">
     <AlertTriangle size={16}/> {money(data.unallocatedVerifiedDepositsMinor,data.currency)}
     {' '}of verified deposits remains unallocated. These funds are not applied to charges or externally settled.
    </p>}
    <p className="desk-muted">Staff confirmation is not bank verification. Internal documentary review is not
     provider settlement, and allocating a payment does not sign off the guest account.</p>
   </details>


       </>}
       {activeDialog==='refunds'&&<>
    <div className="settlement-action-panel">
     <h4>Refunds · reviewed external bank disbursement only</h4>
     <p className="desk-muted">The PMS does NOT send refunds. First request and independently approve a refund of an unallocated bank deposit, then record a bank reference and obtain an independent evidence review.</p>
     <div className="desk-tools">
      <label>Verified bank payment
       <select className="wizard-input" value={refundPayment} onChange={e=>setRefundPayment(e.target.value)}>
        <option value="">Select bank payment</option>
        {data.payments.filter(p=>p.method==='bank_transfer'&&p.verificationStatus==='verified')
         .map(p=><option key={p.id} value={p.id}>#{p.id} · {money(p.amountMinor,data.currency)}</option>)}
       </select>
      </label>
      <label>Refund amount ({data.currency==='PHP'?'PHP':'minor units'})
       <input className="wizard-input" inputMode={data.currency==='PHP'?'decimal':'numeric'} value={refundAmount}
        onChange={e=>setRefundAmount(e.target.value)} placeholder="Amount within unallocated deposit"/>
      </label>
     </div>
     <label>Refund justification
      <textarea className="wizard-input" rows={2} value={refundReason} maxLength={500}
       onChange={e=>setRefundReason(e.target.value)}/>
     </label>
     <button type="button" className="btn-inline" disabled={busy||!data.settlementWorkflowEnabled||
      !refundPayment||refundMinor===null||refundReason.trim().length<5}
      onClick={()=>void (async()=>{
       const ok=await mutation(endpoint+'/refund-requests',{
        requestKey:refundKey,paymentRecordId:Number(refundPayment),
        amountMinor:refundMinor,reason:refundReason.trim(),
       },'Refund requested. A different administrator must approve before any external payout.');
       if(ok){setRefundKey(crypto.randomUUID());setRefundAmount('');setRefundReason('');}
      })()}>
      Request documented refund
     </button>
     {data.refunds.map(r=><div className="ex-record" key={r.id}>
      <strong>Refund #{r.id} · {money(r.amountMinor,data.currency)} · {r.status}</strong>
      <p className="desk-muted">{r.reason} · Requested by #{r.requestedBy}
       {r.reviewedBy?' · Approved/reviewed by #'+r.reviewedBy:''}</p>
      {r.status==='requested'&&<>
       <label>Independent refund review note
        <textarea className="wizard-input" rows={2} value={refundNote}
         onChange={e=>setRefundNote(e.target.value)}/>
       </label>
       <div className="desk-tools">
        <button type="button" className="btn-inline" disabled={busy||r.requestedBy===user?.id||
         !data.settlementWorkflowEnabled||refundNote.trim().length<5}
         onClick={()=>void mutation(endpoint+'/refund-requests/'+r.id+'/review',{
          decision:'approve',note:refundNote.trim(),
         },'Refund request approved. External funds have NOT been sent.')}>Approve request</button>
        <button type="button" className="btn-inline" disabled={busy||!data.settlementWorkflowEnabled||refundNote.trim().length<5}
         onClick={()=>void mutation(endpoint+'/refund-requests/'+r.id+'/review',{
          decision:'reject',note:refundNote.trim(),
         },'Refund request rejected.')}>Reject request</button>
       </div>
      </>}
      {r.status==='approved'&&!r.evidenceId&&<>
       <label>External bank refund reference
        <input className="wizard-input" value={refundEvidence} maxLength={160}
         onChange={e=>setRefundEvidence(e.target.value)} placeholder="Externally issued refund identifier"/>
       </label>
       <button type="button" className="btn-inline" disabled={busy||!data.settlementWorkflowEnabled||refundEvidence.trim().length<8}
        onClick={()=>void mutation(endpoint+'/refund-requests/'+r.id+'/disbursement-evidence',{
         externalReference:refundEvidence.trim(),
        },'External refund evidence recorded. A second administrator must independently verify it.')}>
        Record external disbursement evidence
       </button>
      </>}
      {r.evidenceStatus==='pending'&&r.evidenceId&&<>
       <p>Recorded by #{r.evidenceRecordedBy}. A different administrator must confirm the bank evidence.</p>
       <label>Independent evidence review note
        <textarea className="wizard-input" rows={2} value={refundNote}
         onChange={e=>setRefundNote(e.target.value)}/>
       </label>
       <div className="desk-tools">
        <button type="button" className="btn-inline" disabled={busy||!data.settlementWorkflowEnabled||
         r.evidenceRecordedBy===user?.id||refundNote.trim().length<10}
         onClick={()=>void mutation(endpoint+'/refund-disbursements/'+r.evidenceId+'/review',{
          decision:'verify',note:refundNote.trim(),
         },'External refund evidence independently reviewed.')}>
         Verify disbursement evidence
        </button>
        <button type="button" className="btn-inline" disabled={busy||!data.settlementWorkflowEnabled||refundNote.trim().length<10}
         onClick={()=>void mutation(endpoint+'/refund-disbursements/'+r.evidenceId+'/review',{
          decision:'reject',note:refundNote.trim(),
         },'Refund evidence rejected pending investigation.')}>Reject evidence</button>
       </div>
      </>}
      {r.evidenceStatus==='verified'&&<p className="night-audit-clean"><CheckCircle2 size={16}/>
       External refund evidence reviewed · {r.externalReference}. No funds were sent by the PMS.</p>}
     </div>)}
    </div>

       </>}
       {activeDialog==='signoff'&&<>
    <div className="settlement-signoff" id="settlement-final-authorization">
     <h4>Final settlement authorization</h4>
     <p>Signing freezes the statement and prevents ordinary corrections, new collections, and refund reviews. The booking must be checked in and at or after its departure date.</p>
     <label className="night-review-ack"><input type="checkbox" checked={ack} disabled={busy}
      onChange={e=>setAck(e.target.checked)}/>
      <span>I independently reviewed the folio, tax treatment, verified payment evidence, deposit allocations, outstanding refunds, and the remaining balance.</span>
     </label>
     <button type="button" className="btn-primary"
      disabled={!ack||!data.canSignOff||!data.settlementWorkflowEnabled||busy}
      onClick={()=>void mutation(endpoint+'/settlement-signoff',{acknowledged:true},
       'Guest folio signed. Checkout may proceed if all stay controls pass.')}>
      <ClipboardCheck size={16}/> Sign final settlement statement
     </button>
    </div>

       </>}
      </div>
     </section>
    </div>,document.body)}
   {manager&&!data.signed&&<details className="billing-more-tools">
    <summary>More finance tools · refunds, payment allocation and sign-off</summary>
    <div className="billing-secondary-actions">
     <button type="button" className="btn-inline" onClick={()=>{setReviewStage('confirmation');openDialog('review');}}>
      <ShieldCheck size={15}/> Review payments & allocation</button>
     <button type="button" className="btn-inline" onClick={()=>openDialog('refunds')}>Refund requests</button>
     <button type="button" className="btn-inline" onClick={()=>openDialog('signoff')}>
      <ClipboardCheck size={15}/> Final authorization</button>
    </div>
   </details>}
   {success&&<p className="stay-feedback-success" role="status">{success}</p>}
   {error&&<p className="stay-feedback-error" role="alert"><AlertTriangle size={16}/>{error}</p>}
  </>}
 </section>;
}
