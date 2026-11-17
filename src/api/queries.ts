import {useQuery} from '@tanstack/react-query';
import {hotelApi,dataMode} from './index';
import {readSession} from './session';import type {BookingQuoteRequest,CalendarParams,ListParams,ReportQuery} from './types';
export const queryKeys={
 hotelSettings:['hotel','settings'] as const,
 reports:(p:ReportQuery)=>['reports','summary',p] as const,
 maintenanceBoard:['maintenance','board'] as const,
 housekeepingBoard:['housekeeping','board'] as const,
 frontDesk:(date:string)=>['front-desk','board',date] as const,
 bookingOptions:['booking','options'] as const,
 bookingQuote:(p:BookingQuoteRequest)=>['booking','quote',p] as const,
 dashboard:['dashboard','summary'] as const,
 roomTimeline:(p:CalendarParams)=>['rooms','timeline',p] as const,
 reservationCalendar:(p:CalendarParams)=>['reservations','calendar',p] as const,
 reservations:(p:ListParams)=>['reservations',p] as const,
 rooms:(p:ListParams&{floor?:number})=>['rooms',p] as const,
 guests:(p:ListParams)=>['guests',p] as const,
 housekeeping:(p:ListParams)=>['housekeeping',p] as const,
 folios:(p:ListParams)=>['folios',p] as const
};
export const useHotelSettings=()=>useQuery({queryKey:queryKeys.hotelSettings,queryFn:()=>hotelApi.getHotelSettings()});
export const useReports=(p:ReportQuery,enabled:boolean)=>useQuery({queryKey:queryKeys.reports(p),queryFn:()=>hotelApi.getReports(p),enabled});
export const useMaintenanceBoard=()=>useQuery({queryKey:queryKeys.maintenanceBoard,queryFn:()=>hotelApi.getMaintenanceBoard()});
export const useHousekeepingBoard=()=>useQuery({queryKey:queryKeys.housekeepingBoard,queryFn:()=>hotelApi.getHousekeepingBoard()});
export const useFrontDeskBoard=(date:string)=>useQuery({queryKey:queryKeys.frontDesk(date),queryFn:()=>hotelApi.getFrontDeskBoard(date)});
export const useBookingOptions=()=>useQuery({queryKey:queryKeys.bookingOptions,queryFn:()=>hotelApi.getBookingOptions()});
export const useBookingQuote=(p:BookingQuoteRequest,enabled:boolean)=>useQuery({queryKey:queryKeys.bookingQuote(p),queryFn:()=>hotelApi.getBookingQuote(p),enabled});
export const useDashboard=()=>useQuery({queryKey:queryKeys.dashboard,queryFn:()=>hotelApi.getDashboard()});
export const useRoomTimeline=(p:CalendarParams)=>useQuery({queryKey:queryKeys.roomTimeline(p),queryFn:()=>hotelApi.getRoomTimeline(p)});
export const useReservationCalendar=(p:CalendarParams)=>useQuery({queryKey:queryKeys.reservationCalendar(p),queryFn:()=>hotelApi.getReservationCalendar(p)});
export const useReservations=(p:ListParams={})=>useQuery({queryKey:queryKeys.reservations(p),queryFn:()=>hotelApi.listReservations(p)});
export const useRooms=(p:ListParams&{floor?:number}={})=>useQuery({queryKey:queryKeys.rooms(p),queryFn:()=>hotelApi.listRooms(p)});
export const useGuests=(p:ListParams={})=>useQuery({queryKey:[...queryKeys.guests(p),dataMode==='api'?readSession().hotelId:'mock'],queryFn:()=>hotelApi.listGuests(p)});
export const useHousekeeping=(p:ListParams={})=>useQuery({queryKey:queryKeys.housekeeping(p),queryFn:()=>hotelApi.listHousekeeping(p)});
export const useFolios=(p:ListParams={})=>useQuery({queryKey:queryKeys.folios(p),queryFn:()=>hotelApi.listFolios(p)});
