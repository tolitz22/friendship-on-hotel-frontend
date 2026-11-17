import {useEffect,useRef,useState} from 'react';
import type {FormEvent} from 'react';
import {useQueryClient} from '@tanstack/react-query';
import {AlertTriangle,CheckCircle2} from 'lucide-react';
import type {LiveRecord} from '../api/liveReservations';
import {
 allowedOperation,assignLiveRoom,hasActiveStayBlock,transitionLiveStay,
 useLiveAssignableRooms,useLiveRoomBlocks,
} from '../api/liveReservationOperations';
import type {Operation} from '../api/liveReservationOperations';
import {readSession} from '../api/session';
import {ApiError} from '../api/http';
import {useHotelAuth} from '../components/AuthProvider';
import {Panel} from '../components/ui';
import {QueryFeedback} from '../components/QueryFeedback';
import {hotelToday} from '../features/reservations/calendarDate';
import {dateLabel,statusLabel} from '../lib/format';

export function LiveReservationOperations({record,onClose}:{
 record:LiveRecord;onClose:()=>void;
}){
 const {hotelId,user}=useHotelAuth();
 const admin=!!hotelId&&!!user?.hotels.some(h=>h.id===hotelId&&h.role==='admin');
 const [roomPage,setRoomPage]=useState(1);
 const [roomId,setRoomId]=useState('');
 const [acknowledged,setAcknowledged]=useState(false);
 const [busy,setBusy]=useState(false);
 const [success,setSuccess]=useState('');
 const [error,setError]=useState('');
 const inFlight=useRef(false);
 const client=useQueryClient();
 const rooms=useLiveAssignableRooms(record,roomPage,admin);
 const blocks=useLiveRoomBlocks(roomId||null,admin);
 const room=rooms.data?.data.find(r=>r.id===roomId);
 const activeBlock=blocks.data
  ?hasActiveStayBlock(blocks.data.data,record):false;
 const allBlockPagesLoaded=!!blocks.data&&blocks.data.meta.totalPages<=1;
 const canAssign=admin&&record.lifecycleState==='confirmed'&&!!room
  &&blocks.isSuccess&&allBlockPagesLoaded&&!activeBlock&&!busy
  &&roomId!==record.assignedRoomId;
 const hotelDate=hotelToday();
 const canCheckIn=admin&&allowedOperation(record,'check-in',hotelDate)&&acknowledged&&!busy;
 const canCheckOut=admin&&allowedOperation(record,'check-out',hotelDate)&&acknowledged&&!busy;

 useEffect(()=>{
  setRoomPage(1);setRoomId('');setAcknowledged(false);
  setSuccess('');setError('');
 },[hotelId,record.id,record.lifecycleState,record.assignedRoomId]);
 async function refresh(hotel:string){
  await Promise.all([
   client.invalidateQueries({queryKey:['live','reservation-records',hotel]}),
   client.invalidateQueries({queryKey:['live','front-desk','manifest',hotel]}),
   client.invalidateQueries({queryKey:['live','availability',hotel]}),
   client.invalidateQueries({queryKey:['live','assignable-rooms',hotel]}),
   client.invalidateQueries({queryKey:['live','room-blocks',hotel]}),
  ]);
 }
 async function perform(action:'assign'|Operation,event?:FormEvent){
  event?.preventDefault();
  if(!hotelId||!admin||inFlight.current)return;
  if(action==='assign'&&!canAssign)return;
  if(action==='check-in'&&!canCheckIn)return;
  if(action==='check-out'&&!canCheckOut)return;
  const targetHotel=hotelId;
  inFlight.current=true;setBusy(true);setError('');setSuccess('');
  try{
   if(action==='assign'){
    const data=await assignLiveRoom(targetHotel,record,roomId);
    if(readSession().hotelId!==targetHotel)return;
    setSuccess(data.unchanged?'Room assignment was already recorded.':'Room assignment saved by Laravel.');
   }else{
    const data=await transitionLiveStay(targetHotel,record,action);
    if(readSession().hotelId!==targetHotel)return;
    setSuccess(data.status==='checked_in'?'Check-in recorded in Laravel.':'Checkout recorded. Laravel creates a checkout-clean housekeeping task.');
   }
   setAcknowledged(false);
   // Do not misreport a committed write as failed because a cache refresh failed.
   void refresh(targetHotel).catch(()=>{});
  }catch(cause){
   if(readSession().hotelId===targetHotel)
    setError(cause instanceof Error?cause.message:'The operation result could not be confirmed. Refresh hotel records before retrying.');
  }finally{inFlight.current=false;setBusy(false);}
 }

 return <Panel title={'Reservation operations · '+record.reference}>
  <div className="desk-tools">
   <p><strong>{record.reference}</strong> · {dateLabel(record.checkIn)} – {dateLabel(record.checkOut)} · {statusLabel(record.lifecycleState??'unknown')}</p>
   <button type="button" className="btn-inline" disabled={busy} onClick={onClose}>Close</button>
  </div>
  <p>Reservation ID: {record.id} · Room type ID: {record.roomTypeId} · Assigned room: {record.assignedRoomId??'None'}</p>
  {!admin&&<p role="status">Only administrators of the selected hotel can assign rooms or change a reservation lifecycle. The backend enforces permissions.</p>}
  {admin&&<>
   {record.lifecycleState==='confirmed'&&<section>
    <h4>Assign a physical room</h4>
    <p>Rooms are filtered by matching room type. This is not proof of cleanliness, occupancy readiness, or freedom from future conflicts: Laravel performs the final block and assignment checks.</p>
    <QueryFeedback loading={rooms.isPending} error={rooms.error}/>
    {rooms.isSuccess&&<div>
     <label htmlFor="operation-room" className="wizard-label">Matching room from catalogue page {rooms.data.meta.page}</label>
     <select id="operation-room" className="wizard-input" value={roomId}
      onChange={e=>{setRoomId(e.target.value);setError('');}} disabled={busy}>
      <option value="">Select a physical room</option>
      {rooms.data.data.map(r=><option key={r.id} value={r.id}>Room {r.number} · Floor {r.floor??'not set'}{r.id===record.assignedRoomId?' (current)':''}</option>)}
     </select>
     <div className="desk-tools">
      <span>Catalogue page {rooms.data.meta.page} of {Math.max(1,rooms.data.meta.totalPages)}</span>
      <div className="desk-date-nav">
       <button type="button" className="btn-inline" disabled={busy||roomPage<=1}
        onClick={()=>{setRoomPage(v=>v-1);setRoomId('');}}>Previous rooms</button>
       <button type="button" className="btn-inline" disabled={busy||roomPage>=rooms.data.meta.totalPages}
        onClick={()=>{setRoomPage(v=>v+1);setRoomId('');}}>Next rooms</button>
      </div>
     </div>
    </div>}
    {roomId&&<div>
     <QueryFeedback loading={blocks.isPending} error={blocks.error}/>
     {blocks.isSuccess&&<p className={activeBlock?'desk-attention':'desk-muted'}>
      {activeBlock?'Active dated maintenance block overlaps this stay.':
       !allBlockPagesLoaded?'Block history is paginated; this preview is incomplete.':
       'No active dated block found in the returned block history.'}
     </p>}
    </div>}
    <button type="button" className="btn-primary" disabled={!canAssign}
     onClick={()=>void perform('assign')}>{busy?'Saving…':'Assign selected room'}</button>
   </section>}
   <section>
    <h4>Front desk lifecycle</h4>
    <p>Hotel calendar day used for the interface: {hotelDate}. Laravel checks the hotel's authoritative local date and current reservation state again before saving.</p>
    {record.lifecycleState==='confirmed'&&<p>{record.assignedRoomId===null?'A room must be assigned before check-in.':'A room is assigned. Check guest identity and room readiness independently before check-in.'}</p>}
    {record.lifecycleState==='checked_in'&&<p>Checkout is permitted by Laravel only on or after scheduled departure. An early departure needs a separate stay amendment.</p>}
    {(record.lifecycleState==='confirmed'||record.lifecycleState==='checked_in')&&<label className="wizard-label">
     <input type="checkbox" checked={acknowledged} disabled={busy}
      onChange={e=>setAcknowledged(e.target.checked)}/>
     {record.lifecycleState==='confirmed'
      ?' I have separately checked the guest identity, physical room and housekeeping readiness.'
      :' I have independently reviewed departure timing and any financial follow-up.'}
    </label>}
    <div className="desk-tools">
     {record.lifecycleState==='confirmed'&&<button type="button" className="btn-primary"
      disabled={!canCheckIn} onClick={()=>void perform('check-in')}>
      {busy?'Saving…':'Confirm guest check-in'}
     </button>}
     {record.lifecycleState==='checked_in'&&<button type="button" className="btn-primary"
      disabled={!canCheckOut} onClick={()=>void perform('check-out')}>
      {busy?'Saving…':'Confirm guest check-out'}
     </button>}
    </div>
    <p className="desk-muted">Acknowledgement is a UI confirmation only; the backend does not store independent identity/readiness attestations. Payments and refunds are not changed by these actions.</p>
   </section>
  </>}
  {error&&<p role="alert" className="auth-error"><AlertTriangle size={16}/> {
   error
  } Check refreshed records before retrying—especially after a network timeout.</p>}
  {success&&<p role="status" className="wizard-selection"><CheckCircle2 size={17}/>{success}</p>}
 </Panel>;
}
