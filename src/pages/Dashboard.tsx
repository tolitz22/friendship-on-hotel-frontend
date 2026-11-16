import {BedDouble,CalendarDays,DoorOpen,Brush,ArrowRight} from 'lucide-react';
import {Link} from '@tanstack/react-router';
import {useDashboard,useReservations,useRooms} from '../api/queries';
import {dataMode} from '../api';
import {DemoNotice,Heading,Panel,Stat,Status} from '../components/ui';
import {QueryFeedback} from '../components/QueryFeedback';
import {currency,dateLabel,statusLabel} from '../lib/format';
export function Dashboard(){
 const summary=useDashboard(),reservations=useReservations({perPage:5}),rooms=useRooms({perPage:8});
 return <><DemoNotice/><Heading title="Hotel overview" description={`Operational snapshot · ${dataMode==='mock'?'Demo data':'Live API mode'}`}/>
 <QueryFeedback loading={summary.isPending} error={summary.error}/>{summary.data&&<div className="stats-grid">
 <Stat label="Total rooms" value={String(summary.data.data.totalRooms)} detail="In the selected property" icon={<BedDouble size={20}/>}/>
 <Stat label="Occupied now" value={String(summary.data.data.occupiedRooms)} detail="Physical occupancy" icon={<DoorOpen size={20}/>}/>
 <Stat label="Vacant now" value={String(summary.data.data.vacantRooms)} detail="Not future sellable inventory" icon={<CalendarDays size={20}/>}/>
 <Stat label="Dirty rooms" value={String(summary.data.data.dirtyRooms)} detail="Housekeeping condition" icon={<Brush size={20}/>}/>
 </div>}
 <div className="two-columns"><Panel title="Recent reservations" action={<Link to="/reservations" className="text-link">All reservations <ArrowRight size={16}/></Link>}>
 <QueryFeedback loading={reservations.isPending} error={reservations.error}/>
 {reservations.data&&<div className="table-scroll"><table><thead><tr><th>Guest</th><th>Arrival</th><th>Amount</th><th>Status</th></tr></thead><tbody>{reservations.data.data.map(r=><tr key={r.id}><td><strong>{r.primaryGuestName}</strong><span className="cell-note">{r.reference}</span></td><td>{dateLabel(r.checkIn)}</td><td>{currency(r.total)}</td><td><Status value={statusLabel(r.status)}/></td></tr>)}</tbody></table></div>}</Panel>
 <Panel title="Room conditions" action={<Link to="/rooms" className="text-link">Room inventory <ArrowRight size={16}/></Link>}>
 <QueryFeedback loading={rooms.isPending} error={rooms.error}/>
 {rooms.data&&<div className="mini-room-grid">{rooms.data.data.map(r=><div className="mini-room" key={r.id}><div><BedDouble size={17}/><b>{r.number}</b></div><Status value={statusLabel(r.maintenanceStatus==='available'?r.occupancyStatus:r.maintenanceStatus)}/></div>)}</div>}
 <p className="panel-footnote">Occupancy, cleaning and maintenance are separate room attributes.</p></Panel></div></>;
}
