import {useEffect,useState} from 'react';
import {useQueryClient} from '@tanstack/react-query';
import {Link,useSearch} from '@tanstack/react-router';
import {BedDouble,Plus,Settings2} from 'lucide-react';
import type {LiveRoom} from '../api/liveCatalog';
import {useLiveRoomTypes} from '../api/liveCatalogQueries';
import {CatalogCreateDialog} from '../components/CatalogCreateDialog';
import {CatalogEditDialog} from '../components/CatalogEditDialog';
import {ReadinessEnforcementPanel} from '../components/ReadinessEnforcementPanel';
import {ReadinessDashboardPanel} from '../components/ReadinessDashboardPanel';
import {RoomRackDashboard} from '../components/RoomRackDashboard';
import {useHotelAuth} from '../components/AuthProvider';
import {Heading} from '../components/ui';

/**
 * One Rooms workspace: the live room rack is the primary UI.
 * Room creation and catalogue edits are contextual admin actions, not a second tab.
 */
export function LiveRooms(){
 const {room:linkedRoomNumber}=useSearch({from:'/rooms'});
 const {user,hotelId}=useHotelAuth();
 const role=user?.hotels.find(h=>h.id===hotelId)?.role;
 const admin=role==='admin';
 const canSeeStay=admin||role==='front_desk';
 const [showCreate,setShowCreate]=useState(false);
 const [editingRoom,setEditingRoom]=useState<LiveRoom|null>(null);
 const roomTypes=useLiveRoomTypes();
 const queryClient=useQueryClient();
 useEffect(()=>{
  setShowCreate(false);setEditingRoom(null);
 },[hotelId]);
 const refreshRack=()=>{
  void Promise.all([
   queryClient.invalidateQueries({queryKey:['live','room-rack',hotelId]}),
   queryClient.invalidateQueries({queryKey:['live-catalog']}),
   queryClient.invalidateQueries({queryKey:['live-rooms']}),
  ]);
 };
 return <>
  <div className="rr-page-heading rack-page-heading">
   <Heading title="Rooms" description="See every room at a glance. Select a room to inspect its status or manage it."/>
   <div className="rr-heading-actions">
    {canSeeStay&&<Link to="/room-calendar" className="rr-secondary-action">
     <BedDouble size={16}/> Booking calendar</Link>}
    {admin&&<button type="button" className="btn-primary" onClick={()=>setShowCreate(true)}>
     <Plus size={16}/> Add room</button>}
   </div>
  </div>
  {canSeeStay&&hotelId?
   <RoomRackDashboard key={hotelId} hotelId={hotelId}
    focusRoomNumber={linkedRoomNumber}
    onEditRoom={admin?room=>setEditingRoom(room):undefined}/>:
   <ReadinessDashboardPanel onInspectRoom={()=>{}}/>}
  {admin&&<details className="workflow-disclosure rack-admin-settings">
   <summary><span><Settings2 size={17}/> Advanced · Check-in readiness policy</span></summary>
   <ReadinessEnforcementPanel/>
  </details>}
  {editingRoom&&admin&&<CatalogEditDialog key={'edit-'+hotelId+'-'+editingRoom.id}
   target={{kind:'room',record:editingRoom}} roomTypes={roomTypes.data?.data??[]}
   onClose={()=>setEditingRoom(null)} onSaved={()=>{
    setEditingRoom(null);refreshRack();
   }}/>}
  {showCreate&&admin&&<CatalogCreateDialog key={hotelId}
   mode="room" roomTypes={roomTypes.data?.data??[]}
   onClose={()=>setShowCreate(false)}
   onCreated={()=>{setShowCreate(false);refreshRack();}}/>}
 </>;
}
