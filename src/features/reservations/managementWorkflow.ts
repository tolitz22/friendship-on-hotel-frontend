import type {LiveRecord} from '../../api/liveReservations';

/** Presentation-only guidance. Laravel remains the authority for all actions. */
export function nextReservationAction(record:Pick<LiveRecord,'lifecycleState'|'assignedRoomId'>):string{
 if(record.lifecycleState==='confirmed'){
  return record.assignedRoomId?'Review arrival':'Assign a room';
 }
 if(record.lifecycleState==='checked_in')return 'Manage in-house stay';
 if(record.lifecycleState==='checked_out')return 'View completed stay';
 return 'View reservation';
}

export function reservationActionHint(record:Pick<LiveRecord,'lifecycleState'|'assignedRoomId'>):string{
 if(record.lifecycleState==='confirmed'){
  return record.assignedRoomId
   ?'Room assigned · check arrival readiness'
   :'Needs room assignment before check-in';
 }
 if(record.lifecycleState==='checked_in')return 'Guest currently in house';
 return 'Open details and audit history';
}
