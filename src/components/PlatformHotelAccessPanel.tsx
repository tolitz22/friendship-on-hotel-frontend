import {useRef,useState,type FormEvent} from 'react';
import {useQuery} from '@tanstack/react-query';
import {X,ShieldAlert,RefreshCw} from 'lucide-react';
import {ApiError} from '../api/http';
import {fetchHotelAccess,changeHotelAccess,accessTransitions,accessLabels,type HotelAccessState} from '../api/platformHotelAccess';
import './PlatformHotelAccessPanel.css';
const explanation:Record<HotelAccessState,string>={active:'Restore normal hotel operations. Subscription status and capacity limits do not change.',restricted:'Prevent new individual and group bookings and group holds. Existing stays, extensions, checkout and financial operations continue.',suspended:'Block routine hotel write requests. Authorized historical reads remain available. Review all outstanding obligations before proceeding.'};
export function PlatformHotelAccessPanel({hotelId,hotelName,userId,onClose,onSaved}:{hotelId:string;hotelName:string;userId:string;onClose:()=>void;onSaved:()=>void}){
 const [page,setPage]=useState(1),[target,setTarget]=useState<HotelAccessState|null>(null),[reason,setReason]=useState(''),[confirmed,setConfirmed]=useState(false),[clearance,setClearance]=useState(false),[saving,setSaving]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const busy=useRef(false);
 const query=useQuery({queryKey:['platform-hotel-access',userId,hotelId,page],queryFn:({signal})=>fetchHotelAccess(hotelId,page,signal),retry:false,gcTime:0,refetchOnWindowFocus:false});
 const data=query.isError?undefined:query.data?.data;
 const blocked=!!data&&Object.values(data.blockers).some(n=>n>0);
 function reset(){setTarget(null);setReason('');setConfirmed(false);setClearance(false);setError('');}
 async function submit(e:FormEvent<HTMLFormElement>){
  e.preventDefault();if(!data||!target||busy.current||!confirmed||reason.trim().length<10||!accessTransitions(data.state).includes(target)||(target==='suspended'&&(blocked||!clearance)))return;
  busy.current=true;setSaving(true);setError('');setNotice('');
  try{const result=await changeHotelAccess(hotelId,{state:target,revision:data.revision,reason:reason.trim(),confirmed:true,...(target==='suspended'?{clearanceConfirmed:true}:{})});reset();setNotice('Access updated: '+accessLabels[result.data.state]);onSaved();setPage(1);await query.refetch();}
  catch(failure){setError(failure instanceof ApiError?(failure.fieldErrors?Object.values(failure.fieldErrors).flat()[0]??failure.message:failure.message):'Unable to confirm the change. Refresh before retrying.');if(failure instanceof ApiError&&failure.status===409){setConfirmed(false);setClearance(false);void query.refetch();}}
  finally{busy.current=false;setSaving(false);}
 }
 return <section className="panel hotel-access-panel" aria-label="Hotel access management"><div className="panel-title"><div><h2>Hotel access</h2><p>{hotelName}</p></div><button className="icon-btn" disabled={saving} onClick={onClose} aria-label="Close hotel access"><X size={18}/></button></div>
 {query.isPending?<p role="status">Checking hotel access…</p>:query.isError?<p role="alert">Hotel access information unavailable. Refresh and try again.</p>:data&&<>
 <div className="hotel-access-state"><ShieldAlert size={18}/><strong>{accessLabels[data.state]}</strong><span>{explanation[data.state]}</span></div>
 <div className="hotel-access-blockers"><div><small>Outstanding reservations</small><strong>{data.blockers.openReservations}</strong></div><div><small>Active group holds</small><strong>{data.blockers.activeHolds}</strong></div><div><small>Unreconciled shifts</small><strong>{data.blockers.unreconciledShifts}</strong></div></div>
 {blocked&&<p className="platform-note">Suspension is blocked until these outstanding items are resolved.</p>}
 <div className="hotel-access-actions">{accessTransitions(data.state).map(state=><button key={state} type="button" className="btn-inline" disabled={saving||(state==='suspended'&&blocked)} onClick={()=>{reset();setNotice('');setTarget(state);}}>{state==='active'?'Reactivate':state==='restricted'?'Restrict bookings':'Suspend operations'}</button>)}<button className="btn-inline" disabled={query.isFetching||saving} onClick={()=>{reset();void query.refetch();}}><RefreshCw size={14}/> Refresh checks</button></div>
 {target&&<form className="hotel-access-confirmation" onSubmit={e=>void submit(e)}><fieldset disabled={saving}><h3>Change access to {accessLabels[target]}</h3><p>{explanation[target]}</p><label>Reason for change<textarea required minLength={10} maxLength={500} rows={3} value={reason} onChange={e=>setReason(e.target.value)}/></label><label className="hotel-access-check"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/> I confirm the access change for {hotelName}.</label>{target==='suspended'&&<label className="hotel-access-check"><input type="checkbox" checked={clearance} onChange={e=>setClearance(e.target.checked)}/> I have verified financial obligations, guest service, ongoing tasks and integrations are cleared, and selected a quiet maintenance window.</label>}{error&&<p className="platform-error" role="alert">{error}</p>}<div className="hotel-access-actions"><button type="button" className="btn-inline" onClick={reset}>Cancel</button><button type="submit" className="btn-primary" disabled={!confirmed||reason.trim().length<10||(target==='suspended'&&(!clearance||blocked))}>{saving?'Saving…':'Confirm change'}</button></div></fieldset></form>}
 {notice&&<p role="status">{notice}</p>}
 <details className="hotel-access-history"><summary>Access change history ({query.data?.meta.total??0})</summary><div className="table-scroll"><table><thead><tr><th>Change</th><th>Reason</th><th>Operator / time</th></tr></thead><tbody>{data.history.map(r=><tr key={r.revision}><td>{accessLabels[r.from]} → {accessLabels[r.to]}</td><td>{r.reason}</td><td>{r.actorId?'#'+r.actorId:'Unavailable'}<small className="cell-note">{new Date(r.createdAt).toLocaleString()}</small></td></tr>)}</tbody></table></div>{query.data&&<div className="platform-pagination"><button className="btn-inline" disabled={saving||page<=1} onClick={()=>{reset();setPage(page-1);}}>Previous</button><span>Page {page} of {query.data.meta.lastPage}</span><button className="btn-inline" disabled={saving||page>=query.data.meta.lastPage} onClick={()=>{reset();setPage(page+1);}}>Next</button></div>}</details>
 </>}
 <p className="platform-note">Manual access policy only. Subscription expiry does not suspend a property. Background integrations may still process events.</p></section>;
}
