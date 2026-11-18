import {useEffect,useState} from 'react';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {z} from 'zod';
import {AlertTriangle,Calculator,CheckCircle2,LockKeyhole,RefreshCw} from 'lucide-react';
import {getJson,requestJson} from '../api/http';
import {hotelPath,readSession} from '../api/session';
import {useHotelAuth} from '../components/AuthProvider';
import {Heading,Panel} from '../components/ui';
import {QueryFeedback} from '../components/QueryFeedback';
import {listHotelStaff} from '../api/liveStaff';
import {auditActorName} from '../components/ReadableAuditEvent';
import {readableDate} from '../lib/format';

const id=z.string().regex(/^[1-9]\d*$/);
const night=z.object({id,stayDate:z.string(),amountMinor:z.number().int().nonnegative()});
const assessment=z.object({
 id,hotelId:id,folioId:id,folioEntryId:id,taxPolicyId:id,stayDate:z.string(),
 status:z.string(),grossMinor:z.number(),benefitKind:z.string(),
 eligibleGrossMinor:z.number(),folioCreditMinor:z.number(),vatMinor:z.number(),
 roomRevenueMinor:z.number(),payableMinor:z.number(),preparedBy:id,
 reviewedBy:id.nullable(),sourceJournalId:id.nullable(),
 benefitJournalId:id.nullable(),vatJournalId:id.nullable(),
});
const correction=z.object({
 id:z.number(),assessment_id:z.number(),status:z.string(),
 reason:z.string(),prepared_by:z.number(),reviewed_by:z.number().nullable(),
 benefit_kind:z.string(),eligible_gross_minor:z.number(),
 vat_minor:z.number(),folio_credit_minor:z.number(),
 room_revenue_minor:z.number(),journal_id:z.number().nullable(),
});
const policy=z.object({
 id:z.number(),classification:z.string(),price_mode:z.string(),rate_bps:z.number(),
 status:z.string(),effective_from:z.string(),effective_until:z.string().nullable(),
});
function peso(minor:number){return new Intl.NumberFormat('en-PH',{style:'currency',currency:'PHP'}).format(minor/100);}
function dateCovered(p:z.infer<typeof policy>,stayDate:string){
 return p.status==='approved'&&p.effective_from<=stayDate&&(!p.effective_until||p.effective_until>=stayDate);
}

