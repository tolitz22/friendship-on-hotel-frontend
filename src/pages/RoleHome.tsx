import {Link} from '@tanstack/react-router';
import {ArrowRight,BedDouble,CalendarDays,ClipboardCheck,Hotel,Search,ShieldCheck,UserRound,Wrench} from 'lucide-react';
import {useHotelAuth} from '../components/AuthProvider';
import {Heading} from '../components/ui';
import {selectedRole} from '../features/workspaces/roleNavigation';
import {hotelToday} from '../features/reservations/calendarDate';
import {useLiveManifest} from '../api/liveFrontDesk';
import {useQuery} from '@tanstack/react-query';
import {listHousekeepingTasks,parseLiveHousekeeping} from '../api/liveHousekeeping';

function Entry({to,title,description,icon:Icon}:{
 to:'/front-desk'|'/reservations'|'/room-calendar'|'/guests'|'/billing'|'/housekeeping'|'/rooms'|'/maintenance';
 title:string;description:string;icon:typeof Hotel;
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
  queryKey:['role-home','housekeeping',hotelId],
  enabled:!!hotelId,
  queryFn:()=>listHousekeepingTasks(1,100,{status:'todo'})
   .then(response=>parseLiveHousekeeping(response,hotelId!)),
  retry:false,refetchInterval:60000,refetchIntervalInBackground:false,
 });
 const mine=tasks.data?.data.filter(item=>item.assignedUserId===user?.id)??[];
 return <>
  <Heading title="Housekeeping workspace" description="Focus on cleaning assignments and the next rooms requiring attention."/>
  <div className="role-summary" aria-label="Housekeeping task summary">
   <div><small>My assigned to-do tasks</small><strong>{tasks.isSuccess?mine.length:'—'}</strong>
    <span>Within the latest {tasks.data?.data.length??0} returned task records</span></div>
   <div><small>Task queue</small><strong>{tasks.data?.meta.total??'—'}</strong>
    <span>Hotel-wide to-do tasks · not a room-readiness certificate</span></div>
  </div>
  <section className="role-tasks" aria-label="Housekeeping tasks">
   <Entry to="/housekeeping" title="My cleaning tasks" description="Review assignments and update your own tasks" icon={ClipboardCheck}/>
   <Entry to="/rooms" title="Room readiness" description="Review recorded room inspections and blockers" icon={BedDouble}/>
   <Entry to="/maintenance" title="Maintenance work orders" description="Check issues affecting room turnover" icon={Wrench}/>
  </section>
  {tasks.isError&&<p className="role-note" role="alert">Housekeeping task totals could not be loaded. Open the task queue to retry.</p>}
  <p className="role-note"><ShieldCheck size={17}/> Completing a cleaning task does not independently certify that a room is ready for guests. Administrators handle approval and inspections.</p>
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
  <p className="role-note"><ShieldCheck size={17}/> Your hotel membership determines which tasks you may update. The backend validates ownership and permissions before saving.</p>
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
