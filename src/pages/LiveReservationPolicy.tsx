import {useEffect,useState,type FormEvent} from 'react';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {ClipboardList,History,Save,ShieldAlert,RefreshCcw} from 'lucide-react';
import {useHotelAuth} from '../components/AuthProvider';
import {Heading,Panel} from '../components/ui';
import {QueryFeedback} from '../components/QueryFeedback';
import {ApiError} from '../api/http';
import {
 getReservationPolicyDraft,getReservationPolicyHistory,getReservationPolicyReadiness,updateReservationPolicyDraft,
 POLICY_FIELDS,type PolicyField,type PolicyDecisions,
} from '../api/reservationPolicy';

const fields=Object.keys(POLICY_FIELDS) as PolicyField[];
export function LiveReservationPolicy(){
 const {hotelId,user}=useHotelAuth();
 const admin=!!user?.hotels.some(h=>h.id===hotelId&&h.role==='admin');
 const queryClient=useQueryClient();
 const query=useQuery({queryKey:['reservation-policy',hotelId],queryFn:getReservationPolicyDraft});
 const readiness=useQuery({queryKey:['reservation-policy-readiness',hotelId],queryFn:getReservationPolicyReadiness});
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
   await queryClient.invalidateQueries({queryKey:['reservation-policy-readiness',hotelId]});
   setNotice('Draft saved. These decisions do not activate bookings.');
  }catch(caught){
   const message=caught instanceof Error?caught.message:'Could not save draft.';
   setError(message);
   if(caught instanceof ApiError&&caught.status===409)
    setNotice('Another administrator updated this draft. Reload to review the latest changes before editing.');
  }finally{setSaving(false);}
 }
 return <>
  <div className="notice"><strong>Planning only — not active</strong> · These selections are draft business decisions. Saving cannot create reservations or make rooms bookable.</div>
  <Heading title="Reservation policy draft" description="Hotel-scoped booking decisions for administrator review. Saving these choices does not activate them for reservations."/>
  <QueryFeedback loading={query.isPending} error={query.error}/>
  {draft&&choices&&<>
   <div className="settings-summary">
    <div><ClipboardList size={19}/><span>Saved version</span><strong>{draft.revision}</strong></div>
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
      <span className="guest-info">{complete?'All draft choices are selected. These changes are not active for bookings.':'Choose options or leave undecided fields blank.'}</span>
      {admin&&<button type="submit" className="btn-primary" disabled={saving||!modified}><Save size={16}/>{saving?'Saving…':'Save draft'}</button>}
     </div>
    </form>
   </Panel>
   <Panel title="Checks before activation">
    <p className="guest-info">These checks apply to the <strong>last saved version</strong>, not changes you have not saved. No policy is approved for bookings.</p>
    <QueryFeedback loading={readiness.isPending} error={readiness.error}/>
    {readiness.data&&<>
      <p className="guest-info">Saved version {readiness.data.data.draftRevision} · {readiness.data.data.configurationComplete?'All initial choices filled in':'Initial choices incomplete'} · Booking activation: <strong>Disabled</strong></p>
      <div className="policy-readiness-list">
       {readiness.data.data.issues.map(issue=><div key={issue.code} className="policy-readiness-item">
        <strong>{issue.category.replaceAll('_',' ')}</strong>
        <p>{issue.message}</p>
       </div>)}
      </div>
    </>}
   </Panel>
   {admin&&<Panel title="Draft change history">
    <button type="button" className="btn-inline" onClick={()=>setHistoryOpen(value=>!value)}><History size={16}/>{historyOpen?'Hide history':'View history'}</button>
    {historyOpen&&<>
     <QueryFeedback loading={history.isPending} error={history.error} empty={history.data?.data.length===0}/>
     {history.data?.data.map(rev=><article key={rev.revision} className="policy-history-entry">
      <strong>Version {rev.revision}</strong><span>Staff #{rev.actorId} · {rev.createdAt}</span>
      <p>{fields.filter(field=>rev.decisions[field]!==null).length} selected fields in that saved version</p>
     </article>)}
    </>}
   </Panel>}
  </>}
 </>;
}
