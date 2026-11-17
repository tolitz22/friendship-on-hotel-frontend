import {useEffect,useState,type FormEvent} from 'react';
import {useQuery} from '@tanstack/react-query';
import {CalendarRange,ShieldAlert} from 'lucide-react';
import {getReservationSimulation,type SimulationRecord} from '../api/reservationSimulation';
import {useLiveRooms} from '../api/liveCatalogQueries';
import {useHotelAuth} from '../components/AuthProvider';
import {Heading,Panel} from '../components/ui';
import {QueryFeedback} from '../components/QueryFeedback';

const dateToday=()=>new Date().toISOString().slice(0,10);
function Records({records}:{records:SimulationRecord[]}){
 if(!records.length)return <p className="guest-info">No stored matching records in this group.</p>;
 return <div className="table-scroll"><table><thead><tr><th>Reference</th><th>Check-in</th><th>Check-out</th><th>Stored lifecycle state</th></tr></thead>
 <tbody>{records.map(r=><tr key={r.id}><td>{r.reference}</td><td>{r.checkIn}</td><td>{r.checkOut}</td><td>{r.lifecycleState??'Unspecified'}</td></tr>)}</tbody></table></div>;
}
export function LiveReservationSimulation(){
 const {hotelId}=useHotelAuth();
 const [roomId,setRoomId]=useState('');
 const [from,setFrom]=useState(dateToday);
 const [to,setTo]=useState(()=>new Date(Date.now()+86400000).toISOString().slice(0,10));
 const [selection,setSelection]=useState<{roomId:string;from:string;to:string}|null>(null);
 const [validation,setValidation]=useState('');
 const rooms=useLiveRooms({page:1,perPage:100});
 useEffect(()=>{setRoomId('');setSelection(null);setValidation('');},[hotelId]);
 const simulated=useQuery({
  queryKey:['reservation-simulation',hotelId,selection],
  queryFn:()=>getReservationSimulation(selection!.roomId,selection!.from,selection!.to),
  enabled:!!hotelId&&!!selection,
  retry:false,
 });
 function submit(e:FormEvent<HTMLFormElement>){
  e.preventDefault();
  const days=(Date.parse(to+'T00:00:00Z')-Date.parse(from+'T00:00:00Z'))/86400000;
  if(!roomId){setValidation('Choose a registered room.');return;}
  if(!Number.isInteger(days)||days<1||days>31){setValidation('Select a stay of 1 to 31 nights.');return;}
  setValidation('');setSelection({roomId,from,to});
 }
 const result=simulated.data;
 return <>
  <div className="notice"><strong>Read-only scenario</strong> · This compares proposed dates with stored records. It never checks sellable availability and cannot create, reserve, or hold a room.</div>
  <Heading title="Reservation scenario simulator" description="Compare a proposed physical-room stay to existing assigned records and unassigned type-level demand."/>
  <Panel title="Proposed stay">
   <form className="demand-form" onSubmit={submit}>
    <label>Physical room<select required value={roomId} onChange={e=>setRoomId(e.target.value)}>
     <option value="">Choose a room</option>{rooms.data?.data.map(room=><option key={room.id} value={room.id}>Room {room.number} — {room.roomTypeName}</option>)}
    </select></label>
    <label>Check-in<input type="date" required value={from} onChange={e=>setFrom(e.target.value)}/></label>
    <label>Check-out<input type="date" required value={to} onChange={e=>setTo(e.target.value)}/></label>
    <button type="submit" className="btn-primary" disabled={rooms.isPending}><CalendarRange size={16}/> Analyze scenario</button>
   </form>
   <QueryFeedback loading={rooms.isPending} error={rooms.error}/>
   {rooms.data&&rooms.data.meta.total>100&&<p className="guest-info">Only the first 100 rooms are listed. Narrowing the full room selector requires a later pagination/search improvement.</p>}
   {validation&&<p role="alert" className="catalog-field-error">{validation}</p>}
  </Panel>
  {selection&&<><QueryFeedback loading={simulated.isPending} error={simulated.error}/>
   {result&&<>
    <div className="demand-summary"><strong>{result.data.assignedRoomOverlaps.length}</strong>
     <span>Stored overlapping records assigned to Room {result.data.roomNumber} · {result.data.nights} nights</span></div>
    <Panel title="Direct physical-room overlaps"><Records records={result.data.assignedRoomOverlaps}/></Panel>
    <Panel title="Unassigned demand for the same room type"><Records records={result.data.unassignedTypeOverlaps}/></Panel>
    <Panel title="Other assigned records in this room type">
     <p className="guest-info">{result.data.otherAssignedSameTypeCount} overlapping records assigned to other physical rooms of type {result.data.roomTypeName}.</p>
    </Panel>
    <div className="demand-warning"><ShieldAlert size={19}/><div><strong>Not availability, not bookable</strong>
     <p>{result.meta.warning}</p>
     <p>Includes all stored lifecycle states, even cancelled ones. Pending holds, maintenance blocks, operational rules, and atomic allocation have not been implemented.</p>
    </div></div>
   </>}
  </>}
 </>;
}
