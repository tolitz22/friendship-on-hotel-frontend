import {useEffect,useRef,useState} from 'react';
import {Link,useSearch} from '@tanstack/react-router';
import type {FormEvent} from 'react';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {AlertTriangle,CheckCircle2,UserPlus,CalendarDays,BedDouble,ArrowRight,ArrowLeft,ShieldCheck,RefreshCw} from 'lucide-react';
import {QuickGuestDialog} from '../components/QuickGuestDialog';
import type {Guest} from '../api/types';
import {useGuests} from '../api/queries';
import {getLiveRooms} from '../api/liveCatalog';
import {useSelectedGuest} from '../api/liveSelectedGuest';
import {useLiveAvailability,useLiveRoomQuote,useLiveRatePlans,useLiveRoomTypes,validLiveStay} from '../api/liveReservations';
import {buildBookingPayload,createLiveBooking,makeBookingSubmission} from '../api/liveBooking';
import type {BookingSelection,BookingSubmission,ConfirmedBooking} from '../api/liveBooking';
import {readSession} from '../api/session';
import {ApiError} from '../api/http';
import {useHotelAuth} from '../components/AuthProvider';
import {QueryFeedback} from '../components/QueryFeedback';
import {addDays,hotelToday} from '../features/reservations/calendarDate';

const initialSelection=(guestId='',requestedDay?:string,requestedOut?:string):BookingSelection=>{
 const checkIn=requestedDay&&requestedDay>=hotelToday()?requestedDay:addDays(hotelToday(),1);
 const checkOut=requestedOut&&requestedOut>checkIn&&requestedOut<=addDays(checkIn,31)?requestedOut:addDays(checkIn,1);
 return {guestId,roomTypeId:'',ratePlanId:'',checkIn,checkOut};
};

const displayMoney=(minor:number,currency:string)=>currency==='PHP'
 ?new Intl.NumberFormat('en-PH',{style:'currency',currency:'PHP'}).format(minor/100)
 :minor.toLocaleString()+' '+currency+' minor units';

/**
 * Submission is explicitly staff-admin only. A pending request is immutable:
 * uncertain failures must be retried with identical body and idempotency key.
 */
