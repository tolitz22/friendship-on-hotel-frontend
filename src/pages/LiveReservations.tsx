import {useEffect,useState} from 'react';
import {useHotelAuth} from '../components/AuthProvider';
import {LiveReservationOperations} from './LiveReservationOperations';
import {LiveBookingForm} from './LiveBookingForm';
import {AlertTriangle,CalendarDays,Search} from 'lucide-react';
import {
 useLiveAvailability,useLiveRatePlans,useLiveReservationRecords,useLiveRoomQuote,
 useLiveRoomTypes,validLiveStay,
} from '../api/liveReservations';
import type {LiveStay} from '../api/liveReservations';
import {readSession} from '../api/session';
import {Heading,Panel,Status} from '../components/ui';
import {QueryFeedback} from '../components/QueryFeedback';
import {dateLabel,statusLabel} from '../lib/format';
import {addDays,hotelToday} from '../features/reservations/calendarDate';

const initialStay=()=>{
 const checkIn=addDays(hotelToday(),1);
 return {roomTypeId:'',checkIn,checkOut:addDays(checkIn,1)};
};
const price=(minor:number,currency:string)=>currency==='PHP'
 ?new Intl.NumberFormat('en-PH',{style:'currency',currency:'PHP'}).format(minor/100)
 :new Intl.NumberFormat('en-US').format(minor)+' '+currency+' minor units';

