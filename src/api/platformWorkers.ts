import {getJson} from './http';
export type HeartbeatState='recent'|'stale'|'never_seen'|'unknown';
export interface WorkerHeartbeat{
 state:HeartbeatState;observedAt:string|null;ageSeconds:number|null;
 outcome:'observed'|'started'|'succeeded'|'failed'|'disabled'|null;serviceRole:string|null;
}
export interface PlatformWorkers{
 observedAt:string;staleAfterSeconds:number;
 heartbeats:Record<'scheduler'|'queue_worker'|'push_started'|'push_completed',WorkerHeartbeat>;
 push:{state:'ready'|'unavailable';ready:number|null;delayed:number|null;processing:number|null;expiredLeases:number|null;sent24h:number|null;failed24h:number|null;oldestReadySeconds:number|null};
 queue:{state:'ready'|'unavailable'|'not_applicable';driver:string;ready:number|null;delayed:number|null;reserved:number|null;expiredReservations:number|null;oldestReadySeconds:number|null;failed24h:number|null;failedState:'ready'|'unavailable'|'not_configured'};
}
export function fetchPlatformWorkers(){return getJson<{data:PlatformWorkers}>('/platform/workers');}
