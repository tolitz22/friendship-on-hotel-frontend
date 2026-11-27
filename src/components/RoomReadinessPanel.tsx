import {useEffect,useState} from 'react';
import {useQueryClient} from '@tanstack/react-query';
import {AlertTriangle,CheckCircle2,Clock3,ShieldAlert,ShieldCheck} from 'lucide-react';
import {useHotelAuth} from '../components/AuthProvider';
import './RoomReadinessPanel.css';
import {QueryFeedback} from '../components/QueryFeedback';
import {
 submitRoomInspection,
 useLiveReadiness,useLiveReadinessHistory,
} from '../api/liveRoomReadiness';
import type {InspectionInput} from '../api/liveRoomReadiness';
import type {LiveRoom} from '../api/liveCatalog';
import {readSession} from '../api/session';
import {ReadableInspectionAuditEvent,auditActorName} from './ReadableAuditEvent';
import {useQuery} from '@tanstack/react-query';
import {listHotelStaff} from '../api/liveStaff';

const blockerLabels:Record<string,string>={
 activeInventoryBlockToday:'Inventory restriction active today',
 activeRoomImpactMaintenance:'Open maintenance affecting this room',
 latestTurnoverIncomplete:'Most recent checkout cleaning incomplete',
 newTurnoverSinceInspection:'New checkout turnover after inspection',
 unfinishedHousekeeping:'Housekeeping work still outstanding',
 newRoomWorkSinceInspection:'New room work after inspection',
};
const empty=():InspectionInput=>({
 cleaningVerified:false,safetyVerified:false,amenitiesVerified:false,note:'',
});

