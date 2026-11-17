import {useEffect,useState} from 'react';
import {useQueryClient} from '@tanstack/react-query';
import {AlertTriangle,CheckCircle2} from 'lucide-react';
import {useHotelAuth} from '../components/AuthProvider';
import {Panel} from '../components/ui';
import {QueryFeedback} from '../components/QueryFeedback';
import {
 submitRoomInspection,reviewRoomInspection,
 useLiveReadiness,useLiveReadinessHistory,
} from '../api/liveRoomReadiness';
import type {InspectionInput} from '../api/liveRoomReadiness';
import type {LiveRoom} from '../api/liveCatalog';
import {readSession} from '../api/session';

const empty=():InspectionInput=>({
 cleaningVerified:false,safetyVerified:false,amenitiesVerified:false,note:'',
});

export function RoomReadinessPanel({room,onClose}:{room:LiveRoom;onClose:()=>void}){
 const {hotelId,user}=useHotelAuth();
 const admin=!!user?.hotels.some(h=>h.id===hotelId&&h.role==='admin');
 const [form,setForm]=useState<InspectionInput>(empty);
 const [reviewNote,setReviewNote]=useState('');
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
 const blocked=blockers&&Object.values(blockers).some(Boolean);
 const allChecks=Object.values(form).slice(0,3).every(Boolean);
 async function run(action:()=>Promise<unknown>){
  if(!hotelId||busy)return;
  const at=hotelId;
  setBusy(true);setError('');setMessage('');
  try{
   await action();
   if(readSession().hotelId!==at)return;
   setMessage('Laravel recorded the change. Refresh readiness and history before the next action.');
   setForm(empty());setReviewNote('');
   void Promise.all([
    client.invalidateQueries({queryKey:['live','room-readiness',at,room.id]}),
    client.invalidateQueries({queryKey:['live','room-readiness-history',at,room.id]}),
    client.invalidateQueries({queryKey:['live','readiness-dashboard',at]}),
   ]).catch(()=>{});
  }catch(e){
   if(readSession().hotelId===at)setError(
    e instanceof Error?e.message:'The result is uncertain. Reload before taking another action.'
   );
  }finally{setBusy(false);}
 }
 const submit=()=>void run(()=>submitRoomInspection(hotelId!,room.id,form));
 const review=(decision:'approve'|'reject')=>{
  if(!latest)return;
  void run(()=>reviewRoomInspection(hotelId!,room.id,latest.id,{
   decision,expectedRevision:latest.revision,note:reviewNote,
  }));
 };
 return <Panel title={'Room '+room.number+' · Inspection and readiness'}>
  <div className="desk-tools">
   <p>Room type: {room.roomTypeName} · Inspection is separate from cleaning tasks and inventory.</p>
   <button type="button" className="btn-inline" disabled={busy} onClick={onClose}>Close</button>
  </div>
  <QueryFeedback loading={state.isPending} error={state.error}/>
  {state.data&&<>
   <p role="status"><strong>Advisory readiness: {state.data.advisoryReady?'Approved, with no current blockers found':'Not approved / blocked'}</strong></p>
   <p>Check-in inspection gate: <strong>{state.data.enforcedAtCheckIn?'Enabled for this hotel':'Not enabled'}</strong>. Readiness is never guaranteed room inventory, guest identity verification, or payment settlement.</p>
   <div className="hk-notice">
    <AlertTriangle size={16}/>
    <span>Current inventory block: {blockers?.activeInventoryBlockToday?'Yes':'No'} ·
     Active room-impact maintenance: {blockers?.activeRoomImpactMaintenance?'Yes':'No'} ·
     Latest turnover incomplete: {blockers?.latestTurnoverIncomplete?'Yes':'No'} ·
     New turnover after inspection: {blockers?.newTurnoverSinceInspection?'Yes':'No'} ·
     Outstanding housekeeping: {blockers?.unfinishedHousekeeping?'Yes':'No'} ·
     New operational work after inspection: {blockers?.newRoomWorkSinceInspection?'Yes':'No'}
    </span>
   </div>
   {latest&&<p>Latest inspection #{latest.id}: <strong>{latest.status}</strong> ·
    Revision {latest.revision} · Inspector #{latest.inspectedBy}
    {latest.reviewedBy?' · Reviewer #'+latest.reviewedBy:''}</p>}
   {admin&&latest?.status!=='submitted'&&<section>
    <h4>Submit a new physical inspection</h4>
    <p>Confirm these checks based on an actual inspection, not solely on the cleaning task's status.</p>
    {([
     ['cleaningVerified','Cleanliness physically checked'],
     ['safetyVerified','Safety items physically checked'],
     ['amenitiesVerified','Amenities physically checked'],
    ] as const).map(([key,label])=><label key={key} className="wizard-label">
     <input type="checkbox" checked={form[key]} disabled={busy}
      onChange={e=>setForm(old=>({...old,[key]:e.target.checked}))}/> {label}
    </label>)}
    <label className="wizard-label">Inspector note
     <textarea className="wizard-input" rows={3} value={form.note} maxLength={2000}
      disabled={busy} onChange={e=>setForm(old=>({...old,note:e.target.value}))}/>
    </label>
    <button type="button" className="btn-primary" disabled={busy||!allChecks||form.note.trim().length<5}
     onClick={submit}>Submit inspection for independent review</button>
   </section>}
   {admin&&latest?.status==='submitted'&&<section>
    <h4>Review submitted inspection</h4>
    <p>A different administrator must approve it. Blockers and missing checks prevent approval.</p>
    <p>Checklist: {Object.values(latest.checks).every(Boolean)?'All checks recorded':'Some checks failed'}</p>
    <label className="wizard-label">Review note
     <textarea className="wizard-input" rows={3} maxLength={2000}
      disabled={busy} value={reviewNote} onChange={e=>setReviewNote(e.target.value)}/>
    </label>
    <div className="desk-tools">
     <button type="button" className="btn-primary"
      disabled={busy||latest.inspectedBy===user?.id||!!blocked
       ||!Object.values(latest.checks).every(Boolean)||reviewNote.trim().length<5}
      onClick={()=>review('approve')}>Approve inspection</button>
     <button type="button" className="btn-inline" disabled={busy||reviewNote.trim().length<5}
      onClick={()=>review('reject')}>Reject inspection</button>
    </div>
   </section>}
  </>}
  {error&&<p role="alert">{error}</p>}
  {message&&<p role="status"><CheckCircle2 size={16}/> {message}</p>}
  <section>
   <h4>Recorded readiness audit</h4>
   <QueryFeedback loading={history.isPending} error={history.error}
    empty={history.isSuccess&&history.data.data.length===0}/>
   {history.data?.data.map(e=><article className="maintenance-history-event" key={e.id}>
    <strong>{e.action} · Inspection #{e.inspectionId} · Staff #{e.actorId}</strong>
    <small>{e.createdAt}</small>
   </article>)}
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
  </section>
 </Panel>;
}
