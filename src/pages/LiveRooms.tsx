import {useEffect,useMemo,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {Link,useSearch} from '@tanstack/react-router';
import {
 AlertTriangle,ArrowRight,BedDouble,CheckCircle2,ClipboardCheck,
 Clock3,Filter,Info,Plus,RefreshCw,Search,Settings2,
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
import {roomOperationalSignal} from '../features/rooms/roomOperationalSignals';

type View='catalog'|'readiness';
type AttentionFilter='all'|'attention'|'vacant_ready'|'occupied';
type RoomWithStatus={room:LiveRoom;status?:InventoryRoomStatus};
function needsAttention(status:InventoryRoomStatus){
 return status.maintenanceBlocked||status.inventoryBlockedToday
  ||status.cleaning!=='ready';
}
type RoomCardState={title:string;detail:string;kind:'good'|'warning'|'blocked'|'occupied';next:string};
function stateFor(status:InventoryRoomStatus):RoomCardState{
 const signal=roomOperationalSignal(status);
 return {title:signal.title,detail:signal.explanation,next:signal.action,
  kind:signal.tone==='approved'?'good':signal.tone==='attention'?'warning':signal.tone};
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

export function LiveRooms(){
 const {room:linkedRoomNumber}=useSearch({from:'/rooms'});
 const {user,hotelId}=useHotelAuth();
 const role=user?.hotels.find(h=>h.id===hotelId)?.role;
 const admin=role==='admin';
 const canSeeStay=admin||role==='front_desk';
 const [view,setView]=useState<View>('readiness');
 const [requestedInspectionNumber,setRequestedInspectionNumber]=useState<string|null>(null);
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
 const hasFilters=floor!=='all'||search.trim().length>0||attentionFilter!=='all';
 const resetFilters=()=>{setFloor('all');setSearch('');setAttentionFilter('all');setPage(1);};
 useEffect(()=>{
  setView(linkedRoomNumber?'catalog':'readiness');setRequestedInspectionNumber(null);setShowCreate(false);setEditingRoom(null);setReadinessRoom(null);
  setFloor('all');setSearch(linkedRoomNumber??'');setPage(1);setAttentionFilter('all');
 },[hotelId,linkedRoomNumber]);
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
 useEffect(()=>{
  if(!requestedInspectionNumber||!rooms.isSuccess)return;
  const room=rooms.data.data.find(item=>item.number===requestedInspectionNumber);
  if(room){setReadinessRoom(room);setRequestedInspectionNumber(null);}
 },[requestedInspectionNumber,rooms.isSuccess,rooms.data]);
 const openInspection=(roomNumber:string)=>{
  setView('catalog');setFloor('all');setSearch(roomNumber);
  setAttentionFilter('all');setPage(1);setRequestedInspectionNumber(roomNumber);
 };
 const changeView=(next:View)=>{
  setView(next);setEditingRoom(null);setReadinessRoom(null);
 };
 const retry=()=>{void rooms.refetch();void summary.refetch();void roomTypes.refetch();};
 return <>
  <div className="rr-page-heading">
   <Heading title="Rooms & readiness" description="Resolve urgent arrival readiness issues, or manage the physical room directory."/>
   <div className="rr-heading-actions">
    {canSeeStay&&<Link to="/room-calendar" className="rr-secondary-action"><BedDouble size={16}/> Room calendar <ArrowRight size={15}/></Link>}
    {admin&&view==='catalog'&&<button type="button" className="btn-primary" onClick={()=>setShowCreate(true)}><Plus size={16}/> Add room</button>}
   </div>
  </div>
  <div className="rr-page-tabs" role="group" aria-label="Room workspace views">
   <button type="button" aria-pressed={view==='catalog'} className={view==='catalog'?'active':''}
    onClick={()=>changeView('catalog')}><BedDouble size={18}/><span><strong>Room Inventory</strong><small>Search and manage rooms</small></span></button>
   <button type="button" aria-pressed={view==='readiness'} className={view==='readiness'?'active':''}
    onClick={()=>changeView('readiness')}><ClipboardCheck size={18}/><span><strong>Arrivals & Room Tasks</strong><small>What staff should do next</small></span></button>
  </div>
  {view==='catalog'&&<>
   <p className="rr-one-note">Cleaning completion and readiness approval are separate records.</p>
   <details className="rr-how-disclosure"><summary>How readiness works</summary>
    <p>Housekeeping records cleaning, an authorized staff member inspects physical conditions and records the completed inspection. New turnover or room work may invalidate readiness. Inventory and payment checks remain separate.</p>
   </details>
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
   <p className="rr-one-note">Cleaning completion and readiness approval are separate records.</p>
   <ReadinessDashboardPanel onInspectRoom={openInspection}/>
   <details className="rr-how-disclosure"><summary>How readiness works</summary>
    <p>Cleaning is recorded by housekeeping; a completed physical inspection certifies readiness. New checkout turnovers, maintenance or inventory restrictions may require further action. Booking availability is not an inspection result.</p>
   </details>
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
