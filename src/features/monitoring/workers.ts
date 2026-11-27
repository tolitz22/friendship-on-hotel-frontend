import type {WorkerHeartbeat} from '../../api/platformWorkers';
export function formatWorkerAge(seconds:number|null){
 if(seconds===null||!Number.isFinite(seconds)||seconds<0)return '—';
 if(seconds<60)return Math.floor(seconds)+'s';
 if(seconds<3600)return Math.floor(seconds/60)+'m '+Math.floor(seconds%60)+'s';
 if(seconds<86400)return Math.floor(seconds/3600)+'h '+Math.floor(seconds%3600/60)+'m';
 return Math.floor(seconds/86400)+'d '+Math.floor(seconds%86400/3600)+'h';
}
export function pushRunStatus(start:WorkerHeartbeat|undefined,completion:WorkerHeartbeat|undefined){
 if(!start||!completion||start.state==='unknown'||completion.state==='unknown')return 'Unknown';
 if(!start.observedAt)return 'Not observed';
 if(!completion.observedAt||Date.parse(start.observedAt)>Date.parse(completion.observedAt))return start.state==='stale'?'Completion overdue':'Awaiting completion';
 if(completion.outcome==='disabled')return 'Delivery disabled';
 if(completion.outcome==='failed')return 'Last run failed';
 if(completion.outcome==='succeeded')return 'Last run completed';
 return 'Unknown';
}
