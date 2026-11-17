import {useEffect,useMemo,useState} from 'react';
import {Link} from '@tanstack/react-router';
import {CalendarDays,ChevronLeft,ChevronRight,RotateCw,Search,X,ArrowUpRight,Info,BedDouble,AlertTriangle} from 'lucide-react';
import {useRoomCalendar,type RoomCalendarData} from '../api/liveRoomCalendar';
import {useLiveReservationDetail} from '../api/liveReservations';
import {useLiveRoomTypes} from '../api/liveCatalogQueries';
import {hotelToday} from '../features/reservations/calendarDate';
import {Heading} from '../components/ui';
import {QueryFeedback} from '../components/QueryFeedback';
import {useHotelAuth} from '../components/AuthProvider';

type Mode='week'|'month';
type Selection={room:RoomCalendarData['rooms'][number];day:string};
const parse=(day:string)=>new Date(day+'T00:00:00Z');
const format=(d:Date)=>d.toISOString().slice(0,10);
const shift=(day:string,n:number)=>{const d=parse(day);d.setUTCDate(d.getUTCDate()+n);return format(d);};
const monthStart=(day:string)=>day.slice(0,7)+'-01';
const weekStart=(day:string)=>shift(day,-parse(day).getUTCDay());
const period=(anchor:string,mode:Mode)=>{
 const start=mode==='week'?weekStart(anchor):monthStart(anchor);
 const count=mode==='week'?7:new Date(Date.UTC(Number(start.slice(0,4)),Number(start.slice(5,7)),0)).getUTCDate();
 return {start,end:shift(start,count),days:Array.from({length:count},(_,n)=>shift(start,n))};
};
const navigate=(day:string,mode:Mode,delta:number)=>{
 if(mode==='week')return shift(day,delta*7);
 const d=parse(monthStart(day));d.setUTCMonth(d.getUTCMonth()+delta);
 return format(d);
};
const dayText=(day:string,options:Intl.DateTimeFormatOptions)=>
 new Intl.DateTimeFormat('en-PH',{timeZone:'UTC',...options}).format(parse(day));

