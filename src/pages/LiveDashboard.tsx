import {BedDouble,Layers3,Building2,ArrowRight,ShieldAlert} from 'lucide-react';
import {Link} from '@tanstack/react-router';
import {useLiveCatalogSummary,useLiveProperty} from '../api/liveCatalogQueries';
import {Heading,Panel,Stat} from '../components/ui';
import {QueryFeedback} from '../components/QueryFeedback';

export function LiveDashboard(){
 const catalog=useLiveCatalogSummary();
 const property=useLiveProperty();
 const data=catalog.data?.data;
 return <>
 <div className="notice"><strong>Live property catalogue</strong> · Only registered room counts, room types and floors are verified. Occupancy and reservation metrics are not available yet.</div>
 <Heading title="Hotel overview" description="Live Laravel property catalogue · No simulated occupancy or booking numbers"/>
 <QueryFeedback loading={catalog.isPending||property.isPending} error={catalog.error??property.error}/>
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
 <p className="panel-footnote">Check-in/out, housekeeping, availability and recent bookings are not connected to the database.</p>
 </Panel>
 </div>
 </>;
}
