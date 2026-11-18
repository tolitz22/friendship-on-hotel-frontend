import {useEffect,useMemo,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {Link} from '@tanstack/react-router';
import {
 AlertTriangle,ArrowRight,BedDouble,CheckCircle2,ClipboardCheck,
 Clock3,Filter,Info,Layers3,Plus,RefreshCw,Search,Settings2,
 ShieldAlert,ShieldCheck,Users,X,
} from 'lucide-react';
import {useLiveCatalogSummary,useLiveRooms,useLiveRoomTypes} from '../api/liveCatalogQueries';
import {CatalogCreateDialog} from '../components/CatalogCreateDialog';
import {CatalogEditDialog} from '../components/CatalogEditDialog';
import {RoomReadinessPanel} from '../components/RoomReadinessPanel';
import {ReadinessEnforcementPanel} from '../components/ReadinessEnforcementPanel';
import {ReadinessDashboardPanel} from '../components/ReadinessDashboardPanel';
import type {LiveRoom} from '../api/liveCatalog';
import type {InventoryRoomStatus} from '../api/roomInventoryStatus';
import {useHotelAuth} from '../components/AuthProvider';
import {Heading} from '../components/ui';
import {QueryFeedback} from '../components/QueryFeedback';
import {occupancyLabel,useRoomInventoryStatus} from '../api/roomInventoryStatus';

type View='catalog'|'readiness';
type AttentionFilter='all'|'attention'|'vacant_ready'|'occupied';
type RoomWithStatus={room:LiveRoom;status?:InventoryRoomStatus};
function needsAttention(status:InventoryRoomStatus){
 return status.maintenanceBlocked||status.inventoryBlockedToday
  ||status.cleaning!=='ready';
}
type RoomCardState={title:string;detail:string;kind:'good'|'warning'|'blocked'|'occupied';next:string};
function stateFor(status:InventoryRoomStatus):RoomCardState{
 if(status.maintenanceBlocked||status.inventoryBlockedToday)return{
  title:'Operational block',detail:'Maintenance or inventory restrictions need review before this room can be used.',
  kind:'blocked',next:'Review the active room restrictions',
 };
 if(status.occupancy==='due_for_checkout')return{
  title:'Checkout due',detail:'The guest is still checked in; cleaning follows the recorded checkout.',
  kind:'occupied',next:'Confirm checkout through Front Desk',
 };
 if(status.occupancy==='occupied')return{
  title:'Guest in house',detail:'An active stay is recorded in the PMS.',
  kind:'occupied',next:'Review the current room inspection',
 };
 if(status.cleaning==='ready'&&status.advisoryReady)return{
  title:'Inspection approved',detail:'The room is vacant in the PMS with a current advisory approval.',
  kind:'good',next:'No routine daily inspection; recheck at check-in',
 };
 if(status.cleaning==='checkout_cleaning')return{
  title:'Cleaning required',detail:'Checkout cleaning has not started.',
  kind:'warning',next:'Complete checkout cleaning',
 };
 if(status.cleaning==='cleaning_in_progress')return{
  title:'Cleaning underway',detail:'Housekeeping is working on the room.',
  kind:'warning',next:'Follow up on the cleaning task',
 };
 if(status.cleaning==='awaiting_inspection')return{
  title:'Awaiting inspection',detail:'Cleaning is recorded; an inspection still needs approval.',
  kind:'warning',next:'Review or complete the room inspection',
 };
 return {title:'Not yet verified',detail:'No current approved inspection is recorded. This does not necessarily mean the room is dirty.',
  kind:'warning',next:'Check whether a new physical inspection is needed'};
}
function cardAction(status:InventoryRoomStatus|undefined,admin:boolean,canOpenCleaning:boolean){
 if(!status)return {title:'View readiness',kind:'inspection' as const};
 if(status.maintenanceBlocked||status.inventoryBlockedToday)return {title:'Review blockers',kind:'inspection' as const};
 if((status.cleaning==='checkout_cleaning'||status.cleaning==='cleaning_in_progress')
  &&status.turnoverTaskId&&canOpenCleaning)return {title:'Open cleaning task',kind:'cleaning' as const};
 if(status.cleaning==='checkout_cleaning'||status.cleaning==='cleaning_in_progress')
  return {title:'View cleaning status',kind:'inspection' as const};
 if(status.cleaning==='awaiting_inspection')return {
  title:admin?'Review inspection':'View inspection',kind:'inspection' as const,
 };
 if(status.cleaning==='not_verified'&&status.occupancy==='vacant')return {
  title:admin?'Inspect room':'View readiness',kind:'inspection' as const,
 };
 if(status.cleaning==='ready'&&status.advisoryReady&&status.occupancy==='vacant')return {
  title:'View approval',kind:'inspection' as const,
 };
 return {title:'View room status',kind:'inspection' as const};
}
const attentionLabels:Record<AttentionFilter,string>={
 all:'All on page',attention:'Needs attention',vacant_ready:'Vacant & approved',occupied:'In-house / checkout',
};

export function LiveRooms(){
 const {user,hotelId}=useHotelAuth();
 const role=user?.hotels.find(h=>h.id===hotelId)?.role;
 const admin=role==='admin';
 const canSeeStay=admin||role==='front_desk';
 const [view,setView]=useState<View>('catalog');
 const [showCreate,setShowCreate]=useState(false);
 const [editingRoom,setEditingRoom]=useState<LiveRoom|null>(null);
 const [readinessRoom,setReadinessRoom]=useState<LiveRoom|null>(null);
 const [floor,setFloor]=useState('all');
 const [search,setSearch]=useState('');
 const [page,setPage]=useState(1);
 const [attentionFilter,setAttentionFilter]=useState<AttentionFilter>('all');
 const inspectionTrigger=useRef<HTMLButtonElement|null>(null);
 const inspectionDialog=useRef<HTMLElement|null>(null);
 const roomTypes=useLiveRoomTypes();
 const summary=useLiveCatalogSummary();
 const rooms=useLiveRooms({
  page,perPage:24,floor:floor==='all'?undefined:Number(floor),search,
 });
 const catalogRows=rooms.isSuccess?rooms.data.data:[];
 const totalPages=rooms.isSuccess?rooms.data.meta.totalPages:1;
 const visibleRoomIds=useMemo(()=>catalogRows.map(room=>room.id),[catalogRows]);
 const operationStatus=useRoomInventoryStatus(visibleRoomIds,canSeeStay&&view==='catalog');
 const statusReady=canSeeStay&&operationStatus.isSuccess;
 const statuses=useMemo(()=>new Map(
  operationStatus.isSuccess?operationStatus.data.data.map(item=>[item.roomId,item] as const):[]
 ),[statusReady,operationStatus.data]);
 const filtered=useMemo(()=>catalogRows.map(room=>({
  room,status:statuses.get(room.id),
 })).filter(({status}:RoomWithStatus)=>{
  if(!canSeeStay||attentionFilter==='all')return true;
  if(!statusReady||!status)return false;
  if(attentionFilter==='attention')return needsAttention(status);
  if(attentionFilter==='vacant_ready')return status.occupancy==='vacant'
   &&status.cleaning==='ready'&&status.advisoryReady
   &&!status.maintenanceBlocked&&!status.inventoryBlockedToday;
  return status.occupancy!=='vacant';
 }),[catalogRows,statuses,canSeeStay,statusReady,attentionFilter]);
 const counts=useMemo(()=>{
  const list=operationStatus.isSuccess?operationStatus.data.data:[];
  return {
   attention:list.filter(needsAttention).length,
   ready:list.filter(s=>s.occupancy==='vacant'&&s.cleaning==='ready'&&s.advisoryReady
    &&!s.maintenanceBlocked&&!s.inventoryBlockedToday).length,
   occupied:list.filter(s=>s.occupancy!=='vacant').length,
   blocked:list.filter(s=>s.maintenanceBlocked||s.inventoryBlockedToday).length,
  };
 },[statusReady,operationStatus.data]);
 const hasFilters=floor!=='all'||search.trim().length>0||attentionFilter!=='all';
 const resetFilters=()=>{setFloor('all');setSearch('');setAttentionFilter('all');setPage(1);};
 useEffect(()=>{
  setView('catalog');setShowCreate(false);setEditingRoom(null);setReadinessRoom(null);
  setFloor('all');setSearch('');setPage(1);setAttentionFilter('all');
 },[hotelId]);
 useEffect(()=>{
  if(!readinessRoom)return;
  const previousOverflow=document.body.style.overflow;
  document.body.style.overflow='hidden';
  inspectionDialog.current?.focus();
  const handleKey=(event:KeyboardEvent)=>{
   if(event.key==='Escape'){event.preventDefault();setReadinessRoom(null);return;}
   if(event.key!=='Tab'||!inspectionDialog.current)return;
   const candidates=Array.from(inspectionDialog.current.querySelectorAll<HTMLElement>(
    'button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled])'
   ));
   if(candidates.length===0){event.preventDefault();inspectionDialog.current.focus();return;}
   const first=candidates[0],last=candidates[candidates.length-1];
   if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
   else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
  };
  window.addEventListener('keydown',handleKey);
  return ()=>{document.body.style.overflow=previousOverflow;
   window.removeEventListener('keydown',handleKey);inspectionTrigger.current?.focus();};
 },[readinessRoom]);
 const changeView=(next:View)=>{
  setView(next);setEditingRoom(null);setReadinessRoom(null);
 };
 const retry=()=>{void rooms.refetch();void summary.refetch();void roomTypes.refetch();};
 return <>
  <div className="rr-page-heading">
   <Heading title="Rooms & readiness" description="Manage the physical room catalogue and review recorded occupancy, cleaning, and inspection evidence."/>
   <div className="rr-heading-actions">
    {canSeeStay&&<Link to="/room-calendar" className="rr-secondary-action"><BedDouble size={16}/> Room calendar <ArrowRight size={15}/></Link>}
    {admin&&view==='catalog'&&<button type="button" className="btn-primary" onClick={()=>setShowCreate(true)}><Plus size={16}/> Add room</button>}
   </div>
  </div>
  <div className="rr-page-tabs" role="group" aria-label="Room workspace views">
   <button type="button" aria-pressed={view==='catalog'} className={view==='catalog'?'active':''}
    onClick={()=>changeView('catalog')}><BedDouble size={18}/><span><strong>Room inventory</strong><small>Find a room and review its status</small></span></button>
   <button type="button" aria-pressed={view==='readiness'} className={view==='readiness'?'active':''}
    onClick={()=>changeView('readiness')}><ClipboardCheck size={18}/><span><strong>Readiness & arrivals</strong><small>Hotel-wide inspection and arrival queue</small></span></button>
  </div>
  {view==='catalog'&&<>
   <div className="rr-explainer"><Info size={18}/>
    <div><strong>Cleaning and inspection are different</strong>
     <p>Housekeeping marks cleaning complete; an authorized reviewer separately approves the physical inspection. <strong>Not yet verified does not mean dirty.</strong> Approved rooms do not need a repeat inspection every day unless turnover, maintenance, or new work changes their condition. Availability is checked separately.</p></div>
   </div>

   {canSeeStay&&<section className="rr-status-section" aria-label="Room status for the current page">
    <div className="rr-section-head">
     <div><span className="rr-eyebrow">OPERATIONS · CURRENT ROOM PAGE</span><h3>Room status at a glance</h3>
      <p>{visibleRoomIds.length} room(s) on this page · Figures are not hotel-wide totals</p></div>
     <button type="button" className="rr-secondary-action" disabled={operationStatus.isFetching||visibleRoomIds.length===0}
      onClick={()=>void operationStatus.refetch()}><RefreshCw size={16}/> {operationStatus.isFetching?'Refreshing…':'Refresh status'}</button>
    </div>
    <QueryFeedback loading={operationStatus.isPending&&visibleRoomIds.length>0} error={operationStatus.error}
     onRetry={()=>void operationStatus.refetch()}/>
    <div className="rr-summary-grid">
     <button type="button" className={attentionFilter==='all'?'rr-summary active':'rr-summary'}
      aria-pressed={attentionFilter==='all'} onClick={()=>setAttentionFilter('all')}>
      <Layers3 size={19}/><span>Rooms on this page</span><strong>{rooms.isSuccess?catalogRows.length:'—'}</strong><small>All room statuses</small>
     </button>
     <button type="button" className={attentionFilter==='attention'?'rr-summary active rr-summary-warning':'rr-summary rr-summary-warning'}
      aria-pressed={attentionFilter==='attention'} disabled={!statusReady} onClick={()=>setAttentionFilter('attention')}>
      <AlertTriangle size={19}/><span>Needs attention</span><strong>{statusReady?counts.attention:'—'}</strong><small>Cleaning, inspection, or block</small>
     </button>
     <button type="button" className={attentionFilter==='vacant_ready'?'rr-summary active rr-summary-good':'rr-summary rr-summary-good'}
      aria-pressed={attentionFilter==='vacant_ready'} disabled={!statusReady} onClick={()=>setAttentionFilter('vacant_ready')}>
      <ShieldCheck size={19}/><span>Vacant & approved</span><strong>{statusReady?counts.ready:'—'}</strong><small>Recorded advisory state only</small>
     </button>
     <button type="button" className={attentionFilter==='occupied'?'rr-summary active':'rr-summary'}
      aria-pressed={attentionFilter==='occupied'} disabled={!statusReady} onClick={()=>setAttentionFilter('occupied')}>
      <Users size={19}/><span>In-house / checkout</span><strong>{statusReady?counts.occupied:'—'}</strong><small>According to PMS stays</small>
     </button>
    </div>
    {statusReady&&counts.blocked>0&&<p className="rr-block-count"><ShieldAlert size={15}/> {counts.blocked} room(s) on this page have an active maintenance or inventory block.</p>}
   </section>}

   <section className="rr-inventory-section" aria-labelledby="rr-room-list-title">
    <div className="rr-section-head">
     <div><span className="rr-eyebrow">ROOM DIRECTORY</span><h3 id="rr-room-list-title">Find and inspect a room</h3>
      <p>Filter by floor or room number, then open the room's inspection record.</p></div>
     <span className="rr-total-count">{rooms.isSuccess?rooms.data.meta.total:'—'} registered rooms match the floor and room search</span>
    </div>
    <div className="rr-filter-bar">
     <label className="rr-floor-field"><Filter size={17}/> Floor
      <select aria-label="Filter room floor" value={floor} onChange={e=>{setFloor(e.target.value);setPage(1);setAttentionFilter('all');}}>
       <option value="all">All floors</option>
       {(summary.data?.data.floors??[]).filter(f=>f.number!==null).map(f=>
        <option key={f.number} value={String(f.number)}>{'Floor '+f.number}</option>)}
      </select>
     </label>
     <label className="rr-search-field"><Search size={17}/>
      <input type="search" aria-label="Search room numbers" value={search}
       onChange={e=>{setSearch(e.target.value);setPage(1);setAttentionFilter('all');}}
       placeholder="Search room number…"/>
     </label>
     {hasFilters&&<button type="button" className="rr-reset-button" onClick={resetFilters}><X size={16}/> Clear filters</button>}
     <button type="button" className="rr-secondary-action rr-refresh-list" disabled={rooms.isFetching}
      onClick={retry}><RefreshCw size={15}/> {rooms.isFetching?'Refreshing…':'Refresh rooms'}</button>
    </div>
    {canSeeStay&&<div className="rr-filter-chips" role="group" aria-label="Room operational filter">
     {(Object.entries(attentionLabels) as [AttentionFilter,string][]).map(([key,label])=>
      <button type="button" key={key} aria-pressed={attentionFilter===key}
       className={attentionFilter===key?'selected':''} disabled={key!=='all'&&!statusReady}
       onClick={()=>setAttentionFilter(key)}>{label}</button>)}
    </div>}
    {canSeeStay&&attentionFilter!=='all'&&<p className="rr-page-scope">
     <Info size={14}/> Status filters only apply to the {catalogRows.length} rooms loaded on this page. They do not search the entire hotel.</p>}
    <QueryFeedback loading={rooms.isPending||summary.isPending} error={rooms.error??summary.error??roomTypes.error}
     onRetry={retry} empty={rooms.isSuccess&&catalogRows.length===0}
     emptyMessage={hasFilters?'No rooms match these filters. Clear filters to see all registered rooms.':'No rooms registered yet. An administrator can add the first room.'}/>
    {rooms.isSuccess&&catalogRows.length===0&&hasFilters&&
     <div className="rr-empty-actions"><button type="button" className="btn-inline" onClick={resetFilters}>Clear filters</button></div>}
    {rooms.isSuccess&&catalogRows.length>0&&statusReady&&filtered.length===0&&attentionFilter!=='all'&&
     <div className="rr-empty-actions" role="status"><CheckCircle2 size={18}/>
      No rooms on this page match this status. <button type="button" className="btn-inline" onClick={()=>setAttentionFilter('all')}>Show all rooms</button></div>}
    {rooms.isSuccess&&filtered.length>0&&<div className="rr-room-grid">
     {filtered.map(({room,status})=>{
      const state=status?stateFor(status):null;
      const action=cardAction(status,admin,admin);
      const showBlocked=!!status&&(status.maintenanceBlocked||status.inventoryBlockedToday);
      const cleanTask=status?.turnoverTaskId;
      return <article className={'rr-room-card'+(state?' rr-state-'+state.kind:'')} key={room.id}>
       <div className="rr-card-heading">
        <div className="rr-room-symbol"><BedDouble size={22}/></div>
        <div className="rr-room-title"><small>{room.roomTypeName}</small><h3>Room {room.number}</h3>
         <span>{room.floor===null?'Floor not assigned':'Floor '+room.floor} · Up to {room.maxOccupancy} guests</span></div>
        {admin&&<button type="button" className="rr-card-admin" title={'Edit details for room '+room.number}
         aria-label={'Edit details for room '+room.number} onClick={()=>setEditingRoom(room)}><Settings2 size={17}/></button>}
       </div>
       {status&&state?<div className="rr-card-state">
        <div className="rr-card-state-header">
         <span className={'rr-state-pill rr-pill-'+state.kind}>
          {state.kind==='good'?<CheckCircle2 size={15}/>:state.kind==='blocked'?<ShieldAlert size={15}/>:state.kind==='occupied'?<Users size={15}/>:<Clock3 size={15}/>}
          {state.title}
         </span>
         <span className="rr-card-occupancy">{occupancyLabel(status.occupancy)}</span>
        </div>
        <p>{state.detail}</p>
        {showBlocked&&<div className="rr-card-warning"><AlertTriangle size={15}/>
         <span>{status.maintenanceBlocked&&'Open maintenance restriction'}
          {status.maintenanceBlocked&&status.inventoryBlockedToday&&' · '}
          {status.inventoryBlockedToday&&'Inventory block today'}</span></div>}
        <div className="rr-next-action">
         <small>Next step</small>
         <strong>{state.next}</strong>
         {cleanTask&&<span>Housekeeping task HK-{cleanTask}</span>}
        </div>
       </div>:<div className="rr-status-unavailable">
        <Info size={16}/><span>{canSeeStay?'Live operational status is unavailable. Review recorded inspection details.':'Operational status is not available in this workspace.'}</span>
       </div>}
       <div className="rr-card-actions">
        {action.kind==='cleaning'&&cleanTask?
         <Link to="/housekeeping" search={{task:cleanTask}} className="rr-primary-card-action">
          <ClipboardCheck size={16}/> {action.title} <ArrowRight size={15}/>
         </Link>:
         <button type="button" className="rr-primary-card-action"
          onClick={event=>{inspectionTrigger.current=event.currentTarget;setReadinessRoom(room);}}>
          <ShieldCheck size={16}/> {action.title} <ArrowRight size={15}/>
         </button>}
        <button type="button" className="rr-history-action"
         onClick={event=>{inspectionTrigger.current=event.currentTarget;setReadinessRoom(room);}}>
         <Clock3 size={15}/> View inspection history
        </button>
       </div>
      </article>;
     })}
    </div>}
    {rooms.isSuccess&&rooms.data.meta.totalPages>1&&<div className="rr-pagination">
     <span>Page {rooms.data.meta.page} of {Math.max(1,totalPages)} · {catalogRows.length} rooms loaded</span>
     <div><button type="button" className="btn-inline" disabled={page<=1} onClick={()=>{setPage(p=>Math.max(1,p-1));setAttentionFilter('all');}}>Previous</button>
      <button type="button" className="btn-inline" disabled={page>=totalPages} onClick={()=>{setPage(p=>p+1);setAttentionFilter('all');}}>Next</button></div>
    </div>}
   </section>
  </>}
  {view==='readiness'&&<div className="rr-readiness-workspace">
   <div className="rr-explainer"><Info size={18}/><div><strong>Inspection when needed—not automatic every day</strong>
    <p>Housekeeping cleans, a different authorized person reviews the inspection, and the PMS checks current blockers. The hotel administrator controls whether approved readiness is enforced at check-in. Inspections are not automatic daily tasks. Booking availability, physical occupancy, identity, and payment remain separate checks.</p></div></div>
   <ReadinessDashboardPanel onFindRoom={roomNumber=>{
    setView('catalog');setFloor('all');setSearch(roomNumber);setAttentionFilter('all');setPage(1);
   }}/>
   {admin&&<details className="workflow-disclosure">
    <summary><span><Settings2 size={17}/> Advanced · Check-in readiness enforcement policy</span></summary>
    <ReadinessEnforcementPanel/>
   </details>}
  </div>}
    {readinessRoom&&createPortal(<div className="rr-drawer-backdrop" role="presentation">
   <section className="rr-drawer" role="dialog" aria-modal="true" aria-label={'Room '+readinessRoom.number+' inspection and readiness'}
    tabIndex={-1} ref={inspectionDialog}>
    <RoomReadinessPanel key={hotelId+'-'+readinessRoom.id} room={readinessRoom}
     onClose={()=>setReadinessRoom(null)}/>
   </section>
  </div>,document.body)}
  {editingRoom&&admin&&<CatalogEditDialog key={'edit-'+hotelId+'-'+editingRoom.id}
   target={{kind:'room',record:editingRoom}} roomTypes={roomTypes.data?.data??[]}
   onClose={()=>setEditingRoom(null)} onSaved={()=>setEditingRoom(null)}/>}
  {showCreate&&admin&&<CatalogCreateDialog key={hotelId}
   mode="room" roomTypes={roomTypes.data?.data??[]}
   onClose={()=>setShowCreate(false)}
   onCreated={()=>{setShowCreate(false);setPage(1);setSearch('');setFloor('all');setAttentionFilter('all');}}/>}
 </>;
}
