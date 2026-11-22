import {useEffect,useState} from 'react';
import {Link} from '@tanstack/react-router';
import {
 ArrowRight,BedDouble,Building2,CalendarDays,CalendarPlus,CheckCircle2,
 ClipboardCheck,Clock3,Hotel,Layers3,RefreshCw,ShieldAlert,
 UserRound,Wallet,Wrench,LogIn,LogOut,Users,ChevronRight,
} from 'lucide-react';
import {useLiveCatalogSummary,useLiveProperty} from '../api/liveCatalogQueries';
import {useLiveManifest} from '../api/liveFrontDesk';
import {useHotelAuth} from '../components/AuthProvider';
import {selectedRole,navigationForRole,type WorkspacePath} from '../features/workspaces/roleNavigation';
import {QueryFeedback} from '../components/QueryFeedback';
import {hotelToday} from '../features/reservations/calendarDate';
import {dateLabel} from '../lib/format';

type Shortcut={to:WorkspacePath;title:string;hint:string;icon:typeof Hotel};
const actions:Shortcut[]=[
 {to:'/front-desk',title:'Open front desk',hint:'Arrivals, departures and check-ins',icon:Hotel},
 {to:'/reservations',title:'New booking',hint:'Create or manage a guest booking',icon:CalendarPlus},
 {to:'/room-calendar',title:'Room calendar',hint:'See bookings by room and date',icon:CalendarDays},
 {to:'/housekeeping',title:'Housekeeping',hint:'Assigned cleaning and room inspections',icon:ClipboardCheck},
 {to:'/maintenance',title:'Maintenance',hint:'Work orders and reported issues',icon:Wrench},
 {to:'/guests',title:'Guest directory',hint:'Find existing or register new guests',icon:UserRound},
 {to:'/cashier-shifts',title:'Cashier shifts',hint:'Reconcile drawer and receipts',icon:Wallet},
 {to:'/operational-exceptions',title:'Review exceptions',hint:'Investigate mismatches and alerts',icon:ShieldAlert},
];
const rolePrimary:Record<string,WorkspacePath>={
 admin:'/front-desk',front_desk:'/front-desk',housekeeping:'/housekeeping',maintenance:'/maintenance',
};
function DeskSummary({date}:{date:string}){
 const arrivals=useLiveManifest(date,'arrivals',1,5);
 const departures=useLiveManifest(date,'departures',1,5);
 const inHouse=useLiveManifest(date,'in_house',1,5);
 const ready=arrivals.isSuccess&&departures.isSuccess&&inHouse.isSuccess;
 const failed=arrivals.error??departures.error??inHouse.error;
 const refresh=()=>{void arrivals.refetch();void departures.refetch();void inHouse.refetch();};
 const queueCount=(query:typeof arrivals)=>query.isSuccess?query.data.meta.total:query.isPending?'Loading…':'Unavailable';
 return <section className="ov-section" aria-labelledby="ov-desk-title">
  <div className="ov-section-heading">
   <div><span className="ov-kicker">LIVE OPERATIONS</span><h3 id="ov-desk-title">Front desk today</h3>
    <p>Reservation queues for {dateLabel(date)} · hotel-local date</p></div>
   <button type="button" className="ov-icon-button" onClick={refresh}
    disabled={arrivals.isFetching||departures.isFetching||inHouse.isFetching}
    aria-label="Refresh front desk queues" title="Refresh queues"><RefreshCw size={16}/></button>
  </div>
  {failed&&<QueryFeedback loading={false} error={failed} onRetry={refresh}/>}
  <div className="ov-queue-grid">
   <Link to="/front-desk" search={{queue:'arrivals'}} className="ov-queue-card" aria-label="View expected arrivals">
    <span className="ov-queue-icon"><LogIn size={19}/></span><span>Expected arrivals</span>
    <strong>{queueCount(arrivals)}</strong><small>Confirmed stays due today</small><ArrowRight size={16} className="ov-queue-arrow"/>
   </Link>
   <Link to="/front-desk" search={{queue:'departures'}} className="ov-queue-card" aria-label="View due departures">
    <span className="ov-queue-icon"><LogOut size={19}/></span><span>Due departures</span>
    <strong>{queueCount(departures)}</strong><small>In-house stays due today</small><ArrowRight size={16} className="ov-queue-arrow"/>
   </Link>
   <Link to="/front-desk" search={{queue:'in_house'}} className="ov-queue-card" aria-label="View in-house reservations">
    <span className="ov-queue-icon"><Users size={19}/></span><span>In-house reservations</span>
    <strong>{queueCount(inHouse)}</strong><small>Registered in-house stays</small><ArrowRight size={16} className="ov-queue-arrow"/>
   </Link>
  </div>
  {ready&&<p className="ov-data-note"><CheckCircle2 size={14}/> Live reservation counts, not independently verified physical occupancy or room availability.</p>}
 </section>;
}
export function LiveDashboard(){
 const {hotelId,user}=useHotelAuth();
 const role=selectedRole(user?.hotels,hotelId);
 const workspace=navigationForRole(role);
 const permitted=new Set([...workspace.daily,...workspace.management,...workspace.advanced]);
 const primary=rolePrimary[role??'']??'/rooms';
 const catalog=useLiveCatalogSummary();
 const property=useLiveProperty();
 const [showAll,setShowAll]=useState(false);
 useEffect(()=>setShowAll(false),[hotelId]);
 const data=catalog.isError?undefined:catalog.data?.data;
 const today=hotelToday(new Date(),property.data?.data.timeZone??'Asia/Manila');
 const shortcuts=actions.filter(item=>permitted.has(item.to));
 const visible=showAll?shortcuts:shortcuts.slice(0,6);
 const catalogLoading=catalog.isPending&&!catalog.isError;
 const propertyLoading=property.isPending&&!property.isError;
 const canDesk=role==='admin'||role==='front_desk';
 return <div className="ov-page">
  <section className="ov-hero" aria-label="Hotel operations welcome">
   <div className="ov-hero-main">
    <div className="ov-hero-tag"><span className="ov-live-dot"/> HOTEL WORKSPACE <span className="ov-hero-tag-divider">/</span> {workspace.label.toUpperCase()}</div>
    <h2>Good day, {user?.name?.trim().split(/\s+/)[0]||'team'}.</h2>
    <p>Here's your starting point for hotel operations. Choose your next task or review what needs attention.</p>
    <div className="ov-hero-actions">
     <Link to={primary} className="ov-action-primary">
      {canDesk?'Open front desk':role==='housekeeping'?'View cleaning tasks':role==='maintenance'?'View work orders':'Open room inventory'} <ArrowRight size={17}/>
     </Link>
     {permitted.has('/room-calendar')&&<Link to="/room-calendar" className="ov-action-secondary">View room calendar</Link>}
    </div>
   </div>
   <div className="ov-hero-aside">
    <Clock3 size={19}/><small>HOTEL DATE</small>
    <strong>{dateLabel(today)}</strong>
    <span>{property.data?.data.timeZone??'Asia/Manila · fallback timezone'}</span>
   </div>
  </section>

  <QueryFeedback loading={false} error={catalog.error??property.error}
   onRetry={()=>{void catalog.refetch();void property.refetch();}}/>

  {canDesk&&<DeskSummary date={today}/>}
  <section className="ov-section" aria-labelledby="ov-actions-title">
   <div className="ov-section-heading">
    <div><span className="ov-kicker">YOUR WORKSPACE</span><h3 id="ov-actions-title">Quick actions</h3>
     <p>Frequently used tools for your assigned hotel role.</p></div>
    {shortcuts.length>6&&<button className="ov-text-button" type="button" aria-expanded={showAll}
     onClick={()=>setShowAll(v=>!v)}>{showAll?'Show fewer':'View all tools'} <ChevronRight size={15}/></button>}
   </div>
   <div className="ov-actions-grid">
    {visible.map(({to,title,hint,icon:Icon})=><Link key={to} to={to}
     search={to==='/reservations'?{mode:'new'}:undefined} className="ov-action-card">
     <span className="ov-action-icon"><Icon size={20}/></span>
     <span className="ov-action-content"><strong>{title}</strong><small>{hint}</small></span>
     <ArrowRight size={17} className="ov-action-chevron" aria-hidden="true"/>
    </Link>)}
   </div>
   {shortcuts.length===0&&<p className="ov-empty" role="status">No quick actions are available for the selected workspace.</p>}
  </section>

  <section className="ov-section" aria-labelledby="ov-property-title">
   <div className="ov-section-heading">
    <div><span className="ov-kicker">PROPERTY SNAPSHOT</span><h3 id="ov-property-title">Registered room inventory</h3>
     <p>Current catalogue totals—not occupied, clean, or bookable room counts.</p></div>
    <Link to="/rooms" className="ov-text-button">Room inventory <ArrowRight size={16}/></Link>
   </div>
   {catalogLoading&&<div className="ov-inventory-grid" role="status" aria-label="Loading room inventory">
    {[0,1,2].map(i=><div className="ov-inventory-stat ov-skeleton" key={i} aria-hidden="true"><span/><strong/><small/></div>)}
   </div>}
   {data&&<div className="ov-inventory-grid">
    <div className="ov-inventory-stat"><BedDouble size={21}/><span>Registered rooms</span><strong>{data.totalRooms}</strong><small>Physical rooms in catalogue</small></div>
    <div className="ov-inventory-stat"><Layers3 size={21}/><span>Room categories</span><strong>{data.totalRoomTypes}</strong><small>Registered room types</small></div>
    <div className="ov-inventory-stat"><Building2 size={21}/><span>Numbered floors</span><strong>{data.floors.filter(f=>f.number!==null).length}</strong><small>Distinct floors with rooms</small></div>
   </div>}
   {catalog.isSuccess&&data?.totalRooms===0&&<p className="ov-empty">No rooms have been registered yet. Open Room inventory to get started.</p>}
  </section>

  <div className="ov-bottom-grid">
   <section className="ov-bottom-card" aria-labelledby="ov-categories-title">
    <div className="ov-card-heading"><div><h3 id="ov-categories-title">Room categories</h3>
     <p>Capacity and registered inventory</p></div><Layers3 size={19}/></div>
    {catalogLoading?<div className="ov-table-loading" role="status">Loading room categories…</div>:data&&data.roomTypes.length>0?<div className="table-scroll">
     <table className="ov-room-table"><thead><tr><th>Room type</th><th>Rooms</th><th>Max guests</th></tr></thead>
      <tbody>{data.roomTypes.map(type=><tr key={type.id}><td><strong>{type.name}</strong></td>
       <td>{type.roomCount}</td><td>{type.maxOccupancy}</td></tr>)}</tbody>
     </table></div>:catalog.isError?<p className="ov-empty">Room categories could not be loaded.</p>:<p className="ov-empty">No room categories registered yet.</p>}
   </section>
   <section className="ov-bottom-card" aria-labelledby="ov-selected-title">
    <div className="ov-card-heading"><div><h3 id="ov-selected-title">Selected property</h3>
     <p>Current hotel context</p></div><Hotel size={19}/></div>
    {property.data?<div className="ov-property-card">
     <div className="ov-property-symbol"><Hotel size={24}/></div>
     <strong>{property.data.data.name}</strong>
     <span>{property.data.data.address??'Property address not configured'}</span>
     <div className="ov-property-facts"><div><span>Timezone</span><strong>{property.data.data.timeZone}</strong></div>
      <div><span>Currency</span><strong>{property.data.data.currency}</strong></div></div>
     {permitted.has('/settings')&&<Link to="/settings" className="ov-text-button">Hotel settings <ArrowRight size={16}/></Link>}
    </div>:<p className="ov-empty" role="status">{propertyLoading?'Loading property details…':'Property details could not be loaded.'}</p>}
   </section>
  </div>
  <p className="ov-disclaimer"><ShieldAlert size={16}/>
   This overview distinguishes reservation status from verified room occupancy. Registered room counts do not indicate real-time availability, payment settlement, or housekeeping readiness.
  </p>
 </div>;
}
