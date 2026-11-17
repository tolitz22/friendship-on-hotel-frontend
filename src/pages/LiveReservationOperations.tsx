import {useEffect,useRef,useState} from 'react';
import type {FormEvent} from 'react';
import {useQueryClient} from '@tanstack/react-query';
import {Link} from '@tanstack/react-router';
import {AlertTriangle,CheckCircle2,ArrowRight,ArrowLeft,CalendarDays,UserRound,Clock3,BedDouble,ShieldCheck,RefreshCw} from 'lucide-react';
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
import {EarlyCheckInRequest} from '../components/EarlyCheckInRequest';
import {Status} from '../components/ui';
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

 const isConfirmed=record.lifecycleState==='confirmed';
 const isInHouse=record.lifecycleState==='checked_in';
 const isFinished=record.lifecycleState==='checked_out'||record.lifecycleState==='cancelled';
 const roomAssigned=!!record.assignedRoomId;
 const allowStayAction=canOperate&&(isConfirmed||isInHouse);
 const actionLabel=isConfirmed?'Check in guest':isInHouse?'Check out guest':'View stay history';
 const readinessNeeded=isConfirmed&&readinessPolicy.data?.enforceAtCheckIn===true;
 const canProceed=isConfirmed?canCheckIn:canCheckOut;
 const blockedReason=!roomAssigned&&isConfirmed?'Assign a room before check-in.'
  :isConfirmed&&readinessPolicy.isPending?'Checking the hotel readiness policy…'
  :isConfirmed&&readinessPolicy.isError?'Could not verify the hotel readiness policy. Retry before proceeding.'
  :readinessNeeded&&readiness.isPending?'Checking approved room readiness…'
  :readinessNeeded&&(!readiness.isSuccess||!readiness.data.advisoryReady)
   ?'This room is not approved as ready. Ask housekeeping to complete readiness review.'
  :isConfirmed&&!allowedOperation(record,'check-in',hotelDate)
   ?'Check-in is not available for this stay date.'
  :isInHouse&&!allowedOperation(record,'check-out',hotelDate)
   ?'Checkout is not due yet. A manager must review any earlier departure.'
  :!acknowledged?'Complete the verification checkbox to continue.'
  :null;

 return <div className="stay-detail-page">
  <header className="stay-detail-header">
   <div className="stay-header-identity">
    <div className="stay-header-eyebrow">RESERVATION <span aria-hidden="true">/</span> {record.reference}</div>
    <div className="stay-heading-line">
     <h2>{record.guestName?.trim()||'Guest details unavailable'}</h2>
     <Status value={statusLabel(record.lifecycleState??'unknown')}/>
     {record.earlyCheckIn&&<span className="stay-early-chip">Early check-in recorded</span>}
    </div>
    <div className="stay-heading-meta">
     <span><CalendarDays size={16}/> {dateLabel(record.checkIn)} – {dateLabel(record.checkOut)}</span>
     <span><BedDouble size={16}/> {record.assignedRoomNumber
      ?'Room '+record.assignedRoomNumber:roomAssigned?'Room #'+record.assignedRoomId:'Room not assigned'}</span>
    </div>
   </div>
   <button type="button" className="stay-close-btn" onClick={onClose} disabled={busy}>
    <ArrowLeft size={16}/> All reservations
   </button>
  </header>

  {deskAction&&<p className="stay-entry-note" role="status">
   Opened from the front desk queue. Review the details before confirming a change.
  </p>}

  <div className="stay-detail-grid">
   <main className="stay-primary-column">
    {allowStayAction&&<section className="stay-action-card" ref={lifecycleRef} aria-labelledby="stay-action-heading">
     <div className="stay-action-top">
      <div className="stay-section-icon">{isConfirmed?<UserRound size={20}/>:<Clock3 size={20}/>}</div>
      <div>
       <p className="stay-overline">{isConfirmed?'ARRIVAL / NEXT ACTION':'DEPARTURE / NEXT ACTION'}</p>
       <h3 id="stay-action-heading">{isConfirmed?'Ready to check in?':'Complete guest checkout'}</h3>
       <p className="stay-action-description">{isConfirmed
        ?'Confirm guest identity and room readiness before recording arrival.'
        :'Confirm departure and financial follow-up before ending this registered stay.'}</p>
      </div>
     </div>
     {isConfirmed&&<div className="stay-requirement">
      <span className={roomAssigned?'stay-requirement-mark done':'stay-requirement-mark'}>
       {roomAssigned?<CheckCircle2 size={17}/>:<BedDouble size={17}/>}
      </span>
      <div><strong>{roomAssigned?'Room assigned':'Room assignment required'}</strong>
       <small>{roomAssigned
        ?'Room '+(record.assignedRoomNumber??'#'+record.assignedRoomId)+' · '+(record.roomTypeName??'Booked category')
        :'Choose a compatible available room before the guest can check in.'}</small></div>
      {!roomAssigned&&<button type="button" className="stay-text-button"
       onClick={()=>{setShowRoomPicker(true);assignmentRef.current?.scrollIntoView({behavior:'smooth',block:'start'});}}>
       Select room <ArrowRight size={15}/></button>}
     </div>}
     {isConfirmed&&<>
      <QueryFeedback loading={readinessPolicy.isPending} error={readinessPolicy.error}
       onRetry={()=>void readinessPolicy.refetch()}/>
      {readinessNeeded&&roomAssigned&&<div className="stay-requirement">
       <span className={readiness.isSuccess&&readiness.data.advisoryReady?'stay-requirement-mark done':'stay-requirement-mark'}>
        {readiness.isSuccess&&readiness.data.advisoryReady?<CheckCircle2 size={17}/>:<ShieldCheck size={17}/>}
       </span>
       <div><strong>Housekeeping readiness {readiness.isSuccess&&readiness.data.advisoryReady?'approved':'required'}</strong>
        <small>Hotel policy requires current approved room readiness.</small></div>
       <button type="button" className="stay-text-button" onClick={()=>void readiness.refetch()}>
        <RefreshCw size={14}/> Refresh</button>
      </div>}
      {readinessNeeded&&roomAssigned&&<QueryFeedback loading={readiness.isPending} error={readiness.error}
       onRetry={()=>void readiness.refetch()}/>}
     </>}
     <label className="stay-confirm-check">
      <input type="checkbox" checked={acknowledged} disabled={busy}
       onChange={e=>setAcknowledged(e.target.checked)}/>
      <span>{isConfirmed
       ?'I have verified the guest’s identity, assigned room, and housekeeping readiness.'
       :'I have verified departure timing and reviewed any payment or balance follow-up.'}</span>
     </label>
     <div className="stay-action-footer">
      <button type="button" className="btn-primary stay-submit-btn" disabled={!canProceed}
       onClick={()=>void perform(isConfirmed?'check-in':'check-out')}>
       {busy?'Saving…':actionLabel} <ArrowRight size={17}/>
      </button>
      {blockedReason&&<span className="stay-blocked-hint">{isConfirmed&&record.checkIn>hotelDate
       ?'Normal check-in opens '+dateLabel(record.checkIn)+'.'
       :blockedReason}</span>}}
     </div>
     {isConfirmed&&record.checkIn>hotelDate&&
      <EarlyCheckInRequest key={record.id+'-'+hotelId} record={record} today={hotelDate}/>}
     {lastOperation!==null&&lastOperation!=='assign'&&error&&
      <p role="alert" className="stay-feedback-error"><AlertTriangle size={16}/>{error}</p>}
     {lastOperation!==null&&lastOperation!=='assign'&&success&&
      <p role="status" className="stay-feedback-success"><CheckCircle2 size={17}/>{success}</p>}
     <p className="stay-security-note">The server independently checks stay dates, permissions and room readiness. This action does not change payments.</p>
    </section>}

    {canOperate&&isConfirmed&&<section ref={assignmentRef} className="stay-room-section" aria-label="Room assignment">
     <div className="stay-section-heading">
      <div>
       <p className="stay-overline">ROOM ASSIGNMENT</p>
       <h3>{roomAssigned?'Assigned room':'Choose a room'}</h3>
       <p>{roomAssigned?'You can change rooms before check-in.':'Select an available room of the booked category.'}</p>
      </div>
      {roomAssigned&&<button type="button" className="btn-inline" disabled={busy}
       onClick={()=>{setShowRoomPicker(v=>!v);setRoomId('');}}>
       {showRoomPicker?'Cancel change':'Change room'}
      </button>}
     </div>
     {roomAssigned&&<div className="stay-current-room">
      <BedDouble size={20}/>
      <div><strong>Room {record.assignedRoomNumber??'#'+record.assignedRoomId}</strong>
       <small>{record.roomTypeName??'Booked room category'} · Assigned to this stay</small></div>
      <CheckCircle2 size={18} className="stay-room-confirmed"/>
     </div>}
     {showRoomPicker&&<>
      {preferredRoomId&&<p className="stay-entry-note">
       Calendar selection: Room {preferredRoomNumber??preferredRoomId}. Choose it below if currently available.
      </p>}
      <div className="stay-picker-caption">
       <span>Rooms matching {roomChoices.data?.meta.roomTypeName??record.roomTypeName??'booked category'}</span>
       <button type="button" className="stay-text-button" onClick={()=>void roomChoices.refetch()}
        disabled={roomChoices.isFetching||busy}><RefreshCw size={14}/> Refresh availability</button>
      </div>
      <QueryFeedback loading={roomChoices.isPending} error={roomChoices.error}
       onRetry={()=>void roomChoices.refetch()}/>
      {roomChoices.isSuccess&&<div className="stay-room-choices" role="radiogroup" aria-label="Available physical rooms">
       {roomChoices.data.data.length===0&&<p>No matching rooms on this page. Browse another page or ask a manager to review inventory.</p>}
       {roomChoices.data.data.map(room=><label key={room.id}
        className={'stay-room-choice'+(roomId===room.id?' selected':'')+
         (room.status==='unavailable'||room.current?' unavailable':'')}>
        <input type="radio" name={'room-choice-'+record.id} value={room.id}
         checked={roomId===room.id} disabled={busy||room.status!=='available'||room.current}
         onChange={()=>{setRoomId(room.id);setError('');setSuccess('');}}/>
        <span><strong>Room {room.number}</strong><small>Floor {room.floor??'—'}</small></span>
        <em>{room.current?'Assigned now':room.reason==='maintenance_block'?'Maintenance block':
         room.reason==='reservation_conflict'?'Already booked':'Available'}</em>
       </label>)}
      </div>}
      {roomChoices.isSuccess&&<div className="stay-room-pagination">
       <span>Page {roomChoices.data.meta.page} of {Math.max(1,roomChoices.data.meta.totalPages)} · {roomChoices.data.meta.total} rooms</span>
       <div>
        <button className="btn-inline" type="button" disabled={roomPage<=1||busy}
         onClick={()=>{setRoomPage(p=>p-1);setRoomId('');}}>Previous</button>
        <button className="btn-inline" type="button" disabled={roomPage>=roomChoices.data.meta.totalPages||busy}
         onClick={()=>{setRoomPage(p=>p+1);setRoomId('');}}>Next</button>
       </div>
      </div>}
      <div className="stay-room-save">
       <span>{choiceStatus}</span>
       <button className="btn-primary" type="button" disabled={!canAssign}
        onClick={()=>void perform('assign')}>
        {busy?'Saving room…':selectedRoom?'Assign room '+selectedRoom.number:'Select an available room'}
       </button>
      </div>
      {lastOperation==='assign'&&error&&<p role="alert" className="stay-feedback-error">
       <AlertTriangle size={16}/>{error}</p>}
      {lastOperation==='assign'&&success&&<p role="status" className="stay-feedback-success">
       <CheckCircle2 size={17}/>{success}</p>}
      <p className="stay-security-note">Availability is not held by this preview. Laravel checks all overlapping bookings and maintenance blocks again when saving.</p>
     </>}
    </section>}

    {isFinished&&<section className="stay-completed-card">
     <CheckCircle2 size={23}/>
     <div><h3>{record.lifecycleState==='checked_out'?'Stay checked out':'Reservation cancelled'}</h3>
      <p>{record.lifecycleState==='checked_out'?'No more guest stay actions are available. Review the housekeeping handoff below.':'This reservation is no longer active. See recorded history for changes.'}</p>
     </div>
    </section>}
    {!canOperate&&<p className="stay-readonly">You have read-only access. Room and check-in/out actions require front-desk or manager permissions.</p>}
    {record.lifecycleState==='checked_out'&&<section className="stay-room-section">
     <h3>Housekeeping handoff</h3>
     <QueryFeedback loading={turnover.isPending} error={turnover.error}
      onRetry={()=>void turnover.refetch()}/>
     {turnover.isSuccess&&(turnover.data.task
      ?<Link to="/housekeeping" search={{task:turnover.data.task.id}} className="stay-inline-link">
        Open cleaning task #{turnover.data.task.id} <ArrowRight size={15}/></Link>
      :<p>No linked cleaning task was returned. Review the housekeeping queue or contact a manager.</p>)}
     {turnover.isSuccess&&!turnover.data.task&&<Link to="/housekeeping" className="stay-inline-link">
      Review cleaning tasks <ArrowRight size={15}/></Link>}
    </section>}
   </main>

   <aside className="stay-side-column" aria-label="Reservation details">
    <section className="stay-facts-card">
     <div className="stay-facts-title"><h3>Stay details</h3><span>#{record.id}</span></div>
     <div className="stay-facts-item"><small>Guest</small><strong>{record.guestName?.trim()||'Unavailable'}</strong></div>
     <div className="stay-facts-item"><small>Room category</small><strong>{record.roomTypeName??'Room type #'+record.roomTypeId}</strong></div>
     <div className="stay-facts-item"><small>Physical room</small><strong>{record.assignedRoomNumber
      ?'Room '+record.assignedRoomNumber:roomAssigned?'Room #'+record.assignedRoomId:'Not assigned'}</strong></div>
     <div className="stay-facts-item stay-facts-dates">
      <div><small>Check-in</small><strong>{dateLabel(record.checkIn)}</strong></div>
      <div><small>Check-out</small><strong>{dateLabel(record.checkOut)}</strong></div>
     </div>
     {record.earlyCheckIn&&<div className="stay-facts-item stay-early-record">
      <small>EARLY CHECK-IN · AUDITED</small>
      <strong>Actual arrival: {record.earlyCheckIn.actualCheckInDate}</strong>
      <span>Originally booked: {record.earlyCheckIn.scheduledCheckIn}</span>
      <span>Recorded at: {record.earlyCheckIn.actualCheckedInAt}</span>
      <span>Approved by manager #{record.earlyCheckIn.approvedBy}</span>
      <span>Approval #{record.earlyCheckIn.approvalRequestId}</span>
      <span>Reason: {record.earlyCheckIn.reason}</span>
      <span>Manager note: {record.earlyCheckIn.managerNote}</span>
     </div>}
     <div className="stay-facts-item"><small>Reservation reference</small><strong>{record.reference}</strong></div>
    </section>
    <div className="stay-side-tip"><ShieldCheck size={17}/>
     <p>All actions are validated by Laravel and recorded in the reservation audit trail.</p>
    </div>
   </aside>
  </div>

  <section className="stay-secondary-area" aria-label="Additional reservation actions">
   <h3>More options &amp; history</h3>
   <p>Use these when you need to change the booking or review previous activity.</p>
   {(canOperate||manager)&&<details className="stay-secondary-disclosure">
    <summary>Cancellation or date change request <span>Manager approval required</span></summary>
    <div className="stay-secondary-content"><ReservationApprovalRequests
     key={hotelId+'-'+record.id} record={record} canRequest={canOperate} manager={manager}/></div>
   </details>}
   <details className="stay-secondary-disclosure">
    <summary>Reservation activity log <span>View recorded changes</span></summary>
    <div className="stay-secondary-content">
     <p className="stay-security-note">Activity shows recorded actions and staff identifiers, not independent proof of physical occupancy or payment settlement.</p>
     <QueryFeedback loading={history.isPending} error={history.error}
      empty={history.isSuccess&&history.data.data.length===0} onRetry={()=>void history.refetch()}/>
     {history.isSuccess&&history.data.data.length>0&&<div className="table-scroll">
      <table><thead><tr><th>Event</th><th>Before</th><th>After</th><th>Staff ID</th><th>Recorded</th></tr></thead>
       <tbody>{history.data.data.map(item=><tr key={item.id}>
        <td>{item.eventType.replaceAll('_',' ')}</td>
        <td>{item.oldState??'—'}</td><td>{item.newState??'—'}</td>
        <td>{item.actorId}</td><td>{item.createdAt}</td>
       </tr>)}</tbody></table></div>}
     {history.isSuccess&&<div className="stay-room-pagination">
      <span>Page {history.data.meta.page} of {Math.max(1,history.data.meta.totalPages)}</span>
      <div><button className="btn-inline" disabled={historyPage<=1} type="button"
       onClick={()=>setHistoryPage(p=>Math.max(1,p-1))}>Previous</button>
       <button className="btn-inline" disabled={historyPage>=history.data.meta.totalPages} type="button"
        onClick={()=>setHistoryPage(p=>p+1)}>Next</button></div>
     </div>}
    </div>
   </details>
  </section>
 </div>;
}
