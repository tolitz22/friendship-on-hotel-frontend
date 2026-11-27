import type {MonitoringMetrics} from '../../api/platformMonitoring';
export function aggregateCards(metrics:MonitoringMetrics|undefined){
 const counts=metrics?.counts;
 return {
  requests:counts?.requests??null,serverErrors:counts?.serverErrors??null,errors:counts?.errors??null,
  frontendErrors:counts?.frontendErrors??null,authFailures:counts?.authFailures??null,
  p95:metrics?.latencyState==='ready'?metrics.p95:null,
 };
}
