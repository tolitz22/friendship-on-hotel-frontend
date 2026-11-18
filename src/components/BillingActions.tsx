import {useRef,useState} from 'react';
import {useQueryClient} from '@tanstack/react-query';
import {AlertTriangle,CheckCircle2,ClipboardPlus,ShieldCheck} from 'lucide-react';
import {useHotelAuth} from './AuthProvider';
import {useLiveFolioLedger} from '../api/liveFinance';
import {formatBillingMoney,parseBillingAmount,recordFolioAdjustment,reviewFolioPayment} from '../api/billing';
import {readSession} from '../api/session';
import {QueryFeedback} from './QueryFeedback';

export function BillingActions({bookingId,signed}:{bookingId:string;signed:boolean}){
 const {hotelId,user}=useHotelAuth();
 const manager=!!hotelId&&user?.hotels.some(h=>h.id===hotelId&&h.role==='admin');
 const client=useQueryClient();
 const ledger=useLiveFolioLedger(bookingId);
 const [amount,setAmount]=useState('');
 const [kind,setKind]=useState<'credit'|'debit'>('debit');
 const [reason,setReason]=useState('');
 const [confirm,setConfirm]=useState(false);
 const [reviewNotes,setReviewNotes]=useState<Record<string,string>>({});
 const [busy,setBusy]=useState(false);
 const [notice,setNotice]=useState('');
 const [error,setError]=useState('');
 const key=useRef(crypto.randomUUID());
 const parsedAmount=parseBillingAmount(amount);
 const change=()=>{key.current=crypto.randomUUID();setConfirm(false);setError('');setNotice('');};
 const canWrite=!!manager&&!signed&&ledger.isSuccess&&!busy;
 const refresh=async()=>{
  await Promise.all([
   client.invalidateQueries({queryKey:['live','folio-ledger',hotelId,bookingId]}),
   client.invalidateQueries({queryKey:['live','settlement-statement',hotelId,bookingId]}),
   client.invalidateQueries({queryKey:['live','billing-folios',hotelId]}),
  ]);
 };
 const submit=async()=>{
  if(!canWrite||!parsedAmount||!confirm)return;
  if(reason.trim().length<3)return;
  const previousKey=key.current;
  setBusy(true);setError('');setNotice('');
  try{
   await recordFolioAdjustment(bookingId,previousKey,kind,parsedAmount,reason.trim());
   if(readSession().hotelId!==hotelId)return;
   key.current=crypto.randomUUID();setAmount('');setReason('');setConfirm(false);
   setNotice('Charge or credit saved in the guest account history.');
   void refresh();
  }catch(e){if(readSession().hotelId===hotelId)setError(e instanceof Error?e.message:'Outcome uncertain. Review the folio before retrying.');}
  finally{setBusy(false);}
 };
 const review=async(paymentId:string,decision:'confirm'|'reject')=>{
  const note=reviewNotes[paymentId]?.trim()??'';
  if(!canWrite||note.length<5)return;
  setBusy(true);setError('');setNotice('');
  try{
   await reviewFolioPayment(bookingId,paymentId,decision,note);
   if(readSession().hotelId!==hotelId)return;
   setReviewNotes(old=>({...old,[paymentId]:''}));
   setNotice(decision==='confirm'?'Payment evidence staff-confirmed. Independent verification is still required.':'Payment evidence rejected.');
   void refresh();
  }catch(e){if(readSession().hotelId===hotelId)setError(e instanceof Error?e.message:'Review could not be saved.');}
  finally{setBusy(false);}
 };
 if(!manager||signed)return null;
 return <section className="billing-actions" aria-label="Manager folio actions">
  <div className="billing-section-heading"><h3>Charges and credits</h3>
   <p>Add a charge or correct the guest account. Use Record guest payment above for cash and bank transfers.</p></div>
  <div className="billing-action-tabs"><span><ClipboardPlus size={16}/> Add a charge or credit</span></div>
  <div className="billing-action-form">
    <label>Adjustment type
     <select className="wizard-input" value={kind} disabled={busy}
      onChange={e=>{setKind(e.target.value as 'debit'|'credit');change();}}>
      <option value="debit">Additional charge</option><option value="credit">Credit / correction</option>
     </select>
    </label>
    <label>Reason for the adjustment
     <textarea className="wizard-input" rows={2} value={reason} maxLength={500} disabled={busy}
      onChange={e=>{setReason(e.target.value);change();}} placeholder="Explain what changed and why"/>
    </label>
   <label>Amount ({ledger.data?.data.summary.currency==='PHP'?'PHP':'hotel currency'})
    <input className="wizard-input" type="text" inputMode="decimal" value={amount} disabled={busy}
     placeholder="0.00" onChange={e=>{setAmount(e.target.value);change();}}/>
   </label>
   {parsedAmount!==null&&<p className="billing-conversion">To record: {formatBillingMoney(parsedAmount,ledger.data?.data.summary.currency??'PHP')}</p>}
   <label className="billing-confirm"><input type="checkbox" checked={confirm} disabled={busy}
    onChange={e=>setConfirm(e.target.checked)}/>
    I checked the amount, reservation, and supporting evidence. I understand this will create a financial record.
   </label>
   <button type="button" className="btn-primary" disabled={!canWrite||!parsedAmount||!confirm||reason.trim().length<3}
    onClick={()=>void submit()}>{busy?'Saving…':'Save charge or credit'}</button>
  </div>
  <div className="billing-review-list">
   <h4>Pending payment evidence review</h4>
   <QueryFeedback loading={ledger.isPending} error={ledger.error} onRetry={()=>void ledger.refetch()}/>
   {ledger.data?.data.payments.filter(p=>p.status==='pending_review').map(p=><div className="billing-review-item" key={p.id}>
    <div><strong>Payment #{p.id} · {p.method==='bank_transfer'?'Bank transfer':'Cash'}</strong>
     <span>{p.reference} · {formatBillingMoney(p.amountMinor,ledger.data!.data.summary.currency)}</span></div>
    {p.method==='bank_transfer'&&p.recordedBy===user?.id&&<p className="billing-advisory">
     Another administrator must independently confirm the bank-transfer record you created.</p>}
    <label>Review note
     <textarea className="wizard-input" rows={2} maxLength={500}
      value={reviewNotes[p.id]??''} disabled={busy}
      onChange={e=>setReviewNotes(old=>({...old,[p.id]:e.target.value}))}/>
    </label>
    <div className="billing-review-actions">
     <button type="button" className="btn-primary" disabled={!canWrite||
      (reviewNotes[p.id]?.trim().length??0)<5||(p.method==='bank_transfer'&&p.recordedBy===user?.id)}
      onClick={()=>void review(p.id,'confirm')}><ShieldCheck size={15}/> Confirm evidence</button>
     <button type="button" className="btn-inline" disabled={!canWrite||(reviewNotes[p.id]?.trim().length??0)<5}
      onClick={()=>void review(p.id,'reject')}>Reject evidence</button>
    </div>
   </div>)}
   {ledger.isSuccess&&ledger.data.data.payments.every(p=>p.status!=='pending_review')&&
    <p className="billing-reviewed"><CheckCircle2 size={16}/> No payment records are awaiting staff review.</p>}
  </div>
  {notice&&<p role="status" className="stay-feedback-success"><CheckCircle2 size={16}/>{notice}</p>}
  {error&&<p role="alert" className="stay-feedback-error"><AlertTriangle size={16}/>{error} Check the folio before retrying if the outcome is unclear.</p>}
 </section>;
}
