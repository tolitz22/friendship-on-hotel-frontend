import {useEffect,useRef,useState,type FormEvent} from 'react';
import {z} from 'zod';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {useNavigate,useSearch} from '@tanstack/react-router';
import {ArrowRight,CheckCircle2,History,Plus,RefreshCcw,X} from 'lucide-react';
import {useHotelAuth} from '../components/AuthProvider';
import {HousekeepingIssueReport} from '../components/HousekeepingIssueReport';
import {useNetworkStatus} from '../features/housekeeping/useNetworkStatus';
import {HousekeepingManagerReport} from '../components/HousekeepingManagerReport';
import {useLiveRooms,useLiveProperty} from '../api/liveCatalogQueries';
import {hotelToday} from '../features/reservations/calendarDate';
import {
 createHousekeepingTask,getHousekeepingHistory,getHousekeepingTask,listHousekeepingTasks,updateHousekeepingTask,completeHousekeepingInspection,
 type LiveHousekeepingTask,type HousekeepingStatus,type HousekeepingType,type TaskFilter,getHousekeepingWorkload,
 parseLiveHousekeeping,parseUpdatedHousekeeping,useDirectHousekeepingTask,canFinishCleaningChecklist,
} from '../api/liveHousekeeping';
import {ApiError,getJson} from '../api/http';
import {hotelPath,readSession} from '../api/session';
import {linkedTaskKey,shouldOpenLinkedTask} from '../lib/linkedTaskSelection';
import {listHotelStaff} from '../api/liveStaff';
import {QueryFeedback} from '../components/QueryFeedback';
import {ReadableAuditEvent} from '../components/ReadableAuditEvent';
import {useLiveReadiness} from '../api/liveRoomReadiness';
import {TaskWorkspace,defaultWorkspaceFilters,type WorkspaceFilters} from '../features/housekeeping/TaskWorkspace';
import {dueLabel,statusNames,taskNames} from '../features/housekeeping/taskDisplay';
import '../features/housekeeping/taskWorkspace.css';

const taskTypes:HousekeepingType[]=['checkout_clean','stayover'];
type FormState={roomId:string;type:HousekeepingType;
 assignedTo:string;assignedUserId:string;dueAt:string;note:string;checkedItems:string[]};
