import {useEffect,useState,type FormEvent} from 'react';
import {useQuery} from '@tanstack/react-query';
import {Activity,AlertTriangle,Clock3,Globe2,LogOut,Moon,RefreshCw,Search,ShieldCheck,Sun,Terminal,Server} from 'lucide-react';
import {useHotelAuth} from '../components/AuthProvider';
import {useTheme} from '../components/ThemeProvider';
import {fetchPlatformMonitoring,fetchPlatformMetrics,type MonitoringEvent} from '../api/platformMonitoring';
import {isApi,isAuthFailure,isError,isFrontend,summarizeMonitoring} from '../features/monitoring/summary';
import {aggregateCards} from '../features/monitoring/aggregate';
import './SuperAdminDashboard.css';
import {ApiError} from '../api/http';
import {isMonitoringActivity,monitoringRequestIds} from '../features/monitoring/activity';
import {PlatformHealthPanel} from '../components/PlatformHealthPanel';
import {PlatformWorkersPanel} from '../components/PlatformWorkersPanel';

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const time=(s:string)=>new Date(s).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit',second:'2-digit'});
const eventName=(e:MonitoringEvent)=>e.event.replace(/^pms\./,'').replace(/[._]/g,' ');
const kinds=['all','monitoring','other','errors','requests','frontend','auth'] as const;
type Kind=typeof kinds[number];
const matches=(e:MonitoringEvent,k:Kind,monitoring:boolean)=>k==='all'||(k==='monitoring'&&monitoring)||(k==='other'&&!monitoring)||(k==='errors'&&isError(e))||(k==='requests'&&isApi(e))||(k==='frontend'&&isFrontend(e))||(k==='auth'&&isAuthFailure(e));
export function SuperAdminDashboard(){
 const {user,signOut,pending}=useHotelAuth();
 const {theme,toggle}=useTheme();
 const [minutes,setMinutes]=useState(60),[environment,setEnvironment]=useState('all'),[role,setRole]=useState('all');
 const [input,setInput]=useState(''),[requestId,setRequestId]=useState(''),[searchError,setSearchError]=useState('');
 const [kind,setKind]=useState<Kind>('all'),[page,setPage]=useState(0);
 const authorized=user?.platformAdmin===true&&!user.mustChangePassword;
 const [applied,setApplied]=useState({minutes,environment,role,requestId});
 const [cooldownUntil,setCooldownUntil]=useState(0);
 const [refreshUntil,setRefreshUntil]=useState(0);
 const settling=applied.minutes!==minutes||applied.environment!==environment||applied.role!==role||applied.requestId!==requestId;
 useEffect(()=>{
  const timer=window.setTimeout(()=>setApplied({minutes,environment,role,requestId}),500);
  return ()=>window.clearTimeout(timer);
 },[minutes,environment,role,requestId]);
 const cooling=cooldownUntil>0;
 useEffect(()=>{
  if(!cooldownUntil)return;
  const timer=window.setTimeout(()=>setCooldownUntil(0),Math.max(0,cooldownUntil-Date.now()));
  return ()=>window.clearTimeout(timer);
 },[cooldownUntil]);
 useEffect(()=>{
  if(!refreshUntil)return;
  const timer=window.setTimeout(()=>setRefreshUntil(0),Math.max(0,refreshUntil-Date.now()));
  return ()=>window.clearTimeout(timer);
 },[refreshUntil]);
 const filters={...applied,requestId:applied.requestId||undefined};
 const query=useQuery({queryKey:['platform-monitoring',user?.id,applied.minutes,applied.environment,applied.role,applied.requestId],
  queryFn:({signal})=>fetchPlatformMonitoring(filters,signal),
  enabled:authorized&&!settling&&!cooling,retry:false,gcTime:120000,staleTime:30000,refetchOnWindowFocus:false});
 const metricsQuery=useQuery({queryKey:['platform-monitoring-metrics',user?.id,applied.minutes,applied.environment,applied.role,applied.requestId],
  queryFn:({signal})=>fetchPlatformMetrics(filters,signal),
  enabled:authorized&&!settling&&!cooling,retry:false,gcTime:120000,staleTime:30000,refetchOnWindowFocus:false});
 useEffect(()=>{
  const errors=[{error:query.error,at:query.errorUpdatedAt},{error:metricsQuery.error,at:metricsQuery.errorUpdatedAt}];
  const until=Math.max(0,...errors.map(({error,at})=>error instanceof ApiError&&error.status===429?at+(error.retryAfterSeconds??60)*1000:0));
  if(until>Date.now())setCooldownUntil(current=>Math.max(current,until));
 },[query.error,query.errorUpdatedAt,metricsQuery.error,metricsQuery.errorUpdatedAt]);
 const metrics=settling||metricsQuery.isError?undefined:metricsQuery.data?.data;
 const cards=aggregateCards(metrics);
 const trend=metrics?.trend;
 const data=settling||query.isError?undefined:query.data?.data;
 const ready=data?.state==='ready';
 const summary=ready?summarizeMonitoring(data.events,data.observedAt,data.minutes):null;
 const ids=monitoringRequestIds(ready?data.events:[]);
 const filtered=ready?data.events.filter(e=>matches(e,kind,isMonitoringActivity(e,ids))):[];
 const pageCount=Math.max(1,Math.ceil(filtered.length/20));
 const currentPage=Math.min(page,pageCount-1);
 const submit=(e:FormEvent)=>{e.preventDefault();const v=input.trim().toLowerCase();if(v&&!uuid.test(v)){setSearchError('Enter a valid request UUID.');return;}setSearchError('');setRequestId(v);setPage(0);};
 if(!authorized)return <div className="auth-shell"><div className="auth-card"><h1>Access restricted</h1><p>This dashboard requires a dedicated platform administrator account.</p><a className="btn-inline" href="/">Return to sign-in or hotel workspace</a></div></div>;
 return <div className="platform-shell">
  <header className="platform-header"><div className="platform-brand"><span className="platform-mark"><ShieldCheck size={23}/></span><div><strong>Friendship On Hotel</strong><small>SUPER ADMIN · PRIVATE WORKSPACE</small></div></div>
   <div className="platform-account"><span className="platform-user">{user?.name}</span><button className="icon-btn" aria-label="Toggle theme" onClick={toggle}>{theme==='light'?<Moon size={17}/>:<Sun size={17}/>}</button><button className="btn-inline platform-signout" disabled={pending} onClick={()=>void signOut()}><LogOut size={16}/> Sign out</button></div>
  </header>
  <main className="platform-main">
   <div className="platform-title"><div><span className="eyebrow">PLATFORM OPERATIONS</span><h1>System monitoring</h1><p>Backend, worker and frontend diagnostics across the platform.</p></div><button className="btn-primary" disabled={settling||cooling||refreshUntil>0||query.isFetching||metricsQuery.isFetching} onClick={()=>{setRefreshUntil(Date.now()+30000);void query.refetch({cancelRefetch:false});void metricsQuery.refetch({cancelRefetch:false});}}><RefreshCw size={16} className={query.isFetching||metricsQuery.isFetching?'platform-spin':''}/> Refresh</button></div>
   {user&&<PlatformHealthPanel key={user.id} userId={user.id}/>}
   {user&&<PlatformWorkersPanel key={user.id} userId={user.id}/>}
   <div className="platform-filters panel">
    <label>Time range<select value={minutes} onChange={e=>{setMinutes(Number(e.target.value));setPage(0);}}><option value={15}>Last 15 minutes</option><option value={60}>Last hour</option><option value={360}>Last 6 hours</option><option value={1440}>Last 24 hours</option></select></label>
    <label>Environment<select value={environment} onChange={e=>{setEnvironment(e.target.value);setPage(0);}}>{['all','staging','production','local','testing','other'].map(v=><option key={v} value={v}>{v==='all'?'All environments':v}</option>)}</select></label>
    <label>Service<select value={role} onChange={e=>{setRole(e.target.value);setPage(0);}}>{['all','backend','worker','scheduler','unspecified'].map(v=><option key={v} value={v}>{v==='all'?'All services':v}</option>)}</select></label>
    <form onSubmit={submit} className="platform-search"><label>Request ID<input value={input} onChange={e=>setInput(e.target.value)} maxLength={36} placeholder="Search request UUID" aria-invalid={!!searchError}/></label><button className="btn-inline" aria-label="Search request ID"><Search size={17}/></button>{requestId&&<button type="button" className="btn-inline" onClick={()=>{setInput('');setRequestId('');setSearchError('');setPage(0);}}>Clear</button>}</form>
    {searchError&&<p role="alert" className="platform-error">{searchError}</p>}
   </div>
   {cooling&&<div className="notice" role="status"><strong>Monitoring temporarily rate limited.</strong> Please wait until the cooldown ends. Queries resume automatically; no need to keep refreshing.</div>}
   {settling?<div className="panel query-feedback" role="status">Applying filters…</div>:cooling?null:query.isPending?<div className="panel query-feedback" role="status">Loading monitoring data…</div>:query.isError?<div className="panel query-feedback" role="alert">Monitoring access or request failed. Refresh your session and try again.</div>:data?.state==='not_configured'?<div className="panel platform-state" role="status"><Terminal size={25}/><h2>Connect Grafana</h2><p>The private monitoring read connection has not been configured on the backend. Existing log ingestion is unaffected.</p><p>Configure the Grafana stack URL, Loki data source UID and read-only service account token in Railway.</p></div>:data?.state==='unavailable'?<div className="panel platform-state" role="alert"><AlertTriangle size={25}/><h2>Monitoring source unavailable</h2><p>Check the Grafana read credentials, data source and network. This is not evidence that the PMS is down.</p></div>:null}
   <section aria-label="Aggregate monitoring metrics">
    <div className="platform-coverage"><span><Activity size={15}/> Full-window exported-log metrics</span><span>{settling?'Applying filters…':cooling?'Rate limited':metricsQuery.isPending?'Loading…':metricsQuery.isError?'Metrics request failed':metrics?.state==='ready'?'Updated '+time(metrics.observedAt):metrics?.state==='partial'?'Some metrics unavailable':metrics?.state==='not_configured'?'Not configured':'Metrics unavailable'}</span></div>
    <p className="platform-note">Counts and latency cover matching exported logs in the selected time window, not all real platform traffic or uptime. Warning-only export omits routine API traffic. Aggregate totals include monitoring activity; successful queries may be cached for 30 seconds. {requestId?'Results are restricted to the searched request.':''}</p>
    <div className="platform-stats">
     {([{label:'API requests',value:cards.requests,icon:Globe2},{label:'HTTP 5xx',value:cards.serverErrors,icon:AlertTriangle},{label:'Error-level logs',value:cards.errors,icon:Server},{label:'P95 latency',value:cards.p95===null?null:cards.p95+' ms',icon:Clock3},{label:'Frontend errors',value:cards.frontendErrors,icon:Activity},{label:'Failed sign-ins',value:cards.authFailures,icon:ShieldCheck}]).map(({label,value,icon:Icon})=><article className="stat platform-stat" key={label}><div className="stat-header">{label}<Icon size={18} className="stat-icon"/></div><strong>{typeof value==='number'?value.toLocaleString():value??'—'}</strong><small>{value!==null?'Full selected window':metricsQuery.isPending?'Loading':label==='P95 latency'&&metrics?.latencyState==='no_data'?'No duration data':'Unavailable'}</small></article>)}
    </div>
    <div className="platform-charts">
     <section className="panel"><div className="panel-title"><h3>Warning & error trend</h3><small>Full selected window</small></div>{trend&&trend.length>0?<><div className="platform-legend"><span><i className="warn"/> Warnings</span><span><i className="err"/> Errors</span></div><div className="platform-bars" aria-label="Exported warnings and errors over time">{trend.map(b=>{const max=Math.max(1,...trend.map(x=>x.errors+x.warnings));return <div className="platform-bar-slot" key={b.start} title={time(new Date(b.start).toISOString())+' — '+b.warnings+' warnings, '+b.errors+' errors'}><div className="platform-bar-stack" style={{height:((b.errors+b.warnings)/max*100)+'%'}}><div className="err" style={{flex:b.errors}}/><div className="warn" style={{flex:b.warnings}}/></div></div>;})}</div><div className="platform-axis"><span>{time(new Date(trend[0].start).toISOString())}</span><span>{time(new Date(trend[trend.length-1].end).toISOString())}</span></div>{trend.every(b=>b.errors+b.warnings===0)&&<p className="empty-state">No matching exported warnings or errors.</p>}</>:<p className="empty-state">{metricsQuery.isPending?'Loading trend…':'Trend unavailable.'}</p>}</section>
     <section className="panel"><div className="panel-title"><h3>Slow API routes</h3><small>Recent sample only</small></div>{!summary?<p className="empty-state">Recent event sample unavailable.</p>:summary.slowRoutes.length===0?<p className="empty-state">No request duration records in this sample.</p>:<div className="platform-routes">{summary.slowRoutes.map(r=><div key={r.route}><span className="platform-route">{r.route}<small>{r.count} requests · max {r.max} ms</small></span><strong>{r.average} ms</strong></div>)}</div>}</section>
    </div>
   </section>
   {ready&&<><div className="platform-coverage"><span>Recent event list · {data.sampleSize} records</span><span>Updated {time(data.observedAt)} · {data.limitReached?'Sample limit reached':'Up to '+data.sampleLimit+' recent records'}</span></div>
    {data.sampleSize===0&&<p className="platform-note">No matching exported logs in the event list. This is not proof of system health.</p>}
    <section className="panel platform-events"><div className="panel-title"><div><h3>Recent events</h3><small>{filtered.length} matching records</small></div><label>Event type <select value={kind} onChange={e=>{setKind(e.target.value as Kind);setPage(0);}}>{kinds.map(k=><option key={k} value={k}>{k==='all'?'All events':k==='monitoring'?'Monitoring activity':k==='other'?'Other events':k}</option>)}</select></label></div>
     {filtered.length===0?<p className="empty-state">No events match the current selection.</p>:<><div className="table-scroll"><table><thead><tr><th>Time</th><th>Severity</th><th>Event</th><th>Service / environment</th><th>HTTP / duration</th><th>Request ID</th></tr></thead><tbody>{filtered.slice(currentPage*20,currentPage*20+20).map((e,i)=><tr key={e.timestamp+e.event+i}><td>{time(e.timestamp)}<span className="cell-note">{new Date(e.timestamp).toLocaleDateString()}</span></td><td><span className={'platform-level '+(isError(e)?'level-error':e.level==='WARNING'?'level-warning':'')}>{e.level}</span></td><td><strong>{eventName(e)}</strong>{isMonitoringActivity(e,ids)&&<span className="cell-note">Platform monitoring</span>}{(e.route||e.screen)&&<span className="cell-note platform-route">{e.route||e.screen}</span>}</td><td>{e.serviceRole}<span className="cell-note">{e.environment}</span></td><td>{e.statusCode??'—'}{e.durationMs!==null&&<span className="cell-note">{e.durationMs} ms</span>}</td><td>{(e.requestId||e.relatedRequestId)?<button className="btn-inline platform-id" title={e.requestId||e.relatedRequestId||''} onClick={()=>{const id=e.requestId||e.relatedRequestId||'';setInput(id);setRequestId(id);setSearchError('');setPage(0);}}>Search { (e.requestId||e.relatedRequestId)?.slice(0,8)}…</button>:'—'}</td></tr>)}</tbody></table></div><div className="platform-pagination"><button className="btn-inline" disabled={currentPage===0} onClick={()=>setPage(currentPage-1)}>Previous</button><span>Page {currentPage+1} of {pageCount}</span><button className="btn-inline" disabled={currentPage+1>=pageCount} onClick={()=>setPage(currentPage+1)}>Next</button></div></>}
    </section>
   </>}
   <footer className="platform-footer"><ShieldCheck size={15}/> Read-only platform diagnostics · No hotel operations or financial records are modified.</footer>
  </main>
 </div>;
}
