import {useRef,useState} from 'react';
import {Link} from '@tanstack/react-router';
import {useQuery} from '@tanstack/react-query';
import {AlertTriangle,ArrowRight,BedDouble,Bell,CalendarPlus,LogOut,X} from 'lucide-react';
import {z} from 'zod';
import {getJson} from '../api/http';
import {hotelPath} from '../api/session';
import {dateLabel} from '../lib/format';
import {QueryFeedback} from './QueryFeedback';
import {PushDeviceControl} from './PushDeviceControl';

const notificationKinds={
 checkout_overdue:{label:'Checkout overdue',icon:AlertTriangle,action:'Review checkout'},
 checkout_due:{label:'Checkout due today',icon:LogOut,action:'Review checkout'},
 room_assignment:{label:'Arrival needs a room',icon:BedDouble,action:'Assign room'},
 new_booking:{label:'New booking',icon:CalendarPlus,action:'Open booking'},
 guest_check_in:{label:'Guest checked in',icon:BedDouble,action:'Open booking'},
 guest_check_out:{label:'Guest checked out',icon:LogOut,action:'Open booking'},
 booking_cancelled:{label:'Booking cancelled',icon:X,action:'Open booking'},
 booking_no_show:{label:'Booking marked no-show',icon:AlertTriangle,action:'Open booking'},
 stay_extended:{label:'Stay extended',icon:CalendarPlus,action:'Open booking'},
} as const;
const responseSchema=z.object({data:z.object({
 hotelId:z.string(),
 notifications:z.array(z.object({
  id:z.string(),kind:z.enum(Object.keys(notificationKinds) as (keyof typeof notificationKinds)[]),bookingId:z.string().regex(/^[1-9]\d*$/),
  reference:z.string(),date:z.iso.date(),
 })),
 hasMore:z.boolean(),
})});

export function StaffNotifications({hotelId,userId,canPush=false}:{hotelId:string;userId:string;canPush?:boolean}){
 const storageKey='pms.notification-read:v1:'+userId+':'+hotelId;
 const [read,setRead]=useState<string[]>(()=>{
  try{
   return z.array(z.string()).parse(JSON.parse(localStorage.getItem(storageKey)??'[]'));
  }catch{return [];}
 });
 const dialog=useRef<HTMLDialogElement>(null);
 const bell=useRef<HTMLButtonElement>(null);
 const feed=useQuery({
  queryKey:['live','front-desk','manifest',hotelId,'notifications',userId,canPush],
  queryFn:async()=>{
   const {data}=responseSchema.parse(await getJson<unknown>(hotelPath('/front-desk/notifications'),canPush?{expanded:1}:{}));
   if(data.hotelId!==hotelId)throw new Error('Notifications belong to another hotel.');
   return data;
  },
  retry:false,
  refetchInterval:30_000,
 });
 const items=feed.data?.notifications??[];
 const unread=items.filter(item=>!read.includes(item.id)).length;
 function markRead(ids:string[]){
  const updated=[...new Set([...ids,...read])].slice(0,500);
  setRead(updated);
  try{localStorage.setItem(storageKey,JSON.stringify(updated));}catch{/* Remain usable in memory. */}
 }
 return <>
  <button ref={bell} type="button" className="icon-btn topbar-action-notifications"
   aria-label={unread?`Notifications, ${unread} unread`:'Notifications'} aria-haspopup="dialog"
   onClick={()=>{dialog.current?.showModal();void feed.refetch();}}>
   <Bell size={19}/>{unread>0&&<span className="staff-notifications-badge" aria-hidden="true">{unread}</span>}
  </button>
  <dialog ref={dialog} className="staff-notifications-dialog" aria-labelledby="staff-notifications-title"
   onClose={()=>bell.current?.focus()}>
   <header className="staff-notifications-heading">
    <div><h2 id="staff-notifications-title">Notifications</h2>
     <p>{unread?`${unread} unread`:'Front desk updates'}</p></div>
    <button type="button" className="icon-btn" onClick={()=>dialog.current?.close()} aria-label="Close notifications"><X size={20}/></button>
   </header>
   {canPush&&<PushDeviceControl hotelId={hotelId} userId={userId}/>}
   {unread>0&&<button type="button" className="btn-inline" onClick={()=>markRead(items.map(item=>item.id))}>Mark all as read</button>}
   <QueryFeedback loading={feed.isPending} error={feed.error} onRetry={()=>void feed.refetch()}
    empty={feed.isSuccess&&items.length===0} emptyMessage="You’re caught up. New bookings and hotel activity alerts will appear here."/>
   {items.length>0&&<ul className="staff-notifications-list">
    {items.map(item=>{
     const {label,icon:Icon,action}=notificationKinds[item.kind];
     const deskAction=item.kind==='room_assignment'?'assign':item.kind.startsWith('checkout_')?'check-out':undefined;
     return <li key={item.id}>
      <Link to="/reservations" search={{booking:item.bookingId,deskAction}}
       onClick={()=>{markRead([item.id]);dialog.current?.close();}}>
       <Icon size={19} aria-hidden="true"/>
       <span><strong>{label}{!read.includes(item.id)&&<span className="staff-notifications-unread"> · Unread</span>}</strong>
        <small>{item.reference} · {dateLabel(item.date)}</small><small>{action}</small></span>
       <ArrowRight size={16} aria-hidden="true"/>
      </Link>
     </li>;
    })}
   </ul>}
   {feed.data?.hasMore&&<p>Showing up to eight per alert type.</p>}
   <Link to="/front-desk" search={{queue:items.some(item=>item.kind==='checkout_overdue')?'overdue':undefined}} onClick={()=>dialog.current?.close()} className="btn-inline">Open Front Desk <ArrowRight size={15}/></Link>
  </dialog>
 </>;
}
