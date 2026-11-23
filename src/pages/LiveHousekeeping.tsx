import {useEffect,useRef,useState,type FormEvent} from 'react';
import {z} from 'zod';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {Link,useNavigate,useSearch} from '@tanstack/react-router';
import {AlertTriangle,ArrowRight,CheckCircle2,ClipboardCheck,Clock3,History,Info,Plus,RefreshCcw,Search,ShieldAlert,UserRound,X} from 'lucide-react';
import {useHotelAuth} from '../components/AuthProvider';
import {useLiveRooms,useLiveProperty} from '../api/liveCatalogQueries';
import {hotelToday} from '../features/reservations/calendarDate';
import {readableDate} from '../lib/format';
import {
 createHousekeepingTask,getHousekeepingHistory,listHousekeepingTasks,updateHousekeepingTask,completeHousekeepingInspection,
 type LiveHousekeepingTask,type HousekeepingStatus,type HousekeepingType,type TaskFilter,
 parseLiveHousekeeping,parseUpdatedHousekeeping,useDirectHousekeepingTask,
} from '../api/liveHousekeeping';
import {ApiError,getJson} from '../api/http';
import {hotelPath,readSession} from '../api/session';
import {linkedTaskKey,shouldOpenLinkedTask} from '../lib/linkedTaskSelection';
import {listHotelStaff} from '../api/liveStaff';
import {listMaintenance} from '../api/liveMaintenance';
import {Heading} from '../components/ui';
import {QueryFeedback} from '../components/QueryFeedback';
import {ReadableAuditEvent} from '../components/ReadableAuditEvent';
import {useLiveReadiness} from '../api/liveRoomReadiness';

const taskTypes:HousekeepingType[]=['checkout_clean','stayover'];
const taskNames:Record<HousekeepingType,string>={checkout_clean:'Checkout cleaning',stayover:'Stayover service',inspection:'Housekeeping inspection'};
const statusNames:Record<HousekeepingStatus,string>={todo:'To do',in_progress:'In progress',done:'Cleaning completed'};
const transitions:Record<HousekeepingStatus,HousekeepingStatus[]>={
 todo:['in_progress','done'],in_progress:['done'],done:[],
};
type FormState={roomId:string;type:HousekeepingType;status:HousekeepingStatus;
 assignedTo:string;assignedUserId:string;dueAt:string;note:string};
