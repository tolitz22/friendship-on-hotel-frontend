import {useEffect,useRef,useState} from 'react';
import {Link} from '@tanstack/react-router';
import type {FormEvent} from 'react';
import {useQueryClient} from '@tanstack/react-query';
import {AlertTriangle,CheckCircle2} from 'lucide-react';
import {useGuests} from '../api/queries';
import {useLiveAvailability,useLiveRoomQuote,useLiveRatePlans,useLiveRoomTypes,validLiveStay} from '../api/liveReservations';
import {buildBookingPayload,createLiveBooking,makeBookingSubmission} from '../api/liveBooking';
import type {BookingSelection,BookingSubmission,ConfirmedBooking} from '../api/liveBooking';
import {readSession} from '../api/session';
import {ApiError} from '../api/http';
import {useHotelAuth} from '../components/AuthProvider';
import {Panel} from '../components/ui';
import {QueryFeedback} from '../components/QueryFeedback';
import {addDays,hotelToday} from '../features/reservations/calendarDate';

const initialSelection=():BookingSelection=>{
 const checkIn=addDays(hotelToday(),1);
 return {guestId:'',roomTypeId:'',ratePlanId:'',checkIn,checkOut:addDays(checkIn,1)};
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
 const admin=!!hotelId&&!!user?.hotels.some(h=>h.id===hotelId&&h.role==='admin');
 const [selection,setSelection]=useState<BookingSelection>(initialSelection);
 const [checked,setChecked]=useState<BookingSelection|null>(null);
 const [pending,setPending]=useState<BookingSubmission|null>(null);
 const [result,setResult]=useState<ConfirmedBooking|null>(null);
 const [error,setError]=useState<Error|null>(null);
 const [busy,setBusy]=useState(false);
 const inFlight=useRef(false);
 const client=useQueryClient();
 const guests=useGuests({perPage:100});
 const types=useLiveRoomTypes();
 const rates=useLiveRatePlans();
 const availability=useLiveAvailability(checked);
 const quote=useLiveRoomQuote(checked,checked?.ratePlanId??'');

 useEffect(()=>{
  setSelection(initialSelection());setChecked(null);setPending(null);setResult(null);setError(null);
 },[hotelId]);
 const activeRates=(rates.data?.data??[]).filter(rate=>rate.roomTypeId===selection.roomTypeId&&rate.active);
 const guest=guests.data?.data.find(item=>item.id===selection.guestId);
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
   setResult(confirmed);setPending(null);
   // The backend has already confirmed this booking. Cache refresh failures
   // must not turn a successful submission into an ambiguous retry.
   void Promise.all([
    client.invalidateQueries({queryKey:['live','reservation-records',submission.hotelId]}),
    client.invalidateQueries({queryKey:['live','availability',submission.hotelId]}),
    client.invalidateQueries({queryKey:['live','front-desk','manifest',submission.hotelId]}),
    client.invalidateQueries({queryKey:['live','readiness-dashboard',submission.hotelId]}),
   ]).catch(()=>{});
  }catch(cause){
   setError(cause instanceof Error?cause:new Error('The booking result could not be confirmed.'));
   // Keep pending submission intact. Network/5xx may have committed on server.
  }finally{inFlight.current=false;setBusy(false);}
 }
 const submit=()=>{
  if(!ready||!hotelId)return;
  const submission=makeBookingSubmission(hotelId,selection,crypto.randomUUID());
  try{buildBookingPayload(submission);}catch(cause){
   setError(cause instanceof Error?cause:new Error('Invalid booking inputs.'));return;
  }
  setPending(submission);
  void send(submission);
 };
 const retry=()=>{if(pending&&!busy)void send(pending);};
 const reset=()=>{
  if(busy)return;
  setPending(null);setResult(null);setError(null);setChecked(null);
  setSelection(initialSelection());
 };
 return <Panel title="New reservation">
  <p className="help-copy">Complete the guest and stay details, check availability, then confirm. The reservation will be saved immediately when you select Confirm.</p>
  <p className="help-copy">Payment, guest identity verification, physical room assignment and final taxes are separate steps.</p>
  {!admin&&<p role="status">Only an administrator of the selected hotel can submit reservations. Laravel enforces permissions independently.</p>}
  {admin&&<>
   <QueryFeedback loading={guests.isPending||types.isPending||rates.isPending}
    error={guests.error??types.error??rates.error}/>
   {guests.isSuccess&&types.isSuccess&&rates.isSuccess&&<form onSubmit={check}>
    <fieldset disabled={locked} style={{border:0,padding:0,margin:0,width:'100%'}}>
     <div className="wizard-fields">
      <div><label htmlFor="book-guest" className="wizard-label">Existing guest</label>
       <select id="book-guest" className="wizard-input" required value={selection.guestId}
        onChange={e=>edit('guestId',e.target.value)}>
        <option value="">Select guest</option>
        {guests.data.data.map(item=><option key={item.id} value={item.id}>{item.firstName} {item.lastName}</option>)}
       </select>
       <small>Showing up to 100 existing guests. <Link to="/guests" className="text-link">Find or add a guest</Link> if the guest isn't listed.</small>
      </div>
      <div><label htmlFor="book-roomtype" className="wizard-label">Room type</label>
       <select id="book-roomtype" className="wizard-input" required value={selection.roomTypeId}
        onChange={e=>edit('roomTypeId',e.target.value)}>
        <option value="">Select room type</option>
        {types.data.data.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}
       </select>
      </div>
     </div>
     <div className="wizard-fields">
      <div><label htmlFor="book-checkin" className="wizard-label">Check-in</label>
       <input id="book-checkin" type="date" className="wizard-input" required
        min={hotelToday()} value={selection.checkIn} onChange={e=>edit('checkIn',e.target.value)}/></div>
      <div><label htmlFor="book-checkout" className="wizard-label">Check-out</label>
       <input id="book-checkout" type="date" className="wizard-input" required
        min={addDays(hotelToday(),1)} value={selection.checkOut}
        onChange={e=>edit('checkOut',e.target.value)}/></div>
     </div>
     <label htmlFor="book-rate" className="wizard-label">Active nightly rate plan</label>
     <select id="book-rate" className="wizard-input" required value={selection.ratePlanId}
      onChange={e=>edit('ratePlanId',e.target.value)}>
      <option value="">Select a rate plan</option>
      {activeRates.map(item=><option key={item.id} value={item.id}>
       {item.name} · {displayMoney(item.nightlyMinor,item.currency)} per night
      </option>)}
     </select>
     {!valid&&<p className="wizard-error">Select a guest, room type, active rate, and valid stay of 1–31 nights beginning today or later.</p>}
     <button className="btn-primary" type="submit" disabled={!valid||busy}>Step 2 · Check availability and room subtotal</button>
    </fieldset>
   </form>}
   {checked&&<div aria-live="polite">
    <h4>Step 2 · Verify stay before booking</h4>
    <p className="help-copy">{guest?.firstName} {guest?.lastName} · {selection.checkIn} to {selection.checkOut} · {rate?.name??'Rate pending'}</p>
    <QueryFeedback loading={availability.isPending||quote.isPending}
     error={availability.error??quote.error}/>
    {availability.isSuccess&&<p>Inventory: <strong>{availability.data.data.canBook?'Currently bookable':'No remaining capacity on every night'}</strong>. No rooms held; housekeeping readiness unverified.</p>}
    {quote.isSuccess&&<p>Room subtotal: <strong>{displayMoney(quote.data.data.roomSubtotalMinor,quote.data.data.currency)}</strong>. Taxes, fees and deposits are not calculated; this is not the final payable total.</p>}
    {samePreview&&!pending&&!result&&<button type="button" className="btn-primary"
     disabled={!ready} onClick={submit}>
      {busy?'Saving reservation…':'Step 3 · Confirm and create booking'}
    </button>}
    <p className="desk-preview-note"><AlertTriangle size={16}/> Final inventory and rate validation occurs again in Laravel during the booking transaction. The result may differ from this non-binding preview.</p>
   </div>}
   {error&&<p role="alert" className="auth-error">
    {error instanceof ApiError&&error.status===409
     ?'Conflict: inventory, price or request key may have changed. '+error.message
     :error instanceof ApiError&&error.status===403
      ?'Your account is not authorized to create this booking.'
      :error.message}
   </p>}
   {pending&&<div className="wizard-callout" role="status">
    <AlertTriangle size={18}/>
    <div>
     <strong>Booking result not confirmed by this browser.</strong>
     <p>Do not submit a new booking yet. Retrying uses the identical hotel, guest, dates, rate plan and request key. If the server already saved it, Laravel returns the original reservation.</p>
     <button type="button" className="btn-primary" disabled={busy} onClick={retry}>
      {busy?'Submitting…':'Retry the same request safely'}
     </button>
     <button type="button" className="btn-inline" disabled={busy} onClick={reset}>
      Abandon this local request (verify hotel records first)
     </button>
    </div>
   </div>}
   {result&&<div className="wizard-finished" role="status">
    <CheckCircle2 size={28}/>
    <h4>Reservation confirmed by Laravel</h4>
    <p>Reference: <strong>{result.reference}</strong> · ID: {result.id} · Status: {result.status}</p>
    <p>{result.idempotentReplay?'This was a safe replay of the original successful booking.':'This request created a confirmed reservation.'} Physical room assignment, guest identity and payment remain separate.</p>
    <div className="task-next-step">
     <p><strong>Next:</strong> Open the reservation in the list below to assign a physical room and handle check-in when eligible.</p>
     <Link to="/reservations" search={{booking:result.id}}>
      Open this booking and assign a room
     </Link>
     <Link to="/front-desk">Front desk queues</Link>
    </div>
    <button type="button" className="btn-inline" onClick={reset}>Create another booking</button>
   </div>}
  </>}
 </Panel>;
}
