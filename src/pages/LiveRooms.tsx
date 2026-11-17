import {useEffect,useState} from 'react';
import {BedDouble,Filter,Search,Plus} from 'lucide-react';
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
 const roomTypes=useLiveRoomTypes();
 const [showCreate,setShowCreate]=useState(false);
 const [editingRoom,setEditingRoom]=useState<LiveRoom|null>(null);
 const [readinessRoom,setReadinessRoom]=useState<LiveRoom|null>(null);
 useEffect(()=>{setShowCreate(false);setEditingRoom(null);setReadinessRoom(null);},[hotelId]);
 const [floor,setFloor]=useState('all');
 const [search,setSearch]=useState('');
 const [page,setPage]=useState(1);
 const summary=useLiveCatalogSummary();
 const rooms=useLiveRooms({page,perPage:24,floor:floor==='all'?undefined:Number(floor),search});
 const totalPages=rooms.data?.meta.totalPages??1;
 return <>
 <div className="notice"><strong>Live room catalogue</strong> · Room number, type, floor, and capacity come from Laravel. Room inspection and advisory readiness are available separately. Occupancy and room allocation are not inferred.</div>
 <Heading title="Room inventory" description="Registered physical rooms · Hotel-scoped catalogue view" action={admin?<button type="button" className="btn-primary" onClick={()=>setShowCreate(true)}><Plus size={16}/> Add room</button>:undefined}/>
 <div className="inventory-toolbar">
  <div><Filter size={17}/><label htmlFor="floor-filter">Floor</label>
  <select id="floor-filter" value={floor} onChange={e=>{setFloor(e.target.value);setPage(1);}}>
   <option value="all">All floors</option>
   {summary.data?.data.floors.filter(f=>f.number!==null).map(f=><option key={f.number} value={String(f.number)}>{'Floor '+f.number}</option>)}
  </select>
  <label className="search-box"><Search size={16}/><input aria-label="Search room numbers" value={search} onChange={e=>{setSearch(e.target.value);setPage(1);}} placeholder="Search room number"/></label></div>
  <span>{rooms.data?.meta.total??'—'} registered rooms</span>
 </div>
 <QueryFeedback loading={rooms.isPending||summary.isPending} error={rooms.error??summary.error??roomTypes.error} empty={rooms.data?.data.length===0}/>
 {rooms.data&&<div className="room-grid">{rooms.data.data.map(room=><article className="room-card" key={room.id}>
  <div className="room-card-top"><div className="room-icon"><BedDouble size={21}/></div><span className="room-type">{room.roomTypeName} · {room.floor===null?'Floor unassigned':'Floor '+room.floor}</span></div>
  <h3>Room {room.number}</h3><div className="room-details"><div><span>Max occupants</span><strong>{room.maxOccupancy}</strong></div>
  <div><span>Occupancy</span><strong>Not tracked</strong></div>
  <div><span>Maintenance</span><strong>Not tracked</strong></div></div>
  <button type="button" className="btn-inline" onClick={()=>setReadinessRoom(room)}>Inspection / readiness</button>
  {admin&&<button type="button" className="guest-edit-button" onClick={()=>setEditingRoom(room)}>Edit room</button>}
 </article>)}</div>}
 {rooms.data&&<div className="guest-pagination"><span>Page {rooms.data.meta.page} of {Math.max(1,totalPages)}</span><div>
 <button className="btn-inline" disabled={page<=1} onClick={()=>setPage(p=>Math.max(1,p-1))}>Previous</button>
 <button className="btn-inline" disabled={page>=totalPages} onClick={()=>setPage(p=>p+1)}>Next</button></div></div>}
 <ReadinessDashboardPanel/>
 <ReadinessEnforcementPanel/>
 {readinessRoom&&<RoomReadinessPanel key={hotelId+'-'+readinessRoom.id} room={readinessRoom} onClose={()=>setReadinessRoom(null)}/>}
 {editingRoom&&admin&&<CatalogEditDialog key={'edit-'+hotelId+'-'+editingRoom.id} target={{kind:'room',record:editingRoom}} roomTypes={roomTypes.data?.data??[]} onClose={()=>setEditingRoom(null)} onSaved={()=>setEditingRoom(null)}/>}
 {showCreate&&admin&&<CatalogCreateDialog key={hotelId} mode="room" roomTypes={roomTypes.data?.data??[]} onClose={()=>setShowCreate(false)} onCreated={()=>{setShowCreate(false);setPage(1);setSearch('');setFloor('all');}}/>}
 </>;
}
