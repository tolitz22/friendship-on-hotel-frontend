import {useMemo,useState} from 'react';
import {Link} from '@tanstack/react-router';
import {AlertTriangle,ArrowRight,ClipboardList,Clock3,RefreshCw,ShieldAlert,ShieldCheck,Wallet} from 'lucide-react';
import {useHotelAuth} from '../components/AuthProvider';
import {Heading} from '../components/ui';
import {QueryFeedback} from '../components/QueryFeedback';
import {useOperationalExceptions,type OperationalException} from '../api/operationalExceptions';
import {readableDate,readableDateTime,statusLabel} from '../lib/format';
import {auditActorName} from '../components/ReadableAuditEvent';

type Filter='all'|'critical'|'attention'|'review';
const descriptions:Record<OperationalException['type'],string>={
 unassigned_arrival:'Upcoming arrival · Room assignment',
 in_house_without_room:'In-house stay · Missing room',
 assigned_room_overlap:'Room inventory · Overlapping stays',
 payment_pending_review:'Finance · Pending evidence',
};
const labels:Record<Filter,string>={all:'All exceptions',critical:'Urgent review',attention:'Needs attention',review:'Payment review'};

export function OperationalExceptions(){
 const {hotelId,user}=useHotelAuth();
 const admin=!!hotelId&&!!user?.hotels.some(item=>item.id===hotelId&&item.role==='admin');
 const [days,setDays]=useState(7);
 const [filter,setFilter]=useState<Filter>('all');
 const [search,setSearch]=useState('');
 const [showActivity,setShowActivity]=useState(false);
 const report=useOperationalExceptions(days,admin);
 const data=report.data?.data;
 const matches=useMemo(()=>data?.items.filter(item=>
  (filter==='all'||item.severity===filter)
  &&(!search.trim()||[item.reference,item.reason,item.type,item.bookingId]
   .some(value=>value.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()))))??[],
 [data,filter,search]);
 if(!admin)return <>
  <Heading title="Exceptions & audit review" description="Managers investigate operational discrepancies and review recorded activity."/>
  <div className="exception-access" role="status"><ShieldCheck size={21}/>
   Only active hotel administrators can view this workspace. Access is also enforced by Laravel.
  </div>
 </>;
 return <>
  <div className="ex-heading">
   <Heading title="Exceptions & audit review" description="Review PMS discrepancies and payment evidence. An alert is not a finding of fraud."/>
   <button type="button" className="btn-inline" onClick={()=>void report.refetch()}><RefreshCw size={16}/> Refresh</button>
  </div>
  <section className="ex-context">
   <div><strong>Operational review · {readableDate(data?.asOfHotelDate)}</strong>
    <span>{data?'Upcoming arrivals through '+readableDate(data.windowEndExclusive)+' (end exclusive)':'Loading selected hotel records'}</span></div>
   <label>Arrival window
    <select value={days} onChange={event=>setDays(Number(event.target.value))}>
     <option value={1}>1 day</option><option value={7}>7 days</option><option value={14}>14 days</option>
    </select>
   </label>
  </section>
  <QueryFeedback loading={report.isPending} error={report.error}
   onRetry={()=>void report.refetch()}/>
  {data&&<>
   <section className="ex-metrics" aria-label="Exception summary">
    {([
     {label:'Total to review',value:data.summary.total,kind:'all' as const,icon:ClipboardList},
     {label:'Urgent review',value:data.summary.critical,kind:'critical' as const,icon:ShieldAlert},
     {label:'Needs assignment',value:data.summary.attention,kind:'attention' as const,icon:AlertTriangle},
     {label:'Payment evidence',value:data.summary.review,kind:'review' as const,icon:Wallet},
    ]).map(item=><button key={item.kind} type="button"
     className={'ex-metric '+(filter===item.kind?'selected':'')} onClick={()=>setFilter(item.kind)}>
     <item.icon size={20}/><span>{item.label}</span><strong>{item.value}</strong>
    </button>)}
   </section>
   <section className="ex-panel" aria-label="Operational exception records">
    <div className="ex-panel-heading">
     <div><h3>{labels[filter]}</h3><p>{matches.length} matching records · Only evidence in the selected hotel's PMS</p></div>
     <input type="search" aria-label="Search exception records" placeholder="Booking reference or issue"
      value={search} onChange={event=>setSearch(event.target.value)}/>
    </div>
    {matches.length===0?<div className="ex-empty"><ShieldCheck size={25}/>
     <strong>No matching records</strong><p>Try another filter or window. An empty list does not prove the hotel is free of discrepancies.</p>
    </div>:<div className="ex-list">
     {matches.map(item=><article className="ex-record" key={item.id}>
      <div className="ex-record-top"><span className={'ex-severity '+item.severity}>
       {item.severity==='critical'?'Urgent review':item.severity==='attention'?'Needs attention':'Review pending'}
      </span><small>{readableDateTime(item.recordDate)}</small></div>
      <h4>{descriptions[item.type]}</h4>
      <div className="ex-record-reference">{item.reference} · Reservation #{item.bookingId}</div>
      <p>{item.reason}</p><p className="ex-next-step"><strong>Suggested next step:</strong> {item.suggestion}</p>
      <div className="ex-record-actions">
       <Link to="/reservations" search={{booking:item.bookingId}}>Open reservation <ArrowRight size={15}/></Link>
       {item.type==='payment_pending_review'&&<Link to="/billing" search={{booking:item.bookingId}}>View folio <ArrowRight size={15}/></Link>}
       {item.type==='assigned_room_overlap'&&<Link to="/room-calendar">Inspect room rack <ArrowRight size={15}/></Link>}
      </div>
     </article>)}
    </div>}
   </section>
   <section className="ex-panel ex-activity">
    <button type="button" className="ex-activity-toggle" aria-expanded={showActivity} onClick={()=>setShowActivity(!showActivity)}>
     <span><Clock3 size={18}/> Recorded reservation activity ({data.activity.length})</span>
     <span>{showActivity?'Hide':'Show'} audit events</span>
    </button>
    {showActivity&&<div className="ex-activity-list">
     <p>These are ordinary reservation actions attributed to staff, not evidence of misconduct.</p>
     {data.activity.length===0&&<p>No recorded reservation changes within the selected lookback period.</p>}
     {data.activity.map(entry=><div className="ex-activity-item" key={entry.id}>
      <div><strong>{statusLabel(entry.eventType)}</strong>
       <span>{entry.reference} · {auditActorName(entry.actorId,entry.actorName,user?.id,user?.name)} · {readableDateTime(entry.createdAt)}</span></div>
      <Link to="/reservations" search={{booking:entry.bookingId}}>Review <ArrowRight size={14}/></Link>
     </div>)}
    </div>}
   </section>
   <div className="ex-integrations"><ShieldAlert size={18}/><div><strong>Independent verification not connected</strong>
    <p>Keycard access logs, CCTV events and independent physical-occupancy records are not connected. This dashboard cannot detect off-system stays or infer employee wrongdoing. Audit records and payment evidence require independent review.</p>
   </div></div>
  </>}
 </>;
}
