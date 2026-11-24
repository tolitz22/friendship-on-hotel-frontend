import {useRef,useState} from 'react';
import {useQueryClient} from '@tanstack/react-query';
import {Link} from '@tanstack/react-router';
import {X} from 'lucide-react';
import {useExpenseHistory,requestCorrection,decideCorrection,reviewCashReturn} from '../api/expenseCorrections';
import type {CorrectionInput} from '../api/expenseCorrections';
import type {Expense} from '../api/expenses';
import {expenseDepartments} from '../api/expenses';
import {QueryFeedback} from './QueryFeedback';
import {readableDateTime,readableDate,statusLabel} from '../lib/format';

const money=(n:number)=>new Intl.NumberFormat('en-PH',{style:'currency',currency:'PHP'}).format(n/100);
type Action={kind:'request'}|{kind:'correction';id:string}|{kind:'return';id:string};
function ActionDialog({hotel,expense,userId,action,onClose,onSaved}:{hotel:string;expense:Expense;userId:string;action:Action;onClose:()=>void;onSaved:()=>void}){
 const [kind,setKind]=useState<CorrectionInput['kind']>('amount_correction');
 const [amount,setAmount]=useState((expense.amountMinor/100).toFixed(2));
 const [department,setDepartment]=useState(expense.department);
 const [category,setCategory]=useState(expense.category);
 const [decision,setDecision]=useState('approve');
 const [note,setNote]=useState('');
 const storageKey='foh.correction.pending.'+hotel+'.'+userId+'.'+expense.id;
 const [pending,setPending]=useState<CorrectionInput|null>(()=>{try{const raw=sessionStorage.getItem(storageKey);return action.kind==='request'&&raw?JSON.parse(raw):null;}catch{return null;}});
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const guard=useRef(false);
 const valid=!!pending||note.trim().length>=5&&(action.kind!=='request'||(kind==='amount_correction'
 ? /^\d+(\.\d{1,2})?$/.test(amount)&&Number(amount)<=1_000_000_000&&Math.round(Number(amount)*100)!==expense.amountMinor
 : !!category.trim()&&(department!==expense.department||category.trim()!==expense.category)));
 async function submit(){
  if(guard.current||!valid)return;guard.current=true;setBusy(true);setError('');
  try{
   if(action.kind==='request'){
    const payload:CorrectionInput=pending??(kind==='amount_correction'
     ?{requestKey:crypto.randomUUID(),reason:note.trim(),kind,correctedAmountMinor:Math.round(Number(amount)*100)}
     :{requestKey:crypto.randomUUID(),reason:note.trim(),kind,correctedDepartment:department,correctedCategory:category.trim()});
    sessionStorage.setItem(storageKey,JSON.stringify(payload));setPending(payload);
    await requestCorrection(hotel,expense.id,payload);sessionStorage.removeItem(storageKey);
   }else if(action.kind==='correction')await decideCorrection(hotel,action.id,decision==='reject'?'reject':'approve',note.trim());
   else await reviewCashReturn(hotel,action.id,decision==='flag'?'flag':'approve',note.trim());
   onSaved();
  }catch(e){setError(e instanceof Error?e.message:'Outcome could not be confirmed. Reload the voucher before retrying.');}
  finally{guard.current=false;setBusy(false);}
 }
 const title=action.kind==='request'?'Request expense correction':action.kind==='correction'?'Decide correction':'Review cash return';
 return <div className="billing-modal-backdrop"><section role="dialog" aria-modal="true" aria-label={title} className="billing-action-modal expense-payout-dialog">
  <div className="billing-action-modal-header"><div><h3>{title}</h3><p>Voucher #{expense.id} · {expense.description}</p></div><button type="button" className="billing-modal-dismiss" aria-label="Close correction dialog" disabled={busy} onClick={onClose}><X size={20}/></button></div>
  <form className="cash-shift-close-form" onSubmit={e=>{e.preventDefault();void submit();}}>
   {pending?<div className="notice">An earlier request needs confirmation. Retry its original details: {pending.kind==='amount_correction'?money(pending.correctedAmountMinor):pending.correctedDepartment+' / '+pending.correctedCategory}. Reason: {pending.reason}</div>:<>
   {action.kind==='request'?<>
    <label>Correction type<select className="wizard-input" value={kind} disabled={busy} onChange={e=>setKind(e.target.value==='reclassification'?'reclassification':'amount_correction')}><option value="amount_correction">Correct amount</option><option value="reclassification">Correct department / category</option></select></label>
    {kind==='amount_correction'?<><p>Original amount: {money(expense.amountMinor)}</p><label>Correct amount (PHP)<input className="wizard-input" inputMode="decimal" value={amount} disabled={busy} onChange={e=>setAmount(e.target.value)}/></label></>:<>
     <label>Department<select className="wizard-input" value={department} disabled={busy} onChange={e=>setDepartment(e.target.value as Expense['department'])}>{expenseDepartments.map(d=><option key={d} value={d}>{statusLabel(d)}</option>)}</select></label>
     <label>Category<input className="wizard-input" maxLength={64} value={category} disabled={busy} onChange={e=>setCategory(e.target.value)}/></label></>}
   </>:<label>Decision<select className="wizard-input" value={decision} disabled={busy} onChange={e=>setDecision(e.target.value)}><option value="approve">Approve</option>{action.kind==='correction'?<option value="reject">Reject</option>:<option value="flag">Flag for investigation</option>}</select></label>}
   <label>{action.kind==='request'?'Reason for correction':'Independent review note'}<textarea className="wizard-input" rows={3} maxLength={500} value={note} disabled={busy} onChange={e=>setNote(e.target.value)} required/></label></>}
   <p className="desk-muted">A correction does not change the historical drawer count or imply cash has been returned.</p>
   {error&&<p role="alert" className="auth-error">{error}</p>}
   <div className="cash-shift-close-buttons"><button type="submit" className="btn-primary" disabled={busy||!valid}>{busy?'Saving…':pending?'Retry original request':action.kind==='request'?'Submit correction':'Save decision'}</button><button type="button" className="btn-inline" disabled={busy} onClick={onClose}>Close</button></div>
  </form>
 </section></div>;
}
export function ExpenseCorrectionHistory({hotel,expense,userId}:{hotel:string;expense:Expense;userId:string}){
 const history=useExpenseHistory(hotel,expense.id);
 const client=useQueryClient();
 const [action,setAction]=useState<Action|null>(null);
 const [message,setMessage]=useState('');
 const data=history.data;
 function saved(){
  setAction(null);setMessage('Voucher transaction saved.');
  for(const key of ['expense-history','expense-detail','expenses','cashier-shifts','cashier-shift-detail','current-cashier-shift','cashier-shift-history'])
   void client.invalidateQueries({queryKey:['live',key,hotel]});
 }
 return <section className="expense-correction-history">
  <h3>Corrections and cash returns</h3>
  <QueryFeedback loading={history.isPending} error={history.error} onRetry={()=>void history.refetch()}/>
  {message&&<p role="status">{message}</p>}
  {data&&<>
   <dl className="expense-detail-grid"><div><dt>Original expense</dt><dd>{money(data.originalAmountMinor)}</dd></div><div><dt>Net recorded expense</dt><dd>{money(data.netRecordedExpenseMinor)}</dd></div><div><dt>Physical cash returned</dt><dd>{money(data.cashReturnedMinor)}</dd></div><div><dt>Outstanding clearing balance</dt><dd>{money(data.clearingBalanceMinor)}</dd></div><div><dt>Effective classification</dt><dd>{statusLabel(data.effectiveDepartment)} / {statusLabel(data.effectiveCategory)}</dd></div></dl>
   {data.clearingBalanceMinor!==0&&<p className="notice">Clearing balance requires investigation; no unrecorded cash movement is assumed.</p>}
   {data.unapprovedCashReturnCount>0&&<p className="notice">{data.unapprovedCashReturnCount} cash return(s) need independent review or investigation.</p>}
   {!data.correctionsEnabled&&<p className="desk-muted">New corrections and cash returns are not enabled for this deployment.</p>}
   {data.correctionsEnabled&&!data.corrections.some(c=>c.decision!=='reject')&&<button type="button" className="btn-inline" onClick={()=>setAction({kind:'request'})}>Request correction</button>}
   {!data.corrections.length&&!data.cashReturns.length&&<p className="desk-muted">No correction or cash-return transactions recorded.</p>}
   {data.corrections.map(c=><article className="readable-audit-event" key={c.id}>
    <strong>{statusLabel(c.kind)} · {c.decision?statusLabel(c.decision):'Awaiting decision'}</strong>
    <p>{c.requestedByName??'Staff name unavailable'} · {readableDateTime(c.createdAt)}</p>
    <p>{c.reason}</p><p>{c.kind==='amount_correction'&&c.correctedAmountMinor!==null?money(c.correctedAmountMinor):statusLabel(c.correctedDepartment??'')+' / '+statusLabel(c.correctedCategory??'')}</p>
    {c.decision?<p>Reviewed by {c.reviewedByName??'Manager'} · {c.note}{c.adjustmentBusinessDate?' · Posted '+readableDate(c.adjustmentBusinessDate):''}</p>
     :data.correctionsEnabled&&(c.requestedBy===userId||expense.recordedBy===userId?<p>Another administrator must decide this correction.</p>:<button type="button" className="btn-primary" onClick={()=>setAction({kind:'correction',id:c.id})}>Decide correction</button>)}
   </article>)}
   {data.cashReturns.map(r=><article className="readable-audit-event" key={r.id}>
    <strong>Cash returned · {money(r.amountMinor)} · {r.decision?statusLabel(r.decision):'Awaiting review'}</strong>
    <p>{r.recordedByName??'Staff name unavailable'} · {readableDateTime(r.createdAt)}</p><p>{r.reason} · Evidence: {r.evidenceReference}</p>
    <Link to="/cashier-shifts" search={{shift:r.shiftId,hotel}}>View receiving drawer</Link>
    {r.decision?<p>Reviewed by {r.reviewedByName??'Manager'} · {r.note}</p>:data.correctionsEnabled&&(r.recordedBy===userId?<p>Another administrator must review this return.</p>:<button type="button" className="btn-primary" onClick={()=>setAction({kind:'return',id:r.id})}>Review cash return</button>)}
   </article>)}
   {action&&data.correctionsEnabled&&<ActionDialog hotel={hotel} expense={expense} userId={userId} action={action} onClose={()=>setAction(null)} onSaved={saved}/>}
  </>}
 </section>;
}
