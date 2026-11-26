import {useMemo,useState} from 'react';
import {Link} from '@tanstack/react-router';
import {AlertTriangle,ArrowRight,BedDouble,CalendarDays,ChevronLeft,ChevronRight,ClipboardList,LogIn,LogOut,Plus,RefreshCw,Search,RotateCcw,X} from 'lucide-react';
import {useRoomCalendar} from '../api/liveRoomCalendar';
import type {LiveRecord,ReservationListFilter,BookingDateOptions} from '../api/liveReservations';
import {addDays,hotelToday} from '../features/reservations/calendarDate';
import {nextReservationAction} from '../features/reservations/managementWorkflow';
import {readableDate} from '../lib/format';
import {QueryFeedback} from '../components/QueryFeedback';

type Pagination={page:number;perPage:number;total:number;totalPages:number};
type Props={
 dates:BookingDateOptions;onDates:(value:BookingDateOptions)=>void;
 rows:LiveRecord[];pagination:Pagination|undefined;
 isPending:boolean;isError:boolean;error:Error|null;isFetching:boolean;
 searching:boolean;search:string;filter:ReservationListFilter;page:number;
 canOperate:boolean;onSearch:(value:string)=>void;onFilter:(value:ReservationListFilter)=>void;
 onPage:(value:number)=>void;onClear:()=>void;onRefresh:()=>void;
 onOpen:(id:string)=>void;onNew:()=>void;
};
const filters:[ReservationListFilter,string][]=[
 ['all','All bookings'],['arrivals','Confirmed'],['in_house','Checked in'],
 ['checked_out','Checked out'],['cancelled','Cancelled'],['no_show','No-show'],['needs_room','Needs room'],
];
const lifecycleName=(value:string|null)=>{
 switch(value){
  case 'confirmed':return 'Confirmed';
  case 'checked_in':return 'Checked in';
  case 'checked_out':return 'Checked out';
  case 'cancelled':return 'Cancelled';
  case 'no_show':return 'No-show';
  case 'pending':return 'Pending';
  default:return value?.replaceAll('_',' ')??'Unknown';
 }
};
const tileStatus=(state:string)=>state==='checked_in'?'inhouse':
 state==='confirmed'?'confirmed':state==='checked_out'?'departed':'other';

