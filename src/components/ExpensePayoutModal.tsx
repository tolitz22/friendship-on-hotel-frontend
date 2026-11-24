import {useRef,useState} from 'react';
import {X} from 'lucide-react';
import {ApiError} from '../api/http';
import {recordExpensePayout,expenseDepartments} from '../api/expenses';
import type {ExpenseInput} from '../api/expenses';

const labels={rooms:'Rooms',maintenance:'Property operations & maintenance',administration:'Administration',utilities:'Energy, water & waste',food_beverage:'Food & beverage'};
const categories=['cleaning_supplies','laundry','repair_materials','office_supplies','utilities','other'];
const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Manila',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
type Draft={amount:string;payee:string;description:string;department:ExpenseInput['department'];category:string;serviceDate:string;invoiceReference:string};
const initial=():Draft=>({amount:'',payee:'',description:'',department:'rooms',category:'cleaning_supplies',serviceDate:today(),invoiceReference:''});
export function ExpensePayoutModal({hotel,shift,userId,onClose,onSuccess}:{hotel:string;shift:string;userId:string;onClose:()=>void;onSuccess:(id:string)=>void}){
 const storageKey='foh.expense.pending.'+hotel+'.'+shift+'.'+userId;
 const [saved]=useState<ExpenseInput|null>(()=>{try{const raw=sessionStorage.getItem(storageKey);return raw?JSON.parse(raw) as ExpenseInput:null;}catch{return null;}});
 const [draft,setDraft]=useState<Draft>(()=>saved?{amount:(saved.amountMinor/100).toFixed(2),payee:saved.payee,description:saved.description,department:saved.department,category:saved.category,serviceDate:saved.serviceDate,invoiceReference:saved.invoiceReference??''}:initial());
 const [pending,setPending]=useState<ExpenseInput|null>(saved);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const guard=useRef(false);
 const confirmed=useRef(false);
 const valid=/^\d+(\.\d{1,2})?$/.test(draft.amount)&&Number(draft.amount)>0&&Number(draft.amount)<=1_000_000_000&&!!draft.payee.trim()&&!!draft.description.trim()&&!!draft.serviceDate;
 const change=<K extends keyof Draft>(key:K,value:Draft[K])=>setDraft(d=>({...d,[key]:value}));
 async function submit(){
  if(guard.current||confirmed.current||(!pending&&!valid))return;
  guard.current=true;setBusy(true);setError('');
  try{
   const payload=pending??{requestKey:crypto.randomUUID(),amountMinor:Math.round(Number(draft.amount)*100),payee:draft.payee.trim(),description:draft.description.trim(),department:draft.department,category:draft.category,serviceDate:draft.serviceDate,...(draft.invoiceReference.trim()?{invoiceReference:draft.invoiceReference.trim()}: {})};
   // Persist before transmitting. If storage is unavailable, do not risk losing a retry key.
   sessionStorage.setItem(storageKey,JSON.stringify(payload));setPending(payload);
   const result=await recordExpensePayout(hotel,shift,payload);
   confirmed.current=true;
   sessionStorage.removeItem(storageKey);
   onSuccess(result.expenseId);
  }catch(e){
   // Only a validation response proves the attempted payload did not post.
   if(e instanceof ApiError&&e.status===422&&!pending){try{sessionStorage.removeItem(storageKey);setPending(null);}catch{/* retain recovery */}}
   setError(e instanceof Error?e.message:'Unable to confirm payout. Retry the original request.');
  }finally{guard.current=false;setBusy(false);}
 }
 return <div className="billing-modal-backdrop"><section role="dialog" aria-modal="true" aria-label="Record cash paid out" className="billing-action-modal expense-payout-dialog">
  <div className="billing-action-modal-header"><div><span className="rr-eyebrow">SHIFT #{shift}</span><h3>Record cash paid out</h3><p>Record money already taken from your drawer for a hotel purchase.</p></div><button type="button" className="billing-modal-dismiss" aria-label="Close payout form" disabled={busy} onClick={onClose}><X size={20}/></button></div>
  {pending&&<div className="notice">An earlier submission needs confirmation. Retry the same request; do not record another payout for this purchase.</div>}
  <form onSubmit={e=>{e.preventDefault();void submit();}}>
   <fieldset disabled={busy||!!pending} className="expense-payout-fields">
    <label>Amount (PHP)<input autoFocus className="wizard-input" inputMode="decimal" value={draft.amount} onChange={e=>change('amount',e.target.value)} placeholder="0.00" required/></label>
    <label>Payee<input className="wizard-input" value={draft.payee} maxLength={160} onChange={e=>change('payee',e.target.value)} required/></label>
    <label>Department<select className="wizard-input" value={draft.department} onChange={e=>change('department',e.target.value as Draft['department'])}>{expenseDepartments.map(d=><option key={d} value={d}>{labels[d]}</option>)}</select></label>
    <label>Category<select className="wizard-input" value={draft.category} onChange={e=>change('category',e.target.value)}>{categories.map(c=><option key={c} value={c}>{c.replaceAll('_',' ').replace(/^./,s=>s.toUpperCase())}</option>)}</select></label>
    <label className="expense-field-wide">Purpose<textarea className="wizard-input" rows={2} maxLength={255} value={draft.description} onChange={e=>change('description',e.target.value)} required/></label>
    <label>Purchase date<input className="wizard-input" type="date" value={draft.serviceDate} onChange={e=>change('serviceDate',e.target.value)} required/></label>
    <label>Supplier invoice (optional)<input className="wizard-input" maxLength={120} value={draft.invoiceReference} onChange={e=>change('invoiceReference',e.target.value)}/></label>
   </fieldset>
   <p className="desk-muted">This reduces expected drawer cash, not guest balances. Expenses above the hotel limit require independent review.</p>
   {error&&<p role="alert" className="auth-error">{error}</p>}
   <div className="cash-shift-close-buttons"><button type="submit" className="btn-primary" disabled={busy||(!pending&&!valid)}>{busy?'Recording…':pending?'Retry original payout':'Record payout'}</button><button type="button" className="btn-inline" disabled={busy} onClick={onClose}>{pending?'Close (retry saved)':'Cancel'}</button></div>
  </form>
 </section></div>;
}