export function FolioNightAccounting(){
 const {hotelId,user}=useHotelAuth();
 const admin=!!hotelId&&!!user?.hotels.some(h=>h.id===hotelId&&h.role==='admin');
 const userId=user?.id??'';
 const staff=useQuery({queryKey:['hotel-staff',hotelId],queryFn:listHotelStaff,enabled:admin});
 const actor=(id:string)=>auditActorName(id,staff.data?.data.find(m=>m.userId===id)?.name,user?.id,user?.name);
 const client=useQueryClient();
 const [draftBooking,setDraftBooking]=useState('');
 const [booking,setBooking]=useState('');
 const [entryId,setEntryId]=useState('');
 const [policyId,setPolicyId]=useState('');
 const [assessmentId,setAssessmentId]=useState('');
 const [benefitKind,setBenefitKind]=useState('none');
 const [eligibleMinor,setEligibleMinor]=useState('0');
 const [reference,setReference]=useState('');
 const [reason,setReason]=useState('');
 const [ack,setAck]=useState(false);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [success,setSuccess]=useState('');
 useEffect(()=>{
  setDraftBooking('');setBooking('');setEntryId('');setPolicyId('');
  setAssessmentId('');setBenefitKind('none');setEligibleMinor('0');
  setReference('');setReason('');setAck(false);setBusy(false);
  setError('');setSuccess('');
 },[hotelId]);
 const validBooking=/^[1-9]\d*$/.test(booking);
 const root=validBooking?'/bookings/'+booking:'';
 const nights=useQuery({
  queryKey:['live','folio-accounting-nights',hotelId,booking],
  enabled:admin&&validBooking,
  queryFn:async()=>z.object({data:z.array(night)}).parse(
   await getJson<unknown>(hotelPath(root+'/folio-night-entries'))).data,
  retry:false,
 });
 const assessments=useQuery({
  queryKey:['live','folio-accounting-assessments',hotelId,booking],
  enabled:admin&&validBooking,
  queryFn:async()=>z.object({data:z.array(assessment)}).parse(
   await getJson<unknown>(hotelPath(root+'/folio-night-assessments'))).data,
  retry:false,
 });
 const policies=useQuery({
  queryKey:['live','tax-policies',hotelId],
  enabled:admin,
  queryFn:async()=>z.object({data:z.array(policy)}).parse(
   await getJson<unknown>(hotelPath('/finance/tax-policies'))).data,
  retry:false,
 });
 const business=useQuery({
  queryKey:['live','financial-business-day',hotelId],
  enabled:admin,
  queryFn:async()=>z.object({data:z.object({businessDate:z.string(),status:z.string(),folioTaxAccountingEnabled:z.boolean().default(false)})}).parse(
   await getJson<unknown>(hotelPath('/finance/business-day'))).data,
  retry:false,
 });
 const corrections=useQuery({
  queryKey:['live','folio-accounting-corrections',hotelId,booking,assessmentId],
  enabled:admin&&validBooking&&/^[1-9]\d*$/.test(assessmentId),
  queryFn:async()=>z.object({data:z.array(correction)}).parse(
   await getJson<unknown>(hotelPath(root+'/folio-night-assessments/'+assessmentId+'/corrections'))).data,
  retry:false,
 });
 const enabled=business.data?.folioTaxAccountingEnabled===true;
 const currentNight=nights.data?.find(n=>n.id===entryId);
 const availablePolicies=policies.data?.filter(p=>currentNight&&dateCovered(p,currentNight.stayDate))??[];
 const selectedAssessment=assessments.data?.find(a=>a.id===assessmentId);
 function active(){return !!hotelId&&readSession().hotelId===hotelId;}
 async function refresh(){
  await Promise.all([
   client.invalidateQueries({queryKey:['live','folio-accounting-nights',hotelId,booking]}),
   client.invalidateQueries({queryKey:['live','folio-accounting-assessments',hotelId,booking]}),
   client.invalidateQueries({queryKey:['live','folio-accounting-corrections',hotelId,booking]}),
   client.invalidateQueries({queryKey:['live','financial-business-day',hotelId]}),
   client.invalidateQueries({queryKey:['live','night-audit-preview',hotelId]}),
   client.invalidateQueries({queryKey:['live','folio-ledger',hotelId]}),
  ]);
 }
 async function send(path:string,body:Record<string,unknown>,successMessage:string){
  if(!enabled){setError('Room-night tax processing is not yet enabled. Ask the finance administrator to review the setup.');return;}
  if(!active()||busy||!validBooking)return;
  setBusy(true);setError('');setSuccess('');
  try{
   await requestJson<unknown>(hotelPath(path),{method:'POST',body});
   if(!active())return;
   setAck(false);setSuccess(successMessage);
   await refresh();
  }catch(e){
   if(active())setError(e instanceof Error?e.message:'Unable to record accounting action.');
  }finally{setBusy(false);}
 }
 if(!admin)return <>
  <Heading title="Folio-night accounting" description="A current hotel administrator is required."/>
  <Panel title="Restricted"><p>Only authorized hotel administrators can access accounting review.</p></Panel>
 </>;
 return <>
  <Heading title="Room-night tax & earned revenue"
   description="Prepare, independently review and recognize accounting against actual hotel reservation folio nights."/>
  {!enabled&&<Panel title="Finance activation required">
   <p role="status" className="night-audit-warning"><AlertTriangle size={18}/>
    This accounting workflow is deliberately disabled. An administrator must validate historical folios,
    tax compliance and system readiness before enabling this feature.
    Viewing existing room-night entries remains read-only.</p>
  </Panel>}
  <Panel title="Choose a priced reservation">
   <form onSubmit={event=>{
    event.preventDefault();const next=draftBooking.trim();
    setBooking(next);setEntryId('');setAssessmentId('');setPolicyId('');
    setError('');setSuccess('');setAck(false);
   }}>
    <div className="desk-tools">
     <label>Reservation ID
      <input className="wizard-input" inputMode="numeric" pattern="[1-9][0-9]*"
       value={draftBooking} onChange={e=>setDraftBooking(e.target.value)} required
       placeholder="Booking number"/>
     </label>
     <button className="btn-primary" type="submit">Load room nights</button>
     <button type="button" className="btn-inline" disabled={busy} onClick={()=>void refresh()}>
      <RefreshCw size={15}/> Refresh
     </button>
    </div>
   </form>
   {booking&&!validBooking&&<p role="alert">Enter a valid numeric reservation ID.</p>}
   <QueryFeedback loading={nights.isPending&&validBooking} error={nights.error}
    onRetry={()=>void nights.refetch()}/>
   {validBooking&&nights.data?.length===0&&<p>This reservation has no priced room-night entries.</p>}
   {nights.data&&<div className="occupancy-coverage-rows">
    {nights.data.map(n=><article key={n.id} className="ex-record">
     <div className="desk-tools">
      <strong>{readableDate(n.stayDate)} · Folio entry #{n.id}</strong>
      <span>{peso(n.amountMinor)}</span>
     </div>
     <p>Assessment: <strong>{assessments.data?.find(a=>a.folioEntryId===n.id)?.status??'Not prepared'}</strong></p>
     <button type="button" className="btn-inline" disabled={busy}
      onClick={()=>{
       setEntryId(n.id);setAssessmentId(assessments.data?.find(a=>a.folioEntryId===n.id)?.id??'');
       setPolicyId('');setAck(false);setError('');setSuccess('');
      }}>Select this room night</button>
    </article>)}
   </div>}
  </Panel>
  {currentNight&&<Panel title={'Review room night '+currentNight.stayDate}>
   <p className="desk-muted">Existing folio charge: <strong>{peso(currentNight.amountMinor)}</strong>.
    Approval does not add another room-night charge. VAT is posted as a separate liability.</p>
   {assessments.data?.some(a=>a.folioEntryId===entryId)
    ?<p>Assessment already recorded. Select it below to review, recognize, or correct it.</p>
    :<>
     <div className="desk-tools">
      <label>Approved tax policy
       <select className="wizard-input" value={policyId} onChange={e=>setPolicyId(e.target.value)}>
        <option value="">Select effective policy</option>
        {availablePolicies.map(p=><option key={p.id} value={p.id}>
         #{p.id} · {p.classification} · {p.rate_bps/100}% · {p.price_mode}
        </option>)}
       </select>
      </label>
      <label>Benefit eligibility
       <select className="wizard-input" value={benefitKind}
        onChange={e=>{setBenefitKind(e.target.value);setEligibleMinor('0');setReference('');}}>
        <option value="none">No statutory benefit</option>
        <option value="senior">Verified senior citizen</option>
        <option value="pwd">Verified PWD</option>
       </select>
      </label>
     </div>
     {benefitKind!=='none'&&<div className="desk-tools">
      <label>Eligible portion of room-night gross (centavos)
       <input className="wizard-input" inputMode="numeric" value={eligibleMinor}
        onChange={e=>setEligibleMinor(e.target.value)}/>
      </label>
      <label>Verified evidence reference (not raw ID number)
       <input className="wizard-input" value={reference} maxLength={160}
        onChange={e=>setReference(e.target.value)} placeholder="Internal verification reference"/>
      </label>
     </div>}
     <p className="desk-muted">For mixed eligible and noneligible guests, enter only the eligible accommodation portion, verified using the hotel's statutory benefit procedure. One benefit kind only; stacking is not allowed.</p>
     <button type="button" className="btn-primary" disabled={busy||!policyId||
      (benefitKind!=='none'&&(!/^\d+$/.test(eligibleMinor)||Number(eligibleMinor)>currentNight.amountMinor||reference.trim().length<6))}
      onClick={()=>void send(root+'/folio-night-assessments',{
       folioEntryId:Number(entryId),taxPolicyId:Number(policyId),
       benefitKind,eligibleGrossMinor:Number(eligibleMinor),
       evidenceReference:benefitKind==='none'?null:reference.trim(),
      },'Assessment prepared. A DIFFERENT hotel administrator must review and approve.')}>
      Prepare assessment for independent review
     </button>
    </>}
  </Panel>}
  {validBooking&&assessments.data&&assessments.data.length>0&&<Panel title="Manager accounting decisions">
   {assessments.data.map(a=><article key={a.id} className="ex-record">
    <div className="desk-tools"><strong>{readableDate(a.stayDate)} · Assessment #{a.id}</strong>
     <span>{a.status.toUpperCase()}</span></div>
    <div className="night-audit-metrics">
     <div className="night-audit-metric"><small>Room-night gross</small><strong>{peso(a.grossMinor)}</strong></div>
     <div className="night-audit-metric"><small>VAT liability</small><strong>{peso(a.vatMinor)}</strong></div>
     <div className="night-audit-metric"><small>Benefit / folio credit</small><strong>{peso(a.folioCreditMinor)}</strong></div>
     <div className="night-audit-metric"><small>Net room revenue</small><strong>{peso(a.roomRevenueMinor)}</strong></div>
    </div>
    <p className="desk-muted">Prepared by {actor(a.preparedBy)} · Reviewed by {a.reviewedBy?actor(a.reviewedBy):'Awaiting independent review'}.
     Original source journal: {a.sourceJournalId??'pending'} · VAT journal: {a.vatJournalId??'none'}</p>
    <div className="desk-tools">
     <button type="button" className="btn-inline" onClick={()=>{setAssessmentId(a.id);setAck(false);}}>
      {a.id===assessmentId?'Selected':'Select review / correction'}
     </button>
     {a.status==='approved'&&<button type="button" className="btn-inline"
      disabled={busy||business.data?.status!=='open'||business.data?.businessDate!==a.stayDate}
      onClick={()=>void send(root+'/folio-night-assessments/'+a.id+'/recognize',{
       acknowledged:true,
      },'Earned room revenue reconciled with existing folio-night accounting.')}>
      <Calculator size={15}/> Recognize on open stay date
     </button>}
    </div>
   </article>)}
  </Panel>}
  {selectedAssessment&&<Panel title={'Review assessment #'+selectedAssessment.id}>
   {selectedAssessment.status==='pending'&&<>
    <p>This approval posts the accounting source and VAT liability, and applies a folio credit only for verified eligible benefits. The original room-night charge is not duplicated.</p>
    {selectedAssessment.preparedBy===String(userId)&&<p role="alert">You prepared this assessment. A different administrator must approve it.</p>}
    <label className="night-review-ack"><input type="checkbox" checked={ack} disabled={busy}
     onChange={e=>setAck(e.target.checked)}/>
     <span>I independently verified the folio amount, tax policy and benefit evidence and authorize the accounting entries.</span>
    </label>
    <button className="btn-primary" type="button"
     disabled={busy||!ack||selectedAssessment.preparedBy===String(userId)}
     onClick={()=>void send(root+'/folio-night-assessments/'+selectedAssessment.id+'/approve',{
      acknowledged:true,
     },'Assessment approved. VAT and benefit postings are recorded once.')}>
     <LockKeyhole size={15}/> Approve accounting allocation
    </button>
   </>}
   {selectedAssessment.status==='approved'&&<>
    <p className="night-audit-clean"><CheckCircle2 size={16}/> Approved accounting allocation. Corrections are append-only and require a second reviewer.</p>
    <h3>Correction history</h3>
    <QueryFeedback loading={corrections.isPending} error={corrections.error}
     onRetry={()=>void corrections.refetch()}/>
    {corrections.data?.map(c=><div className="ex-record" key={c.id}>
     <p><strong>{c.status==='pending'?'Correction awaiting approval':'Reviewed correction'}</strong> · {c.reason}</p>
     <p className="desk-muted">Prepared by {actor(String(c.prepared_by))} · {c.reviewed_by? 'Reviewed by '+actor(String(c.reviewed_by)):'Awaiting independent review'}</p>
     <p>Proposed VAT {peso(c.vat_minor)} · Room revenue {peso(c.room_revenue_minor)} · Folio credit {peso(c.folio_credit_minor)}</p>
     {c.status==='pending'&&<>
      <label className="night-review-ack"><input type="checkbox" checked={ack} disabled={busy}
       onChange={e=>setAck(e.target.checked)}/>
       <span>I independently verified the correction, its accounting impact and supporting evidence.</span>
      </label>
      <button type="button" className="btn-primary"
       disabled={busy||!ack||c.prepared_by===Number(userId)}
       onClick={()=>void send(root+'/folio-night-assessments/'+selectedAssessment.id+
        '/corrections/'+c.id+'/approve',{acknowledged:true},'Correction posted with immutable journal history.')}>
       Approve correction #{c.id}
      </button>
     </>}
    </div>)}
    {!corrections.data?.some(c=>c.status==='pending')&&<>
     <h3>Prepare a reviewed correction</h3>
     <div className="desk-tools">
      <label>New eligibility
       <select className="wizard-input" value={benefitKind}
        onChange={e=>{setBenefitKind(e.target.value);setEligibleMinor('0');setReference('');}}>
        <option value="none">No benefit</option><option value="senior">Senior</option><option value="pwd">PWD</option>
       </select>
      </label>
      {benefitKind!=='none'&&<>
       <label>Eligible portion (centavos)
        <input className="wizard-input" value={eligibleMinor} onChange={e=>setEligibleMinor(e.target.value)}/>
       </label>
       <label>Verification reference
        <input className="wizard-input" value={reference} onChange={e=>setReference(e.target.value)}/>
       </label>
      </>}
     </div>
     <label className="night-review-note">Correction reason
      <textarea className="wizard-input" rows={3} value={reason} maxLength={500}
       onChange={e=>setReason(e.target.value)}/>
     </label>
     <button type="button" className="btn-primary"
      disabled={busy||reason.trim().length<15||
       (benefitKind!=='none'&&(!/^\d+$/.test(eligibleMinor)||reference.trim().length<6))}
      onClick={()=>void send(root+'/folio-night-assessments/'+selectedAssessment.id+'/corrections',{
       benefitKind,eligibleGrossMinor:Number(eligibleMinor),
       evidenceReference:benefitKind==='none'?null:reference.trim(),reason:reason.trim(),
      },'Correction submitted. A different administrator must approve it.')}>
      Prepare correction
     </button>
    </>}
   </>}
  </Panel>}
  {success&&<p className="stay-feedback-success" role="status">{success}</p>}
  {error&&<p className="stay-feedback-error" role="alert"><AlertTriangle size={16}/>{error}</p>}
  <p className="desk-preview-note"><AlertTriangle size={16}/>
   This is an accounting review workflow, not BIR-certified invoicing, verified payment settlement, or automated eligibility determination.
   Corrections on paid folios are blocked pending a separate refund/reconciliation workflow.</p>
 </>;
}
