import {useEffect,useRef,useState} from 'react';
import {Link,useNavigate,useSearch} from '@tanstack/react-router';
import {useQueryClient} from '@tanstack/react-query';
import {CalendarDays,Plus,ArrowRight,RefreshCw,Trash2,Search,Layers3,Clock3,ChevronLeft,ChevronRight,UserPlus,BedDouble,CheckCircle2,AlertTriangle,LogIn,LogOut,Filter,X,History} from 'lucide-react';
import {useHotelAuth} from '../components/AuthProvider';
import {Panel} from '../components/ui';
import {QueryFeedback} from '../components/QueryFeedback';
import {BookingGuestPicker} from '../components/BookingGuestPicker';
import {QuickGuestDialog} from '../components/QuickGuestDialog';
import type {Guest} from '../api/types';
import {useSelectedGuest} from '../api/liveSelectedGuest';
import {useLiveRoomTypes,useLiveRatePlans,validLiveStay} from '../api/liveReservations';
import {createGroupBooking,useGroupBooking,useGroupBookings} from '../api/groupReservations';
import {deriveGroupStatus,groupStatusLabel} from '../api/groupReservations';
import type {GroupBooking,GroupBookingInput,GroupStatusFilter} from '../api/groupReservations';
import {hotelToday,addDays} from '../features/reservations/calendarDate';
import {readSession} from '../api/session';
import {useGroupAllotments,createGroupAllotment,releaseGroupAllotment} from '../api/groupAllotments';
import type {GroupAllotment,GroupHoldInput} from '../api/groupAllotments';
import {useGroupFinancialSummary,allocateVerifiedGroupPayment} from '../api/groupFinance';
import {readableDate,readableDateTime,statusLabel} from '../lib/format';

type Room={guestId:string;roomTypeId:string;ratePlanId:string};
const blank=():Room=>({guestId:'',roomTypeId:'',ratePlanId:''});
const money=(minor:number,currency:string)=>new Intl.NumberFormat('en-PH',{
 style:'currency',currency:currency==='PHP'?'PHP':'USD',
}).format(minor/100);
const start=()=>hotelToday();

function RoomGuestField({value,index,disabled,onChange,onAddGuest,canAddGuest,createdGuest}:{
 value:string;index:number;disabled:boolean;onChange:(id:string)=>void;
 onAddGuest:()=>void;canAddGuest:boolean;createdGuest?:Guest;
}){
 const selected=useSelectedGuest(value||null);
 const guest=createdGuest?.id===value?createdGuest:selected.data;
 return <div className="gb-guest-field">
  <div className="gb-field-heading">
   <label className="wizard-label" id={'group-guest-'+index}>Registered guest</label>
   {canAddGuest&&<button type="button" className="gb-add-guest" disabled={disabled}
    onClick={onAddGuest}><UserPlus size={15}/> Add guest</button>}
  </div>
  <BookingGuestPicker value={value} selectedGuest={guest??undefined}
   disabled={disabled} onChange={onChange}/>
  {value&&!guest&&selected.isError&&<small role="alert">Could not verify this guest. Search and choose again.</small>}
 </div>;
}

function GroupPayerAllocation({groupId,report}:{
 groupId:string;report:NonNullable<ReturnType<typeof useGroupFinancialSummary>['data']>;
}){
 const {hotelId,user}=useHotelAuth();
 const admin=!!user?.hotels.some(h=>h.id===hotelId&&h.role==='admin');
 const client=useQueryClient();
 const choices=report.rooms.filter(row=>row.priced&&!row.signed
  &&row.unallocatedNetChargesMinor>0&&row.eligiblePayments.some(p=>p.remainingMinor>0));
 const [bookingId,setBookingId]=useState('');
 const [paymentId,setPaymentId]=useState('');
 const [amount,setAmount]=useState('');
 const [pending,setPending]=useState<{
  hotelId:string;groupId:string;bookingId:string;paymentId:string;
  input:{requestKey:string;amountMinor:number};
 }|null>(null);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState<string|null>(null);
 const [success,setSuccess]=useState(false);
 if(!admin)return null;
 const booking=choices.find(row=>row.bookingId===bookingId);
 const payments=booking&&booking.priced?booking.eligiblePayments.filter(p=>p.remainingMinor>0):[];
 const payment=payments?.find(p=>p.paymentId===paymentId);
 const minor=/^\d+(?:\.\d{1,2})?$/.test(amount)?Math.round(Number(amount)*100):NaN;
 const max=booking&&booking.priced&&payment?Math.min(
  booking.unallocatedNetChargesMinor,payment.remainingMinor):0;
 const canSubmit=!pending&&!!booking&&!!payment&&Number.isSafeInteger(minor)
  &&minor>0&&minor<=max;
 const reset=()=>{setPending(null);setPaymentId('');setAmount('');setError(null);setSuccess(false);};
 const send=async(submission:NonNullable<typeof pending>)=>{
  setBusy(true);setError(null);setSuccess(false);
  try{
   await allocateVerifiedGroupPayment(submission.groupId,submission.bookingId,
    submission.paymentId,submission.input);
   if(readSession().hotelId!==submission.hotelId)return;
   setPending(null);setSuccess(true);setPaymentId('');setAmount('');
   await Promise.all([
    client.invalidateQueries({queryKey:['live','group-finance',submission.hotelId,submission.groupId]}),
    client.invalidateQueries({queryKey:['live','settlement',submission.hotelId]})]);
  }catch(e){
   if(readSession().hotelId===submission.hotelId)
    setError(e instanceof Error?e.message:'Unable to confirm payment allocation.');
  }finally{setBusy(false);}
 };
 return <details className="workflow-disclosure">
  <summary>Allocate an independently verified group payment</summary>
  <p className="desk-muted">This does not record a new payment. Only independently reviewed,
   existing payment evidence can be allocated to its own guest folio.
   The original payment and audit records remain unchanged.</p>
  {choices.length===0?<p>No eligible verified funds and unpaid recorded charges to allocate.</p>:<>
   <div className="wizard-fields">
    <div><label className="wizard-label" htmlFor="group-allocation-booking">Reservation to settle</label>
     <select id="group-allocation-booking" className="wizard-input" value={bookingId}
      disabled={!!pending||busy} onChange={e=>{setBookingId(e.target.value);setPaymentId('');setAmount('');}}>
      <option value="">Choose reservation</option>
      {choices.map(row=><option key={row.bookingId} value={row.bookingId}>
       {row.reference} · {row.priced?row.currency:''}</option>)}
     </select></div>
    <div><label className="wizard-label" htmlFor="group-allocation-payment">Verified payment</label>
     <select id="group-allocation-payment" className="wizard-input" value={paymentId}
      disabled={!!pending||busy||!bookingId} onChange={e=>{setPaymentId(e.target.value);setAmount('');}}>
      <option value="">Choose verified payment</option>
      {payments.map(p=><option key={p.paymentId} value={p.paymentId}>
       {p.reference} · {(p.remainingMinor/100).toFixed(2)} remaining</option>)}
     </select></div>
    <div><label className="wizard-label" htmlFor="group-allocation-amount">
      Amount to allocate {booking&&booking.priced?'('+booking.currency+')':''}</label>
     <input id="group-allocation-amount" className="wizard-input" inputMode="decimal"
      placeholder="0.00" value={amount} disabled={!!pending||busy||!payment}
      onChange={e=>setAmount(e.target.value)}/>
     {max>0&&<small>Maximum available: {(max/100).toFixed(2)}</small>}
    </div>
   </div>
   {error&&<p className="wizard-error" role="alert">{error}</p>}
   {success&&<p role="status">The verified payment allocation was recorded. The group totals were refreshed.</p>}
   {pending?<div>
    <p role="status">Submission outcome needs confirmation. Retry with the same request key to avoid duplicates.</p>
    <button className="btn-primary" type="button" disabled={busy}
     onClick={()=>void send(pending)}>{busy?'Checking…':'Retry allocation safely'}</button>
    <button className="btn-inline" type="button" disabled={busy} onClick={reset}>Close retry</button>
   </div>:<button className="btn-primary" type="button" disabled={!canSubmit||busy}
    onClick={()=>{
     if(!hotelId||!booking||!payment||!canSubmit)return;
     const submitted={hotelId,groupId,bookingId:booking.bookingId,
      paymentId:payment.paymentId,input:{requestKey:crypto.randomUUID(),amountMinor:minor}};
     setPending(submitted);void send(submitted);
    }}>Allocate reviewed payment</button>}
  </>}
 </details>;
}

