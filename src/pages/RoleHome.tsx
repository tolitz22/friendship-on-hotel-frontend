import {Link} from '@tanstack/react-router';
import {ArrowRight,BedDouble,CalendarDays,ClipboardCheck,Hotel,Search,ShieldCheck,UserRound,Wrench} from 'lucide-react';
import type {LucideIcon} from 'lucide-react';
import {useHotelAuth} from '../components/AuthProvider';
import {Heading} from '../components/ui';
import {selectedRole} from '../features/workspaces/roleNavigation';
import {hotelToday} from '../features/reservations/calendarDate';
import {useLiveManifest} from '../api/liveFrontDesk';
import {useQuery} from '@tanstack/react-query';
import {listHousekeepingTasks,parseLiveHousekeeping} from '../api/liveHousekeeping';

function Entry({to,title,description,icon:Icon}:{
 to:'/front-desk'|'/reservations'|'/room-calendar'|'/guests'|'/billing'|'/housekeeping'|'/rooms'|'/maintenance';
 title:string;description:string;icon:LucideIcon;
}){
 return <Link to={to} className="role-task"><Icon size={23}/><strong>{title}</strong>
  <span>{description}</span><ArrowRight size={17}/></Link>;
}

function ReceptionHome(){
 const today=hotelToday();
 const arrivals=useLiveManifest(today,'arrivals',1);
 const departures=useLiveManifest(today,'departures',1);
 return <>
  <Heading title="Reception workspace" description="Find today's arrivals and departures, then open the next task. Reservation changes require manager authorization."/>
  <div className="role-summary" aria-label="Today's reservation queues">
   <div><small>Expected arrivals today</small><strong>{arrivals.data?.meta.total??'—'}</strong>
    <span>{arrivals.isError?'Unable to load arrivals':'Confirmed arrivals'}</span></div>
   <div><small>Departures due today</small><strong>{departures.data?.meta.total??'—'}</strong>
    <span>{departures.isError?'Unable to load departures':'Scheduled departures'}</span></div>
  </div>
  <section className="role-tasks" aria-label="Reception tasks">
   <Entry to="/front-desk" title="Today's front desk" description="Review arrivals and departures" icon={Hotel}/>
   <Entry to="/reservations" title="Find a reservation" description="Review booking status and stay details" icon={CalendarDays}/>
   <Entry to="/room-calendar" title="Room rack" description="See assigned rooms across dates" icon={BedDouble}/>
   <Entry to="/guests" title="Guest directory" description="Find existing guest profiles" icon={UserRound}/>
   <Entry to="/billing" title="View folios" description="Review recorded payment evidence" icon={Search}/>
  </section>
  <p className="role-note"><ShieldCheck size={17}/> Reception access is for viewing and preparing work. Creating reservations, assigning rooms, and confirming check-in or checkout require the hotel's administrator permissions.</p>
 </>;
}
function HousekeepingHome(){
 const {hotelId,user}=useHotelAuth();
 const tasks=useQuery({
  queryKey:['role-home','housekeeping',hotelId,user?.id],
  enabled:!!hotelId&&!!user?.id,
  queryFn:async()=>{
   const [todo,inProgress,hotelQueue]=await Promise.all([
    listHousekeepingTasks(1,1,{status:'todo',mine:1}),
    listHousekeepingTasks(1,1,{status:'in_progress',mine:1}),
    listHousekeepingTasks(1,1,{status:'todo'}),
   ]);
   return {todo:parseLiveHousekeeping(todo,hotelId!).meta.total,
    inProgress:parseLiveHousekeeping(inProgress,hotelId!).meta.total,
    hotelQueue:parseLiveHousekeeping(hotelQueue,hotelId!).meta.total};
  },
  retry:false,refetchInterval:30000,refetchIntervalInBackground:false,
 });
 const canWork=user?.hotels.find(h=>h.id===hotelId)?.permissions?.includes('housekeeping.assigned')!==false;
 return <>
  <Heading title="Housekeeping workspace" description="See your cleaning assignments and open the next room task."/>
  <div className="role-summary" aria-label="Housekeeping task summary">
   <div><small>My tasks to do</small><strong>{tasks.isError?'—':tasks.data?.todo??'—'}</strong>
    <span>Assigned to you · not started</span></div>
   <div><small>My tasks in progress</small><strong>{tasks.isError?'—':tasks.data?.inProgress??'—'}</strong>
    <span>Assigned to you · cleaning underway</span></div>
   <div><small>Hotel cleaning queue</small><strong>{tasks.isError?'—':tasks.data?.hotelQueue??'—'}</strong>
    <span>All hotel tasks not started</span></div>
  </div>
  {tasks.isError&&<p className="role-note" role="alert">Housekeeping task totals could not be loaded. <button type="button" className="btn-inline" onClick={()=>void tasks.refetch()}>Retry totals</button></p>}
  <section className="role-tasks" aria-label="Housekeeping tasks">
   <Entry to="/housekeeping" title="My cleaning tasks" description={canWork?"Open your assignments, clean and complete final inspection":"View your assignments"} icon={ClipboardCheck}/>
   <Entry to="/rooms" title="Room status" description="Review recorded room readiness and blockers" icon={BedDouble}/>
   <Entry to="/maintenance" title="Maintenance work orders" description="Check issues affecting room turnover" icon={Wrench}/>
  </section>
  <p className="role-note"><ShieldCheck size={17}/> {canWork?"Complete cleaning and final inspection in the same assigned task. Rooms are ready only when all operational checks pass.":"Your current permissions allow viewing tasks only. Ask your manager about task updates."}</p>
 </>;
}
function MaintenanceHome(){
 return <>
  <Heading title="Maintenance workspace" description="Review property work orders and room issues before they affect guests."/>
  <section className="role-tasks" aria-label="Maintenance tasks">
   <Entry to="/maintenance" title="Work orders" description="Review assigned maintenance issues and update eligible tasks" icon={Wrench}/>
   <Entry to="/rooms" title="Rooms & readiness" description="Review room inventory and reported blockers" icon={BedDouble}/>
   <Entry to="/housekeeping" title="Cleaning coordination" description="See tasks that may affect repairs" icon={ClipboardCheck}/>
  </section>
  <p className="role-note"><ShieldCheck size={17}/> Your hotel membership determines which tasks you may update. Only authorized staff can make changes to these tasks.</p>
 </>;
}
/** A personalized landing screen, not an authorization boundary. */
export function RoleHome(){
 const {user,hotelId}=useHotelAuth();
 const role=selectedRole(user?.hotels,hotelId);
 if(role==='front_desk')return <ReceptionHome/>;
 if(role==='housekeeping')return <HousekeepingHome/>;
 if(role==='maintenance')return <MaintenanceHome/>;
 return <div className="role-note">Choose an authorized hotel to view your workspace.</div>;
}
