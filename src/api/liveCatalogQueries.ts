import {useQuery} from '@tanstack/react-query';
import {readSession} from './session';
import {getLiveCatalogSummary,getLiveProperty,getLiveRooms,getLiveRoomTypes,type LiveRoomFilters} from './liveCatalog';

const scope=()=>readSession().hotelId??'none';
export const useLiveProperty=()=>useQuery({queryKey:['live-property',scope()],queryFn:getLiveProperty});
export const useLiveCatalogSummary=()=>useQuery({queryKey:['live-catalog',scope()],queryFn:getLiveCatalogSummary});
export const useLiveRoomTypes=()=>useQuery({queryKey:['live-room-types',scope()],queryFn:getLiveRoomTypes});
export const useLiveRooms=(filters:LiveRoomFilters)=>useQuery({
 queryKey:['live-rooms',scope(),filters],
 queryFn:()=>getLiveRooms(filters),
});
