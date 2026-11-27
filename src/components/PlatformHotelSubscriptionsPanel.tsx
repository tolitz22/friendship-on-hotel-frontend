import {useRef,useState,type FormEvent} from 'react';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {Building2,Search,RefreshCw,History,X} from 'lucide-react';
import {ApiError} from '../api/http';
import {fetchPlatformPlans,type PlatformPlan} from '../api/platformPlans';
import {fetchHotelSubscriptions,fetchSubscriptionHistory,saveHotelSubscription,type SubscriptionHotel,type SubscriptionStatus,type SubscriptionInput,type BillingCycle} from '../api/platformSubscriptions';
import {calendarDate,subscriptionActions,subscriptionLabels} from '../features/monitoring/subscriptionLifecycle';
import {formatPlanPrice} from '../features/monitoring/planPricing';
import './PlatformHotelSubscriptionsPanel.css';
const limit=(n:number|null)=>n===null?'Unlimited':n.toLocaleString();
const actions={trial:'Start trial',assign:'Assign plan',renew:'Renew agreement'};
type Action=keyof typeof actions;
function Pager({page,last,busy,onChange}:{page:number;last:number;busy:boolean;onChange:(n:number)=>void}){
 return <div className="platform-pagination"><button className="btn-inline" disabled={busy||page===1} onClick={()=>onChange(page-1)}>Previous</button><span>Page {page} of {last}</span><button className="btn-inline" disabled={busy||page>=last} onClick={()=>onChange(page+1)}>Next</button></div>;
}
function AgreementEditor({hotel,action,userId,onClose,onSaved}:{hotel:SubscriptionHotel;action:Action;userId:string;onClose:()=>void;onSaved:()=>void}){
 const sub=hotel.subscription;
 const [plan,setPlan]=useState<PlatformPlan|null>(null),[planPage,setPlanPage]=useState(1),[cycle,setCycle]=useState<BillingCycle>(sub?.cycle??'monthly'),[days,setDays]=useState('14'),[saving,setSaving]=useState(false),[error,setError]=useState(''),[conflict,setConflict]=useState(false),[confirmed,setConfirmed]=useState(false);
 const busy=useRef(false);
 const plans=useQuery({queryKey:['platform-active-plans',userId,planPage],queryFn:({signal})=>fetchPlatformPlans('active',planPage,signal),enabled:action!=='renew',retry:false,gcTime:0,refetchOnWindowFocus:false});
 const options=plans.isError?undefined:plans.data;
 const price=action==='renew'?sub?.priceMinor:plan?(cycle==='monthly'?plan.monthlyMinor:plan.annualMinor):undefined;
 async function submit(e:FormEvent<HTMLFormElement>){
  e.preventDefault();if(busy.current||conflict||!confirmed)return;
  let input:SubscriptionInput;
  if(action==='renew'){if(!sub)return;input={action,revision:sub.revision};}
  else{if(!plan)return;const n=Number(days);if(action==='trial'&&(!Number.isInteger(n)||n<1||n>90)){setError('Trial must be 1–90 days.');return;}
   input={action,revision:sub?.revision??0,planId:plan.id,planRevision:plan.revision,cycle,...(action==='trial'?{trialDays:n}:{})};
  }
  busy.current=true;setSaving(true);setError('');
  try{await saveHotelSubscription(hotel.hotelId,input);onSaved();}
  catch(failure){
   if(failure instanceof ApiError&&failure.status===409){setConflict(true);setError('The agreement or plan changed. Close the editor, refresh and reopen it.');}
   else if(failure instanceof ApiError&&failure.status===422)setError(Object.values(failure.fieldErrors??{}).flat()[0]??'Check the selected terms.');
   else if(failure instanceof ApiError&&failure.status===429)setError('Too many requests. Wait before trying again.');
   else{setConflict(true);setError('Save could not be confirmed. Refresh the directory before trying again.');}
  }finally{busy.current=false;setSaving(false);}
 }
 return <section className="panel subscription-editor"><div className="panel-title"><div><h2>{actions[action]}</h2><p>{hotel.hotelName}</p></div><button className="icon-btn" aria-label="Close agreement editor" disabled={saving} onClick={onClose}><X size={18}/></button></div>
 <form onSubmit={e=>void submit(e)}><fieldset disabled={saving||conflict}>
 {action!=='renew'&&<><label>Choose an active plan<select value={plan?.id??''} onChange={e=>{setPlan(options?.data.find(p=>p.id===e.target.value)??null);setConfirmed(false);}} required><option value="">Select plan</option>{options?.data.map(p=><option key={p.id} value={p.id}>{p.name} · {p.code}</option>)}</select></label>
 {plans.isPending?<p role="status">Loading plans…</p>:plans.isError?<p role="alert">Could not load active plans.</p>:options?.data.length===0?<p>No active plans. Create or activate one in Plan catalog.</p>:null}
 {options&&options.meta.lastPage>1&&<Pager page={planPage} last={options.meta.lastPage} busy={plans.isFetching} onChange={n=>{setPlan(null);setConfirmed(false);setPlanPage(n);}}/>}
 <label>Billing cycle<select value={cycle} onChange={e=>{setCycle(e.target.value as BillingCycle);setConfirmed(false);}}><option value="monthly">Monthly</option><option value="annual">Annual</option></select></label></>}
 {action==='trial'&&<label>Free trial duration (days)<input type="number" min={1} max={90} step={1} required value={days} onChange={e=>{setDays(e.target.value);setConfirmed(false);}}/></label>}
 <div className="subscription-terms"><span>{action==='trial'?'Trial charge':'Agreed recurring price'}</span><strong>{action==='trial'?formatPlanPrice(0):price===undefined?'—':formatPlanPrice(price)}</strong>{action==='trial'&&price!==undefined&&<span>Proposed recurring price: {formatPlanPrice(price)} / {cycle==='monthly'?'month':'year'}</span>}{action!=='trial'&&<span>Per {cycle==='monthly'?'month':'year'}</span>}
 {(plan||sub&&action==='renew')&&<span>Rooms: {limit(action==='renew'?sub!.roomLimit:plan!.roomLimit)} · Staff: {limit(action==='renew'?sub!.staffLimit:plan!.staffLimit)}</span>}</div>
 <p className="platform-note">{action==='trial'?'Starts today; one trial per property before its first paid agreement.':action==='renew'?'Extends from the existing expiration date, or today if expired. Keeps the original agreed price and limits.':sub?.status==='trial'?'Starts today and ends any unused trial days.':'Starts today using the selected plan revision.'} Dates follow Asia/Manila. No payment is collected and access is unchanged.</p>
 <label className="subscription-confirm"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/> Confirm these agreement terms</label>
 {error&&<p className="platform-error" role="alert">{error}</p>}
 <div className="subscription-actions"><button type="button" className="btn-inline" onClick={onClose}>Cancel</button><button type="submit" className="btn-primary" disabled={!confirmed||(action!=='renew'&&!plan)||saving||conflict}>{saving?'Saving…':actions[action]}</button></div></fieldset></form></section>;
}
function AgreementHistory({hotel,userId,onClose}:{hotel:SubscriptionHotel;userId:string;onClose:()=>void}){
 const [page,setPage]=useState(1);
 const query=useQuery({queryKey:['platform-subscription-history',userId,hotel.hotelId,page],queryFn:({signal})=>fetchSubscriptionHistory(hotel.hotelId,page,signal),retry:false,gcTime:0});
 const result=query.isError?undefined:query.data;
 return <section className="panel subscription-editor"><div className="panel-title"><div><h2>Agreement history</h2><p>{hotel.hotelName}</p></div><button className="icon-btn" aria-label="Close history" onClick={onClose}><X size={18}/></button></div>{query.isPending?<p>Loading history…</p>:query.isError?<p role="alert">History unavailable.</p>:<><div className="table-scroll"><table><thead><tr><th>Revision / action</th><th>Plan</th><th>Agreed price</th><th>Period</th><th>Operator / time</th></tr></thead><tbody>{result?.data.map(r=><tr key={r.revision}><td>{r.revision} · {actions[r.action]}</td><td>{r.snapshot.planName}</td><td>{r.snapshot.kind==='trial'?'Free trial':formatPlanPrice(r.snapshot.priceMinor)}<small className="cell-note">{r.snapshot.cycle}</small></td><td>{calendarDate(r.snapshot.startsOn)} – {calendarDate(r.snapshot.expiresOn)}<small className="cell-note">Expiry exclusive</small></td><td>{r.actorId?'#'+r.actorId:'Unavailable'}<small className="cell-note">{new Date(r.createdAt).toLocaleString()}</small></td></tr>)}</tbody></table></div>{result&&<Pager page={page} last={result.meta.lastPage} busy={query.isFetching} onChange={setPage}/>}</>}</section>;
}
export function PlatformHotelSubscriptionsPanel({userId}:{userId:string}){
 const client=useQueryClient();
 const [status,setStatus]=useState<SubscriptionStatus|'all'>('all'),[search,setSearch]=useState(''),[applied,setApplied]=useState(''),[page,setPage]=useState(1);
 const [editing,setEditing]=useState<{hotel:SubscriptionHotel;action:Action}|null>(null),[history,setHistory]=useState<SubscriptionHotel|null>(null),[success,setSuccess]=useState('');
 const query=useQuery({queryKey:['platform-hotel-subscriptions',userId,status,applied,page],queryFn:({signal})=>fetchHotelSubscriptions(status,applied,page,signal),retry:false,gcTime:0,refetchOnWindowFocus:false});
 const result=query.isError?undefined:query.data;
 return <section aria-label="Hotel subscriptions" className="platform-subscriptions"><div className="platform-title"><div><h1>Hotel subscriptions</h1><p>Trials, agreements, expiry and manual renewals.</p></div></div>
 {success&&<div className="panel subscription-success" role="status">{success}<button className="icon-btn" aria-label="Dismiss confirmation" onClick={()=>setSuccess('')}><X size={16}/></button></div>}
 {editing&&<AgreementEditor key={editing.hotel.hotelId+editing.action} {...editing} userId={userId} onClose={()=>setEditing(null)} onSaved={()=>{setSuccess('Agreement saved for '+editing.hotel.hotelName+'.');setEditing(null);setStatus('all');setPage(1);void client.invalidateQueries({queryKey:['platform-hotel-subscriptions',userId]});}}/>}
 {history&&<AgreementHistory key={history.hotelId} hotel={history} userId={userId} onClose={()=>setHistory(null)}/>}
 <section className="panel subscription-directory"><div className="panel-title"><div><h2>Customer agreements</h2><p>{result?result.meta.total+' matching properties · '+calendarDate(result.today):'Property subscription status'}</p></div><button className="icon-btn" aria-label="Refresh agreements" disabled={query.isFetching} onClick={()=>void query.refetch({cancelRefetch:false})}><RefreshCw size={17}/></button></div>
 <form className="subscription-filters" onSubmit={e=>{e.preventDefault();setApplied(search.trim());setPage(1);}}><label>Search hotel<input value={search} onChange={e=>setSearch(e.target.value)} maxLength={100} placeholder="Property name"/></label><button className="btn-inline" aria-label="Search hotels"><Search size={16}/></button><label>Status<select value={status} onChange={e=>{setStatus(e.target.value as SubscriptionStatus|'all');setPage(1);}}><option value="all">All statuses</option>{Object.entries(subscriptionLabels).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label></form>
 {query.isPending?<p role="status" className="empty-state">Loading agreements…</p>:query.isError?<p role="alert" className="empty-state">Agreements unavailable. Check access and refresh.</p>:result?.data.length===0?<p className="empty-state">No matching properties.</p>:<div>{result?.data.map(h=>{const s=h.subscription;const state=s?.status??'unassigned';return <article className="subscription-row" key={h.hotelId}><div className="subscription-name"><Building2 size={20}/><div><h3>{h.hotelName}</h3><small>Property #{h.hotelId}</small></div></div><div><span className={'subscription-state '+state}>{subscriptionLabels[state]}</span><strong className="subscription-plan-name">{s?.planName??'No assigned plan'}</strong>{s&&<small>{s.kind==='trial'?'Free trial':formatPlanPrice(s.priceMinor)+' / '+(s.cycle==='monthly'?'month':'year')}</small>}</div><div><small>Expires on</small><strong>{s?calendarDate(s.expiresOn):'—'}</strong>{s&&<small>At midnight, Manila</small>}</div><div className="subscription-row-actions">{h.currency==='PHP'&&subscriptionActions(s).map(action=><button className="btn-inline" key={action} disabled={!!editing} onClick={()=>{setSuccess('');setHistory(null);setEditing({hotel:h,action});}}>{action==='assign'&&s?.kind==='trial'?'Convert to paid plan':actions[action]}</button>)}{s&&<button className="btn-inline" disabled={!!editing} onClick={()=>setHistory(h)}><History size={14}/> History</button>}</div></article>;})}</div>}
 {result&&<Pager page={page} last={result.meta.lastPage} busy={query.isFetching} onChange={setPage}/>}</section><p className="platform-note">An active agreement is not proof of payment. Expiration does not suspend hotel access. Billing and limits are not enforced yet.</p></section>;
}
