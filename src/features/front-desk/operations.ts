import type {FrontDeskEntry} from '../../api/types';

export type DeskOperation='check_in'|'check_out';
export type DeskChecklistKey='identity'|'room'|'payment'|'keys';

export function checklistFor(operation:DeskOperation):Array<{key:DeskChecklistKey;label:string;description:string}>{
 return operation==='check_in'
 ? [
  {key:'identity',label:'Guest identity reviewed',description:'Illustrative verification; no identity documents collected'},
  {key:'room',label:'Room assignment and readiness reviewed',description:'Verify housekeeping, maintenance and actual occupancy with hotel procedures'},
  {key:'payment',label:'Deposit/payment policy reviewed',description:'No charges or payment authorizations are taken'},
  {key:'keys',label:'Key handover explained',description:'No key-card integration or access is granted'}
 ]:[
  {key:'identity',label:'Guest and room reviewed',description:'Verify the stay and intended departure'},
  {key:'room',label:'Room handover reviewed',description:'Housekeeping transitions are not triggered'},
  {key:'payment',label:'Folio settlement reviewed',description:'No folio settlement or refunds are performed'},
  {key:'keys',label:'Keys returned or deactivated',description:'No key-card integration'}
 ];
}
export function operationWarnings(entry:FrontDeskEntry,operation:DeskOperation):string[]{
 const warnings=[...entry.alerts];
 if(operation==='check_in'&&entry.reservation.status!=='confirmed')warnings.push('Only confirmed reservations proceed to check-in after server validation');
 if(operation==='check_out'&&entry.reservation.status!=='checked_in')warnings.push('Guest is not marked checked in');
 if(operation==='check_in'&&entry.room?.occupancyStatus==='occupied')warnings.push('Room is currently marked occupied');
 return [...new Set(warnings)];
}
