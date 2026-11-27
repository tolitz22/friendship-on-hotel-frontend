import {Link} from '@tanstack/react-router';
import {BedDouble,DoorOpen,LogIn,LogOut,CalendarPlus,CalendarClock,ChevronRight,RefreshCw,AlertTriangle} from 'lucide-react';
import {useHotelAuth} from '../components/AuthProvider';
import {useLiveProperty} from '../api/liveCatalogQueries';
import {useLiveManifest} from '../api/liveFrontDesk';
import {useRoomRack} from '../api/roomRack';
import {hotelToday,dayHeading} from '../features/reservations/calendarDate';
import {canViewWorkspacePath} from '../features/workspaces/roleNavigation';
import {useNetworkStatus} from '../features/housekeeping/useNetworkStatus';
import './ReceptionHome.css';

export function ReceptionHome(){
 const {user,hotelId}=useHotelAuth();
 const permissions=user?.hotels.find(h=>h.id===hotelId)?.permissions;
 const canRead=canViewWorkspacePath('front_desk','/front-desk',permissions);
 const canRooms=canViewWorkspacePath('front_desk','/rooms',permissions);
 const canBookings=canViewWorkspacePath('front_desk','/reservations',permissions);
 const may=(permission:string)=>permissions?.includes(permission)===true;
 const online=useNetworkStatus();
 const property=useLiveProperty();
 const today=hotelToday(new Date(),property.data?.data.timeZone??'Asia/Manila');
 const arrivals=useLiveManifest(today,'arrivals',1,1,undefined,canRead);
 const departures=useLiveManifest(today,'departures',1,1,undefined,canRead);
 const overdue=useLiveManifest(today,'overdue',1,1,undefined,canRead);
 const rack=useRoomRack(1,1,1,canRooms,30000);
 const summary=online&&rack.isSuccess&&rack.data.data.hotelDate===today?rack.data.data.summary:undefined;
 const arrivalCount=online&&arrivals.isSuccess?arrivals.data.meta.queueTotal??arrivals.data.meta.total:undefined;
 const departureCount=online&&departures.isSuccess?departures.data.meta.queueTotal??departures.data.meta.total:undefined;
 const overdueCount=online&&overdue.isSuccess?overdue.data.meta.queueTotal??overdue.data.meta.total:undefined;
 const busy=property.isFetching||canRead&&(arrivals.isFetching||departures.isFetching||overdue.isFetching)||canRooms&&rack.isFetching;
 const unavailable=canRead&&(arrivals.isError||departures.isError||overdue.isError)||canRooms&&(rack.isError||rack.isSuccess&&!summary);
 const refresh=()=>{void property.refetch();if(canRead){void arrivals.refetch();void departures.refetch();void overdue.refetch();}if(canRooms)void rack.refetch();};
 return <div className="fd-home">
  <header className="fd-home-head"><div><h2>Front desk overview</h2><p>{dayHeading(today)}</p></div><button type="button" className="icon-btn" aria-label="Refresh overview" disabled={!online||busy} onClick={refresh}><RefreshCw size={19}/></button></header>
  {!online&&<p className="fd-home-notice" role="status">Offline. Reconnect to see current hotel data.</p>}
  {online&&unavailable&&<div className="fd-home-notice" role="status"><span>Some figures are unavailable.</span><button type="button" className="btn-inline" onClick={refresh}>Retry</button></div>}
  {!canRead&&!canRooms&&<p className="fd-home-notice">Your account does not have access to reservation or room information.</p>}
  <section className="fd-home-metrics" aria-label="Hotel overview">
   {canRooms&&<><Link to="/rooms" className="fd-home-metric"><span className="fd-home-icon fd-home-orange"><BedDouble size={22}/></span><span><small>Occupied in PMS</small><strong>{summary?.pmsOccupiedRooms??'—'}{summary&&<span className="fd-home-total"> / {summary.totalRooms}</span>}</strong></span></Link>
   <Link to="/rooms" className="fd-home-metric"><span className="fd-home-icon"><DoorOpen size={22}/></span><span><small>Vacant in PMS</small><strong>{summary?.pmsVacantRooms??'—'}</strong></span></Link></>}
   {canRead&&<><Link to="/front-desk" search={{queue:'arrivals'}} className="fd-home-metric"><span className="fd-home-icon fd-home-green"><LogIn size={22}/></span><span><small>Arrivals today</small><strong>{arrivalCount??'—'}</strong></span></Link>
   <Link to="/front-desk" search={{queue:'departures'}} className="fd-home-metric"><span className="fd-home-icon fd-home-red"><LogOut size={22}/></span><span><small>Departures today</small><strong>{departureCount??'—'}</strong></span></Link></>}
  </section>
  {canRooms&&<p className="fd-home-caption">PMS vacancy is not guaranteed booking availability.</p>}
  {canRead&&<section className="fd-home-bookings" aria-labelledby="fd-home-today"><div className="fd-home-section-head"><h3 id="fd-home-today">Today's bookings</h3><Link to="/front-desk" search={{}} className="fd-home-view">View all <ChevronRight size={16}/></Link></div>
   <Link to="/front-desk" search={{queue:'arrivals'}} className="fd-home-row"><span className="fd-home-icon fd-home-green"><LogIn size={18}/></span><strong>Arrivals</strong><span>{arrivalCount??'—'}</span><ChevronRight size={18}/></Link>
   <Link to="/front-desk" search={{queue:'departures'}} className="fd-home-row"><span className="fd-home-icon fd-home-red"><LogOut size={18}/></span><strong>Departures</strong><span>{departureCount??'—'}</span><ChevronRight size={18}/></Link>
   {!!overdueCount&&<Link to="/front-desk" search={{queue:'overdue'}} className="fd-home-row fd-home-overdue"><span className="fd-home-icon fd-home-orange"><AlertTriangle size={18}/></span><strong>Overdue checkouts</strong><span>{overdueCount}</span><ChevronRight size={18}/></Link>}
  </section>}
  {(canBookings&&may('booking.create')||canRead&&(may('booking.check_in')||may('booking.check_out')))&&<section aria-labelledby="fd-home-actions"><h3 id="fd-home-actions" className="fd-home-action-title">Quick actions</h3><div className="fd-home-actions">
   {canBookings&&may('booking.create')&&<Link to="/reservations" search={{mode:'new',checkIn:today}}><CalendarPlus size={24}/><span>New booking</span></Link>}
   {canRead&&may('booking.check_in')&&<Link to="/front-desk" search={{queue:'arrivals'}}><LogIn size={24}/><span>Check in</span></Link>}
   {canRead&&may('booking.check_out')&&<><Link to="/front-desk" search={{queue:'departures'}}><LogOut size={24}/><span>Check out</span></Link><Link to="/front-desk" search={{queue:'in_house'}}><CalendarClock size={24}/><span>Extend stay</span></Link></>}
  </div></section>}
 </div>;
}
