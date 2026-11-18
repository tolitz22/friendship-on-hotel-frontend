import {useEffect,useRef,useState,type FormEvent} from 'react';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {useNavigate,useSearch} from '@tanstack/react-router';
import {AlertTriangle,ArrowRight,CheckCircle2,ClipboardCheck,Clock3,History,Info,Plus,RefreshCcw,Search,ShieldAlert,UserRound,X} from 'lucide-react';
import {useHotelAuth} from '../components/AuthProvider';
import {useLiveRooms,useLiveProperty} from '../api/liveCatalogQueries';
import {hotelToday} from '../features/reservations/calendarDate';
import {
 createHousekeepingTask,getHousekeepingHistory,listHousekeepingTasks,updateHousekeepingTask,
 type LiveHousekeepingTask,type HousekeepingStatus,type HousekeepingType,type TaskFilter,
 parseLiveHousekeeping,parseUpdatedHousekeeping,useDirectHousekeepingTask,
} from '../api/liveHousekeeping';
import {ApiError} from '../api/http';
import {readSession} from '../api/session';
import {linkedTaskKey,shouldOpenLinkedTask} from '../lib/linkedTaskSelection';
import {listHotelStaff} from '../api/liveStaff';
import {listMaintenance} from '../api/liveMaintenance';
import {Heading} from '../components/ui';
import {QueryFeedback} from '../components/QueryFeedback';

