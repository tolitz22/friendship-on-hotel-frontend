import {useEffect,useState} from 'react';
import {useQueryClient} from '@tanstack/react-query';
import {AlertTriangle,ArrowRight,CheckCircle2,Clock3,ShieldAlert,ShieldCheck} from 'lucide-react';
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
 const activeBlockers=Object.entries(blockers??{}).filter(([,active])=>active).map(([key])=>blockerLabels[key]??key);
 const blocked=activeBlockers.length>0;
 const approvedCurrent=state.isSuccess&&state.data.advisoryReady;
 const needsNewInspection=!approvedCurrent&&latest?.status!=='submitted';
 const allChecks=Object.values(form).slice(0,3).every(Boolean);
 async function run(action:()=>Promise<unknown>){
  if(!hotelId||busy)return;
  const at=hotelId;
  setBusy(true);setError('');setMessage('');
  try{
   await action();
   if(readSession().hotelId!==at)return;
   setMessage('Change saved. The room status and inspection history are being updated.');
   setForm(empty());setReviewNote('');
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
 const review=(decision:'approve'|'reject')=>{
  if(!latest)return;
  void run(()=>reviewRoomInspection(hotelId!,room.id,latest.id,{
   decision,expectedRevision:latest.revision,note:reviewNote,
  }));
 };
 return <Panel title={'Room '+room.number+' · Inspection and readiness'}>
  <div className="desk-tools">
   <p>Room type: {room.roomTypeName} · Cleaning, physical inspection, and room availability are separate checks.</p>
   <button type="button" className="btn-inline" disabled={busy} onClick={onClose}>Close</button>
  </div>
  <QueryFeedback loading={state.isPending} error={state.error}/>
  {state.data&&<>
   <div className={'rr-inspection-status'+(state.data.advisoryReady?' approved':'')}>
    {state.data.advisoryReady?<ShieldCheck size={22}/>:<ShieldAlert size={22}/>}
    <div><strong>{state.data.advisoryReady?'Current inspection approved':'Not approved for readiness'}</strong>
     <p>{state.data.advisoryReady?'No new inspection is required merely because another day has passed. Reinspect after checkout turnover, relevant room work, or a new blocker.':'This means there is no current approved inspection. It does not automatically mean the room is dirty.'}</p></div>
   </div>
   <div className="rr-readiness-steps" aria-label="Room readiness process">
    <div><strong>1. Clean</strong><small>Housekeeping records the work</small></div>
    <ArrowRight size={15} aria-hidden="true"/>
    <div><strong>2. Inspect</strong><small>Check cleanliness, safety and amenities</small></div>
    <ArrowRight size={15} aria-hidden="true"/>
    <div><strong>3. Approve</strong><small>Another authorized manager reviews</small></div>
   </div>
   <div className="rr-inspection-meta"><span><Clock3 size={15}/> Check-in inspection enforcement: <strong>{state.data.enforcedAtCheckIn?'Enabled':'Not enabled'}</strong></span>
    <span>Room inventory, identity, and payment require separate validation.</span></div>
   <section className="rr-blocker-section" aria-label="Current room readiness blockers">
    <div className="rr-blocker-header"><h4>Operational blockers</h4><span>{activeBlockers.length} active</span></div>
    {activeBlockers.length>0?<ul>{activeBlockers.map(label=><li key={label}><AlertTriangle size={15}/>{label}</li>)}</ul>
     :<p className="rr-blocker-clear"><CheckCircle2 size={16}/> No blockers reported in the current readiness response.</p>}
   </section>
   {latest?<div className="rr-latest-inspection">
    <span>Latest inspection</span><strong>#{latest.id} · {latest.status}</strong>
    <small>Inspection version {latest.revision} · Inspector #{latest.inspectedBy}{latest.reviewedBy?' · Reviewer #'+latest.reviewedBy:''}</small>
   </div>:<p className="rr-latest-inspection">No inspection has been submitted for this room.</p>}
   {approvedCurrent&&<p role="status" className="rr-valid-approval"><CheckCircle2 size={17}/> Inspection is current. Another routine inspection is not needed unless new turnover, maintenance, or other work invalidates it.</p>}
   {admin&&needsNewInspection&&<section>
    <h4>{latest?'Reinspect this room':'Record the first room inspection'}</h4>
    <p>Only submit after checking the physical room. Cleaning-task completion alone is not proof of inspection. A new inspection is usually needed after guest checkout, relevant repairs, or an expired/stale approval—not every calendar day.</p>
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
     onClick={submit}>Submit inspection for supervisor review</button>
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
  <section className="rr-audit-section">
   <h4>Inspection history</h4>
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