function GroupFinance({groupId,hotelId,checkIn,checkOut,open=false}:{
 groupId:string;hotelId?:string;checkIn?:string;checkOut?:string;open?:boolean;
}){
 const report=useGroupFinancialSummary(groupId);
 const data=report.data;
 return <details id="group-billing-overview" key={groupId+'-'+String(open)} open={open?true:undefined}
  className="workflow-disclosure gb-finance-section">
  <summary>Group billing · consolidated overview and reviewed allocations</summary>
  <Panel title="Group billing and settlement progress">
   <p className="desk-muted">Amounts are drawn from each reservation's recorded folio.
    Staff-confirmed evidence is not automatically independently verified or bank-settled.
    Group allocations require a separate authorized review.</p>
   <QueryFeedback loading={report.isPending} error={report.error}
    onRetry={()=>void report.refetch()}/>
   {data&&<>
    {data.currencies.length===0&&<p>No priced guest folios are available for this group.</p>}
    {data.currencies.map(total=><div key={total.currency} className="rb-section">
     <strong>{total.currency} · {total.pricedFolioCount} priced folios</strong>
     <dl className="readable-audit-changes">
      <div><dt>Net recorded charges</dt><dd>{(total.netRecordedChargesMinor/100).toLocaleString('en-PH',{style:'currency',currency:total.currency})}</dd></div>
      <div><dt>Staff-confirmed payments</dt><dd>{(total.staffConfirmedPaymentsMinor/100).toLocaleString('en-PH',{style:'currency',currency:total.currency})}</dd></div>
      <div><dt>Independently reviewed allocations</dt><dd>{(total.verifiedAllocatedMinor/100).toLocaleString('en-PH',{style:'currency',currency:total.currency})}</dd></div>
      <div><dt>Group payer allocations (reviewed)</dt><dd>{(total.verifiedGroupPayerAllocatedMinor/100).toLocaleString('en-PH',{style:'currency',currency:total.currency})}</dd></div>
      <div><dt>Unallocated recorded charges</dt><dd>{(total.unallocatedNetChargesMinor/100).toLocaleString('en-PH',{style:'currency',currency:total.currency})}</dd></div>
     </dl>
    </div>)}
    <div className="gb-billing-progress" aria-label="Group payment and settlement progress">
     <div><small>Priced guest folios</small><strong>{data.rooms.filter(row=>row.priced).length} / {data.rooms.length}</strong></div>
     <div><small>Payment evidence recorded</small><strong>{data.rooms.filter(row=>row.priced&&row.staffConfirmedPaymentsMinor>0).length} / {data.rooms.length}</strong></div>
     <div><small>Verified allocations recorded</small><strong>{data.rooms.filter(row=>row.priced&&row.verifiedAllocatedMinor>0).length} / {data.rooms.length}</strong></div>
     <div><small>Settlement sign-offs recorded</small><strong>{data.rooms.filter(row=>row.priced&&row.signed).length} / {data.rooms.length}</strong></div>
    </div>
    <div className="gb-billing-folios">
     {data.rooms.map(row=><div className="gb-billing-folio" key={row.bookingId}>
      <div><strong>{row.reference}</strong><small>{row.priced
       ?row.signed?'Settlement signed':row.verifiedAllocatedMinor>0?'Reviewed allocation recorded':'Settlement incomplete'
       :'No priced folio available'}</small></div>
      <Link to="/billing" search={{booking:row.bookingId,group:groupId,hotel:hotelId,
       checkIn,checkOut}}>Review guest folio <ArrowRight size={14}/></Link>
     </div>)}
    </div>
    {data.rooms.some(row=>!row.priced)&&<p role="status">Some group rooms have no priced folio and are excluded from financial totals.</p>}
    <GroupPayerAllocation groupId={groupId} report={data}/>
    <p className="desk-muted">Not a final invoice. Open the individual guest bill to review payment records and verification before any group-payer allocation.</p>
   </>}
  </Panel>
 </details>;
}

