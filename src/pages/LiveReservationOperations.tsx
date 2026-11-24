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
import {hotelPath,readSession} from '../api/session';
import {requestJson} from '../api/http';
import {addDays} from '../features/reservations/calendarDate';
import {ApiError} from '../api/http';
import {financialCheckoutBlock,useSettlementStatement} from '../components/SettlementPanel';
import {isGuestBillSettled} from '../features/billing/reviewedPaymentSettlement';
import {StayExtensionModal} from '../components/StayExtensionModal';
import {useReadinessPolicy} from '../api/readinessEnforcementPolicy';
import {useLiveReadiness} from '../api/liveRoomReadiness';
import {useBookingTurnover} from '../api/liveBookingTurnover';
import {useHotelAuth} from '../components/AuthProvider';
import {ReservationApprovalRequests} from '../components/ReservationApprovalRequests';
import {EarlyCheckInRequest} from '../components/EarlyCheckInRequest';
import {EarlyCheckOutRequest} from '../components/EarlyCheckOutRequest';
import {ReservationSpecialRequests} from '../components/ReservationSpecialRequests';
import {Status} from '../components/ui';
import {QueryFeedback} from '../components/QueryFeedback';
import {hotelToday} from '../features/reservations/calendarDate';
import {dateLabel,statusLabel,readableDateTime,readableDate} from '../lib/format';
import {auditActorName} from '../components/ReadableAuditEvent';
import {listHotelStaff} from '../api/liveStaff';
import {useQuery} from '@tanstack/react-query';

