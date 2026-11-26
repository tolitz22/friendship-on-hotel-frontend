import {useRef,useState} from 'react';
import {Link} from '@tanstack/react-router';
import {useQuery} from '@tanstack/react-query';
import {AlertTriangle,ArrowRight,BedDouble,Bell,CalendarPlus,ClipboardCheck,ClipboardList,CreditCard,LogOut,Megaphone,MessageCircle,Receipt,RefreshCw,Settings2,Wallet,Wrench,X} from 'lucide-react';
import {z} from 'zod';
import {getJson} from '../api/http';
import {dateLabel} from '../lib/format';
import {QueryFeedback} from './QueryFeedback';
import {PushDeviceControl} from './PushDeviceControl';
import {PushPermissionPrompt} from './PushPermissionPrompt';
import {groupFor,notificationGroups,priorityFor,visibleNotifications,type NotificationFilter,type NotificationGroup} from '../features/notifications/notificationView';
import './StaffNotifications.css';

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
 payment_recorded:{label:'Payment recorded',icon:CreditCard,action:'Open billing'},
 payment_pending_review:{label:'Payment awaiting verification',icon:AlertTriangle,action:'Review payment'},
 payment_verified:{label:'Payment verified',icon:CreditCard,action:'Open billing'},
 payment_rejected:{label:'Payment rejected',icon:AlertTriangle,action:'Open billing'},
 payment_voided:{label:'Payment voided',icon:AlertTriangle,action:'Open billing'},
 refund_requested:{label:'Refund requested',icon:Wallet,action:'Review refund'},
 refund_verified:{label:'Refund evidence verified',icon:Wallet,action:'Open billing'},
 expense_recorded:{label:'Expense recorded',icon:Receipt,action:'Open expense'},
 expense_correction_requested:{label:'Expense correction requested',icon:AlertTriangle,action:'Review expense'},
 cashier_discrepancy:{label:'Cashier cash-count discrepancy',icon:AlertTriangle,action:'Review cashier shift'},
 housekeeping_completed:{label:'Housekeeping completed',icon:ClipboardCheck,action:'Open task'},
 room_inspection_approved:{label:'Room inspection approved',icon:ClipboardCheck,action:'Open room'},
 room_inspection_rejected:{label:'Room inspection rejected',icon:AlertTriangle,action:'Review room'},
 maintenance_created:{label:'Maintenance work order created',icon:Wrench,action:'Open work order'},
 maintenance_urgent:{label:'Urgent maintenance',icon:AlertTriangle,action:'Review work order'},
 maintenance_resolved:{label:'Maintenance resolved',icon:Wrench,action:'Open work order'},
 room_blocked:{label:'Room blocked',icon:BedDouble,action:'Open calendar'},
 room_unblocked:{label:'Room unblocked',icon:BedDouble,action:'Open calendar'},
 approval_requested:{label:'Manager approval requested',icon:AlertTriangle,action:'Review approvals'},
 approval_approved:{label:'Manager approval granted',icon:ClipboardCheck,action:'Open approvals'},
 approval_rejected:{label:'Manager approval rejected',icon:AlertTriangle,action:'Open approvals'},
 staff_message:{label:'New staff message',icon:MessageCircle,action:'Open conversation'},
 staff_announcement:{label:'Staff announcement',icon:Megaphone,action:'Read announcement'},
 staff_handover:{label:'Shift handover',icon:ClipboardList,action:'Read handover'},
 staff_acknowledged:{label:'Staff update acknowledged',icon:ClipboardCheck,action:'Open conversation'},
 daily_close_completed:{label:'Daily closing completed',icon:ClipboardCheck,action:'Open Daily Closing'},
 daily_close_blocked:{label:'Daily closing blocked',icon:AlertTriangle,action:'Open Daily Closing'},
 closing_cashier_unreconciled:{label:'Cashier reconciliation outstanding',icon:Wallet,action:'Open Daily Closing'},
 closing_payment_pending:{label:'Payment evidence outstanding',icon:CreditCard,action:'Open Daily Closing'},
 closing_journal_integrity:{label:'Journal integrity issue',icon:AlertTriangle,action:'Open Daily Closing'},
 closing_no_show_unresolved:{label:'No-show financial review outstanding',icon:AlertTriangle,action:'Open Daily Closing'},
 closing_room_night_issue:{label:'Nightly room accounting issue',icon:BedDouble,action:'Open Daily Closing'},
} as const;
const responseSchema=z.object({data:z.object({
 hotelId:z.string(),
 notifications:z.array(z.object({
  id:z.string(),kind:z.enum(Object.keys(notificationKinds) as (keyof typeof notificationKinds)[]),bookingId:z.string().regex(/^[1-9]\d*$/).optional(),
  target:z.enum(['billing','expenses','cashier-shifts','housekeeping','maintenance','rooms','room-calendar','manager-approvals','messages','night-audit']).optional(),paymentId:z.string().regex(/^[1-9]\d*$/).nullish(),expenseId:z.string().regex(/^[1-9]\d*$/).optional(),shiftId:z.string().regex(/^[1-9]\d*$/).optional(),
  taskId:z.string().regex(/^[1-9]\d*$/).optional(),orderId:z.string().regex(/^[1-9]\d*$/).optional(),room:z.string().min(1).max(50).optional(),calendarDate:z.iso.date().optional(),approvalId:z.string().regex(/^[1-9]\d*$/).optional(),
  conversationId:z.string().regex(/^[1-9]\d*$/).optional(),
  closingDate:z.iso.date().optional(),
  reference:z.string(),date:z.iso.date(),
 }).refine(item=>item.target==='expenses'?!!item.expenseId:item.target==='cashier-shifts'?!!item.shiftId:item.target==='housekeeping'?!!item.taskId:item.target==='maintenance'?!!item.orderId:item.target==='rooms'||item.target==='room-calendar'?!!item.room:item.target==='manager-approvals'?!!item.approvalId:item.target==='messages'?!!item.conversationId:item.target==='night-audit'?!!item.closingDate:!!item.bookingId)),
 hasMore:z.boolean(),
})});

