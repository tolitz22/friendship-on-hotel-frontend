import {useRef,useState} from 'react';
import {useQueryClient} from '@tanstack/react-query';
import {useEmployeeClaims,useEmployeeClaim,submitEmployeeClaim,reviewEmployeeClaim,payEmployeeClaim} from '../api/employeeReimbursements';
import type {EmployeeClaim,ClaimInput,ReviewInput,ReimbursementInput} from '../api/employeeReimbursements';
import {useCurrentCashierShift} from '../api/cashierShifts';
import {expenseDepartments} from '../api/expenses';
import {ApiError} from '../api/http';
import {Panel,Status} from './ui';
import {QueryFeedback} from './QueryFeedback';
import {readableDate,statusLabel} from '../lib/format';
import {hotelToday} from '../features/reservations/calendarDate';
const money=(n:number)=>new Intl.NumberFormat('en-PH',{style:'currency',currency:'PHP'}).format(n/100);
const minor=(s:string)=>/^\d+(\.\d{1,2})?$/.test(s)&&Number(s)<=1e9?Math.round(Number(s)*100):0;
type Mode='submit'|'review'|'pay';
type Payload=ClaimInput|ReviewInput|ReimbursementInput;
function ClaimDialog({hotel,userId,mode,claim,onClose,onSaved}:{hotel:string;userId:string;mode:Mode;claim?:EmployeeClaim;onClose:()=>void;onSaved:(id:string)=>void}){
 const key='foh.reimbursement.pending.'+hotel+'.'+userId+'.'+mode+'.'+(claim?.id??'new');
 const [pending,setPending]=useState<Payload|null>(()=>{try{return JSON.parse(sessionStorage.getItem(key)??'null');}catch{return null;}});
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 const guard=useRef(false);
 const [merchant,setMerchant]=useState(''),[description,setDescription]=useState(''),[category,setCategory]=useState(''),[receipt,setReceipt]=useState('');
 const [department,setDepartment]=useState<ClaimInput['department']>('rooms');
 const [date,setDate]=useState(hotelToday()),[amount,setAmount]=useState('');
 const [decision,setDecision]=useState<ReviewInput['decision']>('approve'),[note,setNote]=useState('');
 const [source,setSource]=useState<ReimbursementInput['paymentSource']>('hotel_bank'),[evidence,setEvidence]=useState(''),[confirmed,setConfirmed]=useState(false);
 const shift=useCurrentCashierShift(mode==='pay'&&source==='cashier_drawer');
 const ownShift=shift.data?.cashierId===userId&&shift.data.currency==='PHP'?shift.data:null;
 const valid=mode==='submit'?!!merchant.trim()&&!!description.trim()&&!!category.trim()&&!!receipt.trim()&&!!date&&date<=hotelToday()&&minor(amount)>0:
 mode==='review'?note.trim().length>=5:!!claim&&minor(amount)>0&&minor(amount)<=claim.outstandingMinor&&!!evidence.trim()&&confirmed&&(source==='hotel_bank'||!!ownShift);
 const title=mode==='submit'?'Submit expense claim':mode==='review'?'Review expense claim':'Record reimbursement';
 async function submit(){
  if(guard.current||(!pending&&!valid))return;
  const requestKey=crypto.randomUUID();
  const payload:Payload=pending??(mode==='submit'?{requestKey,merchant:merchant.trim(),description:description.trim(),category:category.trim(),department,receiptReference:receipt.trim(),serviceDate:date,amountMinor:minor(amount)}:mode==='review'?{requestKey,decision,note:note.trim()}:{requestKey,amountMinor:minor(amount),paymentSource:source,evidenceReference:evidence.trim(),...(source==='cashier_drawer'?{shiftId:ownShift?.id}:{})});
  guard.current=true;setBusy(true);setError('');
  try{
   sessionStorage.setItem(key,JSON.stringify(payload));setPending(payload);
   const result=mode==='submit'?await submitEmployeeClaim(hotel,payload as ClaimInput):mode==='review'?await reviewEmployeeClaim(hotel,claim!.id,payload as ReviewInput):await payEmployeeClaim(hotel,claim!.id,payload as ReimbursementInput);
   sessionStorage.removeItem(key);setPending(null);onSaved(result.claimId);
  }catch(e){if(!pending&&e instanceof ApiError&&[400,403,404,422].includes(e.status)){sessionStorage.removeItem(key);setPending(null);}setError(e instanceof Error?e.message:'Transaction confirmation unavailable.');}
  finally{guard.current=false;setBusy(false);}
 }
 return <div className="billing-modal-backdrop"><section role="dialog" aria-modal="true" aria-label={title} className="billing-action-modal expense-payout-dialog"><h3>{title}</h3>{claim&&<p>{claim.employeeName} · {claim.description} · {money(claim.amountMinor)}</p>}
 <form className="cash-shift-close-form" onSubmit={e=>{e.preventDefault();void submit();}}>
 {pending?<div className="notice">Earlier transaction requires confirmation. Retry the original details. {'amountMinor' in pending?money(pending.amountMinor):statusLabel(pending.decision)}</div>:<fieldset disabled={busy} className="cash-shift-close-form">
 {mode==='submit'&&<>
 <label>Merchant<input className="wizard-input" maxLength={160} value={merchant} onChange={e=>setMerchant(e.target.value)}/></label>
 <label>Description<input className="wizard-input" maxLength={255} value={description} onChange={e=>setDescription(e.target.value)}/></label>
 <label>Department<select className="wizard-input" value={department} onChange={e=>setDepartment(e.target.value as ClaimInput['department'])}>{expenseDepartments.map(d=><option key={d} value={d}>{statusLabel(d)}</option>)}</select></label>
 <label>Category<input className="wizard-input" maxLength={64} value={category} onChange={e=>setCategory(e.target.value)}/></label>
 <label>Receipt reference<input className="wizard-input" maxLength={160} value={receipt} onChange={e=>setReceipt(e.target.value)}/></label>
 <label>Expense date<input type="date" className="wizard-input" max={hotelToday()} value={date} onChange={e=>setDate(e.target.value)}/></label>
 <p className="desk-muted">Only submit expenses personally paid for hotel operations. No cash or journal movement occurs until review.</p></>}
 {mode==='review'&&<><label>Decision<select className="wizard-input" value={decision} onChange={e=>setDecision(e.target.value as ReviewInput['decision'])}><option value="approve">Approve</option><option value="reject">Reject</option></select></label><label>Review note<textarea className="wizard-input" maxLength={500} value={note} onChange={e=>setNote(e.target.value)}/></label><p className="desk-muted">Approval recognizes an expense and employee payable. Check the original receipt first.</p></>}
 {mode!=='review'&&<label>Amount (PHP)<input className="wizard-input" inputMode="decimal" value={amount} onChange={e=>setAmount(e.target.value)}/></label>}
 {mode==='pay'&&<><p>Outstanding: {money(claim!.outstandingMinor)}</p><label>Payment source<select className="wizard-input" value={source} onChange={e=>setSource(e.target.value as ReimbursementInput['paymentSource'])}><option value="hotel_bank">Hotel bank</option><option value="cashier_drawer">Cashier drawer</option></select></label>{source==='cashier_drawer'&&<p>{ownShift?'Your open cashier shift will be used.':'An open cashier shift belonging to you is required.'}</p>}<label>Payment evidence reference<input className="wizard-input" maxLength={160} value={evidence} onChange={e=>setEvidence(e.target.value)}/></label><label><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/> Payment has already been made.</label></>}
 </fieldset>}
 {error&&<p role="alert" className="auth-error">{error}</p>}
 <div className="cash-shift-close-buttons"><button className="btn-primary" disabled={busy||(!pending&&!valid)} type="submit">{busy?'Saving…':pending?'Retry original transaction':title}</button><button className="btn-inline" type="button" disabled={busy} onClick={onClose}>{pending?'Close (retry saved)':'Cancel'}</button></div>
 </form></section></div>;
}
export function EmployeeReimbursements({hotel,userId,admin,canSubmit}:{hotel:string;userId:string;admin:boolean;canSubmit:boolean}){
 const [page,setPage]=useState(1),[selected,setSelected]=useState<string|null>(null),[mode,setMode]=useState<Mode|null>(null),[message,setMessage]=useState('');
 const list=useEmployeeClaims(hotel,page),detail=useEmployeeClaim(hotel,selected),client=useQueryClient();
 const enabled=list.isSuccess&&list.data.postingEnabled;
 const claim=detail.data;
 function saved(id:string){setMode(null);setSelected(id);setMessage('Transaction recorded.');for(const k of ['employee-claims','employee-claim','cashier-shifts','cashier-shift-detail','cashier-shift-history','current-cashier-shift','night-audit-reconciliation','employee-liability'])void client.invalidateQueries({queryKey:['live',k,hotel]});}
 function pending(m:Mode,id:string){try{return !!sessionStorage.getItem('foh.reimbursement.pending.'+hotel+'.'+userId+'.'+m+'.'+id);}catch{return false;}}
 return <>
 {message&&<p role="status">{message}</p>}
 <Panel title={admin?'Employee reimbursements':'My expense claims'} action={enabled&&canSubmit?<button className="btn-primary" onClick={()=>setMode('submit')}>Submit expense claim</button>:undefined}>
 <p className="desk-muted">Track personally paid hotel expenses from submission through independent approval and reimbursement.</p>
 {list.data&&!enabled&&<p className="notice">Reimbursement posting is not enabled.</p>}
 <QueryFeedback loading={list.isPending} error={list.error} onRetry={()=>void list.refetch()}/>
 {list.data?.data.length===0&&<p>No claims yet.</p>}
 {!!list.data?.data.length&&<div className="table-scroll"><table><thead><tr><th>Employee / expense</th><th>Claimed</th><th>Outstanding</th><th>Status</th><th>Action</th></tr></thead><tbody>{list.data.data.map(c=><tr key={c.id}><td><strong>{c.employeeName}</strong><small className="expense-payee">{c.description}</small></td><td>{money(c.amountMinor)}</td><td>{money(c.outstandingMinor)}</td><td><Status value={statusLabel(c.status)}/></td><td><button className="btn-inline" onClick={()=>{setMode(null);setSelected(c.id);}}>View claim</button></td></tr>)}</tbody></table></div>}
 {list.data&&<div className="desk-tools"><button className="btn-inline" disabled={page<=1} onClick={()=>setPage(p=>p-1)}>Previous</button><span>Page {page} of {Math.max(1,list.data.meta.totalPages)}</span><button className="btn-inline" disabled={page>=list.data.meta.totalPages} onClick={()=>setPage(p=>p+1)}>Next</button></div>}
 </Panel>
 {selected&&<Panel title="Claim details" action={<button className="btn-inline" onClick={()=>{setMode(null);setSelected(null);}}>Close details</button>}>
 <QueryFeedback loading={detail.isPending} error={detail.error} onRetry={()=>void detail.refetch()}/>
 {claim&&<><h3>{claim.description}</h3><dl className="expense-detail-grid"><div><dt>Employee</dt><dd>{claim.employeeName}</dd></div><div><dt>Merchant</dt><dd>{claim.merchant}</dd></div><div><dt>Receipt</dt><dd>{claim.receiptReference}</dd></div><div><dt>Expense date</dt><dd>{readableDate(claim.serviceDate)}</dd></div><div><dt>Claimed</dt><dd>{money(claim.amountMinor)}</dd></div><div><dt>Paid</dt><dd>{money(claim.paidMinor)}</dd></div><div><dt>Outstanding</dt><dd>{money(claim.outstandingMinor)}</dd></div><div><dt>Status</dt><dd>{statusLabel(claim.status)}</dd></div></dl>
 {claim.reviewNote&&<p>Review: {claim.reviewNote}</p>}
 {enabled&&admin&&claim.employeeId!==userId&&<div className="desk-tools">{(claim.status==='pending'||pending('review',claim.id))&&<button className="btn-primary" onClick={()=>setMode('review')}>Review claim</button>}{(claim.outstandingMinor>0||pending('pay',claim.id))&&<button className="btn-primary" onClick={()=>setMode('pay')}>Record reimbursement</button>}</div>}
 <h4>Payment history</h4>{claim.payments.length===0&&<p>No payments recorded.</p>}{claim.payments.map(p=><p key={p.id}>{money(p.amountMinor)} · {statusLabel(p.paymentSource)} · {readableDate(p.businessDate)} · {p.evidenceReference}</p>)}</>}
 </Panel>}
 {mode&&enabled&&(mode==='submit'||claim)&&<ClaimDialog key={mode+':'+(claim?.id??'new')} hotel={hotel} userId={userId} mode={mode} claim={mode==='submit'?undefined:claim} onClose={()=>setMode(null)} onSaved={saved}/>}
 </>;
}
