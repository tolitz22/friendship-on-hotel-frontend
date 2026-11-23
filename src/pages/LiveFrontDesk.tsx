import {StayExtensionModal} from '../components/StayExtensionModal';
import {useEffect,useMemo,useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {useQueryClient} from '@tanstack/react-query';
import {Link,useSearch} from '@tanstack/react-router';
import {
 ArrowLeft,ArrowRight,BedDouble,CalendarDays,LogIn,LogOut,
 Search,Users,AlertTriangle,RefreshCw,ClipboardCheck,Plus,Clock3,ShieldAlert,Info,
} from 'lucide-react';
import {useLiveManifest} from '../api/liveFrontDesk';
import {useRoomInventoryStatus} from '../api/roomInventoryStatus';
import {roomOperationalSignal,informationalMaintenanceCount} from '../features/rooms/roomOperationalSignals';
import {listMaintenance,parseLiveMaintenance} from '../api/liveMaintenance';
import {useLiveProperty} from '../api/liveCatalogQueries';
import {requestJson} from '../api/http';
import {hotelPath,readSession} from '../api/session';
import {useHotelAuth} from '../components/AuthProvider';
import {selectedRole} from '../features/workspaces/roleNavigation';
import type {ManifestKind,ManifestEntry} from '../api/liveFrontDesk';
import {recommendedDeskAction} from '../features/front-desk/deskActions';
import {Heading,Panel,Status} from '../components/ui';
import {QueryFeedback} from '../components/QueryFeedback';
import {addDays,hotelToday} from '../features/reservations/calendarDate';
import {dateLabel,statusLabel} from '../lib/format';

const queues:{kind:ManifestKind;title:string}[]=[
 {kind:'arrivals',title:'Arrivals'},
 {kind:'departures',title:'Departures'},
 {kind:'overdue',title:'Overdue checkouts'},
 {kind:'in_house',title:'In-house'},
];
const displayGuest=(record:ManifestEntry)=>record.guestName?.trim()||'Guest name unavailable';

export function LiveFrontDesk(){
 const {queue:initialQueue}=useSearch({from:'/front-desk'});
 const property=useLiveProperty();
 const hotelDate=hotelToday(new Date(),property.data?.data.timeZone??'Asia/Manila');
 const [date,setDate]=useState(hotelToday);
 const [kind,setKind]=useState<ManifestKind>(initialQueue??'arrivals');
 const [pageByKind,setPageByKind]=useState<Record<ManifestKind,number>>({
  arrivals:1,departures:1,in_house:1,overdue:1,
 });
 const [search,setSearch]=useState('');
 const [extension,setExtension]=useState<{hotelId:string;record:ManifestEntry}|null>(null);
 const client=useQueryClient();
 const {hotelId}=readSession();
 const {user}=useHotelAuth();
 const role=selectedRole(user?.hotels,hotelId);
 const canOperate=role==='admin'||role==='front_desk';
 const term=search.trim();
 const arrivals=useLiveManifest(date,'arrivals',pageByKind.arrivals,20,kind==='arrivals'?term:undefined);
 const departures=useLiveManifest(date,'departures',pageByKind.departures,20,kind==='departures'?term:undefined);
 const inHouse=useLiveManifest(date,'in_house',pageByKind.in_house,20,kind==='in_house'?term:undefined);
 const overdue=useLiveManifest(hotelDate,'overdue',pageByKind.overdue,20,kind==='overdue'?term:undefined);
 const queries={arrivals,departures,in_house:inHouse,overdue};
 const current=queries[kind];
 const rows=current.isSuccess?current.data.data:[];
 // Room-readiness evidence describes the property's CURRENT date only.
 // Never show today's inspection snapshot as the status of a future stay.
 const isToday=date===hotelDate;
 const assignedRoomIds=useMemo(()=>Array.from(new Set(rows.flatMap(row=>
  row.assignedRoomId?[row.assignedRoomId]:[]))),[rows]);
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
 useEffect(()=>{changeDate(hotelDate);setKind(initialQueue??'arrivals');},[hotelId,hotelDate,initialQueue]);
 const refresh=()=>void Promise.all([
  client.invalidateQueries({queryKey:['live','front-desk','manifest',hotelId]}),
  client.invalidateQueries({queryKey:['live','room-inventory-status',hotelId]}),
  client.invalidateQueries({queryKey:['live','front-desk','maintenance-notes',hotelId]}),
 ]);
 if(!hotelId)return <>
  <Heading title="Front desk" description="Select an authorized hotel to open its operational queues."/>
  <Panel title="Hotel selection required"><p role="status">Select your hotel before loading arrivals, departures or in-house stays.</p></Panel>
 </>;
 return <>
  <div className="fdc-heading">
   <Heading title="Front desk" description="Your daily arrival, departure and room-assignment workspace."/>
   <div className="fdc-heading-actions">
    <button type="button" className="btn-inline" disabled={loadingAny} onClick={refresh}><RefreshCw size={15}/> {loadingAny?'Refreshing…':'Refresh'}</button>
    {canOperate&&<Link to="/reservations" search={{mode:"new",checkIn:date}} className="btn-primary"><Plus size={16}/> New booking</Link>}
   </div>
  </div>
  <div className="fdc-date-strip">
   <div className="desk-date-nav">
    <button type="button" className="icon-btn" aria-label="Previous date" onClick={()=>changeDate(addDays(date,-1))}><ArrowLeft size={16}/></button>
    <button type="button" className="btn-inline" onClick={()=>changeDate(hotelDate)}>Today</button>
    <button type="button" className="icon-btn" aria-label="Next date" onClick={()=>changeDate(addDays(date,1))}><ArrowRight size={16}/></button>
    <label><CalendarDays size={16}/><input type="date" aria-label="Front desk operational date"
     value={date} onChange={event=>changeDate(event.target.value||hotelDate)}/></label>
   </div>
   <span><Clock3 size={15}/> {dateLabel(date)} · Hotel-local date</span>
  </div>
  <section className="fdc-stats" aria-label="Reservation queue summary">
   <button type="button" className={'fdc-stat'+(kind==='arrivals'?' active':'')} onClick={()=>{setKind('arrivals');setSearch('');}} aria-pressed={kind==='arrivals'}><LogIn size={20}/><span>Expected arrivals</span><strong>{count('arrivals')}</strong><small>Confirmed for this date</small>
   </button>
   <button type="button" className={'fdc-stat'+(kind==='departures'?' active':'')} onClick={()=>{setKind('departures');setSearch('');}} aria-pressed={kind==='departures'}><LogOut size={20}/><span>Due departures</span><strong>{count('departures')}</strong><small>Checked-in stays due</small>
   </button>
   <button type="button" className={'fdc-stat'+(kind==='in_house'?' active':'')} onClick={()=>{setKind('in_house');setSearch('');}} aria-pressed={kind==='in_house'}><Users size={20}/><span>In-house</span><strong>{count('in_house')}</strong><small>Registered stays</small>
   </button>
   <button type="button" className="fdc-stat attention" onClick={()=>{setKind('arrivals');setPageByKind(prev=>({...prev,arrivals:1}));setSearch('');}}>
    <AlertTriangle size={20}/><span>Need room assignment</span>
    <strong>{arrivals.data?.meta.unassignedCount??'—'}</strong>
    <small>All arrivals on the selected date</small>
   </button>
  </section>
  <section className="fdc-workspace" aria-label="Daily front desk work queue">
   <div className="fdc-workspace-heading">
    <div><h3>{kind==='overdue'?'Overdue checkouts':'Reservations for '+dateLabel(date)}</h3>
     <p>{kind==='overdue'?'Still checked in after noon on the scheduled departure date, or due on an earlier date. This queue follows the hotel clock.':'Choose a queue, find a guest, then take the next action.'}</p></div>
    <Link to="/room-calendar" className="fdc-secondary-link"><BedDouble size={16}/> Room calendar <ArrowRight size={14}/></Link>
   </div>
   <div className="fdc-controls">
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
   </div>
   <QueryFeedback loading={current.isPending} error={current.error} onRetry={()=>void current.refetch()}
    empty={current.isSuccess&&filtered.length===0}
    emptyMessage={kind==='overdue'?(term?'No matching overdue checkouts.':'No overdue checkouts to follow up.') :term?'No matches in this queue on the selected date.':'No reservations in this queue on the selected date.'}/>
   {kind!=='overdue'&&isToday&&canOperate&&<div className="fdc-room-notice"><Info size={16}/>
    <p><strong>Current room checks:</strong> Active inventory restrictions and inspection/cleaning concerns are shown below when available.
     Maintenance work-order notes are informational and do not automatically block bookings. Always confirm availability at check-in.</p></div>}
   {kind!=='overdue'&&!isToday&&<div className="fdc-room-notice"><Info size={16}/>
    <p>Room conditions are checked on the hotel’s current date. This future or past schedule does not guarantee a room’s cleaning, inspection, or maintenance status.</p></div>}
   {current.isSuccess&&filtered.length>0&&<div className="fdc-queue" aria-live="polite">
    {filtered.map(row=>{
     const action=recommendedDeskAction(kind,row);
     const needsAssignment=kind==='arrivals'&&!row.assignedRoomId;
     const status=row.assignedRoomId?statusByRoom.get(row.assignedRoomId):undefined;
     const signal=status?roomOperationalSignal(status):null;
     const relatedNotes=maintenanceNotes.isSuccess&&row.assignedRoomId
      ?maintenanceNotes.data.data.filter(note=>note.roomId===row.assignedRoomId):[];
     const advisoryCount=informationalMaintenanceCount(relatedNotes);
     const noteCoverageComplete=maintenanceNotes.isSuccess&&maintenanceNotes.data.meta.totalPages<=1;
     return <article className="fdc-guest-row" key={row.id}>
      <div className="fdc-guest-primary">
       <strong>{displayGuest(row)}</strong><span>{row.reference}</span>
      </div>
      <div className="fdc-guest-stay">
       <small>Stay</small><strong>{dateLabel(row.checkIn)} – {dateLabel(row.checkOut)}</strong>
      </div>
      <div className="fdc-guest-room">
       <small>Room</small>
       <strong>{row.roomNumber??'Not assigned'}</strong>
       {needsAssignment&&<span className="fdc-issue"><AlertTriangle size={13}/> Assignment needed</span>}
       {kind!=='overdue'&&canOperate&&isToday&&row.assignedRoomId&&<div className="fdc-room-signals" aria-label={'Current room checks for '+(row.roomNumber??'assigned room')}>
        {signal?<div className={'fdc-room-signal fdc-signal-'+signal.tone}>
         {signal.tone==='blocked'?<ShieldAlert size={14}/>:signal.tone==='approved'?<ClipboardCheck size={14}/>:<Info size={14}/>}
         <span><strong>{signal.title}</strong><small>{signal.action}</small></span>
        </div>:<span className="fdc-check-unavailable">{roomStatus.isPending?'Checking room status…':'Room status not available · verify before check-in'}</span>}
        {advisoryCount>0&&<span className="fdc-maint-note"><Info size={13}/>{advisoryCount} open room-impact work order{advisoryCount===1?'':'s'} (note only)</span>}
        <Link to="/rooms" search={{room:row.roomNumber??''}} className="ops-room-link">Review room details <ArrowRight size={13}/></Link>
        {maintenanceNotes.isError&&<span className="fdc-check-unavailable">Repair notes could not be checked.</span>}
        {maintenanceNotes.isSuccess&&!noteCoverageComplete&&<span className="fdc-check-unavailable">Repair notes may be incomplete; see Maintenance.</span>}
        </div>}
      </div>
      <div className="fdc-guest-status">
       <small>Status</small>{kind==='overdue'?<span className="fdc-issue"><AlertTriangle size={13}/> Checkout overdue</span>:<Status value={statusLabel(row.status)}/>}
      </div>
      <div className="fdc-guest-actions">
       <Link to="/reservations" search={{booking:row.id,...(!canOperate||action.kind==='view'?{}:{deskAction:action.kind})}} className="fdc-action-link">
        {!canOperate?<ClipboardCheck size={16}/>:action.kind==='assign'?<BedDouble size={16}/>:action.kind==='check-in'?<LogIn size={16}/>:action.kind==='check-out'?<LogOut size={16}/>:<ClipboardCheck size={16}/>} 
        {canOperate&&kind==='overdue'?'Complete checkout':canOperate?action.label:'View reservation'} <ArrowRight size={15}/>
       </Link>
       <span>{canOperate&&kind==='overdue'?'Confirm the guest has left before checking out.':canOperate?action.hint:'Read-only staff review. Contact a manager for changes.'}</span>
       {canOperate&&row.status==='checked_in'&&row.assignedRoomId&&
        <button type="button" className="btn-inline" aria-haspopup="dialog"
         onClick={()=>setExtension({hotelId,record:row})}>Extend stay <ArrowRight size={15}/></button>}
       {kind==='overdue'&&<>
        {row.departureFollowUp&&<p><strong>Shift handoff</strong><br/>{row.departureFollowUp}</p>}
        {canOperate&&<DepartureFollowUp key={hotelId+'-'+row.id} bookingId={row.id}
         savedNote={row.departureFollowUp} onSaved={refresh}/>}
       </>}
      </div>
     </article>;
    })}
   </div>}
   {current.isSuccess&&<div className="fdc-pagination">
    <span>Page {page} of {Math.max(1,pages)} · {current.data.meta.total} total</span>
    <div>
     <button type="button" className="btn-inline" disabled={page<=1} onClick={()=>setPageByKind(prev=>({...prev,[kind]:page-1}))}>Previous</button>
     <button type="button" className="btn-inline" disabled={page>=pages} onClick={()=>setPageByKind(prev=>({...prev,[kind]:page+1}))}>Next</button>
    </div>
   </div>}
  </section>
  {extension?.hotelId===hotelId&&<StayExtensionModal key={hotelId+'-'+extension.record.id}
   hotelId={hotelId} record={extension.record} today={hotelDate} openOnEntry hideTrigger
   onDismiss={()=>setExtension(null)} onSaved={()=>{
    void client.invalidateQueries({queryKey:['live'],refetchType:'active'});
   }}/>}
  <p className="fdc-safety-note"><AlertTriangle size={17}/>
   Actions open the existing guarded reservation workflow for review and confirmation. This screen does not verify room cleanliness, cash collection or actual physical occupancy.
  </p>
 </>;
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
     method:'POST',body:JSON.stringify({note:note.trim()}),
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
