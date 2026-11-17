import {useMemo,useState,type CSSProperties} from 'react';
import {CalendarDays,ChevronLeft,ChevronRight,LayoutList,Search,SlidersHorizontal} from 'lucide-react';
import {useReservationCalendar} from '../../api/queries';
import type {Reservation,ReservationStatus} from '../../api/types';
import {QueryFeedback} from '../../components/QueryFeedback';
import {Status} from '../../components/ui';
import {statusLabel} from '../../lib/format';
import {ReservationDetail} from './ReservationDetail';
import {addDays,dayHeading,hotelToday,reservationOnNight,visibleDays} from './calendarDate';

const statusOptions: {value:'all'|ReservationStatus;label:string}[]=[
 {value:'all',label:'All statuses'},{value:'confirmed',label:'Confirmed'},{value:'pending',label:'Pending'},
 {value:'checked_in',label:'Checked in'},{value:'checked_out',label:'Checked out'},
 {value:'cancelled',label:'Cancelled'},{value:'no_show',label:'No-show'}
];
const selectionStatuses=new Set<ReservationStatus>(['pending','confirmed','checked_in']);
const initialDate=()=>hotelToday();
export function ReservationCalendar(){
 const [anchor,setAnchor]=useState(initialDate);
 const [view,setView]=useState<'day'|'week'>('week');
 const [status,setStatus]=useState<'all'|ReservationStatus>('all');
 const [roomType,setRoomType]=useState('all');
 const [search,setSearch]=useState('');
 const [selected,setSelected]=useState<Reservation|null>(null);
 const days=useMemo(()=>visibleDays(anchor,view),[anchor,view]);
 const from=days[0],to=addDays(days[days.length-1],1);
 const query=useReservationCalendar({from,to});
 const records=useMemo(()=>{
   const all=query.data?.data??[];
   return all.filter(r=>(status==='all'||r.status===status)&&(roomType==='all'||r.roomTypeId===roomType)&&
    (!search.trim()||[r.reference,r.primaryGuestName,r.roomTypeName,r.assignedRoomNumber??''].some(v=>v.toLowerCase().includes(search.toLowerCase()))));
 },[query.data,status,roomType,search]);
 const types=useMemo(()=>query.data?.meta.roomTypes??[],[query.data]);
 const active=records.filter(r=>selectionStatuses.has(r.status));
 const historical=records.filter(r=>!selectionStatuses.has(r.status));
 const dateRangeLabel=view==='day'?dayHeading(from):dayHeading(from)+' – '+dayHeading(days[6]);
 const changePeriod=(delta:number)=>setAnchor(v=>addDays(v,delta*(view==='week'?7:1)));
 const choose=(r:Reservation)=>setSelected(r);
 return <div className="calendar-layout">
  <div className="calendar-toolbar">
    <div className="calendar-controls"><div className="calendar-period">
      <button className="icon-btn" aria-label="Previous period" onClick={()=>changePeriod(-1)}><ChevronLeft size={17}/></button>
      <button className="icon-btn" aria-label="Next period" onClick={()=>changePeriod(1)}><ChevronRight size={17}/></button>
      <button className="btn-inline calendar-today" onClick={()=>setAnchor(initialDate())}>Today</button>
      <strong>{dateRangeLabel}</strong>
    </div></div>
    <div className="calendar-controls">
      <div className="view-switch" role="group" aria-label="Calendar view">
        <button aria-pressed={view==='day'} className={view==='day'?'selected':''} onClick={()=>setView('day')}>Day</button>
        <button aria-pressed={view==='week'} className={view==='week'?'selected':''} onClick={()=>setView('week')}>Week</button>
      </div>
    </div>
  </div>
  <div className="calendar-filters">
    <label className="calendar-search"><Search size={16}/><input aria-label="Search calendar reservations" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Guest, reference or room"/></label>
    <label><SlidersHorizontal size={16}/><span className="sr-only">Room type</span><select aria-label="Filter room type" value={roomType} onChange={e=>setRoomType(e.target.value)}><option value="all">All room types</option>{types.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
    <label><span className="sr-only">Reservation status</span><select aria-label="Filter reservation status" value={status} onChange={e=>{const next=statusOptions.find(option=>option.value===e.target.value);if(next)setStatus(next.value);}}>{statusOptions.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select></label>
  </div>
  <div className="calendar-summary"><span><CalendarDays size={16}/> {active.length} active bookings overlapping period</span><span><LayoutList size={16}/> {historical.length} inactive records</span><span className="calendar-help">Departure date does not consume another night.</span></div>
  <QueryFeedback loading={query.isPending} error={query.error}/>
  {query.data&&<div className="calendar-grid-scroll"><div className="calendar-grid" style={{'--day-count':String(days.length)} as CSSProperties}>
    <div className="calendar-header-cell calendar-type-heading">Room type</div>
    {days.map(day=><div key={day} className={day===initialDate()?'calendar-header-cell current-day':'calendar-header-cell'}><strong>{dayHeading(day)}</strong><small>{day===initialDate()?'Today':'Night'}</small></div>)}
    {types.filter(t=>roomType==='all'||t.id===roomType).map(type=><div className="calendar-row" key={type.id}>
      <div className="calendar-row-label"><strong>{type.name}</strong><small>{type.id}</small></div>
      {days.map(day=>{
        const nightly=active.filter(r=>r.roomTypeId===type.id&&reservationOnNight(r,day));
        return <div className="calendar-day-cell" key={day}>{nightly.map(r=><button key={r.id} type="button" className={`booking-chip booking-${r.status}`} onClick={()=>choose(r)} title={`${r.reference} — ${r.primaryGuestName}`}>
          <strong>{r.primaryGuestName}</strong><span>{r.assignedRoomNumber?'Room '+r.assignedRoomNumber:'Unassigned'} · {statusLabel(r.status)}</span>
        </button>)}{nightly.length===0&&<span className="calendar-cell-empty">—</span>}</div>;
      })}
    </div>)}
    {types.length===0&&<div className="calendar-no-types">No room types returned for this property.</div>}
  </div></div>}
  {query.data&&active.length===0&&<div className="calendar-zero">No active bookings match these filters in this period. This does not guarantee rooms are available.</div>}
  {query.data&&historical.length>0&&<section className="calendar-inactive"><h3>Inactive reservations in this period</h3><div className="inactive-list">{historical.map(r=><button className="inactive-booking" key={r.id} onClick={()=>choose(r)}><span>{r.reference} · {r.primaryGuestName}</span><Status value={statusLabel(r.status)}/></button>)}</div></section>}
  <p className="calendar-disclaimer">Read-only reservation overview, grouped by booked room type—not a live availability or overbooking indicator. Repeated bookings across nightly cells represent the same reservation.</p>
  <ReservationDetail reservation={selected} onClose={()=>setSelected(null)}/>
 </div>;
}
