import {useState} from 'react';
import {Link} from '@tanstack/react-router';
import {Clock3,RefreshCw,ArrowRight} from 'lucide-react';
import {auditCategories,useBusinessAudit,type AuditCategory} from '../api/businessAudit';
import {readableDateTime,statusLabel} from '../lib/format';
import {QueryFeedback} from './QueryFeedback';

const labels:Record<AuditCategory,string>={bookings:'Bookings',housekeeping:'Housekeeping',maintenance:'Maintenance',staff:'Staff access',catalog:'Catalog',payments:'Payments & folios',cashier:'Cashier shifts',expenses:'Expenses',finance:'Financial operations'};
export function BusinessAuditTimeline({hotelId}:{hotelId:string}){
 const [category,setCategory]=useState<AuditCategory|'all'>('all');
 const [days,setDays]=useState(30);
 const query=useBusinessAudit(hotelId,category,days);
 const items=Array.from(new Map((query.data?.pages.flatMap(page=>page.data.items)??[]).map(item=>[item.id,item])).values());
 return <section className="ops-history space-y-4" aria-label="Business audit history">
  <div className="flex flex-wrap items-start justify-between gap-3">
   <div><h3 className="font-semibold">Business audit history</h3><p className="text-sm text-slate-500">Recent activity recorded by existing PMS workflows. Activity is not an exception or proof of misconduct.</p></div>
   <button type="button" className="rr-secondary-action" disabled={query.isFetching} onClick={()=>void query.refetch()}><RefreshCw size={16}/> Refresh activity</button>
  </div>
  <div className="grid gap-3 sm:grid-cols-2">
   <label className="text-sm font-medium">Department<select className="wizard-input w-full" value={category} onChange={event=>setCategory(event.target.value as AuditCategory|'all')}><option value="all">All departments</option>{auditCategories.map(key=><option key={key} value={key}>{labels[key]}</option>)}</select></label>
   <label className="text-sm font-medium">History window<select className="wizard-input w-full" value={days} onChange={event=>setDays(Number(event.target.value))}>{[7,30,90].map(value=><option key={value} value={value}>Last {value} days</option>)}</select></label>
  </div>
  <QueryFeedback loading={query.isPending} error={query.error} onRetry={()=>void query.refetch()}/>
  {query.data&&items.length===0&&<div className="ops-no-tasks"><Clock3 size={24}/><strong>No recorded activity in this window</strong><p>Try a different department or history window.</p></div>}
  {items.map(item=><article className="ops-history-row flex-wrap gap-2" key={item.id}>
   <div className="min-w-0 break-words"><small>{labels[item.category]}</small><strong>{statusLabel(item.action)}</strong>
    <small>Record #{item.subjectId} · {item.actorId?'User #'+item.actorId:'Actor not recorded'} · {readableDateTime(item.createdAt)}</small></div>
   {item.category==='bookings'&&<Link to="/reservations" search={{booking:item.subjectId}}>View booking <ArrowRight size={14}/></Link>}
  </article>)}
  {query.hasNextPage&&<button className="rr-secondary-action w-full justify-center" type="button" disabled={query.isFetching} onClick={()=>void query.fetchNextPage()}>{query.isFetchingNextPage?'Loading…':'Load older activity'}</button>}
  {items.length>0&&<p className="text-xs text-slate-500">{items.length} loaded · Original module records remain authoritative.</p>}
 </section>;
}
