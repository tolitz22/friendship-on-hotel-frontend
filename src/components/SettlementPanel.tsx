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
import {RecordGuestPayment} from './RecordGuestPayment';
import {GuestIncidentalChargeForm} from './GuestIncidentalChargeForm';
import {BillingActions} from './BillingActions';
import {NoShowFinancialReview} from './NoShowFinancialReview';
import {parseBillingAmount} from '../api/billing';
import {isGuestBillSettled} from '../features/billing/reviewedPaymentSettlement';
import {readableDate,readableDateTime,statusLabel} from '../lib/format';
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
 paymentReviewedByName:z.string().nullish(),evidenceReviewedByName:z.string().nullish(),
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
 payments:z.array(payment),cashShiftContexts:z.array(paymentHandoff).default([]),
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
 simplifiedCashierModeEnabled:z.boolean().optional().default(false),
 routineCashCheckoutEligible:z.boolean().optional().default(false),
 routineCashCheckoutReason:z.string().nullable().optional(),
 routineCashCheckoutAudit:z.object({
  performedBy:id,performedByName:z.string().nullable(),
  checkedOutAt:z.string(),recordedChargesMinor:z.number().int(),
  netCashMinor:z.number().int(),receiptCount:z.number().int(),
  integrityValid:z.boolean(),isIndependentFinancialSettlement:z.literal(false),
 }).nullable().optional().default(null),
});
type Statement=z.infer<typeof statement>;
type Payment=z.infer<typeof payment>;
function money(value:number,currency:string){
 return currency==='PHP'
  ?new Intl.NumberFormat('en-PH',{style:'currency',currency:'PHP'}).format(value/100)
  :value.toLocaleString()+' '+currency+' minor units';
}
function paymentReviewSentence(payment:Payment,currency:string){
 const amount=money(payment.amountMinor,currency);
 const displayAmount=currency==='PHP'&&payment.amountMinor%100===0?amount.replace(/\.00$/,''):amount;
 const description=displayAmount+' '+payment.method.replaceAll('_',' ');
 switch(payment.status){
  case 'pending_review':return description+' recorded; staff review pending.';
  case 'staff_confirmed':return description+' reviewed and confirmed by staff.';
  case 'rejected':return description+' rejected by staff.';
  case 'voided':return description+' voided.';
  default:return description+' · '+statusLabel(payment.status)+'.';
 }
}
function KeyValue({label,value}:{label:string;value:string}){
 return <div className="settlement-metric"><small>{label}</small><strong>{value}</strong></div>;
}

export function useSettlementStatement(hotelId:string|null,bookingId:string,enabled=true){
 return useQuery({
  queryKey:['live','settlement-statement',hotelId,bookingId],
  enabled:enabled&&!!hotelId&&/^[1-9]\d*$/.test(bookingId),
  queryFn:async():Promise<Statement>=>{
   const result=z.object({data:statement}).parse(
    await getJson<unknown>(hotelPath('/bookings/'+bookingId+'/settlement-statement'))).data;
   if(result.hotelId!==hotelId||result.bookingId!==bookingId)
    throw new Error('Unexpected reservation or hotel in settlement statement.');
   return result;
  },
  retry:false,staleTime:0,refetchOnMount:'always',
 });
}

export function financialCheckoutBlock(data:Statement):string|null{
 if(data.simplifiedCashierModeEnabled){
  return data.routineCashCheckoutEligible?null:data.routineCashCheckoutReason||'Review the guest bill and linked cash receipt.';
 }
 if(!data.settlementWorkflowEnabled)return null;
 if(data.signed&&!data.signedSnapshotIntegrity)return 'The signed financial statement needs investigation.';
 if(!data.canSignOff)return data.blockers[0]??'Resolve the remaining billing checks before checkout.';
 return null;
}