export function StaffNotifications({hotelId,userId,canPush=false}:{hotelId:string;userId:string;canPush?:boolean}){
 const storageKey='pms.notification-read:v1:'+userId+':'+hotelId;
 const [read,setRead]=useState<string[]>(()=>{
  try{
   return z.array(z.string()).parse(JSON.parse(localStorage.getItem(storageKey)??'[]'));
  }catch{return [];}
 });
 const [open,setOpen]=useState(false);
 const [settings,setSettings]=useState(false);
 const [filter,setFilter]=useState<NotificationFilter>('all');
 const [group,setGroup]=useState<NotificationGroup|'all'>('all');
 const dialog=useRef<HTMLDialogElement>(null);
 const bell=useRef<HTMLButtonElement>(null);
 const feed=useQuery({
  queryKey:['live','front-desk','manifest',hotelId,'notifications',userId,canPush],
  queryFn:async()=>{
   const {data}=responseSchema.parse(await getJson<unknown>('/hotels/'+encodeURIComponent(hotelId)+'/front-desk/notifications',canPush?{expanded:1}:{}));
   if(data.hotelId!==hotelId)throw new Error('Notifications belong to another hotel.');
   return data;
  },
  retry:false,
  staleTime:15_000,
  refetchInterval:open?30_000:60_000,
  refetchIntervalInBackground:false,
 });
 const items=feed.data?.notifications??[];
 const readSet=new Set(read);
 const unread=items.filter(item=>!readSet.has(item.id)).length;
 const attention=items.filter(item=>priorityFor(item.kind)>0).length;
 const urgent=items.filter(item=>priorityFor(item.kind)===2).length;
 const visible=visibleNotifications(items,readSet,filter,group);
 const groups=notificationGroups.filter(name=>items.some(item=>groupFor(item.kind)===name));
 function markRead(ids:string[]){
  const updated=[...new Set([...ids,...read])].slice(0,500);
  setRead(updated);
  try{localStorage.setItem(storageKey,JSON.stringify(updated));}catch{/* Remain usable in memory. */}
 }
 return <>
  {canPush&&<PushPermissionPrompt userId={userId} hotelId={hotelId} active={!open} onSettings={()=>{dialog.current?.showModal();setSettings(true);setOpen(true);}}/>}
  <button ref={bell} type="button" className={'icon-btn topbar-action-notifications'+(urgent?' has-urgent':'')}
   aria-label={unread?`Notifications, ${unread} unread`:'Notifications'} aria-haspopup="dialog"
   onClick={()=>{dialog.current?.showModal();setOpen(true);void feed.refetch();}}>
   <Bell size={19}/>{unread>0&&<span className="staff-notifications-badge" aria-hidden="true">{unread}</span>}
  </button>
  <dialog ref={dialog} className="staff-notifications-dialog" aria-labelledby="staff-notifications-title"
   onClose={()=>{setOpen(false);setSettings(false);bell.current?.focus();}}>
   <header className="staff-notifications-heading">
    <div><h2 id="staff-notifications-title">Notifications</h2>
     <p>{unread} unread · {attention} require attention{feed.data?.hasMore?' · partial feed':''}</p></div>
    <div className="notification-header-actions">
     {canPush&&<button type="button" className="icon-btn" aria-label="Push notification settings" aria-pressed={settings} onClick={()=>setSettings(v=>!v)}><Settings2 size={18}/></button>}
     <button type="button" className="icon-btn" onClick={()=>dialog.current?.close()} aria-label="Close notifications"><X size={20}/></button>
    </div>
   </header>
   {canPush&&<div hidden={!settings}><PushDeviceControl hotelId={hotelId} userId={userId} active={open&&settings}/><button type="button" className="btn-inline notification-back" onClick={()=>setSettings(false)}>Back to notifications</button></div>}
   <div hidden={settings}>
   <div className="notification-toolbar">
    <div className="notification-filters" role="group" aria-label="Filter notifications">
     {([['all','All',items.length],['unread','Unread',unread],['attention','Requires attention',attention]] as const).map(([key,label,count])=><button type="button" key={key} aria-pressed={filter===key} onClick={()=>setFilter(key)}>{label} <span>{count}</span></button>)}
    </div>
    <div className="notification-tools">
     <label>Module <select value={group} onChange={e=>setGroup(e.target.value as NotificationGroup|'all')}><option value="all">All modules</option>{groups.map(name=><option key={name}>{name}</option>)}</select></label>
     <button type="button" className="btn-inline" onClick={()=>void feed.refetch()} disabled={feed.isFetching} aria-label="Refresh notifications"><RefreshCw size={14} aria-hidden="true"/> Refresh</button>
    </div>
    {unread>0&&<button type="button" className="btn-inline notification-mark" onClick={()=>markRead(items.map(item=>item.id))}>Mark all as read</button>}
   </div>
   {urgent>0&&<p className="notification-urgent-summary"><AlertTriangle size={16} aria-hidden="true"/> {urgent} urgent {urgent===1?'alert':'alerts'} need attention.</p>}
   <QueryFeedback loading={feed.isPending} error={feed.error} onRetry={()=>void feed.refetch()}
    empty={feed.isSuccess&&visible.length===0} emptyMessage={filter==='attention'?'No alerts require attention in this view.':filter==='unread'?'No unread alerts in this view.':'No notifications in this view.'}/>
   {visible.length>0&&<ul className="staff-notifications-list">
    {visible.map(item=>{
     const {label,icon:Icon,action}=notificationKinds[item.kind];
     const deskAction=item.kind==='room_assignment'?'assign':item.kind.startsWith('checkout_')?'check-out':undefined;
     const close=()=>{markRead([item.id]);dialog.current?.close();};
     const priority=priorityFor(item.kind);
     const content=<><span className="notification-icon"><Icon size={19} aria-hidden="true"/></span>
       <span className="notification-copy"><small className="notification-category">{groupFor(item.kind)}{priority===2?' · Urgent':priority===1?' · Requires attention':''}</small><strong>{label}{!readSet.has(item.id)&&<span className="staff-notifications-unread"> · Unread</span>}</strong>
        <small>{item.reference} · {dateLabel(item.date)}</small><small className="notification-action">{action}</small></span>
       <ArrowRight size={16} aria-hidden="true"/></>;
     return <li key={item.id} className={'notification-row priority-'+priority+(!readSet.has(item.id)?' is-unread':'')}>
      {item.target==='billing'?<Link to="/billing" search={{booking:item.bookingId,payment:item.paymentId??undefined,hotel:hotelId}} onClick={close}>{content}</Link>
      :item.target==='expenses'?<Link to="/expenses" search={{expense:item.expenseId,hotel:hotelId}} onClick={close}>{content}</Link>
      :item.target==='cashier-shifts'?<Link to="/cashier-shifts" search={{shift:item.shiftId,hotel:hotelId}} onClick={close}>{content}</Link>
      :item.target==='housekeeping'?<Link to="/housekeeping" search={{task:item.taskId}} onClick={close}>{content}</Link>
      :item.target==='maintenance'?<Link to="/maintenance" search={{order:item.orderId}} onClick={close}>{content}</Link>
      :item.target==='rooms'?<Link to="/rooms" search={{room:item.room}} onClick={close}>{content}</Link>
      :item.target==='room-calendar'?<Link to="/room-calendar" search={{room:item.room,date:item.calendarDate,hotel:hotelId}} onClick={close}>{content}</Link>
      :item.target==='manager-approvals'?<Link to="/manager-approvals" search={{approval:item.approvalId,hotel:hotelId}} onClick={close}>{content}</Link>
      :item.target==='messages'?<Link to="/messages" search={{conversation:item.conversationId,hotel:hotelId}} onClick={close}>{content}</Link>
      :item.target==='night-audit'?<Link to="/night-audit" search={{date:item.closingDate,hotel:hotelId}} onClick={close}>{content}</Link>
      :<Link to="/reservations" search={{booking:item.bookingId,deskAction}} onClick={close}>{content}</Link>}
     </li>;
    })}
   </ul>}
   {feed.data?.hasMore&&<p>Showing up to eight per alert type.</p>}
   <Link to="/front-desk" search={{queue:items.some(item=>item.kind==='checkout_overdue')?'overdue':undefined}} onClick={()=>dialog.current?.close()} className="btn-inline">Open Front Desk <ArrowRight size={15}/></Link>
   </div>
  </dialog>
 </>;
}
