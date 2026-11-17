import {useEffect,useRef,useState} from 'react';
import type {FormEvent} from 'react';
import {useQueryClient} from '@tanstack/react-query';
import {Link} from '@tanstack/react-router';
import {AlertTriangle,CheckCircle2,ArrowRight,ClipboardCheck,DoorOpen,DoorClosed,BedDouble} from 'lucide-react';
import type {LiveRecord} from '../api/liveReservations';
import {
 allowedOperation,assignLiveRoom,transitionLiveStay,
 useLiveRoomChoices,useLiveReservationHistory,
} from '../api/liveReservationOperations';
import type {Operation} from '../api/liveReservationOperations';
import {readSession} from '../api/session';
import {ApiError} from '../api/http';
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
 const [showRoomPicker,setShowRoomPicker]=useState(false);
 const [historyPage,setHistoryPage]=useState(1);
 const [roomId,setRoomId]=useState('');
 const [acknowledged,setAcknowledged]=useState(false);
 const [busy,setBusy]=useState(false);
 const [success,setSuccess]=useState('');
 const [error,setError]=useState('');
 const [lastOperation,setLastOperation]=useState<'assign'|Operation|null>(null);
 const inFlight=useRef(false);
 const assignmentRef=useRef<HTMLElement>(null);
 const lifecycleRef=useRef<HTMLElement>(null);
 const client=useQueryClient();
 const roomChoices=useLiveRoomChoices(record,roomPage,canOperate&&showRoomPicker);
 const history=useLiveReservationHistory(record,historyPage);
 const readinessPolicy=useReadinessPolicy();
 const readiness=useLiveReadiness(record.assignedRoomId);
 const turnover=useBookingTurnover(record.id,record.lifecycleState==='checked_out');
 const selectedRoom=roomChoices.data?.data.find(r=>r.id===roomId);
 const canAssign=canOperate&&record.lifecycleState==='confirmed'
  &&!!selectedRoom&&selectedRoom.status==='available'
  &&roomId!==record.assignedRoomId&&!busy;
 const choiceStatus=selectedRoom?.reason==='maintenance_block'
  ?'Blocked by maintenance for the selected nights.'
  :selectedRoom?.reason==='reservation_conflict'
  ?'Already assigned to another reservation during this stay.'
  :selectedRoom?.current?'This is already the assigned room.'
  :selectedRoom?'No listed conflicts. Laravel will check again on save.'
  :'Select an available room to proceed.';
 const hotelDate=hotelToday();
 const readyForEnforcedCheckin=readinessPolicy.isSuccess&&(
  !readinessPolicy.data.enforceAtCheckIn || (readiness.isSuccess&&readiness.data.advisoryReady)
 );
 const canCheckIn=canOperate&&allowedOperation(record,'check-in',hotelDate)
  &&readyForEnforcedCheckin&&acknowledged&&!busy;
 const canCheckOut=canOperate&&allowedOperation(record,'check-out',hotelDate)&&acknowledged&&!busy;

 useEffect(()=>{
  setRoomPage(1);setHistoryPage(1);setRoomId('');setAcknowledged(false);
  setShowRoomPicker(!record.assignedRoomId||deskAction==='assign');
  setSuccess('');setError('');
 },[hotelId,record.id,record.lifecycleState,record.assignedRoomId]);
 useEffect(()=>{
  if(!preferredRoomId||!preferredRoomNumber||!roomChoices.data||roomId)return;
  const verified=roomChoices.data.data.find(item=>item.id===preferredRoomId
   &&item.number===preferredRoomNumber&&item.roomTypeId===record.roomTypeId);
  if(verified&&verified.status==='available')setRoomId(verified.id);
 },[preferredRoomId,preferredRoomNumber,roomChoices.data,record.roomTypeId,roomId]);
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
   client.invalidateQueries({queryKey:['live','room-choices',hotel]}),
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
  inFlight.current=true;setBusy(true);setError('');setSuccess('');setLastOperation(action);
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
   if(cause instanceof ApiError&&cause.status===409){
    // Display new room conflicts after another staff member acts.
    void Promise.all([
     client.invalidateQueries({queryKey:['live','room-choices',targetHotel,record.id]}),
     client.invalidateQueries({queryKey:['live','reservation-detail',targetHotel,record.id]}),
    ]).catch(()=>{});
   }
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
   <div className="frontdesk-stage"><BedDouble size={17}/><span>Reservation</span><strong>{record.lifecycleState==='cancelled'?'Cancelled':'Recorded'}</strong></div>
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
  <div className="reservation-selection-summary" aria-label="Reservation summary">
   <div><small>Guest</small><strong>{record.guestName??'Guest details unavailable'}</strong></div>
   <div><small>Booked room category</small><strong>{record.roomTypeName??'Room type'} · #{record.roomTypeId}</strong></div>
   <div><small>Physical room</small><strong>{record.assignedRoomNumber
    ?'Room '+record.assignedRoomNumber
    :record.assignedRoomId?'Room #'+record.assignedRoomId:'Not assigned yet'}</strong></div>
  </div>
  <div className="reservation-next-step" role="status">
   <div><strong>What happens next?</strong>
    <p>{record.lifecycleState==='confirmed'
      ?record.assignedRoomId
       ?'Room assigned. Review guest identity and room readiness, then complete check-in when allowed.'
       :'Assign a physical room first. Check-in is unavailable until a room is assigned.'
      :record.lifecycleState==='checked_in'
       ?'Guest is checked in. Review checkout eligibility and complete departure when due.'
       :record.lifecycleState==='checked_out'
        ?'Stay completed. Follow up with housekeeping turnover and review the audit history when needed.'
        :'This booking is not active. Use audit history or manager exceptions for further review.'}</p>
   </div>
  </div>
  {!canOperate&&<p role="status">Only authorized front-desk staff and hotel managers can assign rooms or change a reservation lifecycle. Laravel enforces permissions.</p>}
  {canOperate&&<>
   {record.lifecycleState==='confirmed'&&<>
    {record.assignedRoomId&&!showRoomPicker&&<div className="reservation-room-compact">
     <div><strong>Room {record.assignedRoomNumber??'#'+record.assignedRoomId} is assigned</strong>
      <p className="desk-muted">Continue to check-in below. Need a different room?</p></div>
     <button type="button" className="btn-inline" onClick={()=>setShowRoomPicker(true)}>
      Change assigned room</button>
    </div>}
    {showRoomPicker&&<section ref={assignmentRef}
    className={'reservation-room-picker'+(deskAction==='assign'?' fdc-target-operation':'')}
    aria-label="Choose a physical room">
    <div className="desk-tools">
     <div><h4>{record.assignedRoomId?'Change the assigned room':'Step 1 · Assign a room'}</h4>
      <p className="desk-muted">Only rooms of the booked type are shown. Availability is checked for the entire stay.</p></div>
     <button type="button" className="btn-inline" disabled={busy||roomChoices.isFetching}
      onClick={()=>void roomChoices.refetch()}>Refresh choices</button>
    </div>
    <div className="reservation-selection-summary">
     <div><small>Room type</small><strong>{roomChoices.data?.meta.roomTypeName??'Booked room type'} (#{record.roomTypeId})</strong></div>
     <div><small>Stay</small><strong>{dateLabel(record.checkIn)} – {dateLabel(record.checkOut)}</strong></div>
     <div><small>Current room</small><strong>{roomChoices.data?.meta.currentRoomNumber
      ?'Room '+roomChoices.data.meta.currentRoomNumber
      :record.assignedRoomId?'Room #'+record.assignedRoomId:'Not yet assigned'}</strong></div>
    </div>
    {preferredRoomId&&<p role="status" className="calendar-booking-context">
     Opened from the calendar: Room {preferredRoomNumber??preferredRoomId}. Choose the same room below if available.
    </p>}
    <QueryFeedback loading={roomChoices.isPending} error={roomChoices.error}
     onRetry={()=>void roomChoices.refetch()}/>
    {roomChoices.isSuccess&&<>
     <p className="desk-muted">Choose a room below. Rooms with conflicting reservations or active maintenance blocks cannot be selected.</p>
     {roomChoices.data.data.length===0&&<p role="status">No rooms of this type on this page.
      Ask a manager to check the room catalogue or select another room page.</p>}
     <div className="reservation-room-options" role="radiogroup" aria-label="Room choices">
      {roomChoices.data.data.map(option=><label key={option.id}
       className={'reservation-room-option'+(roomId===option.id?' selected':'')+(option.status==='unavailable'?' unavailable':'')}>
       <input type="radio" name={'room-choice-'+record.id} value={option.id}
        checked={roomId===option.id} disabled={busy||option.status!=='available'}
        onChange={()=>{setRoomId(option.id);setError('');setSuccess('');}}/>
       <span><strong>Room {option.number}</strong><small>Floor {option.floor??'not set'}</small></span>
       <span className="reservation-room-option-status">{option.current?'Current room':
        option.reason==='maintenance_block'?'Maintenance block':
        option.reason==='reservation_conflict'?'Already booked':'Available'}</span>
      </label>)}
     </div>
     <div className="desk-tools">
      <span>Rooms {roomChoices.data.meta.page} / {Math.max(1,roomChoices.data.meta.totalPages)}
       {' · '}{roomChoices.data.meta.total} matching physical rooms</span>
      <div className="desk-date-nav">
       <button type="button" className="btn-inline" disabled={busy||roomPage<=1}
        onClick={()=>{setRoomPage(p=>p-1);setRoomId('');}}>Previous</button>
       <button type="button" className="btn-inline"
        disabled={busy||roomPage>=roomChoices.data.meta.totalPages}
        onClick={()=>{setRoomPage(p=>p+1);setRoomId('');}}>Next</button>
      </div>
     </div>
    </>}
    <div className="reservation-assignment-footer">
     <p role="status">{choiceStatus}</p>
     <button type="button" className="btn-primary" disabled={!canAssign}
      onClick={()=>void perform('assign')}>{busy?'Assigning…':
       selectedRoom?'Assign Room '+selectedRoom.number:'Select a room first'}</button>
    </div>
    {lastOperation==='assign'&&error&&<p role="alert" className="auth-error"><AlertTriangle size={16}/>
     {error} Refresh the room choices and try another available room.</p>}
    {lastOperation==='assign'&&success&&<p role="status" className="wizard-selection">
     <CheckCircle2 size={17}/>{success}</p>}
    <p className="desk-muted">These choices are advisory and do not hold inventory or certify room readiness.
     The backend rechecks all conflicts when you save.</p>
   </section>}
   </>}
   <section ref={lifecycleRef} className={deskAction==='check-in'||deskAction==='check-out'?'fdc-target-operation':''}>
    <h4>{record.lifecycleState==='checked_in'?'Complete guest departure':'Step 2 · Guest arrival and check-in'}</h4>
    <p className="desk-muted">Hotel-local day: {hotelDate}. The server confirms dates, booking status, and authorization when you save.</p>
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
    {lastOperation!==null&&lastOperation!=='assign'&&error&&
     <p role="alert" className="auth-error"><AlertTriangle size={16}/>{error}</p>}
    {lastOperation!==null&&lastOperation!=='assign'&&success&&
     <p role="status" className="wizard-selection"><CheckCircle2 size={17}/>{success}</p>}
    <p className="desk-muted">Acknowledgement is a UI confirmation only; the backend does not store independent identity/readiness attestations. Payments and refunds are not changed by these actions.</p>
   </section>
  </>}
  {(canOperate||manager)&&<details className="workflow-disclosure reservation-secondary-detail">
   <summary>Manager exceptions · Cancellation and date change requests</summary>
   <ReservationApprovalRequests key={hotelId+'-'+record.id}
    record={record} canRequest={canOperate} manager={manager}/>
  </details>}
  <details className="workflow-disclosure reservation-secondary-detail">
   <summary>Recorded reservation history · Audit events</summary>
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
  </details>
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
 </Panel>;
}