function GroupAllotmentsPanel({hotelId,onConvert}:{hotelId:string;onConvert:(hold:GroupAllotment)=>void}){
 const {user}=useHotelAuth();
 const admin=!!user?.hotels.some(item=>item.id===hotelId&&item.role==='admin');
 const client=useQueryClient();
 const holds=useGroupAllotments();
 const types=useLiveRoomTypes();
 const [name,setName]=useState('');
 const [roomTypeId,setRoomTypeId]=useState('');
 const [quantity,setQuantity]=useState(2);
 const [checkIn,setCheckIn]=useState(hotelToday);
 const [checkOut,setCheckOut]=useState(()=>addDays(hotelToday(),1));
 const [minutes,setMinutes]=useState(60);
 const [pending,setPending]=useState<{hotelId:string;payload:GroupHoldInput}|null>(null);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState<string|null>(null);
 const send=async(input:GroupHoldInput,propertyId:string)=>{
  setBusy(true);setError(null);
  try{
   await createGroupAllotment(input);
   if(readSession().hotelId!==propertyId)return;
   setPending(null);setName('');setRoomTypeId('');
   await Promise.all([
    client.invalidateQueries({queryKey:['live','group-allotments',propertyId]}),
    client.invalidateQueries({queryKey:['live','availability',propertyId]})]);
  }catch(e){if(readSession().hotelId===propertyId)setError(e instanceof Error?e.message:'Could not confirm hold.');}
  finally{setBusy(false);}
 };
 const release=async(id:string)=>{
  setBusy(true);setError(null);
  try{
   await releaseGroupAllotment(id);
   await Promise.all([
    client.invalidateQueries({queryKey:['live','group-allotments',hotelId]}),
    client.invalidateQueries({queryKey:['live','availability',hotelId]})]);
  }catch(e){setError(e instanceof Error?e.message:'Could not release the hold.');}
  finally{setBusy(false);}
 };
 return <section className="gb-holds-workspace" aria-label="Temporary group room holds">
  <div className="gb-intro"><div><h3>Temporary room holds</h3>
   <p>Reserve room-type inventory while a group confirms its plans. Holds expire automatically.</p></div></div>
  <Panel title="Room allotments">
   <p className="desk-muted">Holds reserve a room-type quantity, not specific room numbers.
    They expire automatically and never create guest charges or deposits.</p>
   <QueryFeedback loading={holds.isPending||types.isPending}
    error={holds.error??types.error} onRetry={()=>{void holds.refetch();void types.refetch();}}/>
   {holds.data?.meta.hasMore&&<p role="status">Showing the 100 most recent holds; older records are not shown here.</p>}
   {holds.data&&<div className="gb-hold-kpis" aria-label="Temporary room holds summary">
    <div><small>Active holds</small><strong>{holds.data.data.filter(h=>h.status==='held').length}</strong></div>
    <div><small>Converted</small><strong>{holds.data.data.filter(h=>h.status==='converted').length}</strong></div>
    <div><small>Expired or released</small><strong>{holds.data.data.filter(h=>['expired','released'].includes(h.status)).length}</strong></div>
   </div>}
   <p className="desk-muted">Counts show only the latest {holds.data?.data.length??0} returned holds.
    An inventory hold is not a booking, payment, guest folio, or assigned room.</p>
   <div className="gb-hold-list">
    {holds.data?.data.map(hold=><article key={hold.id} className="gb-hold-card">
     <div className="gb-hold-card-main">
      <div className="gb-hold-card-head">
       <strong>{hold.name}</strong>
       <span className={'gb-lifecycle-badge gb-hold-'+hold.status}>
        {statusLabel(hold.status)}</span>
      </div>
      <small>{hold.reference} · {hold.quantity} × {hold.roomTypeName}</small>
      <div className="gb-hold-dates"><CalendarDays size={15}/>
       {readableDate(hold.checkIn)} – {readableDate(hold.checkOut)}</div>
      <small>{hold.status==='held'?'Expires '+readableDateTime(hold.expiresAt):
       hold.status==='converted'?'Converted to a confirmed group':'No active room inventory reserved'}</small>
      <small>Created by {hold.createdByName||'Employee name unavailable'}
       {hold.releasedByName?' · Released by '+hold.releasedByName:''}</small>
     </div>
     <div className="gb-hold-card-actions">
      {hold.status==='held'&&admin&&hold.quantity>=2&&
       <button className="btn-primary" type="button" disabled={busy||!!pending}
        onClick={()=>onConvert(hold)}>Convert to booking <ArrowRight size={14}/></button>}
      {hold.status==='held'&&admin&&<button className="btn-inline" type="button"
       disabled={busy||!!pending} onClick={()=>void release(hold.id)}>
       Release hold</button>}
      {hold.convertedGroupId&&<Link className="btn-inline" to="/group-reservations"
       search={{group:hold.convertedGroupId,hotel:hotelId}}>Open confirmed group <ArrowRight size={14}/></Link>}
      {hold.quantity<2&&hold.status==='held'&&<small>Single-room holds cannot convert to a multi-room group.</small>}
     </div>
    </article>)}
    {holds.data?.data.length===0&&<div className="gb-empty">
     <Clock3 size={24}/><strong>No temporary room holds</strong>
     <p>Use Create temporary hold only when a group has not committed to a reservation.</p>
    </div>}
   </div>
   {admin&&<details className="gb-hold-form">
    <summary><Plus size={16}/> Create temporary hold</summary>
    <div className="gb-hold-form-body"><h4>Hold details</h4>
    <fieldset disabled={busy||!!pending} className="rb-fieldset">
     <div className="wizard-fields">
      <div><label className="wizard-label" htmlFor="hold-name">Group name</label>
       <input id="hold-name" className="wizard-input" value={name} maxLength={120}
        onChange={e=>setName(e.target.value)}/></div>
      <div><label className="wizard-label" htmlFor="hold-type">Room type</label>
       <select id="hold-type" className="wizard-input" value={roomTypeId}
        onChange={e=>setRoomTypeId(e.target.value)}>
        <option value="">Select room type</option>
        {types.data?.data.map(type=><option key={type.id} value={type.id}>{type.name}</option>)}
       </select></div>
      <div><label className="wizard-label" htmlFor="hold-quantity">Rooms to hold (1–10)</label>
       <input id="hold-quantity" className="wizard-input" type="number" min={1} max={10}
        value={quantity} onChange={e=>setQuantity(Number(e.target.value))}/></div>
      <div><label className="wizard-label" htmlFor="hold-duration">Hold duration</label>
       <select id="hold-duration" className="wizard-input" value={minutes}
        onChange={e=>setMinutes(Number(e.target.value))}>
        <option value={15}>15 minutes</option><option value={60}>1 hour</option>
        <option value={240}>4 hours</option><option value={1440}>24 hours</option>
       </select></div>
      <div><label className="wizard-label" htmlFor="hold-in">Check-in</label>
       <input id="hold-in" className="wizard-input" type="date" min={hotelToday()}
        value={checkIn} onChange={e=>{setCheckIn(e.target.value);
         if(checkOut<=e.target.value)setCheckOut(addDays(e.target.value,1));}}/></div>
      <div><label className="wizard-label" htmlFor="hold-out">Check-out</label>
       <input id="hold-out" className="wizard-input" type="date" min={addDays(checkIn,1)}
        max={addDays(checkIn,31)} value={checkOut} onChange={e=>setCheckOut(e.target.value)}/></div>
     </div>
    </fieldset>
    {error&&<p className="wizard-error" role="alert">{error}</p>}
    {pending?<button className="btn-primary" disabled={busy} type="button"
      onClick={()=>void send(pending.payload,pending.hotelId)}>{busy?'Checking hold…':'Retry same hold request'}</button>:
     <button className="btn-primary" type="button" disabled={busy||!roomTypeId||name.trim().length<2||
      !Number.isInteger(quantity)||quantity<1||quantity>10||
      !validLiveStay({roomTypeId,checkIn,checkOut})||checkIn<hotelToday()}
      onClick={()=>{
       const payload:GroupHoldInput={idempotencyKey:crypto.randomUUID(),name:name.trim(),
        roomTypeId:Number(roomTypeId),quantity,checkIn,checkOut,holdMinutes:minutes};
       setPending({hotelId,payload});void send(payload,hotelId);
      }}>Hold room inventory</button>}
    </div>
   </details>}
  </Panel>
 </section>;
}

