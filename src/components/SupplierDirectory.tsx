import {useRef,useState} from 'react';
import {useQueryClient} from '@tanstack/react-query';
import {Plus,X} from 'lucide-react';
import {useSuppliers,saveSupplier} from '../api/suppliers';
import type {Supplier,SupplierInput,SupplierFilters} from '../api/suppliers';
import {Panel,Status} from './ui';
import {QueryFeedback} from './QueryFeedback';

function SupplierDialog({hotel,supplier,onClose,onSaved}:{hotel:string;supplier:Supplier|null;onClose:()=>void;onSaved:(supplier:Supplier)=>void}){
 const [name,setName]=useState(supplier?.name??'');
 const [contact,setContact]=useState(supplier?.contactName??'');
 const [email,setEmail]=useState(supplier?.email??'');
 const [phone,setPhone]=useState(supplier?.phone??'');
 const [terms,setTerms]=useState(String(supplier?.paymentTermsDays??0));
 const [active,setActive]=useState(supplier?.isActive??true);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const guard=useRef(false);
 const valid=!!name.trim()&&/^\d+$/.test(terms)&&Number(terms)<=365;
 async function submit(){
  if(guard.current||!valid)return;
  guard.current=true;setBusy(true);setError('');
  const input:SupplierInput={name:name.trim(),contactName:contact.trim()||null,email:email.trim()||null,phone:phone.trim()||null,paymentTermsDays:Number(terms),isActive:active,...(supplier?{version:supplier.version}:{})};
  try{onSaved(await saveSupplier(hotel,supplier?.id??null,input));}
  catch(e){setError(e instanceof Error?e.message:'Save could not be confirmed. Refresh the directory before retrying.');}
  finally{guard.current=false;setBusy(false);}
 }
 const title=supplier?'Edit supplier':'Add supplier';
 return <div className="billing-modal-backdrop"><section role="dialog" aria-modal="true" aria-label={title} className="billing-action-modal expense-payout-dialog">
  <div className="billing-action-modal-header"><div><h3>{title}</h3><p>Maintain supplier contact information and payment terms.</p></div><button type="button" className="billing-modal-dismiss" disabled={busy} onClick={onClose} aria-label="Close supplier form"><X size={20}/></button></div>
  <form className="cash-shift-close-form" onSubmit={e=>{e.preventDefault();void submit();}}>
   <label>Supplier name<input autoFocus className="wizard-input" required maxLength={160} disabled={busy} value={name} onChange={e=>setName(e.target.value)}/></label>
   <label>Contact person (optional)<input className="wizard-input" maxLength={160} disabled={busy} value={contact} onChange={e=>setContact(e.target.value)}/></label>
   <label>Email (optional)<input type="email" className="wizard-input" maxLength={254} disabled={busy} value={email} onChange={e=>setEmail(e.target.value)}/></label>
   <label>Phone (optional)<input type="tel" className="wizard-input" maxLength={64} disabled={busy} value={phone} onChange={e=>setPhone(e.target.value)}/></label>
   <label>Payment terms (days)<input type="number" min={0} max={365} step={1} required className="wizard-input" disabled={busy} value={terms} onChange={e=>setTerms(e.target.value)}/></label>
   <p className="desk-muted">Zero days means due on receipt.</p>
   <label>Status<select className="wizard-input" value={active?'active':'inactive'} disabled={busy} onChange={e=>setActive(e.target.value==='active')}><option value="active">Active</option><option value="inactive">Inactive</option></select></label>
   {!active&&<p className="notice">Inactive suppliers cannot receive new invoices. Existing bills and payment history are retained.</p>}
   {error&&<p role="alert" className="auth-error">{error}</p>}
   <div className="cash-shift-close-buttons"><button type="submit" className="btn-primary" disabled={busy||!valid}>{busy?'Saving…':'Save supplier'}</button><button type="button" className="btn-inline" disabled={busy} onClick={onClose}>Cancel</button></div>
  </form>
 </section></div>;
}

export function SupplierDirectory({hotel}:{hotel:string}){
 const [filters,setFilters]=useState<SupplierFilters>({status:'active',page:1});
 const [editor,setEditor]=useState<{supplier:Supplier|null}|null>(null);
 const [message,setMessage]=useState('');
 const query=useSuppliers(hotel,filters);
 const client=useQueryClient();
 return <Panel title="Supplier directory" action={<button className="btn-primary" type="button" onClick={()=>{setMessage('');setEditor({supplier:null});}}><Plus size={16}/> Add supplier</button>}>
  <p className="desk-muted">Manage suppliers and their default payment terms. Deactivate rather than delete suppliers to preserve invoice history.</p>
  {message&&<p role="status" className="cashier-feedback-success">{message}</p>}
  <div className="expense-filters">
   <label>Search suppliers<input className="wizard-input" placeholder="Supplier or contact person" value={filters.search??''} onChange={e=>setFilters(p=>({...p,search:e.target.value||undefined,page:1}))}/></label>
   <label>Supplier status<select className="wizard-input" value={filters.status} onChange={e=>setFilters(p=>({...p,status:e.target.value as SupplierFilters['status'],page:1}))}><option value="active">Active</option><option value="inactive">Inactive</option><option value="all">All suppliers</option></select></label>
  </div>
  <QueryFeedback loading={query.isPending} error={query.error} onRetry={()=>void query.refetch()}/>
  {query.data?.data.length===0&&<p>No suppliers match these filters. Add a supplier or search inactive records.</p>}
  {!!query.data?.data.length&&<div className="table-scroll"><table><thead><tr><th>Supplier</th><th>Contact</th><th>Payment terms</th><th>Status</th><th>Action</th></tr></thead><tbody>
   {query.data.data.map(s=><tr key={s.id}><td><strong>{s.name}</strong></td><td>{s.contactName??'—'}{s.email&&<small className="expense-payee">{s.email}</small>}{s.phone&&<small className="expense-payee">{s.phone}</small>}</td><td>{s.paymentTermsDays===0?'Due on receipt':s.paymentTermsDays+' days'}</td><td><Status value={s.isActive?'Active':'Inactive'}/></td><td><button className="btn-inline" type="button" aria-label={'Edit '+s.name} onClick={()=>{setMessage('');setEditor({supplier:s});}}>Edit</button></td></tr>)}
  </tbody></table></div>}
  {query.data&&<div className="desk-tools"><button type="button" className="btn-inline" disabled={filters.page<=1} onClick={()=>setFilters(p=>({...p,page:p.page-1}))}>Previous</button><span>Page {query.data.meta.page} of {Math.max(1,query.data.meta.totalPages)} · {query.data.meta.total} suppliers</span><button type="button" className="btn-inline" disabled={filters.page>=query.data.meta.totalPages} onClick={()=>setFilters(p=>({...p,page:p.page+1}))}>Next</button></div>}
  {editor&&<SupplierDialog hotel={hotel} supplier={editor.supplier} onClose={()=>setEditor(null)} onSaved={s=>{setEditor(null);setMessage(s.name+' saved.');setFilters({status:s.isActive?'active':'inactive',page:1});void client.invalidateQueries({queryKey:['live','suppliers',hotel]});}}/>}
 </Panel>;
}
