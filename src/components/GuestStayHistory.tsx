import {useEffect,useState} from 'react';
import {Link} from '@tanstack/react-router';
import {useGuestStayHistory} from '../api/guestStayHistory';
import {QueryFeedback} from './QueryFeedback';
import {dateLabel,statusLabel} from '../lib/format';

export function GuestStayHistory({guestId,name,onClose}:{guestId:string;name:string;onClose:()=>void}){
 const [page,setPage]=useState(1);
 useEffect(()=>setPage(1),[guestId]);
 const query=useGuestStayHistory(guestId,page);
 const rows=query.data?.data??[];
 return <section className="guest-history-panel" aria-label={'Stay history for '+name}>
  <div className="guest-history-header">
   <div><h3>{name}</h3><p>Reservations in this hotel · newest stays first</p></div>
   <button type="button" className="btn-inline" onClick={onClose}>Close history</button>
  </div>
  <QueryFeedback loading={query.isPending} error={query.error}
   onRetry={()=>void query.refetch()} empty={query.isSuccess&&rows.length===0}
   emptyMessage="No reservation history for this guest at this hotel."/>
  {rows.length>0&&<div className="guest-history-rows">
   {rows.map(stay=><div key={stay.id} className="guest-history-row">
    <div><strong>{stay.reference}</strong><small>{dateLabel(stay.checkIn)} – {dateLabel(stay.checkOut)}</small></div>
    <div><span>{statusLabel(stay.status??'unknown')}</span>
     <small>{stay.roomTypeName??'Room category unavailable'} · {stay.roomNumber?'Room '+stay.roomNumber:'Room unassigned'}</small>
    </div>
    <Link to="/reservations" search={{booking:stay.id}}>Open reservation</Link>
   </div>)}
  </div>}
  {query.data&&<div className="desk-tools">
   <span className="table-count">{query.data.meta.total} bookings · Page {query.data.meta.page} / {Math.max(1,query.data.meta.totalPages)}</span>
   <div className="desk-date-nav">
    <button type="button" className="btn-inline" disabled={page<=1}
     onClick={()=>setPage(v=>v-1)}>Previous</button>
    <button type="button" className="btn-inline" disabled={page>=query.data.meta.totalPages}
     onClick={()=>setPage(v=>v+1)}>Next</button>
   </div>
  </div>}
  <p className="desk-muted">This is a reservation history, not a verified spending history or proof of physical occupancy.</p>
 </section>;
}
