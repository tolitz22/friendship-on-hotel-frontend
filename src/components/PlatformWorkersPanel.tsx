import {ApiError} from '../api/http';
import {useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {Bell,Clock3,Cpu,RefreshCw,Timer} from 'lucide-react';
import {fetchPlatformWorkers,type HeartbeatState,type WorkerHeartbeat} from '../api/platformWorkers';
import {formatWorkerAge,pushRunStatus} from '../features/monitoring/workers';
import './PlatformWorkersPanel.css';
const label:Record<HeartbeatState,string>={recent:'Recently observed',stale:'Stale',never_seen:'Never seen',unknown:'Unknown'};
const count=(n:number|null|undefined)=>n===null||n===undefined?'—':n.toLocaleString();
function Pulse({name,description,heartbeat}:{name:string;description:string;heartbeat?:WorkerHeartbeat}){
 const state=heartbeat?.state??'unknown';
 return <article className="platform-worker-card"><div className="platform-worker-card-heading"><h3>{name}</h3><span className={'platform-worker-state '+state}>{label[state]}</span></div><p>{description}</p><strong>{formatWorkerAge(heartbeat?.ageSeconds??null)}</strong><small>{heartbeat?.observedAt?'Last observed '+new Date(heartbeat.observedAt).toLocaleString():'No confirmed observation'}{heartbeat?.serviceRole?' · '+heartbeat.serviceRole:''}</small></article>;
}
function Metric({name,value,warning=false}:{name:string;value:string;warning?:boolean}){
 return <div className="platform-worker-metric"><span>{name}</span><strong className={warning?'platform-worker-warning':''}>{value}</strong></div>;
}
export function PlatformWorkersPanel({userId}:{userId:string}){
 const [auto,setAuto]=useState(true);
 const query=useQuery({queryKey:['platform-workers',userId],queryFn:fetchPlatformWorkers,retry:false,gcTime:0,staleTime:0,refetchOnWindowFocus:false,refetchInterval:auto?60000:false,refetchIntervalInBackground:false});
 const data=query.isError?undefined:query.data?.data;
 const push=data?.push,queue=data?.queue;
 const start=data?.heartbeats.push_started,completed=data?.heartbeats.push_completed;
 const run=pushRunStatus(start,completed);
 return <section className="panel platform-workers" aria-label="Worker and scheduler monitoring">
  <div className="platform-worker-heading"><div><h2>Background processing</h2><p>Scheduler, push delivery and Laravel queue diagnostics</p></div><div className="platform-worker-actions"><label><input type="checkbox" checked={auto} onChange={e=>setAuto(e.target.checked)}/> Auto refresh</label><button type="button" className="btn-inline" disabled={query.isFetching} onClick={()=>void query.refetch()}><RefreshCw size={15} className={query.isFetching?'platform-spin':''}/> Check now</button></div></div>
  <p className="platform-worker-note">{query.isError?(query.error instanceof ApiError&&query.error.status===429?'Worker checks are temporarily rate limited. Wait before checking again.':'Worker diagnostics unavailable. Check API and database connectivity.'):data?'Checked '+new Date(data.observedAt).toLocaleString()+' · Heartbeat stale after '+formatWorkerAge(data.staleAfterSeconds):'Waiting for first observation'}</p>
  <div className="platform-worker-pulses"><Pulse name="Scheduler" description="Scheduled task activity" heartbeat={data?.heartbeats.scheduler}/><Pulse name="Laravel queue worker" description="Queue polling and job attempts" heartbeat={data?.heartbeats.queue_worker}/><article className="platform-worker-card"><div className="platform-worker-card-heading"><h3>Push delivery command</h3><Bell size={16}/></div><p>{run}</p><strong>{formatWorkerAge(completed?.ageSeconds??null)}</strong><small>Last started: {start?.observedAt?new Date(start.observedAt).toLocaleString():'—'}</small><small>Last completed: {completed?.observedAt?new Date(completed.observedAt).toLocaleString():'—'}{completed?.serviceRole?' · '+completed.serviceRole:''}</small></article></div>
  <div className="platform-worker-queues"><article className="platform-worker-card"><div className="platform-worker-card-heading"><h3><Bell size={16}/> Push notification outbox</h3><small>{push?.state==='ready'?'Database observed':'Unavailable'}</small></div>
   <div className="platform-worker-metrics"><Metric name="Due pending" value={count(push?.ready)}/><Metric name="Delayed" value={count(push?.delayed)}/><Metric name="Processing" value={count(push?.processing)}/><Metric name="Expired leases" value={count(push?.expiredLeases)} warning={(push?.expiredLeases??0)>0}/><Metric name="Sent · 24h" value={count(push?.sent24h)}/><Metric name="Failed · 24h" value={count(push?.failed24h)} warning={(push?.failed24h??0)>0}/></div><p className="platform-worker-age"><Timer size={14}/> Oldest due work: {formatWorkerAge(push?.oldestReadySeconds??null)}</p><small>Retained delivery records across properties. Due pending may include expired work awaiting recovery.</small></article>
   <article className="platform-worker-card"><div className="platform-worker-card-heading"><h3><Cpu size={16}/> Laravel job queue</h3><small>{queue?.driver??'Unknown driver'}</small></div>{queue?.state==='not_applicable'?<p className="platform-worker-note">Sync queue: no separate asynchronous Laravel jobs table is expected. Scheduled push delivery is monitored separately.</p>:<div className="platform-worker-metrics"><Metric name="Ready" value={count(queue?.ready)}/><Metric name="Delayed" value={count(queue?.delayed)}/><Metric name="Reserved" value={count(queue?.reserved)}/><Metric name="Expired reservations" value={count(queue?.expiredReservations)} warning={(queue?.expiredReservations??0)>0}/></div>}<div className="platform-worker-metrics"><Metric name="Failed jobs · 24h" value={count(queue?.failed24h)} warning={(queue?.failed24h??0)>0}/><Metric name="Oldest ready" value={formatWorkerAge(queue?.oldestReadySeconds??null)}/></div><small>{queue?.failedState==='not_configured'?'Failed-job persistence is not configured.':queue?.failedState==='unavailable'?'Failed-job store unavailable.':'Counts reflect the API’s configured queue store.'}</small></article></div>
  <p className="platform-worker-note platform-worker-foot"><Clock3 size={14}/> Heartbeats are last observations, not per-replica uptime. Long-running tasks may appear stale. Push command activity includes manual runs; counters do not guarantee device receipt.</p>
 </section>;
}
