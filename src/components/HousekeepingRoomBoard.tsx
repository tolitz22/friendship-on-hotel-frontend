import {useEffect,useMemo,useState} from 'react';
import {Link} from '@tanstack/react-router';
import {AlertTriangle,ArrowRight,BedDouble,RefreshCw,Search} from 'lucide-react';
import {boardStageLabel,groupHousekeepingRooms,useHousekeepingRoomBoard,type HousekeepingBoardRoom} from '../api/housekeepingRoomBoard';
import {Heading} from './ui';
type Filter='all'|'vacant'|'occupied'|'dirty'|'cleaning'|'service_due'|'inspection_due'|'ready'|'blocked'|'arrival'|'mine'|'unverified';
const filters:{key:Filter;label:string}[]=[{key:'all',label:'All rooms'},{key:'arrival',label:'Arrivals today'},{key:'mine',label:'My tasks'},{key:'vacant',label:'Vacant'},{key:'occupied',label:'Occupied'},{key:'dirty',label:'Cleaning required'},{key:'cleaning',label:'Cleaning'},{key:'service_due',label:'Service due'},{key:'inspection_due',label:'Inspection due'},{key:'ready',label:'Ready'},{key:'blocked',label:'Blocked'},{key:'unverified',label:'Unverified'}];
function matches(room:HousekeepingBoardRoom,filter:Filter){
 return filter==='all'||(filter==='arrival'?room.arrivalToday:filter==='mine'?room.task?.assignment==='mine':filter==='vacant'?room.occupancy==='vacant':filter==='occupied'?room.occupancy!=='vacant':room.stage===filter);
}
export function HousekeepingRoomBoard({hotelId,userId,focusRoom}:{hotelId:string;userId:string;focusRoom?:string}){
 const board=useHousekeepingRoomBoard(hotelId,userId);
 const [filter,setFilter]=useState<Filter>('all');
 const [floor,setFloor]=useState('all');
 const [search,setSearch]=useState(focusRoom??'');
 useEffect(()=>{setSearch(focusRoom??'');setFilter('all');setFloor('all');},[focusRoom]);
 const rooms=board.isError?[]:board.data?.data.rooms??[];
 const floors=useMemo(()=>groupHousekeepingRooms(rooms).map(group=>group.floor),[rooms]);
 const shown=rooms.filter(room=>matches(room,filter)&&(floor==='all'||floor===String(room.floor))&&
  (room.roomNumber.toLowerCase().includes(search.trim().toLowerCase())||room.roomType.toLowerCase().includes(search.trim().toLowerCase())));
 const groups=groupHousekeepingRooms(shown);
 const count=(key:Filter)=>rooms.filter(room=>matches(room,key)).length;
 return <div className="hk-room-board">
  <div className="hk-board-heading"><Heading title="Room status" description="Review cleaning, PMS occupancy and restrictions by floor."/>
   <button type="button" className="btn-inline" disabled={board.isFetching} onClick={()=>void board.refetch()}><RefreshCw size={16}/> {board.isFetching?'Refreshing…':'Refresh'}</button></div>
  {board.isPending&&<p role="status">Loading room status…</p>}
  {board.isError&&<p role="alert">Room status is unavailable. Refresh to get a current snapshot.</p>}
  {board.isSuccess&&<><p className="desk-muted">Hotel date {board.data.data.hotelDate} · PMS-recorded occupancy, not physical verification.</p>
   <div className="hk-board-summary">{(['all','dirty','cleaning','inspection_due','ready','blocked'] as const).map(key=><button type="button" key={key} className={'hk-board-summary-card hk-board-'+key} aria-pressed={filter===key} onClick={()=>setFilter(key)}>
    <strong>{count(key)}</strong><span>{filters.find(item=>item.key===key)?.label}</span></button>)}</div>
   <div className="hk-board-controls"><label><Search size={16}/><input type="search" aria-label="Search rooms" placeholder="Room number or type" value={search} onChange={event=>setSearch(event.target.value)}/></label>
    <label>Floor <select value={floor} onChange={event=>setFloor(event.target.value)}><option value="all">All floors</option>{floors.map(value=><option key={String(value)} value={String(value)}>{value===null?'Floor not set':'Floor '+value}</option>)}</select></label></div>
   <div className="hk-queue-tabs hk-priority-tabs" role="group" aria-label="Room status filters">{filters.map(item=><button type="button" key={item.key} className={filter===item.key?'active':''} aria-pressed={filter===item.key} onClick={()=>setFilter(item.key)}>{item.label}</button>)}</div>
   <p className="desk-muted">{shown.length} of {rooms.length} rooms</p>
   {!shown.length&&<div className="hk-home-empty"><BedDouble size={22}/> No rooms match these filters. <button type="button" className="btn-inline" onClick={()=>{setFilter('all');setFloor('all');setSearch('');}}>Clear filters</button></div>}
   {groups.map(group=><section key={String(group.floor)} aria-label={group.floor===null?'Floor not set':'Floor '+group.floor}>
    <h3>{group.floor===null?'Floor not set':'Floor '+group.floor} <small>· {group.rooms.length} rooms</small></h3>
    <div className="hk-board-grid">{group.rooms.map(room=><article key={room.roomId} className={'hk-board-room hk-board-'+room.stage}>
     <div className="hk-board-room-head"><h4>Room {room.roomNumber}</h4><span className="hk-board-stage">{boardStageLabel[room.stage]}</span></div>
     <small>{room.roomType}</small>
     <span>{room.occupancy==='vacant'?'Vacant in PMS':room.occupancy==='due_for_checkout'?'Due for checkout today':'Occupied in PMS'}</span>
     {room.arrivalToday&&<span className="hk-board-alert"><AlertTriangle size={15}/> Confirmed arrival today</span>}
     {room.maintenanceBlocked&&<span>Maintenance restriction</span>}
     {room.inventoryBlocked&&<span>Inventory restriction</span>}
     {room.task&&<><small>{room.task.assignment==='mine'?'Assigned to you':room.task.assignment==='unassigned'?'Unassigned':'Assigned to another staff member'} · {room.task.type.replaceAll('_',' ')}</small>
      <Link to="/housekeeping" search={{task:room.task.id}} className="btn-inline">{room.task.assignment==='mine'?(room.task.status==='done'?'Open inspection task':'Open my task'):'View task'} <ArrowRight size={15}/></Link></>}
     {room.stage==='blocked'&&room.maintenanceBlocked&&<Link to="/maintenance" className="btn-inline">View maintenance <ArrowRight size={15}/></Link>}
     {room.stage==='unverified'&&<small>Ask reception or your manager to confirm the next action.</small>}
    </article>)}</div></section>)}
   <p className="role-note">Ready means a vacant PMS room with current inspection evidence and no known blockers. It is not a booking availability guarantee.</p>
  </>}
 </div>;
}