export function RoomReadinessPanel({room}:{room:LiveRoom;onClose:()=>void}){
 const {hotelId,user}=useHotelAuth();
 const admin=!!user?.hotels.some(h=>h.id===hotelId&&h.role==='admin');
 const staff=useQuery({queryKey:['hotel-staff',hotelId],queryFn:listHotelStaff,enabled:admin&&!!hotelId});
 const nameOf=(id:string)=>auditActorName(id,staff.data?.data.find(member=>member.userId===id)?.name,user?.id,user?.name);
 const [form,setForm]=useState<InspectionInput>(empty);
 const [historyPage,setHistoryPage]=useState(1);
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState('');
 const [error,setError]=useState('');
 const client=useQueryClient();
 const state=useLiveReadiness(room.id);
 const history=useLiveReadinessHistory(room.id,historyPage);
 useEffect(()=>{setForm(empty());setHistoryPage(1);setError('');setMessage('');},[room.id,hotelId]);
 const latest=state.data?.inspection;
 const blockers=state.data?.blockers;
 const activeBlockers=Object.entries(blockers??{}).filter(([,active])=>active).map(([key])=>blockerLabels[key]??key);
 const approvedCurrent=state.isSuccess&&state.data.advisoryReady;
 const needsNewInspection=!approvedCurrent;
 const allChecks=Object.values(form).slice(0,3).every(Boolean);
 async function run(action:()=>Promise<unknown>){
  if(!hotelId||busy)return;
  const at=hotelId;
  setBusy(true);setError('');setMessage('');
  try{
   await action();
   if(readSession().hotelId!==at)return;
   setMessage('Change saved. The room status and inspection history are being updated.');
   setForm(empty());
   void Promise.all([
    client.invalidateQueries({queryKey:['live','room-readiness',at,room.id]}),
    client.invalidateQueries({queryKey:['live','room-readiness-history',at,room.id]}),
    client.invalidateQueries({queryKey:['live','readiness-dashboard',at]}),
    client.invalidateQueries({queryKey:['live','room-inventory-status',at]}),
   ]).catch(()=>{});
  }catch(e){
   if(readSession().hotelId===at)setError(
    e instanceof Error?e.message:'The result is uncertain. Reload before taking another action.'
   );
  }finally{setBusy(false);}
 }
 const submit=()=>void run(()=>submitRoomInspection(hotelId!,room.id,form));
 return <section className="rr-compact-panel" aria-label={'Room '+room.number+' inspection and readiness'}>
  <p className="rr-compact-type">{room.roomTypeName}</p>
  <QueryFeedback loading={state.isPending} error={state.error}/>
  {state.data&&<>
   <div className={'rr-inspection-status'+(state.data.advisoryReady?' approved':'')}>
    {state.data.advisoryReady?<ShieldCheck size={22}/>:<ShieldAlert size={22}/>}
    <div><strong>{state.data.advisoryReady?'Current physical inspection complete':'Physical inspection needed'}</strong>
    </div>
   </div>
   <section className="rr-blocker-section" aria-label="Current room readiness blockers">
    <div className="rr-blocker-header"><h4>Operational blockers</h4><span>{activeBlockers.length} active</span></div>
    {activeBlockers.length>0?<ul>{activeBlockers.map(label=><li key={label}><AlertTriangle size={15}/>{label}</li>)}</ul>
     :<p className="rr-blocker-clear"><CheckCircle2 size={16}/> No active blockers</p>}
   </section>
   {latest?<div className="rr-latest-inspection">
    <span>Latest inspection</span><strong>{latest.status==='submitted'?'Repeat physical inspection':latest.status==='approved'?'Completed':'Rejected'}</strong>
    <small>Inspected by {nameOf(latest.inspectedBy)}{latest.reviewedBy?' · Reviewed by '+nameOf(latest.reviewedBy):''}</small>
   </div>:<p className="rr-latest-inspection">No previous inspection</p>}
   {approvedCurrent&&<p role="status" className="rr-valid-approval"><CheckCircle2 size={17}/> Inspection is current.</p>}
   {admin&&needsNewInspection&&<section className="rr-mobile-checklist">
    <h4>{latest?'Reinspect room':'Inspection checklist'}</h4>
    <p>Check the room in person. Resolve active blockers first.</p>
    {([
     ['cleaningVerified','Cleanliness checked'],
     ['safetyVerified','Safety checked'],
     ['amenitiesVerified','Amenities checked'],
    ] as const).map(([key,label])=><label key={key} className="wizard-label rr-inspection-check">
     <input type="checkbox" checked={form[key]} disabled={busy}
      onChange={e=>setForm(old=>({...old,[key]:e.target.checked}))}/> {label}
    </label>)}
    <label className="wizard-label">Inspector note (optional)
     <textarea className="wizard-input" rows={2} value={form.note} maxLength={2000}
      disabled={busy} onChange={e=>setForm(old=>({...old,note:e.target.value}))}/>
    </label>
    <button type="button" className="btn-primary" disabled={busy||!allChecks}
     onClick={submit}>Complete room inspection</button>
   </section>}
   <details className="rr-compact-details"><summary>Inspection details</summary>     <p>{state.data.advisoryReady?'No new inspection is required merely because another day has passed. Reinspect after checkout turnover, relevant room work, or a new blocker.':'A current completed inspection is missing, or a new blocker needs attention. This does not necessarily mean the room is dirty.'}</p>   <p className="rr-one-note">Cleaning is recorded separately. A completed room inspection checks safety, cleanliness and amenities; no manager approval is required.</p>
   <div className="rr-inspection-meta"><span><Clock3 size={15}/> Check-in inspection enforcement: <strong>{state.data.enforcedAtCheckIn?'Enabled':'Not enabled'}</strong></span>
    <span>Room inventory, identity, and payment require separate validation.</span></div>
</details>
  </>}
  {error&&<p role="alert">{error}</p>}
  {message&&<p role="status"><CheckCircle2 size={16}/> {message}</p>}
  <details className="rr-audit-section rr-inspection-history" open={typeof window==='undefined'||!window.matchMedia('(max-width: 760px)').matches}>
   <summary>Inspection history</summary>
   <QueryFeedback loading={history.isPending} error={history.error}
    empty={history.isSuccess&&history.data.data.length===0}/>
   {history.data?.data.map(e=><ReadableInspectionAuditEvent key={e.id} event={{
     ...e,actorName:e.actorName??staff.data?.data.find(member=>member.userId===e.actorId)?.name,
    }} currentUserId={user?.id} currentUserName={user?.name}/>)}
   {history.data&&<div className="guest-pagination">
    <span>Page {history.data.meta.page} of {Math.max(1,history.data.meta.totalPages)}</span>
    <div>
     <button type="button" className="btn-inline" disabled={historyPage<=1}
      onClick={()=>setHistoryPage(p=>p-1)}>Previous</button>
     <button type="button" className="btn-inline"
      disabled={historyPage>=history.data.meta.totalPages}
      onClick={()=>setHistoryPage(p=>p+1)}>Next</button>
    </div>
   </div>}
  </details>
 </section>;
}
