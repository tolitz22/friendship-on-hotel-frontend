import {useState} from 'react';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {AlertTriangle,CheckCircle2,ClipboardList,Info,Plus,RefreshCw,X} from 'lucide-react';
import {useHotelAuth} from './AuthProvider';
import {listHotelStaff} from '../api/liveStaff';
import {readSession} from '../api/session';
import {openOccupancyInvestigation,resolutions,updateOccupancyInvestigation,useOccupancyInvestigation} from '../api/occupancyInvestigations';
import {readableDateTime} from '../lib/format';
import {QueryFeedback} from './QueryFeedback';

type Action='open'|'note'|'assign'|'close';
const titles:Record<string,string>={opened:'Investigation opened',finding:'Findings recorded',
 reassigned:'Investigation reassigned',closed:'Investigation closed'};

export function OccupancyInvestigationPanel({verificationId,roomNumber}:{
 verificationId:string;roomNumber:string;
}){
 const {hotelId,user}=useHotelAuth();
 const client=useQueryClient();
 const [action,setAction]=useState<Action|null>(null);
 const [owner,setOwner]=useState('');
 const [note,setNote]=useState('');
 const [reference,setReference]=useState('');
 const [resolution,setResolution]=useState<(typeof resolutions)[number]['value']>('observation_unconfirmed');
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [notice,setNotice]=useState('');
 const investigation=useOccupancyInvestigation(!!hotelId,hotelId,verificationId);
 const staff=useQuery({queryKey:['hotel-staff',hotelId],queryFn:listHotelStaff,enabled:!!hotelId});
 const managers=staff.data?.data.filter(member=>member.role==='admin'&&member.isActive&&member.accountActive)??[];
 const data=investigation.data;
 const isOwner=!!data&&data.ownerId===user?.id;
 const hasFindings=!!data?.history.some(entry=>entry.event==='finding');
 function openAction(next:Action){
  setError('');setNotice('');setNote('');setReference('');
  setOwner(data?.ownerId||user?.id||'');setAction(next);
 }
 async function submit(){
  if(!hotelId||!action||busy||note.trim().length<10)return;
  if((action==='open'||action==='assign')&&!owner)return;
  setBusy(true);setError('');setNotice('');
  try{
   if(action==='open')await openOccupancyInvestigation(hotelId,verificationId,owner,note.trim());
   else await updateOccupancyInvestigation(hotelId,verificationId,{
    action,note:note.trim(),ownerId:action==='assign'?owner:undefined,
    resolution:action==='close'?resolution:undefined,
    evidenceReference:action==='note'?reference.trim():undefined,
   });
   if(readSession().hotelId!==hotelId)return;
   setNotice(action==='open'?'Investigation opened and assigned.':
    action==='note'?'Finding added to the investigation history.':
    action==='assign'?'Investigation owner updated.':'Case closed after independent review.');
   setAction(null);
   void client.invalidateQueries({queryKey:['occupancy-investigation',hotelId,verificationId]});
  }catch(e){
   if(readSession().hotelId===hotelId)setError(e instanceof Error?e.message:'Unable to confirm this update. Refresh before retrying.');
  }finally{setBusy(false);}
 }
 return <section className="occ-investigation">
  <div className="occ-investigation-heading"><div><strong>Discrepancy investigation</strong>
   <p>Track the follow-up separately from the original observation and booking records.</p></div>
   <button type="button" className="occ-icon-button" onClick={()=>void investigation.refetch()}
    aria-label="Refresh investigation"><RefreshCw size={16}/></button>
  </div>
  <QueryFeedback loading={investigation.isPending} error={investigation.error} onRetry={()=>void investigation.refetch()}/>
  {investigation.isSuccess&&!data&&<div className="occ-investigation-start">
   <p>No investigation has been opened for this flagged observation.</p>
   <button type="button" className="btn-primary" onClick={()=>openAction('open')}>
    <Plus size={16}/> Open investigation</button>
  </div>}
  {data&&<div className="occ-investigation-body">
   <div className="occ-investigation-status">
    <span className={'occ-status '+(data.status==='closed'?'occ-success':'occ-danger')}>
     {data.status==='closed'?'Closed · reviewed':'Open · follow-up required'}</span>
    <span>Assigned manager: <strong>{data.ownerName||'Name unavailable'}</strong></span>
   </div>
   {data.status==='closed'&&<p className="occ-investigation-resolution"><CheckCircle2 size={16}/>
    {resolutions.find(x=>x.value===data.resolution)?.label??'Resolution recorded'}
    {' · '}Closed by {data.closedByName||'Manager name unavailable'}.
    {' '}{data.closingNote}</p>}
   {data.status==='open'&&<div className="occ-investigation-actions">
    {isOwner&&<button type="button" className="btn-primary" onClick={()=>openAction('note')}>
     <ClipboardList size={16}/> Add findings</button>}
    <button type="button" className="rr-secondary-action" onClick={()=>openAction('assign')}>Reassign</button>
    {!isOwner&&hasFindings&&<button type="button" className="rr-secondary-action"
     onClick={()=>openAction('close')}>Review and close</button>}
   </div>}
   {data.status==='open'&&isOwner&&<p className="occ-investigation-hint">
    You can record findings. A different manager must approve final closure.</p>}
   {data.status==='open'&&!hasFindings&&<p className="occ-investigation-hint">
    Record documented findings before an independent manager can close this case.</p>}
   <details className="occ-investigation-history"><summary>Case activity ({data.history.length})</summary>
    <div className="occ-investigation-timeline">{data.history.map(event=>{
     const details=event.details;
     const description=typeof details.note==='string'?details.note:null;
     const evidence=typeof details.evidenceReference==='string'?details.evidenceReference:null;
     return <article key={event.id}>
      <strong>{titles[event.event]||'Case updated'}</strong>
      <small>{event.actorName||'Employee name unavailable'} · {readableDateTime(event.createdAt)}</small>
      {description&&<p>{description}</p>}
      {evidence&&<p><strong>Evidence reference:</strong> {evidence}</p>}
     </article>;
    })}</div>
   </details>
  </div>}
  {notice&&<p role="status" className="occ-investigation-hint">{notice}</p>}
  {action&&<div className="billing-modal-backdrop"><section className="billing-action-modal" role="dialog"
   aria-modal="true" aria-label="Update occupancy investigation">
   <div className="billing-action-modal-header"><div><span className="rr-eyebrow">ROOM {roomNumber}</span>
    <h3>{action==='open'?'Open investigation':action==='note'?'Record investigation findings':
      action==='assign'?'Reassign investigation':'Review and close case'}</h3>
    <p>Actions are recorded with your name and time. They do not change reservations or payments.</p></div>
    <button type="button" className="billing-modal-dismiss" aria-label="Close dialog" disabled={busy}
     onClick={()=>setAction(null)}><X size={18}/></button>
   </div>
   <div className="occ-dialog-form">
    {(action==='open'||action==='assign')&&<label>Responsible manager
     <select className="wizard-input" value={owner} disabled={busy} onChange={e=>setOwner(e.target.value)}>
      <option value="">Select a manager</option>
      {managers.map(person=><option value={person.userId} key={person.userId}>{person.name}</option>)}
     </select></label>}
    {action==='close'&&<label>Investigation outcome
     <select className="wizard-input" value={resolution} disabled={busy}
      onChange={e=>setResolution(e.target.value as typeof resolution)}>
      {resolutions.map(opt=><option key={opt.value} value={opt.value}>{opt.label}</option>)}
     </select></label>}
    <label>{action==='note'?'Findings and checks performed':action==='close'?'Reason for closing':'Reason and next steps'}
     <textarea className="wizard-input" value={note} rows={4} maxLength={1500} disabled={busy}
      onChange={e=>setNote(e.target.value)}
      placeholder="Summarize factual evidence, who was consulted, and any follow-up. No unnecessary guest personal details."/></label>
    {action==='note'&&<label>Evidence reference (optional)
     <input className="wizard-input" value={reference} maxLength={300} disabled={busy}
      onChange={e=>setReference(e.target.value)}
      placeholder="Example: security log reference, incident number, or room-check record"/></label>}
    {action==='close'&&<p className="occ-dialog-guidance"><Info size={16}/>
     Closure requires recorded findings and a manager other than the case owner.
     Closing here does not automatically correct the PMS or waive financial obligations.</p>}
    <button type="button" className="btn-primary" disabled={busy||note.trim().length<10||
     ((action==='open'||action==='assign')&&!owner)} onClick={()=>void submit()}>
     {busy?'Saving…':action==='open'?'Open case':action==='note'?'Save findings':
      action==='assign'?'Assign manager':'Close after review'}</button>
    {error&&<p className="auth-error" role="alert"><AlertTriangle size={15}/>{error}</p>}
   </div>
  </section></div>}
 </section>;
}
