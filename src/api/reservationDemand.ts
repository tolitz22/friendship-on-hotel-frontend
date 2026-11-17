import {getJson} from './http';
import {hotelPath} from './session';

export interface DemandTypeNight{
 roomTypeId:string;roomTypeName:string;registeredRooms:number;
 totalRecords:number;assignedRecords:number;unassignedRecords:number;
}
export interface DemandDay{date:string;roomTypes:DemandTypeNight[];}
export interface ReservationDemandResponse{
 data:{days:DemandDay[];matchingRecordCount:number};
 meta:{
  hotelId:string;from:string;to:string;timeZone:string;
  complete:boolean;isAvailability:false;isOccupancy:false;
  scope:string;warnings:string[];
 };
}
export const getReservationDemand=(from:string,to:string)=>
 getJson<ReservationDemandResponse>(hotelPath('/reservation-demand'),{from,to});
