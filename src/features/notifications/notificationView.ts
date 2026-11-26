export const notificationGroups=['Front desk','Bookings','Finance','Operations','Staff messages','Daily closing'] as const;
export type NotificationGroup=typeof notificationGroups[number];
export type NotificationFilter='all'|'unread'|'attention';
const urgent=new Set(['checkout_overdue','maintenance_urgent','cashier_discrepancy','closing_journal_integrity']);
const attention=new Set([...urgent,'checkout_due','room_assignment','payment_pending_review','payment_rejected','refund_requested','expense_correction_requested','room_inspection_rejected','approval_requested','staff_announcement','staff_handover','daily_close_blocked','closing_cashier_unreconciled','closing_payment_pending','closing_no_show_unresolved','closing_room_night_issue']);
export function groupFor(kind:string):NotificationGroup{
 if(kind.startsWith('checkout_')||kind==='room_assignment'||kind==='new_booking')return 'Front desk';
 if(/^(guest_|booking_|stay_)/.test(kind))return 'Bookings';
 if(/^(payment_|refund_|expense_|cashier_)/.test(kind))return 'Finance';
 if(kind.startsWith('staff_'))return 'Staff messages';
 if(/^(daily_close_|closing_)/.test(kind))return 'Daily closing';
 return 'Operations';
}
export function priorityFor(kind:string){return urgent.has(kind)?2:attention.has(kind)?1:0;}
export function visibleNotifications<T extends {id:string;kind:string;date:string}>(items:readonly T[],read:ReadonlySet<string>,filter:NotificationFilter,group:NotificationGroup|'all'):T[]{
 return items.filter(item=>(group==='all'||groupFor(item.kind)===group)&&(filter==='all'||(filter==='unread'?!read.has(item.id):priorityFor(item.kind)>0)))
 .sort((a,b)=>priorityFor(b.kind)-priorityFor(a.kind)||Number(read.has(a.id))-Number(read.has(b.id))||b.date.localeCompare(a.date));
}