const taskTypes:HousekeepingType[]=['checkout_clean','stayover','inspection'];
const taskNames:Record<HousekeepingType,string>={checkout_clean:'Checkout cleaning',stayover:'Stayover service',inspection:'Housekeeping inspection'};
const statusNames:Record<HousekeepingStatus,string>={todo:'To do',in_progress:'In progress',done:'Completed'};
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
 const property=useLiveProperty();
 const hotelDate=hotelToday(new Date(),property.data?.data.timeZone??'Asia/Manila');
 const staff=useQuery({queryKey:['hotel-staff',hotelId],queryFn:listHotelStaff,enabled:admin});
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
 const filter:TaskFilter={...(statusFilter?{status:statusFilter}:{}),...(typeFilter?{type:typeFilter}:{})};
 const tasks=useQuery({
  queryKey:['live-housekeeping',hotelId,page,statusFilter,typeFilter],
  enabled:!!hotelId,
  queryFn:async()=>parseLiveHousekeeping(await listHousekeepingTasks(page,20,filter),hotelId!),
  retry:false,
 });
 const rooms=useLiveRooms({page:1,perPage:100});
 const [selected,setSelected]=useState<LiveHousekeepingTask|null>(null);
 const [form,setForm]=useState<FormState|null>(null);
 const [saving,setSaving]=useState(false);
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
  setSelected(task);setForm(fromTask(task));setError('');setFieldErrors({});setHistoryOpen(false);setHistoryPage(1);
 };
 const close=()=>{
  setSelected(null);setForm(null);setError('');setHistoryOpen(false);
  if(linkedTaskId)void navigate({to:'/housekeeping',search:{task:undefined}});
 };
 const change=<K extends keyof FormState>(key:K,value:FormState[K])=>
  setForm(current=>current?{...current,[key]:value}:current);
 async function save(e:FormEvent<HTMLFormElement>){
  e.preventDefault();
  const assigned=!!selected&&role==='housekeeping'&&selected.assignedUserId===user?.id;
  if(!(admin||assigned)||!form||saving)return;
  setSaving(true);setError('');setFieldErrors({});
  try{
   if(selected)parseUpdatedHousekeeping(await updateHousekeepingTask(selected.id,admin?{
    expectedRevision:selected.revision,status:form.status,
    assignedTo:form.assignedTo.trim()||null,assignedUserId:form.assignedUserId||null,
    dueAt:formatDue(form.dueAt),note:form.note.trim()||null,
   }:{expectedRevision:selected.revision,status:form.status,note:form.note.trim()||null}),hotelId!,selected.id);
   else await createHousekeepingTask({
    roomId:form.roomId,type:form.type,assignedTo:form.assignedTo.trim()||null,
    assignedUserId:form.assignedUserId||null,dueAt:formatDue(form.dueAt),note:form.note.trim()||null,
   });
   if(readSession().hotelId!==hotelId)return;
   setPage(1);close();
   // Failed cache refresh must not make an already committed update look failed.
   void Promise.all([
    client.invalidateQueries({queryKey:['live-housekeeping',hotelId]}),
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
 const data=tasks.data?.data??[];
 const matchText=textFilter.trim().toLocaleLowerCase();
 const filtered=data.filter(task=>(!mineOnly||task.assignedUserId===user?.id)&&(!matchText||[
  task.roomNumber,task.type,task.status,task.assignedTo??'',task.id,
 ].some(value=>value.toLocaleLowerCase().includes(matchText))));
 const pageCounts={todo:data.filter(t=>t.status==='todo').length,in_progress:data.filter(t=>t.status==='in_progress').length,
  done:data.filter(t=>t.status==='done').length};
 const overdueCount=data.filter(t=>t.status!=='done'&&t.dueAt&&t.dueAt.slice(0,10)<hotelDate).length;
 const hasFilters=!!statusFilter||!!typeFilter||!!textFilter.trim()||mineOnly;
 const resetFilters=()=>{setPage(1);setStatusFilter('');setTypeFilter('');setTextFilter('');setMineOnly(false);};
 const assignedName=(task:LiveHousekeepingTask)=>task.assignedUserId
  ?task.assignedUserId===user?.id?'You':admin?staff.data?.data.find(m=>m.userId===task.assignedUserId)?.name??'Assigned staff':'Assigned staff'
  :task.assignedTo??'Unassigned';
 const canUpdate=(task:LiveHousekeepingTask)=>admin||(role==='housekeeping'&&task.assignedUserId===user?.id);
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
    <Heading title="Housekeeping" description="Find assigned rooms, finish cleaning work, and hand off completed rooms for separate readiness checks."/></div>
   {admin&&<button type="button" className="btn-primary" onClick={openCreate}><Plus size={16}/> New cleaning task</button>}
  </div>
  <div className="hk-guidance"><Info size={18}/><p><strong>Cleaning done is not room approved.</strong> Completing a task updates housekeeping records only. Room inspection, maintenance restrictions, and guest check-in are checked separately.</p></div>
  <section className="hk-work-summary" aria-label="Housekeeping tasks on current page">
   <div className="hk-work-heading"><div><span className="rr-eyebrow">CURRENT PAGE</span><h3>Cleaning workload</h3>
    <p>Counts below describe the {data.length} loaded tasks, not every room in the hotel.</p></div>
    <button type="button" className="rr-secondary-action" disabled={tasks.isFetching} onClick={()=>void tasks.refetch()}><RefreshCcw size={16}/>{tasks.isFetching?'Refreshing…':'Refresh tasks'}</button>
   </div>
   <div className="hk-work-metrics">
    <div><Clock3 size={19}/><span>To do</span><strong>{tasks.isSuccess?pageCounts.todo:'—'}</strong></div>
    <div><ClipboardCheck size={19}/><span>In progress</span><strong>{tasks.isSuccess?pageCounts.in_progress:'—'}</strong></div>
    <div><CheckCircle2 size={19}/><span>Completed</span><strong>{tasks.isSuccess?pageCounts.done:'—'}</strong></div>
    <div className="hk-metric-alert"><AlertTriangle size={19}/><span>Past due date</span><strong>{tasks.isSuccess?overdueCount:'—'}</strong></div>
   </div>
  </section>
  <section className="hk-queue-section" aria-labelledby="hk-queue-title">
   <div className="hk-queue-head">
    <div><h3 id="hk-queue-title">Cleaning task queue</h3><p>Search, filter, and open tasks to update progress.</p></div>
    <span>{tasks.isSuccess?tasks.data.meta.total:'—'} tasks matching selected status and type</span>
   </div>
   <div className="hk-queue-filters">
    <div className="hk-queue-tabs" role="group" aria-label="Task status">
     {([['','All tasks'],['todo','To do'],['in_progress','In progress'],['done','Completed']] as const).map(([value,label])=>
      <button key={value} type="button" aria-pressed={statusFilter===value} className={statusFilter===value?'active':''}
       onClick={()=>{setStatusFilter(value);setPage(1);}}>{label}</button>)}
    </div>
    <div className="hk-filter-controls">
     <label className="hk-search-field"><Search size={17}/><input aria-label="Search tasks on this page" type="search" value={textFilter}
      placeholder="Room number, staff, task…" onChange={e=>setTextFilter(e.target.value)}/></label>
     <label className="hk-type-filter">Task type <select aria-label="Filter task type" value={typeFilter}
      onChange={e=>{setTypeFilter(e.target.value as HousekeepingType|'');setPage(1);}}>
      <option value="">All types</option>
      {taskTypes.map(type=><option key={type} value={type}>{taskNames[type]}</option>)}
     </select></label>
     {user&&<label className="hk-mine-filter"><input type="checkbox" checked={mineOnly} onChange={e=>setMineOnly(e.target.checked)}/> My tasks on this page</label>}
     {hasFilters&&<button type="button" className="hk-clear" onClick={resetFilters}><X size={15}/> Clear filters</button>}
    </div>
    <p className="hk-filter-note"><Info size={14}/> Status and task type search the hotel's saved tasks. Text search and My tasks apply only to the current page.</p>
   </div>
   <QueryFeedback loading={tasks.isPending} error={tasks.error} onRetry={()=>void tasks.refetch()}
    empty={tasks.isSuccess&&filtered.length===0}
    emptyMessage={hasFilters?'No tasks match these filters on this page. Clear filters or browse another page.':'No housekeeping tasks found. An administrator can create a new task.'}/>
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
      {task.status==='done'&&<p className="hk-cleaning-finished"><CheckCircle2 size={15}/> Cleaning completed. Room inspection and readiness are separate.</p>}
      <button type="button" className="hk-open-task" onClick={()=>openEdit(task)}>
       {editable?task.status==='todo'?'Start or update task':task.status==='in_progress'?'Update cleaning progress':'View completed task':'View task details'}
       <ArrowRight size={16}/>
      </button>
     </article>;
    })}
   </div>}
   {tasks.isSuccess&&tasks.data.meta.totalPages>1&&<div className="hk-queue-pagination">
    <span>Page {tasks.data.meta.page} of {tasks.data.meta.totalPages} · {filtered.length} shown on this page</span>
    <div><button type="button" className="btn-inline" disabled={page<=1} onClick={()=>setPage(x=>Math.max(1,x-1))}>Previous</button>
     <button type="button" className="btn-inline" disabled={page>=tasks.data.meta.totalPages} onClick={()=>setPage(x=>x+1)}>Next</button></div>
   </div>}
  </section>
  {form&&<div className="guest-modal-backdrop" role="presentation"><section className="guest-modal" role="dialog" aria-modal="true" aria-labelledby="hk-dialog-title">
   <div className="catalog-modal-heading"><h3 id="hk-dialog-title">{selected?'Housekeeping task HK-'+selected.id:'Create housekeeping task'}</h3>
    <button type="button" className="icon-btn" aria-label="Close" disabled={saving} onClick={close}><X size={19}/></button></div>
   <p>This task records cleaning work only. A completed task does not automatically approve room readiness.</p>
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
    <label>Status<select disabled={!selected||!maySave||saving} value={form.status} onChange={e=>change('status',e.target.value as HousekeepingStatus)}>
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
    {maySave&&<button type="submit" className="btn-primary" disabled={saving}>{saving?'Saving…':selected?'Save changes':'Create task'}</button>}</div>
   </form>
   {selected&&<div className="catalog-audit-section">
    <button type="button" className="btn-inline" onClick={()=>setHistoryOpen(v=>!v)}><History size={16}/>{historyOpen?'Hide':'View'} task history</button>
    {historyOpen&&<><QueryFeedback loading={history.isPending} error={history.error}/>
     {history.data?.data.map(event=><article className="maintenance-history-event" key={event.id}>
      <strong>{event.action} · Staff #{event.actorId}</strong><small>{event.createdAt}</small>
      {event.note&&<p>{event.note}</p>}</article>)}
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
   <p>Marking a task complete does not confirm the room is ready for guests. The current inspection, maintenance restrictions, and reservation availability must still be checked.</p>
  </div></div>
 </>;
}
