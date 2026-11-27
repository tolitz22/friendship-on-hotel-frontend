import {Link} from '@tanstack/react-router';
import {ArrowRight,BedDouble,ClipboardCheck,ShieldCheck,Wrench} from 'lucide-react';
import type {LucideIcon} from 'lucide-react';
import {useHotelAuth} from '../components/AuthProvider';
import {Heading} from '../components/ui';
import {selectedRole} from '../features/workspaces/roleNavigation';
import {ReceptionHome} from './ReceptionHome';
import {HousekeepingDashboard} from './HousekeepingDashboard';

function Entry({to,title,description,icon:Icon}:{
 to:'/front-desk'|'/reservations'|'/room-calendar'|'/guests'|'/billing'|'/housekeeping'|'/rooms'|'/maintenance';
 title:string;description:string;icon:LucideIcon;
}){
 return <Link to={to} className="role-task"><Icon size={23}/><strong>{title}</strong>
  <span>{description}</span><ArrowRight size={17}/></Link>;
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
 if(role==='front_desk')return <ReceptionHome key={hotelId+':'+user?.id}/>;
 if(role==='housekeeping')return <HousekeepingDashboard key={hotelId+':'+user?.id}/>;
 if(role==='maintenance')return <MaintenanceHome/>;
 return <div className="role-note">Choose an authorized hotel to view your workspace.</div>;
}