export function LiveRoomCalendar(){
 const {hotelId}=useHotelAuth();
 const [mode,setMode]=useState<Mode>('week');
 const [anchor,setAnchor]=useState(hotelToday);
 const [page,setPage]=useState(1);
 const [floor,setFloor]=useState('all');
 const [roomTypeId,setRoomTypeId]=useState('');
 const [search,setSearch]=useState('');
 const [selected,setSelected]=useState<Selection|null>(null);

 const dates=useMemo(()=>period(anchor,mode),[anchor,mode]);
 const roomTypes=useLiveRoomTypes();
 const calendar=useRoomCalendar({start:dates.start,end:dates.end,page,floor,roomTypeId,search});
 useEffect(()=>{setPage(1);setFloor('all');setRoomTypeId('');setSearch('');setSelected(null);},[hotelId]);
 useEffect(()=>{setSelected(null);},[mode,anchor,page,floor,roomTypeId,search]);
 useEffect(()=>{
  if(!selected)return;
  const close=(event:KeyboardEvent)=>{if(event.key==='Escape')setSelected(null);};
  window.addEventListener('keydown',close);
  return ()=>window.removeEventListener('keydown',close);
 },[selected]);
 const data=calendar.data?.data;
 const selectedBookings=selected&&data?data.bookings.filter(b=>b.roomId===selected.room.id&&b.checkIn<=selected.day&&selected.day<b.checkOut):[];
 const selectedBlocks=selected&&data?data.blocks.filter(b=>b.roomId===selected.room.id&&b.checkIn<=selected.day&&selected.day<b.checkOut):[];
 const reservation=useLiveReservationDetail(selectedBookings.length===1?selectedBookings[0].id:null);
 const meta=calendar.data?.meta;
 const periodLabel=mode==='week'
  ?dayText(dates.start,{month:'short',day:'numeric',year:'numeric'})+' – '+dayText(shift(dates.end,-1),{month:'short',day:'numeric',year:'numeric'})
  :dayText(dates.start,{month:'long',year:'numeric'});
 return <>
  <Heading title="Room inventory calendar" description="Click any room and date to inspect bookings, maintenance blocks, or start a reservation."/>
  <section className="live-room-calendar" aria-label="Room inventory calendar">
   <div className="lrc-toolbar">
    <div className="lrc-navigation">
     <button type="button" className="btn-inline" onClick={()=>setAnchor(hotelToday())}>Today</button>
     <button type="button" className="btn-inline" aria-label="Previous period" onClick={()=>setAnchor(d=>navigate(d,mode,-1))}><ChevronLeft size={16}/></button>
     <button type="button" className="btn-inline" aria-label="Next period" onClick={()=>setAnchor(d=>navigate(d,mode,1))}><ChevronRight size={16}/></button>
     <strong>{periodLabel}</strong>
    </div>
    <div className="view-switch" role="group" aria-label="Calendar period">
     <button type="button" aria-pressed={mode==='week'} className={mode==='week'?'selected':''} onClick={()=>{setMode('week');setPage(1);}}>Week</button>
     <button type="button" aria-pressed={mode==='month'} className={mode==='month'?'selected':''} onClick={()=>{setMode('month');setPage(1);}}>Month</button>
    </div>
   </div>
   <div className="lrc-filters">
    <label>Room type
     <select value={roomTypeId} onChange={e=>{setRoomTypeId(e.target.value);setPage(1);}}>
      <option value="">All room types</option>
      {(roomTypes.data?.data??[]).map(t=><option key={t.id} value={t.id}>{t.name}</option>)}
     </select>
    </label>
    <label>Floor
     <select value={floor} onChange={e=>{setFloor(e.target.value);setPage(1);}}>
      <option value="all">All floors</option>
      {Array.from(new Set(data?.rooms.map(r=>r.floor).filter((x):x is number=>x!==null)??[]))
       .sort((a,b)=>a-b).map(n=><option key={n} value={n}>Floor {n}</option>)}
     </select>
    </label>
    <label className="lrc-search"><Search size={16}/><input aria-label="Search room number" value={search}
     onChange={e=>{setSearch(e.target.value);setPage(1);}} placeholder="Room number"/></label>
    <button type="button" className="btn-inline" onClick={()=>void calendar.refetch()}><RotateCw size={14}/> Refresh</button>
   </div>
   <div className="lrc-legend">
    <span><i className="lrc-dot lrc-confirmed"/> Reserved</span>
    <span><i className="lrc-dot lrc-inhouse"/> In house</span>
    <span><i className="lrc-dot lrc-maintenance"/> Maintenance block</span>
    <span><i className="lrc-dot lrc-conflict"/> Overlap / inspect</span>
    <span><i className="lrc-dot lrc-free"/> No assigned booking</span>
   </div>
   {data&&<p className="lrc-summary">{meta?.total??0} registered rooms · {data.unassignedBookings} unassigned booking(s) in period. Unassigned bookings do not appear on individual room rows.</p>}
   <QueryFeedback loading={calendar.isPending} error={calendar.error} onRetry={()=>void calendar.refetch()}
    empty={calendar.isSuccess&&data?.rooms.length===0} emptyMessage="No rooms match these filters. Add rooms in Rooms & readiness."/>
   {calendar.isSuccess&&data&&data.rooms.length>0&&<div className="lrc-scroll">
    <div className={'lrc-matrix '+(mode==='month'?'lrc-month':'lrc-week')}
     style={{gridTemplateColumns:'minmax(150px,180px) repeat('+dates.days.length+', minmax('+(mode==='week'?'108':'40')+'px,1fr))'}}>
     <div className="lrc-head lrc-sticky">Room</div>
     {dates.days.map(day=><div key={day} className={'lrc-head '+(day===hotelToday()?'lrc-today':'')}>
      <strong>{dayText(day,{day:'numeric'})}</strong><small>{dayText(day,{weekday:'short'})}</small>
     </div>)}
     {data.rooms.map(room=><div className="lrc-row" key={room.id}>
      <div className="lrc-room lrc-sticky"><strong>Room {room.number}</strong><small>{room.roomTypeName}{room.floor===null?'':' · F'+room.floor}</small></div>
      {dates.days.map(day=>{
       const items=data.bookings.filter(b=>b.roomId===room.id&&b.checkIn<=day&&day<b.checkOut);
       const blocks=data.blocks.filter(b=>b.roomId===room.id&&b.checkIn<=day&&day<b.checkOut);
       const conflict=items.length+blocks.length>1;
       const booking=items[0];
       const title=[
        'Room '+room.number+' · '+day,
        ...items.map(b=>b.reference+' ('+(b.status??'unknown')+') '+b.checkIn+' to '+b.checkOut),
        ...blocks.map(b=>'Maintenance: '+b.reason)
       ].join('\n');
       return <button key={day} type="button" className={'lrc-cell lrc-clickable '+(conflict?'lrc-conflict':blocks.length?'lrc-maintenance':booking?.status==='checked_in'?'lrc-inhouse':booking?'lrc-confirmed':'lrc-free')}
        title={title} aria-label={'Room '+room.number+' on '+day+': '+(conflict?'overlapping records':booking?booking.reference:blocks.length?'maintenance blocked':'no assigned booking')+'. View details'}
        onClick={()=>setSelected({room,day})}>
        <span className="lrc-cell-content">{booking?(mode==='week'?booking.reference:'●'):blocks.length?(mode==='week'?'Blocked':'×'):(mode==='week'?'+':'·')}</span>
        {conflict&&<span className="lrc-warning" aria-label="Overlapping records">!</span>}
       </button>;
      })}
     </div>)}
    </div>
   </div>}
   {meta&&meta.totalPages>1&&<div className="lrc-pagination">
    <span>Rooms page {meta.page} of {meta.totalPages}</span>
    <button className="btn-inline" disabled={page<=1} onClick={()=>setPage(p=>p-1)}>Previous rooms</button>
    <button className="btn-inline" disabled={page>=meta.totalPages} onClick={()=>setPage(p=>p+1)}>Next rooms</button>
   </div>}
   <p className="lrc-note"><CalendarDays size={14}/> Read-only schedule of assigned reservations and maintenance blocks. Checkout dates are exclusive. Empty cells do not prove room readiness, physical occupancy, or sellable availability. Use Reservations for booking changes and Rooms & readiness for inspections.</p>
  </section>
   {selected&&<div className="lrc-modal-backdrop" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)setSelected(null);}}>
    <section className="lrc-modal" role="dialog" aria-modal="true" aria-labelledby="lrc-details-title">
     <div className="lrc-modal-header">
      <div><span className="lrc-modal-eyebrow">ROOM INVENTORY</span>
       <h2 id="lrc-details-title">Room {selected.room.number}</h2>
       <p>{dayText(selected.day,{weekday:'long',month:'long',day:'numeric',year:'numeric'})} · {selected.room.roomTypeName}{selected.room.floor===null?'':' · Floor '+selected.room.floor}</p>
      </div>
      <button type="button" className="btn-inline lrc-modal-close" aria-label="Close room details" onClick={()=>setSelected(null)}><X size={18}/></button>
     </div>
     <div className="lrc-modal-body">
      {selectedBookings.length===0&&selectedBlocks.length===0&&<div className="lrc-modal-state">
       <BedDouble size={20}/><div><strong>No room assignment recorded</strong>
        <p>There is no assigned booking or active maintenance block on this date. This does not guarantee the room is clean or available for sale.</p>
       </div></div>}
      {selectedBookings.length>0&&<div className="lrc-modal-section">
       <h3>Assigned bookings ({selectedBookings.length})</h3>
       {selectedBookings.map(b=><div key={b.id} className="lrc-modal-booking">
        <div className="lrc-modal-line"><strong>{b.reference}</strong><span>{b.status?.replaceAll('_',' ')??'Status unknown'}</span></div>
        <p>Check-in: {dayText(b.checkIn,{month:'short',day:'numeric',year:'numeric'})}</p>
        <p>Check-out: {dayText(b.checkOut,{month:'short',day:'numeric',year:'numeric'})}</p>
        <Link to="/reservations" search={{booking:b.id}} className="lrc-modal-action" onClick={()=>setSelected(null)}>Open reservation <ArrowUpRight size={15}/></Link>
       </div>)}
       {selectedBookings.length===1&&<div className="lrc-modal-extra">
        {reservation.isPending&&<p>Loading reservation confirmation…</p>}
        {reservation.isError&&<p>Could not refresh reservation detail. Open the reservation to verify its current state.</p>}
        {reservation.data&&<p>Current Laravel state: <strong>{reservation.data.lifecycleState?.replaceAll('_',' ')??'Unknown'}</strong></p>}
       </div>}
      </div>}
      {selectedBlocks.length>0&&<div className="lrc-modal-section">
       <h3>Maintenance blocks ({selectedBlocks.length})</h3>
       {selectedBlocks.map(b=><div className="lrc-modal-block" key={b.id}>
        <strong>{b.reason}</strong>
        <p>{dayText(b.checkIn,{month:'short',day:'numeric'})} – {dayText(b.checkOut,{month:'short',day:'numeric'})} (checkout boundary exclusive)</p>
       </div>)}
      </div>}
      {selectedBookings.length+selectedBlocks.length>1&&<p className="lrc-modal-warning"><AlertTriangle size={17}/> Overlapping records detected. Review assignments and blocks before changing anything.</p>}
      <div className="lrc-modal-hint"><Info size={17}/><span>Booking a room requires a guest, rate and final availability validation. This calendar never reserves a room automatically.</span></div>
     </div>
     <div className="lrc-modal-footer">
      <button className="btn-inline" type="button" onClick={()=>setSelected(null)}>Close</button>
      <Link to="/reservations" className="btn-primary" onClick={()=>setSelected(null)}>Create / manage bookings <ArrowUpRight size={15}/></Link>
     </div>
    </section>
   </div>}
 </>;
}