export function LiveBookingForm(){
 const {user,hotelId}=useHotelAuth();
 const {guest:requestedGuest,room:requestedRoomId,roomNumber:requestedRoomNumber,checkIn:requestedDay,checkOut:requestedOut}=useSearch({from:'/reservations'});
 const admin=!!hotelId&&!!user?.hotels.some(h=>h.id===hotelId&&h.role==='admin');
 const [selection,setSelection]=useState<BookingSelection>(()=>initialSelection(requestedGuest,requestedDay,requestedOut));
 const [checked,setChecked]=useState<BookingSelection|null>(null);
 const [pending,setPending]=useState<BookingSubmission|null>(null);
 const [result,setResult]=useState<ConfirmedBooking|null>(null);
 const [error,setError]=useState<Error|null>(null);
 const [busy,setBusy]=useState(false);
 const [showQuickGuest,setShowQuickGuest]=useState(false);
 const [createdGuest,setCreatedGuest]=useState<Guest|null>(null);
 const inFlight=useRef(false);
 const reviewHeadingRef=useRef<HTMLHeadingElement>(null);
 const completeHeadingRef=useRef<HTMLHeadingElement>(null);
 const pendingByHotel=useRef(new Map<string,BookingSubmission>());
 const client=useQueryClient();
 const guests=useGuests({perPage:100});
 const linkedGuest=useSelectedGuest(requestedGuest??null);
 const types=useLiveRoomTypes();
 const rates=useLiveRatePlans();
 // Treat URL hints as untrusted. Verify the physical room and property against
 // Laravel before prefilling the room type or proposing an assignment.
 const selectedRoomQuery=useQuery({
  queryKey:['live','calendar-booking-room',hotelId,requestedRoomId,requestedRoomNumber],
  enabled:!!hotelId&&!!requestedRoomId&&!!requestedRoomNumber,
  retry:false,
  queryFn:async()=>{
   const response=await getLiveRooms({search:requestedRoomNumber!,page:1,perPage:100});
   const match=response.data.find(room=>room.id===requestedRoomId
    &&room.number===requestedRoomNumber&&room.hotelId===hotelId);
   if(!match)throw new Error('Selected room no longer matches this hotel. Reopen it from the room calendar.');
   return match;
  },
 });
 const suggestedRoom=selectedRoomQuery.data??null;
 const availability=useLiveAvailability(checked);
 const quote=useLiveRoomQuote(checked,checked?.ratePlanId??'');

 useEffect(()=>{
  setSelection(initialSelection(requestedGuest,requestedDay,requestedOut));setChecked(null);
  // Retain an uncertain booking request when switching away and back to its
  // hotel. Replaying the original key is safer than generating a duplicate.
  setPending(hotelId?pendingByHotel.current.get(hotelId)??null:null);
  setResult(null);setError(null);
 },[hotelId,requestedGuest,requestedDay,requestedOut,requestedRoomId]);
 useEffect(()=>{
  if(!suggestedRoom||pending||result||busy)return;
  setSelection(previous=>previous.roomTypeId===suggestedRoom.roomTypeId?previous:{
   ...previous,roomTypeId:suggestedRoom.roomTypeId,ratePlanId:'',
  });
  setChecked(null);
 },[suggestedRoom?.id,hotelId]);
 const activeRates=(rates.data?.data??[]).filter(rate=>rate.roomTypeId===selection.roomTypeId&&rate.active);
 useEffect(()=>{
  if(pending||result||busy||!selection.roomTypeId||selection.ratePlanId)return;
  const available=(rates.data?.data??[]).filter(item=>item.roomTypeId===selection.roomTypeId&&item.active);
  if(available.length===1){
   setSelection(previous=>previous.roomTypeId===selection.roomTypeId&&!previous.ratePlanId
    ?{...previous,ratePlanId:available[0].id}:previous);
  }
 },[selection.roomTypeId,selection.ratePlanId,rates.data,hotelId,pending,result,busy]);
 const usingLinkedGuest=!!requestedGuest&&selection.guestId===requestedGuest;
 const guest=guests.data?.data.find(item=>item.id===selection.guestId)
  ??(createdGuest?.id===selection.guestId?createdGuest:undefined)
  ??(linkedGuest.isSuccess&&usingLinkedGuest?linkedGuest.data:undefined);
 const selectedIsOutsidePage=!!guest&&!guests.data?.data.some(item=>item.id===guest.id);
 const rate=activeRates.find(item=>item.id===selection.ratePlanId);
 const valid=!!guest&&!!rate&&validLiveStay(selection)&&selection.checkIn>=hotelToday();
 const samePreview=checked!==null&&checked.guestId===selection.guestId
  &&checked.roomTypeId===selection.roomTypeId&&checked.ratePlanId===selection.ratePlanId
  &&checked.checkIn===selection.checkIn&&checked.checkOut===selection.checkOut;
 const ready=admin&&valid&&samePreview
  &&availability.isSuccess&&availability.data.data.canBook
  &&quote.isSuccess&&quote.data.data.roomTypeId===selection.roomTypeId
  &&quote.data.data.ratePlanId===selection.ratePlanId&&!pending&&!result&&!busy;
 const locked=!!pending||!!result||busy;
 const stage=result?'complete':checked&&samePreview?'review':'details';
 useEffect(()=>{
  if(stage==='review')reviewHeadingRef.current?.scrollIntoView({behavior:'smooth',block:'start'});
  if(stage==='complete')completeHeadingRef.current?.scrollIntoView({behavior:'smooth',block:'start'});
 },[stage]);
 const nights=validLiveStay(selection)?Math.round((Date.parse(selection.checkOut+'T00:00:00Z')-Date.parse(selection.checkIn+'T00:00:00Z'))/86400000):0;
 const canReview=valid&&!locked;
 const estimate=rate&&nights>0?rate.nightlyMinor*nights:null;

 const edit=(field:keyof BookingSelection,value:string)=>{
  if(locked)return;
  setSelection(previous=>({...previous,[field]:value,...(field==='roomTypeId'?{ratePlanId:''}:{})}));
  setChecked(null);setError(null);
 };
 const check=(event:FormEvent<HTMLFormElement>)=>{
  event.preventDefault();
  if(!valid||!admin||locked)return;
  setError(null);
  setChecked({...selection});
 };

 async function send(submission:BookingSubmission){
  if(inFlight.current)return;
  inFlight.current=true;setBusy(true);setError(null);
  try{
   const confirmed=await createLiveBooking(submission);
   // A property switch may occur while the network request is in flight.
   // Never show another property's confirmation in the newly selected hotel.
   if(readSession().hotelId!==submission.hotelId)return;
   pendingByHotel.current.delete(submission.hotelId);
   setResult(confirmed);setPending(null);
   // The backend has already confirmed this booking. Cache refresh failures
   // must not turn a successful submission into an ambiguous retry.
   void Promise.all([
    client.invalidateQueries({queryKey:['live','reservation-records',submission.hotelId]}),
    client.invalidateQueries({queryKey:['live','room-calendar',submission.hotelId]}),
    client.invalidateQueries({queryKey:['live','availability',submission.hotelId]}),
    client.invalidateQueries({queryKey:['live','front-desk','manifest',submission.hotelId]}),
    client.invalidateQueries({queryKey:['live','readiness-dashboard',submission.hotelId]}),
   ]).catch(()=>{});
  }catch(cause){
   // A late response from the previous property must not label the current
   // hotel's new booking form as failed.
   if(readSession().hotelId===submission.hotelId){
    setError(cause instanceof Error?cause:new Error('The booking result could not be confirmed.'));
   }
   // Keep the same pending idempotency key for retries within this property.
   // If the property changes, reconcile the old submission in its own hotel.
  }finally{inFlight.current=false;setBusy(false);}
 }
 const submit=()=>{
  if(!ready||!hotelId)return;
  const submission=makeBookingSubmission(hotelId,selection,crypto.randomUUID());
  try{buildBookingPayload(submission);}catch(cause){
   setError(cause instanceof Error?cause:new Error('Invalid booking inputs.'));return;
  }
  pendingByHotel.current.set(hotelId,submission);
  setPending(submission);
  void send(submission);
 };
 const retry=()=>{if(pending&&!busy)void send(pending);};
 const reset=()=>{
  if(busy)return;
  if(hotelId)pendingByHotel.current.delete(hotelId);
  setPending(null);setResult(null);setError(null);setChecked(null);
  setSelection(initialSelection(requestedGuest,requestedDay,requestedOut));
 };
 return <section className="reservation-booking-panel" aria-label="Create reservation">
  <div className="rb-top">
   <div><span className="rb-eyebrow">FRONT DESK · NEW BOOKING</span><h3>New reservation</h3>
    <p>Guest, dates, and rate. Review the details before saving.</p></div>
   <Link className="rb-calendar-link" to="/room-calendar"><CalendarDays size={16}/> Room calendar</Link>
  </div>
  <nav className="rb-steps" aria-label="Booking progress">
   <span className={stage==='details'?'rb-step active':'rb-step done'}><b>1</b> Stay details</span>
   <span className={stage==='review'?'rb-step active':stage==='complete'?'rb-step done':'rb-step'}><b>2</b> Review</span>
   <span className={stage==='complete'?'rb-step active':'rb-step'}><b>3</b> Done</span>
  </nav>
  {requestedRoomId&&<div className="rb-calendar-context" role="status">
   <BedDouble size={18}/><div>
    {selectedRoomQuery.isPending&&<span>Finding your selected room…</span>}
    {selectedRoomQuery.isError&&<span>Selected room could not be verified. Choose a room type below or return to the calendar.</span>}
    {suggestedRoom&&<span><strong>Preferred room {suggestedRoom.number}</strong> · {suggestedRoom.roomTypeName} · {selection.checkIn} to {selection.checkOut}</span>}
    <small>Room preference only. Physical assignment happens after booking.</small>
   </div>
  </div>}
  {!admin&&<p role="status" className="rb-notice">An administrator of this hotel is required to create reservations.</p>}
  {admin&&<>
   <QueryFeedback loading={guests.isPending||types.isPending||rates.isPending||(usingLinkedGuest&&linkedGuest.isPending)}
    error={guests.error??types.error??rates.error??(usingLinkedGuest?linkedGuest.error:null)}
    onRetry={()=>{void guests.refetch();void types.refetch();void rates.refetch();if(usingLinkedGuest)void linkedGuest.refetch();}}/>
   {guests.isSuccess&&types.isSuccess&&rates.isSuccess&&stage==='details'&&<div className="rb-layout">
    <div className="rb-main">
     <form onSubmit={check} id="reservation-booking-form">
      <fieldset disabled={locked} className="rb-fieldset">
       <div className="rb-section">
        <div className="rb-section-heading"><div><span className="rb-section-number">1</span><h4>Guest</h4></div>
         <button type="button" className="rb-add-guest" disabled={locked} onClick={()=>setShowQuickGuest(true)}><UserPlus size={15}/> Add new guest</button></div>
        <label htmlFor="book-guest" className="rb-label">Select a guest</label>
        <select id="book-guest" className="wizard-input" required value={selection.guestId}
         onChange={event=>edit('guestId',event.target.value)}>
         <option value="">Choose a guest…</option>
         {guests.data.data.map(item=><option key={item.id} value={item.id}>{item.firstName} {item.lastName}</option>)}
         {selectedIsOutsidePage&&guest&&<option value={guest.id}>{guest.firstName} {guest.lastName} · Selected guest</option>}
        </select>
        {usingLinkedGuest&&linkedGuest.isError&&<small role="alert">Could not verify this guest. Select another guest.</small>}
        <p className="rb-hint">Don't see the guest? <Link to="/guests">Search guest directory</Link> or add a new one above.</p>
       </div>
       <div className="rb-section">
        <div className="rb-section-heading"><div><span className="rb-section-number">2</span><h4>Stay dates</h4></div>
         {nights>0&&<span className="rb-night-count">{nights} {nights===1?'night':'nights'}</span>}</div>
        <div className="rb-grid">
         <div><label htmlFor="book-checkin" className="rb-label">Check-in</label>
          <input id="book-checkin" type="date" required min={hotelToday()} className="wizard-input"
           value={selection.checkIn} onChange={event=>{
            const incoming=event.target.value;
            if(locked)return;
            setSelection(previous=>({...previous,checkIn:incoming,
             checkOut:incoming&&previous.checkOut<=incoming?addDays(incoming,1):previous.checkOut}));
            setChecked(null);setError(null);
           }}/></div>
         <div><label htmlFor="book-checkout" className="rb-label">Check-out</label>
          <input id="book-checkout" type="date" required min={addDays(selection.checkIn||hotelToday(),1)}
           max={addDays(selection.checkIn||hotelToday(),31)} className="wizard-input"
           value={selection.checkOut} onChange={event=>edit('checkOut',event.target.value)}/></div>
        </div>
       </div>
       <div className="rb-section rb-section-last">
        <div className="rb-section-heading"><div><span className="rb-section-number">3</span><h4>Room & rate</h4></div></div>
        <div className="rb-grid">
         <div><label htmlFor="book-roomtype" className="rb-label">Room type</label>
          <select id="book-roomtype" className="wizard-input" required value={selection.roomTypeId}
           onChange={event=>edit('roomTypeId',event.target.value)}>
           <option value="">Choose room type…</option>
           {types.data.data.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}
          </select></div>
         <div><label htmlFor="book-rate" className="rb-label">Nightly rate</label>
          <select id="book-rate" className="wizard-input" required value={selection.ratePlanId}
           onChange={event=>edit('ratePlanId',event.target.value)}>
           <option value="">Choose a rate…</option>
           {activeRates.map(item=><option key={item.id} value={item.id}>
            {item.name} · {displayMoney(item.nightlyMinor,item.currency)}
           </option>)}
          </select></div>
        </div>
       </div>
      </fieldset>
      {!samePreview&&checked&&<p className="rb-hint" role="status">Details changed. Check availability again to refresh the quote.</p>}
      <div className="rb-form-footer">
       <button className="btn-primary rb-main-action" type="submit" disabled={!canReview}>
        <ShieldCheck size={17}/> Check availability <ArrowRight size={16}/>
       </button>
       <small>Final inventory checks happen again when you confirm.</small>
      </div>
     </form>
    </div>
    <aside className="rb-summary" aria-label="Booking summary">
     <h4>Stay summary</h4>
     <div className="rb-summary-row"><span>Guest</span><strong>{guest?guest.firstName+' '+guest.lastName:'Not selected'}</strong></div>
     <div className="rb-summary-row"><span>Dates</span><strong>{selection.checkIn} – {selection.checkOut}</strong></div>
     <div className="rb-summary-row"><span>Duration</span><strong>{nights||'—'} {nights===1?'night':'nights'}</strong></div>
     <div className="rb-summary-row"><span>Room</span><strong>{suggestedRoom&&suggestedRoom.roomTypeId===selection.roomTypeId?'Preferred '+suggestedRoom.number:types.data.data.find(item=>item.id===selection.roomTypeId)?.name??'Not selected'}</strong></div>
     <div className="rb-summary-total"><small>Estimated room subtotal</small><strong>{estimate!==null&&rate?displayMoney(estimate,rate.currency):'—'}</strong></div>
     <p>Based on the selected nightly rate. Taxes, fees and deposits are not included.</p>
    </aside>
   </div>}
   {checked&&samePreview&&!result&&<section className="rb-review" aria-label="Review and confirm reservation" aria-live="polite">
    <div className="rb-review-heading"><div><span className="rb-eyebrow">STEP 2 OF 3</span><h4 ref={reviewHeadingRef} tabIndex={-1}>Review reservation</h4>
     <p>Confirm the guest and stay before creating the booking.</p></div>
     <span className={'rb-availability '+(availability.isSuccess&&availability.data.data.canBook?'available':'')}>
      {availability.isPending?'Checking…':availability.isSuccess?(availability.data.data.canBook?'Available':'Unavailable'):'Not verified'}
     </span></div>
    <QueryFeedback loading={availability.isPending||quote.isPending} error={availability.error??quote.error}/>
    <div className="rb-review-grid">
     <div><small>Guest</small><strong>{guest?.firstName} {guest?.lastName}</strong></div>
     <div><small>Stay</small><strong>{selection.checkIn} → {selection.checkOut}</strong></div>
     <div><small>Room type</small><strong>{types.data?.data.find(t=>t.id===selection.roomTypeId)?.name??'—'}</strong></div>
     <div><small>Room subtotal</small><strong>{quote.isSuccess?displayMoney(quote.data.data.roomSubtotalMinor,quote.data.data.currency):'Checking…'}</strong></div>
    </div>
    {availability.isSuccess&&!availability.data.data.canBook&&<p className="rb-unavailable" role="alert">No rooms are available for every night of this stay. Change the dates or room type.</p>}
    <div className="rb-review-actions"><button type="button" className="btn-inline" disabled={locked} onClick={()=>setChecked(null)}><ArrowLeft size={15}/> Edit details</button>
     <button type="button" className="btn-primary rb-main-action" disabled={!ready} onClick={submit}>
      {busy?'Creating reservation…':'Confirm reservation'} <ArrowRight size={16}/></button></div>
    <p className="rb-review-footnote"><AlertTriangle size={14}/> Room assignment, identity checks and payments happen separately. The quote is provisional.</p>
   </section>}
   {error&&<div role="alert" className="auth-error rb-booking-error">
    {error instanceof ApiError&&error.status===409?'Availability changed. Review your stay and try again. '+error.message:
     error instanceof ApiError&&error.status===403?'Your account cannot create bookings for this hotel.':error.message}
   </div>}
   {pending&&!result&&<div className="rb-pending" role="status"><AlertTriangle size={20}/><div>
    <strong>Booking confirmation needs verification</strong>
    <p>The server may have saved this booking. Retry the same request instead of creating a duplicate.</p>
    <button type="button" className="btn-primary" disabled={busy} onClick={retry}><RefreshCw size={15}/>{busy?'Checking…':'Retry safely'}</button>
    <button type="button" className="btn-inline" disabled={busy} onClick={reset}>Discard only after checking records</button>
   </div></div>}
   {result&&<section className="rb-complete" role="status">
    <CheckCircle2 size={36}/><span className="rb-eyebrow">BOOKING CREATED</span>
    <h4 ref={completeHeadingRef} tabIndex={-1}>Reservation confirmed</h4><p><strong>{result.reference}</strong> · {result.checkIn} to {result.checkOut}</p>
    <p>Next, assign a physical room and complete the arrival process.</p>
    <div className="rb-complete-actions">
     <Link className="btn-primary" to="/reservations" search={{booking:result.id,...(suggestedRoom&&result.roomTypeId===suggestedRoom.roomTypeId?{room:suggestedRoom.id,roomNumber:suggestedRoom.number}:{})}}>Assign room <ArrowRight size={16}/></Link>
     <button type="button" className="btn-inline" onClick={reset}>New reservation</button>
    </div>
   </section>}
  </>}
  {showQuickGuest&&admin&&<QuickGuestDialog onClose={()=>setShowQuickGuest(false)}
   onCreated={newGuest=>{setShowQuickGuest(false);setCreatedGuest(newGuest);edit('guestId',newGuest.id);}}/>}
 </section>;
}
