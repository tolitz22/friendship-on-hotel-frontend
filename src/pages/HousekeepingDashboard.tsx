import {Link,useNavigate} from '@tanstack/react-router';
import {useMutation,useQuery,useQueryClient} from '@tanstack/react-query';
import {AlertTriangle,ArrowRight,BedDouble,CheckCircle2,ClipboardCheck,Clock3,RefreshCcw,ShieldCheck,Wrench,Package,MessageCircle,CalendarDays,Play,WifiOff} from 'lucide-react';
import {useHotelAuth} from '../components/AuthProvider';
import {dueLabel,taskNames} from '../features/housekeeping/taskDisplay';
import {canViewWorkspacePath} from '../features/workspaces/roleNavigation';
import '../features/housekeeping/shiftWorkspace.css';
import {getPersonalHousekeepingDashboard,listHousekeepingTasks,parseLiveHousekeeping,patchLiveHousekeeping,type LiveHousekeepingTask,type PersonalHousekeepingDashboard} from '../api/liveHousekeeping';
import {ApiError} from '../api/http';
import {readSession} from '../api/session';
import {useNetworkStatus} from '../features/housekeeping/useNetworkStatus';

const priorityLabels={arrival_today:'Arrival today',overdue:'Overdue',in_progress:'In progress',normal:'Scheduled'};
type PriorityTask=PersonalHousekeepingDashboard['tasks'][number];
const dateLabel=(date:string)=>new Date(date+'T12:00:00Z').toLocaleDateString(undefined,{weekday:'long',month:'short',day:'numeric',year:'numeric',timeZone:'UTC'});
export function HousekeepingDashboard(){
 const {hotelId,user}=useHotelAuth();
 const client=useQueryClient();
 const navigate=useNavigate();
 const online=useNetworkStatus();
 const membership=user?.hotels.find(h=>h.id===hotelId);
 const canWork=membership?.role==='housekeeping'&&membership.permissions?.includes('housekeeping.assigned')!==false;
 const dashboard=useQuery({
  queryKey:['role-home','housekeeping',hotelId,user?.id],
  enabled:!!hotelId&&!!user?.id,
  queryFn:()=>getPersonalHousekeepingDashboard(hotelId!,user!.id),
  retry:false,refetchInterval:30000,refetchIntervalInBackground:false,
 });
 const inspections=useQuery({
  queryKey:['role-home','housekeeping',hotelId,user?.id,'pending-inspections'],
  enabled:!!hotelId&&!!user?.id,
  queryFn:async()=>{
   if(readSession().hotelId!==hotelId)throw new Error('Hotel changed.');
   const result=parseLiveHousekeeping(await listHousekeepingTasks(1,5,{mine:1,queue:'pending_inspection',sort:'priority'}),hotelId!);
   if(result.data.some(task=>task.assignedUserId!==user?.id||task.type!=='checkout_clean'||task.status!=='done'||task.pendingInspection!==true))throw new Error('Inspection queue scope mismatch.');
   return result;
  },retry:false,refetchInterval:30000,refetchIntervalInBackground:false,
 });
 const start=useMutation({
  mutationFn:(task:LiveHousekeepingTask)=>{
   if(!online||!hotelId||!canWork||task.assignedUserId!==user?.id||task.status!=='todo')
    throw new Error('This task cannot be started by your account.');
   return patchLiveHousekeeping(hotelId,task,{expectedRevision:task.revision,status:'in_progress'});
  },
  retry:false,
  onSuccess:task=>{
   if(readSession().hotelId===hotelId&&task.assignedUserId===user?.id)
    void navigate({to:'/housekeeping',search:{task:task.id}});
  },
  onSettled:()=>{
   void Promise.all([
    client.invalidateQueries({queryKey:['role-home','housekeeping',hotelId]}),
    client.invalidateQueries({queryKey:['live-housekeeping',hotelId]}),
    client.invalidateQueries({queryKey:['live','housekeeping-manager-report',hotelId]}),
    client.invalidateQueries({queryKey:['live-housekeeping-status-totals',hotelId]}),
    client.invalidateQueries({queryKey:['live','housekeeping-assigned-alerts',hotelId]}),
    client.invalidateQueries({queryKey:['live','housekeeping-direct-task',hotelId]}),
    client.invalidateQueries({queryKey:['live','readiness-dashboard',hotelId]}),
    client.invalidateQueries({queryKey:['live','housekeeping-room-board',hotelId]}),
   ]).catch(()=>{});
  },
 });
 const data=dashboard.isSuccess&&online?dashboard.data:undefined;
 const pending=inspections.isSuccess&&online?inspections.data:undefined;
 const summary=data?.summary;
 const metrics=[
  {label:'Urgent rooms',value:summary?.urgentRooms,icon:AlertTriangle,tone:'urgent',search:{queue:'arrival_today' as const}},
  {label:'To do',value:summary?.todo,icon:ClipboardCheck,tone:'normal',search:{status:'todo' as const}},
  {label:'In progress',value:summary?.inProgress,icon:Clock3,tone:'progress',search:{status:'in_progress' as const}},
  {label:'Inspection due',value:pending?.meta.total,icon:ShieldCheck,tone:'inspect',search:{queue:'pending_inspection' as const}},
 ];
 const next=data?.tasks[0];
 const busy=dashboard.isFetching||inspections.isFetching;
 const refresh=()=>{void dashboard.refetch();void inspections.refetch();};
 const renderAction=(task:PriorityTask,hero=false)=>task.status==='todo'&&canWork
  ?<button type="button" className="btn-primary hk-dash-task-action" disabled={!online||start.isPending||dashboard.isFetching} onClick={()=>start.mutate(task)}>
    <Play size={16}/>{start.isPending&&start.variables?.id===task.id?'Starting…':task.type==='inspection'?'Start inspection':task.type==='stayover'?'Start service':'Start cleaning'}<ArrowRight size={16}/></button>
  :<Link to="/housekeeping" search={{task:task.id}} className={(hero&&canWork?'btn-primary':'btn-inline')+' hk-dash-task-action'}>{canWork&&task.status==='in_progress'?task.type==='checkout_clean'?'Continue cleaning':task.type==='stayover'?'Continue service':'Continue inspection':'View task'} <ArrowRight size={16}/></Link>;
 const taskDetails=(task:PriorityTask)=><>
  <div className="hk-dash-task-top"><div className="hk-dash-room-icon"><BedDouble size={22}/></div><div><small>{taskNames[task.type]}</small><h3>Room {task.roomNumber}</h3></div>
   <span className={'hk-dash-pill hk-dash-pill-'+task.priority}>{priorityLabels[task.priority]}</span></div>
  <div className="hk-dash-task-meta"><span><Clock3 size={15}/>{task.dueAt?'Due ':''}{dueLabel(task.dueAt,data?.hotelDate??'')}</span><span>{task.status==='todo'?'Not started':'In progress'}</span></div>
  {task.checklist&&task.checklist.length>0&&<div className="hk-dash-check-progress"><span>Checklist</span><strong>{task.checklist.filter(item=>item.checkedAt!==null).length}/{task.checklist.length}</strong><progress aria-label={'Room '+task.roomNumber+' saved checklist progress'} max={task.checklist.length} value={task.checklist.filter(item=>item.checkedAt!==null).length}/></div>}
 </>;
 return <div className="hk-home hk-dash">
  <header className="hk-dash-header"><div><span className="hk-dash-eyebrow"><CalendarDays size={15}/> {data?dateLabel(data.hotelDate):'Housekeeping operations'}</span>
   <h2 className="hk-dash-title">Housekeeping workspace</h2></div>
   <button type="button" className="btn-inline hk-dash-refresh" aria-label={busy?'Refreshing assignments':'Refresh assignments'} disabled={!online||busy} onClick={refresh}><RefreshCcw size={16}/><span>{busy?'Refreshing…':'Refresh'}</span></button>
  </header>
  {!online&&<div className="hk-network-alert" role="status"><WifiOff size={18}/> Offline. Reconnect to see current assignments. No changes are submitted.</div>}
  {dashboard.isError&&online&&<div className="hk-dash-feedback" role="alert"><AlertTriangle size={20}/><div><strong>Assignments unavailable</strong><p>Refresh to get current tasks, or open My tasks.</p></div><button type="button" className="btn-inline" onClick={refresh}>Retry</button></div>}
  <div className="hk-dash-layout">
   <div className="hk-dash-main">
    <section className="hk-dash-section" aria-labelledby="hk-next-title">
     <div className="hk-dash-section-head"><div><h2 id="hk-next-title">Your next room</h2></div><Link to="/housekeeping" search={{queue:'active',mine:true}} className="btn-inline">My active tasks <ArrowRight size={15}/></Link></div>
     {dashboard.isPending&&online&&<p role="status">Loading your assigned tasks…</p>}
     {start.isError&&<p role="alert" className="hk-network-alert">{start.error instanceof ApiError&&start.error.status===409?'This task changed. Refresh and try again.':start.error instanceof ApiError&&start.error.status===0?'Connection interrupted. Check the task before retrying.':start.error.message}</p>}
     {next&&<article className={'hk-dash-next hk-dash-task-'+next.priority}>{taskDetails(next)}
      {next.priority==='arrival_today'&&<p className="hk-dash-arrival"><AlertTriangle size={16}/> Prepare this room for today’s arrival.</p>}
      {renderAction(next,true)}{next.status==='todo'&&canWork&&<Link to="/housekeeping" search={{task:next.id}} className="hk-dash-details">View checklist <ArrowRight size={14}/></Link>}</article>}
     {data?.activeTotal===0&&<div className="hk-home-empty"><CheckCircle2 size={26}/><strong>No active cleaning assignments</strong><Link to="/housekeeping" search={{}} className="btn-inline">Open team tasks <ArrowRight size={15}/></Link></div>}
    </section>
    <div className="hk-dash-metrics" aria-label="Personal housekeeping summary">
     {metrics.map(({label,value,icon:Icon,tone,search})=><Link to="/housekeeping" search={{...search,mine:true}} key={label} data-empty={!value} className={'hk-dash-metric hk-dash-tone-'+tone}>
      <span className="hk-dash-metric-heading"><span className="hk-dash-metric-icon"><Icon size={19}/></span><ArrowRight size={15}/></span>
      <strong>{value??'—'}</strong><span>{label}</span></Link>)}
    </div>
    {summary?.completedToday!==undefined&&<p className="hk-dash-done-count"><CheckCircle2 size={17} aria-hidden="true"/> {summary.completedToday} cleaning {summary.completedToday===1?'task':'tasks'} completed today</p>}
    {!!data&&data.tasks.length>1&&<section className="hk-dash-section" aria-labelledby="hk-home-priorities">
     <div className="hk-dash-section-head"><div><h2 id="hk-home-priorities">Up next</h2><p>{data.activeTotal-1} other active assignments</p></div><Link to="/housekeeping" search={{queue:'active',mine:true}} className="btn-inline">View all <ArrowRight size={15}/></Link></div>
     <div className="hk-dash-task-list">{data.tasks.slice(1,5).map(task=><article className={'hk-dash-task hk-dash-task-'+task.priority} key={task.id}>{taskDetails(task)}{renderAction(task)}</article>)}</div>
     {data.activeTotal>5&&<Link to="/housekeeping" search={{queue:'active',mine:true}} className="hk-dash-more">View all {data.activeTotal} active tasks <ArrowRight size={15}/></Link>}
    </section>}
   </div>
   <aside className="hk-dash-side">
    <section className="hk-dash-section" aria-labelledby="hk-inspect-title">
     <div className="hk-dash-section-head"><div><h2 id="hk-inspect-title">Final inspections</h2><p>Finish readiness checks after cleaning.</p></div><span className="hk-dash-count">{pending?.meta.total??'—'}</span></div>
     {inspections.isPending&&online&&<p role="status">Loading inspections…</p>}
     {inspections.isError&&online&&<p role="alert">Inspection queue unavailable. <button type="button" className="btn-inline" onClick={()=>void inspections.refetch()}>Retry</button></p>}
     {pending?.meta.total===0&&<div className="hk-dash-clear"><CheckCircle2 size={20}/> No pending final inspections</div>}
     {pending?.data.map(task=><Link to="/housekeeping" search={{task:task.id}} className="hk-dash-inspection" key={task.id}><span className="hk-dash-room-icon"><ShieldCheck size={19}/></span><span><strong>Room {task.roomNumber}</strong><small>Cleaning completed · inspection due</small></span><ArrowRight size={16}/></Link>)}
     <Link to="/housekeeping" search={{queue:'pending_inspection',mine:true}} className="btn-inline">My pending inspections <ArrowRight size={15}/></Link>
    </section>
    <section className="hk-dash-section" aria-labelledby="hk-shortcuts-title"><h2 id="hk-shortcuts-title">Quick actions</h2>
     <div className="hk-dash-shortcuts">
      <Link to="/housekeeping" search={{}}><ClipboardCheck size={22}/><span><strong>My Tasks</strong><small>Open the team queue</small></span><ArrowRight size={16}/></Link>
      <Link to="/rooms"><BedDouble size={22}/><span><strong>Room status</strong><small>Readiness by floor</small></span><ArrowRight size={16}/></Link>
      <Link to="/maintenance"><Wrench size={22}/><span><strong>Maintenance</strong><small>Review room defects</small></span><ArrowRight size={16}/></Link>
      <Link to="/lost-found"><Package size={22}/><span><strong>Lost & found</strong><small>Register recovered belongings</small></span><ArrowRight size={16}/></Link>
      {canViewWorkspacePath('housekeeping','/occupancy-verification',membership?.permissions)&&<Link to="/occupancy-verification"><ShieldCheck size={22}/><span><strong>Occupancy checks</strong><small>Record assigned observations</small></span><ArrowRight size={16}/></Link>}
      <Link to="/messages"><MessageCircle size={22}/><span><strong>Messages</strong><small>Coordinate with staff</small></span><ArrowRight size={16}/></Link>
     </div>
    </section>
   </aside>
  </div>
  {!canWork&&<p className="role-note">Your current permissions allow viewing assignments only.</p>}
 </div>;
}