export function LiveReservations(){
 const {hotelId}=useHotelAuth();
 const [selectedRecordId,setSelectedRecordId]=useState<string|null>(null);
 const [page,setPage]=useState(1);
 useEffect(()=>{setSelectedRecordId(null);setPage(1);},[hotelId]);
 const [search,setSearch]=useState('');
 const [inputs,setInputs]=useState<LiveStay>(initialStay);
 const [rateId,setRateId]=useState('');
 const [requested,setRequested]=useState<{stay:LiveStay;rateId:string}|null>(null);
 const records=useLiveReservationRecords(page);
 const types=useLiveRoomTypes();
 const rates=useLiveRatePlans();
 const availability=useLiveAvailability(requested?.stay??null);
 const quote=useLiveRoomQuote(requested?.stay??null,requested?.rateId??'');
 const hasHotel=!!readSession().hotelId;
 const valid=validLiveStay(inputs);
 const chosenType=types.data?.data.find(type=>type.id===inputs.roomTypeId);
 const activeRates=(rates.data?.data??[]).filter(rate=>rate.roomTypeId===inputs.roomTypeId&&rate.active);
 const chosenRate=activeRates.find(rate=>rate.id===rateId);
 const rows=records.data?.data??[];
 const selectedRecord=rows.find(item=>item.id===selectedRecordId)??null;
 const term=search.trim().toLocaleLowerCase();
 const filtered=rows.filter(record=>!term||
  [record.reference,record.id,record.lifecycleState??''].some(v=>v.toLocaleLowerCase().includes(term)));
 const pagination=records.data?.meta;
 const previewOutdated=requested!==null&&(requested.rateId!==rateId||
  requested.stay.roomTypeId!==inputs.roomTypeId||
  requested.stay.checkIn!==inputs.checkIn||
  requested.stay.checkOut!==inputs.checkOut);

 if(!hasHotel)return <>
  <Heading title="Reservations" description="Create a confirmed booking or manage an existing stay. Your hotel is selected in the header."/>
  <div className="workflow-intro" aria-label="Booking workflow steps">
   <div className="workflow-step"><strong>1</strong><span>Select guest and dates</span></div>
   <div className="workflow-step"><strong>2</strong><span>Review current capacity and subtotal</span></div>
   <div className="workflow-step"><strong>3</strong><span>Confirm the booking in Laravel</span></div>
  </div>
  <LiveBookingForm/>
  <details className="workflow-disclosure" open>
   <summary>Existing bookings · Find a reservation and manage its stay</summary>
  <Panel title="Saved reservation records" action={<span className="table-count">{pagination?.total??'—'} records</span>}>
   <div className="table-toolbar">
    <label className="search-box"><Search size={17}/>
     <input value={search} onChange={e=>setSearch(e.target.value)}
      aria-label="Search current reservation page" placeholder="Search this page by reference or status"/>
    </label>
    <span className="filter-hint">Read-only · server pagination</span>
   </div>
   <QueryFeedback loading={records.isPending} error={records.error}
    empty={records.isSuccess&&filtered.length===0}/>
   {records.isSuccess&&filtered.length>0&&<div className="table-scroll"><table>
    <thead><tr><th>Reference</th><th>Stay</th><th>Room type ID</th><th>Assigned room ID</th><th>Lifecycle</th></tr></thead>
    <tbody>{filtered.map(record=><tr key={record.id}>
     <td><button type="button" className="reservation-reference-button"
       aria-label={'Manage reservation '+record.reference}
       onClick={()=>setSelectedRecordId(record.id)}>{record.reference}</button>
       <span className="cell-note">Record #{record.id}</span></td>
     <td>{dateLabel(record.checkIn)} – {dateLabel(record.checkOut)}</td>
     <td>{record.roomTypeId}</td><td>{record.assignedRoomId??'Unassigned'}</td>
     <td>{record.lifecycleState?<Status value={statusLabel(record.lifecycleState)}/>:<span className="desk-muted">Unknown / legacy</span>}</td>
    </tr>)}</tbody></table></div>}
   {records.isSuccess&&<div className="desk-tools">
    <span className="table-count">Page {pagination!.page} of {Math.max(1,pagination!.totalPages)} · Search filters this page only.</span>
    <div className="desk-date-nav">
     <button type="button" className="btn-inline" disabled={page<=1} onClick={()=>{setPage(v=>v-1);setSearch('');}}>Previous page</button>
     <button type="button" className="btn-inline" disabled={page>=pagination!.totalPages} onClick={()=>{setPage(v=>v+1);setSearch('');}}>Next page</button>
    </div>
   </div>}
   <p className="desk-preview-note">These are structural records; this list does not prove availability, guest identity, room cleanliness, or a payable rate. Administrator assignment and lifecycle operations open from the reference; Laravel checks them again. Select a reservation reference to open room assignment, check-in/out and recorded activity.</p>
  </Panel>
  {selectedRecord&&<LiveReservationOperations key={hotelId+'-'+selectedRecord.id}
   record={selectedRecord} onClose={()=>setSelectedRecordId(null)}/>}

  </details>
  <details className="workflow-disclosure">
   <summary>Optional · Check nightly availability and compare a rate</summary>
  <Panel title="Check room-type availability and nightly rate">
   <div className="desk-preview-note"><CalendarDays size={18}/>
    <p>Check a future stay against current physical-room inventory and a selected active rate. These requests do not hold rooms, make reservations, collect deposits, or calculate final taxes and fees.</p>
   </div>
   <QueryFeedback loading={types.isPending||rates.isPending} error={types.error??rates.error}/>
   {types.isSuccess&&rates.isSuccess&&<form onSubmit={event=>{
    event.preventDefault();
    if(!valid||!chosenType||!chosenRate)return;
    setRequested({stay:{...inputs},rateId:chosenRate.id});
   }}>
    <div className="wizard-fields">
     <div><label className="wizard-label" htmlFor="live-stay-check-in">Check-in</label>
      <input id="live-stay-check-in" className="wizard-input" type="date" value={inputs.checkIn}
       onChange={e=>setInputs(old=>({...old,checkIn:e.target.value}))} required/></div>
     <div><label className="wizard-label" htmlFor="live-stay-check-out">Check-out</label>
      <input id="live-stay-check-out" className="wizard-input" type="date" value={inputs.checkOut}
       onChange={e=>setInputs(old=>({...old,checkOut:e.target.value}))} required/></div>
    </div>
    <div className="wizard-fields">
     <div><label className="wizard-label" htmlFor="live-room-type">Room type</label>
      <select id="live-room-type" className="wizard-input" value={inputs.roomTypeId}
       onChange={e=>{setInputs(old=>({...old,roomTypeId:e.target.value}));setRateId('');}} required>
       <option value="">Select room type</option>
       {types.data.data.map(type=><option key={type.id} value={type.id}>{type.name} · Max {type.maxOccupancy}</option>)}
      </select></div>
     <div><label className="wizard-label" htmlFor="live-rate-plan">Active rate plan</label>
      <select id="live-rate-plan" className="wizard-input" value={rateId}
       onChange={e=>setRateId(e.target.value)} required>
       <option value="">Select rate</option>
       {activeRates.map(rate=><option key={rate.id} value={rate.id}>{rate.name} · {price(rate.nightlyMinor,rate.currency)}/night</option>)}
      </select></div>
    </div>
    {!valid&&<p role="alert" className="wizard-error">Choose valid stay dates (1–31 nights) and a room type.</p>}
    {chosenType&&activeRates.length===0&&<p role="status">No active rate plan is configured for this room type. No final price can be estimated.</p>}
    <button type="submit" className="btn-primary" disabled={!valid||!chosenRate}>Check inventory and room subtotal</button>
   </form>}
   {previewOutdated&&<p role="status">Inputs have changed. Run the preview again to update the results below.</p>}
   {requested&&<div>
    <h3>Availability for {dateLabel(requested.stay.checkIn)} – {dateLabel(requested.stay.checkOut)}</h3>
    <QueryFeedback loading={availability.isPending} error={availability.error}/>
    {availability.data&&<div>
     <p><strong>{availability.data.data.canBook?'Room-type capacity currently available':'No room-type capacity for every requested night'}</strong></p>
     <div className="table-scroll"><table><thead><tr><th>Night</th><th>Physical rooms</th><th>Reserved</th><th>Blocked</th><th>Remaining</th></tr></thead>
      <tbody>{availability.data.data.nights.map(n=><tr key={n.date}>
       <td>{dateLabel(n.date)}</td><td>{n.physicalRooms}</td><td>{n.reserved}</td>
       <td>{n.blocked}</td><td>{n.remaining}{n.overcommitted?' · Overcommitted':''}</td>
      </tr>)}</tbody></table></div>
     <p className="desk-preview-note">Inventory changes at any moment. A positive result does not guarantee a room or verify housekeeping readiness.</p>
    </div>}
    <h3>Rate quote — room subtotal only</h3>
    <QueryFeedback loading={quote.isPending} error={quote.error}/>
    {quote.data&&<div className="wizard-quote">
     <p>{quote.data.data.nights.length} night(s) × {price(quote.data.data.nightlyMinor,quote.data.data.currency)}</p>
     <p><strong>Room subtotal: {price(quote.data.data.roomSubtotalMinor,quote.data.data.currency)}</strong></p>
     <p><AlertTriangle size={16}/> Taxes, service charges, discounts and deposits are not calculated. Not a final amount due.</p>
    </div>}
   </div>}
  </Panel>
  </details>
 </>;
}
