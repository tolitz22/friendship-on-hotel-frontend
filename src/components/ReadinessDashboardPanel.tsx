import {useEffect,useMemo,useState} from 'react';
import {Link} from '@tanstack/react-router';
import {
 AlertTriangle,ArrowRight,CalendarDays,CheckCircle2,ChevronLeft,
 ChevronRight,ClipboardCheck,Clock3,RefreshCw,ShieldAlert,ShieldCheck,
} from 'lucide-react';
import {useHotelAuth} from './AuthProvider';
import {QueryFeedback} from './QueryFeedback';
import {useReadinessDashboard,type DashboardArrival,type DashboardRoom} from '../api/readinessDashboard';
import {readableDate} from '../lib/format';

type QueueFilter='all'|'arrivals'|'blocked'|'review'|'inspection'|'approved';
type QueueItem={
 key:string;priority:number;date:string;title:string;subtitle:string;problem:string;
 role:string;roomNumber?:string;kind:'booking'|'inspection'|'housekeeping'|'maintenance'|'inventory';
 bookingId?:string;taskId?:string;orderId?:string;blockId?:string;
};
const perPage=12;
const issue=(flags:DashboardRoom['blockers']|null|undefined,status:DashboardRoom['status']|null|undefined)=>{
 if(flags?.activeRoomImpactMaintenance)return 'Maintenance restriction active';
 if(flags?.activeInventoryBlockToday)return 'Inventory block active today';
 if(flags?.latestTurnoverIncomplete||flags?.unfinishedHousekeeping)return 'Housekeeping incomplete';
 if(flags?.newTurnoverSinceInspection)return 'New checkout turnover requires a fresh inspection';
 if(flags?.newRoomWorkSinceInspection)return 'Room work has made the previous inspection outdated';
 if(status==='awaiting_review')return 'Waiting for independent review';
 if(status==='needs_inspection'||status==='blocked_or_stale')return 'Approved inspection missing or outdated';
 return 'No current inspection problem reported';
};
const priority=(arrival:DashboardArrival,today:string)=>{
 if(arrival.checkIn===today&&arrival.risk==='unassigned_room')return 0;
 if(arrival.checkIn===today&&arrival.risk!=='no_current_readiness_issue')return 1;
 if(arrival.risk==='unassigned_room')return 2;
 if(arrival.risk!=='no_current_readiness_issue')return 3;
 return 20;
};
function createArrivalItem(arrival:DashboardArrival,today:string):QueueItem{
 const unassigned=arrival.risk==='unassigned_room';
 const problem=unassigned?'Physical room has not been assigned':
  arrival.risk==='room_record_missing'?'Assigned room record cannot be verified':
  issue(arrival.roomBlockers,arrival.roomStatus);
 return {key:'arrival-'+arrival.bookingId,priority:priority(arrival,today),
  date:arrival.checkIn,title:arrival.guestName??arrival.reference,
  subtitle:(arrival.roomNumber?'Room '+arrival.roomNumber:'Unassigned room')+' · '+arrival.reference+
    ' · Arrives '+readableDate(arrival.checkIn),
  problem,role:'Front desk'+(unassigned?' (room assignment)':' / readiness reviewer'),
  roomNumber:arrival.roomNumber??undefined,kind:'booking',bookingId:arrival.bookingId,
  taskId:arrival.openHousekeepingTaskId??undefined,orderId:arrival.activeMaintenanceOrderId??undefined,
  blockId:arrival.activeInventoryBlockId??undefined};
}
function createRoomItem(room:DashboardRoom):QueueItem|null{
 if(room.status==='approved_current')return null;
 const flags=room.blockers;
 const hasMaintenance=flags.activeRoomImpactMaintenance;
 const hasBlock=flags.activeInventoryBlockToday;
 const hasCleaning=flags.latestTurnoverIncomplete||flags.unfinishedHousekeeping;
 const kind=hasMaintenance?'maintenance':hasBlock?'inventory':hasCleaning?'housekeeping':'inspection';
 const priority=room.status==='awaiting_review'?4:(hasMaintenance||hasBlock||hasCleaning)?5:6;
 return {key:'room-'+room.roomId,priority,date:'9999-12-31',
  title:'Room '+room.roomNumber,subtitle:'Room readiness · '+room.status.replaceAll('_',' '),
  problem:issue(flags,room.status),
  role:kind==='maintenance'?'Maintenance / authorized manager':
   kind==='housekeeping'?'Housekeeping supervisor':
   kind==='inventory'?'Inventory / front desk manager':
   room.status==='awaiting_review'?'Independent authorized reviewer':'Authorized inspector',
  roomNumber:room.roomNumber,kind,
  taskId:room.openHousekeepingTaskId??undefined,
  orderId:room.activeMaintenanceOrderId??undefined,
  blockId:room.activeInventoryBlockId??undefined};
}

