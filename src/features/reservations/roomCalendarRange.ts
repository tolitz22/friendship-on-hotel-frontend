import {addDays} from './calendarDate';

export type DatedOccupancy={roomId:string;checkIn:string;checkOut:string};
export function validRoomStay(arrival:string,departure:string):boolean{
 if(!/^\d{4}-\d{2}-\d{2}$/.test(arrival)||!/^\d{4}-\d{2}-\d{2}$/.test(departure))return false;
 const start=Date.parse(arrival+'T00:00:00Z'),end=Date.parse(departure+'T00:00:00Z');
 if(!Number.isFinite(start)||!Number.isFinite(end))return false;
 if(new Date(start).toISOString().slice(0,10)!==arrival||new Date(end).toISOString().slice(0,10)!==departure)return false;
 return departure>arrival&&departure<=addDays(arrival,31);
}
/** Half-open stay: checkout night is not consumed. */
export function roomHasConflict(roomId:string,arrival:string,departure:string,
 bookings:DatedOccupancy[],blocks:DatedOccupancy[]):boolean{
 if(!validRoomStay(arrival,departure))return true;
 return [...bookings,...blocks].some(item=>item.roomId===roomId
  &&item.checkIn<departure&&item.checkOut>arrival);
}
