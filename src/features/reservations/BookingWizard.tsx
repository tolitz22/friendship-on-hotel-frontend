import {useEffect,useRef,useState} from 'react';
import {useForm,useWatch} from 'react-hook-form';
import {zodResolver} from '@hookform/resolvers/zod';
import {ArrowLeft,ArrowRight,Check,CalendarDays,X,AlertCircle} from 'lucide-react';
import {useGuests,useBookingOptions,useBookingQuote} from '../../api/queries';
import {dataMode} from '../../api';
import {currency,dateLabel} from '../../lib/format';
import {hotelToday,addDays} from './calendarDate';
import {bookingDraftSchema,draftReady,type BookingDraft} from './bookingDraft';
import {QueryFeedback} from '../../components/QueryFeedback';

const steps=['Guest','Stay & room','Review'] as const;
const initial=()=>{
 const checkIn=addDays(hotelToday(),1);
 return {guestId:'',roomTypeId:'',checkIn,checkOut:addDays(checkIn,1),adults:2,children:0};
};

export function BookingWizard({onClose}:{onClose:()=>void}){
 const [step,setStep]=useState(0);
 const [finished,setFinished]=useState(false);
 const closeRef=useRef<HTMLButtonElement>(null);
 const {register,control,trigger,formState:{errors},getValues}=useForm<BookingDraft>({
  resolver:zodResolver(bookingDraftSchema),mode:'onChange',defaultValues:initial()
 });
 useWatch({control});
 const values=getValues();
 const completeDraft=draftReady(values);
 const guests=useGuests({perPage:100});
 const options=useBookingOptions();
 const quote=useBookingQuote(values,step===2&&completeDraft&&dataMode==='mock');

 useEffect(()=>{
  const previous=document.activeElement instanceof HTMLElement?document.activeElement:null;
  closeRef.current?.focus();
  const handler=(event:KeyboardEvent)=>{
   if(event.key==='Escape')onClose();
   if(event.key==='Tab'){
    const panel=document.querySelector<HTMLElement>('[data-booking-wizard]');
    const els=panel?.querySelectorAll<HTMLElement>('button:not([disabled]),input:not([disabled]),select:not([disabled]),a[href],[tabindex]:not([tabindex="-1"])');
    if(els?.length){
     const first=els[0],last=els[els.length-1];
     if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
     else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
    }
   }
  };
  window.addEventListener('keydown',handler);
  return ()=>{window.removeEventListener('keydown',handler);previous?.focus();};
 },[onClose]);

 async function next(){
  const fields:(keyof BookingDraft)[]=step===0?['guestId']:['roomTypeId','checkIn','checkOut','adults','children'];
  if(await trigger(fields))setStep(old=>Math.min(2,old+1));
 }
 const selectedGuest=guests.data?.data.find(g=>g.id===values.guestId);
 const selectedType=options.data?.data.roomTypes.find(type=>type.id===values.roomTypeId);
 return <div className="wizard-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget)onClose();}}>
  <section className="wizard-panel" role="dialog" aria-modal="true" aria-labelledby="booking-wizard-title" data-booking-wizard>
   <header className="wizard-header"><div><small>FRIENDSHIP ON HOTEL · MOCK WORKFLOW</small><h2 id="booking-wizard-title">New reservation preview</h2><p>No reservation will be created or saved.</p></div><button ref={closeRef} className="icon-btn" aria-label="Close booking wizard" onClick={onClose}><X size={20}/></button></header>
   <ol className="wizard-progress">{steps.map((label,i)=><li key={label} className={i===step?'current':i<step?'done':''}><span>{i<step?<Check size={14}/>:i+1}</span>{label}</li>)}</ol>
   {finished?<div className="wizard-finished" role="status"><Check size={32}/><h3>Preview complete</h3><p>This was a simulated booking walkthrough. No inventory, guest records, or payments were changed.</p><button className="btn-primary" type="button" onClick={onClose}>Close preview</button></div>:<div className="wizard-body">
    {step===0&&<div className="wizard-section">
      <h3>Choose a guest</h3><p>Select an existing sample profile. New guest creation will be added with the backend workflow.</p>
      <QueryFeedback loading={guests.isPending} error={guests.error}/>
      <label className="wizard-label" htmlFor="wizard-guest">Guest profile</label>
      <select id="wizard-guest" className="wizard-input" {...register('guestId')}><option value="">Select a guest</option>{guests.data?.data.map(guest=><option key={guest.id} value={guest.id}>{guest.firstName} {guest.lastName}</option>)}</select>
      {errors.guestId&&<p className="wizard-error">{errors.guestId.message}</p>}
      {selectedGuest&&<div className="wizard-selection"><strong>{selectedGuest.firstName} {selectedGuest.lastName}</strong><span>{selectedGuest.email??'No email on file'}</span></div>}
    </div>}
    {step===1&&<div className="wizard-section">
      <h3>Stay dates and room type</h3><p>Choose the booking request. The sample room rates below are illustrative—not an availability check.</p>
      <QueryFeedback loading={options.isPending} error={options.error}/>
      <div className="wizard-fields"><div><label className="wizard-label" htmlFor="wizard-in">Check-in</label><input id="wizard-in" type="date" min={hotelToday()} className="wizard-input" {...register('checkIn')}/>{errors.checkIn&&<p className="wizard-error">{errors.checkIn.message}</p>}</div>
      <div><label className="wizard-label" htmlFor="wizard-out">Check-out</label><input id="wizard-out" type="date" min={addDays(hotelToday(),1)} className="wizard-input" {...register('checkOut')}/>{errors.checkOut&&<p className="wizard-error">{errors.checkOut.message}</p>}</div></div>
      <label className="wizard-label" htmlFor="wizard-type">Room type</label>
      <select id="wizard-type" className="wizard-input" {...register('roomTypeId')}><option value="">Select room type</option>{options.data?.data.roomTypes.map(type=><option key={type.id} value={type.id}>{type.name} · Sample {currency(type.sampleNightlyRate)}/night</option>)}</select>
      {errors.roomTypeId&&<p className="wizard-error">{errors.roomTypeId.message}</p>}
      <div className="wizard-fields"><div><label className="wizard-label" htmlFor="wizard-adults">Adults</label><input id="wizard-adults" type="number" min="1" max="8" className="wizard-input" {...register('adults',{valueAsNumber:true})}/>{errors.adults&&<p className="wizard-error">{errors.adults.message}</p>}</div>
      <div><label className="wizard-label" htmlFor="wizard-children">Children</label><input id="wizard-children" type="number" min="0" max="8" className="wizard-input" {...register('children',{valueAsNumber:true})}/>{errors.children&&<p className="wizard-error">{errors.children.message}</p>}</div></div>
      {selectedType&&<div className="wizard-selection"><strong>{selectedType.name}</strong><span>Maximum occupancy: {selectedType.maxOccupancy} persons. Policy validation remains a backend requirement.</span></div>}
    </div>}
    {step===2&&<div className="wizard-section">
     <h3>Review your example reservation</h3><p>This is not a confirmed booking or a live price quote.</p>
     <div className="wizard-review"><div><span>Guest</span><strong>{selectedGuest?selectedGuest.firstName+' '+selectedGuest.lastName:'—'}</strong></div><div><span>Room type</span><strong>{selectedType?.name??'—'}</strong></div><div><span>Check-in</span><strong>{dateLabel(values.checkIn)}</strong></div><div><span>Check-out</span><strong>{dateLabel(values.checkOut)}</strong></div><div><span>Guests</span><strong>{values.adults} adults · {values.children} children</strong></div></div>
     <div className="wizard-quote"><h4>Sample price breakdown</h4>
      {dataMode==='api'?<div className="wizard-callout"><AlertCircle size={18}/> The preview quote is disabled in API mode until Laravel pricing rules are implemented.</div>:<><QueryFeedback loading={quote.isPending} error={quote.error}/>
      {quote.data&&<><div><span>{quote.data.data.nights} nights × {currency(quote.data.data.nightlyRate)}</span><strong>{currency(quote.data.data.roomSubtotal)}</strong></div>
      <div><span>Taxes / fees</span><strong>Not calculated</strong></div>
      <div className="wizard-total"><span>Illustrative room subtotal</span><strong>{currency(quote.data.data.roomSubtotal)}</strong></div></>}</>}
      <p>Room availability, discounts, taxes, deposits, and cancellation terms require validated server-side policies.</p>
     </div>
    </div>}
   </div>}
   {!finished&&<footer className="wizard-footer"><button className="btn-inline" type="button" onClick={()=>step===0?onClose():setStep(v=>v-1)}>{step===0?'Cancel':<><ArrowLeft size={15}/> Back</>}</button>
   {step<2?<button className="btn-primary" type="button" onClick={next} disabled={step===0?guests.isPending||!!guests.error:options.isPending||!!options.error}>Continue <ArrowRight size={16}/></button>:<button className="btn-primary" type="button" disabled={!completeDraft||dataMode==='api'||quote.isPending||!!quote.error||!quote.data} onClick={()=>setFinished(true)}><CalendarDays size={16}/> Complete demo preview</button>}</footer>}
  </section>
 </div>;
}
