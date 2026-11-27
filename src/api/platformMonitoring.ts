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
export function fetchPlatformMonitoring(filters:MonitoringFilters,signal?:AbortSignal){
 return getJson<{data:MonitoringSnapshot}>('/platform/monitoring',{minutes:filters.minutes,environment:filters.environment,role:filters.role,requestId:filters.requestId},signal);
}

export interface MonitoringCounts{requests:number;serverErrors:number;errors:number;frontendErrors:number;authFailures:number}
export interface MonitoringBucket{start:number;end:number;errors:number;warnings:number}
export interface MonitoringMetrics{
 state:'ready'|'partial'|'unavailable'|'not_configured';observedAt:string;minutes:number;
 counts:MonitoringCounts|null;p95:number|null;latencyState:'ready'|'no_data'|'unavailable';trend:MonitoringBucket[]|null;
}
export function fetchPlatformMetrics(filters:MonitoringFilters,signal?:AbortSignal){
 return getJson<{data:MonitoringMetrics}>('/platform/monitoring/metrics',{minutes:filters.minutes,environment:filters.environment,role:filters.role,requestId:filters.requestId},signal);
}
