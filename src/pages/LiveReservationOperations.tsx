import {useEffect,useRef,useState} from 'react';
import type {FormEvent} from 'react';
import {useQueryClient} from '@tanstack/react-query';
import {Link} from '@tanstack/react-router';
import {AlertTriangle,CheckCircle2,ArrowRight,ClipboardCheck,DoorOpen,DoorClosed,BedDouble} from 'lucide-react';
import type {LiveRecord} from '../api/liveReservations';
import {
 allowedOperation,assignLiveRoom,hasActiveStayBlock,transitionLiveStay,
 useLiveAssignableRooms,useLiveRoomBlocks,useLiveReservationHistory,
} from '../api/liveReservationOperations';
import type {Operation} from '../api/liveReservationOperations';
import {readSession} from '../api/session';
import {useReadinessPolicy} from '../api/readinessEnforcementPolicy';
import {useLiveReadiness} from '../api/liveRoomReadiness';
import {useBookingTurnover} from '../api/liveBookingTurnover';
import {useHotelAuth} from '../components/AuthProvider';
import {ReservationApprovalRequests} from '../components/ReservationApprovalRequests';
import {Panel} from '../components/ui';
import {QueryFeedback} from '../components/QueryFeedback';
import {hotelToday} from '../features/reservations/calendarDate';
import {dateLabel,statusLabel} from '../lib/format';

