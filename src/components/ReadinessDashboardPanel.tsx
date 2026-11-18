import {useEffect,useMemo,useState} from 'react';
import {Link} from '@tanstack/react-router';
import {
 AlertTriangle,ArrowRight,BedDouble,CalendarDays,CheckCircle2,
 ChevronLeft,ChevronRight,ClipboardCheck,Clock3,Info,RefreshCw,
 ShieldAlert,ShieldCheck,
} from 'lucide-react';
import {useHotelAuth} from './AuthProvider';
import {QueryFeedback} from './QueryFeedback';
import {useReadinessDashboard,type DashboardArrival,type DashboardRoom} from '../api/readinessDashboard';
import {dateLabel} from '../lib/format';

type ArrivalView='attention'|'all';
type RoomView='action'|'all'|'approved';
type RoomStatus=DashboardRoom['status'];
type ArrivalRisk=DashboardArrival['risk'];

const roomMeaning:Record<RoomStatus,{label:string;description:string;next:string;tone:string}>={
 needs_inspection:{
  label:'Inspection needed',description:'A current approved inspection is missing.',
  next:'Inspect the room and submit findings',tone:'warning',
 },
 awaiting_review:{
  label:'Waiting for approval',description:'An inspection was submitted but has not been approved.',
  next:'Ask a different authorized manager to review',tone:'warning',
 },
 approved_current:{
  label:'Approved inspection',description:'Current inspection is approved; availability is still separate.',
  next:'Recheck when the guest actually arrives',tone:'good',
 },
 blocked_or_stale:{
  label:'Blocked or outdated',description:'An operational restriction or newer work requires review.',
  next:'Resolve blockers and re-inspect as needed',tone:'blocked',
 },
};
const arrivalMeaning:Record<ArrivalRisk,{label:string;next:string;tone:string}>={
 unassigned_room:{label:'Room not assigned',next:'Assign a room before starting check-in',tone:'warning'},
 room_record_missing:{label:'Room record needs review',next:'Check the assigned room record',tone:'blocked'},
 inspection_or_blocker:{label:'Room needs attention',next:'Review inspection and active room restrictions',tone:'warning'},
 no_current_readiness_issue:{label:'No current readiness issue',next:'Recheck at arrival; verify guest and stay',tone:'good'},
};
const blockerLabels:Record<string,string>={
 activeInventoryBlockToday:'Inventory block today',
 activeRoomImpactMaintenance:'Open room-impacting maintenance',
 latestTurnoverIncomplete:'Checkout cleaning unfinished',
 newTurnoverSinceInspection:'New checkout turnover since inspection',
 unfinishedHousekeeping:'Housekeeping still open',
 newRoomWorkSinceInspection:'New room work since inspection',
};
const listBlockers=(room:DashboardRoom)=>Object.entries(room.blockers)
 .filter(([,active])=>active).map(([name])=>blockerLabels[name]??name);
const perArrivalPage=8;