export function LiveReservationOperations({record,onClose,preferredRoomId,preferredRoomNumber,deskAction}:{
 record:LiveRecord;onClose:()=>void;preferredRoomId?:string|null;preferredRoomNumber?:string|null;
 deskAction?:'assign'|'check-in'|'check-out'|'extend'|null;
}){
 const {hotelId,user}=useHotelAuth();
 const canOperate=!!hotelId&&!!user?.hotels.some(h=>h.id===hotelId&&(h.role==='admin'||h.role==='front_desk'));
 const manager=!!hotelId&&!!user?.hotels.some(h=>h.id===hotelId&&h.role==='admin');
 const canDo=(permission:string)=>!!user?.hotels.some(h=>h.id===hotelId
  &&(h.role==='admin'||h.permissions?.includes(permission)===true||h.role==='front_desk'&&!h.permissions));
 const staff=useQuery({queryKey:['hotel-staff',hotelId],queryFn:listHotelStaff,enabled:manager});
 const [roomPage,setRoomPage]=useState(1);
 const [showRoomPicker,setShowRoomPicker]=useState(false);
 const [historyPage,setHistoryPage]=useState(1);
 const [roomId,setRoomId]=useState('');
 const [confirmedDepartureAt,setConfirmedDepartureAt]=useState('');
 const [acknowledged,setAcknowledged]=useState(false);
 const [busy,setBusy]=useState(false);
 const [success,setSuccess]=useState('');
 const [error,setError]=useState('');
 const [lastOperation,setLastOperation]=useState<'assign'|Operation|null>(null);
 const inFlight=useRef(false);
 const roomDialog=useRef<HTMLDialogElement>(null);
 const lifecycleRef=useRef<HTMLElement>(null);
 const client=useQueryClient();
 const roomChoices=useLiveRoomChoices(record,roomPage,canDo('booking.assign_room')&&showRoomPicker);
 const history=useLiveReservationHistory(record,historyPage);
 const readinessPolicy=useReadinessPolicy();
 const readiness=useLiveReadiness(record.assignedRoomId);
 const turnover=useBookingTurnover(record.id,record.lifecycleState==='checked_out');
 const earlyCheckoutEvent=history.data?.data.find(event=>event.eventType==='early_check_out');
 const selectedRoom=roomChoices.data?.data.find(r=>r.id===roomId);
 const canAssign=canDo('booking.assign_room')&&record.lifecycleState==='confirmed'
  &&!!selectedRoom&&selectedRoom.status==='available'
  &&roomId!==record.assignedRoomId&&!busy;
 const choiceStatus=selectedRoom?.reason==='maintenance_block'
  ?'Blocked by maintenance for the selected nights.'
  :selectedRoom?.reason==='reservation_conflict'
  ?'Already assigned to another reservation during this stay.'
  :selectedRoom?.current?'This is already the assigned room.'
  :selectedRoom?'No listed conflicts. We’ll check availability again when you assign the room.'
  :'Select an available room to proceed.';
 const hotelDate=hotelToday();
 const expiredStay=record.lifecycleState==='confirmed'&&hotelDate>=record.checkOut;
 const lateArrival=record.lifecycleState==='confirmed'&&record.checkIn<hotelDate&&hotelDate<record.checkOut;
 const [newArrival,setNewArrival]=useState(hotelDate);
 const [newDeparture,setNewDeparture]=useState(addDays(hotelDate,1));
 const amendDialog=useRef<HTMLDialogElement>(null);
 const [amendError,setAmendError]=useState('');
 const roomRestricted=readiness.isSuccess&&(readiness.data.blockers.activeInventoryBlockToday||readiness.data.blockers.activeRoomImpactMaintenance);
 const readyForEnforcedCheckin=readinessPolicy.isSuccess&&(
  !readinessPolicy.data.enforceAtCheckIn || (readiness.isSuccess&&readiness.data.advisoryReady)
 );
 const canCheckIn=canDo('booking.check_in')&&allowedOperation(record,'check-in',hotelDate)
  &&readyForEnforcedCheckin&&!roomRestricted&&acknowledged&&!busy;
 const checkoutStatement=useSettlementStatement(hotelId,record.id,canDo('finance.read')&&record.lifecycleState==='checked_in');
 const financialBlock=checkoutStatement.isSuccess?financialCheckoutBlock(checkoutStatement.data):null;
 const paymentCovered=checkoutStatement.isSuccess&&isGuestBillSettled(checkoutStatement.data);
 const paymentReady=paymentCovered&&!financialBlock;

 // Checkout permission is independent of permission to view the financial statement.
 // Billing preview is advisory for submission; the lifecycle endpoint validates billing under lock.
 const checkoutBlockReason=!canDo('booking.check_out')?'Your role does not have permission to complete checkout.'
  :!allowedOperation(record,'check-out',hotelDate)?'Normal checkout opens '+dateLabel(record.checkOut)+'. Use early checkout if the guest is leaving sooner.'
  :!acknowledged?'Confirm the departure checklist to continue.':busy?'Saving checkout…':null;
 const canCheckOut=checkoutBlockReason===null;
 const bill=canDo('finance.read')?checkoutStatement.data:undefined;
 const activePayments=bill?.payments.filter(p=>p.status==='pending_review'||p.status==='staff_confirmed')??[];
 const recordedPayments=activePayments.reduce((sum,p)=>sum+p.amountMinor,0);
 const pendingPayment=activePayments.some(p=>p.status==='pending_review'||(bill?.settlementWorkflowEnabled&&p.verificationStatus!=='verified'));
 const billMoney=(minor:number)=>new Intl.NumberFormat('en-PH',{style:'currency',currency:bill?.currency??'PHP'}).format(minor/100);
 const recordedBalance=bill?bill.netRecordedChargesMinor-recordedPayments+bill.verifiedRefundsMinor:0;
 const billStatus=!bill?'Unavailable':financialBlock
  ?pendingPayment?'Review pending':recordedBalance>0?'Unpaid balance':'Needs attention'
  :paymentReady||bill.routineCashCheckoutEligible?'Paid'
  :recordedBalance>0?'Unpaid balance':pendingPayment?'Review pending'
  :recordedBalance<0?'Credit / overpayment':recordedBalance===0?'No recorded balance':'Review bill';

 useEffect(()=>{
  setRoomPage(1);setHistoryPage(1);setRoomId('');setAcknowledged(false);setConfirmedDepartureAt('');
  setShowRoomPicker(false);
  setSuccess('');setError('');
 },[hotelId,record.id,record.lifecycleState]);
 useEffect(()=>{
  if(!preferredRoomId||!preferredRoomNumber||!roomChoices.data||roomId)return;
  const verified=roomChoices.data.data.find(item=>item.id===preferredRoomId
   &&item.number===preferredRoomNumber&&item.roomTypeId===record.roomTypeId);
  if(verified&&verified.status==='available')setRoomId(verified.id);
 },[preferredRoomId,preferredRoomNumber,roomChoices.data,record.roomTypeId,roomId]);
 useEffect(()=>{
  // A front desk shortcut highlights the relevant guarded operation;
  // never execute an assignment or lifecycle transition on navigation.
  if(!deskAction||deskAction==='extend')return;
  if(deskAction==='assign'){
   if(canOperate&&record.lifecycleState==='confirmed'&&!record.assignedRoomId)setShowRoomPicker(true);
   return;
  }
  const eligible=deskAction==='check-in'?record.lifecycleState==='confirmed'
   :record.lifecycleState==='checked_in';
  if(!eligible)return;
  lifecycleRef.current?.scrollIntoView({behavior:'smooth',block:'start'});
 },[deskAction,hotelId,canOperate,record.id,record.lifecycleState,record.assignedRoomId]);
 useEffect(()=>{
  const dialog=roomDialog.current;
  if(showRoomPicker&&dialog&&!dialog.open)dialog.showModal();
 },[showRoomPicker]);
 async function amendDates(event:FormEvent){
  event.preventDefault();
  if(!hotelId||!manager||inFlight.current||newArrival<hotelDate||newDeparture<=newArrival||readSession().hotelId!==hotelId)return;
  inFlight.current=true;setBusy(true);setAmendError('');
  try{
   await requestJson(hotelPath('/bookings/'+record.id+'/dates'),{method:'PATCH',body:{checkIn:newArrival,checkOut:newDeparture}});
   if(readSession().hotelId!==hotelId)return;
   amendDialog.current?.close();setAcknowledged(false);void refresh(hotelId).catch(()=>{});
  }catch(cause){setAmendError(cause instanceof Error?cause.message:'Could not update stay dates.');}
  finally{inFlight.current=false;setBusy(false);}
 }
 function openRoomPicker(){
  setRoomPage(1);setRoomId('');setError('');setShowRoomPicker(true);
 }
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
   client.invalidateQueries({queryKey:['live','billing-folios',hotel]}),
   client.invalidateQueries({queryKey:['live','folio-ledger',hotel,record.id]}),
   client.invalidateQueries({queryKey:['live','settlement-statement',hotel,record.id]}),
   client.invalidateQueries({queryKey:['live','booking-forecast',hotel]}),
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
    setSuccess(data.unchanged?'Room assignment was already recorded.':'Room assigned successfully.');
    roomDialog.current?.close();
    setShowRoomPicker(false);
   }else{
    const data=await transitionLiveStay(targetHotel,record,action,action==='check-out'?confirmedDepartureAt:undefined);
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
     client.invalidateQueries({queryKey:['live','settlement-statement',targetHotel,record.id]}),
    ]).catch(()=>{});
   }
   if(readSession().hotelId===targetHotel)
    setError(cause instanceof Error?cause.message:'The operation result could not be confirmed. Refresh hotel records before retrying.');
  }finally{inFlight.current=false;setBusy(false);}
 }

 const isConfirmed=record.lifecycleState==='confirmed';
 const isInHouse=record.lifecycleState==='checked_in';
 const earlyDepartureWindow=isInHouse&&hotelDate>=record.checkIn&&hotelDate<record.checkOut;
 const isFinished=record.lifecycleState==='checked_out'||record.lifecycleState==='cancelled';
 const roomAssigned=!!record.assignedRoomId;
 const allowStayAction=canOperate&&(isConfirmed||isInHouse);
 const actionLabel=isConfirmed?'Check in guest':isInHouse?'Complete checkout':'View stay history';
 const readinessNeeded=isConfirmed&&readinessPolicy.data?.enforceAtCheckIn===true;
 const canProceed=isConfirmed?canCheckIn:canCheckOut;
 const blockedReason=isConfirmed&&!canDo('booking.check_in')?'Your role does not have permission to check in.'
  :isConfirmed&&roomRestricted?'The assigned room has an active inventory or maintenance restriction.'
  :!roomAssigned&&isConfirmed?'Assign a room before check-in.'
  :isConfirmed&&readinessPolicy.isPending?'Checking the hotel readiness policy…'
  :isConfirmed&&readinessPolicy.isError?'Could not verify the hotel readiness policy. Retry before proceeding.'
  :readinessNeeded&&readiness.isPending?'Checking approved room readiness…'
  :readinessNeeded&&(!readiness.isSuccess||!readiness.data.advisoryReady)
   ?'This room is not approved as ready. Ask housekeeping to complete readiness review.'
  :isConfirmed&&!allowedOperation(record,'check-in',hotelDate)
   ?'Check-in is not available for this stay date.'
  :isInHouse?checkoutBlockReason
  :!acknowledged?'Confirm the guest’s identity to continue.':null;

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
   <div className="desk-tools">
    {isInHouse&&canOperate&&hotelId&&record.assignedRoomId&&
     <StayExtensionModal key={hotelId+'-'+record.id} hotelId={hotelId} record={record} today={hotelDate}
      openOnEntry={deskAction==='extend'} disabled={busy} onSaved={()=>refresh(hotelId)}/>}
   <button type="button" className="stay-close-btn" onClick={onClose} disabled={busy}>
    <ArrowLeft size={16}/> All reservations
   </button>
   </div>
  </header>

  {deskAction&&<p className="stay-entry-note" role="status">
   Opened from the front desk queue. Review the details before confirming a change.
  </p>}

  {allowStayAction&&isConfirmed&&!expiredStay&&<section className="stay-next-strip" aria-label="Recommended next step">
   <span className={'stay-next-strip-icon '+(
    isInHouse&&financialBlock||isConfirmed&&!roomAssigned||
    isConfirmed&&roomAssigned&&readinessNeeded&&readiness.isSuccess&&!readiness.data.advisoryReady
     ?'attention':'ready')} aria-hidden="true">
    {isInHouse&&financialBlock||isConfirmed&&!roomAssigned||
     isConfirmed&&roomAssigned&&readinessNeeded&&readiness.isSuccess&&!readiness.data.advisoryReady
      ?<AlertTriangle size={18}/>:<CheckCircle2 size={18}/>}
   </span>
   <div className="stay-next-strip-copy">
    <span className="stay-next-strip-eyebrow">NEXT STEP</span>
    <strong>{isConfirmed&&!roomAssigned?'Assign a room'
     :isConfirmed&&roomAssigned&&readinessNeeded&&readiness.isSuccess&&!readiness.data.advisoryReady?'Room needs attention'
     :isConfirmed?'Review check-in'
     :paymentCovered&&financialBlock?'Payment received · review pending'
     :financialBlock?'Review outstanding billing'
     :!canDo('finance.read')?'Review checkout':checkoutStatement.isFetching?'Checking guest billing'
     :checkoutStatement.isError?'Billing status unavailable'
     :earlyDepartureWindow?'Review early departure'
     :paymentReady?'Payment settled · ready for checkout'
     :'Ready to review checkout'}</strong>
    <p>{isConfirmed&&!roomAssigned?'Choose an available room to continue.'
     :isConfirmed&&roomAssigned&&readinessNeeded&&readiness.isSuccess&&!readiness.data.advisoryReady?'Housekeeping must clear room readiness before check-in.'
     :isConfirmed?'Confirm the guest’s identity and arrival details.'
     :paymentCovered&&financialBlock?'Payment is recorded and covers the charges. '+financialBlock+' Do not collect another payment.'
     :financialBlock?financialBlock
     :!canDo('finance.read')?'Billing will be validated when checkout is submitted.':checkoutStatement.isFetching?'We’re loading the current guest bill.'
     :checkoutStatement.isError?'You can retry the billing preview or submit checkout for server validation.'
     :earlyDepartureWindow?'An early departure requires the appropriate exception approval.'
     :paymentReady?'No outstanding guest payment. Review departure details to complete checkout.'
     :'Billing checks are clear. Review departure details below.'}</p>
   </div>
   <div className="stay-next-strip-action">
    {isConfirmed&&!roomAssigned
     ?<button type="button" className="stay-next-strip-button" aria-haspopup="dialog"
       onClick={openRoomPicker}>Select room <ArrowRight size={15}/></button>
     :isConfirmed&&roomAssigned&&readinessNeeded&&readiness.isSuccess&&!readiness.data.advisoryReady
     ?<Link to="/housekeeping" search={{}} className="stay-next-strip-button">Housekeeping <ArrowRight size={15}/></Link>
     :isInHouse&&financialBlock
     ?<Link to="/billing" search={{booking:record.id}} className="stay-next-strip-button">Review bill <ArrowRight size={15}/></Link>
     :isInHouse&&checkoutStatement.isError
     ?<button type="button" className="stay-next-strip-button" disabled={checkoutStatement.isFetching}
       onClick={()=>void checkoutStatement.refetch()}><RefreshCw size={15}/> Retry billing</button>
     :<button type="button" className="stay-next-strip-button" disabled={isInHouse&&canDo('finance.read')&&checkoutStatement.isFetching}
       onClick={()=>lifecycleRef.current?.scrollIntoView({behavior:'smooth',block:'start'})}>
       {isConfirmed?'Check-in details':'Checkout details'} <ArrowRight size={15}/>
      </button>}
   </div>
  </section>}

  <div className="stay-detail-grid">
   <main className="stay-primary-column">
    {allowStayAction&&<section className="stay-action-card" ref={lifecycleRef} aria-labelledby="stay-action-heading">
     <div className="stay-action-top">
      <div className="stay-section-icon">{isConfirmed?<UserRound size={20}/>:<Clock3 size={20}/>}</div>
      <div>
       <p className="stay-overline">{isConfirmed?'ARRIVAL / NEXT ACTION':'DEPARTURE / NEXT ACTION'}</p>
       <h3 id="stay-action-heading">{expiredStay?'Scheduled stay has ended':isConfirmed?'Ready to check in?':earlyDepartureWindow?'Guest leaving early?':'Complete guest checkout'}</h3>
       <p className="stay-action-description">{expiredStay?'The scheduled checkout date has been reached. Update the stay dates before checking in.':isConfirmed
        ?'Confirm guest identity and room readiness before recording arrival.'
        :earlyDepartureWindow?'Request an early departure and have it reviewed by an authorized manager.'
        :'Review the bill and confirm the guest has departed.'}</p>
      </div>
     </div>
     {expiredStay&&<div className="stay-operation-impact">
      <strong>{dateLabel(record.checkIn)} – {dateLabel(record.checkOut)}</strong>
      <p>Hotel date: {dateLabel(hotelDate)}. {manager?'Modify dates if the guest still intends to stay. Review cancellation and deposit obligations before resolving a missed arrival.':'Ask a manager to resolve the expired booking.'}</p>
      {manager&&<button type="button" className="btn-primary" disabled={busy} onClick={()=>{setNewArrival(hotelDate);setNewDeparture(addDays(hotelDate,1));setAmendError('');amendDialog.current?.showModal();}}>Modify stay dates <ArrowRight size={16}/></button>}
      <dialog ref={amendDialog} className="billing-action-modal" aria-label="Modify stay dates" onCancel={event=>{if(busy)event.preventDefault();}}>
       <form className="billing-payment-fields" onSubmit={amendDates}>
        <h3>Modify stay dates</h3><p>Availability is validated when saving. Priced bookings require a financial repricing workflow.</p>
        <label className="night-audit-date">Arrival<input type="date" className="wizard-input" required min={hotelDate} value={newArrival} disabled={busy} onChange={event=>{setNewArrival(event.target.value);if(newDeparture<=event.target.value)setNewDeparture(addDays(event.target.value,1));}}/></label>
        <label className="night-audit-date">Departure<input type="date" className="wizard-input" required min={addDays(newArrival||hotelDate,1)} value={newDeparture} disabled={busy} onChange={event=>setNewDeparture(event.target.value)}/></label>
        {amendError&&<p role="alert" className="stay-feedback-error">{amendError}</p>}
        <button type="submit" className="btn-primary" disabled={busy||newArrival<hotelDate||newDeparture<=newArrival}>{busy?'Saving…':'Save stay dates'}</button>
        <button type="button" className="btn-inline" disabled={busy} onClick={()=>amendDialog.current?.close()}>Cancel</button>
       </form>
      </dialog>
     </div>}
     {lateArrival&&<p className="stay-blocked-hint" role="status">Late arrival: scheduled arrival was {dateLabel(record.checkIn)}. Check-in is available for the remaining stay, subject to room availability.</p>}
     {isConfirmed&&!expiredStay&&<div className="stay-requirement">
      <span className={roomAssigned?'stay-requirement-mark done':'stay-requirement-mark'}>
       {roomAssigned?<CheckCircle2 size={17}/>:<BedDouble size={17}/>}
      </span>
      <div><strong>{roomAssigned?'Room assigned':'Room assignment required'}</strong>
       <small>{roomAssigned
        ?'Room '+(record.assignedRoomNumber??'#'+record.assignedRoomId)+' · '+(record.roomTypeName??'Booked category')
        :'Choose a compatible available room before the guest can check in.'}</small></div>
      {!roomAssigned&&<button type="button" className="stay-text-button"
       aria-haspopup="dialog" onClick={openRoomPicker}>
       Select room <ArrowRight size={15}/></button>}
     </div>}
     {isConfirmed&&!expiredStay&&roomAssigned&&<section aria-label="Assigned room inspection and housekeeping status">
      <div className="stay-requirement">
       <span className={readiness.isSuccess&&readiness.data.advisoryReady?'stay-requirement-mark done':'stay-requirement-mark'}>
        {readiness.isSuccess&&readiness.data.advisoryReady?<CheckCircle2 size={17}/>:<AlertTriangle size={17}/>}</span>
       <div><strong>Room readiness: {readiness.isPending?'Checking…':readiness.isError?'Cannot verify':readiness.data?.advisoryReady?'Ready':'Attention required'}</strong>
        <small>Room {record.assignedRoomNumber??record.assignedRoomId} · separate from assignment and guest identity</small></div>
       <button type="button" className="stay-text-button" disabled={readiness.isFetching}
        onClick={()=>void readiness.refetch()}><RefreshCw size={14}/> Refresh</button>
      </div>
      <QueryFeedback loading={readiness.isPending} error={readiness.error} onRetry={()=>void readiness.refetch()}/>
      {readiness.isSuccess&&<>
       <div className="stay-requirement">
        <span className={readiness.data.inspection?.status==='approved'&&!readiness.data.blockers.newTurnoverSinceInspection&&!readiness.data.blockers.newRoomWorkSinceInspection?'stay-requirement-mark done':'stay-requirement-mark'}><ShieldCheck size={17}/></span>
        <div><strong>Inspection: {readiness.data.inspection===null?'Not recorded':readiness.data.inspection.status==='approved'&&(readiness.data.blockers.newTurnoverSinceInspection||readiness.data.blockers.newRoomWorkSinceInspection)?'Reinspection required':readiness.data.inspection.status==='approved'?'Current':readiness.data.inspection.status==='submitted'?'Submitted · awaiting review':'Rejected'}</strong>
         <small>Physical condition, safety and amenities</small></div>
        <Link to="/housekeeping" search={{}} className="stay-text-button">Open housekeeping task <ArrowRight size={14}/></Link>
       </div>
       <div className="stay-requirement">
        <span className={readiness.data.blockers.unfinishedHousekeeping||readiness.data.blockers.latestTurnoverIncomplete?'stay-requirement-mark':'stay-requirement-mark done'}><CheckCircle2 size={17}/></span>
        <div><strong>Housekeeping: {readiness.data.blockers.unfinishedHousekeeping||readiness.data.blockers.latestTurnoverIncomplete?'Outstanding':'No active cleaning blockers'}</strong>
         <small>Housekeeping completion is separate from the room inspection.</small></div>
        <Link to="/housekeeping" search={{}} className="stay-text-button">Open housekeeping task <ArrowRight size={14}/></Link>
       </div>
       {Object.values(readiness.data.blockers).some(Boolean)&&<p className="stay-blocked-hint" role="status">
        Other readiness checks: {[
         readiness.data.blockers.activeInventoryBlockToday&&'Inventory restriction',
         readiness.data.blockers.activeRoomImpactMaintenance&&'Maintenance restriction',
         readiness.data.blockers.latestTurnoverIncomplete&&'Checkout cleaning incomplete',
         readiness.data.blockers.newTurnoverSinceInspection&&'Reinspection after checkout',
         readiness.data.blockers.unfinishedHousekeeping&&'Unfinished housekeeping',
         readiness.data.blockers.newRoomWorkSinceInspection&&'Reinspection after room work',
        ].filter(Boolean).join(' · ')}
       </p>}
      </>}
      <QueryFeedback loading={readinessPolicy.isPending} error={readinessPolicy.error} onRetry={()=>void readinessPolicy.refetch()}/>
      {readinessPolicy.isSuccess&&<p className="stay-security-note" role="status">
       Check-in inspection enforcement: <strong>{readinessPolicy.data.enforceAtCheckIn?'Enabled':'Not enabled'}</strong>.
       {readinessPolicy.data.enforceAtCheckIn
        ?' Current room readiness is required to check in.'
        :' Room readiness is advisory under the current property policy; review unresolved room checks.'}
      </p>}
     </section>}
     {isConfirmed&&!expiredStay&&!roomAssigned&&<p className="stay-security-note">Assign a room to view inspection and housekeeping status.</p>}
     {isInHouse&&<section className="stay-operation-impact" aria-label="Guest bill and payment status">
      <div className="stay-section-heading">
       <div><h3>Guest bill</h3>{bill&&<p role="status"><strong>{billStatus}</strong></p>}</div>
       {canDo('finance.read')&&<Link to="/billing" search={{booking:record.id}} className="stay-text-button">View bill <ArrowRight size={15}/></Link>}
      </div>
      {bill?<><div className="stay-facts-item"><small>Total bill</small><strong>{billMoney(bill.netRecordedChargesMinor)}</strong></div>
       <div className="stay-facts-item"><small>Payments recorded</small><strong>{billMoney(recordedPayments)}</strong></div>
       {bill.verifiedRefundsMinor>0&&<div className="stay-facts-item"><small>Refunds</small><strong>{billMoney(bill.verifiedRefundsMinor)}</strong></div>}
       <div className="stay-facts-item"><small>{recordedBalance<0?'Credit':'Balance'}</small><strong>{billMoney(Math.abs(recordedBalance))}</strong></div>
       {financialBlock&&recordedBalance<=0&&<p className="stay-security-note">Do not collect the recorded payment again.</p>}
       {earlyDepartureWindow&&financialBlock&&<p className="stay-blocked-hint" role="status">{financialBlock}</p>}
       {checkoutStatement.isFetching&&<small role="status">Refreshing bill…</small>}
      </>:<p role="status">{!canDo('finance.read')?'Billing is checked at checkout.':checkoutStatement.isFetching?'Loading bill…':'Bill unavailable. Billing is checked at checkout.'}</p>}
      {canDo('finance.read')&&checkoutStatement.isError&&<button type="button" className="stay-text-button" disabled={checkoutStatement.isFetching||busy} onClick={()=>void checkoutStatement.refetch()}><RefreshCw size={14}/> Retry</button>}
     </section>}
     {isInHouse&&!earlyDepartureWindow&&<label className="night-audit-date">
      Departure time (optional)
      <input className="wizard-input" type="datetime-local" value={confirmedDepartureAt}
       disabled={busy} onChange={event=>setConfirmedDepartureAt(event.target.value)}/>
     </label>}
     {!earlyDepartureWindow&&!expiredStay&&<label className="stay-confirm-check">
      <input type="checkbox" checked={acknowledged} disabled={busy}
       onChange={e=>setAcknowledged(e.target.checked)}/>
      <span>{isConfirmed
       ?'I have verified the guest’s identity against their identification.'
       :'I confirm the guest has departed and I have reviewed the bill.'}</span>
     </label>}
     {!earlyDepartureWindow&&!expiredStay&&<div className="stay-action-footer">
      <button type="button" className="btn-primary stay-submit-btn" disabled={!canProceed}
       onClick={()=>void perform(isConfirmed?'check-in':'check-out')}>
       {busy?'Saving…':actionLabel} <ArrowRight size={17}/>
      </button>
      {blockedReason&&<span className="stay-blocked-hint">{isConfirmed&&record.checkIn>hotelDate
       ?'Normal check-in opens '+dateLabel(record.checkIn)+'.'
       :blockedReason}</span>}
     </div>}
     {isConfirmed&&record.checkIn>hotelDate&&
      <EarlyCheckInRequest key={record.id+'-'+hotelId} record={record} today={hotelDate}/>}
     {earlyDepartureWindow&&
      <EarlyCheckOutRequest key={'checkout-'+record.id+'-'+hotelId} record={record} today={hotelDate}/>}
     {lastOperation!==null&&lastOperation!=='assign'&&error&&
      <p role="alert" className="stay-feedback-error"><AlertTriangle size={16}/>{error}</p>}
     {lastOperation!==null&&lastOperation!=='assign'&&success&&<>
      <p role="status" className="stay-feedback-success"><CheckCircle2 size={17}/>{success}</p>
      <div className="stay-operation-next-links">
       <Link to="/housekeeping" search={{}}>View housekeeping queue <ArrowRight size={14}/></Link>
       <Link to="/billing" search={{booking:record.id}}>Review guest bill <ArrowRight size={14}/></Link>
      </div>
     </>}
     {isInHouse&&<p className="stay-security-note">Checkout creates a housekeeping cleaning task. It does not change payments or issue refunds.</p>}
    </section>}
    {!canOperate&&(isConfirmed||isInHouse)&&<p className="stay-blocked-hint" role="status">
     Your hotel role cannot check in or check out this guest. Ask authorized front-desk staff or an administrator.
    </p>}

    {canOperate&&isConfirmed&&<section className="stay-room-section" aria-label="Room assignment">
     <div className="stay-section-heading">
      <div>
       <p className="stay-overline">ROOM ASSIGNMENT</p>
       <h3>{roomAssigned?'Assigned room':'Choose a room'}</h3>
       <p>{roomAssigned?'You can change rooms before check-in.':'Select an available room of the booked category.'}</p>
      </div>
      <button type="button" className="btn-inline" disabled={busy} aria-haspopup="dialog"
       onClick={openRoomPicker}>{roomAssigned?'Change room':'Select room'}</button>
     </div>
     {roomAssigned&&<div className="stay-current-room">
      <BedDouble size={20}/>
      <div><strong>Room {record.assignedRoomNumber??'#'+record.assignedRoomId}</strong>
       <small>{record.roomTypeName??'Booked room category'} · Assigned to this stay</small></div>
      <CheckCircle2 size={18} className="stay-room-confirmed"/>
     </div>}
     {lastOperation==='assign'&&success&&<p role="status" className="stay-feedback-success">
      <CheckCircle2 size={17}/>{success}</p>}
     {showRoomPicker&&<dialog ref={roomDialog} className="billing-action-modal"
      style={{margin:'auto',width:'min(670px, calc(100% - 32px))',color:'var(--text)'}}
      aria-labelledby="stay-room-picker-title" onClose={()=>setShowRoomPicker(false)}
      onCancel={event=>{if(inFlight.current)event.preventDefault();}}>
      <header className="billing-action-modal-header">
       <div><h3 id="stay-room-picker-title">{roomAssigned?'Change room':'Select room'}</h3>
        <p>{record.reference} · {dateLabel(record.checkIn)} – {dateLabel(record.checkOut)}</p></div>
       <button className="btn-inline" type="button" disabled={busy} onClick={()=>roomDialog.current?.close()}>Close</button>
      </header>
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
      <p className="stay-security-note">This preview does not hold the room. We’ll check availability again when you assign the room.</p>
     </dialog>}
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
     {earlyCheckoutEvent&&<div className="stay-facts-item stay-early-record">
      <small>EARLY CHECKOUT · AUDITED</small>
      <strong>Actual departure recorded: {readableDateTime(earlyCheckoutEvent.createdAt)}</strong>
      <span>Originally scheduled departure: {dateLabel(record.checkOut)}</span>
      <span>Recorded by {auditActorName(earlyCheckoutEvent.actorId,
       earlyCheckoutEvent.actorName??staff.data?.data.find(m=>m.userId===earlyCheckoutEvent.actorId)?.name,
       user?.id,user?.name)}</span>
      <span>See the manager approval inbox for the reason and financial follow-up.</span>
     </div>}
     {record.earlyCheckIn&&<div className="stay-facts-item stay-early-record">
      <small>EARLY CHECK-IN · AUDITED</small>
      <strong>Actual arrival: {readableDate(record.earlyCheckIn.actualCheckInDate)}</strong>
      <span>Originally booked: {readableDate(record.earlyCheckIn.scheduledCheckIn)}</span>
      <span>Recorded at: {readableDateTime(record.earlyCheckIn.actualCheckedInAt)}</span>
      <span>Approved by {auditActorName(record.earlyCheckIn.approvedBy,
       staff.data?.data.find(m=>m.userId===record.earlyCheckIn?.approvedBy)?.name,user?.id,user?.name)}</span>
      <span>Approval #{record.earlyCheckIn.approvalRequestId}</span>
      <span>Reason: {record.earlyCheckIn.reason}</span>
      <span>Manager note: {record.earlyCheckIn.managerNote}</span>
     </div>}
     <div className="stay-facts-item"><small>Reservation reference</small><strong>{record.reference}</strong></div>
    </section>
    <div className="stay-side-tip"><ShieldCheck size={17}/>
     <p>All reservation changes are checked against hotel rules and recorded in the activity history.</p>
    </div>
   </aside>
  </div>

  <section className="stay-secondary-area" aria-label="Additional reservation actions">
   <h3>More options &amp; history</h3>
   <p>Use these when you need to change the booking or review previous activity.</p>
   <details className="stay-secondary-disclosure">
    <summary>Special requests <span>Guest instructions and needs</span></summary>
    <div className="stay-secondary-content">
     <ReservationSpecialRequests bookingId={record.id}
      canEdit={canOperate&&!isFinished}/>
    </div>
   </details>
   {(canOperate||manager)&&<details className="stay-secondary-disclosure">
    <summary>Cancellation or date change request <span>Manager approval required</span></summary>
    <div className="stay-secondary-content"><ReservationApprovalRequests
     key={hotelId+'-'+record.id} record={record} canRequest={canOperate} manager={manager}/></div>
   </details>}
   <details className="stay-secondary-disclosure">
    <summary>Reservation activity log <span>View recorded changes</span></summary>
    <div className="stay-secondary-content">
     <p className="stay-security-note">Activity shows recorded actions, who performed them and any saved status changes. It does not prove physical occupancy or bank settlement.</p>
     <QueryFeedback loading={history.isPending} error={history.error}
      empty={history.isSuccess&&history.data.data.length===0} onRetry={()=>void history.refetch()}/>
     {history.isSuccess&&history.data.data.length>0&&<div className="reservation-audit-timeline">
      {history.data.data.map(item=><article className="readable-audit-event" key={item.id}>
       <strong>{statusLabel(item.eventType)}</strong>
       <p className="readable-audit-context">{auditActorName(item.actorId,
        item.actorName??staff.data?.data.find(m=>m.userId===item.actorId)?.name,user?.id,user?.name)}
        {' · '}{readableDateTime(item.createdAt)}</p>
       {item.confirmedDepartureAt&&<p>Confirmed departure: {item.confirmedDepartureAt} (hotel local)</p>}
       {item.note&&<p>{item.note}</p>}
       {item.oldState!==item.newState&&<div className="readable-audit-changes">
        <div><span>Reservation status</span><strong>{item.oldState?statusLabel(item.oldState):'Not recorded'}
         {' → '}{item.newState?statusLabel(item.newState):'Not recorded'}</strong></div>
       </div>}
       {item.oldState===item.newState&&<p className="readable-audit-context">
        Action recorded. No status change is included in this event.</p>}
      </article>)}
     </div>}
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