const empty=():FormState=>({roomId:'',type:'checkout_clean',status:'todo',assignedTo:'',assignedUserId:'',dueAt:'',note:''});
const fromTask=(task:LiveHousekeepingTask):FormState=>({
 roomId:task.roomId,type:task.type,status:task.status,
 assignedTo:task.assignedTo??'',assignedUserId:task.assignedUserId??'',dueAt:task.dueAt?task.dueAt.replace('T',' ').slice(0,16):'',note:'',
});
const formatDue=(value:string)=>value.trim()===''?null:value.replace('T',' ')+':00';
export function LiveHousekeeping(){
 const {hotelId,user}=useHotelAuth();
 const {task:linkedTaskId}=useSearch({from:'/housekeeping'});
 const navigate=useNavigate();
 const directTask=useDirectHousekeepingTask(linkedTaskId??null);
 const openedLinkedTask=useRef<string|null>(null);
 const role=user?.hotels.find(h=>h.id===hotelId)?.role;
 const admin=role==='admin';
 const canWork=admin||user?.hotels.find(h=>h.id===hotelId)?.permissions?.includes('housekeeping.assigned')!==false;
 const property=useLiveProperty();
 const hotelDate=hotelToday(new Date(),property.data?.data.timeZone??'Asia/Manila');
 const staff=useQuery({queryKey:['hotel-staff',hotelId],queryFn:listHotelStaff,enabled:admin});
 const assignedAlerts=useQuery({
  queryKey:['live','housekeeping-assigned-alerts',hotelId,user?.id],
  enabled:!!hotelId&&role==='housekeeping',retry:false,
  refetchInterval:30000,
  queryFn:async()=>z.object({
   data:z.array(z.object({taskId:z.string(),roomNumber:z.string(),
    type:z.string(),status:z.string(),dueAt:z.string().nullable(),
    assignedTaskUpdatedAt:z.string()})),
   meta:z.object({limitedTo:z.number(),inAppPollingOnly:z.boolean(),
    externalNotificationsConfigured:z.boolean()}),
  }).parse(await getJson<unknown>(hotelPath('/housekeeping/my-assignments'))),
 });
 const handoff=useQuery({
  queryKey:['live','housekeeping-handoff',hotelId],enabled:admin&&!!hotelId,retry:false,
  queryFn:async()=>z.object({
   data:z.array(z.object({
    taskId:z.string(),roomId:z.string(),roomNumber:z.string(),status:z.string(),
    createdAt:z.string(),dueAt:z.string().nullable(),
    ageMinutes:z.number(),priority:z.enum(['new','attention','escalate']),
    action:z.string(),revision:z.number(),
   })),
   meta:z.object({total:z.number(),hasMore:z.boolean(),
    ageAttentionMinutes:z.number(),ageEscalationMinutes:z.number(),
    notificationDeliveryConfigured:z.boolean()}),
  }).parse(await getJson<unknown>(hotelPath('/housekeeping/handoff'))),
 });
 const maintenance=useQuery({
  queryKey:['live','maintenance-for-housekeeping',hotelId],
  queryFn:()=>listMaintenance(1,100),enabled:!!hotelId,retry:false,
 });
 const client=useQueryClient();
 const [page,setPage]=useState(1);
 const [statusFilter,setStatusFilter]=useState<HousekeepingStatus|''>('');
 const [typeFilter,setTypeFilter]=useState<HousekeepingType|''>('');
 const [textFilter,setTextFilter]=useState('');
 const [mineOnly,setMineOnly]=useState(false);
 const filter:TaskFilter={...(statusFilter?{status:statusFilter}:{}),...(typeFilter?{type:typeFilter}:{}),q:textFilter.trim()||undefined,mine:mineOnly?1:undefined};
 const tasks=useQuery({
  queryKey:['live-housekeeping',hotelId,page,filter],
  enabled:!!hotelId,
  queryFn:async()=>parseLiveHousekeeping(await listHousekeepingTasks(page,20,filter),hotelId!),
  retry:false,
 });
 // Independent count queries: switching queue tabs must not reset other status totals.
 // Each query requests one task and reads the server's filtered total.
 const statusTotals=useQuery({
  queryKey:['live-housekeeping-status-totals',hotelId],
  enabled:!!hotelId,
  queryFn:async()=>{
   const [todo,inProgress,done]=await Promise.all([
    listHousekeepingTasks(1,1,{status:'todo'}),
    listHousekeepingTasks(1,1,{status:'in_progress'}),
    listHousekeepingTasks(1,1,{status:'done'}),
   ]);
   const totals=[todo,inProgress,done].map(result=>parseLiveHousekeeping(result,hotelId!).meta.total);
   return {todo:totals[0],in_progress:totals[1],done:totals[2]};
  },
  retry:false,
 });
 const rooms=useLiveRooms({page:1,perPage:100});
 const [selected,setSelected]=useState<LiveHousekeepingTask|null>(null);
 const [form,setForm]=useState<FormState|null>(null);
 const [saving,setSaving]=useState(false);
 const [inspectionChecks,setInspectionChecks]=useState([false,false,false]);
 const [inspectionNote,setInspectionNote]=useState('');
 const [inspectionMessage,setInspectionMessage]=useState('');
 const readiness=useLiveReadiness(selected?.roomId??null);
 const [error,setError]=useState('');
 const [fieldErrors,setFieldErrors]=useState<Record<string,string[]>>({});
 const [historyOpen,setHistoryOpen]=useState(false);
 const [historyPage,setHistoryPage]=useState(1);
 const history=useQuery({
  queryKey:['housekeeping-history',hotelId,selected?.id,historyPage],
  queryFn:()=>getHousekeepingHistory(selected!.id,historyPage),
  enabled:!!selected&&historyOpen,
 });
 useEffect(()=>{
  setPage(1);setSelected(null);setForm(null);setError('');setHistoryOpen(false);setHistoryPage(1);
  setTextFilter('');setStatusFilter('');setTypeFilter('');setMineOnly(false);
 },[hotelId]);
 useEffect(()=>{
  openedLinkedTask.current=null;
 },[hotelId,linkedTaskId]);
 useEffect(()=>{
  if(!linkedTaskId||!hotelId||!directTask.data)return;
  // A background refetch must never discard unsaved notes/assignment changes.
  if(!shouldOpenLinkedTask(openedLinkedTask.current,hotelId,linkedTaskId))return;
  openedLinkedTask.current=linkedTaskKey(hotelId,linkedTaskId);
  setSelected(directTask.data);setForm(fromTask(directTask.data));setError('');
  setFieldErrors({});setHistoryOpen(false);setHistoryPage(1);
 },[linkedTaskId,directTask.data,hotelId]);
 const openCreate=()=>{setSelected(null);setForm(empty());setError('');setFieldErrors({});setHistoryOpen(false);setHistoryPage(1);};
 const openEdit=(task:LiveHousekeepingTask)=>{
  setInspectionChecks([false,false,false]);setInspectionNote('');setInspectionMessage('');
  setSelected(task);setForm(fromTask(task));setError('');setFieldErrors({});setHistoryOpen(false);setHistoryPage(1);
 };
 const close=()=>{
  setInspectionChecks([false,false,false]);setInspectionNote('');setInspectionMessage('');
  setSelected(null);setForm(null);setError('');setHistoryOpen(false);
  if(linkedTaskId)void navigate({to:'/housekeeping',search:{task:undefined}});
 };
 const change=<K extends keyof FormState>(key:K,value:FormState[K])=>
  setForm(current=>current?{...current,[key]:value}:current);
 async function save(e:FormEvent<HTMLFormElement>){
  e.preventDefault();
  const assigned=!!selected&&role==='housekeeping'&&canWork&&selected.assignedUserId===user?.id;
  if(!(admin||assigned)||!form||saving)return;
  setSaving(true);setError('');setFieldErrors({});
  try{
   const updated=selected?parseUpdatedHousekeeping(await updateHousekeepingTask(selected.id,admin?{
    expectedRevision:selected.revision,status:form.status,
    assignedTo:form.assignedTo.trim()||null,assignedUserId:form.assignedUserId||null,
    dueAt:formatDue(form.dueAt),note:form.note.trim()||null,
   }:{expectedRevision:selected.revision,status:form.status,note:form.note.trim()||null}),hotelId!,selected.id):null;
   if(!selected)await createHousekeepingTask({
    roomId:form.roomId,type:form.type,assignedTo:form.assignedTo.trim()||null,
    assignedUserId:form.assignedUserId||null,dueAt:formatDue(form.dueAt),note:form.note.trim()||null,
   });
   if(readSession().hotelId!==hotelId)return;
   setPage(1);
   if(updated&&updated.type==='checkout_clean'&&updated.status==='done'){
    setSelected(updated);setForm(fromTask(updated));
   }else close();
   // Failed cache refresh must not make an already committed update look failed.
   void Promise.all([
    client.invalidateQueries({queryKey:['live-housekeeping',hotelId]}),
    client.invalidateQueries({queryKey:['live','housekeeping-handoff',hotelId]}),
    client.invalidateQueries({queryKey:['live','housekeeping-assigned-alerts',hotelId]}),
    client.invalidateQueries({queryKey:['live-housekeeping-status-totals',hotelId]}),
    client.invalidateQueries({queryKey:['housekeeping-history',hotelId]}),
    client.invalidateQueries({queryKey:['live','front-desk','manifest',hotelId]}),
    client.invalidateQueries({queryKey:['live','readiness-dashboard',hotelId]}),
    client.invalidateQueries({queryKey:['live','room-inventory-status',hotelId]}),
    client.invalidateQueries({queryKey:['live','room-readiness',hotelId]}),
    client.invalidateQueries({queryKey:['live','housekeeping-direct-task',hotelId]}),
   ]).catch(()=>{});
  }catch(caught){
   // A response from a previous hotel must not appear in the new hotel's editor.
   if(readSession().hotelId!==hotelId)return;
   if(caught instanceof ApiError){
    setFieldErrors(caught.fieldErrors??{});
    setError(caught.status===409?'This task changed. Close and reopen the latest task before saving.':caught.message);
   }else setError(caught instanceof Error?caught.message:'Unable to save housekeeping task.');
  }finally{setSaving(false);}
 }
 const mayInspect=!!selected&&(admin||(role==='housekeeping'&&canWork&&selected.assignedUserId===user?.id));
 async function finishInspection(){
  if(!selected||selected.status!=='done'||!mayInspect||saving||!inspectionChecks.every(Boolean)
   ||inspectionNote.trim().length<5||!hotelId)return;
  setSaving(true);setError('');setInspectionMessage('');
  try{
   const updated=parseUpdatedHousekeeping(await completeHousekeepingInspection(
    selected.id,selected.revision,inspectionNote.trim()),hotelId,selected.id);
   if(readSession().hotelId!==hotelId)return;
   setSelected(updated);setForm(fromTask(updated));
   setInspectionMessage('Final inspection completed. Room readiness has been recalculated.');
   setInspectionChecks([false,false,false]);setInspectionNote('');
   void Promise.all([
    client.invalidateQueries({queryKey:['live','room-readiness',hotelId,selected.roomId]}),
    client.invalidateQueries({queryKey:['live','readiness-dashboard',hotelId]}),
    client.invalidateQueries({queryKey:['live','housekeeping-direct-task',hotelId]}),
    client.invalidateQueries({queryKey:['live-housekeeping',hotelId]}),
    client.invalidateQueries({queryKey:['housekeeping-history',hotelId]}),
    client.invalidateQueries({queryKey:['live','front-desk','manifest',hotelId]}),
   ]).catch(()=>{});
  }catch(cause){
   if(readSession().hotelId===hotelId)
    setError(cause instanceof Error?cause.message:'Unable to complete final inspection.');
  }finally{setSaving(false);}
 }
 const data=tasks.data?.data??[];
 const filtered=data;
  const overdueCount=tasks.data?.meta.pastDueCount??'—';
 const hasFilters=!!statusFilter||!!typeFilter||!!textFilter.trim()||mineOnly;
 const resetFilters=()=>{setPage(1);setStatusFilter('');setTypeFilter('');setTextFilter('');setMineOnly(false);};
 const assignedName=(task:LiveHousekeepingTask)=>task.assignedUserId
  ?task.assignedUserId===user?.id?'You':admin?staff.data?.data.find(m=>m.userId===task.assignedUserId)?.name??'Assigned staff':'Assigned staff'
  :task.assignedTo??'Unassigned';
 const canUpdate=(task:LiveHousekeepingTask)=>admin||(role==='housekeeping'&&canWork&&task.assignedUserId===user?.id);
 const maySave=admin||(!!selected&&canUpdate(selected));
 return <>
  {linkedTaskId&&<section aria-label="Direct checkout cleaning task">
   <div className="desk-tools">
    <p className="help-copy">Checkout cleaning task #{linkedTaskId} · Retrieved directly from this hotel's records.</p>
    <button type="button" className="btn-inline"
     onClick={()=>void navigate({to:'/housekeeping',search:{task:undefined}})}>Back to task queue</button>
   </div>
   <QueryFeedback loading={directTask.isPending} error={directTask.error}
    onRetry={()=>void directTask.refetch()}/>
  </section>}
  <div className="hk-page-intro">
   <div><span className="rr-eyebrow">DAILY OPERATIONS · HOUSEKEEPING</span>
    <Heading title="Housekeeping" description="Clean and inspect rooms in one task, then release rooms when all readiness checks pass."/></div>
   {admin&&<button type="button" className="btn-primary" onClick={openCreate}><Plus size={16}/> New cleaning task</button>}
  </div>
  <div className="hk-guidance"><Info size={18}/><p><strong>One task, two stages.</strong> Finish cleaning, then complete the final inspection in that same housekeeping task. Room readiness is confirmed only after all operational checks pass.</p></div>
  {role==='housekeeping'&&<section className="hk-manager-handoff"
   aria-label="Housekeeping assignments to you">
   <div className="hk-work-heading"><div><span className="rr-eyebrow">ASSIGNED TO YOU</span>
    <h3>My current cleaning assignments</h3>
    <p>Checked every 30 seconds while this screen is open. These are in-app updates, not push messages.</p>
   </div></div>
   <QueryFeedback loading={assignedAlerts.isPending} error={assignedAlerts.error}
    onRetry={()=>void assignedAlerts.refetch()}/>
   {assignedAlerts.data?.data.length===0&&<p className="desk-muted">No active cleaning tasks assigned to you.</p>}
   <div className="hk-handoff-list">{assignedAlerts.data?.data.map(task=>
    <article className="hk-handoff-row" key={task.taskId}>
     <div><strong>Room {task.roomNumber}</strong>
      <small>{task.type.replaceAll('_',' ')} · {task.status.replaceAll('_',' ')}</small>
      <small>{task.dueAt?'Due: '+readableDate(task.dueAt)+' · '+task.dueAt.slice(11,16):'No due time set'}</small></div>
     <button type="button" className="btn-inline" onClick={()=>
      void navigate({to:'/housekeeping',search:{task:task.taskId}})}>
      Open task <ArrowRight size={15}/></button>
    </article>)}</div>
  </section>}
  {admin&&<section className="hk-manager-handoff" aria-label="Manager checkout cleaning handoff">
   <div className="hk-work-heading">
    <div><span className="rr-eyebrow">MANAGER · CHECKOUT HANDOFF</span>
     <h3>Unassigned checkout cleaning</h3>
     <p>Assign an employee promptly. Tasks older than 30 minutes need attention;
      after 2 hours they require manager escalation.</p></div>
    <button type="button" className="rr-secondary-action" disabled={handoff.isFetching}
     onClick={()=>void handoff.refetch()}><RefreshCcw size={15}/> Refresh handoff</button>
   </div>
   <QueryFeedback loading={handoff.isPending} error={handoff.error}
    onRetry={()=>void handoff.refetch()}/>
   {handoff.data&&<p className="desk-muted">{handoff.data.meta.total} unassigned checkout tasks
    {handoff.data.meta.hasMore?' · Showing oldest 100; more tasks require follow-up':''}</p>}
   {handoff.data?.data.length===0&&<p className="hk-handoff-clear">No unassigned checkout cleaning tasks.</p>}
   <div className="hk-handoff-list">
    {handoff.data?.data.map(item=><article key={item.taskId}
     className={'hk-handoff-row '+(item.priority==='escalate'?'hk-handoff-critical':'')}>
     <div><strong>Room {item.roomNumber}</strong>
      <small>Checkout cleaning · {Math.floor(item.ageMinutes/60)}h {Math.floor(item.ageMinutes%60)}m waiting</small>
      {item.priority==='escalate'?<span className="hk-handoff-alert">Escalate to duty manager</span>
       :item.priority==='attention'?<span className="hk-handoff-attention">Assignment overdue</span>:null}
     </div>
     <button type="button" className="btn-inline" onClick={()=>{
      void navigate({to:'/housekeeping',search:{task:item.taskId}});
     }}>Assign staff <ArrowRight size={15}/></button>
    </article>)}
   </div>
   <p className="desk-muted">Assignments are recorded in the housekeeping task audit trail.
    Automated delivery notifications are not yet configured. Finishing cleaning never approves readiness.</p>
  </section>}
  <section className="hk-work-summary" aria-label="Hotel-wide housekeeping tasks">
   <div className="hk-work-heading"><div><span className="rr-eyebrow">HOTEL-WIDE TASKS</span><h3>Cleaning workload</h3>
    <p>Totals cover all housekeeping tasks at this hotel.</p></div>
    <button type="button" className="rr-secondary-action" disabled={tasks.isFetching||statusTotals.isFetching} onClick={()=>void Promise.all([tasks.refetch(),statusTotals.refetch()])}><RefreshCcw size={16}/>{tasks.isFetching?'Refreshing…':'Refresh tasks'}</button>
   </div>
   <div className="hk-work-metrics">
    <div><Clock3 size={19}/><span>To do · hotel-wide</span><strong>{statusTotals.isSuccess?statusTotals.data.todo:'—'}</strong></div>
    <div><ClipboardCheck size={19}/><span>In progress · hotel-wide</span><strong>{statusTotals.isSuccess?statusTotals.data.in_progress:'—'}</strong></div>
    <div><CheckCircle2 size={19}/><span>Cleaning completed · hotel-wide</span><strong>{statusTotals.isSuccess?statusTotals.data.done:'—'}</strong></div>
    <div className="hk-metric-alert"><AlertTriangle size={19}/><span>Past due</span><strong>{tasks.isSuccess?overdueCount:'—'}</strong></div>
   </div>
   {statusTotals.isError&&<div className="hk-total-error" role="status">Hotel-wide task totals could not be loaded. <button type="button" className="btn-inline" onClick={()=>void statusTotals.refetch()}>Retry totals</button></div>}
  </section>
  <section className="hk-queue-section" aria-labelledby="hk-queue-title">
   <div className="hk-queue-head">
    <div><h3 id="hk-queue-title">Housekeeping task queue</h3><p>Search, filter, and open tasks to update progress.</p></div>
    <span>{tasks.isSuccess?tasks.data.meta.total:'—'} tasks matching selected status and type</span>
   </div>
   <div className="hk-queue-filters">
    <div className="hk-queue-tabs" role="group" aria-label="Task status">
     {([['','All tasks'],['todo','To do'],['in_progress','In progress'],['done','Cleaning completed']] as const).map(([value,label])=>
      <button key={value} type="button" aria-pressed={statusFilter===value} className={statusFilter===value?'active':''}
       onClick={()=>{setStatusFilter(value);setPage(1);}}>{label}</button>)}
    </div>
    <div className="hk-filter-controls">
     <label className="hk-search-field"><Search size={17}/><input aria-label="Search tasks" type="search" maxLength={120} value={textFilter}
      placeholder="Room number, staff, task…" onChange={e=>{setPage(1);setTextFilter(e.target.value);}}/></label>
     <label className="hk-type-filter">Task type <select aria-label="Filter task type" value={typeFilter}
      onChange={e=>{setTypeFilter(e.target.value as HousekeepingType|'');setPage(1);}}>
      <option value="">All types</option>
      {taskTypes.map(type=><option key={type} value={type}>{taskNames[type]}</option>)}
     </select></label>
     {user&&<label className="hk-mine-filter"><input type="checkbox" checked={mineOnly} onChange={e=>{setPage(1);setMineOnly(e.target.checked);}}/> My tasks</label>}
     {hasFilters&&<button type="button" className="hk-clear" onClick={resetFilters}><X size={15}/> Clear filters</button>}
    </div>
   </div>
   <QueryFeedback loading={tasks.isPending} error={tasks.error} onRetry={()=>void tasks.refetch()}
    empty={tasks.isSuccess&&filtered.length===0}
    emptyMessage={hasFilters?'No tasks match these filters.':'No housekeeping tasks found. An administrator can create a new task.'}/>
   {tasks.isSuccess&&filtered.length>0&&<div className="hk-cleaning-grid" aria-live="polite">
    {filtered.map(task=>{
     const pastDue=task.status!=='done'&&!!task.dueAt&&task.dueAt.slice(0,10)<hotelDate;
     const todayDue=task.status!=='done'&&!!task.dueAt&&task.dueAt.slice(0,10)===hotelDate;
     const editable=canUpdate(task);
     return <article className={'hk-cleaning-card'+(pastDue?' hk-cleaning-overdue':'')} key={task.id}>
      <div className="hk-cleaning-card-head">
       <div><small>{taskNames[task.type]} · HK-{task.id}</small><h4>Room {task.roomNumber}</h4></div>
       <span className={'hk-stage hk-stage-'+task.status}>{statusNames[task.status]}</span>
      </div>
      <div className="hk-cleaning-card-detail">
       <span><UserRound size={16}/> {assignedName(task)}</span>
       <span className={pastDue?'hk-due-overdue':''}><Clock3 size={16}/>
        {pastDue?'Past due · ':todayDue?'Due today · ':task.status==='done'?'Scheduled: ':'Due: '}{task.dueAt??'No deadline set'}
       </span>
      </div>
      {pastDue&&<p className="hk-cleaning-priority"><AlertTriangle size={15}/> Follow up on this overdue task.</p>}
      {task.type==='checkout_clean'&&<p className="hk-cleaning-finished">
       {task.status==='done'?<>Cleaning complete → Final inspection in this task → Ready when clear</>
        :<>Cleaning → Final inspection → Ready when clear</>}
      </p>}
      <Link to="/rooms" search={{room:task.roomNumber,inspect:task.type==='checkout_clean'&&task.status==='done'||undefined}} className="ops-room-link">{task.type==='checkout_clean'&&task.status==='done'?'Open inspection and readiness':'Check room readiness'} <ArrowRight size={14}/></Link>
      <button type="button" className="hk-open-task" onClick={()=>openEdit(task)}>
       {editable?task.status==='todo'?'Start or update task':task.status==='in_progress'?'Update cleaning progress':'View completed task':'View task details'}
       <ArrowRight size={16}/>
      </button>
     </article>;
    })}
   </div>}
   {tasks.isSuccess&&tasks.data.meta.totalPages>1&&<div className="hk-queue-pagination">
    <span>Page {tasks.data.meta.page} of {tasks.data.meta.totalPages} · {filtered.length} shown</span>
    <div><button type="button" className="btn-inline" disabled={page<=1} onClick={()=>setPage(x=>Math.max(1,x-1))}>Previous</button>
     <button type="button" className="btn-inline" disabled={page>=tasks.data.meta.totalPages} onClick={()=>setPage(x=>x+1)}>Next</button></div>
   </div>}
  </section>
  {form&&<div className="guest-modal-backdrop" role="presentation"><section className="guest-modal" role="dialog" aria-modal="true" aria-labelledby="hk-dialog-title">
   <div className="catalog-modal-heading"><h3 id="hk-dialog-title">{selected?'Housekeeping task HK-'+selected.id:'Create housekeeping task'}</h3>
    <button type="button" className="icon-btn" aria-label="Close" disabled={saving} onClick={close}><X size={19}/></button></div>
   <div className="hk-dialog-guide"><Info size={17}/><p><strong>One task, two stages.</strong> Save cleaning progress, then finish the final inspection below. Maintenance and inventory checks still apply.</p></div>
   {selected&&<>
    <QueryFeedback loading={maintenance.isPending} error={maintenance.error}/>
    {maintenance.isSuccess&&<>
     {maintenance.data.data.filter(order=>order.roomId===selected.roomId
      &&(order.status==='open'||order.status==='in_progress')).map(order=>
      <p className="hk-notice" key={order.id}>
       <ShieldAlert size={16}/> Active maintenance work order {order.id}: {order.title}
       {order.affectsRoom?' · flagged room impact (not an inventory block)':''}.
      </p>)}
     {maintenance.data.meta.totalPages>1&&<p className="hk-notice">
      Maintenance visibility is incomplete: only the first 100 work orders were checked.
      Review the full Maintenance screen before confirming a room is ready.
     </p>}
     {maintenance.data.meta.totalPages<=1&&!maintenance.data.data.some(order=>
       order.roomId===selected.roomId&&(order.status==='open'||order.status==='in_progress'))&&
      <p>There are no active work orders for this room in the current complete work-order list.
       This does not certify room readiness.</p>}
    </>}
   </>}
   {!selected&&rooms.data&&rooms.data.meta.total>100&&<p className="guest-info">Room selector displays only the first 100 registered rooms.</p>}
   <form onSubmit={e=>void save(e)}><div className="guest-fields">
    <label>Room<select required disabled={!!selected||!admin||saving} value={form.roomId} onChange={e=>change('roomId',e.target.value)}>
     <option value="">Choose a room</option>{rooms.data?.data.map(r=><option key={r.id} value={r.id}>Room {r.number}</option>)}</select></label>
    <label>Task type<select disabled={!!selected||!admin||saving} value={form.type} onChange={e=>change('type',e.target.value as HousekeepingType)}>
     {taskTypes.map(type=><option key={type} value={type}>{taskNames[type]}</option>)}</select></label>
    <label>Cleaning progress<select disabled={!selected||!maySave||saving} value={form.status} onChange={e=>change('status',e.target.value as HousekeepingStatus)}>
     {[selected?.status??'todo',...(transitions[selected?.status??'todo']??[])].map(status=><option key={status} value={status}>{statusNames[status]}</option>)}</select></label>
    {admin&&<label>Assign staff member<select value={form.assignedUserId} disabled={saving} onChange={e=>change('assignedUserId',e.target.value)}>
     <option value="">No linked account</option>
     {staff.data?.data.filter(m=>m.isActive&&m.accountActive&&(m.role==='housekeeping'||m.role==='admin')).map(m=><option key={m.userId} value={m.userId}>{m.name} ({m.role})</option>)}
    </select></label>}
    <label>Additional assigned staff name<input maxLength={120} disabled={!admin||saving} value={form.assignedTo} onChange={e=>change('assignedTo',e.target.value)}/></label>
    <label>Due date and time<input type="datetime-local" disabled={!admin||saving} value={form.dueAt} onChange={e=>change('dueAt',e.target.value)}/></label>
    {maySave&&<label>Handover note<textarea rows={2} maxLength={2000} disabled={saving} value={form.note} onChange={e=>change('note',e.target.value)}/></label>}
   </div>
   {Object.entries(fieldErrors).flatMap(([field,messages])=>messages.map((m,i)=><p key={field+i} className="catalog-field-error" role="alert">{field}: {m}</p>))}
   {error&&<p role="alert" className="auth-error">{error}</p>}
   <div className="guest-modal-actions"><button type="button" className="btn-inline" disabled={saving} onClick={close}>Close</button>
    {maySave&&<button type="submit" className="btn-primary" disabled={saving}>{saving?'Saving…':selected?'Save task updates':'Create task'}</button>}</div>
   </form>
   {selected&&selected.type==='checkout_clean'&&<section className="hk-final-inspection" aria-label="Final inspection in housekeeping task">
    <h4>Step 2 · Final room inspection</h4>
    {selected.status!=='done'
     ?<p>Step 1: Finish cleaning and save the task before inspecting Room {selected.roomNumber}.</p>
     :<>
      <QueryFeedback loading={readiness.isPending} error={readiness.error}
       onRetry={()=>void readiness.refetch()}/>
      {readiness.isSuccess&&readiness.data.advisoryReady
       ?<p role="status" className="stay-feedback-success"><CheckCircle2 size={16}/> Inspection completed — room checks clear. No manager approval needed.</p>
       :<>
        <p>Inspect the physical room. Active housekeeping, maintenance or inventory blockers will still prevent readiness.</p>
        {['Room and bathroom clean; fresh linens in place','Safety, lights and fixtures checked','Amenities and supplies checked'].map((label,i)=>
         <label key={label} className="stay-confirm-check">
          <input type="checkbox" disabled={!mayInspect||saving} checked={inspectionChecks[i]}
           onChange={event=>setInspectionChecks(old=>old.map((value,j)=>j===i?event.target.checked:value))}/>
          <span>{label}</span>
         </label>)}
        <label>Inspection notes (required)
         <textarea value={inspectionNote} disabled={!mayInspect||saving} maxLength={2000} rows={2}
          onChange={event=>setInspectionNote(event.target.value)} placeholder="Describe the final inspection"/>
        </label>
        {mayInspect&&<button type="button" className="btn-primary"
         disabled={saving||!inspectionChecks.every(Boolean)||inspectionNote.trim().length<5}
         onClick={()=>void finishInspection()}>{saving?'Recording inspection…':'Complete final inspection'}</button>}
        {!mayInspect&&<p>Only assigned housekeeping staff or an authorized manager can inspect.</p>}
       </>}
     </>}
    {inspectionMessage&&<p role="status" className="stay-feedback-success">{inspectionMessage}</p>}
   </section>}
   {selected&&<div className="catalog-audit-section">
    <button type="button" className="btn-inline" onClick={()=>setHistoryOpen(v=>!v)}><History size={16}/>{historyOpen?'Hide':'View'} task history</button>
    {historyOpen&&<><QueryFeedback loading={history.isPending} error={history.error}/>
     {history.data?.data.map(event=><ReadableAuditEvent key={event.id} event={event}
      actorName={event.actorName??staff.data?.data.find(member=>member.userId===event.actorId)?.name}
      currentUserId={user?.id} currentUserName={user?.name}/>)}
     {history.data&&<div className="guest-pagination">
      <span>Event page {history.data.meta.page} of {Math.max(1,history.data.meta.totalPages)}</span>
      <div><button type="button" className="btn-inline" disabled={historyPage<=1}
       onClick={()=>setHistoryPage(n=>n-1)}>Previous events</button>
       <button type="button" className="btn-inline" disabled={historyPage>=history.data.meta.totalPages}
       onClick={()=>setHistoryPage(n=>n+1)}>Next events</button>
      </div>
     </div>}
    </>}
   </div>}
  </section></div>}
  <div className="demand-warning"><ShieldAlert size={18}/><div><strong>Room readiness is checked separately</strong>
   <p>Cleaning and inspection are stages of the same task. Cleaning alone never releases a room; maintenance, inventory and reservation checks still apply.</p>
  </div></div>
 </>;
}
