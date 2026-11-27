import {useMemo,useState} from 'react';
import {Link,useSearch} from '@tanstack/react-router';
import {AlertTriangle,ArrowRight,ClipboardList,Clock3,RefreshCw,Search,ShieldCheck} from 'lucide-react';
import {useHotelAuth} from '../components/AuthProvider';
import {Heading} from '../components/ui';
import {QueryFeedback} from '../components/QueryFeedback';
import {useOperationalExceptions,type OperationalException} from '../api/operationalExceptions';
import {readableDate,readableDateTime,statusLabel} from '../lib/format';
import {auditActorName} from '../components/ReadableAuditEvent';

type Filter='all'|'critical'|'attention'|'review';
const filters:{value:Filter;title:string;caption:string}[]=[
 {value:'all',title:'All exceptions',caption:'Total items requiring review'},
 {value:'critical',title:'Urgent',caption:'Resolve operational risks first'},
 {value:'attention',title:'Needs action',caption:'Assignments and decisions'},
 {value:'review',title:'Review required',caption:'Items requiring verification'},
];
const types:Record<OperationalException['type'],{title:string;area:string;next:string}>={
 unassigned_arrival:{title:'Assign an arrival room',area:'Front desk',next:'Check readiness before assigning a room'},
 in_house_without_room:{title:'Check an in-house room assignment',area:'Front desk',next:'Confirm where the registered guest is staying'},
 assigned_room_overlap:{title:'Investigate overlapping bookings',area:'Reservations',next:'Compare both reservations before editing room assignments'},
 payment_pending_review:{title:'Review payment evidence',area:'Billing',next:'Verify the payment using independent evidence'},
 room_inspection_review:{title:'Repeat a room inspection',area:'Room readiness',next:'Complete a new physical room inspection'},
 occupancy_review:{title:'Review a room observation',area:'Occupancy checks',next:'Compare the physical observation with the recorded stay'},
 occupancy_investigation:{title:'Investigate an occupancy discrepancy',area:'Occupancy checks',next:'Assign or continue the documented investigation'},
 cashier_shift_review:{title:'Reconcile a cashier shift',area:'Cashier shifts',next:'Another manager must check the cash count and receipts'},
 cashier_shift_discrepancy:{title:'Investigate a flagged cash drawer',area:'Cashier shifts',next:'Review the discrepancy and retain the cash audit evidence'},
 maintenance_blocker:{title:'Resolve room maintenance',area:'Maintenance',next:'Review the work order and room readiness before reopening the room'},
};
function actorLabel(item:OperationalException){
 if(item.type==='room_inspection_review')return 'Submitted by';
 if(item.type==='cashier_shift_review')return 'Cashier';
 if(item.type==='occupancy_investigation')return 'Investigation owner';
 if(item.type==='maintenance_blocker')return 'Assigned technician';
 return 'Recorded employee';
}
function TaskLink({item,hotelId}:{item:OperationalException;hotelId:string}){
 if(item.type==='room_inspection_review')return <Link to="/rooms" search={{room:item.roomNumber||undefined}}>Review room readiness <ArrowRight size={15}/></Link>;
 if(item.type==='occupancy_review'||item.type==='occupancy_investigation')
  return <Link to="/occupancy-verification" search={{room:item.roomId||undefined,date:item.checkDate||undefined}}>Open room check <ArrowRight size={15}/></Link>;
 if(item.type==='maintenance_blocker'){
  const order=/^maintenance:([1-9]\d*)$/.exec(item.id)?.[1];
  return order?<Link to="/maintenance" search={{order}}>Open work order WO-{order} <ArrowRight size={15}/></Link>:null;
 }
 if(item.type==='cashier_shift_review'||item.type==='cashier_shift_discrepancy')return <Link to="/cashier-shifts">Review cashier shifts <ArrowRight size={15}/></Link>;
 if(item.type==='payment_pending_review'&&item.bookingId)return <Link to="/billing" search={{hotel:hotelId,booking:item.bookingId,payment:item.paymentId}}>{item.paymentId?'Review payment #'+item.paymentId:'Open guest bill'} <ArrowRight size={15}/></Link>;
 if(item.type==='assigned_room_overlap')return <Link to="/room-calendar">Inspect room calendar <ArrowRight size={15}/></Link>;
 if(item.bookingId)return <Link to="/reservations" search={{booking:item.bookingId}}>Open reservation <ArrowRight size={15}/></Link>;
 return null;
}
export function OperationalExceptions(){
 const {hotelId,user}=useHotelAuth();
 const admin=!!hotelId&&!!user?.hotels.some(item=>item.id===hotelId&&item.role==='admin');
 const [days,setDays]=useState(7);
 const [filter,setFilter]=useState<Filter>('all');
 const [search,setSearch]=useState('');
 const {tab:initialTab}=useSearch({from:'/operational-exceptions'});
 const [showActivity,setShowActivity]=useState(initialTab==='activity');
 const [area,setArea]=useState('all');
 const report=useOperationalExceptions(days,admin);
 const data=report.data?.data;
 const matching=useMemo(()=>{
  const keyword=search.trim().toLocaleLowerCase();
  return (data?.items??[]).filter(item=>(filter==='all'||item.severity===filter)
   &&(area==='all'||types[item.type].area===area)
   &&(!keyword||[item.reference,item.reason,item.type,item.ownerName??'',item.roomNumber??'',types[item.type].title,types[item.type].area]
    .some(value=>value.toLocaleLowerCase().includes(keyword))));
 },[data,filter,search,area]);
 if(!admin)return <>
  <Heading title="Manager action center" description="Only authorized hotel managers can view operational exceptions."/>
  <div className="exception-access" role="status"><ShieldCheck size={21}/> You do not have permission to review management exceptions for this property.</div>
 </>;
 const urgent=matching.filter(item=>item.severity==='critical');
 const ordinary=matching.filter(item=>item.severity!=='critical');
 const row=(item:OperationalException)=><article className="ops-task" key={item.id}>
  <div className="ops-task-main">
   <div className="ops-task-title"><span className={'ex-severity '+item.severity}>
    {item.severity==='critical'?'Urgent':item.severity==='attention'?'Action needed':'Review'}
   </span><span className="ops-task-area">{types[item.type].area}</span></div>
   <strong>{types[item.type].title}</strong>
   <p>{item.reference} · {item.reason}</p>
   <small>{item.ownerName?actorLabel(item)+': '+item.ownerName+' · ':''}{readableDateTime(item.recordDate)}</small>
  </div>
  <div className="ops-task-side"><span>{item.suggestion||types[item.type].next}</span>
   <TaskLink item={item} hotelId={hotelId!}/></div>
 </article>;
 return <div className="ops-workspace">
  <div className="ops-heading">
   <div><span className="rr-eyebrow">MANAGER WORKSPACE</span>
    <Heading title="Exceptions & audit" description="Prioritize hotel issues, open the affected records, and review reservation activity."/></div>
   <button type="button" className="rr-secondary-action" disabled={report.isFetching}
    onClick={()=>void report.refetch()}><RefreshCw size={16}/> {report.isFetching?'Refreshing…':'Refresh'}</button>
  </div>

  <div className="ops-toolbar">
   <div><strong>Hotel activity · {readableDate(data?.asOfHotelDate)}</strong>
    <span>Reservation alerts for the next {days} days; operational review queues are current</span></div>
   <label>Arrival window
    <select className="wizard-input" value={days} onChange={event=>setDays(Number(event.target.value))}>
     <option value={1}>1 day</option><option value={7}>7 days</option><option value={14}>14 days</option>
    </select></label>
  </div>
  <QueryFeedback loading={report.isPending} error={report.error} onRetry={()=>void report.refetch()}/>
  {data&&<>
   <div className="ops-summary" aria-label="Management work queues">
    {filters.map(entry=><button type="button" key={entry.value} aria-pressed={filter===entry.value}
     className={'ops-summary-card '+(filter===entry.value?'selected':'')}
     onClick={()=>{setFilter(entry.value);setShowActivity(false);}}>
      <span>{entry.title}</span><strong>{entry.value==='all'?data.summary.total:
       data.summary[entry.value]}</strong><small>{entry.caption}</small>
    </button>)}
   </div>
   <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-2" role="group" aria-label="Workspace view">
    <button type="button" className={"rr-secondary-action "+(!showActivity?"font-bold":"")} aria-pressed={!showActivity} onClick={()=>setShowActivity(false)}><ClipboardList size={16}/> Exceptions ({data.summary.total})</button>
    <button type="button" className={"rr-secondary-action "+(showActivity?"font-bold":"")} aria-pressed={showActivity} onClick={()=>setShowActivity(true)}><Clock3 size={16}/> Audit history ({data.activity.length})</button>
   </div>
   {!showActivity&&<section className="ops-task-section">
    <div className="ops-task-heading">
     <div><h3>{filters.find(entry=>entry.value===filter)?.title}</h3>
      <p>{matching.length} matching item{matching.length===1?'':'s'} · Assigned actions remain in their original modules</p></div>
     <div className="flex flex-wrap items-center gap-2">
     <label className="ops-search"><Search size={17}/>
      <input aria-label="Search management tasks" type="search" value={search}
       placeholder="Search room, booking or issue" onChange={event=>setSearch(event.target.value)}/>
     </label>
     <select aria-label="Filter by department" className="wizard-input" value={area} onChange={event=>setArea(event.target.value)}><option value="all">All departments</option>{Array.from(new Set(Object.values(types).map(type=>type.area))).sort().map(name=><option key={name} value={name}>{name}</option>)}</select>
     {(search||area!=='all'||filter!=='all')&&<button type="button" className="rr-secondary-action" onClick={()=>{setSearch('');setArea('all');setFilter('all');}}>Clear filters</button>}
     </div>
    </div>
    {matching.length===0?<div className="ops-no-tasks"><ShieldCheck size={25}/>
     <strong>{data.summary.total===0?'No open exceptions reported':'No matching exceptions'}</strong><p>{data.summary.total===0?'No issues were detected by the current checks. Continue routine hotel monitoring.':'Try clearing filters or changing the arrival window.'}</p>
    </div>:<>
     {urgent.length>0&&<div className="ops-list">
      <h4><AlertTriangle size={17}/> Urgent follow-up ({urgent.length})</h4>
      {urgent.map(row)}
     </div>}
     {ordinary.length>0&&<div className="ops-list">
      {urgent.length>0&&<h4><ClipboardList size={17}/> Other work ({ordinary.length})</h4>}
      {ordinary.map(row)}
     </div>}
    </>}
   </section>}
   {showActivity&&<section className="ops-history"><div>
     <h3 className="font-semibold">Recent reservation activity</h3>
     <p>Activity history is not itself an alert. Open a reservation to review what was recorded.</p>
     {data.activity.length===0&&<p>No reservation changes recorded in the selected period.</p>}
     {data.activity.map(entry=><article key={entry.id} className="ops-history-row">
      <div><strong>{statusLabel(entry.eventType)}</strong>
       <small>{entry.reference} · {auditActorName(entry.actorId,entry.actorName,user?.id,user?.name)}
        {' · '}{readableDateTime(entry.createdAt)}</small></div>
      <Link to="/reservations" search={{booking:entry.bookingId}}>View <ArrowRight size={14}/></Link>
     </article>)}
    </div>
   </section>}
   <details className="ops-note"><summary className="cursor-pointer font-medium">About these checks</summary><p>Exceptions indicate records requiring review, not proof of misconduct. Review and resolution remain in the original authorized workflows.</p></details>
  </>}
 </div>;
}