export function LiveBookingsWorkspace({
 rows,pagination,isPending,isError,error,isFetching,searching,search,filter,page,canOperate,
 onSearch,onFilter,onPage,onClear,onRefresh,onOpen,onNew,dates,onDates,
}:Props){
 const [showDates,setShowDates]=useState(false);
 const [showSnapshot,setShowSnapshot]=useState(false);
 const [roomDay,setRoomDay]=useState(hotelToday);
 const [floor,setFloor]=useState('all');
 const [roomPage,setRoomPage]=useState(1);
 const roomMap=useRoomCalendar({start:roomDay,end:addDays(roomDay,1),
  page:roomPage,floor,roomTypeId:'',search:''});
 const roomData=roomMap.data?.data;
 const roomMeta=roomMap.data?.meta;
 const roomFloors=useMemo(()=>Array.from(new Set((roomData?.rooms??[])
  .map(room=>room.floor).filter((value):value is number=>value!==null)))
  .sort((a,b)=>a-b),[roomData?.rooms]);
 const displayedRooms=roomData?.rooms??[];
 const roomCoverage=(roomMeta?.totalPages??0)>1
  ?'Showing '+displayedRooms.length+' of '+roomMeta?.total+' rooms · browse pages for more'
  :'Room assignments for selected date';
 const bookingForRoom=(roomId:string)=>(roomData?.bookings??[])
  .filter(booking=>booking.roomId===roomId&&booking.checkIn<=roomDay&&booking.checkOut>roomDay)
  .sort((a,b)=>(a.status==='checked_in'?-1:0)-(b.status==='checked_in'?-1:0))[0];
 const roomBlocked=(id:string)=>(roomData?.blocks??[])
  .some(b=>b.roomId===id&&b.checkIn<=roomDay&&b.checkOut>roomDay);
 const visibleCounts={
  confirmed:rows.filter(row=>row.lifecycleState==='confirmed').length,
  checked_in:rows.filter(row=>row.lifecycleState==='checked_in').length,
  checked_out:rows.filter(row=>row.lifecycleState==='checked_out').length,
  cancelled:rows.filter(row=>row.lifecycleState==='cancelled').length,
 };
 const filtersActive=search.trim().length>0||filter!=='all'||!!dates.from||!!dates.to||dates.field!=='created_at'||dates.sortBy!=='created_at'||dates.direction!=='desc';
 return <div className="bk-workspace">
  <div className="bk-overview">
   <section className={'bk-room-panel'+(showSnapshot?' bk-snapshot-expanded':'')} aria-label="Room assignment snapshot">
    <div className="bk-section-heading">
     <div><h3><BedDouble size={18}/> Room snapshot</h3>
      <p>Reservations assigned to rooms for {readableDate(roomDay)}</p></div>
     <Link to="/room-calendar" search={{date:roomDay}} className="btn-inline">
      Full calendar <ArrowRight size={14}/></Link>
    </div>
    <button type="button" className="btn-inline bk-snapshot-toggle" aria-expanded={showSnapshot} aria-controls="booking-room-snapshot" onClick={()=>setShowSnapshot(v=>!v)}>{showSnapshot?'Hide room snapshot':'Show room snapshot'} <BedDouble size={16}/></button>
    <div id="booking-room-snapshot" className="bk-snapshot-content">
    <div className="bk-room-toolbar">
     <label>Date <input aria-label="Room snapshot date" type="date" value={roomDay}
      onChange={e=>{if(e.target.value){setRoomDay(e.target.value);setRoomPage(1);}}}/></label>
     <label>Floor <select aria-label="Room floor" value={floor}
      onChange={e=>{setFloor(e.target.value);setRoomPage(1);}}>
      <option value="all">All floors</option>
      {roomFloors.map(n=><option value={n} key={n}>Floor {n}</option>)}
     </select></label>
     <button type="button" aria-label="Refresh room snapshot" className="btn-inline"
      disabled={roomMap.isFetching} onClick={()=>void roomMap.refetch()}><RefreshCw size={15}/></button>
    </div>
    <QueryFeedback loading={roomMap.isPending} error={roomMap.error}
     onRetry={()=>void roomMap.refetch()}/>
    {roomMap.isSuccess&&<div className="bk-room-grid">
     {displayedRooms.map(room=>{
      const booking=bookingForRoom(room.id);
      const blocked=roomBlocked(room.id);
      const kind=blocked?'blocked':booking?tileStatus(booking.status??'other'):'empty';
      const label='Room '+room.number+': '+(blocked?'maintenance block':
       booking?lifecycleName(booking.status)+' · '+(booking.guestName??booking.reference):
       'no assigned reservation (readiness not verified)');
      return <button type="button" key={room.id} title={label}
       className={'bk-room-tile bk-room-'+kind}
       aria-label={label}
       onClick={()=>booking?onOpen(booking.id):undefined}
       disabled={!booking}>
       <strong>{room.number}</strong><small>{blocked?'Blocked':
        booking?lifecycleName(booking.status):'No assignment'}</small>
      </button>;
     })}
     {displayedRooms.length===0&&<p>No rooms match this floor and date.</p>}
    </div>}
    <div className="bk-room-legend">
     <span><i className="bk-key-inhouse"/>Checked in</span>
     <span><i className="bk-key-confirmed"/>Confirmed</span>
     <span><i className="bk-key-blocked"/>Blocked</span>
     <span><i className="bk-key-empty"/>No assignment</span>
    </div>
    <div className="bk-room-foot">
     <small>{roomCoverage}. Not a housekeeping, physical occupancy or availability check.</small>
     {roomMeta&&roomMeta.totalPages>1&&<div className="bk-pager">
      <button type="button" className="btn-inline" disabled={roomPage<=1}
       onClick={()=>setRoomPage(n=>n-1)} aria-label="Previous room page"><ChevronLeft size={15}/></button>
      <span>{roomPage}/{roomMeta.totalPages}</span>
      <button type="button" className="btn-inline" disabled={roomPage>=roomMeta.totalPages}
       onClick={()=>setRoomPage(n=>n+1)} aria-label="Next room page"><ChevronRight size={15}/></button>
     </div>}
    </div>
    </div>
   </section>
   <section className="bk-kpis" aria-label="Reservation list overview">
    <div className="bk-kpi"><span><ClipboardList size={16}/> Matching bookings</span>
     <strong>{pagination?.total??'—'}</strong><small>All matching records across pages</small></div>
    <div className="bk-kpi"><span><CalendarDays size={16}/> Confirmed</span>
     <strong>{isError?'—':visibleCounts.confirmed}</strong><small>On this booking list page</small></div>
    <div className="bk-kpi"><span><LogIn size={16}/> Checked in</span>
     <strong>{isError?'—':visibleCounts.checked_in}</strong><small>On this booking list page</small></div>
    <div className="bk-kpi"><span><LogOut size={16}/> Checked out</span>
     <strong>{isError?'—':visibleCounts.checked_out}</strong><small>On this booking list page</small></div>
   </section>
  </div>
  <section className="bk-list-panel" aria-label="Bookings list">
   <div className="bk-section-heading">
    <div><h3><ClipboardList size={18}/> Booking list</h3>
     <p>Search guest names, booking references or room numbers. Open a booking to manage its stay.</p></div>
    {canOperate&&<button type="button" className="btn-primary" onClick={onNew}><Plus size={16}/> Add booking</button>}
   </div>
   <div style={{display:'grid',gap:12,marginTop:12}}>
        <div className="bk-filter-tabs" role="group" aria-label="Booking lifecycle filters">
     {filters.map(([value,label])=><button type="button" key={value}
      aria-pressed={filter===value} className={filter===value?'selected':''}
      onClick={()=>onFilter(value)}>{label}</button>)}
    </div>

    <div className="bk-filter-tools" style={{display:'flex',flexWrap:'wrap',alignItems:'center',gap:8}}>
     <div style={{flex:'1 1 280px',minWidth:0}}>    <label className="bk-search"><Search size={17}/>
     <input type="search" value={search} onChange={e=>onSearch(e.target.value)}
      aria-label="Search bookings" placeholder="Search guest, booking reference, or room…"/>
     {search&&<button type="button" aria-label="Clear search" onClick={()=>onSearch('')}><X size={15}/></button>}
    </label>
</div>
     <button type="button" className="btn-inline" aria-expanded={showDates} aria-controls="booking-date-filters" onClick={()=>setShowDates(v=>!v)} style={{whiteSpace:'nowrap',display:'inline-flex',alignItems:'center',gap:6}}>
      <CalendarDays size={16}/> Dates{dates.from||dates.to?' (active)':''} {showDates?'▴':'▾'}
     </button>
     <label style={{display:'flex',alignItems:'center',gap:8,flex:'0 1 auto',minWidth:0,fontSize:12,fontWeight:600}}> Sort by <select className="wizard-input" aria-label="Sort bookings" style={{minWidth:0,maxWidth:"100%"}} value={dates.sortBy+':'+dates.direction} onChange={e=>{const [sortBy,direction]=e.target.value.split(':');onDates({...dates,sortBy:sortBy as BookingDateOptions['sortBy'],direction:direction as BookingDateOptions['direction']});}}>
     <option value="created_at:desc">Created · newest first</option><option value="created_at:asc">Created · oldest first</option>
     <option value="check_in:asc">Check-in · earliest first</option><option value="check_in:desc">Check-in · latest first</option>
     <option value="check_out:asc">Check-out · earliest first</option><option value="check_out:desc">Check-out · latest first</option>
     <option value="updated_at:desc">Updated · newest first</option><option value="updated_at:asc">Updated · oldest first</option>
    </select></label>
     <button type="button" className="btn-inline" aria-label="Refresh bookings" title="Refresh bookings" disabled={isFetching} onClick={onRefresh}><RefreshCw size={16}/></button>
    </div>
    {showDates&&<div id="booking-date-filters" style={{display:'grid',gap:12,padding:12,border:'1px solid var(--border, #e2e8f0)',borderRadius:10}}>
     <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:8,flexWrap:'wrap'}}>
      <strong style={{fontSize:13}}>Date range</strong>
      {(dates.from||dates.to)&&<button type="button" className="btn-inline" onClick={()=>onDates({...dates,from:'',to:''})}><X size={14}/> Clear dates</button>}
     </div>
     <div className="bk-filter-tabs" role="group" aria-label="Quick booking date ranges">
      {['All dates','Today','Yesterday','Last 7 days','This month'].map(preset=>{
       const today=hotelToday();
       const from=preset==='All dates'?'':preset==='Yesterday'?addDays(today,-1):preset==='Last 7 days'?addDays(today,-6):preset==='This month'?today.slice(0,7)+'-01':today;
       const nextMonth=new Date(today.slice(0,7)+'-01T00:00:00Z');nextMonth.setUTCMonth(nextMonth.getUTCMonth()+1);
       const to=preset==='All dates'?'':preset==='Yesterday'?from:preset==='This month'?addDays(nextMonth.toISOString().slice(0,10),-1):today;
       const active=dates.from===from&&dates.to===to;
       return <button type="button" key={preset} aria-pressed={active} className={active?'selected':''} onClick={()=>onDates({...dates,from,to})}>{preset}</button>;
      })}
     </div>
     <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(min(100%, 180px),1fr))',gap:10}}>
          <label style={{display:"grid",gap:4,fontSize:12,fontWeight:600,minWidth:0}}>Filter by date <select className="wizard-input" value={dates.field} onChange={e=>onDates({...dates,field:e.target.value as BookingDateOptions['field']})}>
     <option value="created_at">Date created</option><option value="check_in">Check-in</option><option value="check_out">Check-out</option><option value="stay">Stay period</option><option value="updated_at">Last updated</option>
    </select></label>
    <label style={{display:"grid",gap:4,fontSize:12,fontWeight:600,minWidth:0}}>From <input className="wizard-input" type="date" value={dates.from} max={dates.to||undefined} onChange={e=>onDates({...dates,from:e.target.value,to:dates.to&&e.target.value>dates.to?'':dates.to})}/></label>
    <label style={{display:"grid",gap:4,fontSize:12,fontWeight:600,minWidth:0}}>To <input className="wizard-input" type="date" value={dates.to} min={dates.from||undefined} onChange={e=>onDates({...dates,to:e.target.value,from:dates.from&&e.target.value&&e.target.value<dates.from?'':dates.from})}/></label>

     </div>
     <button type="button" className="btn-inline" onClick={()=>setShowDates(false)}>Done · Hide date filters</button>
    </div>}
   </div>
   <div className="bk-results-bar" role="status">
    <span>{searching?'Searching…':isPending?'Loading bookings…':
     isError?'Booking list unavailable':
     (pagination?.total??0)+' bookings found · page '+(pagination?.page??1)+' of '+Math.max(1,pagination?.totalPages??1)}</span>
    {filtersActive&&<button type="button" onClick={onClear}><RotateCcw size={14}/> Clear filters</button>}
   </div>
   <QueryFeedback loading={isPending||searching} error={error} onRetry={onRefresh}
    empty={!searching&&!isPending&&!isError&&rows.length===0}
    emptyMessage={filtersActive?'No bookings match the selected filters. Clear filters to see all reservations.':
      'No reservations yet. Add a booking to get started.'}/>
   {!isPending&&!isError&&!searching&&rows.length>0&&<div className="bk-table-scroll">
    <table className="bk-table">
     <thead><tr><th>Guest / Booking</th><th>Room</th><th>Stay dates</th><th>Date created</th>
      <th>Status</th><th>Contact</th><th>Next step</th><th>Actions</th></tr></thead>
     <tbody>{rows.map(record=><tr key={record.id}>
      <td><button type="button" className="bk-guest-link" onClick={()=>onOpen(record.id)}>
       {record.guestName?.trim()||'Guest details unavailable'}</button>
       <small className="bk-ref">{record.reference}</small>
       {record.earlyCheckIn&&<small className="bk-early">Early check-in</small>}</td>
      <td><strong>{record.assignedRoomNumber?'Room '+record.assignedRoomNumber:'Unassigned'}</strong>
       <small>{record.roomTypeName??'Room type #'+record.roomTypeId}</small></td>
      <td><span>{readableDate(record.checkIn)}</span>
       <small>to {readableDate(record.checkOut)}</small></td>
      <td>{record.createdDate?readableDate(record.createdDate):'—'}</td>
      <td><span className={'bk-state bk-state-'+(record.lifecycleState??'unknown').replaceAll('_','-')}>
       {lifecycleName(record.lifecycleState)}</span></td>
      <td><span className="bk-contact">{record.guestPhone?.trim()||'Not provided'}</span></td>
      <td><span className="bk-next">{nextReservationAction(record)}</span></td>
      <td><div className="bk-actions">
       <button type="button" className="btn-inline" onClick={()=>onOpen(record.id)}>
        {['confirmed','checked_in'].includes(record.lifecycleState??'')
         ?nextReservationAction(record):'View details'} <ArrowRight size={14}/></button>
       <Link to="/billing" search={{booking:record.id}} className="bk-folio-link">Billing</Link>
      </div></td>
     </tr>)}</tbody>
    </table>
   </div>}
   {!isPending&&!isError&&!searching&&rows.length>0&&<div className="bk-mobile-cards" aria-label="Mobile booking list">
    {rows.map(record=><article className="bk-mobile-card" key={record.id}>
     <div className="bk-mobile-card-head">
      <div><button type="button" className="bk-guest-link" onClick={()=>onOpen(record.id)}>{record.guestName?.trim()||'Guest details unavailable'}</button>
       <small className="bk-ref">{record.reference}</small>
       {record.earlyCheckIn&&<small className="bk-early">Early check-in</small>}</div>
      <span className={'bk-state bk-state-'+(record.lifecycleState??'unknown').replaceAll('_','-')}>{lifecycleName(record.lifecycleState)}</span>
     </div>
     <dl className="bk-mobile-facts">
      <div><dt>Room</dt><dd>{record.assignedRoomNumber?'Room '+record.assignedRoomNumber:'Unassigned'}<small>{record.roomTypeName??'Room type #'+record.roomTypeId}</small></dd></div>
      <div><dt>Stay dates</dt><dd>{readableDate(record.checkIn)}<small>to {readableDate(record.checkOut)}</small></dd></div>
      <div><dt>Date created</dt><dd>{record.createdDate?readableDate(record.createdDate):'—'}</dd></div>
      <div><dt>Contact</dt><dd>{record.guestPhone?.trim()||'Not provided'}</dd></div>
      <div><dt>Next step</dt><dd>{nextReservationAction(record)}</dd></div>
     </dl>
     <div className="bk-mobile-actions">
      <button type="button" className="btn-primary" onClick={()=>onOpen(record.id)}>{['confirmed','checked_in'].includes(record.lifecycleState??'')?nextReservationAction(record):'View details'} <ArrowRight size={16}/></button>
      <Link to="/billing" search={{booking:record.id}} className="bk-folio-link">Billing</Link>
     </div>
    </article>)}
   </div>}
   {pagination&&pagination.totalPages>1&&<div className="bk-list-footer">
    <span>{pagination.perPage} bookings per page · {pagination.total} matching</span>
    <div className="bk-pager">
     <button type="button" className="btn-inline" disabled={page<=1} onClick={()=>onPage(page-1)}>
      <ChevronLeft size={15}/> Previous</button>
     <span>Page {page} / {pagination.totalPages}</span>
     <button type="button" className="btn-inline" disabled={page>=pagination.totalPages}
      onClick={()=>onPage(page+1)}>Next <ChevronRight size={15}/></button>
    </div>
   </div>}
   <p className="bk-list-note"><AlertTriangle size={14}/> These are reservation lifecycle statuses.
    Confirmed does not mean checked in, and checked out does not mean a drawer is reconciled.
    Room readiness and payment details are checked in their respective workflows.</p>
  </section>
 </div>;
}
