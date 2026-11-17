import {useState} from 'react';
import {dataMode} from '../api';
import {LiveRooms} from './LiveRooms';
import {BedDouble,Filter,Search,CalendarRange,LayoutGrid} from 'lucide-react';
import {useRooms} from '../api/queries';
import {DemoNotice,Heading,Status} from '../components/ui';
import {QueryFeedback} from '../components/QueryFeedback';
import {RoomTimeline} from '../features/rooms/RoomTimeline';
import {statusLabel} from '../lib/format';

function MockRooms(){
 const [layout,setLayout]=useState<'timeline'|'grid'>('timeline');
 const [floor,setFloor]=useState('all');
 const [search,setSearch]=useState('');
 const q=useRooms({floor:floor==='all'?undefined:Number(floor),search,perPage:100});
 return <><DemoNotice/>
 <Heading title="Room inventory" description="Review sample physical rooms, assignments, and operational room conditions."/>
 <div className="reservations-viewbar">
  <div className="view-switch" role="group" aria-label="Room inventory presentation">
   <button aria-pressed={layout==='timeline'} className={layout==='timeline'?'selected':''} onClick={()=>setLayout('timeline')}><CalendarRange size={16}/> Timeline</button>
   <button aria-pressed={layout==='grid'} className={layout==='grid'?'selected':''} onClick={()=>setLayout('grid')}><LayoutGrid size={16}/> Grid</button>
  </div>
  <span className="table-count">Read-only preview · no live availability calculation</span>
 </div>
 {layout==='timeline'?<RoomTimeline/>:<>
 <div className="inventory-toolbar"><div><Filter size={17}/><label htmlFor="floor-filter">Floor</label><select id="floor-filter" value={floor} onChange={e=>setFloor(e.target.value)}><option value="all">All floors</option><option value="2">Floor 2</option><option value="3">Floor 3</option><option value="4">Floor 4</option></select><label className="search-box"><Search size={16}/><input aria-label="Search rooms" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Room or status"/></label></div><span>{q.data?.meta.total??'—'} rooms</span></div>
 <QueryFeedback loading={q.isPending} error={q.error} empty={q.data?.data.length===0}/>
 {q.data&&<div className="room-grid">{q.data.data.map(r=><article className="room-card" key={r.id}><div className="room-card-top"><div className="room-icon"><BedDouble size={21}/></div><span className="room-type">{r.roomTypeName} · Floor {r.floor}</span></div><h3>Room {r.number}</h3><div className="room-details"><div><span>Occupancy</span><Status value={statusLabel(r.occupancyStatus)}/></div><div><span>Housekeeping</span><Status value={statusLabel(r.housekeepingStatus)}/></div><div><span>Maintenance</span><Status value={statusLabel(r.maintenanceStatus)}/></div></div></article>)}</div>}
 </>}
 </>;
}


export function Rooms(){
 return dataMode==='api'?<LiveRooms/>:<MockRooms/>;
}