const empty=():FormState=>({roomId:'',type:'checkout_clean',assignedTo:'',assignedUserId:'',dueAt:'',note:'',checkedItems:[]});
const fromTask=(task:LiveHousekeepingTask):FormState=>({
 roomId:task.roomId,type:task.type,
 assignedTo:task.assignedTo??'',assignedUserId:task.assignedUserId??'',dueAt:task.dueAt?task.dueAt.replace('T',' ').slice(0,16):'',note:'',
 checkedItems:task.checklist?.filter(item=>item.checkedAt!==null).map(item=>item.key)??[],
});
const formatDue=(value:string)=>value.trim()===''?null:value.replace('T',' ')+':00';
function TaskDetail({label,value}:{label:string;value:string}){
 return <div className="hk-task-detail"><span className="hk-task-detail-label">{label}</span><span className="hk-task-detail-value">{value}</span></div>;
}
export function LiveHousekeeping(){
 const {hotelId,user}=useHotelAuth();
 const {task:linkedTaskId,queue:linkedQueue,status:linkedStatus}=useSearch({from:'/housekeeping'});
 const navigate=useNavigate();
 const directTask=useDirectHousekeepingTask(linkedTaskId??null);
 const openedLinkedTask=useRef<string|null>(null);
 const role=user?.hotels.find(h=>h.id===hotelId)?.role;
 const admin=role==='admin';
 const canWork=admin||(role==='housekeeping'&&user?.hotels.find(h=>h.id===hotelId)?.permissions?.includes('housekeeping.assigned')!==false);
 const property=useLiveProperty();
 const hotelDate=hotelToday(new Date(),property.data?.data.timeZone??'Asia/Manila');
 const staff=useQuery({queryKey:['hotel-staff',hotelId],queryFn:listHotelStaff,enabled:admin});
 const workload=useQuery({queryKey:['live','housekeeping-workload',hotelId],enabled:admin&&!!hotelId,retry:false,
  queryFn:()=>getHousekeepingWorkload(hotelId!),refetchInterval:30000});
 const eligibleStaff=staff.data?.data.filter(m=>m.isActive&&m.accountActive&&(m.role==='admin'||m.role==='housekeeping'&&m.permissions.includes('housekeeping.assigned')))??[];
 const workloadFor=(id:string)=>workload.isSuccess?(workload.data.find(row=>row.userId===id)?.todo??0)+(workload.data.find(row=>row.userId===id)?.inProgress??0):null;
 const sortedStaff=[...eligibleStaff].sort((x,y)=>(workloadFor(x.userId)??0)-(workloadFor(y.userId)??0)||x.name.localeCompare(y.name));
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
 const client=useQueryClient();
 const [page,setPage]=useState(1);
 const [filters,setFilters]=useState<WorkspaceFilters>(()=>({...defaultWorkspaceFilters,view:linkedQueue??linkedStatus??'all'}));
 const changeFilters=(next:Partial<WorkspaceFilters>)=>{
  setPage(1);
  setFilters(current=>({...current,...next}));
 };
 const finalInspectionRef=useRef<HTMLHeadingElement>(null);
 const jumpToInspection=useRef(false);
 const searchTerm=filters.text.trim();
 const [debouncedText,setDebouncedText]=useState(searchTerm);
 useEffect(()=>{
  const timer=window.setTimeout(()=>setDebouncedText(searchTerm),220);
  return ()=>window.clearTimeout(timer);
 },[searchTerm]);
 const view=filters.view;
 const filter:TaskFilter={
  status:view==='todo'||view==='in_progress'||view==='done'?view:undefined,
  queue:view==='all'||view==='mine'||view==='todo'||view==='in_progress'||view==='done'?undefined:view,
  type:filters.type||undefined,q:searchTerm?debouncedText||undefined:undefined,
  mine:view==='mine'?1:undefined,sort:'priority',assignee:filters.assignee||undefined,
  floor:filters.floor||undefined,room:filters.room.trim()||undefined,dueDate:filters.dueDate||undefined,
 };
 const tasks=useQuery({
  queryKey:['live-housekeeping',hotelId,user?.id,page,filter],
  enabled:!!hotelId,
  queryFn:async()=>parseLiveHousekeeping(await listHousekeepingTasks(page,20,filter),hotelId!),
  retry:false,
 });
 const overview=useQuery({
  queryKey:['live-housekeeping-status-totals',hotelId,user?.id],
  enabled:!!hotelId,
  queryFn:async()=>parseLiveHousekeeping(await listHousekeepingTasks(1,1,{overview:1}),hotelId!),
  retry:false,
 });
 const [selected,setSelected]=useState<LiveHousekeepingTask|null>(null);
 const [form,setForm]=useState<FormState|null>(null);
 const [saving,setSaving]=useState(false);
 const rooms=useLiveRooms({page:1,perPage:100},admin&&!!form&&!selected);
 const online=useNetworkStatus();
 const [saveMessage,setSaveMessage]=useState('');
 const [notice,setNotice]=useState('');
 const [needsReview,setNeedsReview]=useState(false);
 const [latest,setLatest]=useState<LiveHousekeepingTask|null>(null);
 const [reviewLoading,setReviewLoading]=useState(false);
 const dialog=useRef<HTMLDialogElement>(null);
 const editorOpen=!!form;
 useEffect(()=>{
  if(!editorOpen)return;
  const modal=dialog.current;
  const previousFocus=document.activeElement;
  modal?.showModal();
  return ()=>{
   modal?.close();
   if(previousFocus instanceof HTMLElement&&previousFocus.isConnected)previousFocus.focus();
  };
 },[editorOpen]);
 useEffect(()=>{
  if(jumpToInspection.current&&selected?.status==='done'&&!saving){
   jumpToInspection.current=false;
   finalInspectionRef.current?.focus();
  }
 },[selected?.status,selected?.id,saving]);
 const [inspectionChecks,setInspectionChecks]=useState([false,false,false]);
 const [inspectionNote,setInspectionNote]=useState('');
 const [inspectionMessage,setInspectionMessage]=useState('');
 const checkoutDone=selected?.type==='checkout_clean'&&selected.status==='done';
 const readiness=useLiveReadiness(checkoutDone?selected.roomId:null);
 const inspectionRecorded=checkoutDone&&(selected.pendingInspection===false||!!readiness.data?.advisoryReady);
 const blockers=readiness.data?.blockers;
 const inspectionBlockers=[
  blockers?.activeRoomImpactMaintenance?'Ask maintenance to resolve the room-impacting work order.':null,
  blockers?.activeInventoryBlockToday?'Ask reception or a manager to clear the active inventory restriction.':null,
  blockers?.latestTurnoverIncomplete?'Complete the outstanding checkout cleaning.':null,
  blockers?.unfinishedHousekeeping&&!blockers.latestTurnoverIncomplete?'Complete the other open cleaning tasks for this room.':null,
 ].filter(Boolean);
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
  setPage(1);setSelected(null);setForm(null);setError('');setNotice('');setHistoryOpen(false);setHistoryPage(1);
  jumpToInspection.current=false;
 },[hotelId]);
 useEffect(()=>{changeFilters({...defaultWorkspaceFilters,view:linkedQueue??linkedStatus??'all'});},[hotelId,linkedQueue,linkedStatus]);
 useEffect(()=>{
  openedLinkedTask.current=null;
 },[hotelId,linkedTaskId]);
 useEffect(()=>{
  if(!linkedTaskId||!hotelId||!directTask.data)return;
  // A background refetch must never discard unsaved notes or checklist edits.
  if(!shouldOpenLinkedTask(openedLinkedTask.current,hotelId,linkedTaskId))return;
  openedLinkedTask.current=linkedTaskKey(hotelId,linkedTaskId);
  openEdit(directTask.data);
 },[linkedTaskId,directTask.data,hotelId]);
 useEffect(()=>{
  if(tasks.isSuccess&&page>tasks.data.meta.totalPages)setPage(Math.max(1,tasks.data.meta.totalPages));
 },[page,tasks.isSuccess,tasks.data]);
 function resetEditor(){
  setSaveMessage('');setError('');setFieldErrors({});setHistoryOpen(false);setHistoryPage(1);
  setInspectionChecks([false,false,false]);setInspectionNote('');setInspectionMessage('');
  setNeedsReview(false);setLatest(null);jumpToInspection.current=false;
 }
 function openCreate(){
  resetEditor();
  setSelected(null);setForm(empty());
 }
 function openEdit(task:LiveHousekeepingTask){
  resetEditor();
  jumpToInspection.current=!!task.pendingInspection;
  setSelected(task);setForm(fromTask(task));
 }
 function close(){
  resetEditor();
  setSelected(null);setForm(null);
  if(linkedTaskId)void navigate({to:'/housekeeping',search:{task:undefined}});
 }
 async function checkLatest(){
  if(!selected||!hotelId||!online||reviewLoading)return;
  setReviewLoading(true);
  setError('');
  try{
   const task=await getHousekeepingTask(hotelId,selected.id);
   if(readSession().hotelId===hotelId){
    setLatest(task);
    void client.invalidateQueries({queryKey:['housekeeping-history',hotelId,task.id]});
   }
  }catch(cause){
   if(readSession().hotelId===hotelId)setError(cause instanceof Error?cause.message:'Unable to load the latest task.');
  }finally{setReviewLoading(false);}
 }
 function applyLatest(keepDraft:boolean){
  if(!latest||!form||!selected)return;
  const next=fromTask(latest);
  if(keepDraft){
   const base=fromTask(selected);
   for(const key of ['assignedUserId','assignedTo','dueAt','note'] as const){
    if(form[key]!==base[key])next[key]=form[key];
   }
   if(latest.status!=='done'){
    const kept=next.checkedItems.filter(key=>!base.checkedItems.includes(key)||form.checkedItems.includes(key));
    const added=form.checkedItems.filter(key=>!base.checkedItems.includes(key));
    next.checkedItems=[...new Set([...kept,...added])];
   }
  }else{
   setInspectionChecks([false,false,false]);setInspectionNote('');
  }
  setSelected(latest);setForm(next);setLatest(null);setNeedsReview(false);setError('');setFieldErrors({});
  setSaveMessage(keepDraft?'Draft reapplied to the latest task. Review your changes before saving.':'Latest task loaded.');
  if(latest.status==='done'&&latest.type==='checkout_clean')void client.invalidateQueries({queryKey:['live','room-readiness',hotelId,latest.roomId]});
 }
 function writeError(caught:unknown,fallback:string){
  if(caught instanceof ApiError){
   setFieldErrors(caught.fieldErrors??{});
   if(selected&&(caught.status===0||caught.status===409&&!/Resolve active housekeeping/i.test(caught.message))){
    setNeedsReview(true);
    setError(caught.status===409?'Another employee updated this task. Review the latest changes before saving.':'The connection dropped before the save could be confirmed. Review the latest task before retrying.');
   }else setError(caught.status===403?'You do not have permission to update this task. Ask your manager to review your access.':caught.message);
  }else setError(caught instanceof Error?caught.message:fallback);
 }
 const change=<K extends keyof FormState>(key:K,value:FormState[K])=>
  setForm(current=>current?{...current,[key]:value}:current);
 async function save(status?:HousekeepingStatus){
  if(!(admin||!!selected&&canWork)||!form||saving||!online||needsReview||!hotelId||selected&&selected.hotelId!==hotelId)return;
  if(selected&&status==='done'&&!canFinishCleaningChecklist(selected,form.checkedItems)){setError('Complete all required cleaning items first.');return;}
  const checklistFields=selected?.checklist&&selected.status!=='done'?{checkedItems:form.checkedItems}:{};
  const base=selected?fromTask(selected):null;
  const assignmentFields=admin&&base?{
   ...(form.assignedTo!==base.assignedTo?{assignedTo:form.assignedTo.trim()||null}:{}),
   ...(form.assignedUserId!==base.assignedUserId?{assignedUserId:form.assignedUserId||null}:{}),
   ...(form.dueAt!==base.dueAt?{dueAt:formatDue(form.dueAt)}:{}),
  }:{};
  setSaving(true);setError('');setFieldErrors({});setSaveMessage('');
  try{
   const updated=selected?parseUpdatedHousekeeping(await updateHousekeepingTask(selected.id,{
    expectedRevision:selected.revision,status,note:form.note.trim()||null,...checklistFields,...assignmentFields,
   }),hotelId,selected.id):null;
   if(!selected)await createHousekeepingTask({
    roomId:form.roomId,type:form.type,assignedTo:form.assignedTo.trim()||null,
    assignedUserId:form.assignedUserId||null,dueAt:formatDue(form.dueAt),note:form.note.trim()||null,
   });
   if(readSession().hotelId!==hotelId)return;
   setPage(1);
   if(updated){
    jumpToInspection.current=updated.type==='checkout_clean'&&updated.status==='done'&&selected?.status!=='done';
    setSelected(updated);setForm(fromTask(updated));
    setSaveMessage(updated.status==='done'&&selected?.status!=='done'?'Cleaning completed.'
     :updated.status==='in_progress'&&selected?.status==='todo'?'Cleaning started.':'Task updates saved.');
   }else{
    setNotice('Cleaning task created.');
    close();
   }
   // Failed cache refresh must not make an already committed update look failed.
   void Promise.all([
    client.invalidateQueries({queryKey:['live-housekeeping',hotelId]}),
    client.invalidateQueries({queryKey:['live','housekeeping-workload',hotelId]}),
    client.invalidateQueries({queryKey:['live','housekeeping-manager-report',hotelId]}),
    client.invalidateQueries({queryKey:['role-home','housekeeping',hotelId]}),
    client.invalidateQueries({queryKey:['live','housekeeping-handoff',hotelId]}),
    client.invalidateQueries({queryKey:['live-housekeeping-status-totals',hotelId]}),
    client.invalidateQueries({queryKey:['housekeeping-history',hotelId]}),
    client.invalidateQueries({queryKey:['live','front-desk','manifest',hotelId]}),
    client.invalidateQueries({queryKey:['live','readiness-dashboard',hotelId]}),
    client.invalidateQueries({queryKey:['live','housekeeping-room-board',hotelId]}),
    client.invalidateQueries({queryKey:['live','room-inventory-status',hotelId]}),
    client.invalidateQueries({queryKey:['live','room-readiness',hotelId]}),
    client.invalidateQueries({queryKey:['live','housekeeping-direct-task',hotelId]}),
   ]).catch(()=>{});
  }catch(caught){
   // A response from a previous hotel must not appear in the new hotel's editor.
   if(readSession().hotelId!==hotelId)return;
   writeError(caught,'Unable to save housekeeping task.');
  }finally{setSaving(false);}
 }
 const mayInspect=!!selected&&canWork&&selected.hotelId===hotelId;
 async function finishInspection(){
  if(!selected||!checkoutDone||inspectionRecorded||!mayInspect||saving||needsReview||!inspectionChecks.every(Boolean)
   ||inspectionNote.trim().length<5||!hotelId||!online||!readiness.isSuccess||inspectionBlockers.length)return;
  setSaving(true);setError('');setFieldErrors({});setInspectionMessage('');
  try{
   const updated=parseUpdatedHousekeeping(await completeHousekeepingInspection(
    selected.id,selected.revision,inspectionNote.trim()),hotelId,selected.id);
   if(readSession().hotelId!==hotelId)return;
   setSelected(updated);setForm(fromTask(updated));
   setInspectionMessage('Final inspection completed. Room readiness has been recalculated.');
   setInspectionChecks([false,false,false]);setInspectionNote('');
   void Promise.all([
    client.invalidateQueries({queryKey:['live','room-readiness',hotelId,selected.roomId]}),
    client.invalidateQueries({queryKey:['live','room-inventory-status',hotelId]}),
    client.invalidateQueries({queryKey:['live','readiness-dashboard',hotelId]}),
    client.invalidateQueries({queryKey:['live','housekeeping-room-board',hotelId]}),
    client.invalidateQueries({queryKey:['live','housekeeping-direct-task',hotelId]}),
    client.invalidateQueries({queryKey:['live-housekeeping',hotelId]}),
    client.invalidateQueries({queryKey:['live','housekeeping-workload',hotelId]}),
    client.invalidateQueries({queryKey:['live','housekeeping-manager-report',hotelId]}),
    client.invalidateQueries({queryKey:['live-housekeeping-status-totals',hotelId]}),
    client.invalidateQueries({queryKey:['role-home','housekeeping',hotelId]}),
    client.invalidateQueries({queryKey:['housekeeping-history',hotelId]}),
    client.invalidateQueries({queryKey:['live','front-desk','manifest',hotelId]}),
   ]).catch(()=>{});
  }catch(cause){
   if(readSession().hotelId===hotelId){
    writeError(cause,'Unable to complete final inspection.');
    void readiness.refetch();
   }
  }finally{setSaving(false);}
 }
 const assignedName=(task:LiveHousekeepingTask)=>{
  if(task.assignedUserId===user?.id)return 'You';
  const staffName=task.assignedName??staff.data?.data.find(person=>person.userId===task.assignedUserId)?.name;
  return staffName||task.assignedTo?.trim()||(task.assignedUserId?'Assigned employee':'Unassigned');
 };
 const canUpdate=(task:LiveHousekeepingTask)=>canWork&&task.hotelId===hotelId;
 const maySave=admin||(!!selected&&canUpdate(selected));
 const canCompleteCleaning=!!selected&&selected.status!=='done'&&!!form&&canFinishCleaningChecklist(selected,form.checkedItems);
 const assignmentChanged=admin&&!!selected&&!!form&&(
  form.assignedTo!==(selected.assignedTo??'')||form.assignedUserId!==(selected.assignedUserId??'')
  ||form.dueAt!==fromTask(selected).dueAt
 );

 return <>
  {linkedTaskId&&<section aria-label="Direct checkout cleaning task">
   <div className="desk-tools">
    <button type="button" className="btn-inline"
     onClick={()=>void navigate({to:'/housekeeping',search:{task:undefined}})}>Back to task queue</button>
   </div>
   <QueryFeedback loading={directTask.isPending} error={directTask.error}
    onRetry={()=>void directTask.refetch()}/>
  </section>}
  <header className="hk-workspace-intro">
   <h2>{admin?'Housekeeping tasks':'My Tasks'}</h2>
   {admin&&<button type="button" className="btn-primary" onClick={openCreate}><Plus size={17} aria-hidden="true"/> New cleaning task</button>}
  </header>
  {notice&&<p className="stay-feedback-success" role="status">{notice}</p>}
  <TaskWorkspace filters={filters} change={changeFilters} page={page} setPage={setPage} tasks={tasks} overview={overview}
   hotelDate={hotelDate} online={online} admin={admin} assignedName={assignedName} canUpdate={canUpdate} open={openEdit} canWork={canWork}/>
  {admin&&hotelId&&<details className="hk-management">
   <summary>Housekeeping management</summary>
   <HousekeepingManagerReport key={hotelId+':'+user?.id} hotelId={hotelId} staff={staff.data?.data??[]} onQueue={(queue,assignee)=>{
    changeFilters({...defaultWorkspaceFilters,view:queue,assignee:assignee??''});
    document.getElementById('hk-queue-title')?.scrollIntoView({block:'start',behavior:'smooth'});
   }}/>
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
  {admin&&<section className="hk-manager-handoff" aria-label="Staff cleaning workload">
   <div className="hk-work-heading"><div><h3>Staff workload</h3><p>Active assignments only. Select a staff member to review their queue before assigning more work.</p></div>
    <button type="button" className="btn-inline" disabled={workload.isFetching||staff.isFetching} onClick={()=>void Promise.all([workload.refetch(),staff.refetch()])}>Refresh workload</button></div>
   <QueryFeedback loading={workload.isPending||staff.isPending} error={workload.error??staff.error}/>
   {workload.isSuccess&&staff.isSuccess&&<div className="hk-staff-load">{sortedStaff.map(member=><button type="button" key={member.userId}
    className="btn-inline" aria-pressed={filters.assignee===member.userId&&view==='active'} onClick={()=>{changeFilters({...defaultWorkspaceFilters,view:'active',assignee:member.userId});document.getElementById('hk-queue-title')?.scrollIntoView({block:'start'});}}>
    <span>{member.name}</span><strong>{workloadFor(member.userId)} active</strong></button>)}
    {sortedStaff.length===0&&<p>No eligible housekeeping accounts.</p>}</div>}
  </section>}
  </details>}
  {form&&<dialog ref={dialog} className="hk-editor" aria-labelledby="hk-dialog-title"
   onCancel={event=>{event.preventDefault();if(!saving&&!reviewLoading)close();}}>
   <header className="hk-editor-header">
    <div>
     <p>{selected?taskNames[selected.type]:'Housekeeping'}{selected&&' · HK-'+selected.id}</p>
     <h2 id="hk-dialog-title">{selected?'Room '+selected.roomNumber:'New cleaning task'}</h2>
    </div>
    <button type="button" className="icon-btn" aria-label="Close task" disabled={saving||reviewLoading} onClick={close} autoFocus><X size={21}/></button>
   </header>
   <div className="hk-editor-content">
    {!online&&<p className="hk-network-alert" role="status">You’re offline. Your draft is open. Reconnect to save.</p>}
    {selected&&!maySave&&<p className="hk-workspace-note" role="status">Read-only task. Ask your manager to review your access if you need to record cleaning.</p>}
    {selected&&<section className="hk-editor-meta" aria-label="Task information">
     {selected.roomType&&<TaskDetail label="Room type" value={selected.roomType}/>}
     <TaskDetail label="Assigned employee" value={assignedName(selected)}/>
     <TaskDetail label="Due time" value={dueLabel(selected.dueAt,hotelDate)}/>
     <TaskDetail label="Cleaning status" value={statusNames[selected.status]}/>
    </section>}
    {needsReview&&<section className="hk-editor-feedback" aria-label="Review the latest task">
     <strong>Review before saving again</strong>
     <p>Your draft is still open. Check Activity history for any changes that already saved.</p>
     {!latest?<button type="button" className="btn-inline" disabled={!online||reviewLoading} onClick={()=>void checkLatest()}>{reviewLoading?'Checking latest…':'Check latest task'}</button>:
      <>
       <p>Latest saved status is {statusNames[latest.status].toLowerCase()}. {latest.checklist?.filter(item=>item.checkedAt!==null).length??0} checklist items are saved.</p>
       {latest.status==='done'&&selected?.status!=='done'&&<p>Cleaning is complete. Saved checklist evidence is locked. You can still carry over your handover note.</p>}
       <div className="hk-editor-controls">
        <button type="button" className="btn-inline" onClick={()=>applyLatest(false)}>Load latest and discard draft</button>
        <button type="button" className="btn-primary" onClick={()=>applyLatest(true)}>Keep my draft on latest task</button>
       </div>
      </>}
    </section>}

    <form id="hk-task-editor-form" onSubmit={(event:FormEvent<HTMLFormElement>)=>{
     event.preventDefault();
     void save(selected?.status==='todo'?'in_progress':undefined);
    }}>
     {admin&&(!selected?<div className="hk-editor-fields">
      <QueryFeedback loading={rooms.isPending} error={rooms.error} onRetry={()=>void rooms.refetch()}/>
      <label>Room<select required disabled={saving} value={form.roomId} onChange={event=>change('roomId',event.target.value)}>
       <option value="">Choose a room</option>{rooms.data?.data.map(room=><option key={room.id} value={room.id}>Room {room.number}</option>)}
      </select></label>
      {rooms.data&&rooms.data.meta.total>100&&<p>Only the first 100 rooms are available in this selector.</p>}
      <label>Task type<select disabled={saving} value={form.type} onChange={event=>change('type',event.target.value as HousekeepingType)}>
       {taskTypes.map(type=><option key={type} value={type}>{taskNames[type]}</option>)}
      </select></label>
     </div>:null)}
     {admin&&<details className="hk-editor-management" open={!selected||undefined}>
      <summary>{selected?'Manage assignment and due time':'Assignment and due time'}</summary>
      <div className="hk-editor-fields">
       <label>Assign staff member<select value={form.assignedUserId} disabled={saving} onChange={event=>change('assignedUserId',event.target.value)}>
        <option value="">No linked account</option>
        {form.assignedUserId&&!sortedStaff.some(member=>member.userId===form.assignedUserId)&&<option value={form.assignedUserId}>Current assignee</option>}
        {sortedStaff.map(member=><option key={member.userId} value={member.userId}>{member.name}{workloadFor(member.userId)!==null?' · '+workloadFor(member.userId)+' active':''}</option>)}
       </select></label>
       <label>Additional assigned staff name<input maxLength={120} disabled={saving} value={form.assignedTo} onChange={event=>change('assignedTo',event.target.value)}/></label>
       <label>Due date and time<input type="datetime-local" disabled={saving} value={form.dueAt} onChange={event=>change('dueAt',event.target.value)}/></label>
       {workload.isError&&<p role="status">Staff workload is unavailable.</p>}
      </div>
     </details>}
     {selected&&<section className="hk-editor-step" aria-labelledby="hk-cleaning-step">
      <div className="hk-editor-step-heading">
       <h3 id="hk-cleaning-step">1. Cleaning</h3>
       {!!selected.checklist?.length&&<strong aria-live="polite">{form.checkedItems.length}/{selected.checklist.length} checked</strong>}
      </div>
      {!!selected.checklist?.length&&<>
       <progress max={selected.checklist.length} value={form.checkedItems.length} aria-label="Cleaning checklist progress"/>
       <div className="hk-editor-checklist">
        {selected.checklist.map(item=><label key={item.key} className="hk-editor-check">
         <input type="checkbox" checked={form.checkedItems.includes(item.key)} disabled={!maySave||saving||selected.status==='done'}
          onChange={event=>{
           const checked=event.target.checked;
           setForm(old=>old?{...old,checkedItems:checked?[...old.checkedItems,item.key]:old.checkedItems.filter(key=>key!==item.key)}:old);
           setSaveMessage('');
          }}/>
         <span>{item.label}</span>
        </label>)}
       </div>
       {selected.status==='done'&&form.checkedItems.length!==selected.checklist.length&&<p className="hk-workspace-note">Detailed checklist evidence was unavailable for this completion.</p>}
      </>}
      {selected.type!=='inspection'&&!selected.checklist?.length&&<p role="status">Checklist unavailable. Reopen the task to load it before completing cleaning.</p>}
      {selected.status!=='done'&&selected.type!=='inspection'&&maySave&&
       <p className="hk-workspace-note">Check every item to enable Complete cleaning.</p>}
     </section>}
     {maySave&&<div className="hk-editor-fields">
      <label>Handover note<textarea rows={2} maxLength={2000} disabled={saving} value={form.note}
       onChange={event=>{change('note',event.target.value);setSaveMessage('');}} placeholder="Record anything the next shift should know"/></label>
     </div>}
    </form>
    {selected&&maySave&&hotelId&&<HousekeepingIssueReport key={hotelId+':'+selected.id} hotelId={hotelId} task={selected} disabled={saving}/>}
    {selected?.type==='checkout_clean'&&<section className="hk-editor-step hk-inspection-step" aria-labelledby="hk-inspection-step">
     <h3 id="hk-inspection-step" tabIndex={-1} ref={finalInspectionRef}>2. Final room inspection</h3>
     {!checkoutDone?<p>Complete cleaning to open final inspection.</p>:inspectionRecorded?
      <p role="status" className="hk-inspection-complete"><CheckCircle2 size={17} aria-hidden="true"/> Final inspection recorded</p>:
      <>
       <QueryFeedback loading={readiness.isPending} error={readiness.error} onRetry={()=>void readiness.refetch()}/>
       {inspectionBlockers.length>0&&<div className="hk-editor-feedback" role="status">
        <strong>Clear these blockers before inspecting</strong>
        <ul>{inspectionBlockers.map(blocker=><li key={blocker}>{blocker}</li>)}</ul>
        <button type="button" className="btn-inline" disabled={!online||readiness.isFetching} onClick={()=>void readiness.refetch()}><RefreshCcw size={15} aria-hidden="true"/> Recheck restrictions</button>
       </div>}
       <p>Check the physical room and record what you verified.</p>
       <div className="hk-editor-checklist">
        {['Room and bathroom are clean, with fresh linens','Safety, lighting and fixtures checked','Amenities and supplies checked'].map((label,index)=>
         <label key={label} className="hk-editor-check">
          <input type="checkbox" disabled={!mayInspect||saving} checked={inspectionChecks[index]}
           onChange={event=>setInspectionChecks(old=>old.map((value,i)=>i===index?event.target.checked:value))}/>
          <span>{label}</span>
         </label>)}
       </div>
       <div className="hk-editor-fields">
        <label>Inspection notes (required)<textarea value={inspectionNote} disabled={!mayInspect||saving} maxLength={2000} rows={2}
         onChange={event=>setInspectionNote(event.target.value)} placeholder="Describe the final inspection (at least 5 characters)"/></label>
       </div>
      </>}
    </section>}
    {selected&&<section className="hk-editor-history" aria-label="Activity history">
     <button type="button" className="btn-inline" aria-expanded={historyOpen} aria-controls="hk-history-events" onClick={()=>setHistoryOpen(value=>!value)}>
      <History size={17} aria-hidden="true"/> Activity history{history.data?' · '+history.data.meta.total:''}
     </button>
     <div id="hk-history-events" hidden={!historyOpen}>
      {historyOpen&&<>
       <QueryFeedback loading={history.isPending} error={history.error} onRetry={()=>void history.refetch()}
        empty={history.isSuccess&&history.data.data.length===0} emptyMessage="No activity has been recorded yet."/>
       {history.isSuccess&&history.data.data.length>0&&<>
        <p className="hk-workspace-note">Newest first</p>
        <ol className="hk-event-timeline">
         {history.data.data.map(event=><li key={event.id}><ReadableAuditEvent event={event}
          actorName={event.actorName??staff.data?.data.find(member=>member.userId===event.actorId)?.name}
          currentUserId={user?.id} currentUserName={user?.name} housekeepingChecklist={selected.checklist??[]}
          hotelTimeZone={property.data?.data.timeZone??'Asia/Manila'}/></li>)}
        </ol>
        {history.data.meta.totalPages>1&&<div className="hk-queue-pagination">
         <span>Page {historyPage} of {history.data.meta.totalPages}</span>
         <div><button type="button" className="btn-inline" disabled={historyPage<=1} onClick={()=>setHistoryPage(value=>value-1)}>Newer</button>
          <button type="button" className="btn-inline" disabled={historyPage>=history.data.meta.totalPages} onClick={()=>setHistoryPage(value=>value+1)}>Older</button></div>
        </div>}
       </>}
      </>}
     </div>
    </section>}
   </div>
   <footer className="hk-editor-footer">
    {error&&<p role="alert" className="auth-error">{error}</p>}
    {Object.entries(fieldErrors).flatMap(([field,messages])=>messages.map((message,index)=><p key={field+index} className="catalog-field-error" role="alert">{message}</p>))}
    {(inspectionMessage||saveMessage)&&<p role="status" className="hk-save-feedback">{inspectionMessage||saveMessage}</p>}
    <div className="hk-editor-controls">
     {!maySave&&<button type="button" className="btn-inline" onClick={close}>Close</button>}
     {maySave&&<>
      {(!selected||selected.status!=='done'||form.note.trim()||assignmentChanged)&&
       <button form="hk-task-editor-form" type="submit" className={canCompleteCleaning||checkoutDone&&!inspectionRecorded?'btn-inline':'btn-primary'}
        disabled={!online||saving||needsReview}>
        {!selected?'Create task':selected.status==='todo'?'Start cleaning':selected.status==='done'?'Save task updates':'Save progress'}
       </button>}
      {assignmentChanged&&selected?.status==='todo'&&<button type="button" className="btn-inline"
       disabled={!online||saving||needsReview} onClick={()=>void save()}>Save assignment</button>}
      {selected&&selected.status!=='done'&&<button type="button" className={canCompleteCleaning?'btn-primary':'btn-inline'}
       disabled={!online||saving||needsReview||!canCompleteCleaning} onClick={()=>void save('done')}>Complete cleaning</button>}
      {checkoutDone&&!inspectionRecorded&&<button type="button" className="btn-primary"
       disabled={!online||saving||needsReview||!readiness.isSuccess||inspectionBlockers.length>0||!inspectionChecks.every(Boolean)||inspectionNote.trim().length<5}
       onClick={()=>void finishInspection()}>Complete final inspection</button>}
     </>}
     {saving&&<span role="status">Saving…</span>}
    </div>
   </footer>
  </dialog>}
 </>;
}
