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
export interface HotelDataSource {
 getDashboard():Promise<ItemResponse<DashboardSummary>>;
 listReservations(params?:ListParams):Promise<CollectionResponse<Reservation>>;
 listRooms(params?:ListParams & {floor?:number}):Promise<CollectionResponse<Room>>;
 listGuests(params?:ListParams):Promise<CollectionResponse<Guest>>;
 listHousekeeping(params?:ListParams):Promise<CollectionResponse<HousekeepingTask>>;
 listFolios(params?:ListParams):Promise<CollectionResponse<Folio>>;
}
