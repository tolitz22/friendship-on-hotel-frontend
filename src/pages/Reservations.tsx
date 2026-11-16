import {useState} from 'react';import {CalendarDays,Search,SlidersHorizontal} from 'lucide-react';
import {useReservations} from '../api/queries';import {DemoNotice,Heading,Panel,Status} from '../components/ui';
import {QueryFeedback} from '../components/QueryFeedback';import {currency,dateLabel,statusLabel} from '../lib/format';
export function Reservations(){
 const [search,setSearch]=useState('');const query=useReservations({search,perPage:50});
 return <><DemoNotice/><Heading title="Reservations" description="Explore reservations using an API-ready query contract." action={<button className="btn-primary" disabled title="Requires backend reservation policy"><CalendarDays size={16}/> New booking (planned)</button>}/>
 <Panel title="Reservation list" action={<span className="table-count">{query.data?.meta.total??'—'} records</span>}>
 <div className="table-toolbar"><label className="search-box"><Search size={17}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search reference, guest or room" aria-label="Search reservations"/></label><span className="filter-hint"><SlidersHorizontal size={16}/> Read-only</span></div>
 <QueryFeedback loading={query.isPending} error={query.error} empty={query.data?.data.length===0}/>
 {query.data&&query.data.data.length>0&&<div className="table-scroll"><table><thead><tr><th>Reference</th><th>Guest</th><th>Room</th><th>Type</th><th>Arrival</th><th>Departure</th><th>Total</th><th>Status</th></tr></thead><tbody>{query.data.data.map(r=><tr key={r.id}><td className="table-id">{r.reference}</td><td>{r.primaryGuestName}</td><td>{r.assignedRoomNumber??'Unassigned'}</td><td>{r.roomTypeName}</td><td>{dateLabel(r.checkIn)}</td><td>{dateLabel(r.checkOut)}</td><td>{currency(r.total)}</td><td><Status value={statusLabel(r.status)}/></td></tr>)}</tbody></table></div>}</Panel></>;
}
