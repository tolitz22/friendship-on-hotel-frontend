import {useEffect,useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {Link} from '@tanstack/react-router';
import {AlertTriangle,ArrowRight,BedDouble,CalendarPlus,CheckCircle2,ChevronRight,ClipboardCheck,Clock3,DoorOpen,Hotel,Layers3,LogIn,LogOut,Receipt,RefreshCw,ShieldAlert,Users,Wallet,Wrench} from 'lucide-react';
import {useLiveCatalogSummary,useLiveProperty} from '../api/liveCatalogQueries';
import {useLiveManifest} from '../api/liveFrontDesk';
import {useRoomRack} from '../api/roomRack';
import {useOperationalExceptions} from '../api/operationalExceptions';
import {useApprovalRequests} from '../api/managerApprovals';
import {listMaintenance,parseLiveMaintenance} from '../api/liveMaintenance';
import {useHotelAuth} from '../components/AuthProvider';
import {recommendedDeskAction} from '../features/front-desk/deskActions';
import {hotelToday} from '../features/reservations/calendarDate';
import {QueryFeedback} from '../components/QueryFeedback';
import './AdminOverview.css';
import {OperationalDateStrip} from '../components/OperationalDateStrip';
import {dateLabel} from '../lib/format';

function eventLabel(value:string){return value.replace(/[_-]+/g,' ').replace(/\b\w/g,c=>c.toUpperCase());}
function activityTime(value:string,zone:string){
 const date=new Date(value);
 return Number.isNaN(date.getTime())?value:new Intl.DateTimeFormat('en-PH',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit',timeZone:zone}).format(date);
}
export function LiveDashboard(){
 const {hotelId,user}=useHotelAuth();
 const property=useLiveProperty();
 const zone=property.data?.data.timeZone??'Asia/Manila';
 const today=hotelToday(new Date(),zone);
 const [selection,setSelection]=useState<{hotel:string|null;date:string}|null>(null);
 const date=selection&&selection.hotel===hotelId?selection.date:today;
 const isToday=date===today;
 const changeDate=(next:string)=>setSelection(next===today?null:{hotel:hotelId,date:next});
 const catalog=useLiveCatalogSummary();
 const arrivals=useLiveManifest(date,'arrivals',1,5);
 const departures=useLiveManifest(date,'departures',1,5);
 const inHouse=useLiveManifest(today,'in_house',1,1);
 const overdue=useLiveManifest(today,'overdue',1,1);
 const rack=useRoomRack(1,1,1,true,30000);
 const exceptions=useOperationalExceptions(7);
 const approvals=useApprovalRequests({enabled:true,status:'pending'});
 const maintenance=useQuery({queryKey:['live','overview-maintenance',hotelId],enabled:!!hotelId,
  queryFn:async()=>{const results=await Promise.all([listMaintenance(1,1,{status:'open'}),listMaintenance(1,1,{status:'in_progress'})]);return results.reduce((total,result)=>total+parseLiveMaintenance(result,hotelId!).meta.total,0);},
  retry:false,refetchInterval:60000,refetchIntervalInBackground:false});
 const [tab,setTab]=useState<'arrivals'|'departures'>('arrivals');
 useEffect(()=>setTab('arrivals'),[hotelId]);
 const summary=rack.isSuccess&&rack.data.data.hotelDate===today?rack.data.data.summary:undefined;
 const occupancy=summary&&summary.totalRooms>0?Math.round(summary.pmsOccupiedRooms/summary.totalRooms*100):null;
 const count=(query:typeof arrivals)=>query.isSuccess?query.data.meta.queueTotal??query.data.meta.total:undefined;
 const urgent=count(overdue);
 const current=tab==='arrivals'?arrivals:departures;
 const activity=exceptions.isSuccess?exceptions.data.data.activity.slice().sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).slice(0,5):[];
 const refresh=()=>{for(const query of [property,catalog,arrivals,departures,inHouse,overdue,rack,exceptions,approvals,maintenance])void query.refetch();};
 const pending=[property,arrivals,departures,overdue,rack,exceptions,approvals,maintenance].some(q=>q.isFetching);
 const unavailable=[property,arrivals,departures,inHouse,overdue,rack,exceptions,approvals,maintenance].some(q=>q.isError);
 return <div className="ao-page">
  <header className="ao-heading"><div><h2>Overview</h2><p>Your hotel performance and daily operations.</p></div><button type="button" className="icon-btn ao-refresh" aria-label="Refresh overview" disabled={pending} onClick={refresh}><RefreshCw size={18}/></button></header>
  <OperationalDateStrip date={date} today={today} onChange={changeDate} label="Overview operational date"/>
  {unavailable&&<div className="ao-unavailable" role="status">Some figures are unavailable. <button type="button" onClick={refresh}>Retry</button></div>}
  <section className="ao-metrics" aria-label="Hotel overview">
   <Link to="/rooms" className="ao-metric"><span className="ao-icon ao-orange"><BedDouble size={23}/></span><span><small>Occupied in PMS{!isToday?' · Today':''}</small><strong>{summary?.pmsOccupiedRooms??'—'}{summary&&<small> / {summary.totalRooms}</small>}</strong></span></Link>
   <Link to="/rooms" className="ao-metric"><span className="ao-icon"><DoorOpen size={23}/></span><span><small>Vacant in PMS{!isToday?' · Today':''}</small><strong>{summary?.pmsVacantRooms??'—'}</strong></span></Link>
   <Link to="/front-desk" search={{queue:'arrivals',date}} className="ao-metric" aria-label="View expected arrivals"><span className="ao-icon ao-green"><LogIn size={23}/></span><span><small>{isToday?'Arrivals today':'Arrivals'}</small><strong>{count(arrivals)??'—'}</strong></span></Link>
   <Link to="/front-desk" search={{queue:'departures',date}} className="ao-metric" aria-label="View due departures"><span className="ao-icon ao-red"><LogOut size={23}/></span><span><small>{isToday?'Departures today':'Departures'}</small><strong>{count(departures)??'—'}</strong></span></Link>
  </section>
  <div className="ao-core">
   <section className="ao-card ao-occupancy" aria-labelledby="ao-occupancy"><div className="ao-card-head"><h3 id="ao-occupancy">Occupancy</h3><span className="ao-muted">Today · {dateLabel(today)}</span></div>
    <div className="ao-occupancy-body"><div className="ao-ring" style={{background:occupancy===null?'var(--border)':'conic-gradient(var(--accent) '+occupancy+'%, var(--border) 0)'}}><div><strong>{occupancy===null?'—':occupancy+'%'}</strong><small>PMS occupancy</small></div></div>
     <div className="ao-legend"><div><span><i className="ao-dot occupied"/>Occupied</span><strong>{summary?.pmsOccupiedRooms??'—'}</strong></div><div><span><i className="ao-dot"/>Vacant</span><strong>{summary?.pmsVacantRooms??'—'}</strong></div><div className="ao-legend-total"><span>Total rooms</span><strong>{summary?.totalRooms??'—'}</strong></div></div>
    </div>
    <Link to="/front-desk" search={{queue:'in_house'}} className="ao-inline" aria-label="View in-house reservations"><Users size={15}/> In-house stays <strong>{count(inHouse)??'—'}</strong><ChevronRight size={15}/></Link>
    <p className="ao-footnote">PMS vacancy is not booking availability.</p>
   </section>
   <section className="ao-card ao-today" aria-labelledby="ao-today-title"><div className="ao-card-head"><h3 id="ao-today-title">{isToday?"Today's activity":'Scheduled activity'}</h3><Link to="/front-desk" search={{queue:tab,date}} className="ao-link">View all <ChevronRight size={15}/></Link></div>
    <div className="ao-tabs" role="group" aria-label="Arrival and departure queues"><button type="button" aria-pressed={tab==='arrivals'} onClick={()=>setTab('arrivals')}>Arrivals ({count(arrivals)??'—'})</button><button type="button" aria-pressed={tab==='departures'} onClick={()=>setTab('departures')}>Departures ({count(departures)??'—'})</button></div>
    <QueryFeedback loading={current.isPending} error={current.error} onRetry={()=>void current.refetch()} empty={current.isSuccess&&current.data.data.length===0} emptyMessage={'No '+tab+' scheduled.'}/>
    {current.isSuccess&&current.data.data.slice(0,5).map(row=>{const action=recommendedDeskAction(tab,row);const historical=!isToday&&action.kind!=='assign';return <div className="ao-guest" key={row.id}><span className="ao-avatar"><Users size={17}/></span><Link to="/reservations" search={{booking:row.id}} className="ao-guest-name"><strong>{row.guestName?.trim()||'Guest name unavailable'}</strong><small>{row.roomNumber?'Room '+row.roomNumber:'Unassigned'} · {row.reference}</small></Link><span className={'ao-status '+(row.status==='confirmed'?'ao-green':'ao-blue')}>{row.status==='confirmed'?'Confirmed':'In house'}</span><Link className="ao-guest-action" to="/reservations" search={{booking:row.id,deskAction:historical||action.kind==='view'?undefined:action.kind}}>{historical?'View stay':action.kind==='assign'?'Assign room':action.kind==='check-in'?'Check in':action.kind==='check-out'?'Check out':'View stay'}</Link></div>})}
   </section>
   <section className="ao-card ao-attention" aria-labelledby="ao-attention-title"><div className="ao-card-head"><h3 id="ao-attention-title">Needs attention</h3>{!isToday&&<span className="ao-muted">Current</span>}</div>
    <Link to="/front-desk" search={{queue:'overdue'}} className="ao-attention-row" data-urgent={!!urgent}><AlertTriangle size={20}/><span>Overdue checkouts</span><strong>{urgent??'—'}</strong><ChevronRight size={16}/></Link>
    <Link to="/manager-approvals" className="ao-attention-row"><ShieldAlert size={20}/><span>Pending approvals</span><strong>{approvals.isSuccess?approvals.data.meta.total:'—'}</strong><ChevronRight size={16}/></Link>
    <Link to="/operational-exceptions" className="ao-attention-row"><ClipboardCheck size={20}/><span>Exceptions to review</span><strong>{exceptions.isSuccess?exceptions.data.data.summary.total:'—'}</strong><ChevronRight size={16}/></Link>
    <Link to="/maintenance" className="ao-attention-row"><Wrench size={20}/><span>Active maintenance</span><strong>{maintenance.isSuccess?maintenance.data:'—'}</strong><ChevronRight size={16}/></Link>
    <Link to="/housekeeping" search={{queue:'active'}} className="ao-attention-row"><BedDouble size={20}/><span>Rooms needing cleaning</span><strong>{summary?.roomsNeedingCleaning??'—'}</strong><ChevronRight size={16}/></Link>
    <Link to="/night-audit" className="ao-inline"><Clock3 size={16}/> Daily closing <ChevronRight size={16}/></Link>
   </section>
  </div>
  <section className="ao-quick" aria-labelledby="ao-actions-title"><h3 id="ao-actions-title">Quick actions</h3><div className="ao-actions">
   <Link to="/reservations" search={{mode:'new',checkIn:date>=today?date:today}}><CalendarPlus size={24}/> New booking</Link>
   <Link to="/front-desk" search={{queue:'arrivals',date}}><LogIn size={24}/> Check in</Link>
   <Link to="/front-desk" search={{queue:'departures',date}}><LogOut size={24}/> Check out</Link>
   <Link to="/front-desk" search={{queue:'in_house'}}><Clock3 size={24}/> Extend stay</Link>
   <Link to="/reservations" search={{filter:'needs_room'}}><BedDouble size={24}/> Assign room</Link>
   <Link to="/expenses" search={{record:true}}><Receipt size={24}/> Record expense</Link>
  </div></section>
  <section className="ao-card ao-activity" aria-labelledby="ao-activity-title"><div className="ao-card-head"><h3 id="ao-activity-title">Recent activity</h3><Link to="/operational-exceptions" search={{tab:'activity'}} className="ao-link">View audit log <ChevronRight size={15}/></Link></div>
   <QueryFeedback loading={exceptions.isPending} error={exceptions.error} onRetry={()=>void exceptions.refetch()} empty={exceptions.isSuccess&&activity.length===0} emptyMessage="No recent reservation activity."/>
   {activity.length>0&&<div className="table-scroll"><table><thead><tr><th>Time</th><th>Activity</th><th>Booking</th><th>User</th></tr></thead><tbody>{activity.map(entry=><tr key={entry.id}><td>{activityTime(entry.createdAt,zone)}</td><td><span className="ao-event"><CheckCircle2 size={15}/>{eventLabel(entry.eventType)}</span></td><td><Link to="/reservations" search={{booking:entry.bookingId}}>{entry.reference}</Link></td><td>{entry.actorName|| (entry.actorId===user?.id?user.name:'Staff #'+entry.actorId)}</td></tr>)}</tbody></table></div>}
  </section>
  <details className="ao-card ao-more"><summary>Registered room inventory & property details <ChevronRight size={16}/></summary><div className="ao-more-body"><QueryFeedback loading={catalog.isPending} error={catalog.error} onRetry={()=>void catalog.refetch()}/>{catalog.data&&<><p>{catalog.data.data.totalRooms} registered rooms · {catalog.data.data.totalRoomTypes} room types</p><div className="table-scroll"><table><thead><tr><th>Room type</th><th>Rooms</th><th>Max guests</th></tr></thead><tbody>{catalog.data.data.roomTypes.map(type=><tr key={type.id}><td>{type.name}</td><td>{type.roomCount}</td><td>{type.maxOccupancy}</td></tr>)}</tbody></table></div></>}<p>{property.data?.data.name} · {zone} · {property.data?.data.currency}</p><Link to="/settings" className="ao-link"><Hotel size={16}/> Hotel settings <ArrowRight size={15}/></Link><Link to="/rooms" className="ao-link"><Layers3 size={16}/> Room inventory <ArrowRight size={15}/></Link><Link to="/cashier-shifts" className="ao-link"><Wallet size={16}/> Cashier shifts <ArrowRight size={15}/></Link></div></details>
 </div>;
}