export function SettlementPanel({bookingId,requestedAction,requestedPayment}:{bookingId:string;requestedAction?:'signoff'|'no-show';requestedPayment?:string}){
 const {hotelId,user}=useHotelAuth();
 const client=useQueryClient();
 const manager=!!hotelId&&!!user?.hotels.some(h=>h.id===hotelId&&h.role==='admin');
 const canReviewNoShow=manager&&user?.hotels.some(h=>h.id===hotelId&&(h.permissions===undefined||h.permissions.includes('finance.read')));
 const [selected,setSelected]=useState('');
 const [reviewStage,setReviewStage]=useState<'confirmation'|'allocation'>('confirmation');
 const [activeDialog,setActiveDialog]=useState<'payment'|'charges'|'correction'|'review'|'refunds'|'signoff'|null>(null);
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
 const endpoint='/bookings/'+bookingId;
 useEffect(()=>{
  setActiveDialog(null);setReviewStage('confirmation');setSelected('');setReference('');setReviewNote('');setPayerKind('guest');
  setPayerRef('');setAmount('');setEntryId('');setAck(false);setBusy(false);
  setError('');setSuccess('');setRequestKey(crypto.randomUUID());
  setRefundPayment('');setRefundAmount('');setRefundReason('');
  setRefundKey(crypto.randomUUID());setRefundEvidence('');setRefundNote('');
 },[hotelId,bookingId]);
 const query=useSettlementStatement(hotelId,bookingId);
 // Do not show cached dates or prices while fresh folio data is loading.
 const data=query.isFetching?undefined:query.data;
 useEffect(()=>{
  if(requestedAction==='signoff'&&manager&&data?.settlementWorkflowEnabled&&!data.signed)
   setActiveDialog('signoff');
 },[requestedAction,manager,data?.settlementWorkflowEnabled,data?.signed,bookingId]);
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
 const staffByPayment=new Map(data?.cashShiftContexts.map(entry=>[entry.paymentId,entry]));
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
 const cashShiftStatus=handoff?.cashShiftStatus??'unknown';
 const ownCashierShift=handoff?.cashierId===user?.id;
 const verificationPreparerName=nextPayment
  ?data?.cashShiftContexts.find(row=>row.paymentId===nextPayment.id)?.verificationPreparedByName
  :null;
 const cashNeedsReconciliation=!!nextCashPayment&&cashShiftStatus!=='reconciled';
 const recorderIsCurrent=!!nextPayment&&
  data?.cashShiftContexts.find(row=>row.paymentId===nextPayment.id)?.recordedBy===user?.id;
 const cannotVerifyOwn=!!nextPayment&&(pendingOtherReviewer||recorderIsCurrent);
 const hasExistingMoney=recordedTotal>0;
 const extraBalanceMinor=Math.max(0,(data?.netRecordedChargesMinor??0)-recordedTotal);
 const canCollectExtra=extraBalanceMinor>0&&!data?.signed&&
  ['confirmed','checked_in'].includes(data?.status??'');
 const canReviewPendingTransfer=manager&&unconfirmed.some(payment=>payment.method==='bank_transfer'&&
  data?.cashShiftContexts.find(row=>row.paymentId===payment.id)?.recordedBy!==user?.id);
 // Operational handoff: a payment is already recorded; the question is WHO
 // can complete the next control. Never confuse staff confirmation with
 // independently verified funds or a completed checkout.
 const canSubmitOwnCount=nextTask==='verification'&&cashNeedsReconciliation
  &&cashShiftStatus==='open'&&ownCashierShift;
 const canReviewShift=nextTask==='verification'&&cashNeedsReconciliation
  &&cashShiftStatus==='submitted'&&manager&&!ownCashierShift;
 const mustWaitForCashier=nextTask==='verification'&&cashNeedsReconciliation
  &&cashShiftStatus==='open'&&!ownCashierShift;
 const mustWaitForOtherManager=nextTask==='verification'&&cashNeedsReconciliation
  &&cashShiftStatus==='submitted'&&(!manager||ownCashierShift);
 const mustWaitForVerifier=nextTask==='verification'&&!cashNeedsReconciliation
  &&(!manager||cannotVerifyOwn);
 const needsCashInvestigation=nextTask==='verification'&&cashNeedsReconciliation
  &&!['open','submitted'].includes(cashShiftStatus);
 const actionIsWaiting=mustWaitForCashier||mustWaitForOtherManager||mustWaitForVerifier;
 const simplifiedCash=data?.simplifiedCashierModeEnabled??false;
 const routineCashReady=simplifiedCash&&(data?.routineCashCheckoutEligible??false)
  &&data?.status==='checked_in';
 const routineCashException=simplifiedCash&&hasExistingMoney&&!routineCashReady
  &&!data?.signed&&data?.status==='checked_in';
 const routineCashCheckedOut=simplifiedCash&&!!data?.routineCashCheckoutAudit
  &&hasExistingMoney&&!data?.signed&&data?.status==='checked_out';
 const recordedCashShiftStatuses=(data?.cashShiftContexts??[]).filter(row=>
  recordedActive.some(p=>p.id===row.paymentId&&p.method==='cash'))
  .map(row=>row.cashShiftStatus);
 const allCashShiftsReconciled=routineCashCheckedOut&&recordedCashShiftStatuses.length>0
  &&recordedCashShiftStatuses.every(status=>status==='reconciled');
 const cashAuditValid=data?.routineCashCheckoutAudit?.integrityValid!==false;
 const guestBillSettled=!!data&&isGuestBillSettled(data);
 const checkoutBlock=data?financialCheckoutBlock(data):null;
 const paymentStatus=data?.signed
  ?data.signedSnapshotIntegrity?'Financial approval complete':'Account requires investigation'
  :routineCashCheckedOut?!cashAuditValid?'Guest checked out — audit investigation needed'
    :allCashShiftsReconciled?'Guest checked out — cash reconciled'
    :'Guest checked out — cash reconciliation pending'
  :guestBillSettled?'Guest bill settled'
  :!hasExistingMoney?'No payment recorded'
  :routineCashReady?'Cash payment accepted — ready for checkout'
  :routineCashException?'Cash payment recorded — review needed'
  :needsCashInvestigation?'Payment needs investigation'
  :nextTask==='disabled'?'Payment recorded — approval unavailable'
  :nextTask==='signoff'?'Payment verified — checkout ready'
  :nextTask==='allocation'?'Payment verified — apply to bill'
  :nextTask==='verification'&&cashNeedsReconciliation?'Cash payment recorded — shift review pending'
  :nextTask==='verification'?'Payment confirmed — approval pending'
  :nextTask==='confirmation'?'Payment recorded — confirmation pending'
  :'Payment recorded — review pending';
 const operationalAction=canSubmitOwnCount?'Cash counting is an end-of-shift task'
  :canReviewShift?'Cash drawer review is separate'
  :mustWaitForCashier?'Waiting for cashier cash count'
  :mustWaitForOtherManager?'Waiting for independent manager'
  :needsCashInvestigation?'Cash receipt requires investigation'
  :mustWaitForVerifier?'Waiting for independent manager'
  :nextTask==='confirmation'?'Confirm recorded payment'
  :nextTask==='verification'?'Review payment verification'
  :nextTask==='allocation'?'Apply verified payment'
  :nextTask==='signoff'?'Optional finance sign-off'
  :nextTask==='disabled'?'Financial sign-off unavailable'
  :'Review settlement checks';
 const shiftLabel=handoff?.cashShiftId?'Shift '+handoff.cashShiftId:'Cashier shift';
 const operationalDescription=routineCashCheckedOut
  ?!cashAuditValid
   ?'The saved cash checkout audit failed its integrity check. Stop ordinary financial changes and ask the owner to investigate.'
   :allCashShiftsReconciled
    ?'Guest checkout was recorded and all linked cash drawers were independently reconciled. No additional guest payment is needed. This is an operational cash close, not a bank settlement or tax invoice.'
    :'Guest checkout is recorded. The cashier must still close and count the drawer; another authorized manager must reconcile it. Do not charge the guest again.'
  :routineCashReady
  ?'Cash payment is recorded and covers the guest bill. Routine checkout can proceed without per-payment manager approval. The cashier still needs to count the drawer; another manager reconciles it afterward.'
  :routineCashException
  ?extraBalanceMinor>0
   ?'New charges increased the total. The original payment remains recorded. Collect only the additional '+money(extraBalanceMinor,data?.currency??'PHP')+' if the guest is paying now.'
   :'Routine cash checkout is not eligible: '+(data?.routineCashCheckoutReason??'manager review is required')+'. Do not collect the guest payment again.'
  :canSubmitOwnCount
  ?'The guest payment is recorded and confirmed. Do not collect it again. Count and submit '+shiftLabel+' in Cashier Shifts only when ending your shift. Strict financial settlement may still require independent reconciliation.'
  :mustWaitForCashier
   ?'The payment was already confirmed. '+(handoff?.cashierName??'The assigned cashier')+
    ' submits '+shiftLabel+' at the end of the shift. A separate manager reconciles it afterward. No second guest payment is required.'
  :canReviewShift
   ?'The guest payment is recorded. The cashier submitted '+shiftLabel+'; independent drawer review belongs in Cashier Shifts, not this guest bill.'
  :mustWaitForOtherManager
   ?'The cash count for '+shiftLabel+' was submitted. '+(ownCashierShift?'You cannot reconcile your own shift. ':'')+
    'A different authorized manager must reconcile it.'
  :needsCashInvestigation
   ?cashShiftStatus==='flagged'
    ?shiftLabel+' has a flagged discrepancy. An authorized manager must investigate before further financial verification.'
    :cashShiftStatus==='unknown'
     ?'Cashier-shift information is unavailable. Refresh after the backend update; do not collect the payment again.'
     :'No matching cash receipt could be found for this payment. An authorized manager must investigate.'
  :mustWaitForVerifier
   ?'The payment has already been staff-confirmed. '+(
     verificationPreparerName?'Verification was prepared by '+verificationPreparerName+'. ':'')+
    'A separate authorized manager must verify it.'
  :nextTask==='confirmation'
   ?'The payment is already recorded. An authorized manager needs to review the supporting receipt, not collect the money again.'
  :nextTask==='verification'
   ?'The cash reconciliation or supporting evidence is ready for an authorized independent verification.'
  :nextTask==='allocation'
   ?'The funds were independently verified. Apply them to the guest charges; do not record another receipt.'
  :nextTask==='signoff'
   ?'Payment review is complete. The guest can check out when all billing checks pass; separate manager signature is optional.'
  :nextTask==='disabled'
   ?'Payment evidence is on file, but the hotel has not enabled financial sign-off. Ask the manager to verify the approved configuration.'
  :'Check the remaining conditions before settlement. Recorded cash is not an instruction to collect again.';
 function openDialog(which:'payment'|'charges'|'correction'|'review'|'refunds'|'signoff'){
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
    client.invalidateQueries({queryKey:['live','no-show-financial-review',hotelId,bookingId]}),
    client.invalidateQueries({queryKey:['live','no-show-ledger-reconciliation',hotelId,bookingId]}),
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
 if(!hotelId||!/^[1-9]\d*$/.test(bookingId))return null;
 return <section className="settlement-page">
  <div className="billing-compact-toolbar">
   <span>Guest account</span>
   <button type="button" className="btn-inline" disabled={busy||query.isFetching}
    onClick={()=>void query.refetch()}><RefreshCw size={15}/> Refresh</button>
  </div>
  <QueryFeedback loading={query.isPending||query.isFetching} error={query.error} onRetry={()=>void query.refetch()}/>
  {requestedPayment&&query.data&&manager&&!query.data.signed&&
   <BillingActions key={requestedPayment} bookingId={bookingId} signed={false} mode="target" targetPayment={requestedPayment}/>}
  {requestedPayment&&query.data&&(query.data.signed||!manager)&&<p role="status">
   {query.data.signed?'This folio has been signed.':'An authorized hotel administrator can review this payment.'}</p>}
   {query.data?.status==='no_show'&&canReviewNoShow&&hotelId&&user?.id&&<NoShowFinancialReview key={hotelId+':'+bookingId} hotelId={hotelId} bookingId={bookingId} userId={user.id} verifiedMinor={query.data.verifiedPaymentsMinor} openOnLoad={requestedAction==='no-show'}/>}
   {query.data?.status==='no_show'&&!canReviewNoShow&&<p role="status">No-show financial reconciliation requires an authorized hotel administrator.</p>}
  {data&&<>
   <div className="billing-account-overview billing-account-compact" aria-label="Guest account overview">
    <div className="billing-account-overview-head">
     <div><span className="rr-eyebrow">ACCOUNT SUMMARY</span>
      <h3>{data.reservationReference}</h3><p>{readableDate(data.checkIn)} to {readableDate(data.checkOut)} · Guest account</p></div>
     <span className={'billing-account-tag '+(data.signed?data.signedSnapshotIntegrity?'complete':'pending':guestBillSettled?'complete':'pending')}>
      {data.signed?data.signedSnapshotIntegrity?'Settlement signed':'Investigate settlement':guestBillSettled?'Settled · payment reviewed':routineCashReady?'Cash paid · checkout ready':
       simplifiedCash?'Cash on file':'Settlement not final'}</span>
    </div>
   </div>
   {data.status==='checked_in'&&<div className="stay-operation-impact" aria-label="Checkout financial requirements">
    <strong>{checkoutBlock?'Checkout blocked — financial action required':'Billing checks clear for checkout'}</strong>
    {guestBillSettled&&<p><strong>{money(0,data.currency)} due</strong> · Reviewed payments cover the bill. Do not collect again.</p>}
    {checkoutBlock&&<p>{checkoutBlock}</p>}
    {checkoutBlock
      ?<p role="status">Resolve the listed billing checks before completing checkout. Manager signature is not required for a reconciled guest bill.</p>
      :<Link to="/reservations" search={{booking:bookingId,deskAction:'check-out'}}>Review checkout <ArrowRight size={14}/></Link>}
   </div>}
   <section className="frontdesk-payment-hub" aria-label="Front desk payment and checkout">
    <div className="frontdesk-payment-amounts">
     <div><small>Guest bill · recorded charges</small>
      <strong>{money(data.netRecordedChargesMinor,data.currency)}</strong></div>
     <div><small>{guestBillSettled?'Guest balance':'Payment recorded'}</small>
      <strong>{money(guestBillSettled?0:recordedTotal,data.currency)}</strong>
      <span>{hasExistingMoney?'Already on file — do not collect again without checking':'No recorded payment yet'}</span></div>
    </div>
   {!data.signed&&['confirmed','checked_in'].includes(data.status)&&
    !!user?.hotels.some(h=>h.id===hotelId&&['admin','front_desk'].includes(h.role))&&
    <div className="billing-guest-actions">
     <button type="button" className="rr-secondary-action" disabled={busy}
      onClick={()=>openDialog('charges')}><Banknote size={15}/> Add charge to guest bill</button>
     <span className="desk-muted">Add an incidental during the stay; it does not collect money.</span>
    </div>}
    <div className="frontdesk-payment-status" role="status">
     <div className="frontdesk-payment-status-title">
      <div><span className="rr-eyebrow">PAYMENT STATUS</span>
       <h3>{requestedPayment&&unconfirmed.some(p=>p.id===requestedPayment)?'Payment #'+requestedPayment+' awaits evidence review':paymentStatus}</h3></div>
      <span className="checkout-guide-status">{data.signed
       ?data.signedSnapshotIntegrity?'Approved':'Investigate'
       :routineCashReady?'Ready for checkout'
       :guestBillSettled?'Settled'
       :hasExistingMoney?'Payment on file':'Payment needed'}</span>
     </div>
     <p>{data.signed
      ?data.signedSnapshotIntegrity
       ?'The financial account has been signed. Check the separate operational checkout requirements.'
       :'The signed statement failed its integrity check. Stop checkout and request investigation.'
      :guestBillSettled&&!routineCashReady&&!routineCashCheckedOut
       ?'Reviewed payments cover the recorded guest charges. No further guest payment is due.'
       :requestedPayment&&unconfirmed.some(p=>p.id===requestedPayment)?'Check the recorded evidence before collecting any outstanding balance.':operationalDescription}</p>
     {!data.signed&&<div className="frontdesk-payment-primary">
      {!checkoutBlock&&data.status==='checked_in'
       ?<Link to="/reservations" search={{booking:bookingId,deskAction:'check-out'}}
         className="btn-primary">Continue guest checkout <ArrowRight size={16}/></Link>
       :canCollectExtra&&canReviewPendingTransfer
       ?<>
         <button type="button" className="btn-primary" disabled={busy} onClick={openPaymentReview}>
          <ShieldCheck size={16}/> Confirm recorded payment</button>
         <button type="button" className="rr-secondary-action" disabled={busy} onClick={()=>openDialog('payment')}>
          <Banknote size={16}/> Record additional payment · {money(extraBalanceMinor,data.currency)}</button>
        </>
       :canCollectExtra&&hasExistingMoney
       ?<button type="button" className={requestedPayment?'rr-secondary-action':'btn-primary'} disabled={busy}
         onClick={()=>openDialog('payment')}><Banknote size={16}/>
         Record additional payment · {money(extraBalanceMinor,data.currency)}</button>
       :routineCashCheckedOut&&allCashShiftsReconciled&&cashAuditValid
       ?<span className="frontdesk-payment-waiting"><CheckCircle2 size={16}/>
         Independent cash reconciliation completed. No guest payment action needed.
        </span>
       :routineCashCheckedOut
       ?<Link to="/cashier-shifts" search={{booking:bookingId,hotel:hotelId??undefined,
           shift:handoff?.cashShiftId??undefined}}
          className="rr-secondary-action">View cashier shift <ArrowRight size={16}/></Link>
       :routineCashReady
       ?<Link to="/reservations" search={{booking:bookingId}}
         className="btn-primary">Continue guest checkout <ArrowRight size={16}/></Link>
       :routineCashException
       ?<div className="frontdesk-payment-waiting">
         <ShieldCheck size={16}/><strong>Owner/manager review required</strong>
         <span>Payment is already on file. See the eligibility reason above.</span>
        </div>
       :nextCashPayment&&cashNeedsReconciliation
       ?<div className="frontdesk-payment-waiting">
         <ShieldCheck size={16}/><strong>Payment already recorded</strong>
         <span>Cash counting and drawer reconciliation happen separately in Cashier Shifts, at the end of the cashier's shift. Do not collect the guest payment again.</span>
        </div>
       :actionIsWaiting||nextTask==='disabled'&&hasExistingMoney
       ?<div className="frontdesk-payment-waiting">
         <ShieldCheck size={16}/><strong>{operationalAction}</strong>
         <span>No additional payment is required at this stage.</span>
        </div>
       :!manager&&hasExistingMoney
       ?<span className="frontdesk-payment-waiting"><ShieldCheck size={16}/>
         Waiting for authorized finance review. No additional payment needed.</span>
       :manager&&hasExistingMoney&&nextTask!=='disabled'
       ?<button type="button" className="btn-primary" disabled={busy} onClick={openPaymentReview}>
         <ShieldCheck size={16}/>{operationalAction}</button>
       :hasExistingMoney
       ?<span className="frontdesk-payment-waiting">Payment is recorded; finance approval is unavailable.</span>
       :<button type="button" className="btn-primary" disabled={busy}
        onClick={()=>openDialog('payment')}><Banknote size={16}/> Record payment</button>}
     </div>}
     {data.signed&&data.signedSnapshotIntegrity&&<Link to="/reservations"
      search={{booking:bookingId}}>Continue checkout <ArrowRight size={15}/></Link>}
    </div>
    {routineCashReady&&<p className="frontdesk-cash-handoff">
     <CheckCircle2 size={16}/> Counting and independent cashier reconciliation are still required after checkout.
     <Link to="/cashier-shifts" search={{booking:bookingId,hotel:hotelId??undefined,
      shift:handoff?.cashShiftId??undefined}}>View linked cashier shift <ArrowRight size={14}/></Link>
    </p>}
    {!data.signed&&hasExistingMoney&&<details className="frontdesk-payment-more">
     <summary>{routineCashReady||routineCashCheckedOut
      ?'Cash drawer and finance audit details':'Payment processing details · confirmation, verification and cashier shift'}</summary>
     <div className="frontdesk-payment-stages" aria-label="Payment review stages">
      <div><CheckCircle2 size={15}/> Payment recorded<strong>On file</strong></div>
      <div><ShieldCheck size={15}/> {routineCashReady||routineCashCheckedOut?'Cashier review':'Payment approval'}
       <strong>{routineCashReady||routineCashCheckedOut
        ?cashShiftStatus==='reconciled'?'Drawer reconciled':cashShiftStatus==='submitted'?'Cash count awaiting independent review'
         :cashShiftStatus==='open'?'Cash drawer still open':'Requires investigation'
        :data.verifiedPaymentsMinor>0?'Independently verified'
        :confirmedPendingVerification.length>0?'Staff-confirmed; independent verification pending'
        :unconfirmed.length>0?'Awaiting staff confirmation':'Awaiting review'}</strong></div>
      <div><ClipboardCheck size={15}/> {routineCashReady||routineCashCheckedOut?'Operational checkout':'Applied to bill'}
       <strong>{routineCashCheckedOut?'Guest checked out'
        :routineCashReady?'Checkout eligible'
        :data.verifiedAllocatedMinor>0
        ?money(data.verifiedAllocatedMinor,data.currency):'Not yet applied'}</strong></div>
     </div>
     {nextCashPayment&&<div className="frontdesk-payment-shift">
      <div><strong>Payment linked to {shiftLabel}</strong>
       <span>{cashShiftStatus==='open'?'Cash drawer open — cash count not submitted'
        :cashShiftStatus==='submitted'?'Cash count submitted — awaiting independent reconciliation'
        :cashShiftStatus==='reconciled'?'Independently reconciled'
        :cashShiftStatus==='flagged'?'Discrepancy flagged'
        :'Linked cashier-shift status requires investigation'}</span>
       {handoff?.cashierName&&<small>Cashier: {handoff.cashierName}</small>}
       {handoff?.reconciledByName&&<small>Reconciled by: {handoff.reconciledByName}</small>}
      </div>
      <Link to="/cashier-shifts" search={{booking:bookingId,hotel:hotelId??undefined,shift:handoff?.cashShiftId??undefined}}>
       Open cashier shifts <ArrowRight size={14}/></Link>
     </div>}
     {data.blockers.length>0&&<div className="frontdesk-payment-checks">
      <strong>{data.blockers.length} outstanding finance checks</strong>
      <ul>{data.blockers.map((blocker,i)=><li key={i}>{blocker}</li>)}</ul>
     </div>}
    </details>}
   </section>
   {data.routineCashCheckoutAudit&&!data.routineCashCheckoutAudit.integrityValid&&
    <p className="stay-feedback-error" role="alert"><AlertTriangle size={16}/>
     Operational cash checkout evidence failed its integrity check.
     Do not treat this historical record as independently reconciled; escalate to the owner.
    </p>}
   {data.routineCashCheckoutAudit&&<details className="billing-figures-details">
    <summary>Cash checkout audit · who processed the guest and when</summary>
    <div className="billing-account-totals">
     <div><span>Checked out by</span>
      <strong>{data.routineCashCheckoutAudit.performedByName??'Employee name unavailable'}</strong></div>
     <div><span>Time of checkout</span>
      <strong>{readableDateTime(data.routineCashCheckoutAudit.checkedOutAt)}</strong></div>
     <div><span>Net cash recorded</span>
      <strong>{money(data.routineCashCheckoutAudit.netCashMinor,data.currency)}</strong></div>
     <div><span>Receipts included</span>
      <strong>{data.routineCashCheckoutAudit.receiptCount}</strong></div>
     <div><span>Checkout evidence integrity</span>
      <strong>{data.routineCashCheckoutAudit.integrityValid?'Intact':'Investigation required'}</strong></div>
    </div>
    <p className="desk-muted">This records the operational guest checkout.
     It is not a bank verification, final cashier reconciliation, or tax invoice.</p>
   </details>}
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
   {(activeDialog==='payment'||activeDialog==='charges'||activeDialog==='correction')&&<div className="billing-modal-backdrop">
    <section id="settlement-current-dialog" className="billing-action-modal" role="dialog" aria-modal="true"
     aria-label={activeDialog==='payment'?'Record guest payment':'Update guest bill'}>
     <div className="billing-action-modal-header">
      <div><span className="rr-eyebrow">BOOKING {data.reservationReference}</span>
       <h3>{activeDialog==='payment'?'Record guest payment':activeDialog==='correction'?'Manager: correct guest bill':'Add an extra charge'}</h3>
       <p>Current recorded difference: {money(data.remainingMinor,data.currency)} · Not a final amount due</p>
      </div>
      <button type="button" ref={dialogCloser} className="billing-modal-dismiss" aria-label="Close dialog"
       onClick={closeDialog}><X size={20}/></button>
     </div>
     {activeDialog==='payment'
      ?<RecordGuestPayment key={hotelId+'-payment-'+bookingId} bookingId={bookingId}
        currency={data.currency} signed={data.signed} recordedDifferenceMinor={data.remainingMinor}
        onDone={()=>{closeDialog();void query.refetch();}}/>
      :activeDialog==='correction'
       ?<BillingActions bookingId={bookingId} signed={data.signed}/>
       :<GuestIncidentalChargeForm bookingId={bookingId} currency={data.currency}
        currentChargesMinor={data.netRecordedChargesMinor} recordedPaymentMinor={recordedTotal}
        onSaved={()=>{closeDialog();void query.refetch();}}/>}
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
     <strong className="settlement-status">{data.signed?'SIGNED ACCOUNT':guestBillSettled?'GUEST BILL SETTLED':'GUEST BILL OPEN'}</strong>
    </div>
    <div className="settlement-metrics">
     <KeyValue label="Arrival" value={readableDate(data.checkIn)}/>
     <KeyValue label="Departure" value={readableDate(data.checkOut)}/>
     <KeyValue label="Recorded charges" value={money(data.netRecordedChargesMinor,data.currency)}/>
     <KeyValue label="Verified payments applied" value={money(data.verifiedAllocatedMinor,data.currency)}/>
     {guestBillSettled&&<KeyValue label="Guest balance after payment review" value={money(0,data.currency)}/>}
     <KeyValue label="Difference after verified allocations" value={money(data.remainingMinor,data.currency)}/>
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
     <thead><tr><th>Method / reference</th><th>Status</th><th>Staff</th><th>Amount</th></tr></thead>
     <tbody>{data.payments.map(payment=>{
      const staff=staffByPayment.get(payment.id);
      return <tr key={payment.id}>
       <td>{payment.method} · {payment.reference}</td>
       <td>{paymentReviewSentence(payment,data.currency)}
        {payment.verificationStatus&&<small className="cell-note">Evidence {statusLabel(payment.verificationStatus).toLowerCase()}</small>}</td>
       <td>
        <span>Recorded by {staff?.recordedByName??'—'}</span>
        {staff?.paymentReviewedByName&&<small className="cell-note">Payment reviewed by {staff.paymentReviewedByName}</small>}
        {staff?.evidenceReviewedByName&&<small className="cell-note">Evidence reviewed by {staff.evidenceReviewedByName}</small>}
        {staff?.cashierName&&<small className="cell-note">Cashier in charge · {staff.cashierName}</small>}
       </td>
       <td>{money(payment.amountMinor,data.currency)}</td>
      </tr>;
     })}{data.payments.length===0&&<tr><td colSpan={4}>No payment evidence recorded.</td></tr>}</tbody>
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
      (guestBillSettled||routineCashReady)&&!checkoutBlock&&data.status==='checked_in'?'Guest bill reconciled — ready for checkout. Manager signature is not required.':
      guestBillSettled?'Guest payments cover the recorded bill. Finish any outstanding reconciliation checks.':
      'Guest statement is available for review. Resolve outstanding billing items before checkout.'}</p>
     {data.signed&&<p><small>Signed financial snapshot SHA-256: {data.signedSnapshotSha256}</small></p>}
     <small>This is an internal PMS guest-account statement, NOT a BIR tax invoice, bank receipt,
      payment gateway confirmation, or proof that a refund has been disbursed.</small>
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
     :<p className="desk-muted">Printable guest-account record. Manager sign-off is optional and not required for routine checkout.</p>}
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
        {' '}<Link to="/cashier-shifts" search={{booking:bookingId,hotel:hotelId??undefined,
         shift:data.cashShiftContexts.find(row=>row.paymentId===paymentRow.id)?.cashShiftId??undefined}}>
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
     <button type="button" className="btn-inline" onClick={()=>openDialog('correction')}>Manager bill corrections</button>
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
