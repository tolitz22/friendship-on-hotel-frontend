import {useRef,useState,type FormEvent} from 'react';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {CreditCard,Plus,Pencil,History,RefreshCw,X} from 'lucide-react';
import {ApiError} from '../api/http';
import {createPlatformPlan,updatePlatformPlan,fetchPlatformPlans,fetchPlanHistory,type PlatformPlan,type PlanFields,type PlanStatus} from '../api/platformPlans';
import {formatPlanPrice,minorToPesos,pesosToMinor,parsePlanLimit} from '../features/monitoring/planPricing';
import './PlatformPlansPanel.css';

const limit=(value:number|null)=>value===null?'Unlimited':value.toLocaleString();
function Pager({page,lastPage,busy,change}:{page:number;lastPage:number;busy:boolean;change:(page:number)=>void}){
 return <div className="platform-pagination"><button className="btn-inline" disabled={busy||page<=1} onClick={()=>change(page-1)}>Previous</button><span>Page {page} of {lastPage}</span><button className="btn-inline" disabled={busy||page>=lastPage} onClick={()=>change(page+1)}>Next</button></div>;
}
function PlanEditor({plan,onClose,onSaved}:{plan:PlatformPlan|null;onClose:()=>void;onSaved:(plan:PlatformPlan)=>void}){
 const [saving,setSaving]=useState(false),[error,setError]=useState(''),[conflict,setConflict]=useState(false);
 const [roomUnlimited,setRoomUnlimited]=useState(plan?plan.roomLimit===null:false),[staffUnlimited,setStaffUnlimited]=useState(plan?plan.staffLimit===null:false);
 const busy=useRef(false);
 async function submit(e:FormEvent<HTMLFormElement>){
  e.preventDefault();if(busy.current||conflict)return;
  const fields=new FormData(e.currentTarget),value=(key:string)=>String(fields.get(key)??'').trim();
  const monthlyMinor=pesosToMinor(value('monthly')),annualMinor=pesosToMinor(value('annual'));
  const roomLimit=roomUnlimited?null:parsePlanLimit(value('rooms')),staffLimit=staffUnlimited?null:parsePlanLimit(value('staff'));
  if(monthlyMinor===null||annualMinor===null){setError('Enter valid PHP prices with up to two decimal places.');return;}
  if(roomLimit===undefined||staffLimit===undefined||(!roomUnlimited&&roomLimit===null)||(!staffUnlimited&&staffLimit===null)){setError('Enter positive room and staff limits or explicitly select Unlimited.');return;}
  const input:PlanFields={name:value('name'),description:value('description')||null,monthlyMinor,annualMinor,roomLimit,staffLimit,isActive:fields.get('active')==='on'};
  setSaving(true);setError('');busy.current=true;
  try{
   const result=plan?await updatePlatformPlan(plan.id,{...input,revision:plan.revision}):await createPlatformPlan({...input,code:value('code')});
   onSaved(result.data);
  }catch(failure){
   if(failure instanceof ApiError&&failure.status===409){setConflict(true);setError('Another change was saved. Close this editor, refresh the catalog and reopen the plan.');}
   else if(failure instanceof ApiError&&failure.status===422){setError(Object.values(failure.fieldErrors??{}).flat()[0]??'Check the plan fields and unique code.');}
   else if(failure instanceof ApiError&&failure.status===429)setError('Too many requests. Wait before trying again.');
   else setError('The save could not be confirmed. Close this editor and refresh the catalog before retrying.');
  }finally{busy.current=false;setSaving(false);}
 }
 return <section className="panel platform-plan-editor" aria-label={plan?'Edit subscription plan':'New subscription plan'}>
  <div className="panel-title"><div><h2>{plan?'Edit plan':'New plan'}</h2><p>{plan?'Revision '+plan.revision+' · '+plan.code:'Define a package without assigning it to hotels.'}</p></div><button className="icon-btn" disabled={saving} onClick={onClose} aria-label="Close editor"><X size={18}/></button></div>
  <form onSubmit={e=>void submit(e)}><fieldset disabled={saving}>
   <div className="platform-plan-fields"><label>Plan name<input name="name" required minLength={2} maxLength={100} defaultValue={plan?.name}/></label>{!plan&&<label>Unique code<input name="code" required minLength={2} maxLength={40} pattern="[a-z][a-z0-9-]{1,39}" placeholder="starter"/></label>}</div>
   <label>Description<textarea name="description" maxLength={500} rows={2} defaultValue={plan?.description??''}/></label>
   <h3>Pricing · PHP</h3><div className="platform-plan-fields"><label>Monthly price (₱)<input name="monthly" inputMode="decimal" required defaultValue={plan?minorToPesos(plan.monthlyMinor):''} placeholder="0.00"/></label><label>Annual price (₱)<input name="annual" inputMode="decimal" required defaultValue={plan?minorToPesos(plan.annualMinor):''} placeholder="0.00"/></label></div><p className="platform-note">Monthly and annual prices are independent. Zero is allowed for a free plan.</p>
   <h3>Package limits</h3><div className="platform-plan-fields"><div><label>Room limit<input name="rooms" type="number" min={1} max={100000} step={1} required={!roomUnlimited} disabled={roomUnlimited} defaultValue={plan?.roomLimit??''}/></label><label className="platform-plan-check"><input type="checkbox" checked={roomUnlimited} onChange={e=>setRoomUnlimited(e.target.checked)}/> Unlimited rooms</label></div><div><label>Staff limit<input name="staff" type="number" min={1} max={100000} step={1} required={!staffUnlimited} disabled={staffUnlimited} defaultValue={plan?.staffLimit??''}/></label><label className="platform-plan-check"><input type="checkbox" checked={staffUnlimited} onChange={e=>setStaffUnlimited(e.target.checked)}/> Unlimited staff</label></div></div>
   <label className="platform-plan-check"><input name="active" type="checkbox" defaultChecked={plan?.isActive??false}/> Active in catalog</label><p className="platform-note">Catalog changes do not charge hotels, assign subscriptions or enforce limits yet.</p>
   {error&&<p role="alert" className="platform-error">{error}</p>}<div className="platform-plan-actions"><button type="button" className="btn-inline" onClick={onClose}>Cancel</button><button className="btn-primary" type="submit" disabled={conflict}>{saving?'Saving…':plan?'Save changes':'Create plan'}</button></div>
  </fieldset></form>
 </section>;
}
function PlanHistory({plan,userId,onClose}:{plan:PlatformPlan;userId:string;onClose:()=>void}){
 const [page,setPage]=useState(1);
 const query=useQuery({queryKey:['platform-plan-history',userId,plan.id,page],queryFn:({signal})=>fetchPlanHistory(plan.id,page,signal),retry:false,gcTime:0,refetchOnWindowFocus:false});
 const result=query.isError?undefined:query.data;
 return <section className="panel platform-plan-history"><div className="panel-title"><div><h2>{plan.name} · Change history</h2><p>Recorded catalog revisions</p></div><button className="icon-btn" aria-label="Close history" onClick={onClose}><X size={18}/></button></div>
 {query.isPending?<p role="status">Loading history…</p>:query.isError?<p role="alert">History unavailable.</p>:<><div className="table-scroll"><table><thead><tr><th>Revision</th><th>Changed</th><th>Operator</th><th>Monthly / annual</th><th>Rooms / staff</th><th>Status</th></tr></thead><tbody>{result?.data.map(r=><tr key={r.revision}><td>{r.revision}<small className="cell-note">{r.snapshot.name}</small></td><td>{new Date(r.createdAt).toLocaleString()}</td><td>{r.actorId?'#'+r.actorId:'Unavailable'}</td><td>{formatPlanPrice(r.snapshot.monthlyMinor)}<small className="cell-note">{formatPlanPrice(r.snapshot.annualMinor)}</small></td><td>{limit(r.snapshot.roomLimit)} / {limit(r.snapshot.staffLimit)}</td><td>{r.snapshot.isActive?'Active':'Inactive'}</td></tr>)}</tbody></table></div>{result&&<Pager page={page} lastPage={result.meta.lastPage} busy={query.isFetching} change={setPage}/>}</>}
 </section>;
}
export function PlatformPlansPanel({userId}:{userId:string}){
 const client=useQueryClient();
 const [status,setStatus]=useState<PlanStatus>('all'),[page,setPage]=useState(1);
 const [editing,setEditing]=useState<PlatformPlan|null|undefined>(undefined),[history,setHistory]=useState<PlatformPlan|null>(null),[success,setSuccess]=useState('');
 const query=useQuery({queryKey:['platform-plans',userId,status,page],queryFn:({signal})=>fetchPlatformPlans(status,page,signal),retry:false,gcTime:0,staleTime:30000,refetchOnWindowFocus:false});
 const result=query.isError?undefined:query.data;
 function saved(plan:PlatformPlan){setEditing(undefined);setSuccess(plan.name+' saved · revision '+plan.revision);setStatus('all');setPage(1);void client.invalidateQueries({queryKey:['platform-plans',userId]});void client.invalidateQueries({queryKey:['platform-plan-history',userId,plan.id]});}
 return <section className="platform-plans" aria-label="Subscriptions">
 <div className="platform-title"><div><span className="eyebrow">CUSTOMER MANAGEMENT</span><h1>Plan catalog</h1><p>Configure packages and pricing for your PMS.</p></div><button className="btn-primary" disabled={editing!==undefined} onClick={()=>{setSuccess('');setHistory(null);setEditing(null);}}><Plus size={17}/> New plan</button></div>
 {success&&<div role="status" className="panel platform-plan-feedback">{success}<button className="icon-btn" aria-label="Dismiss confirmation" onClick={()=>setSuccess('')}><X size={16}/></button></div>}
 {editing!==undefined&&<PlanEditor key={editing?.id??'new'} plan={editing} onClose={()=>setEditing(undefined)} onSaved={saved}/>}
 {history&&<PlanHistory key={history.id} plan={history} userId={userId} onClose={()=>setHistory(null)}/>}
 <section className="panel platform-plan-catalog"><div className="panel-title"><div><h2>Plan catalog</h2><p>{result?result.meta.total+' matching plans':'Subscription packages'}</p></div><div className="platform-plan-filter"><label><span>Status</span><select value={status} onChange={e=>{setStatus(e.target.value as PlanStatus);setPage(1);}}><option value="all">All plans</option><option value="active">Active</option><option value="inactive">Inactive</option></select></label><button className="icon-btn" aria-label="Refresh plans" disabled={query.isFetching} onClick={()=>void query.refetch({cancelRefetch:false})}><RefreshCw size={17} className={query.isFetching?'platform-spin':''}/></button></div></div>
 {query.isPending?<p role="status" className="empty-state">Loading plans…</p>:query.isError?<p role="alert" className="empty-state">Plan catalog unavailable. Check access and refresh.</p>:result?.data.length===0?<div className="platform-plan-empty"><CreditCard size={28}/><h3>No matching plans</h3><p>Create a package to set your own pricing and limits.</p></div>:<div className="platform-plan-grid">{result?.data.map(plan=><article className="platform-plan-card" key={plan.id}><div className="platform-plan-card-top"><div><h3>{plan.name}</h3><small>{plan.code} · Revision {plan.revision}</small></div><span className={'platform-plan-state'+(plan.isActive?' active':'')}>{plan.isActive?'Active':'Inactive'}</span></div>{plan.description&&<p>{plan.description}</p>}<div className="platform-plan-price"><strong>{formatPlanPrice(plan.monthlyMinor)}</strong><span>/ month</span></div><div className="platform-plan-annual">{formatPlanPrice(plan.annualMinor)} / year</div><div className="platform-plan-limits"><span>Rooms <strong>{limit(plan.roomLimit)}</strong></span><span>Staff <strong>{limit(plan.staffLimit)}</strong></span></div><div className="platform-plan-actions"><button className="btn-inline" disabled={editing!==undefined} onClick={()=>{setHistory(null);setSuccess('');setEditing(plan);}}><Pencil size={14}/> Edit</button><button className="btn-inline" disabled={editing!==undefined} onClick={()=>setHistory(plan)}><History size={14}/> History</button></div></article>)}</div>}
 {result&&<Pager page={page} lastPage={result.meta.lastPage} busy={query.isFetching} change={setPage}/>}
 </section><p className="platform-note">Assign active plans using Hotel subscriptions. Catalog edits do not change existing agreements. Billing and limit enforcement are not enabled yet.</p>
 </section>;
}
