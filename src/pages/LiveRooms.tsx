import {useState} from 'react';
import {BedDouble,Filter,Search} from 'lucide-react';
import {useLiveCatalogSummary,useLiveRooms} from '../api/liveCatalogQueries';
import {Heading} from '../components/ui';
import {QueryFeedback} from '../components/QueryFeedback';

export function LiveRooms(){
 const [floor,setFloor]=useState('all');
 const [search,setSearch]=useState('');
 const [page,setPage]=useState(1);
 const summary=useLiveCatalogSummary();
 const rooms=useLiveRooms({page,perPage:24,floor:floor==='all'?undefined:Number(floor),search});
 const totalPages=rooms.data?.meta.totalPages??1;
 return <>
 <div className="notice"><strong>Live room catalogue</strong> · Room number, type, floor, and capacity come from Laravel. No real occupancy, housekeeping status, or reservation timeline is available.</div>
 <Heading title="Room inventory" description="Registered physical rooms · Hotel-scoped catalogue view"/>
 <div className="inventory-toolbar">
  <div><Filter size={17}/><label htmlFor="floor-filter">Floor</label>
  <select id="floor-filter" value={floor} onChange={e=>{setFloor(e.target.value);setPage(1);}}>
   <option value="all">All floors</option>
   {summary.data?.data.floors.filter(f=>f.number!==null).map(f=><option key={f.number} value={String(f.number)}>{'Floor '+f.number}</option>)}
  </select>
  <label className="search-box"><Search size={16}/><input aria-label="Search room numbers" value={search} onChange={e=>{setSearch(e.target.value);setPage(1);}} placeholder="Search room number"/></label></div>
  <span>{rooms.data?.meta.total??'—'} registered rooms</span>
 </div>
 <QueryFeedback loading={rooms.isPending||summary.isPending} error={rooms.error??summary.error} empty={rooms.data?.data.length===0}/>
 {rooms.data&&<div className="room-grid">{rooms.data.data.map(room=><article className="room-card" key={room.id}>
  <div className="room-card-top"><div className="room-icon"><BedDouble size={21}/></div><span className="room-type">{room.roomTypeName} · {room.floor===null?'Floor unassigned':'Floor '+room.floor}</span></div>
  <h3>Room {room.number}</h3><div className="room-details"><div><span>Max occupants</span><strong>{room.maxOccupancy}</strong></div>
  <div><span>Occupancy</span><strong>Not tracked</strong></div>
  <div><span>Maintenance</span><strong>Not tracked</strong></div></div>
 </article>)}</div>}
 {rooms.data&&<div className="guest-pagination"><span>Page {rooms.data.meta.page} of {Math.max(1,totalPages)}</span><div>
 <button className="btn-inline" disabled={page<=1} onClick={()=>setPage(p=>Math.max(1,p-1))}>Previous</button>
 <button className="btn-inline" disabled={page>=totalPages} onClick={()=>setPage(p=>p+1)}>Next</button></div></div>}
 </>;
}