function GroupDetails({id,billingOpen=false,originHotel}:{id:string;billingOpen?:boolean;originHotel?:string}){
 const {hotelId}=useHotelAuth();
 const [detailTab,setDetailTab]=useState<'rooms'|'billing'|'activity'>(billingOpen?'billing':'rooms');
 useEffect(()=>{if(billingOpen)setDetailTab('billing');},[billingOpen]);
 const mismatch=!!originHotel&&originHotel!==hotelId;
 const details=useGroupBooking(mismatch?null:id);
 const finance=useGroupFinancialSummary(mismatch?'':id);
 const group=details.data;
 useEffect(()=>{
  if(billingOpen&&group?.id===id){
   document.getElementById('group-billing-overview')?.scrollIntoView({block:'start',behavior:'smooth'});
  }
 },[billingOpen,group?.id,id]);
 if(mismatch)return <Panel title="Select the original property">
  <p role="alert">This group booking link belongs to another hotel. Select that hotel in the property selector to open the original group safely.</p>
  <Link to="/group-reservations" search={{}}>Back to Group Bookings</Link>
 </Panel>;
 const dates=group?.checkIn&&group?.checkOut
  ?readableDate(group.checkIn)+' – '+readableDate(group.checkOut):'Stay dates unavailable';
 const assigned=group?.operations.assignedCount??0;
 const arrived=group?.operations.checkedInOrOutCount??0;
 const departed=group?.operations.checkedOutCount??0;
 return <>
  <Link className="gb-back-link" to="/group-reservations" search={{}}><ChevronLeft size={16}/> All Group Bookings</Link>
  <QueryFeedback loading={details.isPending} error={details.error} onRetry={()=>void details.refetch()}/>
  {group&&<div className="gb-detail">
   <div className="gb-detail-head"><div>
    <span className="gb-eyebrow">GROUP BOOKING · {group.reference}</span>
    <h2>{group.name}</h2>
    <p><strong>{dates}</strong> · {group.roomCount} rooms
     {group.contactName?' · Contact: '+group.contactName:''}</p>
    <small className="desk-muted">Created {readableDateTime(group.createdAt)}</small>
   </div></div>
   <div className="gb-context-actions">
    {group.checkIn&&<Link className="btn-primary" to="/room-calendar"
     search={{date:group.checkIn,end:group.checkOut??undefined,
      group:group.id,hotel:hotelId??undefined}}>
     <CalendarDays size={17}/> View group on calendar <ArrowRight size={15}/></Link>}
    <Link className="rr-secondary-action" to="/group-reservations"
     search={{group:group.id,tab:'billing' as const,hotel:hotelId??undefined}}>
     Open group billing <ArrowRight size={15}/></Link>
   </div>
   <section className="gb-detail-summary" aria-label="Group stay progress">
    <div><small>Group status</small>
     <strong className="gb-detail-lifecycle">{groupStatusLabel(deriveGroupStatus(group.rooms.map(room=>room.status)))}</strong>
     <span>Calculated from individual reservations</span></div>
    <div><small>Rooms assigned</small><strong>{assigned} / {group.roomCount}</strong>
     <span>{assigned===group.roomCount?'All assigned':'Rooms still need assignment'}</span></div>
    <div><small>Arrived or departed</small><strong>{arrived} / {group.roomCount}</strong>
     <span>{group.roomCount-arrived} not yet arrived or cancelled</span></div>
    <div><small>Checked out</small><strong>{departed} / {group.roomCount}</strong>
     <span>Managed per room</span></div>
   </section>
   <div className="gb-detail-tabs" role="tablist" aria-label="Group booking details">
    <button role="tab" aria-selected={detailTab==='rooms'} className={detailTab==='rooms'?'active':''}
     onClick={()=>setDetailTab('rooms')}><BedDouble size={16}/> Rooms & guests</button>
    <button role="tab" aria-selected={detailTab==='billing'} className={detailTab==='billing'?'active':''}
     onClick={()=>setDetailTab('billing')}><Layers3 size={16}/> Group billing</button>
    <button role="tab" aria-selected={detailTab==='activity'} className={detailTab==='activity'?'active':''}
     onClick={()=>setDetailTab('activity')}><History size={16}/> Activity & history</button>
   </div>
   {detailTab==='rooms'&&<section className="gb-detail-panel" role="tabpanel">
    <div className="gb-table-head"><div><h3>Rooms and registered guests</h3>
     <p>Each room has its own assignment, check-in, checkout and guest bill.</p></div>
     {group.checkIn&&<Link to="/room-calendar" className="btn-inline"
      search={{date:group.checkIn,end:group.checkOut??undefined,group:group.id,hotel:hotelId??undefined}}>
      <CalendarDays size={15}/> Group calendar</Link>}</div>
    <div className="gb-detail-room-table-scroll"><table className="gb-table">
     <thead><tr><th>Guest / booking</th><th>Room</th><th>Stay</th><th>Status</th><th>Actions</th></tr></thead>
     <tbody>{group.rooms.map(room=><tr key={room.bookingId}>
      <td><strong>{room.guestName??'Guest name unavailable'}</strong><small>{room.reference}</small></td>
      <td><strong>{room.roomNumber?'Room '+room.roomNumber:'Unassigned'}</strong>
       <small>{room.roomTypeName}</small></td>
      <td>{readableDate(room.checkIn)}<small>to {readableDate(room.checkOut)}</small></td>
      <td><span className={'gb-lifecycle-badge gb-lifecycle-'+(room.status??'confirmed')}>
       {statusLabel(room.status??'Unknown')}</span></td>
      <td><div className="gb-list-actions">
       <Link className="btn-inline" to="/reservations" search={{booking:room.bookingId,
        group:group.id,hotel:hotelId??undefined,checkIn:group.checkIn??undefined,
        checkOut:group.checkOut??undefined}}>Manage booking <ArrowRight size={14}/></Link>
       <Link to="/billing" search={{booking:room.bookingId,group:group.id,hotel:hotelId??undefined,
        checkIn:group.checkIn??undefined,checkOut:group.checkOut??undefined}}>Guest billing</Link>
      </div></td>
     </tr>)}</tbody>
    </table></div>
    <p className="desk-muted">Room readiness is advisory here ({group.operations.readinessAdvisoryReadyCount} of {group.operations.readinessCheckedCount} assigned rooms). Verify actual readiness before check-in. A group action never bypasses individual guest checks.</p>
   </section>}
   {detailTab==='billing'&&<section className="gb-detail-panel" role="tabpanel">
    <div className="gb-table-head"><div><h3>Group billing</h3>
     <p>Consolidated visibility only. Each guest folio remains authoritative.</p></div></div>
    <div className="gb-detail-finance-highlights">
     <div><small>Guest bills with prices</small><strong>{finance.data
      ?finance.data.rooms.filter(row=>row.priced).length+' / '+group.roomCount
      :finance.isPending?'Loading…':'Unavailable'}</strong></div>
     <div><small>With payment evidence</small><strong>{finance.data
      ?finance.data.rooms.filter(row=>row.priced&&row.staffConfirmedPaymentsMinor>0).length+' / '+group.roomCount
      :finance.isPending?'Loading…':'Unavailable'}</strong></div>
     <div><small>Independent sign-offs</small><strong>{finance.data
      ?finance.data.rooms.filter(row=>row.priced&&row.signed).length+' / '+group.roomCount
      :finance.isPending?'Loading…':'Unavailable'}</strong></div>
    </div>
    <GroupFinance groupId={group.id} hotelId={hotelId??undefined}
     checkIn={group.checkIn??undefined} checkOut={group.checkOut??undefined} open/>
   </section>}
   {detailTab==='activity'&&<section className="gb-detail-panel" role="tabpanel">
    <div className="gb-table-head"><div><h3>Group activity and operational history</h3>
     <p>Known booking milestones from current records; individual audit trails remain on each booking.</p></div></div>
    <div className="gb-activity-list">
     <div><CheckCircle2 size={16}/><div><strong>Group reservation created</strong>
      <span>{readableDateTime(group.createdAt)} · {group.reference}</span></div></div>
     {group.rooms.map(room=><div key={room.bookingId}>
      {room.status==='checked_out'?<LogOut size={16}/>:room.status==='checked_in'?<LogIn size={16}/>:<CalendarDays size={16}/>}
      <div><strong>{room.guestName??'Guest'} · {room.roomNumber?'Room '+room.roomNumber:'No assigned room'}</strong>
       <span>{statusLabel(room.status??'Unknown')} · {readableDate(room.checkIn)} to {readableDate(room.checkOut)}</span>
       <Link to="/reservations" search={{booking:room.bookingId,group:group.id,
        hotel:hotelId??undefined}}>Open booking history <ArrowRight size={13}/></Link></div>
     </div>)}
    </div>
    <p className="desk-muted">These are current statuses, not timestamped audit changes. For who changed a room, payment or booking, open its detailed history. No employee or action is inferred.</p>
    <div className="gb-detail-operational-links">
     <Link to="/housekeeping" search={{}}>Housekeeping · {group.operations.checkoutCleaningCompleteCount} complete / {group.operations.checkoutCleaningPendingCount} pending</Link>
     <Link to="/rooms" search={{}}>Room inspections and readiness</Link>
    </div>
   </section>}
  </div>}
 </>;
}

