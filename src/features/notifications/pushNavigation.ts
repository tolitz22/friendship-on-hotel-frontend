/** Select only an authorized property from a booking notification link. */
export function requestedNotificationHotel(pathname:string,search:string,hotels:readonly {id:string;role:string}[]):string|null{
 if(pathname!=='/reservations')return null;
 const params=new URLSearchParams(search);
 const hotel=params.get('hotel'),booking=params.get('booking');
 if(!hotel||!booking||!/^[1-9][0-9]*$/.test(hotel)||!/^[1-9][0-9]*$/.test(booking))return null;
 return hotels.some(h=>h.id===hotel&&h.role==='admin')?hotel:null;
}
export function hasScopedBookingLink(pathname:string,search:string):boolean{
 return pathname==='/reservations'&&new URLSearchParams(search).has('hotel')&&new URLSearchParams(search).has('booking');
}
