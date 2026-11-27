import {Link,useNavigate} from '@tanstack/react-router';
import {useMutation,useQuery,useQueryClient} from '@tanstack/react-query';
import {AlertTriangle,ArrowRight,BedDouble,CheckCircle2,ClipboardCheck,Clock3,RefreshCcw,ShieldCheck,ChevronRight,Play,WifiOff} from 'lucide-react';
import {useHotelAuth} from '../components/AuthProvider';
import {dueLabel,taskNames} from '../features/housekeeping/taskDisplay';
import '../features/housekeeping/shiftWorkspace.css';
import {getPersonalHousekeepingDashboard,listHousekeepingTasks,parseLiveHousekeeping,patchLiveHousekeeping,type LiveHousekeepingTask,type PersonalHousekeepingDashboard} from '../api/liveHousekeeping';
import {ApiError} from '../api/http';
import {readSession} from '../api/session';
import {useNetworkStatus} from '../features/housekeeping/useNetworkStatus';

const priorityLabels={arrival_today:'Arrival today',overdue:'Overdue',in_progress:'In progress',normal:'Scheduled'};
type PriorityTask=PersonalHousekeepingDashboard['tasks'][number];
const dateLabel=(date:string)=>new Date(date+'T12:00:00Z').toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric',timeZone:'UTC'});
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
  {label:'To do',value:summary?.todo,icon:ClipboardCheck,tone:'normal',search:{status:'todo' as const}},
  {label:'In progress',value:summary?.inProgress,icon:Clock3,tone:'progress',search:{status:'in_progress' as const}},
  {label:'Inspection due',value:pending?.meta.total,icon:ShieldCheck,tone:'inspect',search:{queue:'pending_inspection' as const}},
 ];
 const next=data?.tasks[0];
 const busy=dashboard.isFetching||inspections.isFetching;
 const refresh=()=>{void dashboard.refetch();void inspections.refetch();};
 const renderAction=(task:PriorityTask)=>task.status==='todo'&&canWork
  ?<button type="button" className="btn-primary hk-dash-task-action" disabled={!online||start.isPending} onClick={()=>start.mutate(task)}>
    <Play size={16}/>{start.isPending&&start.variables?.id===task.id?'Starting…':task.type==='inspection'?'Start inspection':task.type==='stayover'?'Start service':'Start cleaning'}<ArrowRight size={16}/></button>
  :<Link to="/housekeeping" search={{task:task.id}} className={(canWork?'btn-primary':'btn-inline')+' hk-dash-task-action'}>{canWork&&task.status==='in_progress'?task.type==='checkout_clean'?'Continue cleaning':task.type==='stayover'?'Continue service':'Continue inspection':'View task'} <ArrowRight size={16}/></Link>;
 const upcoming=data?.tasks.slice(1,3)??[];
 const checked=next?.checklist?.filter(item=>item.checkedAt!==null).length??0;
 const inspection= pending?.data[0];
 return <div className="hk-home hk-dash hk-minimal-home">
  <header className="hk-minimal-header"><div><h2 className="hk-dash-title">Housekeeping</h2><p>{data?dateLabel(data.hotelDate):'Your assignments'}</p></div>
   <button type="button" className="icon-btn hk-minimal-refresh" aria-label="Refresh assignments" disabled={!online||busy} onClick={refresh}><RefreshCcw size={18}/></button>
  </header>
  {!online&&<div className="hk-network-alert" role="status"><WifiOff size={18}/> Offline. Reconnect to view current assignments.</div>}
  {dashboard.isError&&online&&<div className="hk-dash-feedback" role="alert"><AlertTriangle size={20}/><div><strong>Assignments unavailable</strong><p>Try refreshing.</p></div><button type="button" className="btn-inline" onClick={refresh}>Retry</button></div>}
  <div className="hk-minimal-layout">
   <section className="hk-minimal-hero" aria-labelledby="hk-next-title">
    <h3 id="hk-next-title"><BedDouble size={19}/> Your next room</h3>
    {dashboard.isPending&&online&&<p role="status">Loading assignments…</p>}
    {start.isError&&<p role="alert" className="hk-network-alert">{start.error instanceof ApiError&&start.error.status===409?'This task changed. Refresh and try again.':start.error instanceof ApiError&&start.error.status===0?'Connection interrupted. Check the task before retrying.':start.error.message}</p>}
    {next&&<>
     <div className="hk-minimal-room-line"><div><h3>Room {next.roomNumber}</h3><p>{taskNames[next.type]}</p></div>
      {next.priority!=='normal'&&<span className={'hk-dash-pill hk-dash-pill-'+next.priority}>{priorityLabels[next.priority]}</span>}</div>
     {next.dueAt&&<p className="hk-minimal-due"><Clock3 size={14}/> Due {dueLabel(next.dueAt,data?.hotelDate??'')}</p>}
     {!!next.checklist?.length&&<div className="hk-minimal-progress"><strong>{checked}/{next.checklist.length} checked</strong><progress aria-label={'Room '+next.roomNumber+' saved checklist progress'} max={next.checklist.length} value={checked}/></div>}
     {renderAction(next)}
    </>}
    {data?.activeTotal===0&&<>{inspection?<><div className="hk-minimal-room-line"><div><h3>Room {inspection.roomNumber}</h3><p>Final inspection</p></div><span className="hk-dash-pill hk-dash-pill-normal">Inspection due</span></div><Link to="/housekeeping" search={{task:inspection.id}} className="btn-primary hk-dash-task-action">{canWork?'Open inspection':'View task'} <ArrowRight size={16}/></Link></>:<div className="hk-phone-empty"><CheckCircle2 size={24}/><div><strong>No active cleaning assignments</strong><p>Check the team queue for more work.</p></div><Link to="/housekeeping" search={{}} className="btn-inline hk-dash-task-action">Team tasks <ArrowRight size={16}/></Link></div>}</>}
   </section>
   <section className="hk-minimal-summary" aria-label="My assignments">
    {metrics.map(({label,value,icon:Icon,tone,search})=><Link to="/housekeeping" search={{...search,mine:true}} key={label} data-empty={value===0||value===undefined} className={'hk-minimal-metric hk-dash-tone-'+tone}><span className="hk-dash-metric-icon"><Icon size={18}/></span><span className="hk-minimal-metric-label">{label}</span><strong>{value??'—'}</strong></Link>)}
   </section>
   {inspections.isError&&online&&<p className="hk-minimal-inspection-error" role="alert">Inspection count unavailable. <button type="button" className="btn-inline" onClick={()=>void inspections.refetch()}>Retry</button></p>}
   {upcoming.length>0&&<section className="hk-minimal-upcoming" aria-labelledby="hk-home-priorities">
    <div className="hk-minimal-section-head"><h3 id="hk-home-priorities">Up next</h3><Link to="/housekeeping" search={{queue:'active',mine:true}} className="hk-phone-text-link">View all <ChevronRight size={15}/></Link></div>
    <div className="hk-minimal-list">{upcoming.map(task=><Link key={task.id} to="/housekeeping" search={{task:task.id}} className="hk-minimal-row"><span className="hk-dash-room-icon"><BedDouble size={20}/></span><span><strong>Room {task.roomNumber}</strong><small>{taskNames[task.type]}{task.priority==='arrival_today'?' · Arrival today':task.priority==='overdue'?' · Overdue':''}</small></span><ChevronRight size={19}/></Link>)}</div>
   </section>}
  </div>
  {!canWork&&<p className="role-note">Your current permissions allow viewing assignments only.</p>}
 </div>;
}