export function ReadinessDashboardPanel({onInspectRoom}:{onInspectRoom:(roomNumber:string)=>void}){
 const {hotelId}=useHotelAuth();
 const [days,setDays]=useState(7);
 const [page,setPage]=useState(1);
 const [filter,setFilter]=useState<QueueFilter>('all');
 const [listPage,setListPage]=useState(1);
 const query=useReadinessDashboard(days,page);
 const data=query.data?.data;
 const meta=query.data?.meta;
 const queue=useMemo(()=>{
  if(!data)return [];
  const today=data.asOfHotelDate;
  const arrivals=data.arrivals.filter(a=>a.risk!=='no_current_readiness_issue').map(a=>createArrivalItem(a,today));
  const rooms=data.rooms.map(createRoomItem).filter((item):item is QueueItem=>item!==null);
  return [...arrivals,...rooms].sort((a,b)=>a.priority-b.priority||a.date.localeCompare(b.date)||a.key.localeCompare(b.key));
 },[data]);
 const arrivalsToday=data?.arrivals.filter(a=>a.checkIn===data.asOfHotelDate&&a.risk!=='no_current_readiness_issue')??[];
 const outstanding=data?data.summary.needsInspection+data.summary.awaitingReview+data.summary.blockedOrStale:0;
 const filtered=queue.filter(item=>filter==='all'||
  filter==='arrivals'&&item.kind==='booking'||
  filter==='blocked'&&(item.kind==='maintenance'||item.kind==='housekeeping'||item.kind==='inventory')||
  filter==='review'&&item.kind==='inspection'&&item.problem==='Waiting for independent review'||
  filter==='inspection'&&item.kind==='inspection'&&item.problem!=='Waiting for independent review');
 const totalPages=Math.max(1,Math.ceil(filtered.length/perPage));
 const safePage=Math.min(listPage,totalPages);
 const shown=filtered.slice((safePage-1)*perPage,safePage*perPage);
 useEffect(()=>{setPage(1);setListPage(1);setFilter('all');},[hotelId]);
 useEffect(()=>setListPage(1),[days,filter,page]);
 if(!hotelId)return null;
 return <div className="readiness-hub rh-action-workspace">
  <div className="rh-header">
   <div><span className="rr-eyebrow">FRONT DESK · ACTION QUEUE</span>
    <h3>Readiness & arrivals</h3><p>Today's arrivals first. Review real inspection and restriction records before check-in.</p></div>
   <div className="rh-header-controls">
    <label>Arrival window
     <select aria-label="Arrival reporting window" value={days}
      onChange={event=>{setDays(Number(event.target.value));setPage(1);}}>
      <option value={3}>Next 3 days</option><option value={7}>Next 7 days</option><option value={14}>Next 14 days</option>
     </select></label>
    <button className="rr-secondary-action" type="button" disabled={query.isFetching}
     onClick={()=>void query.refetch()}><RefreshCw size={15}/>{query.isFetching?'Refreshing…':'Refresh'}</button>
   </div>
  </div>
  <QueryFeedback loading={query.isPending} error={query.error} onRetry={()=>void query.refetch()}/>
  {data&&meta&&<>
   {arrivalsToday.length>0&&<section className="rh-urgent" aria-label="Urgent arrivals today">
    <div className="rh-urgent-heading"><AlertTriangle size={19} aria-hidden="true"/>
     <div><strong>{arrivalsToday.length} arrival{arrivalsToday.length===1?'':'s'} needing action today</strong>
      <small>{readableDate(data.asOfHotelDate)} · Resolve before guest check-in</small></div></div>
    {arrivalsToday.sort((a,b)=>priority(a,data.asOfHotelDate)-priority(b,data.asOfHotelDate)).slice(0,3).map(arrival=>{
     const item=createArrivalItem(arrival,data.asOfHotelDate);
     return <div className="rh-urgent-row" key={item.key}>
      <div><strong>{item.title}</strong><small>{item.subtitle}</small><p>{item.problem}</p></div>
      <Link to="/reservations" search={{booking:arrival.bookingId,deskAction:arrival.risk==='unassigned_room'?'assign':'check-in'}}>
       Open booking <ArrowRight size={15}/></Link>
     </div>;
    })}
   </section>}
   <div className="rh-snapshot"><Clock3 size={15} aria-hidden="true"/>
    Snapshot {readableDate(data.asOfHotelDate)} · {meta.arrivalTotal} confirmed arrivals in selected window ·
    Check-in inspection gate: {data.enforceAtCheckIn?'Enforced':'Not enforced'}
   </div>
   <div className="rh-overview rh-action-summary" role="group" aria-label="Filter readiness action queue">
    {([
     ['all','All issues',outstanding+data.arrivals.filter(a=>a.risk!=='no_current_readiness_issue').length,ClipboardCheck],
     ['arrivals','Arrivals to review',data.arrivals.filter(a=>a.risk!=='no_current_readiness_issue').length,CalendarDays],
     ['review','Awaiting approval',data.summary.awaitingReview,Clock3],
     ['blocked','Blocked or outdated',data.summary.blockedOrStale,ShieldAlert],
     ['inspection','Inspections required',data.summary.needsInspection,ShieldCheck],
    ] as const).map(([value,label,count,Symbol])=><button key={value} type="button"
     aria-pressed={filter===value} onClick={()=>setFilter(value)}
     className={'rh-overview-card rh-summary-button'+(filter===value?' active':'')+(count>0&&value==='blocked'?' rh-blocked':'')}>
      <Symbol size={19} aria-hidden="true"/><span>{label}</span><strong>{count}</strong>
      <small>{value==='all'?'Hotel totals; room cards paginated':count===0?'No current issues':'Filter the queue'}</small>
     </button>)}
   </div>
   <section className="rh-section" aria-labelledby="rh-action-heading">
    <div className="rh-section-head"><div className="rh-section-copy">
     <span className="rr-eyebrow">PRIORITIZED OPERATIONS</span>
     <h3 id="rh-action-heading">What staff should do next</h3>
     <p>Unassigned arrivals → arrival blockers → approvals → housekeeping and maintenance → inspections.</p>
    </div></div>
    <div className="rh-action-list" aria-live="polite">
     {shown.map(item=><article key={item.key} className={'rh-action-card'+(item.priority<=1?' urgent':'')}>
      <div className="rh-action-info">
       <strong>{item.title}</strong><small>{item.subtitle}</small>
       <p><AlertTriangle size={15} aria-hidden="true"/> {item.problem}</p>
       <span>Responsible: {item.role}</span>
      </div>
      <div className="rh-action-controls">
       {item.kind==='booking'&&<Link to="/reservations" search={{booking:item.bookingId,deskAction:item.problem==='Physical room has not been assigned'?'assign':'check-in'}}>
        Open booking <ArrowRight size={15}/></Link>}
       {item.kind==='inspection'&&item.roomNumber&&<button type="button" onClick={()=>{if(item.roomNumber)onInspectRoom(item.roomNumber);}}>
        {item.problem==='Waiting for independent review'?'Review inspection':'Inspect room'} <ArrowRight size={15}/></button>}
       {item.kind==='housekeeping'&&item.roomNumber&&<Link to="/housekeeping" search={{task:item.taskId}}>
        Open housekeeping task <ArrowRight size={15}/></Link>}
       {item.kind==='maintenance'&&item.roomNumber&&<Link to="/maintenance" search={{order:item.orderId}}>
        Open maintenance order <ArrowRight size={15}/></Link>}
       {item.kind==='inventory'&&item.roomNumber&&<Link to="/room-calendar" search={{date:data.asOfHotelDate}}>
        Review inventory block <ArrowRight size={15}/></Link>}
       {item.kind!=='booking'&&item.roomNumber&&<button type="button" className="rh-secondary-action" onClick={()=>{if(item.roomNumber)onInspectRoom(item.roomNumber);}}>
        Inspection details</button>}
      </div>
     </article>)}
     {shown.length===0&&<div className="rh-empty"><CheckCircle2 size={21} aria-hidden="true"/>
      <strong>No matching actions on the loaded room page</strong>
      <p>Arrivals cover the whole selected period; room exceptions are paginated. Choose another filter or room page.</p>
      <button type="button" className="btn-inline" onClick={()=>setFilter('all')}>Show all issues</button>
     </div>}
    </div>
    {totalPages>1&&<div className="rh-pagination">
     <span>Queue page {safePage} / {totalPages}</span>
     <div><button type="button" className="btn-inline" disabled={safePage<=1} onClick={()=>setListPage(safePage-1)}><ChevronLeft size={15}/> Previous</button>
      <button type="button" className="btn-inline" disabled={safePage>=totalPages} onClick={()=>setListPage(safePage+1)}>Next <ChevronRight size={15}/></button></div>
    </div>}
   </section>
   <div className="rh-pagination" aria-label="Hotel-wide room pagination">
    <span>Room records page {meta.roomPage} / {Math.max(1,meta.roomTotalPages)} · {meta.roomPerPage} per page · {data.summary.totalRooms} registered rooms</span>
    <div><button type="button" className="btn-inline" disabled={page<=1} onClick={()=>setPage(page-1)}>Previous rooms</button>
     <button type="button" className="btn-inline" disabled={page>=meta.roomTotalPages} onClick={()=>setPage(page+1)}>Next rooms</button></div>
   </div>
   <p className="desk-muted">Cleaning completion and readiness approval are separate records. These are operational snapshots, not guarantees of room availability or financial settlement.</p>
  </>}
 </div>;
}
