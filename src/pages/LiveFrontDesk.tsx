import {useEffect,useState} from 'react';
import {useQueryClient} from '@tanstack/react-query';
import {Link} from '@tanstack/react-router';
import {
 ArrowLeft,ArrowRight,BedDouble,CalendarDays,LogIn,LogOut,
 Search,Users,AlertTriangle,RefreshCw,ClipboardCheck,Plus,Clock3,
} from 'lucide-react';
import {useLiveManifest} from '../api/liveFrontDesk';
import {readSession} from '../api/session';
import type {ManifestKind,ManifestEntry} from '../api/liveFrontDesk';
import {recommendedDeskAction,pageAttentionCount} from '../features/front-desk/deskActions';
import {Heading,Panel,Status} from '../components/ui';
import {QueryFeedback} from '../components/QueryFeedback';
import {addDays,hotelToday} from '../features/reservations/calendarDate';
import {dateLabel,statusLabel} from '../lib/format';

const queues:{kind:ManifestKind;title:string}[]=[
 {kind:'arrivals',title:'Arrivals'},
 {kind:'departures',title:'Departures'},
 {kind:'in_house',title:'In-house'},
];
const displayGuest=(record:ManifestEntry)=>record.guestName?.trim()||'Guest name unavailable';

export function LiveFrontDesk(){
 const [date,setDate]=useState(hotelToday);
 const [kind,setKind]=useState<ManifestKind>('arrivals');
 const [pageByKind,setPageByKind]=useState<Record<ManifestKind,number>>({
  arrivals:1,departures:1,in_house:1,
 });
 const [search,setSearch]=useState('');
 const client=useQueryClient();
 const {hotelId}=readSession();
 const arrivals=useLiveManifest(date,'arrivals',pageByKind.arrivals);
 const departures=useLiveManifest(date,'departures',pageByKind.departures);
 const inHouse=useLiveManifest(date,'in_house',pageByKind.in_house);
 const queries={arrivals,departures,in_house:inHouse};
 const current=queries[kind];
 const rows=current.data?.data??[];
 const term=search.trim().toLocaleLowerCase();
 const filtered=rows.filter(row=>!term||[
  displayGuest(row),row.reference,row.roomNumber??'',row.id,
 ].some(value=>value.toLocaleLowerCase().includes(term)));
 const count=(name:ManifestKind)=>queries[name].data?.meta.total??'—';
 const page=current.data?.meta.page??pageByKind[kind];
 const pages=current.data?.meta.totalPages??0;
 const changeDate=(next:string)=>{
  setDate(next);setPageByKind({arrivals:1,departures:1,in_house:1});setSearch('');
 };
 useEffect(()=>{changeDate(hotelToday());setKind('arrivals');},[hotelId]);
 const refresh=()=>void client.invalidateQueries({queryKey:['live','front-desk','manifest',hotelId]});
 if(!hotelId)return <>
  <Heading title="Front desk" description="Select an authorized hotel to open its operational queues."/>
  <Panel title="Hotel selection required"><p role="status">Select your hotel before loading arrivals, departures or in-house stays.</p></Panel>
 </>;
 return <>
  <div className="fdc-heading">
   <Heading title="Front desk" description="Your daily arrival, departure and room-assignment workspace."/>
   <div className="fdc-heading-actions">
    <button type="button" className="btn-inline" onClick={refresh}><RefreshCw size={15}/> Refresh</button>
    <Link to="/reservations" className="btn-primary"><Plus size={16}/> New reservation</Link>
   </div>
  </div>
  <div className="fdc-date-strip">
   <div className="desk-date-nav">
    <button type="button" className="icon-btn" aria-label="Previous date" onClick={()=>changeDate(addDays(date,-1))}><ArrowLeft size={16}/></button>
    <button type="button" className="btn-inline" onClick={()=>changeDate(hotelToday())}>Today</button>
    <button type="button" className="icon-btn" aria-label="Next date" onClick={()=>changeDate(addDays(date,1))}><ArrowRight size={16}/></button>
    <label><CalendarDays size={16}/><input type="date" aria-label="Front desk operational date"
     value={date} onChange={event=>changeDate(event.target.value||hotelToday())}/></label>
   </div>
   <span><Clock3 size={15}/> {dateLabel(date)} · Hotel-local date</span>
  </div>
  <section className="fdc-stats" aria-label="Reservation queue summary">
   <button type="button" className={'fdc-stat'+(kind==='arrivals'?' active':'')} onClick={()=>{setKind('arrivals');setSearch('');}}>
    <LogIn size={20}/><span>Expected arrivals</span><strong>{count('arrivals')}</strong><small>Confirmed for this date</small>
   </button>
   <button type="button" className={'fdc-stat'+(kind==='departures'?' active':'')} onClick={()=>{setKind('departures');setSearch('');}}>
    <LogOut size={20}/><span>Due departures</span><strong>{count('departures')}</strong><small>Checked-in stays due</small>
   </button>
   <button type="button" className={'fdc-stat'+(kind==='in_house'?' active':'')} onClick={()=>{setKind('in_house');setSearch('');}}>
    <Users size={20}/><span>In-house</span><strong>{count('in_house')}</strong><small>Registered stays</small>
   </button>
   <button type="button" className="fdc-stat attention" onClick={()=>{setKind('arrivals');setSearch('');}}>
    <AlertTriangle size={20}/><span>Need room assignment</span>
    <strong>{arrivals.data?pageAttentionCount(arrivals.data.data):'—'}</strong>
    <small>Arrivals on loaded page only</small>
   </button>
  </section>
  <section className="fdc-workspace" aria-label="Daily front desk work queue">
   <div className="fdc-workspace-heading">
    <div><h3>Reservations for {dateLabel(date)}</h3><p>Choose a queue, find a guest, then take the next action.</p></div>
    <Link to="/room-calendar" className="fdc-secondary-link"><BedDouble size={16}/> Room calendar <ArrowRight size={14}/></Link>
   </div>
   <div className="fdc-controls">
    <div className="view-switch" role="group" aria-label="Live front desk queues">
     {queues.map(item=><button type="button" key={item.kind} aria-pressed={kind===item.kind}
      className={kind===item.kind?'selected':''} onClick={()=>{setKind(item.kind);setSearch('');}}>
      {item.title} <span className="desk-tab-count">{count(item.kind)}</span>
     </button>)}
    </div>
    <label className="search-box"><Search size={16}/><input value={search}
     aria-label="Search current manifest page" placeholder="Guest, room or reference on this page"
     onChange={event=>setSearch(event.target.value)}/></label>
   </div>
   <QueryFeedback loading={current.isPending} error={current.error} onRetry={()=>void current.refetch()}
    empty={current.isSuccess&&filtered.length===0}
    emptyMessage={term?'No matches on this page. Clear search or browse another page.':'No reservations in this queue on the selected date.'}/>
   {current.isSuccess&&filtered.length>0&&<div className="fdc-queue">
    {filtered.map(row=>{
     const action=recommendedDeskAction(kind,row);
     const needsAssignment=kind==='arrivals'&&!row.assignedRoomId;
     return <article className="fdc-guest-row" key={row.id}>
      <div className="fdc-guest-primary">
       <strong>{displayGuest(row)}</strong><span>{row.reference}</span>
      </div>
      <div className="fdc-guest-stay">
       <small>Stay</small><strong>{dateLabel(row.checkIn)} – {dateLabel(row.checkOut)}</strong>
      </div>
      <div className="fdc-guest-room">
       <small>Room</small>
       <strong>{row.roomNumber??'Not assigned'}</strong>
       {needsAssignment&&<span className="fdc-issue"><AlertTriangle size={13}/> Assignment needed</span>}
      </div>
      <div className="fdc-guest-status">
       <small>Status</small><Status value={statusLabel(row.status)}/>
      </div>
      <div className="fdc-guest-actions">
       <Link to="/reservations" search={{booking:row.id,...(action.kind==='view'?{}:{deskAction:action.kind})}} className="fdc-action-link">
        {action.kind==='assign'?<BedDouble size={16}/>:action.kind==='check-in'?<LogIn size={16}/>:action.kind==='check-out'?<LogOut size={16}/>:<ClipboardCheck size={16}/>}
        {action.label} <ArrowRight size={15}/>
       </Link>
       <span>{action.hint}</span>
      </div>
     </article>;
    })}
   </div>}
   {current.isSuccess&&<div className="fdc-pagination">
    <span>Page {page} of {Math.max(1,pages)} · {current.data.meta.total} total · Search covers this page</span>
    <div>
     <button type="button" className="btn-inline" disabled={page<=1} onClick={()=>setPageByKind(prev=>({...prev,[kind]:page-1}))}>Previous</button>
     <button type="button" className="btn-inline" disabled={page>=pages} onClick={()=>setPageByKind(prev=>({...prev,[kind]:page+1}))}>Next</button>
    </div>
   </div>}
  </section>
  <p className="fdc-safety-note"><AlertTriangle size={17}/>
   Actions open the existing guarded reservation workflow for review and confirmation. This screen does not verify room cleanliness, cash collection or actual physical occupancy. The unassigned count covers only the loaded arrivals page.
  </p>
 </>;
}
