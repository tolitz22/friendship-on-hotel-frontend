import {useEffect,useState,type FormEvent} from 'react';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {AlertTriangle,ArrowRight,CheckCircle2,ClipboardList,Clock3,History,Info,Plus,RefreshCcw,Search,ShieldAlert,UserRound,Wrench,X} from 'lucide-react';
import {useHotelAuth} from '../components/AuthProvider';
import {useLiveRooms} from '../api/liveCatalogQueries';
import {createMaintenance,listMaintenance,maintenanceHistory,
 type LiveWorkOrder,type MaintenancePriority,type MaintenanceStatus,type MaintenanceFilters,
 parseLiveMaintenance,parseMaintenanceHistory,patchValidatedMaintenance,
 mayUpdateMaintenance} from '../api/liveMaintenance';
import {ApiError} from '../api/http';
import {readSession} from '../api/session';
import {listHotelStaff} from '../api/liveStaff';
import {Heading} from '../components/ui';
import {QueryFeedback} from '../components/QueryFeedback';

const priorities:MaintenancePriority[]=['low','medium','high','urgent'];
const statusLabels:Record<MaintenanceStatus,string>={open:'Open',in_progress:'In progress',resolved:'Resolved',closed:'Closed'};
const priorityLabels:Record<MaintenancePriority,string>={low:'Low',medium:'Medium',high:'High',urgent:'Urgent'};
const transitions:Record<MaintenanceStatus,MaintenanceStatus[]>={
 open:['in_progress','resolved'],in_progress:['resolved'],resolved:['closed'],closed:[]
};
type Draft={roomId:string;title:string;description:string;priority:MaintenancePriority;
 status:MaintenanceStatus;assignedTo:string;assignedUserId:string;affectsRoom:boolean;note:string};
const newDraft=():Draft=>({
 roomId:'',title:'',description:'',priority:'medium',status:'open',assignedTo:'',assignedUserId:'',affectsRoom:false,note:'',
});
const fromOrder=(order:LiveWorkOrder):Draft=>({
 roomId:order.roomId,title:order.title,description:order.description,
 priority:order.priority,status:order.status,assignedTo:order.assignedTo??'',assignedUserId:order.assignedUserId??'',
 affectsRoom:order.affectsRoom,note:'',
});

