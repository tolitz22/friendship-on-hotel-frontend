import {useState} from 'react';
import {useQueryClient} from '@tanstack/react-query';
import {AlertTriangle,ShieldCheck} from 'lucide-react';
import {useHotelAuth} from './AuthProvider';
import {Panel} from './ui';
import {QueryFeedback} from './QueryFeedback';
import {readSession} from '../api/session';
import {
 changeReadinessPolicy,useReadinessPolicy,useReadinessPolicyHistory,
} from '../api/readinessEnforcementPolicy';

export function ReadinessEnforcementPanel(){
 const {hotelId,user}=useHotelAuth();
 const admin=!!user?.hotels.some(h=>h.id===hotelId&&h.role==='admin');
 const policy=useReadinessPolicy();
 const [reason,setReason]=useState('');
 const [ack,setAck]=useState(false);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [message,setMessage]=useState('');
 const [historyPage,setHistoryPage]=useState(1);
 const history=useReadinessPolicyHistory(historyPage);
 const client=useQueryClient();
 async function change(){
  if(!hotelId||!admin||!policy.data||busy||!ack||reason.trim().length<10)return;
  const capturedHotel=hotelId;
  const desired=!policy.data.enforceAtCheckIn;
  setBusy(true);setError('');setMessage('');
  try{
   const updated=await changeReadinessPolicy(capturedHotel,policy.data.revision,desired,reason);
   if(readSession().hotelId!==capturedHotel)return;
   setMessage(updated.enforceAtCheckIn?
    'Laravel enabled the room inspection gate for this hotel.' :
    'Laravel disabled the room inspection gate for this hotel.');
   setAck(false);setReason('');
   void Promise.all([
    client.invalidateQueries({queryKey:['live','readiness-policy',capturedHotel]}),
    client.invalidateQueries({queryKey:['live','readiness-policy-history',capturedHotel]}),
    client.invalidateQueries({queryKey:['live','room-readiness',capturedHotel]}),
    client.invalidateQueries({queryKey:['live','readiness-dashboard',capturedHotel]}),
   ]).catch(()=>{});
  }catch(e){
   if(readSession().hotelId===capturedHotel)
    setError(e instanceof Error?e.message:'Policy result could not be confirmed; refresh before retrying.');
  }finally{setBusy(false);}
 }
 return <Panel title="Inspection requirement at check-in">
  <p>Choose whether the front desk must have an approved room inspection before checking in a guest. This is a hotel-wide rule, not a daily inspection schedule.</p>
  <QueryFeedback loading={policy.isPending} error={policy.error}/>
  {policy.data&&<>
   <div className="rr-policy-state" role="status"><ShieldCheck size={21}/><div><strong>{policy.data.enforceAtCheckIn?'Approved inspection required at check-in':'Inspection not mandatory for check-in'}</strong>
    <p>{policy.data.enforceAtCheckIn?'Laravel checks for an independently approved current inspection without blockers when a guest checks in.':'Inspections and audit history remain available, but the readiness gate is not enforced at check-in.'}</p>
    <small>Policy revision {policy.data.revision} · No automatic daily inspection</small></div></div>
   <p className="rr-policy-caution"><AlertTriangle size={16}/> Enabling this rule may prevent check-in for rooms without current approval. It does not replace reservations, inventory checks, guest identity, maintenance or payment controls.</p>
   {admin&&<section>
    <h4>Change this hotel-wide rule</h4>
    <p>This affects future check-ins. Confirm staff training and pending arrivals before changing it.</p>
    <label className="wizard-label">Reason for changing policy
     <textarea className="wizard-input" value={reason} maxLength={500} rows={2}
      disabled={busy} onChange={e=>setReason(e.target.value)}
      placeholder="State the operational authorization and rollout reason"/>
    </label>
    <label className="wizard-label">
     <input type="checkbox" checked={ack} disabled={busy}
      onChange={e=>setAck(e.target.checked)}/>
     I have reviewed the hotel's operational rollout, staff training, existing room inspections and pending arrivals.
    </label>
    <button className="btn-primary" type="button" disabled={busy||!ack||reason.trim().length<10}
     onClick={()=>void change()}>
     <ShieldCheck size={16}/>
     {busy?'Saving…':policy.data.enforceAtCheckIn?'Disable enforced check-in readiness':'Enable enforced check-in readiness'}
    </button>
   </section>}
  </>}
  {error&&<p role="alert">{error} Reload policy before resubmitting a potentially committed change.</p>}
  {message&&<p role="status">{message}</p>}
  <section>
   <h4>Policy change history</h4>
   <QueryFeedback loading={history.isPending} error={history.error}
    empty={history.isSuccess&&history.data.data.length===0}/>
   {history.data?.data.map(entry=><article key={entry.id} className="maintenance-history-event">
    <strong>{entry.nextEnabled?'Enabled':'Disabled'} · revision {entry.revision} · Staff #{entry.actorId}</strong>
    <small>{entry.createdAt}</small>
    <p>{entry.reason}</p>
   </article>)}
   {history.data&&<div className="guest-pagination">
    <span>Page {history.data.meta.page} of {Math.max(1,history.data.meta.totalPages)}</span>
    <div>
     <button className="btn-inline" type="button" disabled={historyPage<=1}
      onClick={()=>setHistoryPage(p=>p-1)}>Previous</button>
     <button className="btn-inline" type="button" disabled={historyPage>=history.data.meta.totalPages}
      onClick={()=>setHistoryPage(p=>p+1)}>Next</button>
    </div>
   </div>}
  </section>
 </Panel>;
}
