import {useState} from 'react';
import {LiveReservations} from './LiveReservations';
import {CalendarDays,LayoutList,Search,SlidersHorizontal} from 'lucide-react';
import {useReservations} from '../api/queries';
import {DemoNotice,Heading,Panel,Status} from '../components/ui';
import {QueryFeedback} from '../components/QueryFeedback';
import {currency,dateLabel,statusLabel} from '../lib/format';
import {ReservationCalendar} from '../features/reservations/ReservationCalendar';
import {ReservationDetail} from '../features/reservations/ReservationDetail';
import {BookingWizard} from '../features/reservations/BookingWizard';
import {dataMode} from '../api';
import type {Reservation} from '../api/types';

function MockReservations(){
 const [layout,setLayout]=useState<'calendar'|'list'>('calendar');
 const [search,setSearch]=useState('');
 const [selected,setSelected]=useState<Reservation|null>(null);
 const [wizardOpen,setWizardOpen]=useState(false);
 const query=useReservations({search,perPage:50});
 return <><DemoNotice/><Heading title="Bookings" description="Browse booked nights and guest reservations using a typed, API-ready data source." action={<button className="btn-primary" type="button" onClick={()=>setWizardOpen(true)} disabled={dataMode!=='mock'} title={dataMode==='mock'?'Open a simulated booking workflow':'Booking preview is available in mock mode only'}><CalendarDays size={16}/> Preview new booking</button>}/>
 <div className="reservations-viewbar"><div className="view-switch" role="group" aria-label="Bookings presentation">
 <button aria-pressed={layout==='calendar'} className={layout==='calendar'?'selected':''} onClick={()=>setLayout('calendar')}><CalendarDays size={16}/> Calendar</button>
 <button aria-pressed={layout==='list'} className={layout==='list'?'selected':''} onClick={()=>setLayout('list')}><LayoutList size={16}/> List</button></div>
 <span className="table-count">Read-only · sample data in mock mode</span></div>
 {layout==='calendar'?<ReservationCalendar/>:<Panel title="Booking list" action={<span className="table-count">{query.data?.meta.total??'—'} records</span>}>
 <div className="table-toolbar"><label className="search-box"><Search size={17}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search reference, guest or room" aria-label="Search bookings"/></label><span className="filter-hint"><SlidersHorizontal size={16}/> Read-only</span></div>
 <QueryFeedback loading={query.isPending} error={query.error} empty={query.data?.data.length===0}/>
 {query.data&&query.data.data.length>0&&<div className="table-scroll"><table><thead><tr><th>Reference</th><th>Guest</th><th>Room</th><th>Type</th><th>Arrival</th><th>Departure</th><th>Total</th><th>Status</th></tr></thead><tbody>{query.data.data.map(r=><tr key={r.id}><td><button className="reservation-reference-button" onClick={()=>setSelected(r)}>{r.reference}</button></td><td>{r.primaryGuestName}</td><td>{r.assignedRoomNumber??'Unassigned'}</td><td>{r.roomTypeName}</td><td>{dateLabel(r.checkIn)}</td><td>{dateLabel(r.checkOut)}</td><td>{currency(r.total)}</td><td><Status value={statusLabel(r.status)}/></td></tr>)}</tbody></table></div>}</Panel>}
 <ReservationDetail reservation={selected} onClose={()=>setSelected(null)}/>
 {wizardOpen&&<BookingWizard onClose={()=>setWizardOpen(false)}/>} 
 </>;
}


export function Reservations(){
 return dataMode==='api'?<LiveReservations/>:<MockReservations/>;
}