export function LiveMaintenance(){
 const {hotelId,user}=useHotelAuth();
 const role=user?.hotels.find(h=>h.id===hotelId)?.role;
 const admin=role==='admin';
 const staff=useQuery({queryKey:['hotel-staff',hotelId],queryFn:listHotelStaff,enabled:admin});
 const queryClient=useQueryClient();
 const [page,setPage]=useState(1);
 const [statusFilter,setStatusFilter]=useState<MaintenanceStatus|''>('');
 const [priorityFilter,setPriorityFilter]=useState<MaintenancePriority|''>('');
 const [search,setSearch]=useState('');
 const [mineOnly,setMineOnly]=useState(false);
 const filters:MaintenanceFilters={...(statusFilter?{status:statusFilter}:{}),...(priorityFilter?{priority:priorityFilter}:{})};
 const orders=useQuery({
  queryKey:['live-maintenance',hotelId,page,statusFilter,priorityFilter],
  enabled:!!hotelId,retry:false,
  queryFn:async()=>parseLiveMaintenance(await listMaintenance(page,20,filters),hotelId!),
 });
 // Separate status totals are independent of the queue's selected tab and priority.
 const statusTotals=useQuery({
  queryKey:['live-maintenance-status-totals',hotelId],
  enabled:!!hotelId,
  queryFn:async()=>{
   const [open,inProgress,resolved,closed]=await Promise.all([
    listMaintenance(1,1,{status:'open'}),
    listMaintenance(1,1,{status:'in_progress'}),
    listMaintenance(1,1,{status:'resolved'}),
    listMaintenance(1,1,{status:'closed'}),
   ]);
   const totals=[open,inProgress,resolved,closed].map(result=>parseLiveMaintenance(result,hotelId!).meta.total);
   return {open:totals[0],in_progress:totals[1],resolved:totals[2],closed:totals[3]};
  },retry:false,
 });
 const rooms=useLiveRooms({page:1,perPage:100});
 const [selected,setSelected]=useState<LiveWorkOrder|null>(null);
 const [draft,setDraft]=useState<Draft|null>(null);
 const [saving,setSaving]=useState(false);
 const [error,setError]=useState('');
 const [fieldErrors,setFieldErrors]=useState<Record<string,string[]>>({});
 const [historyVisible,setHistoryVisible]=useState(false);
 const [historyPage,setHistoryPage]=useState(1);
 const history=useQuery({
  queryKey:['maintenance-history',hotelId,selected?.id,historyPage],
  queryFn:async()=>parseMaintenanceHistory(await maintenanceHistory(selected!.id,historyPage)),
  enabled:!!selected&&historyVisible,
 });
 useEffect(()=>{
  setSelected(null);setDraft(null);setHistoryVisible(false);setError('');setPage(1);
  setStatusFilter('');setPriorityFilter('');setSearch('');setMineOnly(false);setHistoryPage(1);
 },[hotelId]);
 const openCreate=()=>{
  setSelected(null);setDraft(newDraft());setHistoryVisible(false);setError('');setFieldErrors({});setHistoryPage(1);
 };
 const openEdit=(order:LiveWorkOrder)=>{
  setSelected(order);setDraft(fromOrder(order));setHistoryVisible(false);setError('');setFieldErrors({});setHistoryPage(1);
 };
 const close=()=>{setDraft(null);setSelected(null);setError('');setHistoryVisible(false);};
 const change=<K extends keyof Draft>(field:K,value:Draft[K])=>
  setDraft(current=>current?{...current,[field]:value}:current);
 async function submit(e:FormEvent<HTMLFormElement>){
  e.preventDefault();
  const assigned=!!selected&&role==='maintenance'&&selected.assignedUserId===user?.id;
  if(!(admin||assigned)||!draft||saving)return;
  setSaving(true);setError('');setFieldErrors({});
  try{
   if(selected){
    await patchValidatedMaintenance(hotelId!,selected,admin?{
     expectedRevision:selected.revision,priority:draft.priority,status:draft.status,
     assignedTo:draft.assignedTo.trim()||null,assignedUserId:draft.assignedUserId||null,
     affectsRoom:draft.affectsRoom,note:draft.note.trim()||null,
    }:{expectedRevision:selected.revision,status:draft.status,note:draft.note.trim()||null});
   }else{
    await createMaintenance({
     roomId:draft.roomId,title:draft.title.trim(),description:draft.description.trim(),
     priority:draft.priority,assignedTo:draft.assignedTo.trim()||null,
     assignedUserId:draft.assignedUserId||null,affectsRoom:draft.affectsRoom,note:draft.note.trim()||null,
    });
   }
   if(readSession().hotelId!==hotelId)return;
   setPage(1);close();
   // A refresh error must not make a committed work order look unsuccessful.
   void Promise.all([
    queryClient.invalidateQueries({queryKey:['live-maintenance',hotelId]}),
    queryClient.invalidateQueries({queryKey:['live-maintenance-status-totals',hotelId]}),
    queryClient.invalidateQueries({queryKey:['maintenance-history',hotelId]}),
    queryClient.invalidateQueries({queryKey:['live','maintenance-for-housekeeping',hotelId]}),
    queryClient.invalidateQueries({queryKey:['live','readiness-dashboard',hotelId]}),
    queryClient.invalidateQueries({queryKey:['live','room-readiness',hotelId]}),
   ]).catch(()=>{});
  }catch(caught){
   // Do not show a previous property's late failure in the selected hotel.
   if(readSession().hotelId!==hotelId)return;
   if(caught instanceof ApiError){
    setFieldErrors(caught.fieldErrors??{});
    setError(caught.status===409?'This ticket changed. Close it and reopen the latest record before saving.':caught.message);
   }else setError(caught instanceof Error?caught.message:'Unable to save work order.');
  }finally{setSaving(false);}
 }
 const data=orders.isSuccess?orders.data.data:[];
 const term=search.trim().toLocaleLowerCase();
 const visible=data.filter(order=>(!mineOnly||order.assignedUserId===user?.id)&&(!term||[
  order.id,order.roomNumber,order.title,order.description,order.assignedTo??'',
 ].some(value=>value.toLocaleLowerCase().includes(term))));
 const canUpdate=(order:LiveWorkOrder)=>mayUpdateMaintenance(order,admin,role,user?.id??null);
 const maySave=admin||(!!selected&&canUpdate(selected));
 const hasFilters=!!statusFilter||!!priorityFilter||!!term||mineOnly;
 const clearFilters=()=>{setPage(1);setStatusFilter('');setPriorityFilter('');setSearch('');setMineOnly(false);};
 const assignedName=(order:LiveWorkOrder)=>order.assignedUserId
  ?order.assignedUserId===user?.id?'You':admin?staff.data?.data.find(m=>m.userId===order.assignedUserId)?.name??'Assigned technician':'Assigned technician'
  :order.assignedTo??'Not assigned';
 return <>
  <div className="mnt-page-intro">
   <div><span className="rr-eyebrow">DAILY OPERATIONS · MAINTENANCE</span>
    <Heading title="Maintenance" description="Track repairs, identify urgent work, assign technicians and record progress."/></div>
   {admin&&<button type="button" className="btn-primary" onClick={openCreate}><Plus size={16}/> New work order</button>}
  </div>
  <div className="mnt-guidance"><Info size={18}/><p><strong>Room-impact notes do not automatically block bookings.</strong>
   Reported room issues must be reviewed separately before staff rely on a room's availability or inspection approval.</p></div>
  <section className="mnt-work-summary" aria-label="Hotel-wide maintenance workload">
   <div className="mnt-work-heading">
    <div><span className="rr-eyebrow">HOTEL-WIDE WORK ORDERS</span><h3>Maintenance workload</h3>
     <p>These counts cover the hotel, even when you switch the queue's status or priority filters.</p></div>
    <button type="button" className="rr-secondary-action" disabled={orders.isFetching||statusTotals.isFetching}
     onClick={()=>void Promise.all([orders.refetch(),statusTotals.refetch()])}>
     <RefreshCcw size={16}/>{orders.isFetching||statusTotals.isFetching?'Refreshing…':'Refresh work orders'}</button>
   </div>
   <div className="mnt-work-metrics">
    <div><Wrench size={19}/><span>Open</span><strong>{statusTotals.isSuccess?statusTotals.data.open:'—'}</strong></div>
    <div><Clock3 size={19}/><span>In progress</span><strong>{statusTotals.isSuccess?statusTotals.data.in_progress:'—'}</strong></div>
    <div><CheckCircle2 size={19}/><span>Resolved</span><strong>{statusTotals.isSuccess?statusTotals.data.resolved:'—'}</strong></div>
    <div><ClipboardList size={19}/><span>Closed</span><strong>{statusTotals.isSuccess?statusTotals.data.closed:'—'}</strong></div>
   </div>
   {statusTotals.isError&&<div className="mnt-total-error" role="status">Workload totals could not be loaded.
    <button type="button" className="btn-inline" onClick={()=>void statusTotals.refetch()}>Retry totals</button></div>}
  </section>
  <section className="mnt-queue-section" aria-labelledby="mnt-queue-title">
   <div className="mnt-queue-head"><div><h3 id="mnt-queue-title">Maintenance work queue</h3>
    <p>Review reported problems and open work orders to update them.</p></div>
    <span>{orders.isSuccess?orders.data.meta.total:'—'} work orders match the selected status and priority</span>
   </div>
   <div className="mnt-queue-filters">
    <div className="mnt-queue-tabs" role="group" aria-label="Maintenance status">
     {([['','All orders'],['open','Open'],['in_progress','In progress'],['resolved','Resolved'],['closed','Closed']] as const).map(([value,label])=>
      <button type="button" key={value} className={statusFilter===value?'active':''}
       aria-pressed={statusFilter===value} onClick={()=>{setStatusFilter(value);setPage(1);}}>
       {label}</button>)}
    </div>
    <div className="mnt-filter-controls">
     <label className="mnt-search-field"><Search size={17}/><input type="search" aria-label="Search work orders on this page"
      placeholder="Room, issue or technician…" value={search} onChange={event=>setSearch(event.target.value)}/></label>
     <label className="mnt-priority-field">Priority <select aria-label="Filter maintenance priority" value={priorityFilter}
      onChange={event=>{setPriorityFilter(event.target.value as MaintenancePriority|'');setPage(1);}}>
      <option value="">All priorities</option>
      {priorities.map(priority=><option value={priority} key={priority}>{priorityLabels[priority]}</option>)}
     </select></label>
     {user&&<label className="mnt-mine-filter"><input type="checkbox" checked={mineOnly}
      onChange={event=>setMineOnly(event.target.checked)}/> My orders on this page</label>}
     {hasFilters&&<button type="button" className="mnt-clear-filters" onClick={clearFilters}><X size={15}/> Clear filters</button>}
    </div>
    <p className="mnt-filter-help"><Info size={14}/> Status and priority search the hotel's saved work orders. Text search and My orders apply only to the current page.</p>
   </div>
   <QueryFeedback loading={orders.isPending} error={orders.error} onRetry={()=>void orders.refetch()}
    empty={orders.isSuccess&&visible.length===0}
    emptyMessage={hasFilters?'No work orders match these filters on this page. Clear filters or browse another page.':'No work orders have been recorded. An administrator can create the first one.'}/>
   {orders.isSuccess&&visible.length>0&&<div className="mnt-work-grid">
    {visible.map(order=>{
     const editable=canUpdate(order);
     const action=editable?order.status==='open'?'Start or update work':order.status==='in_progress'?'Update repair progress':order.status==='resolved'?'Review and close':'View closed order':'View work order';
     return <article className={'mnt-work-card'+(order.priority==='urgent'&&order.status!=='closed'?' mnt-urgent-card':'')} key={order.id}>
      <div className="mnt-work-card-head">
       <div><small>WO-{order.id} · Room {order.roomNumber}</small><h4>{order.title}</h4></div>
       <span className={'mnt-priority mnt-priority-'+order.priority}>{priorityLabels[order.priority]}</span>
      </div>
      <p className="mnt-work-description">{order.description}</p>
      <div className="mnt-work-state">
       <span className={'mnt-stage mnt-stage-'+order.status}>{statusLabels[order.status]}</span>
       <span><UserRound size={15}/>{assignedName(order)}</span>
      </div>
      {order.affectsRoom&&<p className="mnt-impact-advisory"><ShieldAlert size={16}/>
       Room affected · check separate room restrictions before booking</p>}
      {order.status==='resolved'&&<p className="mnt-completion-advisory"><CheckCircle2 size={15}/> Repair marked resolved; review before closing.</p>}
      <button type="button" className="mnt-work-action" onClick={()=>openEdit(order)}>
       {action} <ArrowRight size={16}/></button>
     </article>;
    })}
   </div>}
   {orders.isSuccess&&orders.data.meta.totalPages>1&&<div className="mnt-queue-pagination">
    <span>Page {orders.data.meta.page} of {orders.data.meta.totalPages} · {visible.length} shown on this page</span>
    <div><button type="button" className="btn-inline" disabled={page<=1} onClick={()=>setPage(v=>Math.max(1,v-1))}>Previous</button>
     <button type="button" className="btn-inline" disabled={page>=orders.data.meta.totalPages} onClick={()=>setPage(v=>v+1)}>Next</button></div>
   </div>}
  </section>
  {draft&&<div className="guest-modal-backdrop" role="presentation">
   <section className="guest-modal" role="dialog" aria-modal="true" aria-labelledby="maintenance-title">
    <div className="catalog-modal-heading"><h3 id="maintenance-title">{selected?'Work order WO-'+selected.id:'Create work order'}</h3>
     <button className="icon-btn" type="button" disabled={saving} onClick={close} aria-label="Close"><X size={19}/></button></div>
    <div className="mnt-editor-guide"><Info size={17}/><p><strong>Repair record only.</strong>
     {selected?' Update progress and handover notes here. Changes are recorded in work history.':' Describe the issue, priority and responsible staff.'}
     Room-impact reports alone do not block reservations or approve readiness.</p></div>
    {rooms.data&&rooms.data.meta.total>100&&!selected&&<p className="guest-info">This room selector shows only the first 100 registered rooms. A searchable picker is planned.</p>}
    <form onSubmit={e=>void submit(e)}>
     <div className="guest-fields">
      <label>Room<select required disabled={!!selected||!admin||saving} value={draft.roomId} onChange={e=>change('roomId',e.target.value)}>
       <option value="">Choose a room</option>
       {rooms.data?.data.map(room=><option key={room.id} value={room.id}>Room {room.number}</option>)}
      </select></label>
      <label>Title<input required maxLength={160} disabled={!!selected||!admin||saving} value={draft.title} onChange={e=>change('title',e.target.value)}/></label>
      <label>Description<textarea required maxLength={5000} rows={3} disabled={!!selected||!admin||saving} value={draft.description} onChange={e=>change('description',e.target.value)}/></label>
      <label>Priority<select disabled={!admin||saving} value={draft.priority} onChange={e=>change('priority',e.target.value as MaintenancePriority)}>{priorities.map(p=><option key={p} value={p}>{p}</option>)}</select></label>
      <label>Status<select disabled={!selected||!maySave||saving} value={draft.status} onChange={e=>change('status',e.target.value as MaintenanceStatus)}>
       {[selected?.status??'open',...(transitions[selected?.status??'open']??[])].filter((x,i,arr)=>arr.indexOf(x)===i).map(s=><option value={s} key={s} >{statusLabels[s]}</option>)}
      </select></label>
      {admin&&<label>Assign technician<select value={draft.assignedUserId} disabled={saving} onChange={e=>change('assignedUserId',e.target.value)}>
       <option value="">No linked account</option>
       {staff.data?.data.filter(m=>m.isActive&&m.accountActive&&(m.role==='maintenance'||m.role==='admin')).map(m=><option key={m.userId} value={m.userId}>{m.name} ({m.role})</option>)}
      </select></label>}
      <label>Additional technician name<input maxLength={120} disabled={!admin||saving} value={draft.assignedTo} onChange={e=>change('assignedTo',e.target.value)}/></label>
      <label className="maintenance-checkbox"><input type="checkbox" disabled={!admin||saving} checked={draft.affectsRoom} onChange={e=>change('affectsRoom',e.target.checked)}/> Room may be affected (does not block bookings)</label>
      {maySave&&<label>Handover notes<textarea rows={2} maxLength={2000} disabled={saving} value={draft.note} onChange={e=>change('note',e.target.value)}/></label>}
     </div>
     {Object.entries(fieldErrors).flatMap(([field,errors])=>errors.map((message,i)=><p role="alert" key={field+i} className="catalog-field-error">{field}: {message}</p>))}
     {error&&<p role="alert" className="auth-error">{error}</p>}
     <div className="guest-modal-actions"><button type="button" className="btn-inline" disabled={saving} onClick={close}>Close</button>
      {maySave&&<button type="submit" className="btn-primary" disabled={saving}>{saving?'Saving…':selected?'Save work order':'Create work order'}</button>}</div>
    </form>
    {selected&&<div className="catalog-audit-section">
     <button className="btn-inline" type="button" onClick={()=>setHistoryVisible(value=>!value)}><History size={15}/>{historyVisible?'Hide':'View'} recorded history</button>
     {historyVisible&&<><QueryFeedback loading={history.isPending} error={history.error}/>
      {history.data?.data.map(e=><article className="maintenance-history-event" key={e.id}><strong>{e.action} · Staff #{e.actorId}</strong>
       <small>{e.createdAt}</small>{e.note&&<p>{e.note}</p>}</article>)}
      {history.data&&<div className="guest-pagination">
       <span>History page {history.data.meta.page} of {Math.max(1,history.data.meta.totalPages)}</span>
       <div><button type="button" className="btn-inline" disabled={historyPage<=1}
        onClick={()=>setHistoryPage(n=>n-1)}>Previous events</button>
        <button type="button" className="btn-inline" disabled={historyPage>=history.data.meta.totalPages}
        onClick={()=>setHistoryPage(n=>n+1)}>Next events</button></div>
      </div>}</>}
    </div>}
   </section>
  </div>}
 </>;
}
