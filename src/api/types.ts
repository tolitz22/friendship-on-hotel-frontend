export type Id = string;
export type ISODate = string; // YYYY-MM-DD, property-local calendar date
export type ISODateTime = string; // Timestamp including offset
export type CurrencyCode = 'PHP';
export type Money = { amountMinor: number; currency: CurrencyCode };
export type Pagination = { page: number; perPage: number; total: number; totalPages: number };
export type CollectionResponse<T> = { data: T[]; meta: Pagination };
export type ItemResponse<T> = { data: T };
export type ReservationStatus = 'pending'|'confirmed'|'checked_in'|'checked_out'|'cancelled'|'no_show';
export type OccupancyStatus = 'vacant'|'occupied';
export type HousekeepingStatus = 'clean'|'dirty'|'inspecting'|'in_progress';
export type MaintenanceStatus = 'available'|'out_of_order'|'out_of_service';
export type TaskStatus = 'todo'|'in_progress'|'done';
export type FolioStatus = 'open'|'settled'|'voided';
export interface Room { id:Id; hotelId:Id; number:string; floor:number; roomTypeId:Id; roomTypeName:string; occupancyStatus:OccupancyStatus; housekeepingStatus:HousekeepingStatus; maintenanceStatus:MaintenanceStatus; maxOccupancy:number; }
export interface Guest {id:Id; hotelId:Id; firstName:string; lastName:string; email:string|null; phone:string|null; nationality:string|null; createdAt:ISODateTime;}
export interface Reservation {id:Id; reference:string; hotelId:Id; primaryGuestId:Id; primaryGuestName:string; roomTypeId:Id; roomTypeName:string; assignedRoomId:Id|null; assignedRoomNumber:string|null; checkIn:ISODate; checkOut:ISODate; status:ReservationStatus; adults:number; children:number; total:Money; createdAt:ISODateTime;}
export interface HousekeepingTask {id:Id; hotelId:Id; roomId:Id; roomNumber:string; type:'checkout_clean'|'stayover'|'inspection'; status:TaskStatus; assignedTo:string|null; dueAt:ISODateTime|null;}
export interface Folio {id:Id; hotelId:Id; reservationId:Id; reservationReference:string; guestName:string; status:FolioStatus; balance:Money; totalCharges:Money; totalPayments:Money;}
export interface DashboardSummary {hotelId:Id; asOf:ISODate; totalRooms:number; occupiedRooms:number; vacantRooms:number; dirtyRooms:number; arrivalsToday:number; departuresToday:number; reservationsToday:number;}
export type ListParams = {search?:string;page?:number;perPage?:number};
export type CalendarParams = {from:ISODate;to:ISODate};
export type ReservationCalendarResponse = {data:Reservation[];meta:{from:ISODate;to:ISODate;roomTypes:{id:Id;name:string}[]}};
export type TimelineBlock =
 | {id:Id;kind:'reservation';roomId:Id;from:ISODate;to:ISODate;reservationId:Id;reference:string;guestName:string;status:ReservationStatus}
 | {id:Id;kind:'maintenance';roomId:Id;from:ISODate;to:ISODate;reason:string};
export type RoomTimelineResponse = {data:{rooms:Room[];blocks:TimelineBlock[];unassignedReservations:Reservation[]};meta:{from:ISODate;to:ISODate;hotelId:Id}};
export type BookingOptionsResponse = {data:{roomTypes:Array<{id:Id;name:string;maxOccupancy:number;sampleNightlyRate:Money}>}};
export type BookingQuoteRequest = {roomTypeId:Id;checkIn:ISODate;checkOut:ISODate;adults:number;children:number};
export type BookingQuoteResponse = {data:{nights:number;nightlyRate:Money;roomSubtotal:Money;currency:CurrencyCode;isIllustrative:boolean}};
export type FrontDeskEntry = {
 reservation:Reservation;
 room:Room|null;
 readiness:'review_required'|'unverified';
 alerts:string[];
};
export type FrontDeskBoardResponse = {
 data:{arrivals:FrontDeskEntry[];departures:FrontDeskEntry[];inHouse:FrontDeskEntry[]};
 meta:{date:ISODate;hotelId:Id;timeZone:string;isPreview:boolean};
};
export type HousekeepingBoardResponse = {
 data:{tasks:HousekeepingTask[];rooms:Room[];staff:Array<{id:Id;name:string}>};
 meta:{hotelId:Id;isPreview:boolean};
};
export type MaintenancePriority='low'|'medium'|'high'|'urgent';
export type WorkOrderStatus='open'|'in_progress'|'resolved'|'closed';
export interface MaintenanceWorkOrder {
 id:Id;hotelId:Id;roomId:Id;roomNumber:string;title:string;description:string;
 priority:MaintenancePriority;status:WorkOrderStatus;assignedTo:string|null;
 reportedAt:ISODateTime;resolvedAt:ISODateTime|null;
 affectsRoom:boolean;history:Array<{id:Id;at:ISODateTime;message:string}>;
}
export type MaintenanceBoardResponse={
 data:{workOrders:MaintenanceWorkOrder[];rooms:Room[];technicians:Array<{id:Id;name:string}>;};
 meta:{hotelId:Id;isPreview:boolean};
};
export interface HotelDataSource {
 getMaintenanceBoard():Promise<MaintenanceBoardResponse>;
 getHousekeepingBoard():Promise<HousekeepingBoardResponse>;
 getFrontDeskBoard(date:ISODate):Promise<FrontDeskBoardResponse>;
 getBookingOptions():Promise<BookingOptionsResponse>;
 getBookingQuote(params:BookingQuoteRequest):Promise<BookingQuoteResponse>;
 getRoomTimeline(params:CalendarParams):Promise<RoomTimelineResponse>;
 getReservationCalendar(params:CalendarParams):Promise<ReservationCalendarResponse>;
 getDashboard():Promise<ItemResponse<DashboardSummary>>;
 listReservations(params?:ListParams):Promise<CollectionResponse<Reservation>>;
 listRooms(params?:ListParams & {floor?:number}):Promise<CollectionResponse<Room>>;
 listGuests(params?:ListParams):Promise<CollectionResponse<Guest>>;
 listHousekeeping(params?:ListParams):Promise<CollectionResponse<HousekeepingTask>>;
 listFolios(params?:ListParams):Promise<CollectionResponse<Folio>>;
}
