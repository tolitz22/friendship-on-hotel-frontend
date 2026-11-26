import {useEffect,useRef,useState} from 'react';
import {useQueryClient} from '@tanstack/react-query';
import {Link,useSearch} from '@tanstack/react-router';
import {BedDouble,Plus,Settings2,ClipboardCheck} from 'lucide-react';
import type {LiveRoom} from '../api/liveCatalog';
import {useLiveRoomTypes,useLiveRooms} from '../api/liveCatalogQueries';
import {CatalogCreateDialog} from '../components/CatalogCreateDialog';
import {CatalogEditDialog} from '../components/CatalogEditDialog';
import {ReadinessEnforcementPanel} from '../components/ReadinessEnforcementPanel';
import {ReadinessDashboardPanel} from '../components/ReadinessDashboardPanel';
import {RoomReadinessPanel} from '../components/RoomReadinessPanel';
import {RoomRackDashboard} from '../components/RoomRackDashboard';
import {useHotelAuth} from '../components/AuthProvider';
import {Heading} from '../components/ui';

/**
 * One Rooms workspace: the live room rack is the primary UI.
 * Room creation and catalogue edits are contextual admin actions, not a second tab.
 */
export function LiveRooms(){
 const {room:linkedRoomNumber,inspect}=useSearch({from:'/rooms'});
 const {user,hotelId}=useHotelAuth();
 const role=user?.hotels.find(h=>h.id===hotelId)?.role;
 const admin=role==='admin';
 const canSeeStay=admin||role==='front_desk';
 const readinessQueue=useRef<HTMLDetailsElement>(null);
 const openReadinessQueue=()=>{const target=readinessQueue.current;if(target){target.open=true;target.scrollIntoView({block:'start'});target.querySelector('summary')?.focus({preventScroll:true});}};
 const [showCreate,setShowCreate]=useState(false);
 const [editingRoom,setEditingRoom]=useState<LiveRoom|null>(null);
 const [inspectionRoomNumber,setInspectionRoomNumber]=useState<string|null>(null);
 const inspectionRoomLookup=useLiveRooms({page:1,perPage:20,search:inspectionRoomNumber??undefined},
  !!inspectionRoomNumber);
 const roomTypes=useLiveRoomTypes();
 const queryClient=useQueryClient();
 useEffect(()=>{
  setShowCreate(false);setEditingRoom(null);
 },[hotelId]);
 useEffect(()=>setInspectionRoomNumber(inspect?linkedRoomNumber??null:null),[hotelId,inspect,linkedRoomNumber]);
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
    {canSeeStay&&<button type="button" className="rr-secondary-action rr-mobile-readiness" onClick={openReadinessQueue}><ClipboardCheck size={16}/> Readiness & arrivals</button>}
    {canSeeStay&&<Link to="/room-calendar" className="rr-secondary-action">
     <BedDouble size={16}/> Booking calendar</Link>}
    {admin&&<button type="button" className="btn-primary" onClick={()=>setShowCreate(true)}>
     <Plus size={16}/> Add room</button>}
   </div>
  </div>
  {canSeeStay&&hotelId&&<RoomRackDashboard key={hotelId} hotelId={hotelId}
   focusRoomNumber={inspect?undefined:linkedRoomNumber}
   onEditRoom={admin?room=>setEditingRoom(room):undefined}/>}
  {canSeeStay?<details ref={readinessQueue} className="workflow-disclosure rack-readiness-queue">
   <summary><ClipboardCheck size={17} aria-hidden="true"/> Readiness & arrivals · prioritized staff actions</summary>
   <p className="desk-muted">Room availability, housekeeping completion and physical inspection are separate checks. The queue shows a snapshot, not guaranteed eligibility to check in.</p>
   <ReadinessDashboardPanel onInspectRoom={setInspectionRoomNumber}/>
  </details>:<ReadinessDashboardPanel onInspectRoom={setInspectionRoomNumber}/>}
  {inspectionRoomNumber&&<div className="rack-drawer-overlay" role="presentation">
   <section className="rack-drawer" role="dialog" aria-modal="true"
    aria-label={'Room '+inspectionRoomNumber+' inspection'} tabIndex={-1}>
    <div className="rack-drawer-head"><strong>Room {inspectionRoomNumber} inspection</strong>
     <button type="button" className="rack-close" aria-label="Close inspection"
      onClick={()=>setInspectionRoomNumber(null)}>Close</button></div>
    <div className="rack-drawer-scroll">
     {inspectionRoomLookup.isPending&&<p role="status">Loading room details…</p>}
     {inspectionRoomLookup.isError&&<p role="alert">Room details could not be loaded.</p>}
     {inspectionRoomLookup.isSuccess&&(()=>{
      const room=inspectionRoomLookup.data.data.find(item=>item.number===inspectionRoomNumber);
      return room?<RoomReadinessPanel room={room} onClose={()=>setInspectionRoomNumber(null)}/>:
       <p role="status">This room was not found in the selected hotel's records.</p>;
     })()}
    </div>
   </section>
  </div>}
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
