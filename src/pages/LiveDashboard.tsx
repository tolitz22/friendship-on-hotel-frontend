import {BedDouble,Layers3,Building2,ArrowRight,ShieldAlert,CalendarPlus,ClipboardCheck,Hotel,UserRound} from 'lucide-react';
import {Link} from '@tanstack/react-router';
import {useLiveCatalogSummary,useLiveProperty} from '../api/liveCatalogQueries';
import {Heading,Panel,Stat} from '../components/ui';
import {QueryFeedback} from '../components/QueryFeedback';

export function LiveDashboard(){
 const catalog=useLiveCatalogSummary();
 const property=useLiveProperty();
 const data=catalog.data?.data;
 return <>
 <Heading title="Hotel overview" description="Start your daily hotel work here. Live room catalogue totals are shown below; booking and housekeeping tasks are in their dedicated screens."/>
 <section className="overview-task-grid" aria-label="Start a hotel task">
  <Link to="/front-desk" className="overview-task">
   <Hotel size={22} aria-hidden="true"/><strong>Today's front desk</strong>
   <span>Review arrivals, departures and in-house stays</span><ArrowRight size={17} aria-hidden="true"/>
  </Link>
  <Link to="/reservations" className="overview-task">
   <CalendarPlus size={22} aria-hidden="true"/><strong>Create a reservation</strong>
   <span>Choose a guest, rate and stay, then confirm</span><ArrowRight size={17} aria-hidden="true"/>
  </Link>
  <Link to="/housekeeping" className="overview-task">
   <ClipboardCheck size={22} aria-hidden="true"/><strong>Cleaning tasks</strong>
   <span>Work through checkout turnover and inspections</span><ArrowRight size={17} aria-hidden="true"/>
  </Link>
  <Link to="/guests" className="overview-task">
   <UserRound size={22} aria-hidden="true"/><strong>Guest directory</strong>
   <span>Find or register a guest before booking</span><ArrowRight size={17} aria-hidden="true"/>
  </Link>
 </section>
 <p className="help-copy">Overview counts below represent registered rooms and room types, not occupancy or available-night inventory.</p>
 <QueryFeedback loading={catalog.isPending||property.isPending} error={catalog.error??property.error}
  onRetry={()=>{void catalog.refetch();void property.refetch();}}/>
 {data&&<div className="stats-grid">
  <Stat label="Registered rooms" value={String(data.totalRooms)} detail="Live physical room records" icon={<BedDouble size={20}/>}/>
  <Stat label="Room types" value={String(data.totalRoomTypes)} detail="Live registered categories" icon={<Layers3 size={20}/>}/>
  <Stat label="Floors with rooms" value={String(data.floors.filter(f=>f.number!==null).length)} detail="Distinct numbered floors" icon={<Building2 size={20}/>}/>
  <Stat label="Occupied / available" value="—" detail="Not calculated by backend" icon={<ShieldAlert size={20}/>}/>
 </div>}
 <div className="two-columns">
 <Panel title="Room types" action={<Link to="/rooms" className="text-link">Room catalogue <ArrowRight size={16}/></Link>}>
 {data?<div className="table-scroll"><table><thead><tr><th>Room category</th><th>Rooms</th><th>Max guests</th></tr></thead><tbody>{data.roomTypes.map(type=><tr key={type.id}><td><strong>{type.name}</strong></td><td>{type.roomCount}</td><td>{type.maxOccupancy}</td></tr>)}</tbody></table>{data.roomTypes.length===0&&<p className="guest-info">No room types registered for this hotel.</p>}</div>:null}
 </Panel>
 <Panel title="Selected property">
 {property.data&&<div className="live-property-summary">
  <h3>{property.data.data.name}</h3>
  <p>{property.data.data.address??'No address configured'}</p>
  <p>Timezone: {property.data.data.timeZone}</p>
  <p>Currency: {property.data.data.currency}</p>
  <Link to="/settings" className="text-link">View settings <ArrowRight size={16}/></Link>
 </div>}
 <p className="panel-footnote">Daily booking and housekeeping work is available in the dedicated live screens. Occupancy totals are not calculated in this catalogue overview.</p>
 </Panel>
 </div>
 </>;
}
