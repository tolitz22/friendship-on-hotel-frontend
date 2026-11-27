import {StayExtensionModal} from '../components/StayExtensionModal';
import {useEffect,useMemo,useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {useQueryClient} from '@tanstack/react-query';
import {Link,useSearch} from '@tanstack/react-router';
import {
 ArrowRight,BedDouble,CalendarDays,LogIn,LogOut,
 Search,Users,AlertTriangle,RefreshCw,ClipboardCheck,Plus,Clock3,Info,SlidersHorizontal,ChevronRight, Zap, List, UserPlus,
} from 'lucide-react';
import {useLiveManifest} from '../api/liveFrontDesk';
import {useRoomInventoryStatus} from '../api/roomInventoryStatus';
import {roomOperationalSignal,informationalMaintenanceCount} from '../features/rooms/roomOperationalSignals';
import {listMaintenance,parseLiveMaintenance} from '../api/liveMaintenance';
import {useLiveProperty} from '../api/liveCatalogQueries';
import {requestJson} from '../api/http';
import {hotelPath,readSession} from '../api/session';
import {useHotelAuth} from '../components/AuthProvider';
import {selectedRole,canViewWorkspacePath} from '../features/workspaces/roleNavigation';
import './ReceptionDesk.css';
import './ManagerFrontDesk.css';
import {OperationalDateStrip} from '../components/OperationalDateStrip';
import type {ManifestKind,ManifestEntry} from '../api/liveFrontDesk';
import {recommendedDeskAction} from '../features/front-desk/deskActions';
import {Heading,Panel} from '../components/ui';
import {QueryFeedback} from '../components/QueryFeedback';
import {hotelToday} from '../features/reservations/calendarDate';
import {dateLabel} from '../lib/format';

const queues:{kind:ManifestKind;title:string}[]=[
 {kind:'arrivals',title:'Arrivals'},
 {kind:'departures',title:'Departures'},
 {kind:'overdue',title:'Overdue checkouts'},
 {kind:'in_house',title:'In-house'},
];
const displayGuest=(record:ManifestEntry)=>record.guestName?.trim()||'Guest name unavailable';

export function LiveFrontDesk(){
 const {queue:initialQueue,date:initialDate}=useSearch({from:'/front-desk'});
 const property=useLiveProperty();
 const hotelDate=hotelToday(new Date(),property.data?.data.timeZone??'Asia/Manila');
 const [date,setDate]=useState(initialDate??hotelDate);
 const [kind,setKind]=useState<ManifestKind>(initialQueue??'arrivals');
 const [pageByKind,setPageByKind]=useState<Record<ManifestKind,number>>({
  arrivals:1,departures:1,in_house:1,overdue:1,
 });
 const [search,setSearch]=useState('');
 const [todayView,setTodayView]=useState(!initialQueue);
 const [filtersOpen,setFiltersOpen]=useState(false);
 const [extension,setExtension]=useState<{hotelId:string;record:ManifestEntry}|null>(null);
 const client=useQueryClient();
 const {hotelId}=readSession();
 const {user}=useHotelAuth();
 const role=selectedRole(user?.hotels,hotelId);
 const reception=role==='front_desk';
 const combined=reception&&todayView;
 const manager=role==='admin';
 const managerOverview=manager&&todayView;
 const permissions=user?.hotels.find(h=>h.id===hotelId)?.permissions;
 const canOperate=role==='admin'||reception;
 const may=(permission:string)=>role==='admin'||reception&&permissions?.includes(permission)===true;
 const canCreate=may('booking.create');
 const canExtend=may('booking.check_out');
 const term=search.trim();
 const arrivals=useLiveManifest(date,'arrivals',pageByKind.arrivals,20,combined||kind==='arrivals'?term:undefined);
 const departures=useLiveManifest(date,'departures',pageByKind.departures,20,combined||kind==='departures'?term:undefined);
 const inHouse=useLiveManifest(manager?hotelDate:date,'in_house',pageByKind.in_house,20,kind==='in_house'?term:undefined);
 const overdue=useLiveManifest(hotelDate,'overdue',pageByKind.overdue,20,kind==='overdue'?term:undefined);
 const overdueTotal=useLiveManifest(hotelDate,'overdue',1,1);
 const urgentCount=overdueTotal.isSuccess?overdueTotal.data.meta.queueTotal??overdueTotal.data.meta.total:undefined;
 const queries={arrivals,departures,in_house:inHouse,overdue};
 const current=queries[kind];
 const rows=current.isSuccess?current.data.data:[];
 // Room-readiness evidence describes the property's CURRENT date only.
 // Never show today's inspection snapshot as the status of a future stay.
 const isToday=date===hotelDate;
 const visibleRows=managerOverview?(arrivals.data?.data??[]).slice(0,5):combined?[...(arrivals.data?.data??[]).slice(0,3),...(departures.data?.data??[]).slice(0,3)]:rows;
 const assignedRoomIds=useMemo(()=>Array.from(new Set(visibleRows.flatMap(row=>
  row.assignedRoomId?[row.assignedRoomId]:[]))),[visibleRows]);
 const roomStatus=useRoomInventoryStatus(assignedRoomIds,isToday&&canOperate);
 const statusByRoom=useMemo(()=>new Map(
  roomStatus.isSuccess&&roomStatus.data.meta.hotelDate===hotelDate
   ?roomStatus.data.data.map(row=>[row.roomId,row] as const):[],
 ),[roomStatus.data,roomStatus.isSuccess,hotelDate]);
 // Maintenance work-order flags are advisory and never actual inventory restrictions.
 const maintenanceNotes=useQuery({
  queryKey:['live','front-desk','maintenance-notes',hotelId],
  enabled:!!hotelId&&isToday&&canOperate&&assignedRoomIds.length>0,
  queryFn:async()=>parseLiveMaintenance(await listMaintenance(1,100),hotelId!),
  retry:false,
 });
 const filtered=rows;
 const count=(name:ManifestKind)=>queries[name].isSuccess?(queries[name].data.meta.queueTotal??queries[name].data.meta.total):'—';
 const page=current.data?.meta.page??pageByKind[kind];
 const pages=current.isSuccess?current.data.meta.totalPages:0;
 const loadingAny=arrivals.isFetching||departures.isFetching||inHouse.isFetching||overdue.isFetching;
 const changeDate=(next:string)=>{
  setDate(next);setPageByKind({arrivals:1,departures:1,in_house:1,overdue:1});setSearch('');
 };
 useEffect(()=>{setExtension(null);},[hotelId]);
 useEffect(()=>{changeDate(initialQueue==='overdue'?hotelDate:initialDate??hotelDate);setKind(initialQueue??'arrivals');setTodayView(!initialQueue);setFiltersOpen(false);},[hotelId,hotelDate,initialQueue,initialDate]);
 const selectQueue=(next:ManifestKind)=>{setTodayView(false);setKind(next);setPageByKind(prev=>({...prev,[next]:1}));setSearch('');};
 const selectToday=()=>{changeDate(hotelDate);setKind('arrivals');setTodayView(true);};
 const showManagerOverview=()=>{setTodayView(true);setKind('arrivals');setSearch('');setPageByKind({arrivals:1,departures:1,in_house:1,overdue:1});};
 const changeSearch=(value:string)=>{setPageByKind({arrivals:1,departures:1,in_house:1,overdue:1});setSearch(value);};
 const refresh=()=>void Promise.all([
  client.invalidateQueries({queryKey:['live','front-desk','manifest',hotelId]}),
  client.invalidateQueries({queryKey:['live','room-inventory-status',hotelId]}),
  client.invalidateQueries({queryKey:['live','front-desk','maintenance-notes',hotelId]}),
 ]);
 const renderRow=(row:ManifestEntry,kind:ManifestKind)=>{
     const suggested=recommendedDeskAction(kind,row);
     const actionAllowed=suggested.kind==='view'||suggested.kind==='assign'&&may('booking.assign_room')||suggested.kind==='check-in'&&may('booking.check_in')||suggested.kind==='check-out'&&may('booking.check_out');
     const action=actionAllowed?suggested:{kind:'view' as const,label:'View stay',hint:'Open reservation details'};
     const needsAssignment=kind==='arrivals'&&!row.assignedRoomId;
     const status=row.assignedRoomId?statusByRoom.get(row.assignedRoomId):undefined;
     const signal=status?roomOperationalSignal(status):null;
     const shouldInspect=kind==='arrivals'&&!!status&&signal?.tone==='attention'&&['Inspection needed','Readiness not verified'].includes(signal.title);
     const relatedNotes=maintenanceNotes.isSuccess&&row.assignedRoomId
      ?maintenanceNotes.data.data.filter(note=>note.roomId===row.assignedRoomId):[];
     const advisoryCount=informationalMaintenanceCount(relatedNotes);
     const noteCoverageComplete=maintenanceNotes.isSuccess&&maintenanceNotes.data.meta.totalPages<=1;
     // Reception should only see room-readiness concerns where they affect the next check-in.
     const hasRoomWarning=kind==='arrivals'&&isToday&&!!row.assignedRoomId&&(signal?.tone==='attention'||signal?.tone==='blocked'||signal?.tone==='occupied'||!status||advisoryCount>0);
     if(reception)return <article className="rd-guest" key={row.id}>
      <div className="rd-guest-main">
       <span className="rd-avatar" aria-hidden="true"><Users size={17}/></span>
       <div className="rd-guest-info"><Link to="/reservations" search={{booking:row.id}} className="rd-guest-name">{displayGuest(row)}</Link><small>{row.roomNumber?'Room '+row.roomNumber:'Unassigned room'} <span title={row.reference}>· {row.reference}</span></small>
        <span className={'rd-status '+(kind==='overdue'?'rd-status-overdue':row.status==='checked_in'?'rd-status-inhouse':'rd-status-confirmed')}>{kind==='overdue'?'Overdue':row.status==='checked_in'?'In house':'Confirmed'}</span>
       </div>
       <Link to="/reservations" search={{booking:row.id,...(action.kind==='view'?{}:{deskAction:action.kind})}} className="rd-row-action" aria-label={action.label+' · '+displayGuest(row)}>{action.kind==='check-in'?'Check in':action.kind==='check-out'?'Check out':action.kind==='assign'?'Assign room':'View stay'}</Link>
      </div>
      {hasRoomWarning&&<Link to="/rooms" search={{room:row.roomNumber??'',inspect:shouldInspect||undefined}} className="rd-room-warning" data-priority={signal?.tone==='blocked'||signal?.tone==='occupied'?'urgent':'attention'}><AlertTriangle size={14}/><span>{signal&&signal.tone!=='approved'?signal.title:advisoryCount>0?'Maintenance notes':'Readiness not verified'}</span><ChevronRight size={14}/></Link>}
      {(kind==='overdue'||!combined&&row.status==='checked_in')&&<div className="rd-extra">
       {kind==='overdue'&&<span className="rd-due">Due {dateLabel(row.checkOut)}</span>}
       {hotelId&&canExtend&&row.assignedRoomId&&row.status==='checked_in'&&<button className="rd-text-action" type="button" onClick={()=>setExtension({hotelId,record:row})}>Extend stay <ChevronRight size={14}/></button>}
       {kind==='overdue'&&row.departureFollowUp&&<p className="rd-handoff">{row.departureFollowUp}</p>}
       {kind==='overdue'&&canExtend&&<DepartureFollowUp key={hotelId+'-'+row.id} bookingId={row.id} savedNote={row.departureFollowUp} onSaved={refresh}/>}
      </div>}
     </article>;
     return <article className={'fdc-guest-row fdc-guest-row-v2'+(kind==='overdue'?' is-overdue':'')} key={row.id}>
      <div className="fdc-v2-identity">
       <div className="fdc-v2-avatar" aria-hidden="true">{displayGuest(row).trim().slice(0,1).toUpperCase()}</div>
       <div className="fdc-v2-guest-details">
        <strong>{displayGuest(row)}</strong>
        <span>{reception&&((row.roomNumber?'Room '+row.roomNumber:'Unassigned')+' · ')}{row.reference}</span>
        <div className="fdc-v2-badges">
         {kind==='overdue'
          ?<span className="fdc-v2-status overdue"><AlertTriangle size={13}/> Overdue checkout</span>
          :<span className={'fdc-v2-status '+(row.status==='checked_in'?'in-house':'expected')}>
           {row.status==='checked_in'?'Checked in':'Confirmed'}
          </span>}
        </div>
       </div>
      </div>
      <div className="fdc-v2-details">
       <div className="fdc-v2-detail">
        <small><CalendarDays size={14}/> Stay dates</small>
        <strong>{dateLabel(row.checkIn)} – {dateLabel(row.checkOut)}</strong>
        {kind==='overdue'&&<span className="fdc-overdue-date">Scheduled checkout has passed</span>}
       </div>
       <div className="fdc-v2-detail">
        <small><BedDouble size={14}/> Room</small>
        <strong>{row.roomNumber?'Room '+row.roomNumber:'Not assigned'}</strong>
        {needsAssignment&&<span className="fdc-issue"><AlertTriangle size={13}/> Assignment required</span>}
       </div>
      </div>
      <div className="fdc-v2-actions">
       <Link to="/reservations"
        search={{booking:row.id,...(!canOperate||action.kind==='view'?{}:{deskAction:action.kind})}}
        className="fdc-action-link fdc-v2-primary-action">
        {!canOperate?<ClipboardCheck size={16}/>:action.kind==='assign'?<BedDouble size={16}/>:action.kind==='check-in'?<LogIn size={16}/>:action.kind==='check-out'?<LogOut size={16}/>:<ClipboardCheck size={16}/>}
        {canOperate&&action.kind!=='view'&&kind==='overdue'?'Review checkout':canOperate?action.label:'View stay'} <ArrowRight size={15}/>
       </Link>
       {hotelId&&canExtend&&row.status==='checked_in'&&row.assignedRoomId&&
        <button type="button" className="fdc-v2-secondary-action" aria-haspopup="dialog"
         onClick={()=>setExtension({hotelId,record:row})}><Clock3 size={15}/> Extend stay</button>}
      </div>
      {kind==='overdue'&&row.departureFollowUp&&
       <p className="fdc-v2-handoff"><strong>Shift handoff:</strong> {row.departureFollowUp}</p>}
      {kind!=='overdue'&&canOperate&&isToday&&row.assignedRoomId&&
       (signal?.tone==='attention'||signal?.tone==='blocked'||advisoryCount>0||maintenanceNotes.isError||!noteCoverageComplete&&maintenanceNotes.isSuccess)&&
       <div className="fdc-v2-room-alert">
        <Info size={15}/>
        <div>
         <strong>{signal?.title??'Room follow-up'}</strong>
         <span>{signal?.action??(advisoryCount>0?`${advisoryCount} maintenance note(s) to review`:'Check current room notes')}</span>
        </div>
        <Link to="/rooms" search={{room:row.roomNumber??'',inspect:shouldInspect||undefined}}>
         Room details <ArrowRight size={14}/>
        </Link>
       </div>}
      {kind==='overdue'&&canExtend&&
       <div className="fdc-v2-overdue-followup">
        <span><AlertTriangle size={14}/> Confirm departure or extend the stay before closing the booking.</span>
        <DepartureFollowUp key={hotelId+'-'+row.id} bookingId={row.id}
         savedNote={row.departureFollowUp} onSaved={refresh}/>
       </div>}
     </article>;
 };
 if(!hotelId)return <>
  <Heading title="Front desk" description="Select an authorized hotel to open its operational queues."/>
  <Panel title="Hotel selection required"><p role="status">Select your hotel before loading arrivals, departures or in-house stays.</p></Panel>
 </>;
 if(manager){
  const unassigned=arrivals.isSuccess?arrivals.data.meta.unassignedCount:undefined;
  const summaryCards=[{key:'arrivals' as const,label:'Arrivals',value:count('arrivals'),Icon:LogIn},{key:'departures' as const,label:'Departures',value:count('departures'),Icon:LogOut},{key:'in_house' as const,label:'In-house',value:count('in_house'),Icon:BedDouble},{key:'overdue' as const,label:'Overdue checkouts',value:urgentCount??'—',Icon:AlertTriangle}];
  const managerTable=(queue:ManifestKind,preview:boolean)=>{
   const query=queries[queue];
   const title=queue==='in_house'?'In-house guests':queues.find(item=>item.kind===queue)!.title;
   const Icon=summaryCards.find(item=>item.key===queue)!.Icon;
   const data=query.isSuccess?query.data.data:[];
   const visible=preview?data.slice(0,queue==='in_house'||queue==='overdue'?3:5):data;
   return <section className="mdesk-panel" aria-label={title} key={queue}>
    <header className="mdesk-panel-head"><h3><Icon size={19}/>{title} <span>({count(queue)})</span></h3>
     {preview?<button className="mdesk-text-button" type="button" onClick={()=>selectQueue(queue)} aria-label={'View all '+title.toLowerCase()}>View all <ArrowRight size={15}/></button>:<button className="mdesk-text-button" type="button" onClick={showManagerOverview}>All queues <ArrowRight size={15}/></button>}
    </header>
    {!preview&&<div className="mdesk-search-row"><label className="mdesk-search"><Search size={16}/><input aria-label="Search the selected manifest" value={search} maxLength={120} placeholder="Guest, room or booking reference" onChange={event=>changeSearch(event.target.value)}/></label>{term&&<button type="button" className="mdesk-text-button" onClick={()=>changeSearch('')}>Clear search</button>}</div>}
    <QueryFeedback loading={query.isPending} error={query.error} onRetry={()=>void query.refetch()} empty={query.isSuccess&&!visible.length} emptyMessage={term?'No matching bookings.':queue==='overdue'?'No overdue checkouts.':'No '+title.toLowerCase()+' for this date.'}/>
    {!!visible.length&&<div className="mdesk-table-wrap"><table className="mdesk-table"><thead><tr><th scope="col">Guest</th><th scope="col">Room</th>{queue==='in_house'?<><th scope="col">Arrival</th><th scope="col">Departure</th></>:queue==='overdue'?<th scope="col">Departure</th>:<th scope="col">Booking ref.</th>}<th scope="col">Status</th><th scope="col">Action</th></tr></thead>
     <tbody>{visible.map(row=>{
      const action=recommendedDeskAction(queue,row);
      const status=row.assignedRoomId?statusByRoom.get(row.assignedRoomId):undefined;
      const signal=status?roomOperationalSignal(status):null;
      const notes=maintenanceNotes.isSuccess?informationalMaintenanceCount(maintenanceNotes.data.data.filter(note=>note.roomId===row.assignedRoomId)):0;
      const warning=queue==='arrivals'&&isToday&&!!row.assignedRoomId&&(signal?.tone==='attention'||signal?.tone==='blocked'||signal?.tone==='occupied'||!status||notes>0);
      const warningLabel=signal&&signal.tone!=='approved'?signal.title:notes>0?'Maintenance note (advisory)':'Readiness not verified';
      const inspect=signal?.tone==='attention'&&['Inspection needed','Readiness not verified'].includes(signal.title);
      return <tr key={row.id} className="mdesk-guest">
       <td><Link className="mdesk-guest-name" to="/reservations" search={{booking:row.id}}>{displayGuest(row)}</Link>{warning&&<Link className="mdesk-room-warning" data-priority={signal?.tone==='blocked'||signal?.tone==='occupied'?'urgent':'attention'} to="/rooms" search={{room:row.roomNumber??'',inspect:inspect||undefined}}><AlertTriangle size={12}/>{warningLabel}</Link>}</td>
       <td>{row.roomNumber||<em>Unassigned</em>}</td>
       {queue==='in_house'?<><td>{dateLabel(row.checkIn)}</td><td>{dateLabel(row.checkOut)}</td></>:queue==='overdue'?<td>{dateLabel(row.checkOut)}<small className="mdesk-due-label">12:00 hotel time</small></td>:<td className="mdesk-reference">{row.reference}</td>}
       <td><span className={'mdesk-status '+(queue==='overdue'?'mdesk-red':!row.assignedRoomId?'mdesk-neutral':row.status==='checked_in'?'mdesk-blue':'mdesk-green')}>{queue==='overdue'?'Overdue':!row.assignedRoomId?'Unassigned':row.status==='checked_in'?'In-house':'Confirmed'}</span></td>
       <td><div className="mdesk-row-actions"><Link to="/reservations" search={{booking:row.id,...(action.kind==='view'?{}:{deskAction:action.kind})}} className={'mdesk-action'+(action.kind==='check-in'||action.kind==='check-out'?' primary':'')} aria-label={action.label+' · '+displayGuest(row)}>{action.kind==='check-in'?'Check in':action.kind==='check-out'?'Check out':action.kind==='assign'?'Assign room':'View stay'}</Link>
        {!preview&&row.status==='checked_in'&&row.assignedRoomId&&<button className="mdesk-text-button" type="button" onClick={()=>setExtension({hotelId,record:row})}>Extend stay</button>}
        {!preview&&queue==='overdue'&&<div className="mdesk-followup">{row.departureFollowUp&&<p>{row.departureFollowUp}</p>}<DepartureFollowUp key={hotelId+'-'+row.id} bookingId={row.id} savedNote={row.departureFollowUp} onSaved={refresh}/></div>}
       </div></td>
      </tr>;
     })}</tbody></table></div>}
    {!preview&&query.isSuccess&&<div className="mdesk-pagination"><span>Page {page} of {Math.max(1,pages)} · {query.data.meta.total} total</span><div><button type="button" disabled={page<=1} onClick={()=>setPageByKind(prev=>({...prev,[queue]:page-1}))}>Previous</button><button type="button" disabled={page>=pages} onClick={()=>setPageByKind(prev=>({...prev,[queue]:page+1}))}>Next</button></div></div>}
   </section>;
  };
  return <div className="mdesk">
   <header className="mdesk-heading"><div><h2>Front desk</h2><p>Daily arrivals, departures and guest stay actions.</p></div><button className="icon-btn" type="button" aria-label="Refresh front desk" disabled={loadingAny||overdueTotal.isFetching} onClick={refresh}><RefreshCw size={18}/></button></header>
   <OperationalDateStrip id="fdc-date-filters" date={date} today={hotelDate} onChange={changeDate} label="Front desk operational date"/>
   {urgentCount!==undefined&&urgentCount>0&&<section className="mdesk-overdue" aria-label="Overdue checkout priority" role="status"><AlertTriangle size={22}/><strong>{urgentCount} overdue checkout{urgentCount===1?'':'s'}</strong><span>Guests are past the scheduled checkout cutoff.</span><button type="button" className="mdesk-action" aria-label="Review overdue checkouts" onClick={()=>selectQueue('overdue')}>View overdue <ArrowRight size={15}/></button></section>}
   {overdueTotal.isError&&<div className="mdesk-overdue" role="status"><AlertTriangle size={20}/><strong>Overdue checkout status unavailable</strong><button className="mdesk-action" type="button" onClick={()=>void overdueTotal.refetch()}>Retry</button></div>}
   <div className="mdesk-layout"><div className="mdesk-main">
    <section className="mdesk-metrics" aria-label="Reservation queue summary">
     {summaryCards.map(({key,label,value,Icon})=><button type="button" key={key} className="mdesk-metric" data-urgent={key==='overdue'&&!!urgentCount} aria-pressed={!managerOverview&&kind===key} aria-label={label+' '+value} onClick={()=>selectQueue(key)}><Icon size={22}/><span><small>{label}{!isToday&&key==='in_house'?' now':''}</small><strong>{value}</strong></span></button>)}
     <button className="mdesk-metric" type="button" aria-label={'Review arrivals, '+(unassigned??'unknown')+' unassigned'} onClick={()=>selectQueue('arrivals')}><ClipboardCheck size={22}/><span><small>Unassigned arrivals</small><strong>{unassigned??'—'}</strong></span></button>
    </section>
    {!isToday&&<p className="mdesk-date-note">Arrivals and departures: {dateLabel(date)} · In-house and overdue: current hotel status.</p>}
    {managerOverview?<div className="mdesk-panels">{(['arrivals','departures','in_house','overdue'] as const).map(queue=>managerTable(queue,true))}</div>:managerTable(kind,false)}
   </div>
   <aside className="mdesk-rail">
    <section className="mdesk-panel mdesk-quick" aria-label="Quick actions"><header className="mdesk-panel-head"><h3><Zap size={20}/>Quick actions</h3></header><div className="mdesk-quick-body">
     <Link className="mdesk-action primary" to="/reservations" search={{mode:'new',checkIn:date>=hotelDate?date:hotelDate}}><Plus size={17}/> New booking</Link>
     <button type="button" className="mdesk-action" onClick={()=>selectQueue('in_house')}><Clock3 size={17}/> Extend stay</button>
     <Link className="mdesk-action" to="/reservations" search={{mode:'new',checkIn:hotelDate}}><UserPlus size={17}/> Walk-in booking</Link>
     <Link className="mdesk-action" to="/rooms"><BedDouble size={17}/> Open room rack</Link>
     <Link className="mdesk-action" to="/reservations"><List size={17}/> Open bookings list</Link>
    </div></section>
    <section className="mdesk-panel mdesk-reminders" aria-label="Front desk reminders"><header className="mdesk-panel-head"><h3><ClipboardCheck size={19}/>Front-desk reminders</h3></header><div className="mdesk-reminder-body">
     {unassigned===undefined||urgentCount===undefined?<p className="mdesk-date-note">Some reminder counts are unavailable.</p>:unassigned===0&&urgentCount===0?<p className="mdesk-date-note">No assignment or overdue reminders.</p>:null}
     {!!unassigned&&<button type="button" className="mdesk-reminder" onClick={()=>selectQueue('arrivals')}><BedDouble size={16}/><span>Assign rooms for {unassigned} arrival{unassigned===1?'':'s'}</span><ChevronRight size={15}/></button>}
     {!!urgentCount&&<button type="button" className="mdesk-reminder" onClick={()=>selectQueue('overdue')}><AlertTriangle size={16}/><span>Follow up on {urgentCount} overdue checkout{urgentCount===1?'':'s'}</span><ChevronRight size={15}/></button>}
     {overdue.isSuccess&&overdue.data.data.filter(row=>row.departureFollowUp).slice(0,3).map(row=><button type="button" className="mdesk-reminder" key={row.id} onClick={()=>selectQueue('overdue')}><ClipboardCheck size={16}/><span>{displayGuest(row)}<small>{row.departureFollowUp}</small></span><ChevronRight size={15}/></button>)}
    </div></section>
   </aside></div>
   {extension?.hotelId===hotelId&&<StayExtensionModal key={hotelId+'-'+extension.record.id} hotelId={hotelId} record={extension.record} today={hotelDate} openOnEntry hideTrigger onDismiss={()=>setExtension(null)} onSaved={()=>client.invalidateQueries({queryKey:['live'],refetchType:'active'})}/>}
  </div>;
 }
 return <div className={reception?'fdc-reception':'fdc-manager'}>
  {reception?<header className="rd-heading"><div><h2>Front Desk</h2><p>Arrivals, departures and today's guests</p></div><button type="button" className="rd-refresh" aria-label="Refresh front desk" disabled={loadingAny} onClick={refresh}><RefreshCw size={18}/></button></header>:<div className="fdc-heading">
   <Heading title="Front desk" description="Your daily arrival, departure and room-assignment workspace."/>
   <div className="fdc-heading-actions">
    <button type="button" className="btn-inline" disabled={loadingAny} onClick={refresh}><RefreshCw size={15}/> {loadingAny?'Refreshing…':'Refresh'}</button>
    {canCreate&&<Link to="/reservations" search={{mode:"new",checkIn:date}} className="btn-primary fdc-new-booking"><Plus size={16}/> New booking</Link>}
   </div>
  </div>}
  {reception&&<div className="fdc-simple-controls">
   <div className="fdc-simple-tabs" role="group" aria-label="Front desk views">
    <button type="button" aria-pressed={combined} onClick={selectToday}><CalendarDays size={17}/> {combined&&!isToday?'Schedule':'Today'}</button>
    <button type="button" aria-pressed={!combined&&kind==='in_house'} onClick={()=>selectQueue('in_house')}><BedDouble size={17}/> In house</button>
    {canViewWorkspacePath(role,'/reservations',permissions)&&<Link to="/reservations"><CalendarDays size={17}/> Bookings</Link>}
    {canViewWorkspacePath(role,'/group-reservations',permissions)&&<Link to="/group-reservations"><Users size={17}/> Groups</Link>}
   </div>
   <div className="fdc-simple-search"><label className="search-box"><Search size={17}/><input type="search" aria-label="Search guest, booking or room" placeholder="Search guest, booking or room" maxLength={120} value={search} onChange={event=>changeSearch(event.target.value)}/></label>
    <button className="btn-inline" type="button" aria-expanded={filtersOpen} aria-controls="fdc-date-filters" onClick={()=>setFiltersOpen(v=>!v)}><SlidersHorizontal size={17}/> Filter</button></div>
   {!isToday&&<p className="fdc-selected-date">Showing {dateLabel(date)} <button className="btn-inline" type="button" onClick={selectToday}>Return to today</button></p>}
   {!combined&&<div className="fdc-simple-queues" role="group" aria-label="Front desk queue filters">{queues.map(item=><button type="button" key={item.kind} aria-pressed={kind===item.kind} onClick={()=>selectQueue(item.kind)}>{item.title}</button>)}</div>}
  </div>}
  <OperationalDateStrip id="fdc-date-filters" date={date} today={hotelDate} onChange={changeDate} label="Front desk operational date" hidden={reception&&!filtersOpen}/>
  {!reception&&<section className="fdc-stats" aria-label="Reservation queue summary">
   <button type="button" className={'fdc-stat'+(kind==='arrivals'?' active':'')} onClick={()=>{setKind('arrivals');setSearch('');}} aria-pressed={kind==='arrivals'}><LogIn size={20}/><span>Expected arrivals</span><strong>{count('arrivals')}</strong><small>Confirmed for this date</small>
   </button>
   <button type="button" className={'fdc-stat'+(kind==='departures'?' active':'')} onClick={()=>{setKind('departures');setSearch('');}} aria-pressed={kind==='departures'}><LogOut size={20}/><span>Due departures</span><strong>{count('departures')}</strong><small>Checked-in stays due</small>
   </button>
   <button type="button" className={'fdc-stat'+(kind==='in_house'?' active':'')} onClick={()=>{setKind('in_house');setSearch('');}} aria-pressed={kind==='in_house'}><Users size={20}/><span>In-house</span><strong>{count('in_house')}</strong><small>Registered stays</small>
   </button>
   <button type="button" className={'fdc-stat overdue'+(kind==='overdue'?' active':'')+(overdue.isSuccess&&count('overdue')!==0?' has-overdue':'')}
    onClick={()=>{setKind('overdue');setPageByKind(prev=>({...prev,overdue:1}));setSearch('');}}
    aria-pressed={kind==='overdue'} aria-label={'View overdue checkouts, '+count('overdue')}>
    <AlertTriangle size={20}/><span>Overdue checkouts</span>
    <strong>{count('overdue')}</strong>
    <small>Past scheduled departure · needs follow-up</small>
   </button>
  </section>}
  {urgentCount!==undefined&&urgentCount>0&&<section className="fdc-overdue-alert" aria-label="Overdue checkout priority" role="status">
   <div className="fdc-overdue-alert-icon"><AlertTriangle size={22}/></div>
   <div className="fdc-overdue-alert-copy">
    <strong>{urgentCount} overdue checkout{urgentCount===1?' needs':'s need'} attention</strong>
    <p>{reception?'Guest checkout time has passed.':'Guests remain checked in past their scheduled departure cutoff. Confirm occupancy, contact the guest or extend the stay before recording checkout.'}</p>
   </div>
   <button type="button" className="fdc-overdue-alert-action" aria-label="Review overdue checkouts" onClick={()=>selectQueue('overdue')}>
    {reception?'Review':'Review overdue checkouts'} <ArrowRight size={15}/>
   </button>
  </section>}
  {reception&&overdueTotal.isError&&<p className="fdc-alert-unavailable" role="status">Overdue checkout status unavailable. <button type="button" className="btn-inline" onClick={()=>void overdueTotal.refetch()}>Retry</button></p>}
  {arrivals.isSuccess&&(arrivals.data.meta.unassignedCount??0)>0&&<div className="fdc-assign-hint">
   <BedDouble size={16}/> {reception?<span>{arrivals.data.meta.unassignedCount} unassigned arrival{arrivals.data.meta.unassignedCount===1?'':'s'}</span>:<span>{arrivals.data.meta.unassignedCount} arrival{arrivals.data.meta.unassignedCount===1?'':'s'} need a room assignment for {dateLabel(date)}.</span>}
   <button type="button" onClick={()=>selectQueue('arrivals')}>{reception?'Assign rooms':'Review arrivals'} <ArrowRight size={14}/></button>
  </div>}
  {combined?<div className="fdc-today-queues">
   {([{kind:'arrivals',title:'Arrivals',query:arrivals,Icon:LogIn},{kind:'departures',title:'Departures',query:departures,Icon:LogOut}] as const).map(({kind:queue,title,query,Icon})=><section className="fdc-today-section" key={queue} aria-label={title}>
    <div className="fdc-today-head"><h3><Icon size={20}/>{title} <span>({query.isSuccess?query.data.meta.total:'—'})</span></h3><button type="button" className="rd-view-all" onClick={()=>{setTodayView(false);setKind(queue);setPageByKind(prev=>({...prev,[queue]:1}));}}>View all <ChevronRight size={16}/></button></div>
    <QueryFeedback loading={query.isPending} error={query.error} onRetry={()=>void query.refetch()} empty={query.isSuccess&&query.data.data.length===0} emptyMessage={term?'No matching bookings.':'No '+title.toLowerCase()+' scheduled.'}/>
    {query.isSuccess&&query.data.data.slice(0,3).map(row=>renderRow(row,queue))}
   </section>)}
  </div>:<section className="fdc-workspace" aria-label="Daily front desk work queue">
   <div className="fdc-workspace-heading">
    <div><h3>{kind==='overdue'?'Overdue checkouts':'Reservations for '+dateLabel(date)}</h3>
     {!reception&&<p>{kind==='overdue'?'Still checked in after noon on the scheduled departure date, or due on an earlier date. This queue follows the hotel clock.':'Choose a queue, find a guest, then take the next action.'}</p>}</div>
    <Link to="/room-calendar" className="fdc-secondary-link"><BedDouble size={16}/> Room calendar <ArrowRight size={14}/></Link>
   </div>
   {!reception&&<div className="fdc-controls">
    <div className="view-switch" role="group" aria-label="Live front desk queues">
     {queues.map(item=><button type="button" key={item.kind} aria-pressed={kind===item.kind}
      className={kind===item.kind?'selected':''} onClick={()=>{setKind(item.kind);setSearch('');}}>
      {item.title} <span className="desk-tab-count">{count(item.kind)}</span>
     </button>)}
    </div>
    <label className="search-box"><Search size={16}/><input value={search}
     aria-label="Search the selected manifest" placeholder="Guest, room or reference"
     maxLength={120} onChange={event=>{setPageByKind(prev=>({...prev,[kind]:1}));setSearch(event.target.value);}}/></label>
    {search.trim()&&<button type="button" className="btn-inline" onClick={()=>{setPageByKind(prev=>({...prev,[kind]:1}));setSearch('');}}>Clear search</button>}
   </div>}
   <QueryFeedback loading={current.isPending} error={current.error} onRetry={()=>void current.refetch()}
    empty={current.isSuccess&&filtered.length===0}
    emptyMessage={kind==='overdue'?(term?'No matching overdue checkouts.':'No overdue checkouts to follow up.') :term?'No matches in this queue on the selected date.':'No reservations in this queue on the selected date.'}/>
   {!reception&&kind!=='overdue'&&isToday&&canOperate&&<div className="fdc-room-notice"><Info size={16}/>
    <p><strong>Current room checks:</strong> Active inventory restrictions and inspection/cleaning concerns are shown below when available.
     Maintenance work-order notes are informational and do not automatically block bookings. Always confirm availability at check-in.</p></div>}
   {!reception&&kind!=='overdue'&&!isToday&&<div className="fdc-room-notice"><Info size={16}/>
    <p>Room conditions are checked on the hotel’s current date. This future or past schedule does not guarantee a room’s cleaning, inspection, or maintenance status.</p></div>}
   {current.isSuccess&&filtered.length>0&&<div className="fdc-queue" aria-live="polite">
    {filtered.map(row=>renderRow(row,kind))}
   </div>}
   {current.isSuccess&&<div className="fdc-pagination">
    <span>Page {page} of {Math.max(1,pages)} · {current.data.meta.total} total</span>
    <div>
     <button type="button" className="btn-inline" disabled={page<=1} onClick={()=>setPageByKind(prev=>({...prev,[kind]:page-1}))}>Previous</button>
     <button type="button" className="btn-inline" disabled={page>=pages} onClick={()=>setPageByKind(prev=>({...prev,[kind]:page+1}))}>Next</button>
    </div>
   </div>}
  </section>}
  {extension?.hotelId===hotelId&&<StayExtensionModal key={hotelId+'-'+extension.record.id}
   hotelId={hotelId} record={extension.record} today={hotelDate} openOnEntry hideTrigger
   onDismiss={()=>setExtension(null)}
   onSaved={()=>client.invalidateQueries({queryKey:['live'],refetchType:'active'})}/>}
  {reception&&canCreate&&<div className="rd-booking-bar"><Link to="/reservations" search={{mode:'new',checkIn:date}} className="rd-new-booking"><Plus size={19}/> New booking</Link></div>}
  {!reception&&<p className="fdc-safety-note"><AlertTriangle size={17}/>
   Actions open the existing guarded reservation workflow for review and confirmation. This screen does not verify room cleanliness, cash collection or actual physical occupancy.
  </p>}
 </div>;
}

function DepartureFollowUp({bookingId,savedNote,onSaved}:{
 bookingId:string;savedNote?:string|null;onSaved:()=>void;
}){
 const [note,setNote]=useState('');
 const [busy,setBusy]=useState(false);
 const [feedback,setFeedback]=useState('');
 return <details>
  <summary>{savedNote?'Update follow-up':'Flag for follow-up'}</summary>
  <p>Leave the next shift a note if the guest’s departure still needs confirmation.</p>
  <form onSubmit={async event=>{
   event.preventDefault();
   if(busy||!note.trim())return;
   setBusy(true);setFeedback('');
   try{
    await requestJson(hotelPath('/bookings/'+encodeURIComponent(bookingId)+'/departure-follow-up'),{
     method:'POST',body:{note:note.trim()},
    });
    setNote('');setFeedback('Follow-up saved.');onSaved();
   }catch(cause){
    setFeedback(cause instanceof Error?cause.message:'Unable to save the follow-up.');
   }finally{setBusy(false);}
  }}>
   <label>Next shift note<textarea className="wizard-input" required maxLength={500}
    value={note} onChange={event=>setNote(event.target.value)}
    placeholder="Guest contact, departure check, or extension request"/></label>
   <button type="submit" className="btn-inline" disabled={busy||!note.trim()}>{busy?'Saving…':'Save follow-up'}</button>
   {feedback&&<p role="status">{feedback}</p>}
  </form>
 </details>;
}
