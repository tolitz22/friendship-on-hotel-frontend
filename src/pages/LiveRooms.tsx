import {useEffect,useState} from 'react';
import {Link} from '@tanstack/react-router';
import {BedDouble,Filter,Search,Plus,ClipboardCheck,Settings2,RefreshCw,Clock3,ArrowRight,ShieldCheck} from 'lucide-react';
import {useLiveCatalogSummary,useLiveRooms,useLiveRoomTypes} from '../api/liveCatalogQueries';
import {CatalogCreateDialog} from '../components/CatalogCreateDialog';
import {CatalogEditDialog} from '../components/CatalogEditDialog';
import {RoomReadinessPanel} from '../components/RoomReadinessPanel';
import {ReadinessEnforcementPanel} from '../components/ReadinessEnforcementPanel';
import {ReadinessDashboardPanel} from '../components/ReadinessDashboardPanel';
import type {LiveRoom} from '../api/liveCatalog';
import {useHotelAuth} from '../components/AuthProvider';
import {Heading} from '../components/ui';
import {QueryFeedback} from '../components/QueryFeedback';
import {cleaningLabel,occupancyLabel,useRoomInventoryStatus} from '../api/roomInventoryStatus';

export function LiveRooms(){
 const {user,hotelId}=useHotelAuth();
 const role=user?.hotels.find(h=>h.id===hotelId)?.role;
 const admin=role==='admin';
 const canSeeStay=admin||role==='front_desk';
 const [view,setView]=useState<'catalog'|'readiness'>('catalog');
 const [showCreate,setShowCreate]=useState(false);
 const [editingRoom,setEditingRoom]=useState<LiveRoom|null>(null);
 const [readinessRoom,setReadinessRoom]=useState<LiveRoom|null>(null);
 const [floor,setFloor]=useState('all');
 const [search,setSearch]=useState('');
 const [page,setPage]=useState(1);
 const roomTypes=useLiveRoomTypes();
 const summary=useLiveCatalogSummary();
 const rooms=useLiveRooms({
  page,perPage:24,floor:floor==='all'?undefined:Number(floor),search,
 });
 const totalPages=rooms.data?.meta.totalPages??1;
 const visibleRoomIds=rooms.data?.data.map(room=>room.id)??[];
 const operationStatus=useRoomInventoryStatus(visibleRoomIds,canSeeStay&&view==='catalog');
 const statuses=new Map(operationStatus.data?.data.map(item=>[item.roomId,item])??[]);
 const currentCounts={
  checkout:operationStatus.data?.data.filter(item=>item.cleaning==='checkout_cleaning').length??0,
  cleaning:operationStatus.data?.data.filter(item=>item.cleaning==='cleaning_in_progress').length??0,
  inspection:operationStatus.data?.data.filter(item=>item.cleaning==='awaiting_inspection').length??0,
  ready:operationStatus.data?.data.filter(item=>item.cleaning==='ready'&&item.occupancy==='vacant').length??0,
 };

 useEffect(()=>{
  setView('catalog');setShowCreate(false);setEditingRoom(null);setReadinessRoom(null);
  setFloor('all');setSearch('');setPage(1);
 },[hotelId]);
 const changeView=(next:'catalog'|'readiness')=>{
  setView(next);setEditingRoom(null);setReadinessRoom(null);
 };
 return <>
  <Heading title="Rooms" description="View registered rooms, inspect readiness, or review arrivals. All live data is scoped to the selected hotel."
   action={view==='catalog'&&admin?
    <button type="button" className="btn-primary" onClick={()=>setShowCreate(true)}>
     <Plus size={16}/> Add a room
    </button>:undefined}/>
  <div className="room-workspace-tabs view-switch" role="group" aria-label="Room workspace views">
   <button type="button" className={view==='catalog'?'selected':''}
    aria-pressed={view==='catalog'} onClick={()=>changeView('catalog')}>
    <BedDouble size={16}/> Room catalogue
   </button>
   <button type="button" className={view==='readiness'?'selected':''}
    aria-pressed={view==='readiness'} onClick={()=>changeView('readiness')}>
    <ClipboardCheck size={16}/> Readiness & arrivals
   </button>
  </div>
  {view==='catalog'&&<>
   <div className="inventory-status-intro">
    <div><strong>Room operations</strong>
     <p>Occupancy and checkout cleaning come from live reservations and housekeeping records. A vacant room may still need cleaning.</p>
    </div>
    {canSeeStay&&<button type="button" className="btn-inline" disabled={operationStatus.isFetching}
     onClick={()=>void operationStatus.refetch()}><RefreshCw size={15}/> Refresh room status</button>}
   </div>
   {canSeeStay&&<div className="inventory-cleaning-summary" aria-label="Cleaning status on visible page">
    <div><small>Checkout cleaning</small><strong>{currentCounts.checkout}</strong></div>
    <div><small>Cleaning now</small><strong>{currentCounts.cleaning}</strong></div>
    <div><small>Awaiting inspection</small><strong>{currentCounts.inspection}</strong></div>
    <div><small>Vacant & ready</small><strong>{currentCounts.ready}</strong></div>
   </div>}
   {canSeeStay&&<p className="desk-muted">Counts describe only the {visibleRoomIds.length} rooms on this page, not the entire hotel. Check-in readiness is revalidated by Laravel.</p>}
   {canSeeStay&&<QueryFeedback loading={operationStatus.isPending&&visibleRoomIds.length>0}
    error={operationStatus.error} onRetry={()=>void operationStatus.refetch()}/>}

   <div className="inventory-toolbar">
    <div><Filter size={17} aria-hidden="true"/><label htmlFor="floor-filter">Floor</label>
     <select id="floor-filter" value={floor} onChange={e=>{setFloor(e.target.value);setPage(1);}}>
      <option value="all">All floors</option>
      {summary.data?.data.floors.filter(f=>f.number!==null).map(f=>
       <option key={f.number} value={String(f.number)}>{'Floor '+f.number}</option>)}
     </select>
     <label className="search-box"><Search size={16} aria-hidden="true"/>
      <input aria-label="Search room numbers" value={search}
       onChange={e=>{setSearch(e.target.value);setPage(1);}}
       placeholder="Find a room number"/>
     </label>
    </div>
    <span>{rooms.data?.meta.total??'—'} registered rooms</span>
   </div>
   <QueryFeedback loading={rooms.isPending||summary.isPending}
    error={rooms.error??summary.error??roomTypes.error}
    onRetry={()=>{void rooms.refetch();void summary.refetch();void roomTypes.refetch();}}
    empty={rooms.data?.data.length===0}
    emptyMessage="No physical rooms match these filters. Clear the room number or floor filter."/>
   {rooms.data&&<div className="room-grid">{rooms.data.data.map(room=>{
    const info=statuses.get(room.id);
    return <article className="room-card inventory-operational-card" key={room.id}>
     <div className="room-card-top">
      <div className="room-icon"><BedDouble size={21}/></div>
      <span className="room-type">{room.roomTypeName} · {room.floor===null?'Floor unassigned':'Floor '+room.floor}</span>
     </div>
     <h3>Room {room.number}</h3>
     <div className="room-details">
      <div><span>Maximum guests</span><strong>{room.maxOccupancy}</strong></div>
      {info&&<div><span>Occupancy</span>
       <strong>{occupancyLabel(info.occupancy)}</strong></div>}
     </div>
     {info&&<div className="inventory-condition-section">
      <div className="inventory-condition-badges">
       <span className={'inventory-occupancy-pill '+info.occupancy}>
        {occupancyLabel(info.occupancy)}</span>
       <span className={'inventory-cleaning-pill '+info.cleaning}>
        {cleaningLabel(info.cleaning)}</span>
      </div>
      {info.occupancy==='due_for_checkout'&&<p className="inventory-status-hint">
       <Clock3 size={14}/> Guest is still checked in. Checkout cleaning starts after actual departure.</p>}
      {info.cleaning==='checkout_cleaning'&&<p className="inventory-status-hint">
       Checkout recorded. Cleaning task is waiting to be started.</p>}
      {info.cleaning==='awaiting_inspection'&&<p className="inventory-status-hint">
       Housekeeping task completed; an authorized inspection must confirm readiness.</p>}
      {info.maintenanceBlocked&&<p className="inventory-status-warning">Room-impacting maintenance is open.</p>}
      {info.inventoryBlockedToday&&<p className="inventory-status-warning">Inventory block active today.</p>}
      {info.turnoverTaskId&&<div className="inventory-task-evidence">
       <span>Cleaning task <strong>HK-{info.turnoverTaskId}</strong></span>
       {info.assignedHousekeeperId&&<small>Assigned staff #{info.assignedHousekeeperId}</small>}
       {info.cleanedAt&&<small>Completed {info.cleanedAt}
        {info.cleanedById?' · by staff #'+info.cleanedById:''}</small>}
       <Link to="/housekeeping" search={{task:info.turnoverTaskId}}
        className="inventory-room-action">Open checkout cleaning task <ArrowRight size={14}/></Link>
      </div>}
      {info.inspectionId&&<div className="inventory-task-evidence">
       <span>Inspection <strong>#{info.inspectionId}</strong>
        {' · '}{info.inspectionStatus??'unknown'}</span>
       {info.inspectedById&&<small>Inspected by staff #{info.inspectedById}
        {info.inspectedAt?' · '+info.inspectedAt:''}</small>}
       {info.reviewedById&&<small>Reviewed by staff #{info.reviewedById}
        {info.reviewedAt?' · '+info.reviewedAt:''}</small>}
      </div>}
     </div>}
     <button type="button" className="btn-primary" onClick={()=>setReadinessRoom(room)}>
      <ShieldCheck size={15}/> {info?.cleaning==='awaiting_inspection'?'Review room inspection':'Inspect room readiness'}
     </button>
     {admin&&<button type="button" className="guest-edit-button"
      onClick={()=>setEditingRoom(room)}>Edit room details</button>}
    </article>})}</div>}
   {rooms.data&&<div className="guest-pagination">
    <span>Page {rooms.data.meta.page} of {Math.max(1,totalPages)}</span>
    <div>
     <button type="button" className="btn-inline" disabled={page<=1}
      onClick={()=>setPage(p=>Math.max(1,p-1))}>Previous rooms</button>
     <button type="button" className="btn-inline" disabled={page>=totalPages}
      onClick={()=>setPage(p=>p+1)}>Next rooms</button>
    </div>
   </div>}
  </>}
  {view==='readiness'&&<>
   <ReadinessDashboardPanel/>
   {admin&&<details className="workflow-disclosure">
    <summary><span><Settings2 size={17}/> Advanced · Check-in readiness enforcement policy</span></summary>
    <ReadinessEnforcementPanel/>
   </details>}
  </>}
  {readinessRoom&&<RoomReadinessPanel key={hotelId+'-'+readinessRoom.id}
   room={readinessRoom} onClose={()=>setReadinessRoom(null)}/>}
  {editingRoom&&admin&&<CatalogEditDialog key={'edit-'+hotelId+'-'+editingRoom.id}
   target={{kind:'room',record:editingRoom}} roomTypes={roomTypes.data?.data??[]}
   onClose={()=>setEditingRoom(null)} onSaved={()=>setEditingRoom(null)}/>}
  {showCreate&&admin&&<CatalogCreateDialog key={hotelId}
   mode="room" roomTypes={roomTypes.data?.data??[]}
   onClose={()=>setShowCreate(false)}
   onCreated={()=>{setShowCreate(false);setPage(1);setSearch('');setFloor('all');}}/>}
 </>;
}
