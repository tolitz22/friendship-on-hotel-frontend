import {useState} from 'react';
import {Link} from '@tanstack/react-router';
import {ArrowLeft,ArrowRight,BedDouble,CalendarDays,LogIn,LogOut,Search,Users,AlertTriangle} from 'lucide-react';
import {useLiveManifest} from '../api/liveFrontDesk';
import {readSession} from '../api/session';
import type {ManifestKind,ManifestEntry} from '../api/liveFrontDesk';
import {Heading,Panel,Status} from '../components/ui';
import {QueryFeedback} from '../components/QueryFeedback';
import {addDays,hotelToday} from '../features/reservations/calendarDate';
import {dateLabel,statusLabel} from '../lib/format';

const labels:{kind:ManifestKind;title:string}[]=[
 {kind:'arrivals',title:'Arrivals'},
 {kind:'departures',title:'Departures'},
 {kind:'in_house',title:'In-house'},
];

function displayGuest(record:ManifestEntry):string{
 return record.guestName?.trim()||'Guest name unavailable';
}

export function LiveFrontDesk(){
 const [date,setDate]=useState(hotelToday);
 const [kind,setKind]=useState<ManifestKind>('arrivals');
 const [pageByKind,setPageByKind]=useState<Record<ManifestKind,number>>({
  arrivals:1,departures:1,in_house:1,
 });
 const [search,setSearch]=useState('');
 const arrivals=useLiveManifest(date,'arrivals',pageByKind.arrivals);
 const departures=useLiveManifest(date,'departures',pageByKind.departures);
 const inHouse=useLiveManifest(date,'in_house',pageByKind.in_house);
 const queries={arrivals,departures,in_house:inHouse};
 const current=queries[kind];
 const hasHotel=!!readSession().hotelId;
 const rows=current.data?.data??[];
 const term=search.trim().toLocaleLowerCase();
 const filtered=term?rows.filter(r=>[
  displayGuest(r),r.reference,r.roomNumber??'',r.id
 ].some(value=>value.toLocaleLowerCase().includes(term))):rows;

 const changeDate=(next:string)=>{
  setDate(next);
  setPageByKind({arrivals:1,departures:1,in_house:1});
  setSearch('');
 };
 const count=(name:ManifestKind)=>queries[name].data?.meta.total??'—';
 const page=current.data?.meta.page??pageByKind[kind];
 const pages=current.data?.meta.totalPages??0;
 if(!hasHotel)return <>
  <Heading title="Front desk" description="Select an authorized hotel to view its live arrival, departure and in-house reservations."/>
  <Panel title="Hotel selection required"><p role="status">Choose a hotel from your authenticated session before loading live front desk records.</p></Panel>
 </>;
 return <>
  <Heading title="Front desk" description="Review today's arrivals and departures. Manage a reservation from the Reservations workspace." action={<Link to="/reservations" className="inline-task-link">Manage reservations <ArrowRight size={15}/></Link>}/>
  <section className="desk-summary" aria-label="Live reservation queue totals">
   <div className="desk-stat"><LogIn size={21}/><span>Confirmed arrivals</span><strong>{count('arrivals')}</strong></div>
   <div className="desk-stat"><LogOut size={21}/><span>Scheduled departures</span><strong>{count('departures')}</strong></div>
   <div className="desk-stat"><Users size={21}/><span>In-house reservations</span><strong>{count('in_house')}</strong></div>
   <div className="desk-stat"><BedDouble size={21}/><span>Assigned arrivals on this page</span><strong>{arrivals.data?arrivals.data.data.filter(row=>row.assignedRoomId!==null).length:'—'}</strong></div>
  </section>
  <Panel title="Live front desk manifest">
   <div className="desk-tools">
    <div className="desk-date-nav">
     <button className="icon-btn" aria-label="Previous date" onClick={()=>changeDate(addDays(date,-1))}><ArrowLeft size={16}/></button>
     <button className="btn-inline" onClick={()=>changeDate(hotelToday())}>Today</button>
     <button className="icon-btn" aria-label="Next date" onClick={()=>changeDate(addDays(date,1))}><ArrowRight size={16}/></button>
     <label><CalendarDays size={16}/><input type="date" aria-label="Manifest date" value={date}
      onChange={e=>changeDate(e.target.value||hotelToday())}/></label>
    </div>
    <span className="table-count">{dateLabel(date)} · Hotel calendar date</span>
   </div>
   <div className="desk-tab-row">
    <div className="view-switch" role="group" aria-label="Live front desk queues">
     {labels.map(({kind:value,title})=><button key={value}
      aria-pressed={kind===value} className={kind===value?'selected':''}
      onClick={()=>{setKind(value);setSearch('');}}>
       {title} <span className="desk-tab-count">{count(value)}</span>
      </button>)}
    </div>
    <label className="search-box"><Search size={16}/><input
     aria-label="Search current manifest page" placeholder="Search this page by guest, reference or room"
     value={search} onChange={e=>setSearch(e.target.value)}/></label>
   </div>
   <QueryFeedback loading={current.isPending} error={current.error}
    onRetry={()=>void current.refetch()}
    empty={current.isSuccess&&filtered.length===0}
    emptyMessage={term?'No matches on this page. Clear search or change pages.':'No reservations in this queue for the chosen date.'}/>
   {current.isSuccess&&filtered.length>0&&<div className="table-scroll">
    <table><thead><tr><th>Guest & reservation</th><th>Stay</th><th>Assigned room</th><th>Status</th><th>Operational checks</th></tr></thead>
     <tbody>{filtered.map(row=><tr key={row.id}>
      <td><strong>{displayGuest(row)}</strong><span className="cell-note">{row.reference}</span></td>
      <td>{dateLabel(row.checkIn)} – {dateLabel(row.checkOut)}</td>
      <td>{row.roomNumber??'Unassigned'}</td>
      <td><Status value={statusLabel(row.status)}/></td>
      <td>{row.assignedRoomId===null
       ?<span className="desk-attention"><AlertTriangle size={14}/> Assign a room before check-in</span>
       :<span className="desk-muted">Verify guest identity and room readiness</span>}
       <Link to="/reservations" search={{booking:row.id}} className="inline-task-link">
        Manage this booking <ArrowRight size={14}/>
       </Link></td>
     </tr>)}</tbody>
    </table>
   </div>}
   {current.isSuccess&&<div className="desk-tools">
    <span className="table-count">Page {page} of {Math.max(1,pages)} · {current.data.meta.total} reservation(s). Search filters this page only.</span>
    <div className="desk-date-nav">
     <button className="btn-inline" disabled={page<=1}
      onClick={()=>setPageByKind(prev=>({...prev,[kind]:page-1}))}>Previous page</button>
     <button className="btn-inline" disabled={page>=pages}
      onClick={()=>setPageByKind(prev=>({...prev,[kind]:page+1}))}>Next page</button>
    </div>
   </div>}
   <div className="desk-preview-note">
    <AlertTriangle size={17}/>
    <p>Live queue data is based on saved reservation states and the selected hotel's date. Assigned rooms are not necessarily clean or guest-ready. Use the Reservations page to manage eligible assignments and check-in/out. No payments, keys or housekeeping actions are available here. Failed API requests never fall back to sample data.</p>
   </div>
  </Panel>
 </>;
}
