import type {Room,TimelineBlock} from '../../api/types';
import {reservationOnNight} from '../reservations/calendarDate';

export function blocksForNight(blocks:TimelineBlock[],roomId:string,day:string):TimelineBlock[] {
 return blocks.filter(b=>b.roomId===roomId&&reservationOnNight({checkIn:b.from,checkOut:b.to},day));
}
export function roomMatches(room:Room,search:string,roomType:string,floor:string):boolean {
 if(roomType!=='all'&&room.roomTypeId!==roomType)return false;
 if(floor!=='all'&&room.floor!==Number(floor))return false;
 const q=search.trim().toLowerCase();
 return !q||[room.number,room.roomTypeName,room.occupancyStatus,room.housekeepingStatus,room.maintenanceStatus].some(v=>v.toLowerCase().includes(q));
}
/** Display-only categorization. Never treat an empty cell as bookable inventory. */
export function nightLabel(blocks:TimelineBlock[]):'maintenance'|'reservation'|'overlap'|'unknown' {
 const maintenance=blocks.filter(b=>b.kind==='maintenance');
 const booking=blocks.filter(b=>b.kind==='reservation');
 if(booking.length&&maintenance.length||booking.length>1)return 'overlap';
 if(maintenance.length)return 'maintenance';
 if(booking.length)return 'reservation';
 return 'unknown';
}