export function ReadinessDashboardPanel({onFindRoom}:{onFindRoom?:(roomNumber:string)=>void}){
 const {hotelId}=useHotelAuth();
 const [days,setDays]=useState(7);
 const [page,setPage]=useState(1);
 const [arrivalPage,setArrivalPage]=useState(1);
 const [arrivalView,setArrivalView]=useState<ArrivalView>('attention');
 const [roomView,setRoomView]=useState<RoomView>('action');
 const query=useReadinessDashboard(days,page);
 const data=query.isSuccess?query.data.data:undefined;
 const meta=query.isSuccess?query.data.meta:undefined;
 const flagged=data?.arrivals.filter(a=>a.risk!=='no_current_readiness_issue').length??0;
 const arrivals=useMemo(()=>data?.arrivals.filter(a=>
  arrivalView==='all'||a.risk!=='no_current_readiness_issue')??[],[data,arrivalView]);
 const arrivalPages=Math.ceil(arrivals.length/perArrivalPage);
 const safeArrivalPage=Math.min(arrivalPage,Math.max(1,arrivalPages));
 const visibleArrivals=arrivals.slice((safeArrivalPage-1)*perArrivalPage,safeArrivalPage*perArrivalPage);
 const rooms=useMemo(()=>data?.rooms.filter(room=>
  roomView==='all'||(roomView==='approved'?room.status==='approved_current':room.status!=='approved_current'))??[],[data,roomView]);
 useEffect(()=>{setPage(1);setArrivalPage(1);setRoomView('action');setArrivalView('attention');},[hotelId]);
 useEffect(()=>setArrivalPage(1),[days,arrivalView]);
 if(!hotelId)return null;
 return <div className="readiness-hub">
  <div className="rh-header">
   <div><span className="rr-eyebrow">FRONT DESK · READINESS</span>
    <h3>What needs attention?</h3>
    <p>Start with upcoming arrivals, then check the rooms waiting for inspection or clearance.</p></div>
   <div className="rh-header-controls">
    <label>Arrival period
     <select aria-label="Upcoming arrival period" value={days}
      onChange={event=>{setDays(Number(event.target.value));setPage(1);setArrivalPage(1);}}>
      <option value={3}>Next 3 days</option><option value={7}>Next 7 days</option><option value={14}>Next 14 days</option>
     </select>
    </label>
    <button type="button" className="rr-secondary-action" disabled={query.isFetching}
     onClick={()=>void query.refetch()}><RefreshCw size={16}/>{query.isFetching?'Refreshing…':'Refresh report'}</button>
   </div>
  </div>
  <QueryFeedback loading={query.isPending} error={query.error} onRetry={()=>void query.refetch()}/>
  {data&&meta&&<>
   <div className="rh-snapshot" role="status">
    <Clock3 size={16}/><span>Report as of <strong>{dateLabel(data.asOfHotelDate)}</strong></span>
    <span>Arrival window: {dateLabel(data.asOfHotelDate)} – {dateLabel(new Date(Date.parse(data.arrivalWindowEndExclusive+'T00:00:00Z')-86400000).toISOString().slice(0,10))}</span>
    <span>Check-in inspection gate: <strong>{data.enforceAtCheckIn?'Enforced':'Not enforced'}</strong></span>
   </div>

   <div className="rh-overview" aria-label="Hotel-wide readiness summary">
    <div className="rh-overview-card rh-attention">
     <AlertTriangle size={20}/><span>Arrivals to review</span>
     <strong>{flagged}</strong><small>Of {meta.arrivalTotal} upcoming confirmed reservations</small>
    </div>
    <div className="rh-overview-card">
     <ClipboardCheck size={20}/><span>Rooms needing inspection</span>
     <strong>{data.summary.needsInspection}</strong><small>Across the whole hotel</small>
    </div>
    <div className="rh-overview-card">
     <Clock3 size={20}/><span>Awaiting approval</span>
     <strong>{data.summary.awaitingReview}</strong><small>Inspections pending review</small>
    </div>
    <div className="rh-overview-card rh-blocked">
     <ShieldAlert size={20}/><span>Blocked / outdated</span>
     <strong>{data.summary.blockedOrStale}</strong><small>Rooms with readiness issues</small>
    </div>
   </div>

   <section className="rh-section" aria-labelledby="rh-arrival-heading">
    <div className="rh-section-head">
     <div className="rh-section-number"><CalendarDays size={20}/></div>
     <div className="rh-section-copy"><span className="rr-eyebrow">STEP 1 · UPCOMING GUESTS</span>
      <h3 id="rh-arrival-heading">Arrivals that may need action</h3>
      <p>Resolve room assignment and inspection issues before guests reach reception.</p></div>
     <div className="rh-segment" role="group" aria-label="Filter arriving reservations">
      <button type="button" aria-pressed={arrivalView==='attention'} className={arrivalView==='attention'?'active':''}
       onClick={()=>setArrivalView('attention')}>Needs action ({flagged})</button>
      <button type="button" aria-pressed={arrivalView==='all'} className={arrivalView==='all'?'active':''}
       onClick={()=>setArrivalView('all')}>All ({meta.arrivalTotal})</button>
     </div>
    </div>
    <div className="rh-list" aria-live="polite">
     {visibleArrivals.map(arrival=>{
      const meaning=arrivalMeaning[arrival.risk];
      return <article className="rh-arrival-row" key={arrival.bookingId}>
       <div className="rh-row-identity">
        <span className="rh-row-icon"><CalendarDays size={18}/></span>
        <div><strong>{arrival.reference}</strong><small>Arrives {dateLabel(arrival.checkIn)} · Departs {dateLabel(arrival.checkOut)}</small></div>
       </div>
       <div className="rh-row-room"><small>Assigned room</small>
        <strong>{arrival.roomNumber?'Room '+arrival.roomNumber:'Not assigned'}</strong></div>
       <div className="rh-row-decision">
        <span className={'rh-state rh-'+meaning.tone}>
         {meaning.tone==='good'?<CheckCircle2 size={14}/>:<AlertTriangle size={14}/>}
         {meaning.label}</span>
        <small>{meaning.next}</small>
       </div>
       <Link className="rh-row-link" to="/reservations" search={{booking:arrival.bookingId}}
        aria-label={'Review reservation '+arrival.reference}>Review booking <ArrowRight size={16}/></Link>
      </article>;
     })}
     {arrivals.length===0&&<div className="rh-empty">
      <CheckCircle2 size={23}/><strong>{arrivalView==='attention'?'No current arrival exceptions':'No confirmed arrivals in this period'}</strong>
      <p>{arrivalView==='attention'
       ?'No readiness issues are flagged in this report. Room conditions can still change before check-in.'
       :'Try extending the arrival period to see more bookings.'}</p></div>}
    </div>
    {arrivalPages>1&&<div className="rh-pagination">
     <span>Showing {Math.min((safeArrivalPage-1)*perArrivalPage+1,arrivals.length)}–{Math.min(safeArrivalPage*perArrivalPage,arrivals.length)} of {arrivals.length}</span>
     <div><button type="button" className="btn-inline" disabled={safeArrivalPage<=1}
      onClick={()=>setArrivalPage(v=>v-1)}><ChevronLeft size={15}/> Previous</button>
      <button type="button" className="btn-inline" disabled={safeArrivalPage>=arrivalPages}
       onClick={()=>setArrivalPage(v=>v+1)}>Next <ChevronRight size={15}/></button></div>
    </div>}
   </section>

   <section className="rh-section" aria-labelledby="rh-room-heading">
    <div className="rh-section-head">
     <div className="rh-section-number"><BedDouble size={20}/></div>
     <div className="rh-section-copy"><span className="rr-eyebrow">STEP 2 · ROOM INSPECTIONS</span>
      <h3 id="rh-room-heading">Rooms to inspect or clear</h3>
      <p>Hotel-wide totals below; individual room cards show only the current report page.</p></div>
    </div>
    <div className="rh-room-summary" aria-label="Hotel-wide inspection summary">
     <div><strong>{data.summary.totalRooms}</strong><small>Total registered rooms</small></div>
     <div><strong>{data.summary.approvedCurrent}</strong><small>Approved inspections</small></div>
     <div><strong>{data.summary.needsInspection+data.summary.awaitingReview+data.summary.blockedOrStale}</strong><small>Need attention</small></div>
    </div>
    <div className="rh-room-controls">
     <div className="rh-segment" role="group" aria-label="Filter room inspections">
      <button type="button" aria-pressed={roomView==='action'} className={roomView==='action'?'active':''}
       onClick={()=>setRoomView('action')}>Needs action</button>
      <button type="button" aria-pressed={roomView==='all'} className={roomView==='all'?'active':''}
       onClick={()=>setRoomView('all')}>All rooms</button>
      <button type="button" aria-pressed={roomView==='approved'} className={roomView==='approved'?'active':''}
       onClick={()=>setRoomView('approved')}>Approved</button>
     </div>
     <span>Room page {meta.roomPage} of {Math.max(1,meta.roomTotalPages)} · {meta.roomPerPage} per page</span>
    </div>
    <div className="rh-room-grid">
     {rooms.map(room=>{
      const meaning=roomMeaning[room.status];
      const blockers=listBlockers(room);
      return <article className="rh-room-card" key={room.roomId}>
       <div className="rh-room-head">
        <span className="rh-room-emblem"><BedDouble size={20}/></span>
        <div><strong>Room {room.roomNumber}</strong><small>Room inspection status</small></div>
        <span className={'rh-state rh-'+meaning.tone}>{meaning.label}</span>
       </div>
       <p>{meaning.description}</p>
       {blockers.length>0&&<div className="rh-blockers">
        <strong><AlertTriangle size={15}/> What is blocking it?</strong>
        <ul>{blockers.map(blocker=><li key={blocker}>{blocker}</li>)}</ul>
       </div>}
       <div className="rh-next-step"><small>Recommended next step</small><strong>{meaning.next}</strong></div>
       {onFindRoom&&<button type="button" className="rh-room-action" onClick={()=>onFindRoom(room.roomNumber)}>
        Find room in inventory <ArrowRight size={16}/></button>}
      </article>;
     })}
    </div>
    {rooms.length===0&&<div className="rh-empty">
     <ShieldCheck size={22}/><strong>No rooms matching this view on the current report page</strong>
     <p>Try All rooms or browse the next report page. The hotel-wide totals above may still include rooms needing attention.</p>
     <button type="button" className="btn-inline" onClick={()=>setRoomView('all')}>Show all rooms</button>
    </div>}
    {meta.roomTotalPages>1&&<div className="rh-pagination">
     <span>Room page {meta.roomPage} of {meta.roomTotalPages}</span>
     <div><button type="button" className="btn-inline" disabled={page<=1}
      onClick={()=>setPage(p=>p-1)}><ChevronLeft size={15}/> Previous rooms</button>
      <button type="button" className="btn-inline" disabled={page>=meta.roomTotalPages}
       onClick={()=>setPage(p=>p+1)}>Next rooms <ChevronRight size={15}/></button></div>
    </div>}
   </section>
   <div className="rh-caution"><Info size={18}/><div><strong>How to interpret these statuses</strong>
    <p>This report is a point-in-time snapshot. An approved inspection does not reserve the room, establish physical occupancy, or verify guest identity and payment. Laravel rechecks the inspection gate when enabled at check-in.</p></div></div>
  </>}
 </div>;
}
