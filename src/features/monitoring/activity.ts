import type {MonitoringEvent} from '../../api/platformMonitoring';
const routes=new Set(['api/v1/platform/monitoring','api/v1/platform/monitoring/metrics','api/v1/platform/health','api/v1/platform/workers']);
export function monitoringRequestIds(events:MonitoringEvent[]){
 return new Set(events.filter(e=>e.route&&routes.has(e.route)).flatMap(e=>e.requestId?[e.requestId]:[]));
}
export function isMonitoringActivity(event:MonitoringEvent,ids:ReadonlySet<string>){
 return !!(event.route&&routes.has(event.route))||event.event==='pms.security.platform.monitoring_viewed'||
  (event.event==='pms.security.access.rate_limited'&&!!event.requestId&&ids.has(event.requestId));
}
