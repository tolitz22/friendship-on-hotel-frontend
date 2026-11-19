import {Link} from '@tanstack/react-router';
import {CalendarDays,ClipboardList,History,Layers3} from 'lucide-react';
import {useGroupBooking,deriveGroupStatus,groupStatusLabel} from '../api/groupReservations';
import {readableDate} from '../lib/format';

type Tab='rooms'|'billing'|'activity';

/** Read-only context, never an authorization shortcut or an invoice. */
export function GroupContextBar({groupId,originHotel,selectedTab='rooms'}:{
 groupId:string;originHotel?:string;selectedTab?:Tab;
}){
 const group=useGroupBooking(groupId);
 const data=group.data;
 const mismatch=!!originHotel&&!!data&&data.hotelId!==originHotel;
 if(mismatch)return <p className="gb-context-banner" role="alert">Group context belongs to another hotel. Switch to its original property before continuing.</p>;
 const status=data?groupStatusLabel(deriveGroupStatus(data.rooms.map(row=>row.status))):null;
 const params={group:groupId,hotel:originHotel};
 return <nav className="gb-context-banner" aria-label="Group workflow navigation">
  <div className="gb-context-banner-heading">
   <strong>{data?.name??'Group booking'}</strong>
   <span>{data?.reference??(group.isPending?'Loading group…':'Group details unavailable')}</span>
   {data&&<small>{data.checkIn?readableDate(data.checkIn):'Arrival unspecified'} – {data.checkOut?readableDate(data.checkOut):'Departure unspecified'} · {data.roomCount} rooms · {status}</small>}
   {group.isError&&<small role="status">Group details could not be loaded; direct links remain available.</small>}
  </div>
  <div className="gb-context-banner-links">
   <Link to="/group-reservations" search={{...params,tab:selectedTab}}><ClipboardList size={15} aria-hidden="true"/> Return to group</Link>
   <Link to="/group-reservations" search={{...params,tab:'rooms' as const}}><Layers3 size={15} aria-hidden="true"/> Rooms</Link>
   {data?.checkIn&&<Link to="/room-calendar" search={{date:data.checkIn,end:data.checkOut??undefined,...params}}><CalendarDays size={15} aria-hidden="true"/> Calendar</Link>}
   <Link to="/group-reservations" search={{...params,tab:'billing' as const}}>Billing</Link>
   <Link to="/group-reservations" search={{...params,tab:'activity' as const}}><History size={15} aria-hidden="true"/> Activity</Link>
  </div>
 </nav>;
}
