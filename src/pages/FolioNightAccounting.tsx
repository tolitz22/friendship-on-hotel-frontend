import {useEffect,useState} from 'react';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {z} from 'zod';
import {AlertTriangle,Calculator,CheckCircle2,LockKeyhole,RefreshCw} from 'lucide-react';
import {useLiveReservationDetail,useLiveReservationRecords} from '../api/liveReservations';
import {pesosToMinor} from './TaxPolicies';
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
 const [search,setSearch]=useState('');
 const [searchPage,setSearchPage]=useState(1);
 const [chargeFilter,setChargeFilter]=useState('all');
 const [showPicker,setShowPicker]=useState(true);
 const [showCorrection,setShowCorrection]=useState(false);
 const [correctionAck,setCorrectionAck]=useState<number|null>(null);
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
  setError('');setSuccess('');setSearch('');setSearchPage(1);setShowPicker(true);setShowCorrection(false);setCorrectionAck(null);
 },[hotelId]);
 const validBooking=/^[1-9]\d*$/.test(booking);
 const records=useLiveReservationRecords(searchPage,search);
 const bookingDetail=useLiveReservationDetail(validBooking?booking:null);
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
 useEffect(()=>{const match=assessments.data?.find(a=>a.folioEntryId===entryId);if(match&&match.id!==assessmentId)setAssessmentId(match.id);},[assessments.data,entryId,assessmentId]);
 const enabled=business.data?.folioTaxAccountingEnabled===true;
 const currentNight=nights.data?.find(n=>n.id===entryId);
 const availablePolicies=policies.data?.filter(p=>currentNight&&dateCovered(p,currentNight.stayDate))??[];
 const selectedAssessment=assessments.data?.find(a=>a.id===assessmentId);
 const selectedChargeAssessment=assessments.data?.find(a=>a.folioEntryId===entryId);
 const eligibleAmount=pesosToMinor(eligibleMinor);
 const assessmentStatus=(status:string|undefined)=>status==='approved'?'Approved':status==='pending'?'Awaiting review':status??'Needs assessment';
 function resetInputs(){setBenefitKind('none');setEligibleMinor('0');setReference('');setReason('');setAck(false);setCorrectionAck(null);setShowCorrection(false);}
 function chooseBooking(next:string){setChargeFilter('all');setBooking(next);setDraftBooking(next);setEntryId('');setAssessmentId('');setPolicyId('');setError('');setSuccess('');resetInputs();setShowPicker(false);}
 function selectCharge(n:z.infer<typeof night>){setEntryId(n.id);setAssessmentId(assessments.data?.find(a=>a.folioEntryId===n.id)?.id??'');setPolicyId('');setError('');setSuccess('');resetInputs();}
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
   setAck(false);setCorrectionAck(null);setShowCorrection(false);setSuccess(successMessage);
   await refresh();
  }catch(e){
   if(active())setError(e instanceof Error?e.message:'Unable to record accounting action.');
  }finally{setBusy(false);}
 }
 if(!admin)return <>
  <Heading title="Nightly Room Charges" description="A current hotel administrator is required."/>
  <Panel title="Restricted"><p>Only authorized hotel administrators can access accounting review.</p></Panel>
 </>;
 return <>
  <Heading title="Nightly Room Charges"
   description="Select a booking to review each night's room charge, tax allocation and earned revenue."/>
  <QueryFeedback loading={business.isPending} error={business.error} onRetry={()=>void business.refetch()}/>
  {business.data&&<p className="desk-muted">Business date: <strong>{readableDate(business.data.businessDate)}</strong> · {business.data.status==='open'?'Open':business.data.status}</p>}
  {business.isSuccess&&!enabled&&<Panel title="Finance activation required">
   <p role="status" className="night-audit-warning"><AlertTriangle size={18}/>
    This accounting workflow is deliberately disabled. An administrator must validate historical folios,
    tax compliance and system readiness before enabling this feature.
    Viewing existing nightly room charges remains read-only.</p>
  </Panel>}
  {success&&<p className="stay-feedback-success" role="status">{success}</p>}
  {error&&<p className="stay-feedback-error" role="alert">{error}</p>}
  <Panel title="Choose a booking">
   {validBooking&&<div className="desk-tools"><strong>{bookingDetail.data?.guestName??'Booking'} · {bookingDetail.data?.reference??'#'+booking}</strong>
    {bookingDetail.data&&<span>{readableDate(bookingDetail.data.checkIn)} – {readableDate(bookingDetail.data.checkOut)} · Room {bookingDetail.data.assignedRoomNumber??'Not assigned'}</span>}
    <button type="button" className="btn-inline" disabled={busy} aria-expanded={showPicker} onClick={()=>setShowPicker(v=>!v)}>{showPicker?'Hide booking search':'Change booking'}</button>
   </div>}
   {showPicker&&<>
    <label>Find a booking by guest or reference
     <input className="wizard-input" value={search} placeholder="Search bookings" onChange={e=>{setSearch(e.target.value);setSearchPage(1);}}/>
    </label>
    <QueryFeedback loading={records.isPending} error={records.error} onRetry={()=>void records.refetch()}/>
    {records.data?.data.length===0&&<p>No matching bookings. Try a different search.</p>}
    <div className="occupancy-coverage-rows">{records.data?.data.map(b=><article className="ex-record" key={b.id}>
     <div className="desk-tools"><strong>{b.guestName??'Guest'} · {b.reference}</strong><span>{readableDate(b.checkIn)} – {readableDate(b.checkOut)}</span><button className="btn-inline" type="button" disabled={busy} onClick={()=>chooseBooking(b.id)}>View charges</button></div>
    </article>)}</div>
    {records.data&&<div className="desk-tools"><button className="btn-inline" type="button" disabled={searchPage<=1||busy} onClick={()=>setSearchPage(p=>p-1)}>Previous</button><span>Page {searchPage} of {Math.max(1,records.data.meta.totalPages)}</span><button className="btn-inline" type="button" disabled={searchPage>=records.data.meta.totalPages||busy} onClick={()=>setSearchPage(p=>p+1)}>Next</button></div>}
    <details><summary>Find by internal booking number</summary>
   <form onSubmit={event=>{
    event.preventDefault();const next=draftBooking.trim();
    if(!busy&&/^[1-9]\d*$/.test(next))chooseBooking(next);
   }}>
    <div className="desk-tools">
     <label>Reservation ID
      <input className="wizard-input" inputMode="numeric" pattern="[1-9][0-9]*"
       value={draftBooking} onChange={e=>setDraftBooking(e.target.value)} required
       placeholder="Booking number"/>
     </label>
     <button className="btn-primary" type="submit" disabled={busy}>Load room charges</button>
     <button type="button" className="btn-inline" disabled={busy} onClick={()=>void refresh()}>
      <RefreshCw size={15}/> Refresh
     </button>
    </div>
   </form></details></>}
  </Panel>
  {validBooking&&<Panel title="Nightly charge register">
   <QueryFeedback loading={assessments.isPending} error={assessments.error} onRetry={()=>void assessments.refetch()}/>
   {nights.isSuccess&&<div className="night-audit-metrics">
    <div className="night-audit-metric"><small>Stay dates charged</small><strong>{nights.data.length}</strong></div>
    <div className="night-audit-metric"><small>Total room charges</small><strong>{peso(nights.data.reduce((sum,n)=>sum+n.amountMinor,0))}</strong></div>
    <div className="night-audit-metric"><small>Approved nights</small><strong>{assessments.isSuccess?nights.data.filter(n=>assessments.data.some(a=>a.folioEntryId===n.id&&a.status==='approved')).length:'—'}</strong></div>
    <div className="night-audit-metric"><small>Needs assessment</small><strong>{assessments.isSuccess?nights.data.filter(n=>!assessments.data.some(a=>a.folioEntryId===n.id)).length:'—'}</strong></div>
    <div className="night-audit-metric"><small>Awaiting review</small><strong>{assessments.isSuccess?assessments.data.filter(a=>a.status==='pending').length:'—'}</strong></div>
   </div>}
   {booking&&!validBooking&&<p role="alert">Enter a valid numeric reservation ID.</p>}
   <QueryFeedback loading={nights.isPending&&validBooking} error={nights.error}
    onRetry={()=>void nights.refetch()}/>
   {validBooking&&nights.data?.length===0&&<p>This reservation has no nightly room charges.</p>}
   {nights.data&&nights.data.length>0&&<>
    <div className="flex flex-wrap items-end justify-between gap-3 py-3">
     <label className="text-sm font-medium">Review status
      <select className="wizard-input" value={chargeFilter} onChange={e=>setChargeFilter(e.target.value)}>
       <option value="all">All charges</option><option value="unassessed" disabled={!assessments.isSuccess}>Needs assessment</option><option value="pending" disabled={!assessments.isSuccess}>Awaiting review</option><option value="approved" disabled={!assessments.isSuccess}>Approved</option>
      </select>
     </label>
     <button type="button" className="btn-inline" disabled={busy||nights.isFetching||assessments.isFetching} onClick={()=>void refresh()}><RefreshCw size={15}/> Refresh charges</button>
    </div>
    <div className="overflow-x-auto">
     <table className="w-full text-left text-sm">
      <caption className="sr-only">Nightly accommodation charges and tax review status</caption>
      <thead className="border-b"><tr><th scope="col" className="p-3">Stay date</th><th scope="col" className="p-3 text-right">Room charge</th><th scope="col" className="p-3">Tax review</th><th scope="col" className="p-3">Action</th></tr></thead>
      <tbody>{[...nights.data].filter(n=>chargeFilter==='all'||(assessments.isSuccess&&(assessments.data.find(a=>a.folioEntryId===n.id)?.status??'unassessed')===chargeFilter)).sort((a,b)=>a.stayDate.localeCompare(b.stayDate)).map(n=>{
       const a=assessments.data?.find(a=>a.folioEntryId===n.id);
       return <tr key={n.id} className={entryId===n.id?'border-b bg-slate-100 dark:bg-slate-800':'border-b'}>
        <td className="p-3"><strong className="whitespace-nowrap">{readableDate(n.stayDate)}</strong><div className="desk-muted text-xs">Charge #{n.id}</div></td>
        <td className="p-3 text-right font-semibold tabular-nums whitespace-nowrap">{peso(n.amountMinor)}</td>
        <td className="p-3"><span className={'inline-flex rounded-full px-2 py-1 text-xs font-medium '+(!assessments.isSuccess?'bg-slate-100 text-slate-700':a?.status==='approved'?'bg-emerald-100 text-emerald-800':a?.status==='pending'?'bg-amber-100 text-amber-900':'bg-slate-100 text-slate-700')}>{assessments.isSuccess?assessmentStatus(a?.status):'Unavailable'}</span></td>
        <td className="p-3"><button type="button" className={entryId===n.id?'btn-primary':'btn-inline'} disabled={busy||!assessments.isSuccess} aria-pressed={entryId===n.id} onClick={()=>selectCharge(n)}>{entryId===n.id?'Selected':a?'View details':'Review tax'}</button></td>
       </tr>;
      })}</tbody>
     </table>
    </div>
    {chargeFilter!=='all'&&assessments.isSuccess&&!nights.data.some(n=>(assessments.data.find(a=>a.folioEntryId===n.id)?.status??'unassessed')===chargeFilter)&&<p className="desk-muted py-4">No charges match this status. <button type="button" className="btn-inline" onClick={()=>setChargeFilter('all')}>Show all charges</button></p>}
   </>}
  </Panel>}
  {currentNight&&!selectedChargeAssessment&&assessments.isSuccess&&<Panel title={'Review tax treatment · '+readableDate(currentNight.stayDate)}>
   <p className="desk-muted">Existing folio charge: <strong>{peso(currentNight.amountMinor)}</strong>.
    Approval does not add another nightly room charge. VAT is posted as a separate liability.</p>
   <>
     <QueryFeedback loading={policies.isPending} error={policies.error} onRetry={()=>void policies.refetch()}/>
     {policies.isSuccess&&availablePolicies.length===0&&<p role="status">No approved tax policy covers this stay date. Review Tax Configuration first.</p>}
     <div className="desk-tools">
      <label>Approved tax policy
       <select className="wizard-input" value={policyId} onChange={e=>setPolicyId(e.target.value)}>
        <option value="">Select effective policy</option>
        {availablePolicies.map(p=><option key={p.id} value={p.id}>
         {({vat_standard:'Standard VAT',vat_zero:'Zero-rated VAT',vat_exempt:'VAT-exempt',non_vat:'Non-VAT'} as Record<string,string>)[p.classification]??p.classification} · {p.rate_bps/100}% · {p.price_mode==='inclusive'?'Tax included':'Tax added'}
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
      <label>Eligible portion of room charge (PHP)
       <input className="wizard-input" inputMode="decimal" value={eligibleMinor}
        onChange={e=>setEligibleMinor(e.target.value)}/>
      </label>
      <label>Verified evidence reference (not raw ID number)
       <input className="wizard-input" value={reference} maxLength={160}
        onChange={e=>setReference(e.target.value)} placeholder="Internal verification reference"/>
      </label>
     </div>}
     <p className="desk-muted">For mixed eligible and noneligible guests, enter only the eligible accommodation portion, verified using the hotel's statutory benefit procedure. One benefit kind only; stacking is not allowed.</p>
     <button type="button" className="btn-primary" disabled={busy||!enabled||!policyId||!availablePolicies.some(p=>String(p.id)===policyId)||
      (benefitKind!=='none'&&(eligibleAmount===null||eligibleAmount>currentNight.amountMinor||reference.trim().length<6))}
      onClick={()=>void send(root+'/folio-night-assessments',{
       folioEntryId:Number(entryId),taxPolicyId:Number(policyId),
       benefitKind,eligibleGrossMinor:benefitKind==='none'?0:eligibleAmount,
       evidenceReference:benefitKind==='none'?null:reference.trim(),
      },'Assessment prepared. A DIFFERENT hotel administrator must review and approve.')}>
      Prepare assessment for independent review
     </button>
    </>
  </Panel>}
  {selectedChargeAssessment&&<Panel title="Accounting details">
   {[selectedChargeAssessment].map(a=><article key={a.id} className="ex-record">
    <div className="desk-tools"><strong>{readableDate(a.stayDate)} · Assessment #{a.id}</strong>
     <span>{assessmentStatus(a.status)}</span></div>
    <div className="night-audit-metrics">
     <div className="night-audit-metric"><small>Gross room charge</small><strong>{peso(a.grossMinor)}</strong></div>
     <div className="night-audit-metric"><small>VAT liability</small><strong>{peso(a.vatMinor)}</strong></div>
     <div className="night-audit-metric"><small>Benefit / folio credit</small><strong>{peso(a.folioCreditMinor)}</strong></div>
     <div className="night-audit-metric"><small>Net room revenue</small><strong>{peso(a.roomRevenueMinor)}</strong></div>
    </div>
    <p className="desk-muted">Prepared by {actor(a.preparedBy)} · Reviewed by {a.reviewedBy?actor(a.reviewedBy):'Awaiting independent review'}.
     </p><details><summary>Accounting journal references</summary><p>Original source journal: {a.sourceJournalId??'pending'} · VAT journal: {a.vatJournalId??'none'}</p></details>
    <div className="desk-tools">
     {a.status==='approved'&&(!enabled||business.data?.status!=='open'||business.data?.businessDate!==a.stayDate)&&<p className="desk-muted">Revenue recognition requires enabled accounting and an open business date matching this stay date.</p>}
     {a.status==='approved'&&<button type="button" className="btn-inline"
      disabled={busy||!enabled||business.data?.status!=='open'||business.data?.businessDate!==a.stayDate}
      onClick={()=>void send(root+'/folio-night-assessments/'+a.id+'/recognize',{
       acknowledged:true,
      },'Earned room revenue reconciled with existing room charge accounting.')}>
      <Calculator size={15}/> Recognize earned room revenue
     </button>}
    </div>
   </article>)}
  </Panel>}
  {selectedAssessment&&<Panel title={selectedAssessment.status==='pending'?'Independent review':'Corrections and review history'}>
   {selectedAssessment.status==='pending'&&<>
    <p>This approval posts the accounting source and VAT liability, and applies a folio credit only for verified eligible benefits. The original room charge is not duplicated.</p>
    {selectedAssessment.preparedBy===String(userId)&&<p role="alert">You prepared this assessment. A different administrator must approve it.</p>}
    <label className="night-review-ack"><input type="checkbox" checked={ack} disabled={busy}
     onChange={e=>setAck(e.target.checked)}/>
     <span>I independently verified the folio amount, tax policy and benefit evidence and authorize the accounting entries.</span>
    </label>
    <button className="btn-primary" type="button"
     disabled={busy||!enabled||!ack||selectedAssessment.preparedBy===String(userId)}
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
    {corrections.isSuccess&&corrections.data.length===0&&<p className="desk-muted">No corrections recorded.</p>}
    {corrections.data?.map(c=><div className="ex-record" key={c.id}>
     <p><strong>{c.status==='pending'?'Correction awaiting approval':'Reviewed correction'}</strong> · {c.reason}</p>
     <p className="desk-muted">Prepared by {actor(String(c.prepared_by))} · {c.reviewed_by? 'Reviewed by '+actor(String(c.reviewed_by)):'Awaiting independent review'}</p>
     <p>Proposed VAT {peso(c.vat_minor)} · Room revenue {peso(c.room_revenue_minor)} · Folio credit {peso(c.folio_credit_minor)}</p>
     {c.status==='pending'&&<>
      <label className="night-review-ack"><input type="checkbox" checked={correctionAck===c.id} disabled={busy||!enabled||c.prepared_by===Number(userId)}
       onChange={e=>setCorrectionAck(e.target.checked?c.id:null)}/>
       <span>I independently verified the correction, its accounting impact and supporting evidence.</span>
      </label>
      <button type="button" className="btn-primary"
       disabled={busy||!enabled||correctionAck!==c.id||c.prepared_by===Number(userId)}
       onClick={()=>void send(root+'/folio-night-assessments/'+selectedAssessment.id+
        '/corrections/'+c.id+'/approve',{acknowledged:true},'Correction posted with immutable journal history.')}>
       Approve correction #{c.id}
      </button>
     </>}
    </div>)}
    {corrections.isSuccess&&!corrections.data.some(c=>c.status==='pending')&&<button type="button" className="btn-inline" disabled={busy||!enabled} aria-expanded={showCorrection} onClick={()=>setShowCorrection(v=>!v)}>{showCorrection?'Close correction form':'Prepare a correction'}</button>}
    {showCorrection&&corrections.isSuccess&&!corrections.data.some(c=>c.status==='pending')&&<>
     <h3>Prepare a reviewed correction</h3>
     <div className="desk-tools">
      <label>New eligibility
       <select className="wizard-input" value={benefitKind}
        onChange={e=>{setBenefitKind(e.target.value);setEligibleMinor('0');setReference('');}}>
        <option value="none">No benefit</option><option value="senior">Senior</option><option value="pwd">PWD</option>
       </select>
      </label>
      {benefitKind!=='none'&&<>
       <label>Eligible portion (PHP)
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
      disabled={busy||!enabled||reason.trim().length<15||
       (benefitKind!=='none'&&(eligibleAmount===null||eligibleAmount>selectedAssessment.grossMinor||reference.trim().length<6))}
      onClick={()=>void send(root+'/folio-night-assessments/'+selectedAssessment.id+'/corrections',{
       benefitKind,eligibleGrossMinor:benefitKind==='none'?0:eligibleAmount,
       evidenceReference:benefitKind==='none'?null:reference.trim(),reason:reason.trim(),
      },'Correction submitted. A different administrator must approve it.')}>
      Prepare correction
     </button>
    </>}
   </>}
  </Panel>}

  <p className="desk-preview-note"><AlertTriangle size={16}/>
   This is an accounting review workflow, not BIR-certified invoicing, verified payment settlement, or automated eligibility determination.
   Corrections on paid folios are blocked pending a separate refund/reconciliation workflow.</p>
 </>;
}
