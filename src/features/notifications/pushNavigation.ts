const scopedKeys:Record<string,string>={'/reservations':'booking','/billing':'booking','/expenses':'expense','/cashier-shifts':'shift','/housekeeping':'task','/maintenance':'order','/rooms':'room','/room-calendar':'room','/manager-approvals':'approval','/messages':'conversation'};
const numeric=(value:string|null)=>!!value&&/^[1-9][0-9]*$/.test(value);
/** Restore the authorized property before fetching a scoped record. */
export function requestedNotificationHotel(pathname:string,search:string,hotels:readonly {id:string;role:string}[]):string|null{
 const key=scopedKeys[pathname];
 if(!key)return null;
 const params=new URLSearchParams(search);
 const hotel=params.get('hotel');
 const record=params.get(key);
 if(!numeric(hotel)||!(key==='room'?!!record&&/^[A-Za-z0-9_-]{1,32}$/.test(record):numeric(record)))return null;
 const push=pathname==='/reservations'||params.get('push')==='1';
 return hotels.some(h=>h.id===hotel&&(!push||h.role==='admin'))?hotel:null;
}
export function hasScopedBookingLink(pathname:string,search:string):boolean{
 const key=scopedKeys[pathname];
 const params=new URLSearchParams(search);
 return !!key&&params.has('hotel')&&params.has(key);
}
