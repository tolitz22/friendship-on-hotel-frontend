import {useId,useRef,useState} from 'react';
import {useSuppliers} from '../api/suppliers';
import {useCurrentCashierShift} from '../api/cashierShifts';
import {recordSupplierBill,recordSupplierPayment} from '../api/supplierBills';
import type {BillInput,BillPaymentInput,SupplierBill} from '../api/supplierBills';
import {expenseDepartments} from '../api/expenses';
import {ApiError} from '../api/http';
import {statusLabel,readableDate} from '../lib/format';
import {QueryFeedback} from './QueryFeedback';

const money=(n:number)=>new Intl.NumberFormat('en-PH',{style:'currency',currency:'PHP'}).format(n/100);
const minor=(s:string)=>/^\d+(\.\d{1,2})?$/.test(s)&&Number(s)<=1_000_000_000?Math.round(Number(s)*100):0;
function due(date:string,days:number){if(!/^\d{4}-\d{2}-\d{2}$/.test(date))return '';const d=new Date(date+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+days);return Number.isNaN(d.getTime())?'':d.toISOString().slice(0,10);}
function usePending<T>(key:string){
 const [pending,setPending]=useState<T|null>(()=>{try{const raw=sessionStorage.getItem(key);return raw?JSON.parse(raw) as T:null;}catch{return null;}});
 const guard=useRef(false);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 async function send(payload:T,write:(payload:T)=>Promise<void>){
  if(guard.current)return;
  guard.current=true;setBusy(true);setError('');
  try{
   sessionStorage.setItem(key,JSON.stringify(payload));setPending(payload);
   await write(payload);sessionStorage.removeItem(key);setPending(null);
  }catch(e){
   // A first-attempt validation rejection is definitive; never discard an uncertain earlier request.
   if(!pending&&e instanceof ApiError&&[400,403,404,422].includes(e.status)){sessionStorage.removeItem(key);setPending(null);}
   setError(e instanceof Error?e.message:'Unable to confirm transaction. Retry the original details.');
  }finally{guard.current=false;setBusy(false);}
 }
 return {pending,busy,error,send};
}
export function SupplierInvoiceDialog({hotel,userId,businessDate,onClose,onSaved}:{hotel:string;userId:string;businessDate:string;onClose:()=>void;onSaved:(id:string)=>void}){
 const supplierSelectId=useId();
 const tx=usePending<BillInput>('foh.supplier-invoice.pending.'+hotel+'.'+userId);
 const [search,setSearch]=useState('');
 const [page,setPage]=useState(1);
 const suppliers=useSuppliers(hotel,{status:'active',page,search});
 const [supplier,setSupplier]=useState<{id:string;name:string;paymentTermsDays:number}|null>(null);
 const [reference,setReference]=useState('');
 const [description,setDescription]=useState('');
 const [department,setDepartment]=useState<BillInput['department']>('rooms');
 const [category,setCategory]=useState('');
 const [invoiceDate,setInvoiceDate]=useState(businessDate);
 const [serviceDate,setServiceDate]=useState(businessDate);
 const [dueDate,setDueDate]=useState(businessDate);
 const [amount,setAmount]=useState('');
 const [confirmed,setConfirmed]=useState(false);
 const valid=!!supplier&&!!reference.trim()&&!!description.trim()&&!!category.trim()&&!!invoiceDate&&!!serviceDate&&!!dueDate&&invoiceDate<=businessDate&&serviceDate<=businessDate&&dueDate>=invoiceDate&&minor(amount)>0&&confirmed;
 async function submit(){
  if(!tx.pending&&(!valid||!supplier))return;
  const payload=tx.pending??{requestKey:crypto.randomUUID(),supplierId:supplier!.id,invoiceReference:reference.trim(),description:description.trim(),department,category:category.trim(),invoiceDate,serviceDate,dueDate,amountMinor:minor(amount)};
  await tx.send(payload,async input=>{const result=await recordSupplierBill(hotel,input);onSaved(result.billId);});
 }
 return <div className="billing-modal-backdrop"><section role="dialog" aria-modal="true" aria-label="Record supplier bill" className="billing-action-modal expense-payout-dialog">
  <div className="billing-action-modal-header"><div><h3>Record supplier bill</h3><p>Recognize an incurred operating expense, not a payment.</p></div></div>
  <form className="cash-shift-close-form" onSubmit={e=>{e.preventDefault();void submit();}}>
   {tx.pending?<div className="notice">Earlier submission needs confirmation. Retry original invoice {tx.pending.invoiceReference} · {money(tx.pending.amountMinor)} · Supplier #{tx.pending.supplierId}.</div>:<>
   <label>Find supplier<input className="wizard-input" value={search} onChange={e=>{setSearch(e.target.value);setPage(1);}} disabled={tx.busy}/></label>
   <QueryFeedback loading={suppliers.isPending} error={suppliers.error} onRetry={()=>void suppliers.refetch()}/>
   <label htmlFor={supplierSelectId}>Supplier</label>
   <select id={supplierSelectId} className="wizard-input" required disabled={tx.busy} value={supplier?.id??''} onChange={e=>{const s=suppliers.data?.data.find(x=>x.id===e.target.value);if(s){setSupplier(s);setDueDate(due(invoiceDate,s.paymentTermsDays));}else setSupplier(null);}}><option value="">Select active supplier</option>{supplier&&!suppliers.data?.data.some(s=>s.id===supplier.id)&&<option value={supplier.id}>{supplier.name}</option>}{suppliers.data?.data.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select>
   {suppliers.data&&suppliers.data.meta.totalPages>1&&<div className="desk-tools"><button type="button" className="btn-inline" disabled={page<=1||tx.busy} onClick={()=>setPage(p=>p-1)}>Previous suppliers</button><span>Page {page}</span><button type="button" className="btn-inline" disabled={page>=suppliers.data.meta.totalPages||tx.busy} onClick={()=>setPage(p=>p+1)}>Next suppliers</button></div>}
   <label>Invoice reference<input className="wizard-input" required maxLength={120} value={reference} disabled={tx.busy} onChange={e=>setReference(e.target.value)}/></label>
   <label>Description<input className="wizard-input" required maxLength={255} value={description} disabled={tx.busy} onChange={e=>setDescription(e.target.value)}/></label>
   <label>Department<select className="wizard-input" value={department} disabled={tx.busy} onChange={e=>setDepartment(e.target.value as BillInput['department'])}>{expenseDepartments.map(d=><option key={d} value={d}>{statusLabel(d)}</option>)}</select></label>
   <label>Category<input className="wizard-input" required maxLength={64} value={category} disabled={tx.busy} onChange={e=>setCategory(e.target.value)}/></label>
   <label>Invoice date<input type="date" className="wizard-input" required max={businessDate} value={invoiceDate} disabled={tx.busy} onChange={e=>{setInvoiceDate(e.target.value);setDueDate(due(e.target.value,supplier?.paymentTermsDays??0));}}/></label>
   <label>Service date<input type="date" className="wizard-input" required max={businessDate} value={serviceDate} disabled={tx.busy} onChange={e=>setServiceDate(e.target.value)}/></label>
   <label>Due date<input type="date" className="wizard-input" required min={invoiceDate} value={dueDate} disabled={tx.busy} onChange={e=>setDueDate(e.target.value)}/></label>
   <label>Invoice amount (PHP)<input className="wizard-input" inputMode="decimal" required value={amount} disabled={tx.busy} onChange={e=>setAmount(e.target.value)}/></label>
   <p className="desk-muted">Posts on {readableDate(businessDate)}. Inventory, assets, prepayments and input VAT are outside this workflow.</p>
   <label><input type="checkbox" checked={confirmed} disabled={tx.busy} onChange={e=>setConfirmed(e.target.checked)}/> I confirm this is an incurred operating expense and has not already been recorded.</label>
   </>}
   {tx.error&&<p role="alert" className="auth-error">{tx.error}</p>}
   <div className="cash-shift-close-buttons"><button className="btn-primary" type="submit" disabled={tx.busy||(!tx.pending&&!valid)}>{tx.busy?'Saving…':tx.pending?'Retry original invoice':'Record bill'}</button><button className="btn-inline" type="button" disabled={tx.busy} onClick={onClose}>{tx.pending?'Close (retry saved)':'Cancel'}</button></div>
  </form>
 </section></div>;
}
export function SupplierPaymentDialog({hotel,userId,bill,onClose,onSaved}:{hotel:string;userId:string;bill:SupplierBill;onClose:()=>void;onSaved:()=>void}){
 const tx=usePending<BillPaymentInput>('foh.supplier-payment.pending.'+hotel+'.'+userId+'.'+bill.id);
 const [source,setSource]=useState<BillPaymentInput['paymentSource']>('hotel_bank');
 const [amount,setAmount]=useState((Math.max(0,bill.outstandingMinor)/100).toFixed(2));
 const [reference,setReference]=useState('');
 const [confirmed,setConfirmed]=useState(false);
 const shift=useCurrentCashierShift(source==='cashier_drawer'&&!tx.pending);
 const drawer=shift.data?.hotelId===hotel&&shift.data.cashierId===userId&&shift.data.currency==='PHP'?shift.data:null;
 const valid=minor(amount)>0&&minor(amount)<=bill.outstandingMinor&&!!reference.trim()&&confirmed&&(source==='hotel_bank'||!!drawer);
 async function submit(){
  if(!tx.pending&&!valid)return;
  const payload=tx.pending??{requestKey:crypto.randomUUID(),amountMinor:minor(amount),paymentSource:source,evidenceReference:reference.trim(),...(source==='cashier_drawer'?{shiftId:drawer!.id}:{})};
  await tx.send(payload,async input=>{await recordSupplierPayment(hotel,bill.id,input);onSaved();});
 }
 return <div className="billing-modal-backdrop"><section role="dialog" aria-modal="true" aria-label="Record supplier payment" className="billing-action-modal expense-payout-dialog">
  <div className="billing-action-modal-header"><div><h3>Record supplier payment</h3><p>{bill.supplierName} · {bill.invoiceReference}</p></div></div>
  <p>Outstanding: <strong>{money(bill.outstandingMinor)}</strong></p>
  <form className="cash-shift-close-form" onSubmit={e=>{e.preventDefault();void submit();}}>
   {tx.pending?<div className="notice">Earlier payment needs confirmation. Retry {money(tx.pending.amountMinor)} · {statusLabel(tx.pending.paymentSource)} · {tx.pending.evidenceReference}{tx.pending.shiftId?' · Shift #'+tx.pending.shiftId:''}.</div>:<>
   <label>Payment source<select className="wizard-input" value={source} disabled={tx.busy} onChange={e=>{setSource(e.target.value as BillPaymentInput['paymentSource']);setConfirmed(false);}}><option value="hotel_bank">Hotel bank</option><option value="cashier_drawer">Cashier drawer</option></select></label>
   {source==='cashier_drawer'&&<><QueryFeedback loading={shift.isPending} error={shift.error} onRetry={()=>void shift.refetch()}/>{drawer?<p>Using your open PHP shift #{drawer.id}. Expected drawer cash will decrease.</p>:!shift.isPending&&<p className="notice">Open your own PHP cashier shift before recording cash.</p>}</>}
   <label>Amount (PHP)<input className="wizard-input" inputMode="decimal" required value={amount} disabled={tx.busy} onChange={e=>setAmount(e.target.value)}/></label>
   {minor(amount)>bill.outstandingMinor&&<p role="alert">Amount exceeds the outstanding balance.</p>}
   <label>Payment evidence reference<input className="wizard-input" required maxLength={160} value={reference} disabled={tx.busy} onChange={e=>setReference(e.target.value)}/></label>
   <p>Remaining after payment: <strong>{money(Math.max(0,bill.outstandingMinor-minor(amount)))}</strong></p>
   <label><input type="checkbox" checked={confirmed} disabled={tx.busy} onChange={e=>setConfirmed(e.target.checked)}/> I confirm this payment has already been made and the evidence is accurate.</label>
   <p className="desk-muted">This records an existing payment, not a bank transfer or new expense.</p>
   </>}
   {tx.error&&<p role="alert" className="auth-error">{tx.error}</p>}
   <div className="cash-shift-close-buttons"><button type="submit" className="btn-primary" disabled={tx.busy||(!tx.pending&&!valid)}>{tx.busy?'Saving…':tx.pending?'Retry original payment':'Record payment'}</button><button type="button" className="btn-inline" disabled={tx.busy} onClick={onClose}>{tx.pending?'Close (retry saved)':'Cancel'}</button></div>
  </form>
 </section></div>;
}
