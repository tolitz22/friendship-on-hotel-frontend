import {useRef,useState} from 'react';
import {useQueryClient} from '@tanstack/react-query';
import {AlertTriangle,ArrowRight,Banknote,CheckCircle2,CreditCard,Info,RefreshCw} from 'lucide-react';
import {Link} from '@tanstack/react-router';
import {useHotelAuth} from './AuthProvider';
import {useCurrentCashierShift,openCashierShift,receiveCash} from '../api/cashierShifts';
import {parseBillingAmount,calculateCashChange,formatBillingMoney,recordBankEvidence,usePaymentSafety} from '../api/billing';
import {readSession} from '../api/session';

type Method='cash'|'bank';
const makeReference=()=> 'CASH-'+crypto.randomUUID().replaceAll('-','').slice(0,18).toUpperCase();

/** One guest payment form: cash is always linked to THIS cashier's shift.
 * A recorded receipt remains subject to independent review and reconciliation. */
export function RecordGuestPayment({bookingId,currency,signed,recordedDifferenceMinor,onDone}:{
 bookingId:string;currency:string;signed:boolean;recordedDifferenceMinor:number;
 onDone?:()=>void;
}){
 const {hotelId,user}=useHotelAuth();
 const role=user?.hotels.find(h=>h.id===hotelId)?.role;
 const allowed=role==='admin'||role==='front_desk';
 const manager=role==='admin';
 const client=useQueryClient();
 const [method,setMethod]=useState<Method>('cash');
 const [amount,setAmount]=useState('');
 const [tendered,setTendered]=useState('');
 const [bankReference,setBankReference]=useState('');
 const [openingFloat,setOpeningFloat]=useState('0.00');
 const [confirmed,setConfirmed]=useState(false);
 const [openingConfirmed,setOpeningConfirmed]=useState(false);
 const [busy,setBusy]=useState(false);
 const [notice,setNotice]=useState('');
 const [paymentSaved,setPaymentSaved]=useState(false);
 const [duplicateReason,setDuplicateReason]=useState('');
 const [duplicateConfirmed,setDuplicateConfirmed]=useState(false);
 const [error,setError]=useState('');
 const idempotencyKey=useRef(crypto.randomUUID());
 const receiptReference=useRef(makeReference());
 const shift=useCurrentCashierShift(!!allowed&&!signed);
 const amountMinor=currency==='PHP'?parseBillingAmount(amount):null;
 const safety=usePaymentSafety(bookingId,method==='cash'?'cash':'bank_transfer',amountMinor);
 const matches=safety.data?.recentMatchingPaymentIds??[];
 const potentialDuplicate=amountMinor!==null&&matches.length>0;
 const allowSecond=manager&&duplicateConfirmed&&duplicateReason.trim().length>=12;
 const activePayments=safety.data?.payments.filter(p=>
  p.status==='pending_review'||p.status==='staff_confirmed')??[];
 const alreadyRecordedMinor=activePayments.reduce((sum,p)=>sum+p.amountMinor,0);
 const pendingMinor=activePayments.filter(p=>p.status==='pending_review')
  .reduce((sum,p)=>sum+p.amountMinor,0);
 const tenderedMinor=currency==='PHP'?parseBillingAmount(tendered):null;
 const floatMinor=openingFloat==='0'||openingFloat==='0.00'?0:parseBillingAmount(openingFloat);
 const changeMinor=calculateCashChange(amountMinor,tenderedMinor);
 const overDifference=amountMinor!==null&&recordedDifferenceMinor>0&&amountMinor>recordedDifferenceMinor;
 const canSubmit=!!hotelId&&!!allowed&&!signed&&!busy&&amountMinor!==null&&confirmed
  &&safety.isSuccess&&(!potentialDuplicate||allowSecond)&&(
  method==='cash'?shift.isSuccess&&!shift.isFetching&&!!shift.data&&shift.data.status==='open'&&changeMinor!==null:
  manager&&bankReference.trim().length>=3
 );
 const resetAttempt=()=>{
  idempotencyKey.current=crypto.randomUUID();
  receiptReference.current=makeReference();
  setConfirmed(false);setNotice('');setPaymentSaved(false);setError('');
  setDuplicateConfirmed(false);setDuplicateReason('');
 };
 const refresh=()=>{
  void Promise.all([
   client.invalidateQueries({queryKey:['live','current-cashier-shift',hotelId]}),
   client.invalidateQueries({queryKey:['live','cashier-shifts',hotelId]}),
   client.invalidateQueries({queryKey:['live','settlement-statement',hotelId,bookingId]}),
   client.invalidateQueries({queryKey:['live','payment-safety',hotelId,bookingId]}),
   client.invalidateQueries({queryKey:['live','folio-ledger',hotelId]}),
   client.invalidateQueries({queryKey:['live','billing-folios',hotelId]}),
  ]).catch(()=>{});
 };
 async function startShift(){
  if(!hotelId||!allowed||signed||busy||!openingConfirmed||floatMinor===null)return;
  setBusy(true);setError('');setNotice('');setPaymentSaved(false);
  try{
   await openCashierShift(hotelId,floatMinor);
   if(readSession().hotelId!==hotelId)return;
   setOpeningConfirmed(false);
   setNotice('Your cash drawer is open. You can now record this guest’s cash payment.');
   refresh();
  }catch(e){
   if(readSession().hotelId===hotelId)setError(
    (e instanceof Error?e.message:'Unable to open your cash drawer.')+
    ' Check your cashier shift before trying again.');
  }finally{setBusy(false);}
 }
 async function submitPayment(){
  if(!canSubmit||amountMinor===null||!hotelId)return;
  const requestKey=idempotencyKey.current;
  setBusy(true);setError('');setNotice('');
  try{
   if(method==='cash'){
    if(!shift.data||changeMinor===null)return;
    const result=await receiveCash(hotelId,shift.data.id,bookingId,{
     requestKey,reference:receiptReference.current,amountMinor,
     cashTenderedMinor:tenderedMinor!,changeGivenMinor:changeMinor,
     ...(potentialDuplicate&&allowSecond?{duplicateOverrideReason:duplicateReason.trim()}:{}),
    });
    if(readSession().hotelId!==hotelId)return;
    setNotice('Cash receipt #'+result.paymentId+' saved. Cash handed over: '+
     formatBillingMoney(result.cashTenderedMinor??tenderedMinor!,currency)+
     '. Change to return: '+formatBillingMoney(result.changeGivenMinor??changeMinor,currency)+
     '. Net cash added to drawer: '+formatBillingMoney(result.netReceiptMinor??amountMinor,currency)+
     '. Receipt remains subject to independent review.');
   }else{
    await recordBankEvidence(bookingId,requestKey,bankReference.trim(),amountMinor,
     potentialDuplicate&&allowSecond?duplicateReason.trim():undefined);
    if(readSession().hotelId!==hotelId)return;
    setNotice('Bank-transfer evidence recorded. An independent manager must review it before settlement.');
   }
   setPaymentSaved(true);
   idempotencyKey.current=crypto.randomUUID();
   receiptReference.current=makeReference();
   setAmount('');setTendered('');setBankReference('');setConfirmed(false);
   refresh();
  }catch(e){
   if(readSession().hotelId===hotelId)setError(
    (e instanceof Error?e.message:'The payment result could not be confirmed.')+
    ' Check the payment history before retrying. Retrying without changing the details uses the same request reference.');
  }finally{setBusy(false);}
 }
 if(!allowed||signed)return null;
 return <section className="billing-payment-workflow" aria-label="Record guest payment">
  <div className="billing-payment-heading"><div>
   <span className="rr-eyebrow">NEXT STEP</span><h3>Record a guest payment</h3>
   <p>Select how the guest paid. The payment is linked automatically to this booking.</p>
  </div></div>
  <div className="billing-payment-methods" role="group" aria-label="Payment method">
   <button type="button" className={method==='cash'?'active':''} aria-pressed={method==='cash'}
    disabled={busy} onClick={()=>{setMethod('cash');resetAttempt();}}><Banknote size={18}/> Cash</button>
   <button type="button" className={method==='bank'?'active':''} aria-pressed={method==='bank'}
    disabled={busy||!manager} onClick={()=>{setMethod('bank');resetAttempt();}}>
    <CreditCard size={18}/> Bank transfer {manager?'':'· manager only'}</button>
  </div>
  {method==='cash'&&<div className="billing-shift-status">
   {shift.isPending?<p>Checking your cash drawer…</p>:
    shift.isError?<div role="alert"><AlertTriangle size={17}/>
     <span>Unable to check your cashier shift. Cash collection is disabled until it loads.</span>
     <button type="button" className="btn-inline" onClick={()=>void shift.refetch()}><RefreshCw size={15}/> Retry</button></div>:
    shift.data?<p className="billing-active-shift"><CheckCircle2 size={17}/>
     Your cash drawer is open · Shift #{shift.data.id}. This receipt will be recorded under your account.</p>:
    <div className="billing-open-shift">
     <div><strong>Open your cash drawer first</strong>
      <p>Cash payments must be recorded in your own shift. Count the money already in your drawer before opening it.</p></div>
     <label>Opening cash in drawer (₱)
      <input className="wizard-input" inputMode="decimal" value={openingFloat} disabled={busy}
       onChange={e=>{setOpeningFloat(e.target.value);setOpeningConfirmed(false);}}/>
     </label>
     <label className="billing-payment-ack"><input type="checkbox" checked={openingConfirmed}
      disabled={busy} onChange={e=>setOpeningConfirmed(e.target.checked)}/>
      I counted the opening cash in my drawer.</label>
     <button type="button" className="btn-primary" onClick={()=>void startShift()}
      disabled={busy||floatMinor===null||!openingConfirmed}>{busy?'Opening…':'Open my cash drawer'}</button>
     <Link to="/cashier-shifts" search={{booking:bookingId,hotel:hotelId??undefined}}>
      View cashier shifts <ArrowRight size={14}/></Link>
    </div>}
  </div>}
  {(method!=='cash'||!!shift.data)&&<div className="billing-payment-fields">
   {method==='bank'&&<label>Bank transfer reference
    <input className="wizard-input" disabled={busy} value={bankReference}
     placeholder="Reference shown on the transfer evidence" maxLength={120}
     onChange={e=>{setBankReference(e.target.value);resetAttempt();}}/>
   </label>}
   <section className="billing-payment-existing" aria-label="Existing guest payments">
    <div className="billing-payment-existing-heading"><strong>Before collecting another payment</strong>
     <button type="button" className="btn-inline" disabled={safety.isFetching}
      onClick={()=>void safety.refetch()}><RefreshCw size={14}/> Refresh payments</button></div>
    {safety.isPending&&<p>Checking existing payment records…</p>}
    {safety.isError&&<p role="alert">Could not verify existing records. Payment entry is paused until this check succeeds.</p>}
    {safety.isSuccess&&<>
     <div className="billing-payment-existing-totals">
      <span>Already recorded (not necessarily verified): <strong>{formatBillingMoney(alreadyRecordedMinor,currency)}</strong></span>
      <span>Awaiting review: <strong>{formatBillingMoney(pendingMinor,currency)}</strong></span>
     </div>
     {activePayments.length>0&&<details>
      <summary>Review {activePayments.length} existing payment record{activePayments.length===1?'':'s'}</summary>
      <div className="billing-payment-existing-list">
       {activePayments.slice(0,15).map(p=><div key={p.id}>
        <strong>{p.reference} · {formatBillingMoney(p.amountMinor,currency)}</strong>
        <small>{p.method==='cash'?'Cash':'Bank transfer'} · {p.status==='pending_review'?'Awaiting review':'Staff-confirmed'}
         {' · '}Recorded by {p.recordedByName??'Employee name unavailable'}</small>
        {p.duplicateExceptionReason&&<small>
         Separately authorized by {p.duplicateApprovedByName??'An administrator'}:
         {' '}{p.duplicateExceptionReason}
        </small>}
       </div>)}
      </div>
     </details>}
     {safety.data.hasMore&&<p>There are older records not shown here. Review the full folio history before recording another payment.</p>}
    </>}
   </section>
   <label>Payment amount (₱)
    <input className="wizard-input" inputMode="decimal" disabled={busy} value={amount}
     placeholder="0.00" onChange={e=>{setAmount(e.target.value);resetAttempt();}}/>
   </label>
   {method==='cash'&&<label>Cash handed to you (₱)
    <input className="wizard-input" inputMode="decimal" disabled={busy} value={tendered}
     placeholder="0.00" onChange={e=>{setTendered(e.target.value);resetAttempt();}}/>
   </label>}
   {method==='cash'&&<div className="billing-change-summary" role="status">
    <span>Change to return to the guest</span>
    <strong>{changeMinor===null?'—':formatBillingMoney(changeMinor,currency)}</strong>
    {changeMinor!==null&&amountMinor!==null&&tenderedMinor!==null&&
     <small>Cash handed over: {formatBillingMoney(tenderedMinor,currency)}.
      Net cash added to drawer: {formatBillingMoney(amountMinor,currency)}.
      The change is not hotel revenue.</small>}
    {amountMinor!==null&&tenderedMinor!==null&&tenderedMinor<amountMinor&&
     <small>Cash received must be at least the payment amount.</small>}
   </div>}
   {overDifference&&<p className="billing-payment-caution"><AlertTriangle size={16}/>
    This payment exceeds the current recorded difference. Check the guest's bill and any deposits before proceeding.</p>}
   {potentialDuplicate&&<section className="billing-payment-duplicate" role="alert">
    <div><AlertTriangle size={19}/><strong>Possible duplicate payment — recording is blocked</strong></div>
    <p>The same payment method and amount were recorded within the last 24 hours on this guest folio.
     Review the existing record and confirm whether the guest actually paid again.</p>
    {manager?<div className="billing-payment-duplicate-override">
     <label>Why is this a separate payment?
      <textarea className="wizard-input" rows={2} maxLength={500} disabled={busy}
       placeholder="Describe the additional cash received or separate bank transfer."
       value={duplicateReason} onChange={e=>{setDuplicateReason(e.target.value);setDuplicateConfirmed(false);}}/>
     </label>
     <label className="billing-payment-ack">
      <input type="checkbox" checked={duplicateConfirmed} disabled={busy||duplicateReason.trim().length<12}
       onChange={e=>setDuplicateConfirmed(e.target.checked)}/>
      I independently checked that the guest made another distinct payment and authorize an audited exception.
     </label>
    </div>:<p>An authorized manager must review an additional payment. Do not collect the same money twice.</p>}
   </section>}
   <label className="billing-payment-ack"><input type="checkbox" checked={confirmed}
    disabled={busy} onChange={e=>setConfirmed(e.target.checked)}/>
    I checked the guest, the payment amount and {method==='cash'?'the cash received':'the transfer reference'}.
   </label>
   <button type="button" className="btn-primary" disabled={!canSubmit} onClick={()=>void submitPayment()}>
    {busy?'Recording…':method==='cash'?'Record cash payment':'Record transfer evidence'} <ArrowRight size={16}/>
   </button>
   <p className="billing-payment-explanation"><Info size={15}/>
    {method==='cash'
     ?'The receipt saves cash tendered, change given, and net payment in your open shift. Only the net payment increases expected drawer cash. Give change immediately, then complete shift reconciliation later.'
     :'Recording a transfer reference does not confirm that the money reached the hotel’s bank account.'}</p>
  </div>}
  {notice&&<div className="billing-payment-complete" role="status">
   <p className="billing-payment-success"><CheckCircle2 size={17}/>{notice}</p>
   {paymentSaved&&onDone&&<button type="button" className="btn-primary" onClick={onDone}>
    Continue to payment review <ArrowRight size={15}/></button>}
  </div>}
  {error&&<p role="alert" className="billing-payment-error"><AlertTriangle size={17}/>{error}</p>}
 </section>;
}
