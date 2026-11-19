import type {RackArrival,RackRoom} from '../../api/roomRack';

export type RackQuickFilter='all'|'action'|'arrivals'|'departures'|'in_house'|'cleaning'|'review'|'blocked'|'vacant_approved';
export type RackTone='occupied'|'reserved'|'approved'|'attention'|'blocked'|'unknown';

export function roomProblem(room:RackRoom):string|null{
 if(room.blockers.activeRoomImpactMaintenance)return 'Maintenance restriction active';
 if(room.blockers.activeInventoryBlockToday)return 'Inventory block active';
 if(room.blockers.latestTurnoverIncomplete||room.blockers.unfinishedHousekeeping||
  room.cleaning==='checkout_cleaning'||room.cleaning==='cleaning_in_progress')
  return room.cleaning==='cleaning_in_progress'?'Cleaning in progress':'Housekeeping incomplete';
 if(room.inspectionStatus==='submitted')return 'Legacy inspection pending — new inspection required';
 if(room.blockers.newTurnoverSinceInspection)return 'New checkout turnover requires inspection';
 if(room.blockers.newRoomWorkSinceInspection)return 'Inspection outdated after room work';
 if(room.cleaning==='awaiting_inspection'||room.readinessStatus==='needs_inspection')
  return 'Room inspection required';
 if(room.readinessStatus==='blocked_or_stale'||!room.advisoryReady)
  return 'Current inspection not verified';
 return null;
}
export function roomTone(room:RackRoom):RackTone{
 if(room.blockers.activeInventoryBlockToday||room.blockers.activeRoomImpactMaintenance)return 'blocked';
 if(room.occupancy!=='vacant')return 'occupied';
 if(room.cleaning==='checkout_cleaning'||room.cleaning==='cleaning_in_progress'||
   room.readinessStatus==='awaiting_review'||room.inspectionStatus==='submitted'||
   room.readinessStatus==='blocked_or_stale')return 'attention';
 if(room.upcomingStay)return 'reserved';
 if(room.advisoryReady)return 'approved';
 if(room.cleaning==='awaiting_inspection')return 'attention';
 return 'unknown';
}
export function roomNextAction(room:RackRoom):string{
 if(room.blockers.activeRoomImpactMaintenance)return 'Open maintenance order';
 if(room.blockers.activeInventoryBlockToday)return 'Review inventory block';
 if(room.blockers.latestTurnoverIncomplete||room.blockers.unfinishedHousekeeping||
    room.cleaning==='checkout_cleaning'||room.cleaning==='cleaning_in_progress')
  return 'Open housekeeping task';
 if(!room.advisoryReady)return 'Inspect room';
 if(room.occupancy==='due_for_checkout')return 'Review departure';
 if(room.occupancy==='occupied')return 'Open reservation';
 if(room.upcomingStay)return 'Review arrival';
 return 'View room';
}
export function roomPriority(room:RackRoom,arrivals:RackArrival[],date:string):number{
 const arrival=arrivals.some(a=>a.assignedRoomId===room.roomId&&a.checkIn===date);
 if(arrival&&roomProblem(room))return 0;
 if(room.inspectionStatus==='submitted')return 2;
 if(room.blockers.latestTurnoverIncomplete||room.blockers.unfinishedHousekeeping||
    room.cleaning==='checkout_cleaning'||room.cleaning==='cleaning_in_progress')return 3;
 if(room.blockers.activeRoomImpactMaintenance||room.blockers.activeInventoryBlockToday)return 4;
 if(room.occupancy==='due_for_checkout')return 5;
 if(room.occupancy==='occupied')return 6;
 if(room.upcomingStay)return 7;
 if(room.advisoryReady)return 8;
 return 9;
}
export function matchRackQuick(room:RackRoom,filter:RackQuickFilter,date:string,arrivals:RackArrival[]):boolean{
 switch(filter){
 case 'all':return true;
 case 'action':return !!roomProblem(room)||room.occupancy==='due_for_checkout';
 case 'arrivals':return arrivals.some(a=>a.assignedRoomId===room.roomId&&a.checkIn===date);
 case 'departures':return room.currentStay?.checkOut===date;
 case 'in_house':return room.occupancy!=='vacant';
 case 'cleaning':return room.cleaning==='checkout_cleaning'||room.cleaning==='cleaning_in_progress'||
  room.blockers.latestTurnoverIncomplete||room.blockers.unfinishedHousekeeping;
 case 'review':return room.inspectionStatus==='submitted';
 case 'blocked':return room.blockers.activeRoomImpactMaintenance||room.blockers.activeInventoryBlockToday;
 case 'vacant_approved':return room.occupancy==='vacant'&&room.advisoryReady&&!room.upcomingStay;
 }
}
export function matchRackSearch(room:RackRoom,query:string,mayShowGuest:boolean):boolean{
 const text=query.trim().toLocaleLowerCase();
 if(!text)return true;
 return [room.roomNumber,room.roomTypeName,...(mayShowGuest?
  [room.currentStay?.guestName??'',room.upcomingStay?.guestName??'']:[])]
  .some(value=>value.toLocaleLowerCase().includes(text));
}
export function sortRackRooms(rooms:RackRoom[],arrivals:RackArrival[],date:string){
 return [...rooms].sort((a,b)=>roomPriority(a,arrivals,date)-roomPriority(b,arrivals,date)||
  a.roomNumber.localeCompare(b.roomNumber,undefined,{numeric:true}));
}
