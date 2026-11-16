/** Hotel-local date-only arithmetic. Avoid the browser's local timezone for stay nights. */
import type {Reservation} from '../../api/types';

export function parseDay(value:string):Date {
  const [year,month,day]=value.split('-').map(Number);
  return new Date(Date.UTC(year,month-1,day));
}
export function dayString(date:Date):string {
  return date.toISOString().slice(0,10);
}
export function addDays(day:string,days:number):string {
  const date=parseDay(day);
  date.setUTCDate(date.getUTCDate()+days);
  return dayString(date);
}
export function startOfWeek(day:string):string {
  const dow=parseDay(day).getUTCDay(); // Monday first
  return addDays(day,-((dow+6)%7));
}
export function visibleDays(anchor:string,view:'day'|'week'):string[] {
  const start=view==='week'?startOfWeek(anchor):anchor;
  return Array.from({length:view==='week'?7:1},(_,i)=>addDays(start,i));
}
/** Half-open interval [checkIn, checkOut). Departure night is not occupied. */
export function overlapsStay(reservation:Pick<Reservation,'checkIn'|'checkOut'>,from:string,toExclusive:string):boolean {
  return reservation.checkIn<toExclusive && reservation.checkOut>from;
}
export function reservationOnNight(reservation:Pick<Reservation,'checkIn'|'checkOut'>,day:string):boolean {
  return reservation.checkIn<=day && day<reservation.checkOut;
}
export function dayHeading(day:string):string {
  return new Intl.DateTimeFormat('en-PH',{weekday:'short',month:'short',day:'numeric',timeZone:'UTC'}).format(parseDay(day));
}
