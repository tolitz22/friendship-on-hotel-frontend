import {useState} from 'react';import {BedDouble,Filter,Search} from 'lucide-react';
import {useRooms} from '../api/queries';import {DemoNotice,Heading,Status} from '../components/ui';
import {QueryFeedback} from '../components/QueryFeedback';import {statusLabel} from '../lib/format';
export function Rooms(){
 const [floor,setFloor]=useState('all'),[search,setSearch]=useState('');const q=useRooms({floor:floor==='all'?undefined:Number(floor),search,perPage:100});
 return <><DemoNotice/><Heading title="Room inventory" description="Physical room status is separate from booking availability on future nights."/>
 <div className="inventory-toolbar"><div><Filter size={17}/><label htmlFor="floor-filter">Floor</label><select id="floor-filter" value={floor} onChange={e=>setFloor(e.target.value)}><option value="all">All floors</option><option value="2">Floor 2</option><option value="3">Floor 3</option><option value="4">Floor 4</option></select><label className="search-box"><Search size={16}/><input aria-label="Search rooms" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Room or status"/></label></div><span>{q.data?.meta.total??'—'} rooms</span></div>
 <QueryFeedback loading={q.isPending} error={q.error} empty={q.data?.data.length===0}/>
 {q.data&&<div className="room-grid">{q.data.data.map(r=><article className="room-card" key={r.id}><div className="room-card-top"><div className="room-icon"><BedDouble size={21}/></div><span className="room-type">{r.roomTypeName} · Floor {r.floor}</span></div><h3>Room {r.number}</h3><div className="room-details"><div><span>Occupancy</span><Status value={statusLabel(r.occupancyStatus)}/></div><div><span>Housekeeping</span><Status value={statusLabel(r.housekeepingStatus)}/></div><div><span>Maintenance</span><Status value={statusLabel(r.maintenanceStatus)}/></div></div></article>)}</div>}</>;
}