export function GroupReservations(){
 const {hotelId,user}=useHotelAuth();
 const canBook=!!user?.hotels.some(h=>h.id===hotelId&&(h.role==='admin'||h.role==='front_desk'));
 const canCreateGuest=!!user?.hotels.some(h=>h.id===hotelId&&h.role==='admin');
 const search=useSearch({from:'/group-reservations'});
 const navigate=useNavigate();
 const client=useQueryClient();
 const [page,setPage]=useState(1);
 const [groupFilter,setGroupFilter]=useState<GroupStatusFilter>('all');
 const [appliedSearch,setAppliedSearch]=useState('');
 const [formStep,setFormStep]=useState<1|2|3>(1);
 const groups=useGroupBookings(page,appliedSearch,groupFilter);
 const types=useLiveRoomTypes();
 const rates=useLiveRatePlans();
 const [view,setView]=useState<'groups'|'holds'|'new'>('groups');
 const [searchText,setSearchText]=useState('');
 useEffect(()=>{
  const timer=window.setTimeout(()=>{setAppliedSearch(searchText.trim());setPage(1);},300);
  return ()=>window.clearTimeout(timer);
 },[searchText]);
 const [selectedAllotment,setSelectedAllotment]=useState<GroupAllotment|null>(null);
 const [name,setName]=useState('');
 const [contact,setContact]=useState('');
 const [checkIn,setCheckIn]=useState(start);
 const [checkOut,setCheckOut]=useState(()=>addDays(start(),1));
 const [rooms,setRooms]=useState<Room[]>([blank(),blank()]);
 const [guestDialogRoom,setGuestDialogRoom]=useState<number|null>(null);
 const [createdGuests,setCreatedGuests]=useState<Record<string,Guest>>({});
 const [pending,setPending]=useState<{hotelId:string;payload:GroupBookingInput}|null>(null);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState<string|null>(null);
 const [result,setResult]=useState<GroupBooking|null>(null);
 const sending=useRef(false);
 const update=(i:number,key:keyof Room,value:string)=>{
  setRooms(old=>old.map((row,index)=>index===i
   ?{...row,[key]:value,...(key==='roomTypeId'?{ratePlanId:''}:{})}:row));
 };
 useEffect(()=>{setView('groups');setSearchText('');setAppliedSearch('');setGroupFilter('all');setFormStep(1);setSelectedAllotment(null);setPage(1);setPending(null);setResult(null);setError(null);setGuestDialogRoom(null);setCreatedGuests({});},[hotelId]);
 const visibleGroups=groups.data?.data??[];
 const pageConfirmed=visibleGroups.filter(g=>g.status==='confirmed').length;
 const pageInHouse=visibleGroups.filter(g=>['partially_checked_in','fully_checked_in','partially_checked_out'].includes(g.status)).length;
 const pageDeparted=visibleGroups.filter(g=>g.status==='checked_out').length;
 const pageAttention=visibleGroups.filter(g=>g.status==='partially_checked_in'||g.status==='partially_checked_out').length;
 const stepOneValid=name.trim().length>=2&&validLiveStay({
  roomTypeId:rooms[0].roomTypeId||'1',checkIn,checkOut
 })&&checkIn>=hotelToday()&&(!selectedAllotment||(
  checkIn===selectedAllotment.checkIn&&checkOut===selectedAllotment.checkOut));
 const roomEntriesValid=rooms.length>=2&&rooms.every(room=>
  Number(room.guestId)>0&&Number(room.roomTypeId)>0&&Number(room.ratePlanId)>0&&
  rates.data?.data.some(rate=>rate.active&&rate.id===room.ratePlanId&&
   rate.roomTypeId===room.roomTypeId));
 const datesValid=validLiveStay({roomTypeId:rooms[0].roomTypeId||'1',checkIn,checkOut})
  &&checkIn>=hotelToday();
 const ready=canBook&&name.trim().length>=2&&datesValid&&rooms.length>=2&&
  rooms.every(room=>Number(room.guestId)>0&&Number(room.roomTypeId)>0
   &&Number(room.ratePlanId)>0
   &&rates.data?.data.some(rate=>rate.active&&rate.id===room.ratePlanId&&rate.roomTypeId===room.roomTypeId))
  &&(!selectedAllotment||(rooms.length===selectedAllotment.quantity
   &&checkIn===selectedAllotment.checkIn&&checkOut===selectedAllotment.checkOut
   &&rooms.every(room=>room.roomTypeId===selectedAllotment.roomTypeId)));
 const locked=!!pending||busy||!!result;
 const selectedRates=rooms.map(room=>rates.data?.data.find(item=>item.id===room.ratePlanId&&item.active));
 const allPhp=selectedRates.every(rate=>rate?.currency==='PHP');
 const estimate=allPhp?selectedRates.reduce((sum,rate)=>sum+(rate?.nightlyMinor??0),0)
  *Math.max(0,(Date.parse(checkOut+'T00:00:00Z')-Date.parse(checkIn+'T00:00:00Z'))/86400000):null;
 const send=async(payload:GroupBookingInput,submittedHotel:string)=>{
  if(sending.current)return;
  sending.current=true;setBusy(true);setError(null);
  try{
   const group=await createGroupBooking(payload);
   if(readSession().hotelId!==submittedHotel)return;
   setPending(null);setResult(group);
   void client.invalidateQueries({queryKey:['live','group-reservations',submittedHotel]});
   void client.invalidateQueries({queryKey:['live','reservation-records',submittedHotel]});
   void client.invalidateQueries({queryKey:['live','availability',submittedHotel]});
   void client.invalidateQueries({queryKey:['live','room-calendar',submittedHotel]});
  }catch(err){
   if(readSession().hotelId===submittedHotel)
    setError(err instanceof Error?err.message:'Unable to confirm the group booking.');
  }finally{sending.current=false;setBusy(false);}
 };
 const confirm=()=>{
  if(!ready||locked||!hotelId)return;
  const payload:GroupBookingInput={
   idempotencyKey:crypto.randomUUID(),name:name.trim(),
   ...(selectedAllotment?{allotmentId:Number(selectedAllotment.id)}:{}),
   ...(contact.trim()?{contactName:contact.trim()}:{}),
   checkIn,checkOut,
   rooms:rooms.map(room=>({guestId:Number(room.guestId),
    roomTypeId:Number(room.roomTypeId),ratePlanId:Number(room.ratePlanId)})),
  };
  setPending({hotelId,payload});
  void send(payload,hotelId);
 };
 if(search.group)return <GroupDetails id={search.group} billingOpen={search.tab==='billing'} originHotel={search.hotel}/>;
 return <>
  <div className="gb-page">
   <div className="gb-page-header">
    <div><span className="gb-eyebrow">FRONT DESK · GROUP STAYS</span>
     <h2>Group Bookings</h2>
     <p>Manage multi-room stays, temporary room holds, and group billing in one workspace.</p>
    </div>
    {canBook&&view!=='new'&&<button className="btn-primary" type="button" disabled={!!pending||busy}
     onClick={()=>{setView('new');setSelectedAllotment(null);}}>
     <Plus size={17}/> New group booking</button>}
   </div>
   {pending&&view!=='new'&&<div className="gb-pending-notice" role="alert">
    A group booking submission still needs confirmation.
    <button className="btn-inline" type="button" onClick={()=>setView('new')}>Return to booking</button>
   </div>}
   <div className="gb-tabs" role="group" aria-label="Group booking workspace">
    <button type="button" disabled={!!pending||busy} aria-pressed={view==='groups'} className={view==='groups'?'active':''}
     onClick={()=>{setView('groups');}}><Layers3 size={16}/> Group bookings</button>
    <button type="button" disabled={!!pending||busy} aria-pressed={view==='holds'} className={view==='holds'?'active':''}
     onClick={()=>{setView('holds');}}><Clock3 size={16}/> Temporary holds</button>
    {canBook&&<button type="button" aria-pressed={view==='new'} className={view==='new'?'active':''}
     onClick={()=>{setView('new');}}><Plus size={16}/> Create booking</button>}
   </div>
   {view==='holds'&&hotelId&&<GroupAllotmentsPanel hotelId={hotelId} onConvert={hold=>{
    setSelectedAllotment(hold);setView('new');setName(hold.name);
    setCheckIn(hold.checkIn);setCheckOut(hold.checkOut);
    setRooms(Array.from({length:hold.quantity},()=>({
     guestId:'',roomTypeId:hold.roomTypeId,ratePlanId:'',
    })));setPending(null);setResult(null);setError(null);
   }}/>}
  {view==='new'&&canBook?<Panel title={selectedAllotment?'Convert hold to booking':'Create a group booking'}>
   {result?<div role="status">
    <h3>Group reservation confirmed</h3>
    <p>{result.reference} · {result.roomCount} rooms were created.</p>
    <button className="btn-primary" onClick={()=>void navigate({to:'/group-reservations',search:{group:result.id,hotel:hotelId??undefined}})}>
     View group and assign rooms <ArrowRight size={16}/></button>
   </div>:<>
    <nav className="gb-wizard-nav" aria-label="Create group booking steps">
     <button type="button" aria-current={formStep===1?'step':undefined}
      className={formStep===1?'active':''} disabled={locked} onClick={()=>setFormStep(1)}>
      <span>1</span> Group & dates</button>
     <button type="button" aria-current={formStep===2?'step':undefined}
      className={formStep===2?'active':''} disabled={locked||!stepOneValid} onClick={()=>setFormStep(2)}>
      <span>2</span> Rooms & guests</button>
     <button type="button" aria-current={formStep===3?'step':undefined}
      className={formStep===3?'active':''} disabled={locked||!stepOneValid||!roomEntriesValid}
      onClick={()=>setFormStep(3)}><span>3</span> Review</button>
    </nav>
    {formStep===1&&<section className="gb-wizard-step" aria-label="Group stay details">
    <div className="gb-form-step"><span>1</span><div><strong>Group and stay details</strong>
     <small>Rooms are reserved together. Physical room assignment and check-in happen afterward.</small></div></div>
    <fieldset disabled={locked} className="rb-fieldset">
     <div className="wizard-fields">
      <div><label className="wizard-label" htmlFor="group-name">Group or company name</label>
       <input id="group-name" className="wizard-input" maxLength={120} value={name}
        onChange={e=>setName(e.target.value)} placeholder="e.g. Santos family" required/></div>
      <div><label className="wizard-label" htmlFor="group-contact">Contact person (optional)</label>
       <input id="group-contact" className="wizard-input" maxLength={120} value={contact}
        onChange={e=>setContact(e.target.value)}/></div>
     </div>
     <div className="wizard-fields">
      <div><label className="wizard-label" htmlFor="group-arrival">Arrival date</label>
       <input id="group-arrival" className="wizard-input" type="date" min={hotelToday()}
        value={checkIn} onChange={e=>{setCheckIn(e.target.value);
         if(checkOut<=e.target.value)setCheckOut(addDays(e.target.value,1));}}/></div>
      <div><label className="wizard-label" htmlFor="group-departure">Departure date</label>
       <input id="group-departure" className="wizard-input" type="date"
        min={addDays(checkIn,1)} max={addDays(checkIn,31)}
        value={checkOut} onChange={e=>setCheckOut(e.target.value)}/></div>
     </div>
    </fieldset>
    <div className="gb-wizard-actions">
     <button type="button" className="btn-primary" disabled={!stepOneValid||locked}
      onClick={()=>setFormStep(2)}>Next: rooms and guests <ArrowRight size={16}/></button>
    </div></section>}
    {formStep===2&&<section className="gb-wizard-step" aria-label="Rooms and registered guests">
     <div className="gb-form-step"><span>2</span><div><strong>Rooms and registered guests</strong>
      <small>Select a registered guest, room category and rate for each room.</small></div></div>
    <fieldset disabled={locked} className="rb-fieldset">
     <QueryFeedback loading={types.isPending||rates.isPending}
      error={types.error??rates.error}/>
     {rooms.map((room,index)=><div key={index} className="rb-section gb-room-entry">
      <div className="rb-section-heading"><div className="gb-room-title"><BedDouble size={18}/>
       <h4>Room {index+1}</h4><span>Guest and rate details</span></div>
       {rooms.length>2&&<button type="button" className="btn-inline"
        onClick={()=>setRooms(old=>old.filter((_,i)=>i!==index))}>
        <Trash2 size={14}/> Remove</button>}</div>
      <div className="wizard-fields">
       <RoomGuestField index={index} value={room.guestId} disabled={locked}
        onChange={guestId=>update(index,'guestId',guestId)}
        onAddGuest={()=>setGuestDialogRoom(index)} canAddGuest={canCreateGuest}
        createdGuest={createdGuests[room.guestId]}/>
       <div><label className="wizard-label" htmlFor={'group-type-'+index}>Room type</label>
        <select id={'group-type-'+index} className="wizard-input" required
         value={room.roomTypeId} onChange={e=>update(index,'roomTypeId',e.target.value)}>
         <option value="">Choose a room type</option>
         {(types.data?.data??[]).map(type=><option key={type.id} value={type.id}>{type.name}</option>)}
        </select></div>
       <div><label className="wizard-label" htmlFor={'group-rate-'+index}>Nightly rate</label>
        <select id={'group-rate-'+index} className="wizard-input" required
         value={room.ratePlanId} onChange={e=>update(index,'ratePlanId',e.target.value)}>
         <option value="">Choose a rate</option>
         {(rates.data?.data??[]).filter(rate=>rate.active&&rate.roomTypeId===room.roomTypeId)
          .map(rate=><option key={rate.id} value={rate.id}>{rate.name} · {rate.currency==='PHP'?
           money(rate.nightlyMinor,'PHP'):rate.currency+' '+rate.nightlyMinor+' minor units'}/night</option>)}
        </select></div>
      </div>
     </div>)}
     <button type="button" className="btn-inline" disabled={rooms.length>=10}
      onClick={()=>setRooms(old=>[...old,blank()])}><Plus size={16}/> Add another room</button>
     <p className="desk-muted">{canCreateGuest
      ?'Search for an existing guest first, or use Add guest in the room card to register someone without leaving this booking.'
      :'Search for an existing guest. Ask a hotel administrator to register a missing guest.'}</p>
    </fieldset>
    <div className="gb-wizard-actions">
     <button type="button" className="btn-inline" disabled={locked} onClick={()=>setFormStep(1)}>
      <ChevronLeft size={15}/> Back</button>
     <button type="button" className="btn-primary" disabled={!stepOneValid||!roomEntriesValid||locked}
      onClick={()=>setFormStep(3)}>Review group booking <ArrowRight size={16}/></button>
    </div></section>}
    {formStep===3&&<section className="gb-wizard-step" aria-label="Review group booking">
    <div className="rb-review gb-booking-review">
     <div className="gb-form-step"><span>3</span><div><strong>Review and confirm</strong>
      <small>Check the stay summary before creating the linked bookings.</small></div></div>
     {selectedAllotment&&<p>Converting hold {selectedAllotment.reference}. Dates, room type and quantity must match the existing hold.</p>}
     <p><strong>{name.trim()}</strong>{contact.trim()?' · Contact: '+contact.trim():''}</p>
     <p>{rooms.length} rooms · {readableDate(checkIn)} – {readableDate(checkOut)}</p>
     <div className="gb-wizard-review-rooms">
      {rooms.map((room,index)=><div key={index}>
       <strong>Room {index+1}</strong>
       <span>{createdGuests[room.guestId]
        ?createdGuests[room.guestId].firstName+' '+createdGuests[room.guestId].lastName
        :'Guest selected · '+room.guestId}</span>
       <span>{types.data?.data.find(type=>type.id===room.roomTypeId)?.name??'Room type'} ·
        {rates.data?.data.find(rate=>rate.id===room.ratePlanId)?.name??'Rate not selected'}</span>
      </div>)}
     </div>
     <p><strong>Estimated room subtotal: {estimate===null?'Mixed currencies — review individual rates':money(estimate,'PHP')}</strong></p>
     <p className="desk-muted">Estimated room charges only. Taxes, service fees, discounts, deposits, and payments are separate. Inventory is verified again when you confirm.</p>
     {error&&<p role="alert" className="wizard-error">{error}</p>}
     {pending?<button className="btn-primary" type="button" disabled={busy}
       onClick={()=>void send(pending.payload,pending.hotelId)}>
       <RefreshCw size={16}/> {busy?'Checking booking…':'Retry same request safely'}</button>:
      <button className="btn-primary" type="button" disabled={!ready||busy}
       onClick={confirm}>{busy?'Saving…':'Confirm all room bookings'} <ArrowRight size={16}/></button>}
    </div>
    <div className="gb-wizard-actions">
     <button type="button" className="btn-inline" disabled={locked} onClick={()=>setFormStep(2)}>
      <ChevronLeft size={15}/> Back to rooms</button>
    </div></section>}
   </>}
  </Panel>:view==='groups'?<section className="gb-groups-workspace" aria-label="Group booking dashboard">
   <div className="gb-summary-grid">
    <div><small>Total matching groups</small><strong>{groups.data?.meta.total??'—'}</strong>
     <span>All matching records across pages</span></div>
    <div><small>Confirmed</small><strong>{groups.isError?'—':pageConfirmed}</strong>
     <span>Groups on this page</span></div>
    <div><small>In house / partially arrived</small><strong>{groups.isError?'—':pageInHouse}</strong>
     <span>Groups on this page</span></div>
    <div><small>Checked out</small><strong>{groups.isError?'—':pageDeparted}</strong>
     <span>Groups on this page</span></div>
   </div>
   {pageAttention>0&&<div className="gb-attention-note" role="status">
    <AlertTriangle size={17}/> {pageAttention} partially arrived/departed group{pageAttention===1?'':'s'} on this page require individual room follow-up.
   </div>}
   <div className="gb-groups-table-panel">
    <div className="gb-table-head"><div><h3><Layers3 size={18}/> Group reservations</h3>
     <p>Search the entire hotel's group records. Open a group for rooms, guests and billing.</p></div>
     <button type="button" className="btn-inline" disabled={groups.isFetching}
      onClick={()=>void groups.refetch()}><RefreshCw size={15}/> Refresh</button></div>
    <div className="gb-table-filters">
     <label className="gb-table-search"><Search size={16}/><input value={searchText}
      onChange={e=>setSearchText(e.target.value)}
      aria-label="Search all group reservations"
      placeholder="Search group name, contact or reference"/>
      {searchText&&<button type="button" aria-label="Clear group search" onClick={()=>setSearchText('')}><X size={15}/></button>}
     </label>
     <label className="gb-status-filter"><Filter size={15}/>
      <select aria-label="Filter group lifecycle status" value={groupFilter}
       onChange={e=>{setGroupFilter(e.target.value as GroupStatusFilter);setPage(1);}}>
       <option value="all">All statuses</option>
       <option value="confirmed">Confirmed</option>
       <option value="partially_checked_in">Partially checked in</option>
       <option value="fully_checked_in">Fully checked in</option>
       <option value="partially_checked_out">Partially checked out</option>
       <option value="checked_out">Checked out</option>
       <option value="cancelled">Cancelled</option>
      </select></label>
    </div>
    <p className="desk-muted" role="status">{groups.isFetching||appliedSearch!==searchText.trim()
     ?'Updating group list…'
     :groups.data?groups.data.meta.total+' matching group reservations':'No verified group totals available'}
     {pageAttention>0?' · '+pageAttention+' partially complete on this page':''}</p>
    <QueryFeedback loading={groups.isPending} error={groups.error} onRetry={()=>void groups.refetch()}/>
    {groups.data&&visibleGroups.length===0&&<div className="gb-empty">
     <Layers3 size={25}/><strong>{appliedSearch||groupFilter!=='all'?'No matching group bookings':'No group bookings yet'}</strong>
     <p>{appliedSearch||groupFilter!=='all'?'Change or clear filters to see other group reservations.':'Start a group booking to link multiple room reservations under one reference.'}</p>
     {(appliedSearch||groupFilter!=='all')&&<button className="btn-inline" type="button" onClick={()=>{
      setSearchText('');setAppliedSearch('');setGroupFilter('all');setPage(1);
     }}>Clear filters</button>}
    </div>}
    {visibleGroups.length>0&&<div className="gb-table-scroll"><table className="gb-table">
     <thead><tr><th>Group / Contact</th><th>Stay dates</th><th>Rooms</th>
      <th>Group status</th><th>Progress</th><th>Actions</th></tr></thead>
     <tbody>{visibleGroups.map(group=><tr key={group.id}>
      <td><Link className="gb-group-name" to="/group-reservations"
       search={{group:group.id,hotel:hotelId??undefined}}>{group.name}</Link>
       <small>{group.reference}</small><small>{group.contactName??'Contact not recorded'}</small></td>
      <td>{group.checkIn&&group.checkOut?
       <><strong>{readableDate(group.checkIn)}</strong><small>to {readableDate(group.checkOut)}</small></>
       :'Dates unavailable'}</td>
      <td><strong>{group.roomCount} rooms</strong></td>
      <td><span className={'gb-lifecycle-badge gb-lifecycle-'+group.status}>
       {groupStatusLabel(group.status)}</span></td>
      <td><span>{group.statusCounts.checkedIn} in house</span>
       <small>{group.statusCounts.checkedOut} checked out · {group.statusCounts.cancelled} cancelled</small></td>
      <td><div className="gb-list-actions">
       <Link className="btn-inline" to="/group-reservations"
        search={{group:group.id,hotel:hotelId??undefined}}>Manage <ArrowRight size={14}/></Link>
       <Link to="/room-calendar" search={{date:group.checkIn??undefined,end:group.checkOut??undefined,
         group:group.id,hotel:hotelId??undefined}}>Calendar</Link>
      </div></td>
     </tr>)}</tbody>
    </table></div>}
    {groups.data&&groups.data.meta.totalPages>1&&<div className="gb-list-pagination">
     <span>Page {page} of {groups.data.meta.totalPages} · {groups.data.meta.total} groups</span>
     <div><button type="button" className="btn-inline" disabled={page===1}
      onClick={()=>setPage(v=>Math.max(1,v-1))}><ChevronLeft size={14}/> Previous</button>
      <button type="button" className="btn-inline" disabled={page>=groups.data.meta.totalPages}
       onClick={()=>setPage(v=>v+1)}>Next <ChevronRight size={14}/></button></div>
    </div>}
   </div>
  </section>:null}
   <p className="gb-bottom-note"><CalendarDays size={14}/> Room numbers are assigned after a group booking is confirmed.</p>
  </div>
  {guestDialogRoom!==null&&canCreateGuest&&hotelId&&<QuickGuestDialog key={hotelId+'-'+guestDialogRoom}
   onClose={()=>setGuestDialogRoom(null)}
   onCreated={guest=>{
    if(guest.hotelId!==hotelId)return;
    setCreatedGuests(previous=>({...previous,[guest.id]:guest}));
    setRooms(previous=>previous.map((row,index)=>index===guestDialogRoom
     ?{...row,guestId:guest.id}:row));
    setGuestDialogRoom(null);
    setError(null);
   }}/>}
 </>;
}
