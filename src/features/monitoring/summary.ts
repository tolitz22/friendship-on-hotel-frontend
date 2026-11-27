import type {MonitoringEvent} from '../../api/platformMonitoring';
const errorLevels=new Set(['ERROR','CRITICAL','ALERT','EMERGENCY']);
export const isError=(e:MonitoringEvent)=>errorLevels.has(e.level);
export const isApi=(e:MonitoringEvent)=>e.event==='pms.api.request.completed';
export const isFrontend=(e:MonitoringEvent)=>e.event==='pms.frontend.error_reported';
export const isAuthFailure=(e:MonitoringEvent)=>e.event==='pms.security.login.failed';
export const isServerError=(e:MonitoringEvent)=>isApi(e)&&e.statusCode!==null&&e.statusCode>=500&&e.statusCode<=599;
export function summarizeMonitoring(events:MonitoringEvent[],observedAt:string,minutes:number){
 const requests=events.filter(isApi);
 const durations=requests.flatMap(e=>e.durationMs===null?[]:[e.durationMs]).sort((a,b)=>a-b);
 const routes=new Map<string,{count:number;total:number;max:number}>();
 for(const e of requests){
  if(!e.route||e.durationMs===null)continue;
  const entry=routes.get(e.route)??{count:0,total:0,max:0};
  entry.count++;entry.total+=e.durationMs;entry.max=Math.max(entry.max,e.durationMs);routes.set(e.route,entry);
 }
 const slowRoutes=Array.from(routes,([route,e])=>({route,count:e.count,average:Math.round(e.total/e.count),max:e.max}))
  .sort((a,b)=>b.average-a.average).slice(0,5);
 const end=Date.parse(observedAt),start=end-minutes*60000,step=(end-start)/12;
 const trend=Array.from({length:12},(_,i)=>({start:start+i*step,end:start+(i+1)*step,errors:0,warnings:0}));
 for(const e of events){
  const t=Date.parse(e.timestamp);if(!Number.isFinite(t)||t<start||t>end)continue;
  const bucket=trend[Math.min(11,Math.floor((t-start)/step))];
  if(isError(e))bucket.errors++;else if(e.level==='WARNING')bucket.warnings++;
 }
 return {requests:requests.length,errors:events.filter(isError).length,serverErrors:events.filter(isServerError).length,
  frontendErrors:events.filter(isFrontend).length,authFailures:events.filter(isAuthFailure).length,
  p95:durations.length?durations[Math.ceil(durations.length*.95)-1]:null,slowRoutes,trend};
}
