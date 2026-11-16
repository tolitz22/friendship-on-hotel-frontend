import {getJson} from './http';
import type {ReportResponse,MaintenanceBoardResponse,HousekeepingBoardResponse,FrontDeskBoardResponse,BookingOptionsResponse,BookingQuoteResponse,RoomTimelineResponse,CalendarParams,ReservationCalendarResponse,CollectionResponse,DashboardSummary,Folio,Guest,HotelDataSource,HousekeepingTask,ItemResponse,ListParams,Reservation,Room} from './types';
const params=(p:ListParams={})=>({search:p.search,page:p.page,per_page:p.perPage});
export const httpDataSource:HotelDataSource={
 getReports:p=>getJson<ReportResponse>('/reports/summary',{from:p.from,to:p.to}),
 getMaintenanceBoard:()=>getJson<MaintenanceBoardResponse>('/maintenance/board'),
 getHousekeepingBoard:()=>getJson<HousekeepingBoardResponse>('/housekeeping/board'),
 getFrontDeskBoard:date=>getJson<FrontDeskBoardResponse>('/front-desk/board',{date}),
 getBookingOptions:()=>getJson<BookingOptionsResponse>('/booking-drafts/options'),
 getBookingQuote:p=>getJson<BookingQuoteResponse>('/booking-drafts/quote',{room_type_id:p.roomTypeId,check_in:p.checkIn,check_out:p.checkOut,adults:p.adults,children:p.children}),
 getRoomTimeline:p=>getJson<RoomTimelineResponse>('/rooms/timeline',{from:p.from,to:p.to}),
 getReservationCalendar:(p:CalendarParams)=>getJson<ReservationCalendarResponse>('/reservations/calendar',{from:p.from,to:p.to}),
 getDashboard:()=>getJson<ItemResponse<DashboardSummary>>('/dashboard/summary'),
 listReservations:(p)=>getJson<CollectionResponse<Reservation>>('/reservations',params(p)),
 listRooms:(p)=>getJson<CollectionResponse<Room>>('/rooms',{...params(p),floor:p?.floor}),
 listGuests:(p)=>getJson<CollectionResponse<Guest>>('/guests',params(p)),
 listHousekeeping:(p)=>getJson<CollectionResponse<HousekeepingTask>>('/housekeeping/tasks',params(p)),
 listFolios:(p)=>getJson<CollectionResponse<Folio>>('/folios',params(p))
};
