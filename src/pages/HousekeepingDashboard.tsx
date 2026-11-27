import {Link} from '@tanstack/react-router';
import {useMutation,useQuery,useQueryClient} from '@tanstack/react-query';
import {AlertTriangle,ArrowRight,BedDouble,CheckCircle2,ClipboardCheck,Clock3,RefreshCcw,ShieldCheck,Wrench} from 'lucide-react';
import {useHotelAuth} from '../components/AuthProvider';
import {Heading} from '../components/ui';
import {getPersonalHousekeepingDashboard,patchLiveHousekeeping,type LiveHousekeepingTask} from '../api/liveHousekeeping';
import {ApiError} from '../api/http';

const taskLabels={checkout_clean:'Checkout cleaning',stayover:'Stayover service',inspection:'Room inspection'};
const priorityLabels={arrival_today:'Arrival today',overdue:'Overdue task',in_progress:'In progress',normal:'Scheduled task'};

export function HousekeepingDashboard(){
 const {hotelId,user}=useHotelAuth();
 const client=useQueryClient();
 const canWork=user?.hotels.find(h=>h.id===hotelId)?.permissions?.includes('housekeeping.assigned')!==false;
 const dashboard=useQuery({
  queryKey:['role-home','housekeeping',hotelId,user?.id],
  enabled:!!hotelId&&!!user?.id,
  queryFn:()=>getPersonalHousekeepingDashboard(hotelId!,user!.id),
  retry:false,refetchInterval:30000,refetchIntervalInBackground:false,
 });
 const start=useMutation({
  mutationFn:(task:LiveHousekeepingTask)=>{
   if(!hotelId||!canWork||task.assignedUserId!==user?.id||task.status!=='todo')
    throw new Error('This task cannot be started by your account.');
   return patchLiveHousekeeping(hotelId,task,{expectedRevision:task.revision,status:'in_progress'});
  },
  retry:false,
  onSettled:()=>{
   void Promise.all([
    client.invalidateQueries({queryKey:['role-home','housekeeping',hotelId]}),
    client.invalidateQueries({queryKey:['live-housekeeping',hotelId]}),
    client.invalidateQueries({queryKey:['live-housekeeping-status-totals',hotelId]}),
    client.invalidateQueries({queryKey:['live','housekeeping-assigned-alerts',hotelId]}),
    client.invalidateQueries({queryKey:['live','housekeeping-direct-task',hotelId]}),
    client.invalidateQueries({queryKey:['live','readiness-dashboard',hotelId]}),
    client.invalidateQueries({queryKey:['live','housekeeping-room-board',hotelId]}),
   ]).catch(()=>{});
  },
 });
 const data=dashboard.data;
 const summary=data?.summary;
 const metrics=[
  {label:'Urgent rooms',value:summary?.urgentRooms,description:'Assigned rooms with arrivals today',icon:AlertTriangle,tone:'urgent'},
  {label:'To do',value:summary?.todo,description:'Assigned, not started',icon:ClipboardCheck,tone:'normal'},
  {label:'In progress',value:summary?.inProgress,description:'Cleaning underway',icon:Clock3,tone:'progress'},
  {label:'Completed today',value:summary?.completedToday,description:'Cleaning tasks, not room approvals',icon:CheckCircle2,tone:'done'},
 ];
 return <div className="hk-home">
  <div className="hk-home-heading">
   <div><Heading title="Housekeeping workspace" description="Your next room, cleaning progress and today's priorities."/>
    {data&&<small>Hotel date: {data.hotelDate}</small>}</div>
   <button type="button" className="btn-inline" disabled={dashboard.isFetching} onClick={()=>void dashboard.refetch()}>
    <RefreshCcw size={16}/>{dashboard.isFetching?'Refreshing…':'Refresh'}</button>
  </div>
  <div className="hk-home-metrics" aria-label="Personal housekeeping summary">
   {metrics.map(({label,value,description,icon:Icon,tone})=><div key={label} className={'hk-home-metric hk-home-'+tone}>
    <Icon size={20} aria-hidden="true"/><span>{label}</span><strong>{dashboard.isError?'—':value??'—'}</strong><small>{description}</small>
   </div>)}
  </div>
  <section className="hk-home-queue" aria-labelledby="hk-home-priorities">
   <div className="hk-home-heading"><div><h2 id="hk-home-priorities">Your priority tasks</h2>
    <p>Today's arrivals first, then overdue work and tasks already in progress.</p></div>
    <Link to="/housekeeping" className="btn-inline">All tasks <ArrowRight size={16}/></Link>
   </div>
   {dashboard.isPending&&<p role="status">Loading your assigned tasks…</p>}
   {dashboard.isError&&<p role="alert">Unable to load your current assignments. Refresh or open My tasks. Previously loaded totals are not shown as current.</p>}
   {start.isError&&<p role="alert">{start.error instanceof ApiError&&start.error.status===409?'This task changed. Refresh and try again.':start.error.message}</p>}
   {start.isSuccess&&<p role="status">Cleaning started. Open the task to continue.</p>}
   {!dashboard.isError&&data&&<>
    {data.activeTotal===0&&<div className="hk-home-empty"><CheckCircle2 size={24}/><strong>No active assignments</strong><p>New assignments will appear here. Check My tasks for completed cleaning or pending final inspections.</p></div>}
    <div className="hk-home-task-list">
     {data.tasks.map(task=><article className={'hk-home-task hk-home-task-'+task.priority} key={task.id}>
      <div className="hk-home-task-title"><div><small>{taskLabels[task.type]}</small><h3>Room {task.roomNumber}</h3></div>
       <span className="hk-home-priority">{priorityLabels[task.priority]}</span></div>
      <div className="hk-home-task-meta"><span>{task.status==='todo'?'Not started':'Cleaning underway'}</span>
       <span>{task.dueAt?'Due '+task.dueAt.replace('T',' ').slice(0,16):'No due time set'}</span></div>
      {task.priority==='arrival_today'&&<p className="hk-home-arrival">Confirmed arrival today · exact arrival time not recorded here.</p>}
      {task.status==='todo'&&canWork?<button type="button" className="btn-primary" disabled={start.isPending||dashboard.isFetching}
       onClick={()=>start.mutate(task)}>{start.isPending&&start.variables?.id===task.id?'Starting…':'Start cleaning'} <ArrowRight size={16}/></button>:
       <Link to="/housekeeping" search={{task:task.id}} className="btn-inline">{canWork&&task.status==='in_progress'?'Continue cleaning':'View task'} <ArrowRight size={16}/></Link>}
     </article>)}
    </div>
    {data.activeTotal>data.tasks.length&&<p>Showing the first {data.tasks.length} of {data.activeTotal} active assignments. <Link to="/housekeeping">View all tasks</Link>.</p>}
   </>}
  </section>
  <div className="hk-home-shortcuts">
   <Link to="/rooms" className="role-task"><BedDouble size={23}/><strong>Room status</strong><span>Review room readiness and blockers</span><ArrowRight size={17}/></Link>
   <Link to="/maintenance" className="role-task"><Wrench size={23}/><strong>Maintenance</strong><span>Review room issues</span><ArrowRight size={17}/></Link>
  </div>
  <p className="role-note"><ShieldCheck size={17}/>{canWork?'Complete cleaning and final inspection in the assigned task. All readiness checks must pass before a room is ready.':'Your current permissions allow viewing assignments only.'}</p>
 </div>;
}
