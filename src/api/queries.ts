import {useQuery} from '@tanstack/react-query';
import {hotelApi} from './index';import type {BookingQuoteRequest,CalendarParams,ListParams} from './types';
export const queryKeys={
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
export const useBookingOptions=()=>useQuery({queryKey:queryKeys.bookingOptions,queryFn:()=>hotelApi.getBookingOptions()});
export const useBookingQuote=(p:BookingQuoteRequest,enabled:boolean)=>useQuery({queryKey:queryKeys.bookingQuote(p),queryFn:()=>hotelApi.getBookingQuote(p),enabled});
export const useDashboard=()=>useQuery({queryKey:queryKeys.dashboard,queryFn:()=>hotelApi.getDashboard()});
export const useRoomTimeline=(p:CalendarParams)=>useQuery({queryKey:queryKeys.roomTimeline(p),queryFn:()=>hotelApi.getRoomTimeline(p)});
export const useReservationCalendar=(p:CalendarParams)=>useQuery({queryKey:queryKeys.reservationCalendar(p),queryFn:()=>hotelApi.getReservationCalendar(p)});
export const useReservations=(p:ListParams={})=>useQuery({queryKey:queryKeys.reservations(p),queryFn:()=>hotelApi.listReservations(p)});
export const useRooms=(p:ListParams&{floor?:number}={})=>useQuery({queryKey:queryKeys.rooms(p),queryFn:()=>hotelApi.listRooms(p)});
export const useGuests=(p:ListParams={})=>useQuery({queryKey:queryKeys.guests(p),queryFn:()=>hotelApi.listGuests(p)});
export const useHousekeeping=(p:ListParams={})=>useQuery({queryKey:queryKeys.housekeeping(p),queryFn:()=>hotelApi.listHousekeeping(p)});
export const useFolios=(p:ListParams={})=>useQuery({queryKey:queryKeys.folios(p),queryFn:()=>hotelApi.listFolios(p)});