export function LiveReservationOperations({record,onClose,preferredRoomId,preferredRoomNumber,deskAction}:{
 record:LiveRecord;onClose:()=>void;preferredRoomId?:string|null;preferredRoomNumber?:string|null;
 deskAction?:'assign'|'check-in'|'check-out'|null;
}){
 const {hotelId,user}=useHotelAuth();
 const canOperate=!!hotelId&&!!user?.hotels.some(h=>h.id===hotelId&&(h.role==='admin'||h.role==='front_desk'));
 const manager=!!hotelId&&!!user?.hotels.some(h=>h.id===hotelId&&h.role==='admin');
 const [roomPage,setRoomPage]=useState(1);
 const [historyPage,setHistoryPage]=useState(1);
 const [roomId,setRoomId]=useState('');
 const [acknowledged,setAcknowledged]=useState(false);
 const [busy,setBusy]=useState(false);
 const [success,setSuccess]=useState('');
 const [error,setError]=useState('');
 const inFlight=useRef(false);
 const assignmentRef=useRef<HTMLElement>(null);
 const lifecycleRef=useRef<HTMLElement>(null);
 const client=useQueryClient();
 const rooms=useLiveAssignableRooms(record,roomPage,canOperate);
 const blocks=useLiveRoomBlocks(roomId||null,canOperate);
 const history=useLiveReservationHistory(record,historyPage);
 const readinessPolicy=useReadinessPolicy();
 const readiness=useLiveReadiness(record.assignedRoomId);
 const turnover=useBookingTurnover(record.id,record.lifecycleState==='checked_out');
 const room=rooms.data?.data.find(r=>r.id===roomId);
 const activeBlock=blocks.data
  ?hasActiveStayBlock(blocks.data.data,record):false;
 const allBlockPagesLoaded=!!blocks.data&&blocks.data.meta.totalPages<=1;
 const canAssign=canOperate&&record.lifecycleState==='confirmed'&&!!room
  &&blocks.isSuccess&&allBlockPagesLoaded&&!activeBlock&&!busy
  &&roomId!==record.assignedRoomId;
 const hotelDate=hotelToday();
 const readyForEnforcedCheckin=readinessPolicy.isSuccess&&(
  !readinessPolicy.data.enforceAtCheckIn || (readiness.isSuccess&&readiness.data.advisoryReady)
 );
 const canCheckIn=canOperate&&allowedOperation(record,'check-in',hotelDate)
  &&readyForEnforcedCheckin&&acknowledged&&!busy;
 const canCheckOut=canOperate&&allowedOperation(record,'check-out',hotelDate)&&acknowledged&&!busy;

 useEffect(()=>{
  setRoomPage(1);setHistoryPage(1);setRoomId('');setAcknowledged(false);
  setSuccess('');setError('');
 },[hotelId,record.id,record.lifecycleState,record.assignedRoomId]);
 useEffect(()=>{
  if(!preferredRoomId||!preferredRoomNumber||!rooms.data||roomId)return;
  const verified=rooms.data.data.find(item=>item.id===preferredRoomId
   &&item.number===preferredRoomNumber&&item.roomTypeId===record.roomTypeId);
  if(verified)setRoomId(verified.id);
 },[preferredRoomId,preferredRoomNumber,rooms.data,record.roomTypeId,roomId]);
 useEffect(()=>{
  // A front desk shortcut highlights the relevant guarded operation;
  // never execute an assignment or lifecycle transition on navigation.
  if(!deskAction)return;
  const eligible=deskAction==='assign'
   ?record.lifecycleState==='confirmed'&&!record.assignedRoomId
   :deskAction==='check-in'?record.lifecycleState==='confirmed'
   :record.lifecycleState==='checked_in';
  if(!eligible)return;
  const section=deskAction==='assign'?assignmentRef.current:lifecycleRef.current;
  section?.scrollIntoView({behavior:'smooth',block:'start'});
 },[deskAction,record.id,record.lifecycleState,record.assignedRoomId]);
 async function refresh(hotel:string){
  await Promise.all([
   client.invalidateQueries({queryKey:['live','reservation-records',hotel]}),
   client.invalidateQueries({queryKey:['live','room-calendar',hotel]}),
   client.invalidateQueries({queryKey:['live','reservation-detail',hotel,record.id]}),
   client.invalidateQueries({queryKey:['live','booking-turnover',hotel,record.id]}),
   client.invalidateQueries({queryKey:['live','front-desk','manifest',hotel]}),
   client.invalidateQueries({queryKey:['live','availability',hotel]}),
   client.invalidateQueries({queryKey:['live','assignable-rooms',hotel]}),
   client.invalidateQueries({queryKey:['live','room-blocks',hotel]}),
   client.invalidateQueries({queryKey:['live','room-readiness',hotel]}),
   client.invalidateQueries({queryKey:['live','readiness-policy',hotel]}),
   client.invalidateQueries({queryKey:['live','readiness-dashboard',hotel]}),
   client.invalidateQueries({queryKey:['live','reservation-history',hotel,record.id]}),
  ]);
 }
 async function perform(action:'assign'|Operation,event?:FormEvent){
  event?.preventDefault();
  if(!hotelId||!canOperate||inFlight.current)return;
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
  {deskAction&&<p role="status" className="fdc-operation-hint">
   Opened from Front Desk. Review this reservation and complete the required checks before saving any changes.
  </p>}
  <div className="frontdesk-journey" aria-label="Reservation progress">
   <div className="frontdesk-stage"><BedDouble size={17}/><span>Booked</span><strong>Confirmed</strong></div>
   <div className="frontdesk-stage"><DoorOpen size={17}/><span>Physical room</span><strong>{record.assignedRoomId?'Assigned':'Unassigned'}</strong></div>
   <div className="frontdesk-stage"><DoorClosed size={17}/><span>Guest stay</span>
    <strong>{record.lifecycleState==='checked_in'?'In house':
     record.lifecycleState==='checked_out'?'Checked out':
     record.lifecycleState==='confirmed'?'Awaiting arrival':statusLabel(record.lifecycleState??'unknown')}</strong>
   </div>
   <div className="frontdesk-stage"><ClipboardCheck size={17}/><span>Cleaning handoff</span>
    <strong>{record.lifecycleState==='checked_out'?'Review tasks':'After checkout'}</strong>
   </div>
  </div>
  <p className="help-copy">Reservation #{record.id} · Room type #{record.roomTypeId} · Assigned room: {record.assignedRoomId??'None'}.</p>
  {!canOperate&&<p role="status">Only authorized front-desk staff and hotel managers can assign rooms or change a reservation lifecycle. Laravel enforces permissions.</p>}
  {canOperate&&<>
   {record.lifecycleState==='confirmed'&&<section ref={assignmentRef} className={deskAction==='assign'?'fdc-target-operation':''}>
    <h4>Assign a physical room</h4>
    {preferredRoomId&&<p role="status" className="calendar-booking-context">Preferred room from calendar: {preferredRoomNumber??'Selected room'}. We only preselect it when Laravel returns a matching room. Assignment is still subject to block and availability checks.</p>}
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
   <section ref={lifecycleRef} className={deskAction==='check-in'||deskAction==='check-out'?'fdc-target-operation':''}>
    <h4>Front desk lifecycle</h4>
    <p>Hotel calendar day used for the interface: {hotelDate}. Laravel checks the hotel's authoritative local date and current reservation state again before saving.</p>
    {record.lifecycleState==='confirmed'&&<p>{record.assignedRoomId===null?'A room must be assigned before check-in.':'A room is assigned. Check guest identity and room readiness independently before check-in.'}</p>}
    {record.lifecycleState==='confirmed'&&<>
     <QueryFeedback loading={readinessPolicy.isPending} error={readinessPolicy.error}/>
     {readinessPolicy.data?.enforceAtCheckIn&&<>
      <p>Mandatory readiness inspection is enabled for this hotel. Check-in requires independently approved current room readiness.</p>
      {record.assignedRoomId&&<QueryFeedback loading={readiness.isPending} error={readiness.error}/>}
      {record.assignedRoomId&&readiness.data&&<p role="status">Current room readiness: <strong>{readiness.data.advisoryReady?'Approved, no blockers found':'Not approved or blocked'}</strong>. The backend rechecks all conditions under its transaction lock.</p>}
     </>}
    </>}
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
  {(canOperate||manager)&&<ReservationApprovalRequests key={hotelId+'-'+record.id}
   record={record} canRequest={canOperate} manager={manager}/>}
  <section aria-label="Reservation change history">
   <h4>Recorded reservation history</h4>
   <p>These are Laravel reservation events and actor IDs, not proof of room readiness, guest verification or financial settlement.</p>
   <QueryFeedback loading={history.isPending} error={history.error}
    empty={history.isSuccess&&history.data.data.length===0}/>
   {history.isSuccess&&history.data.data.length>0&&<div className="table-scroll">
    <table><thead><tr><th>Event</th><th>Previous state</th><th>New state</th><th>Actor ID</th><th>Recorded at</th></tr></thead>
     <tbody>{history.data.data.map(event=><tr key={event.id}>
      <td>{event.eventType.replaceAll('_',' ')}</td>
      <td>{event.oldState??'—'}</td><td>{event.newState??'—'}</td>
      <td>{event.actorId}</td><td>{event.createdAt}</td>
     </tr>)}</tbody>
    </table>
   </div>}
   {history.isSuccess&&<div className="desk-tools">
    <span>History page {history.data.meta.page} of {Math.max(1,history.data.meta.totalPages)}</span>
    <div className="desk-date-nav">
     <button type="button" className="btn-inline" disabled={historyPage<=1}
      onClick={()=>setHistoryPage(p=>Math.max(1,p-1))}>Previous events</button>
     <button type="button" className="btn-inline" disabled={historyPage>=history.data.meta.totalPages}
      onClick={()=>setHistoryPage(p=>p+1)}>Next events</button>
    </div>
   </div>}
  </section>
  {record.lifecycleState==='checked_out'&&<div className="task-next-step">
   <p><strong>Next step: housekeeping turnover.</strong> Open the cleaning task created by checkout. Task completion does not independently certify room readiness.</p>
   <QueryFeedback loading={turnover.isPending} error={turnover.error}
    onRetry={()=>void turnover.refetch()}/>
   {turnover.isSuccess&&(turnover.data.task
    ?<Link to="/housekeeping" search={{task:turnover.data.task.id}}>
      Open checkout task #{turnover.data.task.id} <ArrowRight size={15}/>
     </Link>
    :<p role="status">No linked cleaning task was returned. Review the task queue or ask an administrator to investigate the checkout.</p>)}
   {turnover.isSuccess&&!turnover.data.task&&
    <Link to="/housekeeping">Review the cleaning queue <ArrowRight size={15}/></Link>}
  </div>}
  {error&&<p role="alert" className="auth-error"><AlertTriangle size={16}/> {
   error
  } Check refreshed records before retrying—especially after a network timeout.</p>}
  {success&&<p role="status" className="wizard-selection"><CheckCircle2 size={17}/>{success}</p>}
 </Panel>;
}
