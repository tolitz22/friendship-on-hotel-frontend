import {useEffect,useState} from 'react';
import {Building2,BedDouble,ShieldAlert,Plus} from 'lucide-react';
import {useLiveCatalogSummary,useLiveProperty,useLiveRoomTypes} from '../api/liveCatalogQueries';
import {CatalogCreateDialog,type CatalogCreateMode} from '../components/CatalogCreateDialog';
import {CatalogEditDialog} from '../components/CatalogEditDialog';
import type {LiveRoomType} from '../api/liveCatalog';
import {useHotelAuth} from '../components/AuthProvider';
import {Heading,Panel} from '../components/ui';
import {QueryFeedback} from '../components/QueryFeedback';

export function LiveSettings(){
 const {hotelId,user}=useHotelAuth();
 const [createMode,setCreateMode]=useState<CatalogCreateMode|null>(null);
 const [editingType,setEditingType]=useState<LiveRoomType|null>(null);
 useEffect(()=>{setCreateMode(null);setEditingType(null);},[hotelId]);
 const admin=!!user?.hotels.some(h=>h.id===hotelId&&h.role==='admin');
 const roomTypes=useLiveRoomTypes();
 const property=useLiveProperty();
 const catalog=useLiveCatalogSummary();
 const hotel=property.data?.data;
 const data=catalog.data?.data;
 return <>
 <div className="notice"><strong>Live hotel settings</strong> · These are saved Laravel property and room catalogue records. Administrators can create room types and physical rooms; existing records remain read-only.</div>
 <Heading title="Hotel settings" description="Current property details, physical room categories and floors from Laravel" action={admin?<div className="catalog-actions"><button type="button" className="btn-inline" onClick={()=>setCreateMode('type')}><Plus size={16}/> Room type</button><button type="button" className="btn-primary" onClick={()=>setCreateMode('room')}><Plus size={16}/> Add room</button></div>:undefined}/>
 <QueryFeedback loading={property.isPending||catalog.isPending} error={property.error??catalog.error??roomTypes.error}/>
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
  <Panel title="Registered room types"><div className="table-scroll"><table><thead><tr><th>Type</th><th>Capacity</th><th>Rooms</th>{admin&&<th>Action</th>}</tr></thead><tbody>
  {data.roomTypes.map(t=><tr key={t.id}><td>{t.name}</td><td>{t.maxOccupancy}</td><td>{t.roomCount}</td>{admin&&<td><button className="guest-edit-button" type="button" onClick={()=>{const record=roomTypes.data?.data.find(rt=>rt.id===t.id);if(record)setEditingType(record);}}>Edit</button></td>}</tr>)}
  </tbody></table></div></Panel></div>
  <Panel title="Registered floors"><div className="settings-floor-grid">{data.floors.map((floor,i)=><div key={floor.number??'unknown-'+i}><span>{floor.number===null?'Unassigned floor':'Floor '+floor.number}</span><strong>{floor.roomCount} room(s)</strong></div>)}
  {data.floors.length===0&&<p>No rooms registered yet.</p>}</div></Panel>
  {admin&&<p className="guest-info">Create room types and physical rooms using the buttons above. Existing room metadata and property details remain read-only until audited edit workflows are implemented.</p>}
  <p className="guest-info">Check-in/check-out rules, housekeeping, room rates and staff-role previews are not stored in the current backend settings model. No fictional values are displayed here.</p>
 </>}
 {editingType&&admin&&<CatalogEditDialog key={'edit-'+hotelId+'-'+editingType.id} target={{kind:'room_type',record:editingType}} roomTypes={roomTypes.data?.data??[]} onClose={()=>setEditingType(null)} onSaved={()=>setEditingType(null)}/>}
 {createMode&&admin&&<CatalogCreateDialog key={hotelId+'-'+createMode} mode={createMode} roomTypes={roomTypes.data?.data??[]} onClose={()=>setCreateMode(null)} onCreated={()=>setCreateMode(null)}/>}
 </>;
}
