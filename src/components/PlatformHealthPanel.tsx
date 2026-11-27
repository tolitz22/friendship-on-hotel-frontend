import {ApiError} from '../api/http';
import {useEffect,useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {Activity,Database,Layers,Server,GitBranch,RefreshCw,Clock3} from 'lucide-react';
import {fetchPlatformHealth} from '../api/platformHealth';
import {appendHealthObservation,formatDatabaseSize,type HealthObservation,type ObservationState} from '../features/monitoring/health';
import './PlatformHealthPanel.css';
const labels:Record<ObservationState,string>={healthy:'Healthy',degraded:'Degraded',unavailable:'Unavailable',not_configured:'Not configured',unknown:'Not checked'};
function Status({state}:{state:ObservationState}){return <span className={'platform-health-status state-'+state}><i aria-hidden="true"/>{labels[state]}</span>}
const ms=(value:number|null|undefined)=>value===null||value===undefined?'—':value.toLocaleString()+' ms';
export function PlatformHealthPanel({userId}:{userId:string}){
 const [history,setHistory]=useState<HealthObservation[]>([]);
 const [auto,setAuto]=useState(true);
 const query=useQuery({queryKey:['platform-health',userId],queryFn:fetchPlatformHealth,retry:false,gcTime:0,staleTime:0,refetchOnWindowFocus:false,refetchInterval:auto?60000:false,refetchIntervalInBackground:false});
 const health=query.isError?undefined:query.data?.data;
 useEffect(()=>{
  if(query.isError&&query.errorUpdatedAt){setHistory(h=>appendHealthObservation(h,{at:query.errorUpdatedAt,state:'unavailable',database:'unknown',cache:'unknown',grafana:'unknown'}));}
  else if(query.data&&query.dataUpdatedAt){const d=query.data.data;setHistory(h=>appendHealthObservation(h,{at:query.dataUpdatedAt,state:d.state,database:d.database.state,cache:d.cache.state,grafana:d.grafana.state}));}
 },[query.data,query.dataUpdatedAt,query.isError,query.errorUpdatedAt]);
 const services=[
  {name:'Backend API',Icon:Server,state:health?.backend.state??(query.isError?'unavailable':'unknown'),detail:health?'Health endpoint responded · '+health.backend.apiVersion:'Endpoint not confirmed',metric:ms(health?query.data?.roundTripMs:null),note:'Browser round-trip including probes'},
  {name:'Database',Icon:Database,state:health?.database.state??'unknown',detail:health?health.database.driver.toUpperCase()+' · SELECT 1':'Not checked',metric:ms(health?.database.latencyMs),note:health?.database.sizeState==='ready'?'Database size: '+formatDatabaseSize(health.database.sizeBytes):health?.database.sizeState==='unsupported'?'Size measurement unsupported':'Database size unavailable'},
  {name:'Cache',Icon:Layers,state:health?.cache.state??'unknown',detail:health?health.cache.driver+' · '+(health.cache.scope==='local'?'instance-local':'configured store'):'Not checked',metric:ms(health?.cache.latencyMs),note:'Temporary read/write probe'},
  {name:'Grafana Cloud',Icon:Activity,state:health?.grafana.state??'unknown',detail:'Read connection',metric:ms(health?.grafana.latencyMs),note:'Independent from log delivery'},
 ] as const;
 return <section className="panel platform-health" aria-label="System health">
  <div className="platform-health-heading"><div><h2>System health</h2><p>Current API instance and infrastructure checks</p></div><div className="platform-health-actions"><label><input type="checkbox" checked={auto} onChange={e=>setAuto(e.target.checked)}/> Auto refresh</label><button type="button" className="btn-inline" disabled={query.isFetching} onClick={()=>void query.refetch()}><RefreshCw size={15} className={query.isFetching?'platform-spin':''}/> Check now</button></div></div>
  <div className="platform-health-overview"><Status state={health?.state??(query.isError?'unavailable':'unknown')}/><span>{health?'Checked '+new Date(health.observedAt).toLocaleString():query.isError?'Health endpoint request failed':'Waiting for first check'}</span></div>
  {query.isError&&<p className="platform-health-alert" role="alert">{query.error instanceof ApiError&&query.error.status===429?'Health checks are temporarily rate limited. Wait before checking again.':'Could not complete the health request. Network, authentication or backend failure may be responsible. Individual services cannot be assessed.'}</p>}
  <div className="platform-health-grid">{services.map(({name,Icon,state,detail,metric,note})=><article className="platform-health-service" key={name}><div className="platform-health-service-top"><Icon size={18}/><Status state={state}/></div><h3>{name}</h3><p>{detail}</p><strong>{metric}</strong><small>{note}</small></article>)}</div>
  <div className="platform-health-deploy"><GitBranch size={19}/><div><h3>Current deployment</h3><p>{health?health.deployment.environment+' · '+health.deployment.serviceRole+' · '+(health.deployment.revision?.slice(0,12)??'Revision unavailable'):'Not checked'}</p></div>{health&&<span className={'platform-health-debug'+(health.deployment.debug?' debug-on':'')}>Debug {health.deployment.debug?'enabled':'disabled'}</span>}</div>
  <details className="platform-health-history"><summary><Clock3 size={15}/> Recent health checks ({history.length})</summary><p>Last 20 observations in this open dashboard only. Not persistent uptime history.</p><div className="table-scroll"><table><thead><tr><th>Checked</th><th>Overall</th><th>Database</th><th>Cache</th><th>Grafana</th></tr></thead><tbody>{history.map(h=><tr key={h.at}><td>{new Date(h.at).toLocaleTimeString()}</td><td>{labels[h.state]}</td><td>{labels[h.database]}</td><td>{labels[h.cache]}</td><td>{labels[h.grafana]}</td></tr>)}</tbody></table></div></details>
  <p className="platform-health-footnote">Point-in-time checks, not uptime guarantees. Auto refresh runs every minute while visible. Database size is logical usage, not Railway disk capacity.</p>
 </section>;
}
