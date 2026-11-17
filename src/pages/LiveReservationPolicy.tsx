import {useEffect,useState,type FormEvent} from 'react';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {ClipboardList,History,Save,ShieldAlert,RefreshCcw} from 'lucide-react';
import {useHotelAuth} from '../components/AuthProvider';
import {Heading,Panel} from '../components/ui';
import {QueryFeedback} from '../components/QueryFeedback';
import {ApiError} from '../api/http';
import {
 getReservationPolicyDraft,getReservationPolicyHistory,updateReservationPolicyDraft,
 POLICY_FIELDS,type PolicyField,type PolicyDecisions,
} from '../api/reservationPolicy';

const fields=Object.keys(POLICY_FIELDS) as PolicyField[];
export function LiveReservationPolicy(){
 const {hotelId,user}=useHotelAuth();
 const admin=!!user?.hotels.some(h=>h.id===hotelId&&h.role==='admin');
 const queryClient=useQueryClient();
 const query=useQuery({queryKey:['reservation-policy',hotelId],queryFn:getReservationPolicyDraft});
 const [choices,setChoices]=useState<PolicyDecisions|null>(null);
 const [saving,setSaving]=useState(false);
 const [error,setError]=useState('');
 const [notice,setNotice]=useState('');
 const [historyOpen,setHistoryOpen]=useState(false);
 const history=useQuery({
  queryKey:['reservation-policy-history',hotelId],
  queryFn:getReservationPolicyHistory,
  enabled:admin&&historyOpen,
 });
 useEffect(()=>{
  setChoices(null);setError('');setNotice('');setHistoryOpen(false);
 },[hotelId]);
 useEffect(()=>{
  if(query.data?.data.decisions)setChoices({...query.data.data.decisions});
 },[query.data]);
 const draft=query.data?.data;
 const complete=choices?fields.every(field=>choices[field]!==null):false;
 const modified=!!draft&&!!choices&&fields.some(field=>draft.decisions[field]!==choices[field]);

 async function save(event:FormEvent<HTMLFormElement>){
  event.preventDefault();
  if(!admin||!draft||!choices||!modified||saving)return;
  setSaving(true);setError('');setNotice('');
  try{
   const changed=Object.fromEntries(fields.filter(field=>draft.decisions[field]!==choices[field])
    .map(field=>[field,choices[field]])) as Partial<PolicyDecisions>;
   await updateReservationPolicyDraft(draft.revision,changed);
   await queryClient.invalidateQueries({queryKey:['reservation-policy',hotelId]});
   await queryClient.invalidateQueries({queryKey:['reservation-policy-history',hotelId]});
   setNotice('Draft saved. These decisions do not activate bookings.');
  }catch(caught){
   const message=caught instanceof Error?caught.message:'Could not save draft.';
   setError(message);
   if(caught instanceof ApiError&&caught.status===409)
    setNotice('Another administrator updated this draft. Reload to review the newest revision before making changes.');
  }finally{setSaving(false);}
 }
 return <>
  <div className="notice"><strong>Planning only — not active</strong> · These selections are draft business decisions. Saving cannot create reservations or make rooms bookable.</div>
  <Heading title="Reservation policy draft" description="Hotel-scoped booking decisions for administrator review. No reservation writes enabled."/>
  <QueryFeedback loading={query.isPending} error={query.error}/>
  {draft&&choices&&<>
   <div className="settings-summary">
    <div><ClipboardList size={19}/><span>Draft revision</span><strong>{draft.revision}</strong></div>
    <div><ShieldAlert size={19}/><span>Booking activation</span><strong>Disabled</strong></div>
    <div><ClipboardList size={19}/><span>Decisions selected</span><strong>{fields.filter(f=>choices[f]!==null).length} / {fields.length}</strong></div>
   </div>
   <Panel title="Business-rule decisions" action={<button type="button" className="btn-inline" disabled={saving} onClick={()=>void query.refetch()}><RefreshCcw size={15}/> Reload saved draft</button>}>
    <form onSubmit={e=>void save(e)}>
     <div className="policy-grid">
      {fields.map(field=><label key={field}>{POLICY_FIELDS[field].title}
       <select disabled={!admin||saving} value={choices[field]??''}
        onChange={e=>{setChoices(current=>current?{...current,[field]:e.target.value||null}:current);setNotice('');}}>
        <option value="">Not decided</option>
        {Object.entries(POLICY_FIELDS[field].options).map(([value,label])=><option key={value} value={value}>{label}</option>)}
       </select>
      </label>)}
     </div>
     {error&&<p role="alert" className="catalog-field-error">{error}</p>}
     {notice&&<p role="status" className="guest-info">{notice}</p>}
     <div className="guest-modal-actions">
      <span className="guest-info">{complete?'All draft fields selected; approval and booking implementation are still pending.':'Choose options or leave undecided fields blank.'}</span>
      {admin&&<button type="submit" className="btn-primary" disabled={saving||!modified}><Save size={16}/>{saving?'Saving…':'Save draft'}</button>}
     </div>
    </form>
   </Panel>
   {admin&&<Panel title="Draft revision history">
    <button type="button" className="btn-inline" onClick={()=>setHistoryOpen(value=>!value)}><History size={16}/>{historyOpen?'Hide history':'View history'}</button>
    {historyOpen&&<>
     <QueryFeedback loading={history.isPending} error={history.error} empty={history.data?.data.length===0}/>
     {history.data?.data.map(rev=><article key={rev.revision} className="policy-history-entry">
      <strong>Revision {rev.revision}</strong><span>Staff #{rev.actorId} · {rev.createdAt}</span>
      <p>{fields.filter(field=>rev.decisions[field]!==null).length} selected fields in saved snapshot</p>
     </article>)}
    </>}
   </Panel>}
  </>}
 </>;
}
