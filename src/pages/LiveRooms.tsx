import {useEffect,useState} from 'react';
import {BedDouble,Filter,Search,Plus,ClipboardCheck,Settings2} from 'lucide-react';
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

export function LiveRooms(){
 const {user,hotelId}=useHotelAuth();
 const admin=!!user?.hotels.some(h=>h.id===hotelId&&h.role==='admin');
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
   <p className="help-copy">Choose a room to record an inspection. Room occupancy is not calculated from the physical room catalogue.</p>
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
   {rooms.data&&<div className="room-grid">{rooms.data.data.map(room=>
    <article className="room-card" key={room.id}>
     <div className="room-card-top">
      <div className="room-icon"><BedDouble size={21}/></div>
      <span className="room-type">{room.roomTypeName} · {room.floor===null?'Floor unassigned':'Floor '+room.floor}</span>
     </div>
     <h3>Room {room.number}</h3>
     <div className="room-details">
      <div><span>Maximum guests</span><strong>{room.maxOccupancy}</strong></div>
      <div><span>Current occupancy</span><strong>Not tracked here</strong></div>
     </div>
     <button type="button" className="btn-primary" onClick={()=>setReadinessRoom(room)}>
      <ClipboardCheck size={15}/> Open inspection
     </button>
     {admin&&<button type="button" className="guest-edit-button"
      onClick={()=>setEditingRoom(room)}>Edit room details</button>}
    </article>)}</div>}
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
