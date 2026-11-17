import {Building2,BedDouble,ShieldAlert} from 'lucide-react';
import {useLiveCatalogSummary,useLiveProperty} from '../api/liveCatalogQueries';
import {Heading,Panel} from '../components/ui';
import {QueryFeedback} from '../components/QueryFeedback';

export function LiveSettings(){
 const property=useLiveProperty();
 const catalog=useLiveCatalogSummary();
 const hotel=property.data?.data;
 const data=catalog.data?.data;
 return <>
 <div className="notice"><strong>Live hotel settings</strong> · These are saved Laravel property and room catalogue records. Configuration is read-only in this milestone.</div>
 <Heading title="Hotel settings" description="Current property details, physical room categories and floors from Laravel"/>
 <QueryFeedback loading={property.isPending||catalog.isPending} error={property.error??catalog.error}/>
 {hotel&&data&&<>
 <div className="settings-summary"><div><Building2 size={19}/><span>Property</span><strong>{hotel.name}</strong></div>
 <div><BedDouble size={19}/><span>Registered rooms</span><strong>{data.totalRooms}</strong></div>
 <div><ShieldAlert size={19}/><span>Operations</span><strong>Not configured</strong></div></div>
 <div className="two-columns"><Panel title="Property details"><div className="live-property-summary">
  <p><strong>Name:</strong> {hotel.name}</p>
  <p><strong>Address:</strong> {hotel.address??'Not configured'}</p>
  <p><strong>Email:</strong> {hotel.contactEmail??'Not configured'}</p>
  <p><strong>Phone:</strong> {hotel.contactPhone??'Not configured'}</p>
  <p><strong>Timezone:</strong> {hotel.timeZone}</p>
  <p><strong>Currency:</strong> {hotel.currency}</p>
  </div></Panel>
  <Panel title="Registered room types"><div className="table-scroll"><table><thead><tr><th>Type</th><th>Capacity</th><th>Rooms</th></tr></thead><tbody>
  {data.roomTypes.map(t=><tr key={t.id}><td>{t.name}</td><td>{t.maxOccupancy}</td><td>{t.roomCount}</td></tr>)}
  </tbody></table></div></Panel></div>
  <Panel title="Registered floors"><div className="settings-floor-grid">{data.floors.map((floor,i)=><div key={floor.number??'unknown-'+i}><span>{floor.number===null?'Unassigned floor':'Floor '+floor.number}</span><strong>{floor.roomCount} room(s)</strong></div>)}
  {data.floors.length===0&&<p>No rooms registered yet.</p>}</div></Panel>
  <p className="guest-info">Check-in/check-out rules, housekeeping, room rates and staff-role previews are not stored in the current backend settings model. No fictional values are displayed here.</p>
 </>}
 </>;
}
