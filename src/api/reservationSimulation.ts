import {getJson} from './http';
import {hotelPath} from './session';

export interface SimulationRecord{
 id:string;reference:string;roomTypeId:string;assignedRoomId:string|null;
 checkIn:string;checkOut:string;lifecycleState:string|null;
}
export interface ReservationSimulationResponse{
 data:{
  roomNumber:string;roomTypeName:string;proposedRoomId:string;roomTypeId:string;
  checkIn:string;checkOut:string;nights:number;
  assignedRoomOverlaps:SimulationRecord[];unassignedTypeOverlaps:SimulationRecord[];
  otherAssignedSameTypeCount:number;hasAssignedRoomOverlap:boolean;
 };
 meta:{
  hotelId:string;complete:boolean;isSimulation:true;isAvailability:false;isBookable:false;
  scope:string;exclusions:string[];warning:string;
 };
}
export function getReservationSimulation(roomId:string,from:string,to:string){
 return getJson<ReservationSimulationResponse>(hotelPath('/reservation-simulation'),{roomId,from,to});
}
