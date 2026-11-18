import {useEffect,useRef,useState} from 'react';
import {Link,useNavigate,useSearch} from '@tanstack/react-router';
import {useQueryClient} from '@tanstack/react-query';
import {CalendarDays,Plus,ArrowRight,RefreshCw,Trash2} from 'lucide-react';
import {useHotelAuth} from '../components/AuthProvider';
import {Heading,Panel} from '../components/ui';
import {QueryFeedback} from '../components/QueryFeedback';
import {BookingGuestPicker} from '../components/BookingGuestPicker';
import {useSelectedGuest} from '../api/liveSelectedGuest';
import {useLiveRoomTypes,useLiveRatePlans,validLiveStay} from '../api/liveReservations';
import {createGroupBooking,useGroupBooking,useGroupBookings} from '../api/groupReservations';
import type {GroupBooking,GroupBookingInput} from '../api/groupReservations';
import {hotelToday,addDays} from '../features/reservations/calendarDate';
import {readSession} from '../api/session';
import {readableDate,readableDateTime,statusLabel} from '../lib/format';

type Room={guestId:string;roomTypeId:string;ratePlanId:string};
const blank=():Room=>({guestId:'',roomTypeId:'',ratePlanId:''});
const money=(minor:number,currency:string)=>new Intl.NumberFormat('en-PH',{
 style:'currency',currency:currency==='PHP'?'PHP':'USD',
}).format(minor/100);
const start=()=>hotelToday();

function RoomGuestField({value,index,disabled,onChange}:{value:string;index:number;disabled:boolean;onChange:(id:string)=>void}){
 const selected=useSelectedGuest(value||null);
 return <div><span className="wizard-label" id={'group-guest-'+index}>Registered guest</span>
  <BookingGuestPicker value={value} selectedGuest={selected.data??undefined}
   disabled={disabled} onChange={onChange}/>
  {value&&selected.isError&&<small role="alert">Could not verify this guest. Search and choose again.</small>}
 </div>;
}

function GroupDetails({id}:{id:string}){
 const details=useGroupBooking(id);
 const group=details.data;
 return <>
  <Link to="/group-reservations" search={{}}>← All group bookings</Link>
  <QueryFeedback loading={details.isPending} error={details.error} onRetry={()=>void details.refetch()}/>
  {group&&<Panel title={group.name}>
   <p><strong>{group.reference}</strong> · {group.roomCount} rooms · Created {readableDateTime(group.createdAt)}</p>
   {group.contactName&&<p>Group contact: {group.contactName}</p>}
   <p className="desk-muted">Each room has its own booking, guest folio and payment history. The group record does not transfer charges or settle bills.</p>
   <div className="reservation-manage-list">
    {group.rooms.map(room=><article className="reservation-manage-card" key={room.bookingId}>
     <div className="reservation-manage-primary">
      <strong>{room.guestName??'Guest name unavailable'}</strong>
      <p>{room.reference} · {room.roomTypeName} · {room.roomNumber?'Room '+room.roomNumber:'Room not assigned'}</p>
      <small>{readableDate(room.checkIn)} – {readableDate(room.checkOut)} · {statusLabel(room.status??'Unknown')}</small>
     </div>
     <div className="reservation-manage-action">
      <Link className="btn-primary" to="/reservations" search={{booking:room.bookingId}}>
       Open reservation <ArrowRight size={16}/>
      </Link>
      <Link to="/billing" search={{booking:room.bookingId}}>View individual guest bill</Link>
     </div>
    </article>)}
   </div>
  </Panel>}
 </>;
}

