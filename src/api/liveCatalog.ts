import {getJson} from './http';
import {hotelPath} from './session';
import type {CollectionResponse,Id,ItemResponse} from './types';

export interface LiveProperty{
 id:Id;name:string;address:string|null;contactEmail:string|null;contactPhone:string|null;
 timeZone:string;currency:string;
}
export interface LiveRoomType{id:Id;hotelId:Id;name:string;maxOccupancy:number;}
export interface LiveRoom{id:Id;hotelId:Id;number:string;floor:number|null;roomTypeId:Id;roomTypeName:string;maxOccupancy:number;}
export interface LiveCatalogSummary{
 hotelId:Id;totalRooms:number;totalRoomTypes:number;
 roomTypes:Array<{id:Id;name:string;maxOccupancy:number;roomCount:number}>;
 floors:Array<{number:number|null;roomCount:number}>;
}
export type LiveCatalogSummaryResponse={data:LiveCatalogSummary;meta:{isAvailability:false;isOccupancy:false;scope:string}};
export type LiveRoomFilters={page?:number;perPage?:number;floor?:number;search?:string};

export const getLiveProperty=()=>getJson<ItemResponse<LiveProperty>>(hotelPath(''));
export const getLiveRoomTypes=()=>getJson<{data:LiveRoomType[]}>(hotelPath('/room-types'));
export const getLiveRooms=(filters:LiveRoomFilters={})=>getJson<CollectionResponse<LiveRoom>>(
 hotelPath('/rooms'),{page:filters.page,per_page:filters.perPage,floor:filters.floor,search:filters.search});
export const getLiveCatalogSummary=()=>getJson<LiveCatalogSummaryResponse>(hotelPath('/catalog-summary'));
