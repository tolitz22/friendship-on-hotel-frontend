import {useEffect,useMemo,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {Link} from '@tanstack/react-router';
import {
 AlertTriangle,ArrowRight,BedDouble,CalendarClock,CheckCircle2,ChevronLeft,
 ChevronRight,ClipboardCheck,DoorOpen,Grid2X2,Info,List,LockKeyhole,Menu,
 RefreshCw,Search,ShieldAlert,Users,X,
} from 'lucide-react';
import {useRoomRack,type RackRoom} from '../api/roomRack';
import {useLiveCatalogSummary,useLiveRoomTypes} from '../api/liveCatalogQueries';
import {RoomReadinessPanel} from './RoomReadinessPanel';
import {QueryFeedback} from './QueryFeedback';
import {readableDate,readableDateTime} from '../lib/format';
import {
 matchRackQuick,matchRackSearch,roomNextAction,roomProblem,roomTone,sortRackRooms,
 type RackQuickFilter,
} from '../features/rooms/roomRackModel';

const quickFilters=[
 ['all','All rooms'],['action','Needs action'],['arrivals','Arrivals today'],
 ['departures','Departures today'],['in_house','In house'],['cleaning','Needs cleaning'],
 ['review','Legacy review pending'],['blocked','Blocked'],['vacant_approved','Vacant & inspected'],
] as const satisfies ReadonlyArray<readonly [RackQuickFilter,string]>;

type Filters={floor:string;type:string;occupancy:string;readiness:string;cleaning:string;blocked:string;date:string;search:string};
const emptyFilters=():Filters=>({floor:'all',type:'all',occupancy:'all',readiness:'all',
 cleaning:'all',blocked:'all',date:'',search:''});
function matchDetails(room:RackRoom,filter:Filters,guestSearch:boolean):boolean{
 if(filter.floor!=='all'&&String(room.floor??'unassigned')!==filter.floor)return false;
 if(filter.type!=='all'&&room.roomTypeId!==filter.type)return false;
 if(filter.occupancy!=='all'&&room.occupancy!==filter.occupancy)return false;
 if(filter.readiness!=='all'&&room.readinessStatus!==filter.readiness)return false;
 if(filter.cleaning!=='all'&&room.cleaning!==filter.cleaning)return false;
 if(filter.blocked==='blocked'&&!room.blockers.activeInventoryBlockToday&&!room.blockers.activeRoomImpactMaintenance)return false;
 if(filter.blocked==='clear'&&(room.blockers.activeInventoryBlockToday||room.blockers.activeRoomImpactMaintenance))return false;
 if(filter.date&&room.currentStay?.checkOut!==filter.date&&room.upcomingStay?.checkIn!==filter.date)return false;
 return matchRackSearch(room,filter.search,guestSearch);
}
const stateLabel=(tone:ReturnType<typeof roomTone>)=>({
 occupied:'In house',reserved:'Upcoming reservation',approved:'Vacant · inspected',
 attention:'Readiness action',blocked:'Active restriction',unknown:'Readiness unverified',
})[tone];
const stateIcon=(tone:ReturnType<typeof roomTone>)=>({
 occupied:Users,reserved:CalendarClock,approved:CheckCircle2,
 attention:ClipboardCheck,blocked:ShieldAlert,unknown:Info,
})[tone];

function RackDrawer({room,hotelId,onClose,restoreFocus}:{
 room:RackRoom;hotelId:string;onClose:()=>void;restoreFocus:()=>void;
}){
 const dialog=useRef<HTMLElement|null>(null);
 useEffect(()=>{
  const previous=document.body.style.overflow;
  document.body.style.overflow='hidden';
  dialog.current?.focus();
  const keydown=(event:KeyboardEvent)=>{
   if(event.key==='Escape'){event.preventDefault();onClose();return;}
   if(event.key!=='Tab'||!dialog.current)return;
   const nodes=Array.from(dialog.current.querySelectorAll<HTMLElement>(
    'button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled])'));
   if(!nodes.length){event.preventDefault();dialog.current.focus();return;}
   if(event.shiftKey&&document.activeElement===nodes[0]){event.preventDefault();nodes[nodes.length-1].focus();}
   if(!event.shiftKey&&document.activeElement===nodes[nodes.length-1]){event.preventDefault();nodes[0].focus();}
  };
  window.addEventListener('keydown',keydown);
  return ()=>{document.body.style.overflow=previous;window.removeEventListener('keydown',keydown);restoreFocus();};
 },[onClose,restoreFocus]);
 const tone=roomTone(room);
 const problem=roomProblem(room);
 const Symbol=stateIcon(tone);
 const liveRoom={id:room.roomId,hotelId,number:room.roomNumber,
  floor:room.floor,roomTypeId:room.roomTypeId,
  roomTypeName:room.roomTypeName,maxOccupancy:room.maxOccupancy};
 return createPortal(<div className="rack-drawer-overlay" onMouseDown={event=>{
   if(event.currentTarget===event.target)onClose();
  }}>
  <section ref={dialog} className="rack-drawer" role="dialog" aria-modal="true" aria-label={'Room '+room.roomNumber+' details'} tabIndex={-1}>
   <div className="rack-drawer-head">
    <div><small>ROOM DETAILS · FLOOR {room.floor??'—'}</small>
     <h2>Room {room.roomNumber}</h2>
     <p>{room.roomTypeName} · {room.maxOccupancy} guests maximum</p></div>
    <button type="button" className="rack-close" aria-label="Close room details" onClick={onClose}><X size={20}/></button>
   </div>
   <div className="rack-drawer-scroll">
    <div className={'rack-status-line rack-tone-'+tone}>
     <Symbol size={17} aria-hidden="true"/><strong>{stateLabel(tone)}</strong>
     <span>{room.occupancy==='vacant'?'Vacant in PMS':room.occupancy==='due_for_checkout'?'Departure due':'Occupied in PMS'}</span>
    </div>
    {problem&&<p className="rack-drawer-problem" role="status"><AlertTriangle size={16}/>{problem}</p>}
    <section className="rack-drawer-section"><h3>Guest stay</h3>
     {room.currentStay?<div className="rack-stay">
      <strong>{room.currentStay.guestName??'Guest name unavailable'}</strong>
      <span>In house · {readableDate(room.currentStay.checkIn)} – {readableDate(room.currentStay.checkOut)}</span>
      <Link to="/reservations" search={{booking:room.currentStay.bookingId}}>Open reservation <ArrowRight size={15}/></Link>
     </div>:<p className="desk-muted">No guest is currently checked in according to PMS records.</p>}
     {room.upcomingStay&&<div className="rack-stay">
      <strong>{room.upcomingStay.guestName??'Guest name unavailable'}</strong>
      <span>Confirmed · {readableDate(room.upcomingStay.checkIn)} – {readableDate(room.upcomingStay.checkOut)}</span>
      <Link to="/reservations" search={{booking:room.upcomingStay.bookingId}}>Review upcoming booking <ArrowRight size={15}/></Link>
     </div>}
    </section>
    <section className="rack-drawer-section"><h3>What needs doing?</h3>
     <strong>{roomNextAction(room)}</strong>
     <p className="desk-muted">Housekeeping, inspections, maintenance and inventory restrictions are independent records.</p>
     <div className="rack-drawer-links">
      {room.openHousekeepingTaskId&&<Link to="/housekeeping" search={{task:room.openHousekeepingTaskId}}>
       Open housekeeping task <ArrowRight size={14}/></Link>}
      {room.activeMaintenanceOrderId&&<Link to="/maintenance" search={{order:room.activeMaintenanceOrderId}}>
       Open maintenance order <ArrowRight size={14}/></Link>}
      {room.activeInventoryBlockId&&<Link to="/room-calendar" search={{date:undefined,room:room.roomNumber}}>
       Review inventory block <ArrowRight size={14}/></Link>}
     </div>
    </section>
    <section className="rack-drawer-section"><h3>Housekeeping and inspection evidence</h3>
     <dl className="rack-evidence">
      <div><dt>Cleaning</dt><dd>{room.cleaning.replaceAll('_',' ')}</dd></div>
      <div><dt>Inspection</dt><dd>{room.inspectionStatus??'No inspection recorded'}</dd></div>
      <div><dt>Current readiness</dt><dd>{room.advisoryReady?'Current inspection approved':'Not currently verified'}</dd></div>
      <div><dt>Last cleaned</dt><dd>{room.cleanedAt?readableDateTime(room.cleanedAt):'Not recorded'}</dd></div>
      <div><dt>Inspected</dt><dd>{room.inspectedAt?readableDateTime(room.inspectedAt):'Not recorded'}</dd></div>
      {room.reviewedAt&&<div><dt>Historical review</dt><dd>{readableDateTime(room.reviewedAt)}</dd></div>}
     </dl>
    </section>
    <RoomReadinessPanel room={liveRoom} onClose={onClose}/>
    <details className="rack-disclosure"><summary>What these statuses mean</summary>
     <p>PMS vacancy is not a booking-availability result. A completed inspection does not guarantee identity, occupancy, future inventory or settlement. Check-in readiness is enforced only if the hotel policy enables it.</p>
    </details>
   </div>
  </section>
 </div>,document.body);
}

export function RoomRackDashboard({hotelId}:{hotelId:string}){
 const [page,setPage]=useState(1);
 const [perPage,setPerPage]=useState(100);
 const [quick,setQuick]=useState<RackQuickFilter>('all');
 const [filter,setFilter]=useState<Filters>(emptyFilters);
 const [listView,setListView]=useState(false);
 const [filtersOpen,setFiltersOpen]=useState(false);
 const [selected,setSelected]=useState<RackRoom|null>(null);
 const trigger=useRef<HTMLButtonElement|null>(null);
 const rack=useRoomRack(page,perPage,7);
 const catalog=useLiveCatalogSummary();
 const roomTypes=useLiveRoomTypes();
 const data=rack.data?.data;
 const meta=rack.data?.meta;
 const arrivals=data?.arrivals??[];
 const visible=useMemo(()=>data?sortRackRooms(data.rooms.filter(room=>
  matchRackQuick(room,quick,data.hotelDate,arrivals)&&matchDetails(room,filter,true)),arrivals,data.hotelDate):[],
 [data,arrivals,quick,filter]);
 const unassigned=arrivals.filter(a=>a.checkIn===data?.hotelDate&&a.risk==='unassigned_room');
 const chips=([
  ['Floor',filter.floor,'floor'],['Room type',filter.type,'type'],
  ['Occupancy',filter.occupancy,'occupancy'],['Readiness',filter.readiness,'readiness'],
  ['Cleaning',filter.cleaning,'cleaning'],['Block',filter.blocked,'blocked'],
  ['Date',filter.date||'all','date'],['Search',filter.search||'all','search'],
 ] as const).filter(([,value])=>value!=='all');
 const clear=()=>{setQuick('all');setFilter(emptyFilters());setPage(1);};
 useEffect(()=>{setPage(1);setQuick('all');setFilter(emptyFilters());setSelected(null);},[hotelId]);
 const select=(room:RackRoom,button:HTMLButtonElement)=>{trigger.current=button;setSelected(room);};
 const close=()=>setSelected(null);
 const restore=()=>trigger.current?.focus();
 const summary=data?.summary;
 return <section className="rack-dashboard" aria-label="Live hotel room rack">
  <div className="rack-heading">
   <div><span className="rr-eyebrow">LIVE PMS SNAPSHOT</span>
    <h2>Room status</h2><p>Recorded stays, cleaning, inspections and restrictions — each shown separately.</p></div>
   <button className="rr-secondary-action" disabled={rack.isFetching} type="button" onClick={()=>void rack.refetch()}>
    <RefreshCw size={16}/>{rack.isFetching?'Refreshing…':'Refresh'}</button>
  </div>
  <QueryFeedback loading={rack.isPending} error={rack.error} onRetry={()=>void rack.refetch()}/>
  {summary&&<>
   {unassigned.length>0&&<div className="rack-unassigned" role="status">
    <AlertTriangle size={18}/><div><strong>{unassigned.length} unassigned arrival{unassigned.length===1?'':'s'} today</strong>
     <span>Room assignment is required before arrival check-in.</span></div>
    <Link to="/reservations" search={{}}>Assign rooms <ArrowRight size={15}/></Link>
   </div>}
   <div className="rack-metrics" aria-label="Hotel-wide room and arrival totals">
    {([
     ['Total rooms',summary.totalRooms,BedDouble,false],
     ['Vacant in PMS',summary.pmsVacantRooms,DoorOpen,false],
     ['Occupied in PMS',summary.pmsOccupiedRooms,Users,false],
     ['Arrivals today',summary.arrivalsToday,CalendarClock,false],
     ['Departures today',summary.departuresToday,ArrowRight,false],
     ['Open housekeeping',summary.roomsWithOpenHousekeeping,ClipboardCheck,true],
     ['Legacy reviews',summary.inspectionsAwaitingReview,Info,true],
     ['Active blockers',summary.activelyBlockedRooms,LockKeyhole,true],
    ] as const).map(([label,value,Symbol,problem])=><div className={'rack-metric'+(problem&&value>0?' rack-metric-alert':'')} key={label}>
     <span>{label}<Symbol size={16} aria-hidden="true"/></span><strong>{value}</strong>
    </div>)}
   </div>
   <div className="rack-controls">
    <div className="rack-view-switch" aria-label="Room display">
     <button type="button" aria-pressed={!listView} onClick={()=>setListView(false)}><Grid2X2 size={16}/> Grid</button>
     <button type="button" aria-pressed={listView} onClick={()=>setListView(true)}><List size={16}/> List</button>
    </div>
    <label className="rack-search"><Search size={16} aria-hidden="true"/>
     <input type="search" value={filter.search} onChange={e=>setFilter(f=>({...f,search:e.target.value}))}
      aria-label="Search loaded rooms by number or guest" placeholder="Room or guest…" /></label>
    <button type="button" className="rack-filter-toggle" aria-expanded={filtersOpen}
     onClick={()=>setFiltersOpen(v=>!v)}><Menu size={16}/> Filters</button>
    <label className="rack-floor">Floor
     <select value={filter.floor} aria-label="Filter by floor" onChange={e=>setFilter(f=>({...f,floor:e.target.value}))}>
      <option value="all">All floors</option>
      {(catalog.data?.data.floors??[]).map(row=>
       <option key={String(row.number)} value={row.number===null?'unassigned':String(row.number)}>
        {row.number===null?'Unassigned floor':'Floor '+row.number}</option>)}
     </select></label>
   </div>
   <div className="rack-quick" aria-label="Room quick filters">
    {quickFilters.map(([value,label])=><button type="button" key={value}
     aria-pressed={quick===value} className={quick===value?'active':''} onClick={()=>setQuick(value)}>{label}</button>)}
   </div>
   <div className={'rack-advanced'+(filtersOpen?' open':'')}>
    <label>Room type<select value={filter.type} onChange={e=>setFilter(f=>({...f,type:e.target.value}))}>
     <option value="all">All types</option>{(roomTypes.data?.data??[]).map(type=><option value={type.id} key={type.id}>{type.name}</option>)}
    </select></label>
    <label>PMS occupancy<select value={filter.occupancy} onChange={e=>setFilter(f=>({...f,occupancy:e.target.value}))}>
     <option value="all">All</option><option value="vacant">Vacant</option><option value="occupied">Occupied</option><option value="due_for_checkout">Departure due</option>
    </select></label>
    <label>Inspection<select value={filter.readiness} onChange={e=>setFilter(f=>({...f,readiness:e.target.value}))}>
     <option value="all">All</option><option value="approved_current">Current approved</option><option value="needs_inspection">Needs inspection</option>
     <option value="awaiting_review">Legacy pending</option><option value="blocked_or_stale">Blocked or outdated</option>
    </select></label>
    <label>Housekeeping<select value={filter.cleaning} onChange={e=>setFilter(f=>({...f,cleaning:e.target.value}))}>
     <option value="all">All</option><option value="checkout_cleaning">Checkout cleaning</option><option value="cleaning_in_progress">Cleaning in progress</option>
     <option value="awaiting_inspection">Awaiting inspection</option><option value="ready">Approved</option><option value="not_verified">Unverified</option>
    </select></label>
    <label>Restriction<select value={filter.blocked} onChange={e=>setFilter(f=>({...f,blocked:e.target.value}))}>
     <option value="all">All</option><option value="blocked">Active restriction</option><option value="clear">No active restriction</option>
    </select></label>
    <label>Arrival / departure date<input type="date" value={filter.date}
     onChange={e=>setFilter(f=>({...f,date:e.target.value}))}/></label>
   </div>
   {(chips.length>0||quick!=='all')&&<div className="rack-chips" aria-label="Active filters">
    {quick!=='all'&&<button type="button" onClick={()=>setQuick('all')}>{quickFilters.find(f=>f[0]===quick)?.[1]} <X size={13}/></button>}
    {chips.map(([label,value,key])=><button key={key} type="button" onClick={()=>setFilter(f=>({...f,[key]:key==='date'||key==='search'?'':'all'}))}>
     {label}: {value} <X size={13}/></button>)}
    <button type="button" className="rack-clear" onClick={clear}>Clear filters</button>
   </div>}
   <div className="rack-results" role="status">
    <strong>{visible.length} shown</strong> from {data?.rooms.length??0} rooms on page {page}
    <span>· {meta?.total??0} registered rooms hotel-wide</span>
    {meta&&meta.totalPages>1&&<small> Filters/search apply to the loaded page. Change pages to check other rooms.</small>}
   </div>
   {visible.length>0?
    listView?<div className="rack-list" role="list">{visible.map(room=><RoomTile key={room.roomId} room={room}
     arrivals={arrivals} today={data!.hotelDate} list onSelect={select}/>)}</div>:
    <div className="rack-grid">{visible.map(room=><RoomTile key={room.roomId} room={room}
     arrivals={arrivals} today={data!.hotelDate} onSelect={select}/>)}</div>:
    <div className="rack-empty" role="status"><Info size={22}/><strong>No matching rooms on this page</strong>
     <p>Adjust filters, or navigate to another room page.</p>
     <button type="button" className="btn-inline" onClick={clear}>Clear filters</button></div>}
   {meta&&meta.totalPages>1&&<div className="rack-pagination">
    <span>Page {meta.page} of {meta.totalPages}</span>
    <div><button type="button" disabled={page<=1} onClick={()=>setPage(p=>p-1)}><ChevronLeft size={16}/> Previous</button>
     <button type="button" disabled={page>=meta.totalPages} onClick={()=>setPage(p=>p+1)}>Next <ChevronRight size={16}/></button></div>
    <label>Rooms per page<select value={perPage} onChange={e=>{setPerPage(Number(e.target.value));setPage(1);}}>
     <option value={20}>20</option><option value={30}>30</option><option value={50}>50</option><option value={100}>100</option>
    </select></label>
   </div>}
   <details className="rack-disclosure"><summary>How the room rack works</summary>
    <p>Vacant in PMS is not bookable inventory. A room may have future reservations, holds, maintenance, cleaning, or other restrictions. Physical occupancy is not independently verified; room readiness is advisory unless the hotel enables enforcement. Guest identity and financial settlement remain separate checks.</p>
   </details>
  </>}
  {selected&&<RackDrawer key={hotelId+'-'+selected.roomId} room={selected} hotelId={hotelId}
   onClose={close} restoreFocus={restore}/>}
 </section>;
}

export function RoomTile({room,arrivals,today,list=false,onSelect}:{
 room:RackRoom;arrivals:RoomRackDataArrivals;today:string;list?:boolean;
 onSelect:(room:RackRoom,button:HTMLButtonElement)=>void;
}){
 const tone=roomTone(room);
 const Symbol=stateIcon(tone);
 const problem=roomProblem(room);
 const stay=room.currentStay??room.upcomingStay;
 const arrival=arrivals.some(a=>a.assignedRoomId===room.roomId&&a.checkIn===today);
 const departure=room.currentStay?.checkOut===today;
 const tooltip='Room '+room.roomNumber+' · '+stateLabel(tone)+' · '+(problem??'No current readiness blocker')+
  ' · Next: '+roomNextAction(room);
 return <button type="button" title={tooltip} aria-label={tooltip}
  className={'rack-tile rack-tone-'+tone+(list?' rack-tile-list':'')}
  onClick={e=>onSelect(room,e.currentTarget)}>
  <span className="rack-tile-head"><strong>{room.roomNumber}</strong>
   <span title={stateLabel(tone)}><Symbol size={16} aria-hidden="true"/>{stateLabel(tone)}</span></span>
  <small>{room.roomTypeName} · {room.floor===null?'Floor unassigned':'Floor '+room.floor}</small>
  <span className="rack-tile-occupancy">
   {room.occupancy==='vacant'?'Vacant in PMS':room.occupancy==='due_for_checkout'?'Departure due · PMS':'In house · PMS'}
  </span>
  {stay&&<span className="rack-tile-stay">
   <strong>{stay.guestName??'Guest name unavailable'}</strong>
   <small>{readableDate(stay.checkIn)} – {readableDate(stay.checkOut)}</small>
  </span>}
  {(arrival||departure)&&<span className="rack-tile-event">
   {arrival?'Arrival today':''}{arrival&&departure?' · ':''}{departure?'Departure today':''}</span>}
  {problem&&<span className="rack-tile-problem"><AlertTriangle size={13} aria-hidden="true"/>{problem}</span>}
  <span className="rack-tile-next">Next: {roomNextAction(room)} <ArrowRight size={13} aria-hidden="true"/></span>
 </button>;
}
type RoomRackDataArrivals=NonNullable<ReturnType<typeof useRoomRack>['data']>['data']['arrivals'];
