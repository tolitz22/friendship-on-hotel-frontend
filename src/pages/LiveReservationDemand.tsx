import {useEffect,useState,type FormEvent} from 'react';
import {useQuery} from '@tanstack/react-query';
import {CalendarRange,ShieldAlert} from 'lucide-react';
import {getReservationDemand} from '../api/reservationDemand';
import {useHotelAuth} from '../components/AuthProvider';
import {Heading,Panel} from '../components/ui';
import {QueryFeedback} from '../components/QueryFeedback';

const iso=(date:Date)=>date.toISOString().slice(0,10);
export function LiveReservationDemand(){
 const {hotelId}=useHotelAuth();
 const [from,setFrom]=useState(()=>iso(new Date()));
 const [to,setTo]=useState(()=>iso(new Date(Date.now()+7*86400000)));
 const [range,setRange]=useState<{from:string;to:string}|null>(null);
 const [validation,setValidation]=useState('');
 useEffect(()=>{setRange(null);setValidation('');},[hotelId]);
 const query=useQuery({
  queryKey:['reservation-demand',hotelId,range?.from,range?.to],
  queryFn:()=>getReservationDemand(range!.from,range!.to),
  enabled:!!hotelId&&!!range,
  retry:false,
 });
 const submit=(event:FormEvent<HTMLFormElement>)=>{
  event.preventDefault();
  const first=Date.parse(from+'T00:00:00Z'),last=Date.parse(to+'T00:00:00Z');
  const nights=(last-first)/86400000;
  if(!Number.isInteger(nights)||nights<1||nights>31){setValidation('Choose a valid range of 1–31 nights.');return;}
  setValidation('');setRange({from,to});
 };
 return <>
  <div className="notice"><strong>Structural diagnostic only</strong> · The counts below include every stored reservation lifecycle state, even cancelled records. They must NOT be used to determine availability, physical occupancy, or whether a booking can be created.</div>
  <Heading title="Reservation demand diagnostic" description="Read-only nightly breakdown of stored provisional reservation records. Not a booking engine."/>
  <Panel title="Reporting window">
   <form className="demand-form" onSubmit={submit}>
    <label>From (inclusive)<input type="date" value={from} onChange={e=>setFrom(e.target.value)} required/></label>
    <label>To (exclusive)<input type="date" value={to} onChange={e=>setTo(e.target.value)} required/></label>
    <button type="submit" className="btn-primary"><CalendarRange size={16}/> Analyze records</button>
   </form>
   {validation&&<p role="alert" className="catalog-field-error">{validation}</p>}
  </Panel>
  {range&&<><QueryFeedback loading={query.isPending} error={query.error}/>
   {query.data&&<><div className="demand-summary">
    <strong>{query.data.data.matchingRecordCount}</strong>
    <span>Reservations overlapping {query.data.meta.from} through {query.data.meta.to} (departure date not counted as an occupied night)</span>
   </div>
   <Panel title="Nightly structural records">
    <div className="table-scroll"><table><thead><tr><th>Night</th><th>Room type</th><th>Registered rooms</th><th>Assigned records</th><th>Unassigned records</th><th>Total records</th></tr></thead><tbody>
     {query.data.data.days.flatMap(day=>day.roomTypes.map(type=><tr key={day.date+'-'+type.roomTypeId}><td>{day.date}</td><td>{type.roomTypeName}</td><td>{type.registeredRooms}</td><td>{type.assignedRecords}</td><td>{type.unassignedRecords}</td><td><strong>{type.totalRecords}</strong></td></tr>))}
    </tbody></table></div>
    {query.data.data.days.every(day=>day.roomTypes.length===0)&&<p className="guest-info">No room types registered in this hotel.</p>}
   </Panel>
   <div className="demand-warning"><ShieldAlert size={18}/><div><strong>Not availability or occupancy</strong>
    {query.data.meta.warnings.map(w=><p key={w}>{w}</p>)}
   </div></div></>}
  </>}
 </>;
}
