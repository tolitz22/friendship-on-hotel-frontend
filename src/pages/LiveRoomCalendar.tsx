import {useEffect,useMemo,useRef,useState} from 'react';
import type {CSSProperties} from 'react';
import {createPortal} from 'react-dom';
import {Link} from '@tanstack/react-router';
import {useQueryClient} from '@tanstack/react-query';
import {CalendarDays,ChevronLeft,ChevronRight,RotateCw,Search,X,ArrowUpRight,Info,BedDouble,AlertTriangle} from 'lucide-react';
import {useRoomCalendar,type RoomCalendarData} from '../api/liveRoomCalendar';
import {useLiveReservationDetail} from '../api/liveReservations';
import {useLiveFolioLedger} from '../api/liveFinance';
import {useLiveRoomTypes,useLiveProperty} from '../api/liveCatalogQueries';
import {addDays,hotelToday} from '../features/reservations/calendarDate';
import {roomHasConflict,validRoomStay} from '../features/reservations/roomCalendarRange';
import {projectRackBars} from '../features/reservations/roomRackLayout';
import {Heading} from '../components/ui';
import {QueryFeedback} from '../components/QueryFeedback';
import {useHotelAuth} from '../components/AuthProvider';

type Mode='week'|'month';
type Selection={room:RoomCalendarData['rooms'][number];day:string;bookingId?:string};
type RackEntry={
 id:string;roomId:string;checkIn:string;checkOut:string;
 kind:'booking'|'block';reference:string;status?:string|null;
 guestName?:string|null;reason?:string;
};
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
 const property=useLiveProperty();
 const today=hotelToday(new Date(),property.data?.data.timeZone??'Asia/Manila');
 const [page,setPage]=useState(1);
 const [floor,setFloor]=useState('all');
 const [roomTypeId,setRoomTypeId]=useState('');
 const [search,setSearch]=useState('');
 const [selected,setSelected]=useState<Selection|null>(null);
 const [departure,setDeparture]=useState('');
 const [dragPreview,setDragPreview]=useState<{roomId:string;start:string;end:string}|null>(null);
 const dragOrigin=useRef<{roomId:string;day:string}|null>(null);
 const suppressNextClick=useRef(false);
 const client=useQueryClient();
 const closeRef=useRef<HTMLButtonElement>(null);
 const lastTriggerRef=useRef<HTMLButtonElement|null>(null);

 const dates=useMemo(()=>period(anchor,mode),[anchor,mode]);
 const openCell=(room:Selection['room'],day:string,end?:string,bookingId?:string)=>{
  setSelected({room,day,bookingId});setDeparture(end??addDays(day,1));
 };
 const roomTypes=useLiveRoomTypes();
 const calendar=useRoomCalendar({start:dates.start,end:dates.end,page,floor,roomTypeId,search});
 const hasFilters=floor!=='all'||roomTypeId!==''||search.trim().length>0;
 const clearFilters=()=>{setFloor('all');setRoomTypeId('');setSearch('');setPage(1);};
 useEffect(()=>{setPage(1);setFloor('all');setRoomTypeId('');setSearch('');setSelected(null);},[hotelId]);
 useEffect(()=>{setAnchor(today);},[hotelId,property.data?.data.timeZone]);
 useEffect(()=>{setSelected(null);setDragPreview(null);dragOrigin.current=null;},[mode,anchor,page,floor,roomTypeId,search]);
 useEffect(()=>{
  if(!selected)return;
  const originalOverflow=document.body.style.overflow;
  document.body.style.overflow='hidden';
  closeRef.current?.focus();
  const close=(event:KeyboardEvent)=>{
   if(event.key==='Escape'){event.preventDefault();setSelected(null);}
   if(event.key==='Tab'){
    const root=document.getElementById('lrc-room-dialog');
    if(!root)return;
    const focusable=Array.from(root.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input:not([disabled]), select:not([disabled])'));
    if(!focusable.length)return;
    const first=focusable[0],last=focusable[focusable.length-1];
    if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
    else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
   }
  };
  window.addEventListener('keydown',close);
  return ()=>{
   document.body.style.overflow=originalOverflow;
   window.removeEventListener('keydown',close);
   lastTriggerRef.current?.focus();
  };
 },[selected]);
 const data=calendar.data?.data;
 const selectedBookings=selected&&data?data.bookings.filter(b=>b.roomId===selected.room.id
  &&(selected.bookingId?b.id===selected.bookingId:b.checkIn<=selected.day&&selected.day<b.checkOut)):[];
 const activeBooking=selected?.bookingId&&data
  ?data.bookings.find(b=>b.id===selected.bookingId&&b.roomId===selected.room.id):undefined;
 const selectedBlocks=selected&&data?data.blocks.filter(b=>b.roomId===selected.room.id
  &&(activeBooking?b.checkIn<activeBooking.checkOut&&b.checkOut>activeBooking.checkIn
   :b.checkIn<=selected.day&&selected.day<b.checkOut)):[];
 const overlappingBookings=activeBooking&&data?data.bookings.filter(b=>
  b.roomId===activeBooking.roomId&&b.id!==activeBooking.id
  &&b.checkIn<activeBooking.checkOut&&b.checkOut>activeBooking.checkIn):[];
 const reservation=useLiveReservationDetail(selectedBookings.length===1?selectedBookings[0].id:null);
 const folio=useLiveFolioLedger(selectedBookings.length===1?selectedBookings[0].id:'');
 const meta=calendar.data?.meta;
 const rangeValid=!!selected&&validRoomStay(selected.day,departure);
 const rangeConflict=!!selected&&rangeValid&&!!data&&roomHasConflict(
  selected.room.id,selected.day,departure,data.bookings,data.blocks
 );
 const extendsOutsideVisible=!!selected&&departure>dates.end;
 const canStartBooking=!!selected&&selected.day>=today&&rangeValid&&!rangeConflict;
 const periodLabel=mode==='week'
  ?dayText(dates.start,{month:'short',day:'numeric',year:'numeric'})+' – '+dayText(shift(dates.end,-1),{month:'short',day:'numeric',year:'numeric'})
  :dayText(dates.start,{month:'long',year:'numeric'});
 return <>
  <Heading title="Room rack" description="Follow reservations across nights. Select a bar for details or an empty date to start a booking."/>
  <section className="live-room-calendar" aria-label="Room inventory calendar">
   <div className="lrc-toolbar">
    <div className="lrc-navigation">
     <button type="button" className="btn-inline" onClick={()=>setAnchor(today)}>Today</button>
     <button type="button" className="btn-inline" aria-label="Previous period" onClick={()=>setAnchor(d=>navigate(d,mode,-1))}><ChevronLeft size={16}/></button>
     <button type="button" className="btn-inline" aria-label="Next period" onClick={()=>setAnchor(d=>navigate(d,mode,1))}><ChevronRight size={16}/></button>
     <strong aria-live="polite">{periodLabel}</strong>
    </div>
    <div className="lrc-period-controls">
     <label className="lrc-jump-date">Jump to date <input type="date" aria-label="Jump to calendar date"
      value={anchor} onChange={e=>{if(e.target.value)setAnchor(e.target.value);}}/></label>
     <div className="view-switch" role="group" aria-label="Calendar period">
     <button type="button" aria-pressed={mode==='week'} className={mode==='week'?'selected':''} onClick={()=>{setMode('week');setPage(1);}}>Week</button>
     <button type="button" aria-pressed={mode==='month'} className={mode==='month'?'selected':''} onClick={()=>{setMode('month');setPage(1);}}>Month</button>
     </div>
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
    {hasFilters&&<button type="button" className="btn-inline lrc-clear-filters" onClick={clearFilters}><X size={14}/> Clear filters</button>}
    <button type="button" className="btn-inline" disabled={calendar.isFetching} onClick={()=>void Promise.all([calendar.refetch(),client.invalidateQueries({queryKey:['live','reservation-detail',hotelId]})])}><RotateCw size={14}/> {calendar.isFetching?'Refreshing…':'Refresh'}</button>
   </div>
   <div className="lrc-legend">
    <span><i className="lrc-dot lrc-confirmed"/> Reserved</span>
    <span><i className="lrc-dot lrc-inhouse"/> In house</span>
    <span><i className="lrc-dot lrc-maintenance"/> Maintenance block</span>
    <span><i className="lrc-dot lrc-conflict"/> Overlap / inspect</span>
    <span><i className="lrc-dot lrc-free"/> No assigned booking</span>
    <span>Tip: drag across open dates to select a stay</span>
   </div>
   {calendar.isSuccess&&data&&<div className="lrc-operations-summary" aria-label="Room schedule overview">
    <div><small>Rooms on this page</small><strong>{data.rooms.length}</strong></div>
    <div><small>Assigned reservations in period</small><strong>{data.bookings.length}</strong></div>
    <div><small>In-house reservations</small><strong>{data.bookings.filter(b=>b.status==='checked_in').length}</strong></div>
    <div><small>Maintenance blocks</small><strong>{data.blocks.length}</strong></div>
    <div className={data.unassignedBookings?'lrc-unassigned-attention':''}>
     <small>Unassigned reservations</small><strong>{data.unassignedBookings}</strong>
     {data.unassignedBookings>0&&<Link to="/reservations">Review bookings <ArrowUpRight size={13}/></Link>}
    </div>
   </div>}
   {calendar.isSuccess&&data&&<p className="lrc-summary">Showing {data.rooms.length} of {meta?.total??0} registered rooms. Counts for assigned stays and maintenance are limited to the visible room page; unassigned reservations are counted hotel-wide for the selected dates.</p>}
   <QueryFeedback loading={calendar.isPending} error={calendar.error} onRetry={()=>void calendar.refetch()}
    empty={calendar.isSuccess&&data?.rooms.length===0} emptyMessage={hasFilters?'No rooms match these filters. Clear filters to show the full rack.':'No rooms are registered yet. Add rooms in Rooms & readiness.'}/>
   {calendar.isSuccess&&data?.rooms.length===0&&hasFilters&&<div className="lrc-empty-action"><button type="button" className="btn-inline" onClick={clearFilters}>Clear filters</button></div>}
   {calendar.isSuccess&&data&&data.rooms.length>0&&<p className="lrc-scroll-hint"><Info size={14}/> Scroll horizontally to see more dates. Room labels and dates stay visible while browsing.</p>}
   {calendar.isSuccess&&data&&data.rooms.length>0&&<div className="lrc-scroll rack-scroll" role="region" aria-label="Scrollable room rack" tabIndex={0}>
    <div className={'rack-timeline '+(mode==='month'?'rack-month':'rack-week')}
     style={{'--rack-days':dates.days.length,'--rack-day-width':mode==='week'?'116px':'49px'} as CSSProperties}>
     <div className="rack-header">
      <div className="rack-room-head rack-sticky">Room / type</div>
      {dates.days.map(day=><div key={day}
       className={'rack-date-head '+(day===today?'rack-today':'')+(parse(day).getUTCDay()===0||parse(day).getUTCDay()===6?' rack-weekend':'')}>
       <strong>{dayText(day,{day:'numeric'})}</strong>
       <small>{dayText(day,{weekday:'short'})}</small>
      </div>)}
     </div>
     {data.rooms.map(room=>{
      const entries:RackEntry[]=[
       ...data.bookings.filter(b=>b.roomId===room.id).map(b=>({
        ...b,id:'b-'+b.id,kind:'booking' as const,
       })),
       ...data.blocks.filter(b=>b.roomId===room.id).map(b=>({
        ...b,id:'m-'+b.id,kind:'block' as const,reference:b.reason,
       })),
      ];
      const bars=projectRackBars(entries,{start:dates.start,end:dates.end});
      const rowHeight=Math.max(60,12+(Math.max(0,...bars.map(b=>b.lane))+1)*33);
      return <div className="rack-room-row" key={room.id} aria-label={'Room '+room.number}>
       <div className="rack-room-name rack-sticky" style={{gridColumn:1,gridRow:1,minHeight:rowHeight}}>
        <strong>Room {room.number}</strong>
        <small>{room.roomTypeName}{room.floor===null?'':' · Floor '+room.floor}</small>
       </div>
       {dates.days.map((day,index)=>{
        const items=data.bookings.filter(b=>b.roomId===room.id&&b.checkIn<=day&&day<b.checkOut);
        const blocks=data.blocks.filter(b=>b.roomId===room.id&&b.checkIn<=day&&day<b.checkOut);
        const occupied=items.length>0||blocks.length>0;
        const highlighted=dragPreview?.roomId===room.id&&day>=dragPreview.start&&day<=dragPreview.end;
        return <button key={day} type="button"
         className={'rack-day '+(day===today?'rack-current-day ':'')+(highlighted?'rack-range-preview ':'')+(occupied?'rack-occupied':'rack-empty')}
         style={{gridColumn:index+2,gridRow:1,minHeight:rowHeight}}
         title={occupied?'View room '+room.number+' schedule on '+day:'Choose room '+room.number+' on '+day}
         aria-label={'Room '+room.number+' on '+day+': '+(occupied?'assigned booking or maintenance block':'no assigned booking')+'. View details'}
         onPointerDown={event=>{
          if(event.pointerType==='mouse'&&event.button===0&&day>=today&&!occupied){
           dragOrigin.current={roomId:room.id,day};setDragPreview({roomId:room.id,start:day,end:day});
          }
         }}
         onPointerEnter={event=>{
          const origin=dragOrigin.current;
          if(event.pointerType==='mouse'&&(event.buttons&1)&&origin?.roomId===room.id&&day>=origin.day){
           setDragPreview({roomId:room.id,start:origin.day,end:day});
          }
         }}
         onPointerUp={event=>{
          const origin=dragOrigin.current;
          dragOrigin.current=null;
          const through=dragPreview?.roomId===room.id?dragPreview.end:day;
          setDragPreview(null);
          if(origin?.roomId===room.id&&through>origin.day){
           suppressNextClick.current=true;lastTriggerRef.current=event.currentTarget;
           openCell(room,origin.day,addDays(through,1));
          }
         }}
         onPointerCancel={()=>{dragOrigin.current=null;setDragPreview(null);}}
         onClick={event=>{
          if(suppressNextClick.current){suppressNextClick.current=false;return;}
          lastTriggerRef.current=event.currentTarget;openCell(room,day);
         }}>
         {!occupied&&<span aria-hidden="true">+</span>}
        </button>;
       })}
       {bars.map(bar=>{
        const booking=bar.item.kind==='booking';
        const label=booking?(bar.item.guestName||bar.item.reference):(bar.item.reason||'Maintenance');
        const visibleDay=bar.item.checkIn<dates.start?dates.start:bar.item.checkIn;
        return <button type="button" key={bar.item.id}
         className={'rack-booking-bar '+(booking?(bar.item.status==='checked_in'?'rack-bar-inhouse':'rack-bar-reserved'):'rack-bar-block')+(bar.overlap?' rack-bar-conflict':'')}
         style={{gridColumn:bar.startColumn+' / span '+bar.span,gridRow:1,alignSelf:'start',marginTop:7+bar.lane*33}}
         title={label+' · '+bar.item.checkIn+' to '+bar.item.checkOut+(bar.overlap?' · Overlapping records!':'')}
         aria-label={(booking?'Open booking ':'Inspect maintenance ')+label+' in room '+room.number+' from '+bar.item.checkIn+' to '+bar.item.checkOut}
         onClick={event=>{
          lastTriggerRef.current=event.currentTarget;
          openCell(room,visibleDay,undefined,booking?bar.item.id.slice(2):undefined);
         }}>
         <span className="rack-bar-label">{bar.clippedStart?'‹ ':''}{label}{bar.clippedEnd?' ›':''}</span>
         {bar.overlap&&<span className="rack-bar-warning" aria-label="Overlapping records">!</span>}
        </button>;
       })}
      </div>;
     })}
    </div>
   </div>}
   {calendar.isSuccess&&meta&&meta.totalPages>1&&<div className="lrc-pagination">
    <span>Rooms page {meta.page} of {meta.totalPages}</span>
    <button className="btn-inline" disabled={page<=1} onClick={()=>setPage(p=>p-1)}>Previous rooms</button>
    <button className="btn-inline" disabled={page>=meta.totalPages} onClick={()=>setPage(p=>p+1)}>Next rooms</button>
   </div>}
   <p className="lrc-note"><CalendarDays size={14}/> Click a reservation bar to open the booking drawer. Drag across empty dates for a multi-night stay. Read-only schedule of assigned reservations and maintenance blocks. Checkout dates are exclusive. Empty cells do not prove room readiness, physical occupancy, or sellable availability. Use Reservations for booking changes and Rooms & readiness for inspections.</p>
  </section>
   {selected&&createPortal(
    <div className="lrc-modal-backdrop" style={{position:'fixed',inset:0,zIndex:9999,background:'rgba(8,12,22,.76)',display:'flex',alignItems:'stretch',justifyContent:'flex-end',padding:0,backdropFilter:'blur(3px)'}}
     role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget)setSelected(null);}}>
     <section id="lrc-room-dialog" className="lrc-modal" role="dialog" aria-modal="true"
      aria-labelledby="lrc-details-title" aria-describedby="lrc-details-context"
      style={{width:'min(100%,460px)',height:'100%',maxHeight:'100vh',overflowY:'auto',borderRadius:0,background:'var(--surface)',color:'var(--text)',border:'1px solid var(--border)',boxShadow:'0 24px 70px rgba(0,0,0,.42)'}}>
      <header className="lrc-modal-header" style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:15,padding:'22px 24px 18px',borderBottom:'1px solid var(--border)'}}>
       <div>
        <span className="lrc-modal-eyebrow">ROOM SCHEDULE · {selected.day}</span>
        <h2 id="lrc-details-title" style={{fontSize:24,margin:'6px 0'}}>Room {selected.room.number}</h2>
        <p id="lrc-details-context" style={{fontSize:12,margin:0,color:'var(--muted)',lineHeight:1.6}}>
         {selected.room.roomTypeName}{selected.room.floor===null?'':' · Floor '+selected.room.floor}<br/>
         {dayText(selected.day,{weekday:'long',month:'long',day:'numeric',year:'numeric'})}
        </p>
       </div>
       <button ref={closeRef} type="button" className="btn-inline lrc-modal-close"
        aria-label="Close room details" onClick={()=>setSelected(null)}><X size={18}/></button>
      </header>
      <div className="lrc-modal-body" style={{display:'grid',gap:16,padding:'20px 24px'}}>
       {selectedBookings.length===0&&selectedBlocks.length===0&&<div className="lrc-modal-state">
        <BedDouble size={22}/><div><strong>No assigned booking</strong>
         <p>This room has no recorded assignment for this date. Check housekeeping readiness and availability before accepting a guest.</p>
        </div>
       </div>}
       {selectedBookings.length>0&&<div className="lrc-modal-section">
        <h3>Reservations ({selectedBookings.length})</h3>
        {selectedBookings.map(booking=><div key={booking.id} className="lrc-modal-booking">
         <div className="lrc-modal-line"><strong>{booking.guestName??booking.reference}</strong>
          <span>{booking.status?.replaceAll('_',' ')??'Status unknown'}</span>
         </div>
         {booking.guestName&&<p className="lrc-modal-guest-ref">Booking: {booking.reference}</p>}
         <p><strong>Arrival:</strong> {dayText(booking.checkIn,{month:'short',day:'numeric',year:'numeric'})}</p>
         <p><strong>Departure:</strong> {dayText(booking.checkOut,{month:'short',day:'numeric',year:'numeric'})}</p>
         <p><strong>Stay:</strong> {(Date.parse(booking.checkOut+'T00:00:00Z')-Date.parse(booking.checkIn+'T00:00:00Z'))/86400000} night(s)</p>
         <div className="lrc-booking-actions">
          <Link to="/reservations" search={{booking:booking.id}} className="lrc-modal-action" onClick={()=>setSelected(null)}>
           Manage booking <ArrowUpRight size={15}/>
          </Link>
          <Link to="/billing" search={{booking:booking.id}} className="lrc-modal-action" onClick={()=>setSelected(null)}>
           View folio <ArrowUpRight size={15}/>
          </Link>
         </div>
        </div>)}
        {selectedBookings.length===1&&<div className="lrc-modal-extra" aria-live="polite">
         {reservation.isPending&&<p>Refreshing reservation status…</p>}
         {reservation.isError&&<p>Current status could not be verified. Open the reservation for the latest details.</p>}
         {reservation.data&&<p>Verified status: <strong>{reservation.data.lifecycleState?.replaceAll('_',' ')??'Unknown'}</strong> · Room {selected.room.number}</p>}
        </div>}
        {selectedBookings.length===1&&folio.isSuccess&&<div className="lrc-folio-preview">
         <strong>Recorded folio snapshot</strong>
         <div><span>Staff-confirmed payment evidence</span>
          <b>{new Intl.NumberFormat('en-PH',{style:'currency',currency:folio.data.data.summary.currency}).format(folio.data.data.summary.staffConfirmedPaymentsMinor/100)}</b></div>
         <div><span>Pending payment evidence</span>
          <b>{new Intl.NumberFormat('en-PH',{style:'currency',currency:folio.data.data.summary.currency}).format(folio.data.data.summary.pendingReviewPaymentsMinor/100)}</b></div>
         <p>This is not a final bill, a settled balance, or independently verified cash. Review the folio for details.</p>
        </div>}
        {selectedBookings.length===1&&folio.isError&&<p className="lrc-modal-extra">No priced folio preview available for this reservation. Use View folio to investigate.</p>}
       </div>}
       {selectedBlocks.length>0&&<div className="lrc-modal-section">
        <h3>Room blocks ({selectedBlocks.length})</h3>
        {selectedBlocks.map(block=><div className="lrc-modal-block" key={block.id}>
         <strong>{block.reason}</strong>
         <p>{dayText(block.checkIn,{month:'short',day:'numeric'})} – {dayText(block.checkOut,{month:'short',day:'numeric'})}</p>
        </div>)}
       </div>}
       {(selectedBookings.length+selectedBlocks.length>1||overlappingBookings.length>0)&&
        <div className="lrc-modal-warning" role="alert"><AlertTriangle size={17}/>
         <div>Overlapping booking or maintenance records detected. Review before changing inventory.
          {overlappingBookings.map(b=><p key={b.id}>{b.reference}: {b.checkIn} – {b.checkOut}</p>)}
         </div>
        </div>}
       {selected.day>=today&&selectedBookings.length===0&&selectedBlocks.length===0&&<div className="lrc-stay-picker">
        <label htmlFor="room-departure">Check-out date</label>
        <input id="room-departure" type="date" value={departure}
         min={addDays(selected.day,1)} max={addDays(selected.day,31)}
         onChange={event=>setDeparture(event.target.value)}/>
        <small>{rangeValid?(Date.parse(departure+'T00:00:00Z')-Date.parse(selected.day+'T00:00:00Z'))/86400000+' night(s)':'Choose 1–31 nights after arrival'}</small>
        {rangeConflict&&<p role="alert" className="lrc-modal-warning">This room already has a booking or maintenance block overlapping your chosen dates. Choose another range.</p>}
        {extendsOutsideVisible&&<p className="help-copy">Part of this stay is outside the displayed calendar. Final availability must be checked when booking.</p>}
       </div>}
       {canStartBooking&&<div className="lrc-modal-tip">
        <CalendarDays size={18}/><div><strong>Start a reservation for this date</strong>
         <p>We'll carry this room and check-in date to the booking form. You'll choose a guest and rate before confirming.</p>
        </div>
       </div>}
       {selectedBookings.length===0&&selectedBlocks.length===0&&selected.day<today&&
        <p className="lrc-modal-warning">This date has passed. Select today or a future night to create a booking.</p>}
       <p className="lrc-modal-hint"><Info size={16}/> The schedule is informational. Empty cells do not guarantee a room is clean, unoccupied, or sellable.</p>
      </div>
      <footer className="lrc-modal-footer" style={{display:'flex',justifyContent:'flex-end',alignItems:'center',gap:10,padding:'16px 24px',borderTop:'1px solid var(--border)',flexWrap:'wrap'}}>
       <button type="button" className="btn-inline" onClick={()=>setSelected(null)}>Close</button>
       {canStartBooking
        ?<Link to="/reservations" search={{room:selected.room.id,roomNumber:selected.room.number,checkIn:selected.day,checkOut:departure}}
           className="btn-primary" onClick={()=>setSelected(null)}>Create reservation <ArrowUpRight size={16}/></Link>
        :<Link to="/reservations" className="btn-primary" onClick={()=>setSelected(null)}>View reservations <ArrowUpRight size={16}/></Link>}
      </footer>
     </section>
    </div>,document.body)}

 </>;
}
