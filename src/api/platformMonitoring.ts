import {getJson} from './http';

export interface MonitoringEvent{
 timestamp:string;event:string;level:string;environment:string;serviceRole:string;
 requestId:string|null;relatedRequestId:string|null;route:string|null;statusCode:number|null;durationMs:number|null;screen:string|null;
}
export interface MonitoringSnapshot{
 state:'ready'|'not_configured'|'unavailable';minutes:number;sampleLimit:number;sampleSize:number;
 limitReached:boolean;observedAt:string;events:MonitoringEvent[];
}
export interface MonitoringFilters{minutes:number;environment:string;role:string;requestId?:string}
export function fetchPlatformMonitoring(filters:MonitoringFilters){
 return getJson<{data:MonitoringSnapshot}>('/platform/monitoring',{minutes:filters.minutes,environment:filters.environment,role:filters.role,requestId:filters.requestId});
}
