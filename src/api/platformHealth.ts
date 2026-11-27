import {getJson} from './http';
export type HealthState='healthy'|'degraded'|'unavailable'|'not_configured';
export interface PlatformHealth{
 observedAt:string;state:'healthy'|'degraded';
 backend:{state:'healthy';apiVersion:string};
 database:{state:HealthState;driver:string;latencyMs:number;sizeBytes:number|null;sizeState:'ready'|'unsupported'|'unavailable'};
 cache:{state:HealthState;driver:string;latencyMs:number;scope:'local'|'configured'};
 grafana:{state:HealthState;latencyMs:number|null};
 deployment:{environment:string;serviceRole:string;revision:string|null;debug:boolean};
}
export async function fetchPlatformHealth(){
 const start=performance.now();
 const response=await getJson<{data:PlatformHealth}>('/platform/health');
 return {data:response.data,roundTripMs:Math.round(performance.now()-start)};
}
