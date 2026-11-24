import {useRef,useState} from 'react';
import {X} from 'lucide-react';
import {ApiError} from '../api/http';
import {getCashReturnQuote,recordCashReturn} from '../api/expenseCorrections';
import type {CashReturnInput,CashReturnQuote} from '../api/expenseCorrections';

const money=(n:number)=>new Intl.NumberFormat('en-PH',{style:'currency',currency:'PHP'}).format(n/100);
type Pending={expense:string;input:CashReturnInput};
export function ExpenseCashReturnModal({hotel,shift,userId,onClose,onSaved}:{hotel:string;shift:string;userId:string;onClose:()=>void;onSaved:(id:string)=>void}){
 const storageKey='foh.cash-return.pending.'+hotel+'.'+shift+'.'+userId;
 const [pending,setPending]=useState<Pending|null>(()=>{try{const raw=sessionStorage.getItem(storageKey);return raw?JSON.parse(raw):null;}catch{return null;}});
 const [expense,setExpense]=useState(pending?.expense??'');
 const [quote,setQuote]=useState<CashReturnQuote|null>(null);
 const [amount,setAmount]=useState('');
 const [evidence,setEvidence]=useState('');
 const [reason,setReason]=useState('');
 const [confirmed,setConfirmed]=useState(false);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const guard=useRef(false);
 const validId=/^[1-9]\d*$/.test(expense.trim());
 const minor=Math.round(Number(amount)*100);
 const valid=!!quote&&quote.expenseId===expense.trim()&&!quote.blockedReason&&/^\d+(\.\d{1,2})?$/.test(amount)&&Number.isSafeInteger(minor)&&minor>0&&minor<=quote.maximumReturnMinor&&minor<=100000000000&&!!evidence.trim()&&reason.trim().length>=5&&confirmed;
 async function lookup(){
  if(guard.current||!validId||pending)return;
  guard.current=true;setBusy(true);setError('');setQuote(null);setConfirmed(false);
  try{const result=await getCashReturnQuote(hotel,shift,expense.trim());setQuote(result);setAmount('');}
  catch(e){setError(e instanceof Error?e.message:'Unable to verify voucher.');}
  finally{guard.current=false;setBusy(false);}
 }
 async function submit(){
  if(guard.current||(!pending&&!valid))return;
  guard.current=true;setBusy(true);setError('');
  try{
   const payload:Pending=pending??{expense:expense.trim(),input:{requestKey:crypto.randomUUID(),amountMinor:minor,evidenceReference:evidence.trim(),reason:reason.trim(),...(quote?.correctionId?{correctionId:quote.correctionId}:{})}};
   sessionStorage.setItem(storageKey,JSON.stringify(payload));setPending(payload);
   const result=await recordCashReturn(hotel,shift,payload.expense,payload.input);
   sessionStorage.removeItem(storageKey);onSaved(result.cashReturnId);
  }catch(e){
   if(e instanceof ApiError&&e.status===422&&!pending){try{sessionStorage.removeItem(storageKey);setPending(null);}catch{/* retain recovery */}}
   setError(e instanceof Error?e.message:'Return could not be confirmed. Retry the original request.');
  }finally{guard.current=false;setBusy(false);}
 }
 return <div className="billing-modal-backdrop"><section role="dialog" aria-modal="true" aria-label="Record supplier cash return" className="billing-action-modal expense-payout-dialog">
  <div className="billing-action-modal-header"><div><span className="rr-eyebrow">SHIFT #{shift}</span><h3>Record supplier cash return</h3><p>Record money physically received from a supplier, not a guest payment.</p></div><button type="button" className="billing-modal-dismiss" aria-label="Close cash return" disabled={busy} onClick={onClose}><X size={20}/></button></div>
  <form className="cash-shift-close-form" onSubmit={e=>{e.preventDefault();void submit();}}>
   {pending?<div className="notice"><strong>Previous submission needs confirmation.</strong><p>Voucher #{pending.expense} · {money(pending.input.amountMinor)} · {pending.input.evidenceReference}</p><p>{pending.input.reason}</p>Retry the same request, not a new return.</div>:<>
   <label>Original expense voucher number<input autoFocus className="wizard-input" inputMode="numeric" value={expense} disabled={busy} onChange={e=>{setExpense(e.target.value);setQuote(null);setConfirmed(false);}} placeholder="e.g. 104"/></label>
   <button type="button" className="btn-inline" disabled={busy||!validId} onClick={()=>void lookup()}>Look up voucher</button>
   {quote&&<><div className="notice"><strong>{quote.description}</strong><p>{quote.payee} · Original {money(quote.originalAmountMinor)}</p><p>{quote.correctionId?'Approved correction clearing settlement':'Ordinary supplier refund'} · Maximum {money(quote.maximumReturnMinor)}</p>{quote.blockedReason&&<p>{quote.blockedReason}</p>}</div>
   {quote.maximumReturnMinor>0&&!quote.blockedReason&&<>
    <label>Cash received (PHP)<input className="wizard-input" inputMode="decimal" value={amount} disabled={busy} onChange={e=>{setAmount(e.target.value);setConfirmed(false);}}/></label>
    <label>Supporting evidence reference<input className="wizard-input" maxLength={160} value={evidence} disabled={busy} onChange={e=>setEvidence(e.target.value)} required/></label>
    <label>Reason<textarea className="wizard-input" maxLength={500} rows={2} value={reason} disabled={busy} onChange={e=>setReason(e.target.value)} required/></label>
    <label className="cash-shift-confirm"><input type="checkbox" checked={confirmed} disabled={busy} onChange={e=>setConfirmed(e.target.checked)}/> I physically received this cash into my drawer.</label>
   </>}</>}</>}
   <p className="desk-muted">Cash received increases your drawer balance. Independent review is required; no guest balance changes.</p>
   {error&&<p role="alert" className="auth-error">{error}</p>}
   <div className="cash-shift-close-buttons"><button type="submit" className="btn-primary" disabled={busy||(!pending&&!valid)}>{busy?'Processing…':pending?'Retry original return':'Record cash return'}</button><button type="button" className="btn-inline" disabled={busy} onClick={onClose}>{pending?'Close (retry saved)':'Cancel'}</button></div>
  </form>
 </section></div>;
}
