import {useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {X} from 'lucide-react';
import {reviewExpense,updateExpensePolicy} from '../api/expenses';
import type {Expense} from '../api/expenses';
import {readableDate} from '../lib/format';

const money=(n:number)=>new Intl.NumberFormat('en-PH',{style:'currency',currency:'PHP'}).format(n/100);
export function ExpenseReviewDialog({hotel,expense,onClose,onSaved}:{hotel:string;expense:Expense;onClose:()=>void;onSaved:()=>void}){
 const [completed,setCompleted]=useState(false);
 const [decision,setDecision]=useState<'approve'|'flag'>('approve');
 const [note,setNote]=useState('');
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const guard=useRef(false);
 async function submit(){
  if(guard.current||note.trim().length<5)return;
  guard.current=true;setBusy(true);setError('');
  try{await reviewExpense(hotel,expense.id,decision,note.trim());setCompleted(true);onSaved();}
  catch(e){setError(e instanceof Error?e.message:'Review could not be confirmed. Reload the voucher before retrying.');}
  finally{guard.current=false;setBusy(false);}
 }
 if(completed)return null;
 return createPortal(<div className="billing-modal-backdrop"><section role="dialog" aria-modal="true" aria-label="Review expense" className="billing-action-modal expense-payout-dialog">
  <div className="billing-action-modal-header"><div><span className="rr-eyebrow">VOUCHER #{expense.id}</span><h3>Review expense</h3><p>{expense.description} · {money(expense.amountMinor)}</p></div><button type="button" className="billing-modal-dismiss" disabled={busy} onClick={onClose} aria-label="Close review"><X size={20}/></button></div>
  <dl className="expense-detail-grid"><div><dt>Payee</dt><dd>{expense.payee}</dd></div><div><dt>Recorded by</dt><dd>{expense.recordedByName??'Name unavailable'}</dd></div><div><dt>Business date</dt><dd>{readableDate(expense.businessDate)}</dd></div><div><dt>Invoice</dt><dd>{expense.invoiceReference??'Not recorded'}</dd></div></dl>
  <form onSubmit={e=>{e.preventDefault();void submit();}} className="cash-shift-close-form">
   <label>Decision<select className="wizard-input" disabled={busy} value={decision} onChange={e=>setDecision(e.target.value==='flag'?'flag':'approve')}><option value="approve">Approve expense</option><option value="flag">Flag for investigation</option></select></label>
   <label>Review note<textarea autoFocus className="wizard-input" rows={3} maxLength={500} required value={note} disabled={busy} onChange={e=>setNote(e.target.value)} placeholder="What did you verify, or why is investigation needed?"/></label>
   <p className="desk-muted">This decision does not change the cash already paid out or reverse its accounting journal.</p>
   {error&&<p role="alert" className="auth-error">{error}</p>}
   <div className="cash-shift-close-buttons"><button type="submit" className="btn-primary" disabled={busy||note.trim().length<5}>{busy?'Saving…':decision==='approve'?'Approve expense':'Flag expense'}</button><button type="button" className="btn-inline" disabled={busy} onClick={onClose}>Cancel</button></div>
  </form>
 </section></div>,document.body);
}
export function ExpensePolicyDialog({hotel,currentLimit,onClose,onSaved}:{hotel:string;currentLimit:number|null;onClose:()=>void;onSaved:()=>void}){
 const [limit,setLimit]=useState(currentLimit===null?'':(currentLimit/100).toFixed(2));
 const [reason,setReason]=useState('');
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const guard=useRef(false);
 const valid=/^\d+(\.\d{1,2})?$/.test(limit)&&Number(limit)<=1_000_000_000&&reason.trim().length>=5;
 async function submit(){
  if(guard.current||!valid)return;
  guard.current=true;setBusy(true);setError('');
  try{await updateExpensePolicy(hotel,Math.round(Number(limit)*100),reason.trim());onSaved();}
  catch(e){setError(e instanceof Error?e.message:'Policy update could not be confirmed. Reload the policy before retrying.');}
  finally{guard.current=false;setBusy(false);}
 }
 return <div className="billing-modal-backdrop"><section role="dialog" aria-modal="true" aria-label="Expense policy" className="billing-action-modal expense-payout-dialog">
  <div className="billing-action-modal-header"><div><h3>Expense policy</h3><p>Configure the per-payout limit for routine cash expenses.</p></div><button type="button" className="billing-modal-dismiss" disabled={busy} onClick={onClose} aria-label="Close policy"><X size={20}/></button></div>
  <p>Current limit: <strong>{currentLimit===null?'Not configured':money(currentLimit)}</strong></p>
  <form className="cash-shift-close-form" onSubmit={e=>{e.preventDefault();void submit();}}>
   <label>Routine limit (PHP)<input autoFocus className="wizard-input" inputMode="decimal" required value={limit} disabled={busy} onChange={e=>setLimit(e.target.value)} placeholder="0.00"/></label>
   <p className="desk-muted">Expenses at or below this amount do not need individual approval. Set zero to require review for every payout. Changes apply only to new expenses.</p>
   <label>Reason for change<textarea className="wizard-input" rows={3} maxLength={500} required value={reason} disabled={busy} onChange={e=>setReason(e.target.value)}/></label>
   {error&&<p role="alert" className="auth-error">{error}</p>}
   <div className="cash-shift-close-buttons"><button type="submit" className="btn-primary" disabled={busy||!valid}>{busy?'Saving…':'Save policy'}</button><button type="button" className="btn-inline" disabled={busy} onClick={onClose}>Cancel</button></div>
  </form>
 </section></div>;
}
