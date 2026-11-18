import {useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {useQueryClient} from '@tanstack/react-query';
import {AlertTriangle,CheckCircle2,ShieldCheck,PlusCircle,MinusCircle,Info,X} from 'lucide-react';
import {useHotelAuth} from './AuthProvider';
import {useLiveFolioLedger} from '../api/liveFinance';
import {formatBillingMoney,parseBillingAmount,recordFolioAdjustment,reviewFolioPayment,voidFolioPayment} from '../api/billing';
import {readSession} from '../api/session';
import {QueryFeedback} from './QueryFeedback';

export function BillingActions({bookingId,signed,mode='full'}:{
 bookingId:string;signed:boolean;mode?:'full'|'review';
}){
 const {hotelId,user}=useHotelAuth();
 const manager=!!hotelId&&user?.hotels.some(h=>h.id===hotelId&&h.role==='admin');
 const client=useQueryClient();
 const ledger=useLiveFolioLedger(bookingId);
 const [amount,setAmount]=useState('');
 const [kind,setKind]=useState<'credit'|'debit'>('debit');
 const [category,setCategory]=useState('Extra service');
 const [reason,setReason]=useState('');
 const [confirm,setConfirm]=useState(false);
 const [reviewDialog,setReviewDialog]=useState<{paymentId:string;decision:'confirm'|'reject'}|null>(null);
 const [reviewNote,setReviewNote]=useState('');
 const reviewNoteRef=useRef<HTMLTextAreaElement>(null);
 const reviewOpener=useRef<HTMLElement|null>(null);
 const [reviewError,setReviewError]=useState('');
 const [voidTarget,setVoidTarget]=useState<string|null>(null);
 const [voidReason,setVoidReason]=useState('');
 const [voidAcknowledged,setVoidAcknowledged]=useState(false);
 const voidKey=useRef(crypto.randomUUID());
 const [busy,setBusy]=useState(false);
 const [notice,setNotice]=useState('');
 const [error,setError]=useState('');
 const key=useRef(crypto.randomUUID());
 useEffect(()=>{
  if(!reviewDialog)return;
  const previousOverflow=document.body.style.overflow;
  document.body.style.overflow='hidden';
  reviewNoteRef.current?.focus();
  const onKeyDown=(event:KeyboardEvent)=>{
   if(event.key==='Escape'&&!busy){
    setReviewDialog(null);
    return;
   }
   if(event.key!=='Tab')return;
   const dialog=document.getElementById('payment-evidence-review-dialog');
   if(!dialog)return;
   const focusables=Array.from(dialog.querySelectorAll<HTMLElement>(
    'button:not([disabled]),textarea:not([disabled]),a[href],[tabindex]:not([tabindex="-1"])'
   ));
   if(focusables.length===0)return;
   const first=focusables[0],last=focusables[focusables.length-1];
   if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
   else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
  };
  document.addEventListener('keydown',onKeyDown);
  return()=>{
   document.body.style.overflow=previousOverflow;
   document.removeEventListener('keydown',onKeyDown);
   reviewOpener.current?.focus();
  };
 },[reviewDialog,busy]);
 const openReview=(paymentId:string,decision:'confirm'|'reject')=>{
  reviewOpener.current=document.activeElement instanceof HTMLElement?document.activeElement:null;
  setReviewDialog({paymentId,decision});
  setReviewNote('');setReviewError('');
 };
 const closeReview=()=>{if(!busy)setReviewDialog(null);};

 const parsedAmount=parseBillingAmount(amount);
 const currentCharges=ledger.data?.data.summary.netRecordedChargesMinor??null;
 const resultingCharges=parsedAmount!==null&&currentCharges!==null
  ?currentCharges+(kind==='debit'?parsedAmount:-parsedAmount):null;
 const change=()=>{key.current=crypto.randomUUID();setConfirm(false);setError('');setNotice('');};
 const canWrite=!!manager&&!signed&&ledger.isSuccess&&!busy;
 const selectVoid=(paymentId:string)=>{
  setVoidTarget(paymentId===voidTarget?null:paymentId);
  setVoidReason('');setVoidAcknowledged(false);
  voidKey.current=crypto.randomUUID();
  setError('');setNotice('');
 };
 const submitVoid=async()=>{
  if(!canWrite||!voidTarget||voidReason.trim().length<12||!voidAcknowledged)return;
  const key=voidKey.current;
  setBusy(true);setError('');setNotice('');
  try{
   await voidFolioPayment(bookingId,voidTarget,key,voidReason.trim());
   if(readSession().hotelId!==hotelId)return;
   setNotice('The mistaken payment evidence was voided and retained in the audit history. It no longer counts as received payment. A refund has not been issued.');
   setVoidTarget(null);setVoidReason('');setVoidAcknowledged(false);
   voidKey.current=crypto.randomUUID();
   void refresh();
  }catch(e){
   if(readSession().hotelId===hotelId)setError(
    (e instanceof Error?e.message:'Unable to void payment.')+
    ' Check whether the payment was already verified, allocated, or belongs to a closed cashier shift.');
  }finally{setBusy(false);}
 };
 const refresh=async()=>{
  await Promise.all([
   client.invalidateQueries({queryKey:['live','folio-ledger',hotelId,bookingId]}),
   client.invalidateQueries({queryKey:['live','settlement-statement',hotelId,bookingId]}),
   client.invalidateQueries({queryKey:['live','payment-safety',hotelId,bookingId]}),
   client.invalidateQueries({queryKey:['live','billing-folios',hotelId]}),
  ]);
 };
 const submit=async()=>{
  if(!canWrite||!parsedAmount||!confirm)return;
  if(reason.trim().length<3)return;
  const previousKey=key.current;
  setBusy(true);setError('');setNotice('');
  try{
   await recordFolioAdjustment(bookingId,previousKey,kind,parsedAmount,
    kind==='debit'?category+': '+reason.trim():reason.trim());
   if(readSession().hotelId!==hotelId)return;
   key.current=crypto.randomUUID();setAmount('');setReason('');setConfirm(false);
   setNotice(kind==='debit'?'Additional charge saved on the guest bill.':'Correction saved. The recorded guest charges have been reduced.');
   void refresh();
  }catch(e){if(readSession().hotelId===hotelId)setError(e instanceof Error?e.message:'Outcome uncertain. Review the folio before retrying.');}
  finally{setBusy(false);}
 };
 const review=async()=>{
  if(!reviewDialog||!canWrite||reviewNote.trim().length<5)return;
  const {paymentId,decision}=reviewDialog;
  const note=reviewNote.trim();
  setBusy(true);setReviewError('');setNotice('');
  try{
   await reviewFolioPayment(bookingId,paymentId,decision,note);
   if(readSession().hotelId!==hotelId)return;
   setNotice(decision==='confirm'
    ?'Payment evidence staff-confirmed. Independent verification and allocation are still required.'
    :'Payment evidence rejected. The original record remains in the audit history.');
   setReviewDialog(null);
   void refresh();
  }catch(e){
   if(readSession().hotelId===hotelId)setReviewError(
    e instanceof Error?e.message:'Review could not be saved.');
  }finally{setBusy(false);}
 };
 if(!manager||signed)return null;
 return <section className="billing-actions" aria-label="Manager folio actions">
  {mode==='full'&&<>
  <div className="billing-section-heading"><div><h3>Update the guest's bill</h3>
   <p>Add an extra service or correct an existing charge. This does not record a payment.</p></div></div>
  <div className="billing-adjust-choice" role="group" aria-label="Bill change type">
   <button type="button" className={kind==='debit'?'active':''} aria-pressed={kind==='debit'}
    disabled={busy} onClick={()=>{setKind('debit');change();}}><PlusCircle size={17}/>
    <span><strong>Add a charge</strong><small>Increase the guest's bill</small></span></button>
   <button type="button" className={kind==='credit'?'active':''} aria-pressed={kind==='credit'}
    disabled={busy} onClick={()=>{setKind('credit');change();}}><MinusCircle size={17}/>
    <span><strong>Apply a correction</strong><small>Reduce the guest's charges</small></span></button>
  </div>
  <div className="billing-action-form">
   {kind==='debit'&&<label>What is the extra charge for?
    <select className="wizard-input" value={category} disabled={busy}
     onChange={e=>{setCategory(e.target.value);change();}}>
     <option>Extra service</option><option>Food and drinks</option><option>Extra person</option>
     <option>Late checkout</option><option>Room damage</option><option>Other charge</option>
    </select>
   </label>}
   <label>{kind==='debit'?'Description of charge':'Reason for the correction'}
    <textarea className="wizard-input" rows={2} value={reason} maxLength={500} disabled={busy}
     onChange={e=>{setReason(e.target.value);change();}}
     placeholder={kind==='debit'?'Example: Two bottled waters from minibar':'Example: Duplicate charge entered by mistake'}/>
   </label>
   <label>Amount to {kind==='debit'?'add':'subtract'} ({ledger.data?.data.summary.currency==='PHP'?'₱':'hotel currency'})
    <input className="wizard-input" type="text" inputMode="decimal" value={amount} disabled={busy}
     placeholder="0.00" onChange={e=>{setAmount(e.target.value);change();}}/>
   </label>
   <div className="billing-adjust-preview" aria-live="polite">
    <strong>How this changes the guest bill</strong>
    <div><span>Charges currently recorded</span>
     <b>{currentCharges!==null?formatBillingMoney(currentCharges,ledger.data?.data.summary.currency??'PHP'):'—'}</b></div>
    <div><span>{kind==='debit'?'New charge':'Correction to subtract'}</span>
     <b>{parsedAmount!==null?(kind==='debit'?'+ ':'− ')+formatBillingMoney(parsedAmount,ledger.data?.data.summary.currency??'PHP'):'—'}</b></div>
    <div className="billing-adjust-new-total"><span>Updated recorded charges</span>
     <b>{resultingCharges!==null?formatBillingMoney(resultingCharges,ledger.data?.data.summary.currency??'PHP'):'—'}</b></div>
    <small>These figures exclude payments, deposits and any new tax adjustments. The saved bill may change after review.</small>
   </div>
   {kind==='credit'&&<p className="billing-adjust-warning"><Info size={16}/>
    A correction reduces recorded charges. This is not a refund and does not return money to a guest.</p>}
   <label className="billing-confirm"><input type="checkbox" checked={confirm} disabled={busy}
    onChange={e=>setConfirm(e.target.checked)}/>
    I checked the booking, description and amount. I understand this change will be recorded in the account history.
   </label>
   <button type="button" className="btn-primary" disabled={!canWrite||!parsedAmount||!confirm||reason.trim().length<3}
    onClick={()=>void submit()}>{busy?'Saving…':kind==='debit'?'Add charge to guest bill':'Apply bill correction'}</button>
  </div>
  </>}
  <details className="billing-review-list billing-review-details"
   open={mode==='review'?true:undefined}>
   <summary><strong>Payment records waiting for manager review</strong>
    <span>{mode==='review'?'Independent manager confirmation':'View reviews'}</span></summary>
   <QueryFeedback loading={ledger.isPending} error={ledger.error} onRetry={()=>void ledger.refetch()}/>
   {ledger.data?.data.payments.filter(p=>p.status==='pending_review').map(p=><div className="billing-review-item" key={p.id}>
    <div><strong>Payment #{p.id} · {p.method==='bank_transfer'?'Bank transfer':'Cash'}</strong>
     <span>{p.reference} · {formatBillingMoney(p.amountMinor,ledger.data!.data.summary.currency)}</span></div>
    {p.method==='bank_transfer'&&p.recordedBy===user?.id&&<p className="billing-advisory">
     Another administrator must independently confirm the bank-transfer record you created.</p>}
    <div className="billing-review-actions">
     <button type="button" className="btn-primary" disabled={!canWrite||
      (p.method==='bank_transfer'&&p.recordedBy===user?.id)}
      onClick={()=>openReview(p.id,'confirm')}><ShieldCheck size={15}/> Confirm evidence</button>
     <button type="button" className="btn-inline" disabled={!canWrite}
      onClick={()=>openReview(p.id,'reject')}>Reject evidence</button>
    </div>
   </div>)}
   {ledger.isSuccess&&ledger.data.data.payments.every(p=>p.status!=='pending_review')&&
    <p className="billing-reviewed"><CheckCircle2 size={16}/> No payment records are awaiting staff review.</p>}
  </details>
  <section className="billing-void-section" aria-label="Correct accidental payment entries">
   <div className="billing-section-heading"><div>
    <h3>Correct an accidental payment</h3>
    <p>Void only evidence entered by mistake when no additional money was received.
     This is not a refund, and a signed folio or closed cash shift cannot be changed here.</p>
   </div></div>
   <div className="billing-void-list">
    {ledger.data?.data.payments.map(payment=><div key={payment.id} className="billing-void-record">
     <div className="billing-void-row">
      <div><strong>Payment #{payment.id} · {formatBillingMoney(payment.amountMinor,
       ledger.data!.data.summary.currency)}</strong>
       <small>{payment.method==='cash'?'Cash':'Bank transfer'} · {payment.reference}
        {' · '}{payment.status.replaceAll('_',' ')}
        {' · '}Recorded by {payment.recordedByName??'Employee name unavailable'}</small>
       {payment.status==='voided'&&<small>
        Voided by {payment.voidedByName??'Authorized staff'} · {payment.voidReason??'See audit history'}
       </small>}
      </div>
      {['pending_review','staff_confirmed','rejected'].includes(payment.status)&&
       <button type="button" className="btn-inline" disabled={busy||payment.recordedBy===user?.id}
        onClick={()=>selectVoid(payment.id)}>
        {voidTarget===payment.id?'Cancel correction':'Void mistaken payment'}
       </button>}
     </div>
     {voidTarget===payment.id&&<div className="billing-void-confirm">
      <p><AlertTriangle size={16}/> Do not use this if cash or funds were actually received.
       A genuine second payment must remain recorded and may require a separate refund.
       The server will reject a void after verification, allocation, sign-off or cash-shift closure.</p>
      <label>Why was this entry a mistake?
       <textarea className="wizard-input" rows={2} maxLength={500} disabled={busy}
        value={voidReason} onChange={e=>{setVoidReason(e.target.value);setVoidAcknowledged(false);}}
        placeholder="Example: Second entry for the same cash received; no second payment was collected."/>
      </label>
      <label className="billing-payment-ack"><input type="checkbox" checked={voidAcknowledged}
       disabled={busy||voidReason.trim().length<12}
       onChange={e=>setVoidAcknowledged(e.target.checked)}/>
       I independently checked the receipt and physical funds. No second payment was received.
       Keep the original record in the audit history.</label>
      <button type="button" className="btn-primary" disabled={busy||voidReason.trim().length<12||!voidAcknowledged}
       onClick={()=>void submitVoid()}>{busy?'Voiding…':'Confirm audited void'}</button>
     </div>}
    </div>)}
    {ledger.data?.data.payments.length===0&&<p className="desk-muted">No payment records to correct.</p>}
   </div>
  </section>
  {notice&&<p role="status" className="stay-feedback-success"><CheckCircle2 size={16}/>{notice}</p>}
  {error&&<p role="alert" className="stay-feedback-error"><AlertTriangle size={16}/>{error} Check the folio before retrying if the outcome is unclear.</p>}
  {reviewDialog&&createPortal(<div className="billing-modal-backdrop billing-review-backdrop"
    onMouseDown={event=>{if(event.target===event.currentTarget)closeReview();}}>
   <section id="payment-evidence-review-dialog" role="dialog" aria-modal="true"
    aria-labelledby="payment-evidence-review-title" aria-describedby="payment-evidence-review-description"
    className="billing-action-modal billing-evidence-dialog">
    <div className="billing-action-modal-header">
     <div><span className="rr-eyebrow">INDEPENDENT PAYMENT REVIEW</span>
      <h3 id="payment-evidence-review-title">{reviewDialog.decision==='confirm'
       ?'Confirm payment evidence':'Reject payment evidence'}</h3>
      <p id="payment-evidence-review-description">Check the actual receipt or supporting evidence before making a decision.
       This action will be recorded with your manager account.</p>
     </div>
     <button type="button" className="billing-modal-dismiss" aria-label="Close payment review"
      disabled={busy} onClick={closeReview}><X size={20}/></button>
    </div>
    {(()=>{
     const payment=ledger.data?.data.payments.find(p=>p.id===reviewDialog.paymentId);
     if(!payment)return <p role="alert">This payment is no longer available. Close and refresh the bill.</p>;
     const selfBank=reviewDialog.decision==='confirm'
      &&payment.method==='bank_transfer'&&payment.recordedBy===user?.id;
     return <div className="billing-evidence-modal-body">
      <div className="billing-evidence-summary">
       <div><span>Payment</span><strong>#{payment.id} · {payment.method==='cash'?'Cash':'Bank transfer'}</strong></div>
       <div><span>Amount recorded</span><strong>{formatBillingMoney(payment.amountMinor,ledger.data!.data.summary.currency)}</strong></div>
       <div><span>Reference</span><strong>{payment.reference}</strong></div>
       <div><span>Recorded by</span><strong>{payment.recordedByName??'Staff name unavailable'}</strong></div>
      </div>
      {selfBank&&<p role="alert" className="stay-feedback-error">
       <AlertTriangle size={16}/> Another administrator must confirm bank evidence you recorded.</p>}
      <p className="billing-evidence-explainer">
       {reviewDialog.decision==='confirm'
        ?'Confirming acknowledges that you reviewed this payment record. It does not verify bank settlement, allocate money, or sign off the folio.'
        :'Reject only when the record is incorrect or unsupported. Rejected evidence stays in the audit history and cannot settle the folio.'}
      </p>
      <label>Review note <span className="desk-muted">(required)</span>
       <textarea ref={reviewNoteRef} className="wizard-input" rows={3} maxLength={500}
        disabled={busy} value={reviewNote} onChange={e=>setReviewNote(e.target.value)}
        placeholder={reviewDialog.decision==='confirm'
         ?'Describe what receipt or evidence you checked.'
         :'Explain why this evidence is incorrect or unsupported.'}/>
      </label>
      {reviewError&&<p role="alert" className="stay-feedback-error"><AlertTriangle size={16}/>{reviewError}</p>}
      <div className="billing-evidence-dialog-actions">
       <button type="button" className="rr-secondary-action" disabled={busy} onClick={closeReview}>Cancel</button>
       <button type="button" className="btn-primary" disabled={busy||!canWrite||selfBank||
        reviewNote.trim().length<5||payment.status!=='pending_review'}
        onClick={()=>void review()}>{busy?'Saving decision…':
         reviewDialog.decision==='confirm'?'Confirm payment evidence':'Reject payment evidence'}</button>
      </div>
     </div>;
    })()}
   </section>
  </div>,document.body)}
 </section>;
}
