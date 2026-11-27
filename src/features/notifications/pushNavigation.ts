import {normalizeBillingBookingId} from '../billing/bookingLink';

const scopedKeys:Record<string,string>={'/reservations':'booking','/billing':'booking','/expenses':'expense','/cashier-shifts':'shift','/housekeeping':'task','/maintenance':'order','/rooms':'room','/room-calendar':'room','/manager-approvals':'approval','/messages':'conversation','/night-audit':'date','/lost-found':'item'};
const validDate=(value:string|null)=>!!value&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&!Number.isNaN(Date.parse(value+'T00:00:00Z'))&&new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value;
/** Restore the authorized property before fetching a scoped record. */
export function requestedNotificationHotel(pathname:string,search:string,hotels:readonly {id:string;role:string}[]):string|null{
 const key=scopedKeys[pathname];
 if(!key)return null;
 const params=new URLSearchParams(search);
 const hotel=normalizeBillingBookingId(params.get('hotel'));
 const record=params.get(key);
 if(params.getAll('hotel').length!==1||params.getAll(key).length!==1||params.getAll('push').length>1||!hotel||!(key==='date'?validDate(record):key==='room'?!!record&&/^[A-Za-z0-9_-]{1,32}$/.test(record):!!normalizeBillingBookingId(record)))return null;
 if(params.has('push')&&normalizeBillingBookingId(params.get('push'))!=='1')return null;
 const push=pathname==='/reservations'||params.has('push');
 return hotels.some(h=>h.id===hotel&&(!push||h.role==='admin'||h.role==='housekeeping'&&pathname==='/housekeeping'||h.role==='front_desk'&&pathname==='/rooms'))?hotel:null;
}
export function hasScopedBookingLink(pathname:string,search:string):boolean{
 const key=scopedKeys[pathname];
 const params=new URLSearchParams(search);
 return params.has('push')||!!key&&params.has('hotel')&&params.has(key);
}
