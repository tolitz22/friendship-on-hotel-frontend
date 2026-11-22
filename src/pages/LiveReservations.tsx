import {useEffect,useState} from 'react';
import {GroupContextBar} from '../components/GroupContextBar';
import {useNavigate,useSearch} from '@tanstack/react-router';
import {useHotelAuth} from '../components/AuthProvider';
import {LiveReservationOperations} from './LiveReservationOperations';
import {LiveBookingForm} from './LiveBookingForm';
import {LiveBookingsWorkspace} from './LiveBookingsWorkspace';
import {AlertTriangle,CalendarDays,ArrowRight} from 'lucide-react';
import {
 useLiveAvailability,useLiveRatePlans,useLiveReservationRecords,useLiveRoomQuote,
 useLiveRoomTypes,useLiveReservationDetail,validLiveStay,
} from '../api/liveReservations';
import type {LiveStay} from '../api/liveReservations';
import {readSession} from '../api/session';
import {Heading,Panel} from '../components/ui';
import {QueryFeedback} from '../components/QueryFeedback';
import {dateLabel} from '../lib/format';
import {addDays,hotelToday} from '../features/reservations/calendarDate';

const initialStay=()=>{
 const checkIn=addDays(hotelToday(),1);
 return {roomTypeId:'',checkIn,checkOut:addDays(checkIn,1)};
};
const price=(minor:number,currency:string)=>currency==='PHP'
 ?new Intl.NumberFormat('en-PH',{style:'currency',currency:'PHP'}).format(minor/100)
 :new Intl.NumberFormat('en-US').format(minor)+' '+currency+' minor units';

export function LiveReservations(){
 const {hotelId,user}=useHotelAuth();
 const canOperate=!!user?.hotels.some(h=>h.id===hotelId&&(h.role==='admin'||h.role==='front_desk'));
 const navigation=useNavigate();
 const routeSearch=useSearch({from:'/reservations'});
 const selectedRecordId=routeSearch.booking??null;
 const detail=useLiveReservationDetail(selectedRecordId);
 const openBooking=(booking:string)=>void navigation({to:'/reservations',search:{booking,
  group:routeSearch.group,hotel:routeSearch.hotel,checkIn:routeSearch.checkIn,
  checkOut:routeSearch.checkOut}});
 const closeBooking=()=>void navigation({to:'/reservations',search:routeSearch.group
  ?{group:routeSearch.group,hotel:routeSearch.hotel,checkIn:routeSearch.checkIn,
    checkOut:routeSearch.checkOut}: {}});
 const [page,setPage]=useState(1);
 const [view,setView]=useState<'manage'|'new'>('manage');
 const [filter,setFilter]=useState<import('../api/liveReservations').ReservationListFilter>('all');
 const [search,setSearch]=useState('');
 const [appliedSearch,setAppliedSearch]=useState('');
 useEffect(()=>{
  const timer=window.setTimeout(()=>{setAppliedSearch(search.trim());setPage(1);},300);
  return ()=>window.clearTimeout(timer);
 },[search]);
 useEffect(()=>{
  setPage(1);setFilter('all');setSearch('');setAppliedSearch('');
  setView(routeSearch.mode==='new'||!!routeSearch.guest||!!routeSearch.room?'new':'manage');
 },[hotelId,routeSearch.mode,routeSearch.guest,routeSearch.room]);
 const [inputs,setInputs]=useState<LiveStay>(initialStay);
 const [rateId,setRateId]=useState('');
 const [requested,setRequested]=useState<{stay:LiveStay;rateId:string}|null>(null);
 const records=useLiveReservationRecords(page,appliedSearch,filter);
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
 const selectedRecord=detail.data??null;
 const filtered=records.isSuccess?rows:[];
 const pagination=records.isSuccess?records.data.meta:undefined;
 const searching=search.trim()!==appliedSearch;
 const clearFilters=()=>{setSearch('');setAppliedSearch('');setFilter('all');setPage(1);};
 const previewOutdated=requested!==null&&(requested.rateId!==rateId||
  requested.stay.roomTypeId!==inputs.roomTypeId||
  requested.stay.checkIn!==inputs.checkIn||
  requested.stay.checkOut!==inputs.checkOut);

 if(routeSearch.hotel&&routeSearch.hotel!==hotelId)return <Panel title="Select the original property">
  <p role="alert">This booking link belongs to another hotel. Switch to the original hotel to view its reservation.</p>
 </Panel>;
 if(!hasHotel)return <>
  <Heading title="Bookings" description="Select an authorized hotel to see its bookings."/>
  <Panel title="Choose a property"><p role="status">Select your hotel from the authenticated workspace before creating or managing reservations.</p></Panel>
 </>;
 return <>
  {!selectedRecordId&&<Heading title="Bookings" description="Find a guest booking, see what needs attention, and complete the next step."/>}
  {routeSearch.group&&<GroupContextBar groupId={routeSearch.group} originHotel={routeSearch.hotel} selectedTab="rooms"/>}
    {selectedRecordId?<>
   <section className="stay-selected-workflow" aria-label="Selected reservation">
    <QueryFeedback loading={detail.isPending} error={detail.error} onRetry={()=>void detail.refetch()}/>
    {selectedRecord&&<LiveReservationOperations key={hotelId+'-'+selectedRecord.id}
     record={selectedRecord} preferredRoomId={routeSearch.room??null}
     preferredRoomNumber={routeSearch.roomNumber??null} deskAction={routeSearch.deskAction??null} onClose={closeBooking}/>}
   </section>
  </>:<>
   {view==='new'&&<div className="reservation-workspace-bar" aria-label="New booking navigation">
    <button type="button" className="btn-inline" onClick={()=>{
     setView('manage');void navigation({to:'/reservations',search:{}});
    }}><ArrowRight size={15} style={{transform:'rotate(180deg)'}}/> Back to bookings</button>
    <span className="table-count">Create a new guest reservation</span>
   </div>}
   {view==='new'&&canOperate?<LiveBookingForm/>:
    <LiveBookingsWorkspace rows={filtered} pagination={pagination}
     isPending={records.isPending} isError={records.isError} error={records.error}
     isFetching={records.isFetching} searching={searching} search={search}
     filter={filter} page={page} canOperate={canOperate}
     onSearch={setSearch} onFilter={value=>{setFilter(value);setPage(1);}}
     onPage={setPage} onClear={clearFilters} onRefresh={()=>void records.refetch()}
     onOpen={openBooking}
     onNew={()=>{setView('new');void navigation({to:'/reservations',search:{mode:'new'}});}}/>}
  </>}
  {!selectedRecordId&&view==='manage'&&<details className="workflow-disclosure">
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
   {previewOutdated&&<p role="status" className="reservation-preview-stale"><AlertTriangle size={16}/> The stay or rate changed. The previous availability and quote are hidden. Run the check again to review current values.</p>}
   {requested&&!previewOutdated&&<div>
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
  </details>}
 </>;
}
