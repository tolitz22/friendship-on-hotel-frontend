import {useRef,useState,type FormEvent} from 'react';
import {useQuery} from '@tanstack/react-query';
import {FileText,Search,RefreshCw,X} from 'lucide-react';
import {ApiError} from '../api/http';
import {fetchSubscriptionInvoices,issueSubscriptionInvoice,type SubscriptionInvoice,type InvoiceStatus} from '../api/platformBilling';
import type {SubscriptionHotel} from '../api/platformSubscriptions';
import {formatPlanPrice} from '../features/monitoring/planPricing';
import {calendarDate} from '../features/monitoring/subscriptionLifecycle';
import './PlatformSubscriptionBillingPanel.css';
import {PlatformSubscriptionPaymentsPanel} from './PlatformSubscriptionPaymentsPanel';
import {invoiceLabels} from '../features/monitoring/billingPayments';
type Filter='all'|InvoiceStatus;
export function InvoiceIssueForm({hotel,today,onClose,onSaved}:{hotel:SubscriptionHotel;today:string;onClose:()=>void;onSaved:(invoice:SubscriptionInvoice)=>void}){
 const [due,setDue]=useState(today),[confirmed,setConfirmed]=useState(false),[saving,setSaving]=useState(false),[error,setError]=useState(''),[conflict,setConflict]=useState(false);
 const busy=useRef(false);
 const sub=hotel.subscription;
 const max=new Date(today+'T00:00:00Z');max.setUTCDate(max.getUTCDate()+90);
 async function submit(e:FormEvent<HTMLFormElement>){
  e.preventDefault();if(!sub||sub.kind!=='paid'||sub.priceMinor<=0||!confirmed||busy.current||conflict)return;
  busy.current=true;setSaving(true);setError('');
  try{const result=await issueSubscriptionInvoice(hotel.hotelId,{revision:sub.revision,dueOn:due,confirmed:true});onSaved(result.data);}
  catch(failure){if(failure instanceof ApiError){setError(Object.values(failure.fieldErrors??{}).flat()[0]??failure.message);if(failure.status===409)setConflict(true);}else setError('Issuance could not be confirmed. Refresh the agreements before retrying.');}
  finally{busy.current=false;setSaving(false);}
 }
 if(!sub)return null;
 return <section className="panel subscription-editor billing-issue"><div className="panel-title"><div><h2>Issue billing record</h2><p>{hotel.hotelName} · {sub.planName} · Agreement revision {sub.revision}</p></div><button className="icon-btn" aria-label="Close billing form" disabled={saving} onClick={onClose}><X size={18}/></button></div>
 <form onSubmit={e=>void submit(e)}><fieldset disabled={saving||conflict}><div className="subscription-terms"><span>Agreed subscription charge</span><strong>{formatPlanPrice(sub.priceMinor)}</strong><span>{sub.cycle==='monthly'?'Monthly':'Annual'} · PHP</span><span>Current agreement ends {calendarDate(sub.expiresOn)} (exclusive)</span></div><label>Payment due date<input type="date" required min={today} max={max.toISOString().slice(0,10)} value={due} onChange={e=>{setDue(e.target.value);setConfirmed(false);}}/></label><p className="platform-note">One billing record for this agreement revision. The server calculates the actual service period, including only the added period for a renewal. Issued records cannot be edited or reversed in this release.</p><label className="subscription-confirm"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/> Confirm the agreed price, period and due date for {hotel.hotelName}.</label>{error&&<p className="platform-error" role="alert">{error}</p>}<div className="subscription-actions"><button type="button" className="btn-inline" onClick={onClose}>Cancel</button><button type="submit" className="btn-primary" disabled={!confirmed||saving||conflict}>{saving?'Issuing…':'Issue billing record'}</button></div></fieldset></form></section>;
}
export function PlatformSubscriptionBillingPanel({userId,onAgreements}:{userId:string;onAgreements:()=>void}){
 const [status,setStatus]=useState<Filter>('all'),[search,setSearch]=useState(''),[applied,setApplied]=useState(''),[page,setPage]=useState(1);
 const query=useQuery({queryKey:['platform-subscription-invoices',userId,status,applied,page],queryFn:({signal})=>fetchSubscriptionInvoices(status,applied,page,signal),retry:false,gcTime:0,refetchOnWindowFocus:false});
 const data=query.isError?undefined:query.data;
 const [selected,setSelected]=useState<{invoice:SubscriptionInvoice;today:string}|null>(null);
 return <section className="platform-subscriptions" aria-label="Subscription billing"><div className="platform-title"><div><h1>Billing</h1><p>Internal SaaS subscription charges and outstanding balances.</p></div><button className="btn-primary" onClick={onAgreements}><FileText size={16}/> Issue from agreements</button></div>
 {selected&&<PlatformSubscriptionPaymentsPanel key={selected.invoice.id} invoice={selected.invoice} today={selected.today} userId={userId} onClose={()=>setSelected(null)}/>}
 <div className="panel billing-summary"><div><span>Outstanding · matching filters</span><strong>{data?formatPlanPrice(data.summary.outstandingMinor):'—'}</strong></div><div><span>Billing records</span><strong>{data?data.meta.total.toLocaleString():'—'}</strong></div></div>
 <section className="panel subscription-directory"><div className="panel-title"><div><h2>Billing records</h2><p>Due dates in Asia/Manila</p></div><button className="icon-btn" aria-label="Refresh billing" disabled={query.isFetching} onClick={()=>void query.refetch({cancelRefetch:false})}><RefreshCw size={17}/></button></div><form className="subscription-filters" onSubmit={e=>{e.preventDefault();setApplied(search.trim());setPage(1);}}><label>Search records<input value={search} maxLength={100} placeholder="Hotel or reference" onChange={e=>setSearch(e.target.value)}/></label><button className="btn-inline" aria-label="Search records"><Search size={16}/></button><label>Status<select value={status} onChange={e=>{setStatus(e.target.value as Filter);setPage(1);}}><option value="all">All</option><option value="unpaid">Unpaid (not overdue)</option><option value="partially_paid">Partially paid</option><option value="paid">Paid</option><option value="overdue">Overdue (including partial)</option></select></label></form>
 {query.isPending?<p role="status" className="empty-state">Loading billing records…</p>:query.isError?<p role="alert" className="empty-state">Billing records unavailable. Refresh to try again.</p>:data?.data.length===0?<p className="empty-state">No matching billing records. Issue a record from a paid hotel agreement.</p>:<div className="billing-list">{data?.data.map(i=><article className="billing-row" key={i.id}><div><h3>{i.hotelName}</h3><small>{i.reference}</small><small>{i.planName} · Revision {i.agreementRevision}</small></div><div><small>Service period</small><strong>{calendarDate(i.periodStart)} – {calendarDate(i.periodEnd)}</strong><small>End exclusive</small></div><div><small>Due date</small><strong>{calendarDate(i.dueOn)}</strong><span className={'subscription-state '+(i.status==='overdue'?'expired':i.status==='paid'?'active':'')}>{invoiceLabels[i.status]}</span></div><div className="billing-row-amount"><small>Outstanding</small><strong>{formatPlanPrice(i.outstandingMinor)}</strong><small>Billed {formatPlanPrice(i.amountMinor)}</small>{i.pendingMinor>0&&<small>Pending {formatPlanPrice(i.pendingMinor)}</small>}<button className="btn-inline" disabled={!!selected} onClick={()=>setSelected({invoice:i,today:data!.today})}>Payments</button></div></article>)}</div>}
 {data&&<div className="platform-pagination"><button className="btn-inline" disabled={page<=1||query.isFetching} onClick={()=>setPage(p=>p-1)}>Previous</button><span>Page {page} of {data.meta.lastPage}</span><button className="btn-inline" disabled={page>=data.meta.lastPage||query.isFetching} onClick={()=>setPage(p=>p+1)}>Next</button></div>}</section>
 <p className="platform-note">Internal billing records only, not statutory tax invoices or receipts. Manual payment verification is available. Corrections and payment-linked renewal are not yet available. No hotel operational revenue is included.</p></section>;
}
