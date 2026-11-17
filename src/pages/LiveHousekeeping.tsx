import {useEffect,useState,type FormEvent} from 'react';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {ClipboardCheck,History,Plus,RefreshCcw,ShieldAlert,X} from 'lucide-react';
import {useHotelAuth} from '../components/AuthProvider';
import {useLiveRooms} from '../api/liveCatalogQueries';
import {
 createHousekeepingTask,getHousekeepingHistory,listHousekeepingTasks,updateHousekeepingTask,
 type LiveHousekeepingTask,type HousekeepingStatus,type HousekeepingType,type TaskFilter,
 parseLiveHousekeeping,parseUpdatedHousekeeping,
} from '../api/liveHousekeeping';
import {ApiError} from '../api/http';
import {readSession} from '../api/session';
import {listHotelStaff} from '../api/liveStaff';
import {Heading,Panel} from '../components/ui';
import {QueryFeedback} from '../components/QueryFeedback';

const taskTypes:HousekeepingType[]=['checkout_clean','stayover','inspection'];
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
 const role=user?.hotels.find(h=>h.id===hotelId)?.role;
 const admin=role==='admin';
 const staff=useQuery({queryKey:['hotel-staff',hotelId],queryFn:listHotelStaff,enabled:admin});
 const client=useQueryClient();
 const [page,setPage]=useState(1);
 const [statusFilter,setStatusFilter]=useState<HousekeepingStatus|''>('');
 const [typeFilter,setTypeFilter]=useState<HousekeepingType|''>('');
 const [textFilter,setTextFilter]=useState('');
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
 const history=useQuery({
  queryKey:['housekeeping-history',hotelId,selected?.id],
  queryFn:()=>getHousekeepingHistory(selected!.id),
  enabled:!!selected&&historyOpen,
 });
 useEffect(()=>{
  setPage(1);setSelected(null);setForm(null);setError('');setHistoryOpen(false);
  setTextFilter('');setStatusFilter('');setTypeFilter('');
 },[hotelId]);
 const openCreate=()=>{setSelected(null);setForm(empty());setError('');setFieldErrors({});setHistoryOpen(false);};
 const openEdit=(task:LiveHousekeepingTask)=>{
  setSelected(task);setForm(fromTask(task));setError('');setFieldErrors({});setHistoryOpen(false);
 };
 const close=()=>{setSelected(null);setForm(null);setError('');setHistoryOpen(false);};
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
   ]).catch(()=>{});
  }catch(caught){
   if(caught instanceof ApiError){
    setFieldErrors(caught.fieldErrors??{});
    setError(caught.status===409?'This task changed. Close and reopen the latest task before saving.':caught.message);
   }else setError(caught instanceof Error?caught.message:'Unable to save housekeeping task.');
  }finally{setSaving(false);}
 }
 const data=tasks.data?.data??[];
 const matchText=textFilter.trim().toLocaleLowerCase();
 const filtered=data.filter(task=>!matchText||[task.roomNumber,task.type,task.status,task.assignedTo??'',task.id]
  .some(value=>value.toLocaleLowerCase().includes(matchText)));
 const canUpdate=(task:LiveHousekeepingTask)=>admin||(role==='housekeeping'&&task.assignedUserId===user?.id);
 const maySave=admin||(!!selected&&canUpdate(selected));
 return <>
  <div className="notice"><strong>Live housekeeping tasks</strong> · Cleaning assignments and completion are stored in Laravel. Completing a task does not set room readiness, block reservations, or change occupancy.</div>
  <Heading title="Housekeeping" description="Property-scoped cleaning tasks with revision tracking and recorded history" action={admin?
   <button type="button" className="btn-primary" onClick={openCreate}><Plus size={16}/> Create task</button>:undefined}/>
  <div className="mnt-summary">
   <div><ClipboardCheck size={20}/><span>To do on this page</span><strong>{data.filter(x=>x.status==='todo').length}</strong></div>
   <div><ClipboardCheck size={20}/><span>In progress on this page</span><strong>{data.filter(x=>x.status==='in_progress').length}</strong></div>
   <div><ClipboardCheck size={20}/><span>Done on this page</span><strong>{data.filter(x=>x.status==='done').length}</strong></div>
   <div><History size={20}/><span>All saved tasks</span><strong>{tasks.data?.meta.total??'—'}</strong></div>
  </div>
  <Panel title="Cleaning tasks" action={<button type="button" className="btn-inline" onClick={()=>void tasks.refetch()}><RefreshCcw size={15}/> Refresh</button>}>
   <div className="hk-toolbar">
    <label>Status <select aria-label="Filter saved task status" value={statusFilter}
     onChange={e=>{setStatusFilter(e.target.value as HousekeepingStatus|'');setPage(1);close();}}>
      <option value="">All statuses</option>
      {(['todo','in_progress','done'] as const).map(status=><option key={status} value={status}>{status.replaceAll('_',' ')}</option>)}
    </select></label>
    <label>Task type <select aria-label="Filter saved task type" value={typeFilter}
     onChange={e=>{setTypeFilter(e.target.value as HousekeepingType|'');setPage(1);close();}}>
      <option value="">All types</option>
      {taskTypes.map(type=><option key={type} value={type}>{type.replaceAll('_',' ')}</option>)}
    </select></label>
    <label>Search current page <input aria-label="Search current task page" value={textFilter}
     onChange={e=>setTextFilter(e.target.value)}/></label>
   </div>
   <p className="hk-notice">Status and task type filters run on Laravel. Text search filters the current page only. Counts describe the visible page, not all hotel rooms.</p>
   <QueryFeedback loading={tasks.isPending} error={tasks.error} empty={!!tasks.data&&filtered.length===0}/>
   {filtered.length>0&&<div className="mnt-order-grid">{filtered.map(task=><article className="mnt-order" key={task.id}>
    <div className="mnt-order-top"><strong>HK-{task.id}</strong><span className="status">{task.status.replaceAll('_',' ')}</span></div>
    <h3>Room {task.roomNumber}</h3>
    <p>{task.type.replaceAll('_',' ')} · Assigned: {task.assignedUserId?(admin?staff.data?.data.find(m=>m.userId===task.assignedUserId)?.name??('Staff #'+task.assignedUserId):task.assignedUserId===user?.id?'You':'Linked staff #'+task.assignedUserId):task.assignedTo??'Unassigned'}</p>
    <div className="mnt-order-info"><span>Due</span><strong>{task.dueAt??'Not scheduled'}</strong></div>
    <div className="mnt-order-info"><span>Revision</span><strong>{task.revision}</strong></div>
    <button type="button" className="btn-inline mnt-review" onClick={()=>openEdit(task)}>{canUpdate(task)?'Manage task':'View task'} <ClipboardCheck size={15}/></button>
   </article>)}</div>}
   {tasks.data&&<div className="guest-pagination"><span>Page {tasks.data.meta.page} of {Math.max(1,tasks.data.meta.totalPages)}</span>
    <div><button type="button" className="btn-inline" disabled={page<=1} onClick={()=>setPage(x=>Math.max(1,x-1))}>Previous</button>
    <button type="button" className="btn-inline" disabled={page>=tasks.data.meta.totalPages} onClick={()=>setPage(x=>x+1)}>Next</button></div></div>}
  </Panel>
  {form&&<div className="guest-modal-backdrop" role="presentation"><section className="guest-modal" role="dialog" aria-modal="true" aria-labelledby="hk-dialog-title">
   <div className="catalog-modal-heading"><h3 id="hk-dialog-title">{selected?'Housekeeping task HK-'+selected.id:'Create housekeeping task'}</h3>
    <button type="button" className="icon-btn" aria-label="Close" disabled={saving} onClick={close}><X size={19}/></button></div>
   <p>Task progress is informational. Room readiness is a separate, unimplemented operational policy.</p>
   {!selected&&rooms.data&&rooms.data.meta.total>100&&<p className="guest-info">Room selector displays only the first 100 registered rooms.</p>}
   <form onSubmit={e=>void save(e)}><div className="guest-fields">
    <label>Room<select required disabled={!!selected||!admin||saving} value={form.roomId} onChange={e=>change('roomId',e.target.value)}>
     <option value="">Choose a room</option>{rooms.data?.data.map(r=><option key={r.id} value={r.id}>Room {r.number}</option>)}</select></label>
    <label>Task type<select disabled={!!selected||!admin||saving} value={form.type} onChange={e=>change('type',e.target.value as HousekeepingType)}>
     {taskTypes.map(type=><option key={type} value={type}>{type.replaceAll('_',' ')}</option>)}</select></label>
    <label>Status<select disabled={!selected||!maySave||saving} value={form.status} onChange={e=>change('status',e.target.value as HousekeepingStatus)}>
     {[selected?.status??'todo',...(transitions[selected?.status??'todo']??[])].map(status=><option key={status} value={status}>{status.replaceAll('_',' ')}</option>)}</select></label>
    {admin&&<label>Linked staff account<select value={form.assignedUserId} disabled={saving} onChange={e=>change('assignedUserId',e.target.value)}>
     <option value="">No linked account</option>
     {staff.data?.data.filter(m=>m.isActive&&m.accountActive&&(m.role==='housekeeping'||m.role==='admin')).map(m=><option key={m.userId} value={m.userId}>{m.name} ({m.role})</option>)}
    </select></label>}
    <label>Assigned staff (legacy text)<input maxLength={120} disabled={!admin||saving} value={form.assignedTo} onChange={e=>change('assignedTo',e.target.value)}/></label>
    <label>Due at (hotel-local)<input type="datetime-local" disabled={!admin||saving} value={form.dueAt} onChange={e=>change('dueAt',e.target.value)}/></label>
    {maySave&&<label>Handover note<textarea rows={2} maxLength={2000} disabled={saving} value={form.note} onChange={e=>change('note',e.target.value)}/></label>}
   </div>
   {Object.entries(fieldErrors).flatMap(([field,messages])=>messages.map((m,i)=><p key={field+i} className="catalog-field-error" role="alert">{field}: {m}</p>))}
   {error&&<p role="alert" className="auth-error">{error}</p>}
   <div className="guest-modal-actions"><button type="button" className="btn-inline" disabled={saving} onClick={close}>Close</button>
    {maySave&&<button type="submit" className="btn-primary" disabled={saving}>{saving?'Saving…':selected?'Save changes':'Create task'}</button>}</div>
   </form>
   {selected&&<div className="catalog-audit-section">
    <button type="button" className="btn-inline" onClick={()=>setHistoryOpen(v=>!v)}><History size={16}/>{historyOpen?'Hide':'View'} audit history</button>
    {historyOpen&&<><QueryFeedback loading={history.isPending} error={history.error}/>
     {history.data?.data.map(event=><article className="maintenance-history-event" key={event.id}>
      <strong>{event.action} · Staff #{event.actorId}</strong><small>{event.createdAt}</small>
      {event.note&&<p>{event.note}</p>}</article>)}</>}
   </div>}
  </section></div>}
  <div className="demand-warning"><ShieldAlert size={18}/><div><strong>No automatic room readiness</strong>
   <p>Finishing a cleaning task does not mark the physical room clean or bookable. Approval of room status rules is still required.</p>
  </div></div>
 </>;
}
