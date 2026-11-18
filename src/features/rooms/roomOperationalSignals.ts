import type {InventoryRoomStatus} from '../../api/roomInventoryStatus';

/**
 * A current, informational room assessment. This is not a booking decision:
 * reservation collision checks, physical occupancy and check-in authorization
 * are always separate.
 */
export type RoomSignal={
 tone:'blocked'|'attention'|'approved'|'occupied';
 title:string;
 explanation:string;
 action:string;
};
export function roomOperationalSignal(room:InventoryRoomStatus):RoomSignal{
 if(room.inventoryBlockedToday||room.maintenanceBlocked)return {
  tone:'blocked',title:'Room restricted',
  explanation:room.inventoryBlockedToday&&room.maintenanceBlocked
   ?'An inventory block and a maintenance restriction are active.'
   :room.inventoryBlockedToday?'An inventory block is active today.':'An active maintenance restriction affects this room.',
  action:'Review active restrictions before any room assignment or check-in.',
 };
 if(room.occupancy!=='vacant')return{
  tone:'occupied',title:room.occupancy==='due_for_checkout'?'Checkout due':'Guest in house',
  explanation:'The hotel has a registered stay in this room.',
  action:'Confirm the guest departure before preparing the next stay.',
 };
 if(room.cleaning==='checkout_cleaning')return{
  tone:'attention',title:'Cleaning required',
  explanation:'Checkout cleaning has not started.',
  action:'Complete housekeeping and inspect before use.',
 };
 if(room.cleaning==='cleaning_in_progress')return{
  tone:'attention',title:'Cleaning in progress',
  explanation:'Housekeeping work is underway.',
  action:'Follow up on the cleaning task.',
 };
 if(room.cleaning==='awaiting_inspection')return{
  tone:'attention',title:'Inspection needed',
  explanation:'Cleaning is recorded, but readiness approval is pending.',
  action:'Review and approve the room inspection when appropriate.',
 };
 if(room.cleaning==='ready'&&room.advisoryReady)return{
  tone:'approved',title:'Inspection approved',
  explanation:'Current room-readiness evidence is approved.',
  action:'Recheck room availability and guest details at check-in.',
 };
 return {
  tone:'attention',title:'Readiness not verified',
  explanation:'No current approved inspection is recorded; this does not mean the room is dirty.',
  action:'Check inspection records and confirm physical room conditions.',
 };
}

export type MaintenanceNote={status:'open'|'in_progress'|'resolved'|'closed';affectsRoom:boolean};
export function informationalMaintenanceCount(notes:MaintenanceNote[]){
 return notes.filter(note=>note.affectsRoom&&(note.status==='open'||note.status==='in_progress')).length;
}