export function GroupReservations(){
 const {hotelId,user}=useHotelAuth();
 const canBook=!!user?.hotels.some(h=>h.id===hotelId&&(h.role==='admin'||h.role==='front_desk'));
 const search=useSearch({from:'/group-reservations'});
 const navigate=useNavigate();
 const client=useQueryClient();
 const groups=useGroupBookings();
 const types=useLiveRoomTypes();
 const rates=useLiveRatePlans();
 const [creating,setCreating]=useState(false);
 const [name,setName]=useState('');
 const [contact,setContact]=useState('');
 const [checkIn,setCheckIn]=useState(start);
 const [checkOut,setCheckOut]=useState(()=>addDays(start(),1));
 const [rooms,setRooms]=useState<Room[]>([blank(),blank()]);
 const [pending,setPending]=useState<{hotelId:string;payload:GroupBookingInput}|null>(null);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState<string|null>(null);
 const [result,setResult]=useState<GroupBooking|null>(null);
 const sending=useRef(false);
 const update=(i:number,key:keyof Room,value:string)=>{
  setRooms(old=>old.map((row,index)=>index===i
   ?{...row,[key]:value,...(key==='roomTypeId'?{ratePlanId:''}:{})}:row));
 };
 useEffect(()=>{setCreating(false);setPending(null);setResult(null);setError(null);},[hotelId]);
 const datesValid=validLiveStay({roomTypeId:rooms[0].roomTypeId||'1',checkIn,checkOut})
  &&checkIn>=hotelToday();
 const ready=canBook&&name.trim().length>=2&&datesValid&&rooms.length>=2&&
  rooms.every(room=>Number(room.guestId)>0&&Number(room.roomTypeId)>0
   &&Number(room.ratePlanId)>0
   &&rates.data?.data.some(rate=>rate.active&&rate.id===room.ratePlanId&&rate.roomTypeId===room.roomTypeId));
 const locked=!!pending||busy||!!result;
 const estimate=rooms.reduce((sum,room)=>{
  const rate=rates.data?.data.find(item=>item.id===room.ratePlanId&&item.active);
  return rate?.currency==='PHP'?sum+rate.nightlyMinor:sum;
 },0)*Math.max(0,(Date.parse(checkOut+'T00:00:00Z')-Date.parse(checkIn+'T00:00:00Z'))/86400000);
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
   ...(contact.trim()?{contactName:contact.trim()}:{}),
   checkIn,checkOut,
   rooms:rooms.map(room=>({guestId:Number(room.guestId),
    roomTypeId:Number(room.roomTypeId),ratePlanId:Number(room.ratePlanId)})),
  };
  setPending({hotelId,payload});
  void send(payload,hotelId);
 };
 if(search.group)return <GroupDetails id={search.group}/>;
 return <>
  <Heading title="Group reservations" description="Keep multiple rooms together while retaining each guest's reservation and bill."/>
  <div className="reservation-workspace-bar">
   <div className="view-switch">
    <button type="button" aria-pressed={!creating} className={!creating?'selected':''}
     onClick={()=>setCreating(false)}>Groups</button>
    {canBook&&<button type="button" aria-pressed={creating} className={creating?'selected':''}
     onClick={()=>setCreating(true)}><Plus size={16}/> New group booking</button>}
   </div>
  </div>
  {creating&&canBook?<Panel title="Create a multi-room reservation">
   {result?<div role="status">
    <h3>Group reservation confirmed</h3>
    <p>{result.reference} · {result.roomCount} rooms were created.</p>
    <button className="btn-primary" onClick={()=>void navigate({to:'/group-reservations',search:{group:result.id}})}>
     View group and assign rooms <ArrowRight size={16}/></button>
   </div>:<>
    <p className="desk-muted">All rooms are reserved together or none are saved. Physical room assignment and check-in happen individually after booking.</p>
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
     <h3>Rooms and registered guests</h3>
     <QueryFeedback loading={types.isPending||rates.isPending}
      error={types.error??rates.error}/>
     {rooms.map((room,index)=><div key={index} className="rb-section">
      <div className="rb-section-heading"><h4>Room {index+1}</h4>
       {rooms.length>2&&<button type="button" className="btn-inline"
        onClick={()=>setRooms(old=>old.filter((_,i)=>i!==index))}>
        <Trash2 size={14}/> Remove</button>}</div>
      <div className="wizard-fields">
       <RoomGuestField index={index} value={room.guestId} disabled={locked}
        onChange={guestId=>update(index,'guestId',guestId)}/>
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
     <p className="desk-muted">Search registered guests by name, email or phone. Add missing guests in the Guest directory before booking.</p>
    </fieldset>
    <div className="rb-review">
     <h4>Review group booking</h4>
     <p>{rooms.length} rooms · {readableDate(checkIn)} – {readableDate(checkOut)}</p>
     <p><strong>Estimated room subtotal: {money(estimate,'PHP')}</strong></p>
     <p className="desk-muted">Estimated room charges only. Taxes, service fees, discounts, deposits, and payments are separate. Inventory is verified again when you confirm.</p>
     {error&&<p role="alert" className="wizard-error">{error}</p>}
     {pending?<button className="btn-primary" type="button" disabled={busy}
       onClick={()=>void send(pending.payload,pending.hotelId)}>
       <RefreshCw size={16}/> {busy?'Checking booking…':'Retry same request safely'}</button>:
      <button className="btn-primary" type="button" disabled={!ready||busy}
       onClick={confirm}>{busy?'Saving…':'Confirm all room bookings'} <ArrowRight size={16}/></button>}
    </div>
   </>}
  </Panel>:<Panel title="Saved group reservations">
   <QueryFeedback loading={groups.isPending} error={groups.error} onRetry={()=>void groups.refetch()}/>
   {groups.data?.data.length===0&&<p>No group bookings recorded for this property.</p>}
   <div className="reservation-manage-list">
    {groups.data?.data.map(group=><article key={group.id} className="reservation-manage-card">
     <div><strong>{group.name}</strong><p>{group.reference} · {group.roomCount} rooms</p>
      <small>{group.contactName??'No contact recorded'} · {readableDateTime(group.createdAt)}</small></div>
     <Link to="/group-reservations" search={{group:group.id}}>View group <ArrowRight size={16}/></Link>
    </article>)}
   </div>
   {groups.data&&groups.data.meta.totalPages>1&&<p className="desk-muted">
    Showing the latest {groups.data.data.length} groups. Further pages are available through the API.</p>}
  </Panel>}
  <p className="desk-muted"><CalendarDays size={14}/> Group booking does not guarantee specific room numbers; assign each physical room from its reservation.</p>
 </>;
}
