import {useEffect,useMemo,useRef,useState} from 'react';
import {Link} from '@tanstack/react-router';
import {AlertTriangle,ArrowRight,BedDouble,Brush,CheckCircle2,ChevronDown,ChevronRight,ClipboardCheck,Clock3,DoorOpen,Layers,LayoutGrid,RefreshCw,Search,ShieldAlert,SlidersHorizontal,UserRound,Wrench,X} from 'lucide-react';
import {boardStageLabel,groupHousekeepingRooms,useHousekeepingRoomBoard,type HousekeepingBoardRoom} from '../api/housekeepingRoomBoard';
import {useNetworkStatus} from '../features/housekeeping/useNetworkStatus';
import '../features/housekeeping/shiftWorkspace.css';
import '../features/housekeeping/minimalRoomBoard.css';
type Filter='all'|'vacant'|'occupied'|'dirty'|'cleaning'|'service_due'|'inspection_due'|'ready'|'blocked'|'arrival'|'attention'|'mine'|'unverified';
const filters:{key:Filter;label:string}[]=[{key:'all',label:'All rooms'},{key:'arrival',label:'Arrivals today'},{key:'attention',label:'Arrivals needing attention'},{key:'mine',label:'My tasks'},{key:'vacant',label:'Vacant'},{key:'occupied',label:'Occupied'},{key:'dirty',label:'Cleaning required'},{key:'cleaning',label:'Cleaning'},{key:'service_due',label:'Service due'},{key:'inspection_due',label:'Inspection due'},{key:'ready',label:'Ready'},{key:'blocked',label:'Blocked'},{key:'unverified',label:'Unverified'}];
const quickFilters=['all','arrival','mine'] as const;
const mobileFilters=[{key:'all',label:'All'},{key:'dirty',label:'To clean'},{key:'cleaning',label:'Cleaning'},{key:'inspection_due',label:'Inspect'},{key:'ready',label:'Ready'}] as const;
const compactStage:Record<HousekeepingBoardRoom['stage'],string>={dirty:'To clean',cleaning:'Cleaning',inspection_due:'Inspection',ready:'Ready',blocked:'Blocked',occupied:'Occupied',service_due:'Service due',unverified:'Unverified'};
const metrics=[{key:'all',label:'Total rooms',icon:LayoutGrid,tone:'neutral'},{key:'dirty',label:'Needs cleaning',icon:Brush,tone:'dirty'},{key:'cleaning',label:'In cleaning',icon:Clock3,tone:'cleaning'},{key:'inspection_due',label:'Inspection due',icon:ClipboardCheck,tone:'inspection_due'},{key:'ready',label:'Ready',icon:CheckCircle2,tone:'ready'},{key:'blocked',label:'Blocked',icon:ShieldAlert,tone:'blocked'}] as const;
const taskLabels={checkout_clean:'Checkout cleaning',stayover:'Stayover service',inspection:'Room inspection'};
const assignmentLabels={mine:'Assigned to you',other:'Assigned to another staff member',unassigned:'Unassigned'};
const stageIcons={blocked:ShieldAlert,cleaning:Brush,dirty:Brush,service_due:ClipboardCheck,occupied:UserRound,ready:CheckCircle2,inspection_due:ClipboardCheck,unverified:AlertTriangle};
function matches(room:HousekeepingBoardRoom,filter:Filter){
 return filter==='all'||(filter==='arrival'?room.arrivalToday:filter==='attention'?room.arrivalToday&&room.stage!=='ready':filter==='mine'?room.task?.assignment==='mine':filter==='vacant'?room.occupancy==='vacant':filter==='occupied'?room.occupancy!=='vacant':room.stage===filter);
}
const floorLabel=(floor:number|null)=>floor===null?'Floor not set':'Floor '+floor;
const hotelDate=(date:string)=>new Date(date+'T12:00:00Z').toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric',year:'numeric',timeZone:'UTC'});
function CompactRoom({room,open}:{room:HousekeepingBoardRoom;open:()=>void}){
 return <button type="button" className={'hk-rb-compact hk-rb-tone-'+room.stage} aria-label={'Room '+room.roomNumber+', '+boardStageLabel[room.stage]+(room.arrivalToday?', confirmed arrival today':'')} onClick={open}>
  <span className="hk-rb-compact-icon"><BedDouble size={21} aria-hidden="true"/></span><span className="hk-rb-compact-info"><strong>{room.roomNumber}</strong><span className="hk-rb-compact-status">{room.stage==='ready'&&<CheckCircle2 size={12} aria-hidden="true"/>}{compactStage[room.stage]}</span>{room.arrivalToday&&room.stage!=='ready'&&<span className="hk-rb-compact-arrival"><AlertTriangle size={12} aria-hidden="true"/> Arrival today</span>}</span><ChevronRight size={16} className="hk-rb-compact-arrow" aria-hidden="true"/>
 </button>;
}
function RoomCard({room}:{room:HousekeepingBoardRoom}){
 const StatusIcon=stageIcons[room.stage];
 return <article className={'hk-rb-room hk-rb-tone-'+room.stage}>
  <div className="hk-rb-room-top"><div className="hk-rb-room-ident"><span className="hk-rb-room-icon"><BedDouble size={20}/></span><div><h4>Room {room.roomNumber}</h4><small>{room.roomType}</small></div></div>
   <span className="hk-rb-status"><StatusIcon size={13} aria-hidden="true"/>{boardStageLabel[room.stage]}</span></div>
  <div className="hk-rb-occupancy"><DoorOpen size={15} aria-hidden="true"/>{room.occupancy==='vacant'?'Vacant in PMS':room.occupancy==='due_for_checkout'?'Due for checkout today':'Occupied in PMS'}</div>
  {room.arrivalToday&&<div className="hk-rb-notice hk-rb-arrival"><AlertTriangle size={15} aria-hidden="true"/><span>Confirmed arrival today</span></div>}
  {(room.maintenanceBlocked||room.inventoryBlocked)&&<div className="hk-rb-notice hk-rb-restriction"><ShieldAlert size={15} aria-hidden="true"/><span>{[room.maintenanceBlocked?'Maintenance restriction':null,room.inventoryBlocked?'Inventory restriction':null].filter(Boolean).join(' · ')}</span></div>}
  {room.task&&<div className="hk-rb-task-info"><ClipboardCheck size={16} aria-hidden="true"/><div><strong>{taskLabels[room.task.type]}</strong><small className={room.task.assignment==='mine'?'hk-rb-mine':''}>{assignmentLabels[room.task.assignment]}</small></div></div>}
  {room.stage==='unverified'&&<p className="hk-rb-note">Confirm readiness with reception or your manager.</p>}
  {(room.task||room.maintenanceBlocked)&&<div className="hk-rb-card-actions">
   {room.task&&<Link to="/housekeeping" search={{task:room.task.id}} className={'hk-rb-action '+(room.task.assignment==='mine'?'hk-rb-action-primary':'')}>{room.task.assignment==='mine'?(room.task.status==='done'?'Open inspection task':'Open my task'):room.task.status==='done'?'Open inspection task':'Open team task'} <ArrowRight size={15}/></Link>}
   {room.maintenanceBlocked&&<Link to="/maintenance" search={{room:room.roomNumber}} className="hk-rb-action"><Wrench size={15}/> View maintenance <ArrowRight size={15}/></Link>}
  </div>}
 </article>;
}
export function HousekeepingRoomBoard({hotelId,userId,focusRoom}:{hotelId:string;userId:string;focusRoom?:string}){
 const board=useHousekeepingRoomBoard(hotelId,userId);
 const online=useNetworkStatus();
 const [filter,setFilter]=useState<Filter>('all');
 const [floor,setFloor]=useState('all');
 const [search,setSearch]=useState(focusRoom??'');
 const [filtersOpen,setFiltersOpen]=useState(false);
 const [selectedId,setSelectedId]=useState<string|null>(null);
 const detailRef=useRef<HTMLDialogElement>(null);
 const triggerRef=useRef<HTMLElement|null>(null);
 useEffect(()=>{setSelectedId(null);setFiltersOpen(false);},[hotelId,userId]);
 useEffect(()=>{setSearch(focusRoom??'');setFilter('all');setFloor('all');},[focusRoom]);
 const rooms=board.isSuccess&&online?board.data.data.rooms:[];
 const selected=rooms.find(room=>room.roomId===selectedId);
 const detailOpen=!!selected;
 useEffect(()=>{
  if(!detailOpen)return;
  const modal=detailRef.current;
  if(modal&&!modal.open)modal.showModal();
  return ()=>{modal?.close();if(triggerRef.current?.isConnected)triggerRef.current.focus();};
 },[detailOpen]);
 useEffect(()=>{if(selectedId&&!selected)setSelectedId(null);},[selectedId,selected]);
 const floors=useMemo(()=>groupHousekeepingRooms(rooms).map(group=>group.floor),[rooms]);
 const shown=rooms.filter(room=>matches(room,filter)&&(floor==='all'||floor===String(room.floor))&&
  (room.roomNumber.toLowerCase().includes(search.trim().toLowerCase())||room.roomType.toLowerCase().includes(search.trim().toLowerCase())));
 const groups=groupHousekeepingRooms(shown);
 const count=(key:Filter)=>rooms.filter(room=>matches(room,key)).length;
 const clear=()=>{setFilter('all');setFloor('all');setSearch('');};
 const filtered=filter!=='all'||floor!=='all'||!!search.trim();
 const showData=online&&board.isSuccess;
 const urgent=count('attention');
 const activeLabel=filters.find(item=>item.key===filter)?.label;
 const extraFilter=!mobileFilters.some(item=>item.key===filter);
 const mobileFilterCount=Number(extraFilter)+Number(floor!=='all');
 return <div className="hk-room-board hk-rb hk-minimal-room-board" data-filters-open={filtersOpen}>
  <header className="hk-rb-heading"><div><h2 className="hk-dash-title"><span className="hk-rb-desktop-title">Room status</span><span className="hk-rb-mobile-title">Rooms</span></h2><p className="hk-rb-mobile-subtitle">Cleaning and room readiness</p>
   {showData&&<p className="hk-rb-date">{hotelDate(board.data.data.hotelDate)} <span aria-hidden="true">·</span> <span className="hk-rb-live-dot"/> Updates every 30 sec</p>}</div>
   <button type="button" className="hk-rb-refresh" disabled={!online||board.isFetching} aria-label="Refresh room status" onClick={()=>void board.refetch()}><RefreshCw size={17} className={board.isFetching?'hk-rb-spinning':undefined}/> <span>{board.isFetching?'Refreshing…':'Refresh'}</span></button></header>
  {!online&&<div className="hk-network-alert" role="status">Offline. Reconnect to view current room status.</div>}
  {online&&board.isPending&&<div className="hk-rb-message" role="status"><RefreshCw size={21} className="hk-rb-spinning"/> Loading room status…</div>}
  {online&&board.isError&&<div className="hk-rb-message" role="alert"><AlertTriangle size={21}/><div><strong>Room status unavailable</strong><p>Refresh to get a current snapshot.</p></div><button type="button" className="hk-rb-refresh" disabled={board.isFetching} onClick={()=>void board.refetch()}>Retry</button></div>}
  {showData&&<>
   <section className="hk-rb-toolbar" aria-label="Room filters">
    <div className="hk-rb-filter-top"><div className="hk-rb-quick" role="group" aria-label="Room status filters">{quickFilters.map(key=><button key={key} type="button" aria-pressed={filter===key} onClick={()=>setFilter(key)}>{filters.find(item=>item.key===key)?.label} <span>{count(key)}</span></button>)}</div>
    <div className="hk-rb-search"><Search size={17} aria-hidden="true"/><input type="search" aria-label="Search rooms" placeholder="Search room or type" value={search} onChange={event=>setSearch(event.target.value)}/>{search&&<button type="button" aria-label="Clear room search" onClick={()=>setSearch('')}><X size={16}/></button>}</div>
     <button type="button" className="hk-rb-mobile-filter" aria-expanded={filtersOpen} aria-controls="hk-rb-extra-filters" onClick={()=>setFiltersOpen(value=>!value)}><SlidersHorizontal size={16}/> Filter{mobileFilterCount?' ('+mobileFilterCount+')':''}</button>
    </div>
    <div className="hk-rb-mobile-tabs" role="group" aria-label="Cleaning status filters">{mobileFilters.map(({key,label})=><button key={key} type="button" aria-pressed={filter===key} onClick={()=>setFilter(key)}><span>{label}</span><strong>{count(key)}</strong></button>)}</div>
    <div id="hk-rb-extra-filters" className="hk-rb-filter-bottom">
     <div className="hk-rb-mobile-extra" role="group" aria-label="More room filters">{(['arrival','attention','mine','occupied','vacant','blocked','service_due','unverified'] as const).map(key=><button key={key} type="button" aria-pressed={filter===key} onClick={()=>setFilter(key)}>{filters.find(item=>item.key===key)?.label} <span>{count(key)}</span></button>)}</div>
     <label className="hk-rb-select"><Layers size={16}/><select aria-label="Floor" value={floor} onChange={event=>setFloor(event.target.value)}><option value="all">All floors</option>{floors.map(value=><option key={String(value)} value={String(value)}>{floorLabel(value)}</option>)}</select><ChevronDown size={15}/></label>
     <label className="hk-rb-select"><select aria-label="Room status" value={quickFilters.some(key=>key===filter)?'':filter} onChange={event=>setFilter((event.target.value||'all') as Filter)}><option value="">Any room status</option>{filters.filter(item=>!quickFilters.some(key=>key===item.key)).map(item=><option key={item.key} value={item.key}>{item.label}</option>)}</select><ChevronDown size={15}/></label>
     <span className="hk-rb-result" aria-live="polite">{shown.length} of {rooms.length} rooms{filter!=='all'&&<small> · {activeLabel}</small>}</span>
     {filtered&&<button type="button" className="hk-rb-clear" onClick={clear}><X size={14}/> Clear filters</button>}
    </div>
    {(filtered||extraFilter)&&<div className="hk-rb-mobile-results"><span aria-live="polite">{shown.length} of {rooms.length} rooms{extraFilter?' · '+activeLabel:''}</span><button type="button" className="hk-rb-clear" onClick={clear}>Clear filters</button></div>}
   </section>
   <div className="hk-rb-metrics" aria-label="Room status summary">{metrics.map(({key,label,icon:Icon,tone})=><button type="button" key={key} className={'hk-rb-metric hk-rb-tone-'+(count(key)?tone:'neutral')} aria-pressed={filter===key} onClick={()=>setFilter(key)}>
    <span className="hk-rb-metric-top"><span className="hk-rb-metric-icon"><Icon size={18}/></span><span className="hk-rb-metric-label">{label}</span></span><strong>{count(key)}</strong>
    </button>)}</div>
   {urgent>0&&<div className="hk-rb-urgent"><AlertTriangle size={20}/><div><strong>{urgent} {urgent===1?'arriving room needs':'arriving rooms need'} attention</strong><small>Confirmed arrivals today that are not marked ready.</small></div><button type="button" className="hk-rb-action" onClick={()=>{setFloor('all');setSearch('');setFilter('attention');}}>View arrivals <ArrowRight size={15}/></button></div>}
   {!shown.length&&<div className="hk-rb-message hk-rb-empty"><BedDouble size={27}/><strong>{rooms.length?'No matching rooms':'No rooms registered'}</strong><p>{rooms.length?'Try another floor, room number or status.':'Rooms will appear when configured for this hotel.'}</p></div>}
   {groups.map(group=><section className="hk-rb-floor" key={String(group.floor)} aria-label={floorLabel(group.floor)}>
    <div className="hk-rb-floor-head"><span className="hk-rb-floor-icon"><Layers size={17}/></span><h3>{floorLabel(group.floor)}</h3><span className="hk-rb-floor-count">{group.rooms.length} {group.rooms.length===1?'room':'rooms'}</span><span className="hk-rb-floor-line"/></div>
    <div className="hk-rb-grid">{group.rooms.map(room=><div className="hk-rb-room-cell" key={room.roomId}><div className="hk-rb-desktop-room"><RoomCard room={room}/></div><CompactRoom room={room} open={()=>{triggerRef.current=document.activeElement instanceof HTMLElement?document.activeElement:null;setSelectedId(room.roomId);}}/></div>)}</div>
   </section>)}
   <footer className="hk-rb-footnote"><ShieldAlert size={16}/><span>Occupancy reflects PMS records, not physical verification. Ready means vacant with current inspection evidence and no known blockers; it is not a booking availability guarantee.</span></footer>
  </>}
  {selected&&<dialog ref={detailRef} className="hk-rb-detail" aria-labelledby="hk-rb-detail-title" onCancel={event=>{event.preventDefault();setSelectedId(null);}}>
   <header><h3 id="hk-rb-detail-title">Room details</h3><button type="button" className="icon-btn" aria-label="Close room details" onClick={()=>setSelectedId(null)}><X size={20}/></button></header>
   <div className="hk-rb-detail-body"><RoomCard room={selected}/><p className="hk-rb-note">Occupancy reflects PMS records, not physical verification. Room readiness is not a booking availability guarantee.</p></div>
  </dialog>}
 </div>;
}
