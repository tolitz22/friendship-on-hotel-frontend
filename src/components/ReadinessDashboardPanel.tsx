import {useEffect,useMemo,useState} from 'react';
import {AlertTriangle,ClipboardCheck,RefreshCw} from 'lucide-react';
import {useHotelAuth} from './AuthProvider';
import {Panel,Status} from './ui';
import {QueryFeedback} from './QueryFeedback';
import {useReadinessDashboard} from '../api/readinessDashboard';

const roomLabels={
 needs_inspection:'Needs inspection',
 awaiting_review:'Awaiting review',
 approved_current:'Current approval',
 blocked_or_stale:'Blocked / stale',
} as const;
const riskLabels={
 unassigned_room:'Room unassigned',
 room_record_missing:'Room record missing',
 no_current_readiness_issue:'No current readiness issue',
 inspection_or_blocker:'Inspection / blocker review',
} as const;

export function ReadinessDashboardPanel(){
 const {hotelId}=useHotelAuth();
 const [days,setDays]=useState(7);
 const [page,setPage]=useState(1);
 const [arrivalPage,setArrivalPage]=useState(1);
 const [riskFilter,setRiskFilter]=useState<'all'|'attention'>('attention');
 const [roomFilter,setRoomFilter]=useState<'all'|keyof typeof roomLabels>('all');
 const query=useReadinessDashboard(days,page);
 const data=query.data?.data;
 const meta=query.data?.meta;
 const arrivals=useMemo(()=>data?.arrivals.filter(a=>
  riskFilter==='all'||a.risk!=='no_current_readiness_issue')??[],[data,riskFilter]);
 const arrivalPages=Math.ceil(arrivals.length/20);
 const arrivalsShown=arrivals.slice((arrivalPage-1)*20,arrivalPage*20);
 const roomsShown=data?.rooms.filter(room=>roomFilter==='all'||room.status===roomFilter)??[];
 useEffect(()=>{setPage(1);setArrivalPage(1);setRoomFilter('all');},[hotelId]);
 if(!hotelId)return null;
 return <Panel title="Room readiness · Operational dashboard">
  <p>Live hotel-wide inspection coverage and upcoming arrival exceptions. Counts are from Laravel, not sample records. A current approval is <strong>not</strong> a guaranteed future-night room allocation or a completed guest/payment check.</p>
  <div className="desk-tools">
   <label htmlFor="readiness-horizon">Upcoming arrival window
    <select id="readiness-horizon" value={days}
     onChange={e=>{setDays(Number(e.target.value));setPage(1);setArrivalPage(1);}}>
     <option value={3}>Next 3 days</option>
     <option value={7}>Next 7 days</option>
     <option value={14}>Next 14 days</option>
    </select>
   </label>
   <button className="btn-inline" type="button" disabled={query.isFetching}
    onClick={()=>void query.refetch()}><RefreshCw size={16}/> Refresh report</button>
  </div>
  <QueryFeedback loading={query.isPending} error={query.error}/>
  {data&&meta&&<>
   <p role="status">As of hotel date <strong>{data.asOfHotelDate}</strong> · Upcoming arrivals through (exclusive) <strong>{data.arrivalWindowEndExclusive}</strong> · Mandatory check-in inspection <strong>{data.enforceAtCheckIn?'Enabled':'Disabled'}</strong>.</p>
   <div className="hk-headline">
    <div className="hk-stat"><ClipboardCheck size={18}/><span>Registered rooms</span><strong>{data.summary.totalRooms}</strong></div>
    <div className="hk-stat"><span>Current approval</span><strong>{data.summary.approvedCurrent}</strong></div>
    <div className="hk-stat"><span>Awaiting review</span><strong>{data.summary.awaitingReview}</strong></div>
    <div className="hk-stat"><span>Needs inspection</span><strong>{data.summary.needsInspection}</strong></div>
    <div className="hk-stat"><AlertTriangle size={18}/><span>Blocked / stale</span><strong>{data.summary.blockedOrStale}</strong></div>
   </div>
   <section>
    <h4>Upcoming confirmed arrivals</h4>
    <p>{meta.arrivalTotal} confirmed arrival(s) in window · {data.arrivals.filter(a=>a.risk!=='no_current_readiness_issue').length} requiring current readiness attention. Future conditions may change after the report was generated.</p>
    <label htmlFor="arrival-risk-filter">Show
     <select id="arrival-risk-filter" value={riskFilter}
      onChange={e=>{setRiskFilter(e.target.value as 'all'|'attention');setArrivalPage(1);}}>
      <option value="attention">Requires attention</option>
      <option value="all">All arrivals</option>
     </select>
    </label>
    {arrivals.length===0&&<p role="status">No arrivals match this filter for the selected window.</p>}
    {arrivalsShown.length>0&&<div className="table-scroll"><table>
     <thead><tr><th>Booking</th><th>Arrival</th><th>Assigned room</th><th>Current risk</th></tr></thead>
     <tbody>{arrivalsShown.map(arrival=><tr key={arrival.bookingId}>
      <td><strong>{arrival.reference}</strong><small> #{arrival.bookingId}</small></td>
      <td>{arrival.checkIn}</td>
      <td>{arrival.roomNumber??'Unassigned'}</td>
      <td><Status value={riskLabels[arrival.risk]}/></td>
     </tr>)}</tbody>
    </table></div>}
    <div className="desk-tools">
     <span>Arrival page {arrivalPage} of {Math.max(1,arrivalPages)} · All confirmed arrivals are considered.</span>
     <div className="desk-date-nav">
      <button className="btn-inline" type="button" disabled={arrivalPage<=1}
       onClick={()=>setArrivalPage(v=>v-1)}>Previous arrivals</button>
      <button className="btn-inline" type="button" disabled={arrivalPage>=arrivalPages}
       onClick={()=>setArrivalPage(v=>v+1)}>Next arrivals</button>
     </div>
    </div>
   </section>
   <section>
    <h4>Physical room inspection queue</h4>
    <p>Room statuses below are from the current server page; totals above cover the full hotel. Use the Rooms catalogue below to open an inspection or submit a new review.</p>
    <label htmlFor="readiness-room-filter">Filter this room page
     <select id="readiness-room-filter" value={roomFilter}
      onChange={e=>setRoomFilter(e.target.value as typeof roomFilter)}>
      <option value="all">All rooms on page</option>
      {Object.entries(roomLabels).map(([key,label])=><option value={key} key={key}>{label}</option>)}
     </select>
    </label>
    {roomsShown.length===0&&<p role="status">No rooms on the current page match the selected filter.</p>}
    {roomsShown.length>0&&<div className="table-scroll"><table>
     <thead><tr><th>Room</th><th>Inspection</th><th>Current status</th><th>Operational blockers</th></tr></thead>
     <tbody>{roomsShown.map(room=><tr key={room.roomId}>
      <td><strong>{room.roomNumber}</strong><small> #{room.roomId}</small></td>
      <td>{room.latestInspectionId===null?'None':room.inspectionStatus+' #'+room.latestInspectionId}</td>
      <td><Status value={roomLabels[room.status]}/></td>
      <td>{Object.entries(room.blockers).filter(([,active])=>active).map(([key])=>key
       .replace(/([a-z])([A-Z])/g,'$1 $2').toLowerCase()).join('; ')||'No current listed blockers'}</td>
     </tr>)}</tbody>
    </table></div>}
    <div className="desk-tools">
     <span>Room page {meta.roomPage} of {Math.max(1,meta.roomTotalPages)} · {meta.roomPerPage} per page</span>
     <div className="desk-date-nav">
      <button type="button" className="btn-inline" disabled={page<=1}
       onClick={()=>{setPage(v=>v-1);setRoomFilter('all');}}>Previous rooms</button>
      <button type="button" className="btn-inline" disabled={page>=meta.roomTotalPages}
       onClick={()=>{setPage(v=>v+1);setRoomFilter('all');}}>Next rooms</button>
     </div>
    </div>
   </section>
   <p className="hk-notice"><AlertTriangle size={16}/> Snapshot only. No future room readiness, inventory availability, guest identity, or financial settlement guarantee. Laravel rechecks an enabled inspection gate inside check-in.</p>
  </>}
 </Panel>;
}
