import {useEffect,useMemo,useRef,useState} from 'react';
import {CalendarDays,ChevronLeft,ChevronRight,Filter,Search,Info,AlertTriangle,X} from 'lucide-react';
import {useRoomTimeline} from '../../api/queries';
import type {Room,TimelineBlock} from '../../api/types';
import {QueryFeedback} from '../../components/QueryFeedback';
import {Status} from '../../components/ui';
import {addDays,dayHeading,hotelToday,startOfWeek} from '../reservations/calendarDate';
import {blocksForNight,nightLabel,roomMatches} from './timelineUtils';
import {statusLabel} from '../../lib/format';

type SelectedNight={day:string;room:Room;blocks:TimelineBlock[]};
export function RoomTimeline(){
 const [anchor,setAnchor]=useState(()=>hotelToday());
 const [span,setSpan]=useState<7|14>(7);
 const [floor,setFloor]=useState('all');
 const [roomType,setRoomType]=useState('all');
 const [search,setSearch]=useState('');
 const [selected,setSelected]=useState<SelectedNight|null>(null);
 const closeRef=useRef<HTMLButtonElement>(null);
 useEffect(()=>{
  if(!selected)return;
  const previous=document.activeElement instanceof HTMLElement?document.activeElement:null;
  closeRef.current?.focus();
  const onKeyDown=(event:KeyboardEvent)=>{
   if(event.key==='Escape')setSelected(null);
   if(event.key==='Tab'){
    const panel=document.querySelector<HTMLElement>('[data-room-night-dialog]');
    const focusables=panel?.querySelectorAll<HTMLElement>('button:not([disabled]),a[href],[tabindex]:not([tabindex="-1"])');
    if(focusables?.length){
     const first=focusables[0],last=focusables[focusables.length-1];
     if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
     else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
    }
   }
  };
  window.addEventListener('keydown',onKeyDown);
  return ()=>{window.removeEventListener('keydown',onKeyDown);previous?.focus();};
 },[selected]);
 const start=startOfWeek(anchor),end=addDays(start,span);
 const days=useMemo(()=>Array.from({length:span},(_,index)=>addDays(start,index)),[start,span]);
 const query=useRoomTimeline({from:start,to:end});
 const rooms=query.data?.data.rooms??[];
 const blocks=query.data?.data.blocks??[];
 const unassigned=query.data?.data.unassignedReservations??[];
 const types=Array.from(new Map(rooms.map(room=>[room.roomTypeId,room.roomTypeName])).entries());
 const floors=Array.from(new Set(rooms.map(room=>room.floor))).sort((a,b)=>a-b);
 const filtered=rooms.filter(room=>roomMatches(room,search,roomType,floor));
 const overlappingRooms=filtered.filter(room=>days.some(day=>nightLabel(blocksForNight(blocks,room.id,day))==='overlap')).length;
 function showRoomNight(room:Room,day:string){setSelected({room,day,blocks:blocksForNight(blocks,room.id,day)});}
 return <section className="timeline-panel" aria-label="Room inventory timeline">
  <div className="timeline-header">
   <div><h3>Physical room timeline</h3><p>Room assignments and example maintenance blocks · read-only</p></div>
   <div className="timeline-nav">
    <button className="icon-btn" aria-label="Previous period" onClick={()=>setAnchor(addDays(start,-span))}><ChevronLeft size={17}/></button>
    <button className="btn-inline" onClick={()=>setAnchor(hotelToday())}>Today</button>
    <button className="icon-btn" aria-label="Next period" onClick={()=>setAnchor(addDays(start,span))}><ChevronRight size={17}/></button>
    <strong>{dayHeading(start)} – {dayHeading(addDays(end,-1))}</strong>
   </div>
  </div>
  <div className="timeline-filters">
   <label className="search-box"><Search size={16}/><input aria-label="Search physical rooms" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Room number or condition"/></label>
   <label><Filter size={15}/><span className="sr-only">Floor filter</span><select aria-label="Filter by floor" value={floor} onChange={e=>setFloor(e.target.value)}><option value="all">All floors</option>{floors.map(f=><option value={String(f)} key={f}>Floor {f}</option>)}</select></label>
   <label><span className="sr-only">Room type filter</span><select aria-label="Filter by room type" value={roomType} onChange={e=>setRoomType(e.target.value)}><option value="all">All room types</option>{types.map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></label>
   <div className="view-switch" role="group" aria-label="Timeline duration"><button className={span===7?'selected':''} aria-pressed={span===7} onClick={()=>setSpan(7)}>7 days</button><button className={span===14?'selected':''} aria-pressed={span===14} onClick={()=>setSpan(14)}>14 days</button></div>
  </div>
  <div className="timeline-legend">
   <span><i className="legend-dot booked"/> Assigned booking</span><span><i className="legend-dot blocked"/> Maintenance</span><span><i className="legend-dot conflict"/> Overlapping records</span><span><i className="legend-dot unspecified"/> No assignment shown</span>
  </div>
  <QueryFeedback loading={query.isPending} error={query.error}/>
  {query.data&&<div className="timeline-scroll"><div className="timeline-matrix" style={{gridTemplateColumns:`165px repeat(${span}, minmax(115px,1fr))`}}>
   <div className="timeline-head sticky-room">Room / condition</div>
   {days.map(day=><div key={day} className={`timeline-head ${day===hotelToday()?'timeline-today':''}`}><strong>{dayHeading(day)}</strong><small>Night</small></div>)}
   {filtered.map(room=>[
    <div className="timeline-room sticky-room" key={room.id+'-label'}><strong>{room.number} <span>{room.roomTypeName}</span></strong><small>Floor {room.floor}</small><div className="timeline-room-badges"><span>{statusLabel(room.occupancyStatus)}</span><span>{statusLabel(room.housekeepingStatus)}</span>{room.maintenanceStatus!=='available'&&<span>{statusLabel(room.maintenanceStatus)}</span>}</div></div>,
    ...days.map(day=>{
      const nightly=blocksForNight(blocks,room.id,day),kind=nightLabel(nightly);
      const caption=kind==='maintenance'?'Maintenance':kind==='overlap'?'Review overlap':kind==='reservation'?(nightly[0].kind==='reservation'?nightly[0].guestName:'Assigned'):'No assignment';
      return <button className={`timeline-cell timeline-${kind}`} key={room.id+'-'+day} onClick={()=>showRoomNight(room,day)} aria-label={`Room ${room.number}, ${day}: ${caption}`} title={caption}>
       <span className="timeline-cell-name">{caption}</span>
       {kind==='reservation'&&nightly[0].kind==='reservation'&&<small>{nightly[0].reference}</small>}
       {kind==='overlap'&&<AlertTriangle size={14}/>}
      </button>;
    })
   ])}
  </div></div>}
  {query.data&&filtered.length===0&&<p className="timeline-empty">No physical rooms match the current filters.</p>}
  {query.data&&<div className="timeline-foot">
   <span><Info size={16}/> Empty cells are <b>not</b> confirmation of bookable availability. Unassigned room-type reservations aren't allocated to a row.</span>
   {overlappingRooms>0&&<span className="timeline-warning"><AlertTriangle size={14}/> {overlappingRooms} room(s) have overlapping sample records</span>}
  </div>}
  {query.data&&unassigned.length>0&&<div className="timeline-unassigned">
    <h4><CalendarDays size={17}/> Unassigned room-type reservations ({unassigned.length})</h4>
    <p>These reservations overlap the selected period but are not assigned to any physical room.</p>
    <div className="timeline-unassigned-list">{unassigned.map(r=><div key={r.id}><strong>{r.reference}</strong><span>{r.primaryGuestName} · {r.roomTypeName}</span><Status value={statusLabel(r.status)}/></div>)}</div>
   </div>}
  {selected&&<div className="timeline-dialog-backdrop" onMouseDown={e=>{if(e.currentTarget===e.target)setSelected(null);}}>
    <div className="timeline-dialog" data-room-night-dialog role="dialog" aria-modal="true" aria-labelledby="timeline-dialog-title">
     <div className="detail-top"><span className="detail-kicker">PHYSICAL ROOM · SAMPLE DATA</span><button className="icon-btn" ref={closeRef} aria-label="Close night details" onClick={()=>setSelected(null)}><X size={18}/></button></div>
     <h3 id="timeline-dialog-title">Room {selected.room.number}</h3><p>{selected.room.roomTypeName} · {dayHeading(selected.day)}</p>
     <div className="timeline-modal-status"><div>Current occupancy: <Status value={statusLabel(selected.room.occupancyStatus)}/></div><div>Current housekeeping: <Status value={statusLabel(selected.room.housekeepingStatus)}/></div></div>
     <h4>Records for this night</h4>
     {selected.blocks.length===0?<p>No physical-room assignment or maintenance block is recorded. This is not an availability check.</p>:selected.blocks.map(b=><div className="timeline-record" key={b.id}><strong>{b.kind==='reservation'?b.reference:'Maintenance block'}</strong><span>{b.kind==='reservation'?b.guestName:b.reason}</span><small>{b.from} → {b.to} (checkout/end exclusive)</small></div>)}
     <p className="detail-note">This is a read-only mockup. Assignment, maintenance changes, and reservations must be verified through Laravel before taking action.</p>
    </div>
   </div>}
 </section>;
}
