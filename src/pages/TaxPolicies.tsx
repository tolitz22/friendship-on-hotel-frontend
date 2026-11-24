import {useEffect,useState} from 'react';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {z} from 'zod';
import {
 AlertTriangle,BadgePercent,Calculator,CheckCircle2,ClipboardCheck,
 Clock3,FileCheck2,RefreshCw,ShieldCheck,
} from 'lucide-react';
import {getJson,requestJson} from '../api/http';
import {hotelPath,readSession} from '../api/session';
import {useHotelAuth} from '../components/AuthProvider';
import {Heading,Panel} from '../components/ui';
import {QueryFeedback} from '../components/QueryFeedback';
import {readableDate,readableDateTime} from '../lib/format';

const policySchema=z.object({
 id:z.number(),hotel_id:z.number(),classification:z.string(),
 price_mode:z.string(),rate_bps:z.number(),effective_from:z.string(),
 effective_until:z.string().nullable(),status:z.string(),
 created_by:z.number().nullable().optional(),created_by_name:z.string().nullable().optional(),
 created_at:z.string().optional(),approved_by:z.number().nullable(),
 approved_by_name:z.string().nullable().optional(),approved_at:z.string().nullable(),
 review_note:z.string().nullable(),
});
type Policy=z.infer<typeof policySchema>;
const policyListSchema=z.object({data:z.array(policySchema)});
const breakdownSchema=z.object({
 policy_id:z.string(),effective_date:z.string(),preview_only:z.literal(true),
 folio_updated:z.literal(false),journal_posted:z.literal(false),
 breakdown:z.object({
  classification:z.string(),price_mode:z.string(),rate_bps:z.number(),
  base_minor:z.number(),tax_minor:z.number(),total_minor:z.number(),
 }),
});
type Preview=z.infer<typeof breakdownSchema>;

const classifications=[
 {value:'vat_standard',label:'VAT standard',help:'Standard taxable VAT treatment for a VAT-registered hotel. Registration and rate must be independently confirmed.'},
 {value:'vat_zero',label:'VAT zero-rated',help:'Zero rating is permitted only where documented legal eligibility exists; selecting it does not establish eligibility.'},
 {value:'vat_exempt',label:'VAT-exempt',help:'Exemption requires documented legal eligibility. This selection does not grant an exemption.'},
 {value:'non_vat',label:'Non-VAT',help:'For hotels properly registered outside the VAT system; confirm registration and applicable tax obligations.'},
] as const;
const validDate=(s:string)=>/^\d{4}-\d{2}-\d{2}$/.test(s)&&!Number.isNaN(Date.parse(s))&&new Date(s+'T00:00:00Z').toISOString().slice(0,10)===s;
const rangeOverlap=(from:string,until:string|null,p:Policy)=>
 from<=(p.effective_until??'9999-12-31')&&p.effective_from<=(until??'9999-12-31');
export const pesosToMinor=(input:string):number|null=>{
 const value=input.trim();
 if(!/^\d+(?:\.\d{1,2})?$/.test(value))return null;
 const [pesos,cents='']=value.split('.');
 const minor=Number(pesos)*100+Number(cents.padEnd(2,'0'));
 return Number.isSafeInteger(minor)&&minor<=1_000_000_000_000?minor:null;
};
export const percentToBps=(input:string):number|null=>{
 if(!/^\d+(?:\.\d{1,2})?$/.test(input.trim()))return null;
 const minor=pesosToMinor(input);
 return minor!==null&&minor<=10000?minor:null;
};
const peso=(minor:number)=>new Intl.NumberFormat('en-PH',{style:'currency',currency:'PHP'}).format(minor/100);
const fmt=(date:string)=>readableDate(date);
const policyLabel=(p:Pick<Policy,'classification'|'price_mode'|'rate_bps'>)=>
 (classifications.find(c=>c.value===p.classification)?.label??p.classification)+' · '+
 (p.price_mode==='inclusive'?'Inclusive':'Exclusive')+' · '+(p.rate_bps/100).toFixed(2)+'%';
const effectiveOn=(p:Policy,date:string)=>p.status==='approved'&&p.effective_from<=date&&(!p.effective_until||date<=p.effective_until);

export function TaxPolicies(){
 const {user,hotelId}=useHotelAuth();
 const admin=!!hotelId&&!!user?.hotels.some(h=>h.id===hotelId&&h.role==='admin');
 const client=useQueryClient();
 const [classification,setClassification]=useState('vat_standard');
 const [priceMode,setPriceMode]=useState('inclusive');
 const [percent,setPercent]=useState('12.00');
 const [from,setFrom]=useState('');
 const [until,setUntil]=useState('');
 const [note,setNote]=useState('');
 const [busy,setBusy]=useState(false);
 const [approveId,setApproveId]=useState<number|null>(null);
 const [ack,setAck]=useState(false);
 const [draftError,setDraftError]=useState('');
 const [draftSuccess,setDraftSuccess]=useState('');
 const [approvalError,setApprovalError]=useState('');
 const [approvalSuccess,setApprovalSuccess]=useState('');
 const [previewError,setPreviewError]=useState('');
 const [previewDate,setPreviewDate]=useState('');
 const [previewAmount,setPreviewAmount]=useState('');
 const [preview,setPreview]=useState<Preview|null>(null);
 const [showHistory,setShowHistory]=useState(false);
 const [showDraft,setShowDraft]=useState(false);
 const [touched,setTouched]=useState({rate:false,from:false,until:false,note:false});

 useEffect(()=>{
  setClassification('vat_standard');setPriceMode('inclusive');setPercent('12.00');
  setFrom('');setUntil('');setNote('');setBusy(false);setApproveId(null);
  setAck(false);setDraftError('');setDraftSuccess('');setApprovalError('');setApprovalSuccess('');
  setPreviewError('');setPreview(null);setPreviewDate('');setPreviewAmount('');
  setShowHistory(false);setShowDraft(false);setTouched({rate:false,from:false,until:false,note:false});
 },[hotelId]);

 const query=useQuery({
  queryKey:['live','tax-policies',hotelId],enabled:admin,
  queryFn:async():Promise<Policy[]>=>policyListSchema.parse(
   await getJson<unknown>(hotelPath('/finance/tax-policies'))).data,
  retry:false,
 });
 const policies=query.data??[];
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Manila',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const current=policies.find(p=>effectiveOn(p,today));
 const upcoming=policies.filter(p=>p.status==='approved'&&p.effective_from>today)
  .sort((a,b)=>a.effective_from.localeCompare(b.effective_from))[0];
 const selectedPolicy=previewDate?policies.filter(p=>effectiveOn(p,previewDate)):[];
 const rateBps=percentToBps(percent);
 const rateError=rateBps===null?'Enter a valid percentage between 0 and 100 with at most two decimal places.':
  classification!=='vat_standard'&&rateBps!==0?'This classification requires a 0.00% rate.':'';
 const fromError=!validDate(from)?'Select a valid effective start date.':'';
 const untilError=until&&(!validDate(until)||until<from)?'The end date must be on or after the start date.':'';
 const noteError=note.trim().length<15?'Add a finance review note with at least 15 characters.':'';
 const conflicts=validDate(from)&&!untilError?policies.filter(p=>p.status==='approved'&&rangeOverlap(from,until||null,p)):[];
 const canDraft=query.isSuccess&&!busy&&!rateError&&!fromError&&!untilError&&!noteError&&conflicts.length===0;
 const previewMinor=pesosToMinor(previewAmount);
 const applicablePolicy=selectedPolicy.length===1?selectedPolicy[0]:null;
 const reviewPolicy=policies.find(p=>p.id===approveId);
 const selfApproval=!!reviewPolicy&&reviewPolicy.created_by!=null&&String(reviewPolicy.created_by)===user?.id;
 const legacyApproval=!!reviewPolicy&&reviewPolicy.created_by==null;
 function safeHotel(){return !!hotelId&&readSession().hotelId===hotelId;}

 async function createDraft(){
  if(!safeHotel()||!canDraft||rateBps===null)return;
  setBusy(true);setDraftError('');setDraftSuccess('');
  try{
   await requestJson<unknown>(hotelPath('/finance/tax-policies'),{
    method:'POST',body:{classification,priceMode,rateBps,
     effectiveFrom:from,effectiveUntil:until||null,reviewNote:note.trim()},
   });
   if(!safeHotel())return;
   setNote('');setShowDraft(false);setTouched({rate:false,from:false,until:false,note:false});
   setDraftSuccess('Draft saved. A different authorized administrator must review and approve it. No folio or journal was changed.');
   await client.invalidateQueries({queryKey:['live','tax-policies',hotelId]});
  }catch(e){if(safeHotel())setDraftError(e instanceof Error?e.message:'Unable to save draft.');}
  finally{setBusy(false);}
 }
 async function approve(){
  if(!safeHotel()||busy||approveId===null||!ack||selfApproval||legacyApproval)return;
  setBusy(true);setApprovalError('');setApprovalSuccess('');
  try{
   await requestJson<unknown>(hotelPath('/finance/tax-policies/'+approveId+'/approve'),{
    method:'POST',body:{acknowledged:true},
   });
   if(!safeHotel())return;
   setApprovalSuccess('Policy approved for previews on its effective dates. No guest charges or accounting journals were posted.');
   setApproveId(null);setAck(false);
   await client.invalidateQueries({queryKey:['live','tax-policies',hotelId]});
  }catch(e){if(safeHotel())setApprovalError(e instanceof Error?e.message:'Approval failed.');}
  finally{setBusy(false);}
 }
 async function calculate(){
  if(!safeHotel()||busy)return;
  setPreviewError('');setPreview(null);
  if(!validDate(previewDate)||previewMinor===null||!applicablePolicy){
   setPreviewError(!applicablePolicy?'No approved tax policy applies to this date. Choose a date covered by exactly one approved policy.':'Enter a valid date and PHP amount with at most two decimal places.');return;
  }
  try{
   const result=breakdownSchema.parse((await getJson<unknown>(
    hotelPath('/finance/tax-preview'),{date:previewDate,amountMinor:String(previewMinor)}
   ) as {data:unknown}).data);
   if(safeHotel()&&result.effective_date===previewDate&&String(applicablePolicy.id)===result.policy_id)
    setPreview(result);
   else if(safeHotel())setPreviewError('The applicable policy changed. Refresh and calculate the preview again.');
  }catch(e){if(safeHotel())setPreviewError(e instanceof Error?e.message:'Tax preview is unavailable.');}
 }
 if(!admin)return <>
  <Heading title="Tax configuration" description="Hotel administrator access required."/>
  <Panel title="Restricted"><p>Only active hotel administrators can review tax policies.</p></Panel>
 </>;
 const sample=priceMode==='inclusive'?112000:100000;
 const sampleTax=rateBps===null?null:priceMode==='inclusive'?
  Math.round(sample*rateBps/(10000+rateBps)):
  Math.round(sample*rateBps/10000);
 const treatment=classifications.find(x=>x.value===classification);
 const approved=policies.some(p=>p.status==='approved');
 const hasDraft=policies.some(p=>p.status==='draft');
 return <main className="tax-page">
  <Heading title="Tax configuration" description="Manage hotel tax policies, review proposed changes and preview guest pricing."
   action={<span className="tax-page-badge"><ShieldCheck size={15}/> Preview-only controls</span>}/>
  <QueryFeedback loading={query.isPending} error={query.error} onRetry={()=>void query.refetch()}/>
  <section className="tax-overview" aria-label="Tax configuration overview">
  <Panel title="Current configuration">
   <div className="tax-state">
    <span className={'tax-state-icon '+(current?'is-approved':hasDraft?'is-pending':'')} aria-hidden="true">
     {current?<CheckCircle2 size={23}/>:hasDraft?<Clock3 size={23}/>:<BadgePercent size={23}/>}</span>
    <div><small>CONFIGURATION STATUS</small>
     <strong>{query.isPending?'Loading tax configuration…':query.isError?'Configuration unavailable':current?'Current approved preview policy':upcoming?'Approved — starts on '+fmt(upcoming.effective_from):hasDraft?'Draft awaiting independent review':'Tax configuration not started'}</strong>
     <p>{current?policyLabel(current):query.isSuccess?'No approved policy applies to today.':''}</p>
     {current&&<p>Effective {fmt(current.effective_from)} – {current.effective_until?fmt(current.effective_until):'No planned end'}</p>}
     {current&&upcoming&&<p>Next approved policy: {policyLabel(upcoming)} · Starts {fmt(upcoming.effective_from)}</p>}
     {query.isSuccess&&<p>{policies.filter(p=>p.status==='draft').length} drafts awaiting review</p>}
     <span>Automatic guest tax calculation: Not enabled by this page · Guest folios and journals affected: No</span>
    </div>
   </div>
   <div className="tax-workflow" aria-label="Tax policy approval workflow">
    <div className={'tax-workflow-step '+(policies.length?'is-complete':'is-active')}>
     <span>1</span><div><strong>Prepare draft</strong><small>Define treatment and dates</small></div>
    </div>
    <div className={'tax-workflow-step '+(approved?'is-complete':hasDraft?'is-active':'')}>
     <span>2</span><div><strong>Independent review</strong><small>A different admin verifies it</small></div>
    </div>
    <div className={'tax-workflow-step '+(approved?'is-complete':'')}>
     <span>3</span><div><strong>Preview approved</strong><small>No folio or journal posting</small></div>
    </div>
   </div>
   <button type="button" className="btn-primary tax-overview-action" aria-expanded={showDraft} aria-controls="tax-draft-panel" disabled={!query.isSuccess||busy} onClick={()=>setShowDraft(v=>!v)}>
    <ClipboardCheck size={16}/> {showDraft?'Close draft editor':'Prepare draft policy'}
   </button>
  </Panel>
  </section>

  {draftSuccess&&<p className="stay-feedback-success" role="status">{draftSuccess}</p>}
  {showDraft&&<section id="tax-draft-panel" className="tax-form-panel tax-main-card" aria-labelledby="tax-draft-heading">
   <Panel title="Prepare a tax policy draft">
    <h3 id="tax-draft-heading" className="tax-section-heading">1. Tax treatment</h3>
    <div className="tax-form-grid">
     <label>Classification
      <select className="wizard-input" value={classification} onChange={e=>{
       const value=e.target.value;setClassification(value);setPercent(value==='vat_standard'?'12.00':'0.00');
      }}>{classifications.map(x=><option key={x.value} value={x.value}>{x.label}</option>)}</select>
     </label>
     <label>Pricing method
      <select className="wizard-input" value={priceMode} onChange={e=>setPriceMode(e.target.value)}>
       <option value="inclusive">VAT inclusive — already in entered price</option>
       <option value="exclusive">VAT exclusive — added to entered price</option>
      </select>
     </label>
     <label>Tax rate (%)
      <span className="tax-input-unit"><input className="wizard-input" type="text" inputMode="decimal"
       aria-describedby={touched.rate&&rateError?'tax-rate-help tax-rate-error':'tax-rate-help'} value={percent}
       onBlur={()=>setTouched(value=>({...value,rate:true}))}
       onChange={e=>setPercent(e.target.value)} placeholder="12.00"/><span>%</span></span>
      <small id="tax-rate-help">Enter the percentage, not basis points.</small>
      {touched.rate&&rateError&&<small id="tax-rate-error" className="tax-field-error">{rateError}</small>}
     </label>
    </div>
    <p className="desk-muted">{treatment?.help}</p>
    <div className="tax-example" aria-live="polite">
     <strong>{priceMode==='inclusive'?'Example · Price includes tax':'Example · Tax added to price'}</strong>
     <p>{sampleTax===null?'Enter a valid percentage to see an example.':
      priceMode==='inclusive'?'A '+peso(sample)+' entered price contains approximately '+peso(sampleTax)+' of tax; the entered total remains '+peso(sample)+'.':
      'A '+peso(sample)+' entered price adds approximately '+peso(sampleTax)+' of tax, totaling '+peso(sample+sampleTax)+'.'}</p>
     <small>Illustration only. Tax treatment is not legally verified and may involve rounding rules.</small>
    </div>

    <h3 className="tax-section-heading">2. Effective period</h3>
    <div className="tax-form-grid">
     <label>Effective from
      <input className="wizard-input" type="date" value={from}
       aria-describedby={touched.from&&fromError?'tax-from-error':undefined}
       onBlur={()=>setTouched(value=>({...value,from:true}))} onChange={e=>setFrom(e.target.value)}/>
      {touched.from&&fromError&&<small id="tax-from-error" className="tax-field-error">{fromError}</small>}
     </label>
     <label>Effective until (optional)
      <input className="wizard-input" type="date" value={until} min={from||undefined}
       aria-describedby={touched.until&&untilError?'tax-until-help tax-until-error':'tax-until-help'}
       onBlur={()=>setTouched(value=>({...value,until:true}))}
       onChange={e=>setUntil(e.target.value)}/>
      <small id="tax-until-help">The end date is inclusive. Blank means no planned end.</small>
      {touched.until&&untilError&&<small id="tax-until-error" className="tax-field-error">{untilError}</small>}
     </label>
    </div>
    {conflicts.length>0&&<p className="tax-field-error" role="alert">
     Your draft overlaps an approved policy ({conflicts.map(p=>'#'+p.id).join(', ')}). Adjust the effective dates before saving. The server will check again on approval.
    </p>}
    <h3 className="tax-section-heading">3. Finance review evidence</h3>
    <label className="tax-note-field">Finance review note
     <textarea className="wizard-input" rows={3} maxLength={2000} value={note}
      aria-describedby={touched.note&&noteError?'tax-note-error':undefined}
      onBlur={()=>setTouched(value=>({...value,note:true}))}
      onChange={e=>setNote(e.target.value)}
      placeholder="Document registration, rate treatment, effective dates, and evidence for independent review."/>
     {touched.note&&noteError&&<small id="tax-note-error" className="tax-field-error">{noteError}</small>}
    </label>
    <div className="tax-draft-summary">
     <strong>Draft summary</strong>
     <p>{treatment?.label} · {percent||'—'}% · {priceMode==='inclusive'?'Prices include tax':'Tax added to prices'}</p>
     <p>{validDate(from)?fmt(from):'Start date required'} {until?'through '+(validDate(until)?fmt(until):'invalid end date'):'onward (open-ended)'}</p>
     <small>Saving creates a draft only. It does not approve a policy, post journals, change guest folios, or establish tax eligibility.</small>
    </div>
    {!canDraft&&<div className="tax-prerequisites" role="status">
     <strong>Before this draft can be saved</strong>
     <ul>
      {fromError&&<li>Select a valid effective start date.</li>}
      {rateError&&<li>Enter a valid rate for this classification.</li>}
      {noteError&&<li>Write a finance review note of at least 15 characters.</li>}
      {untilError&&<li>Correct the effective end date.</li>}
      {conflicts.length>0&&<li>Resolve the overlap with an approved policy.</li>}
     </ul>
    </div>}
    {draftError&&<p className="stay-feedback-error" role="alert">{draftError}</p>}

    <button type="button" className="btn-primary tax-primary-action" disabled={!canDraft}
     aria-describedby={!canDraft?'tax-save-help':undefined} onClick={()=>void createDraft()}>
     <ClipboardCheck size={16}/>{busy?'Saving…':'Save draft policy'}
    </button>
    <small id="tax-save-help">Requires complete, valid inputs and no known overlap with approved periods.</small>
    <button type="button" className="btn-inline" disabled={busy} onClick={()=>setShowDraft(false)}>Close editor (keep inputs)</button>
   </Panel>
  </section>}

  <div className="tax-support-grid">
  <div className="tax-support-card tax-review-card">
  <Panel title={`Independent review (${policies.filter(p=>p.status==='draft').length})`}>
   <div className="tax-card-intro"><span><FileCheck2 size={19}/></span><p>A different authorized hotel administrator must approve each draft. The creator cannot approve their own policy. Older drafts without a verified creator must be recreated.</p></div>
   <div className="desk-tools"><button type="button" className="btn-inline" onClick={()=>void query.refetch()} disabled={query.isFetching}>
    <RefreshCw size={15}/> Refresh policies
   </button></div>
   {query.isSuccess&&policies.filter(p=>p.status==='draft').length===0&&<p className="desk-muted">No drafts currently awaiting review.</p>}
   {policies.filter(p=>p.status==='draft').map(p=><article className="tax-policy-row" key={p.id}>
    <div><strong>Draft #{p.id} · {policyLabel(p)}</strong>
     <small>Created by {p.created_by_name??'Unverified legacy creator'} · {p.created_at?readableDateTime(p.created_at):'Date unavailable'}</small>
     <small>Effective {fmt(p.effective_from)} – {p.effective_until?fmt(p.effective_until):'open-ended'}</small>
     {p.review_note&&<details><summary>Finance review note</summary><p>{p.review_note}</p></details>}
    </div>
    <button type="button" className="btn-inline" disabled={busy}
     onClick={()=>{setApproveId(p.id);setAck(false);setApprovalError('');setApprovalSuccess('');}}>
     <ShieldCheck size={15}/> Review draft
    </button>
   </article>)}
   {reviewPolicy&&<div className="night-review-panel" aria-label="Independent tax policy approval">
    <h3>Review draft #{reviewPolicy.id}</h3>
    <p>{policyLabel(reviewPolicy)} · {fmt(reviewPolicy.effective_from)} – {reviewPolicy.effective_until?fmt(reviewPolicy.effective_until):'open-ended'}</p>
    <p>Creator: {reviewPolicy.created_by_name??'Unknown'} · Reviewer: {user?.name??'Current administrator'}</p>
    {(selfApproval||legacyApproval)&&<p className="tax-field-error" role="alert">
     {selfApproval?'You created this draft. A different authorized administrator must approve it.':'This legacy draft has no verified creator and cannot be independently approved. Create a new draft.'}
    </p>}
    <p>Approval permits previews on covered dates only. No journal postings, guest charges, tax invoices, or settlements are created.</p>
    <label className="night-review-ack"><input type="checkbox" checked={ack}
     disabled={busy||selfApproval||legacyApproval} onChange={e=>setAck(e.target.checked)}/>
     <span>I independently reviewed registration, treatment, legal eligibility, and effective period with the responsible finance team.</span>
    </label>
    {approvalError&&<p role="alert" className="stay-feedback-error">{approvalError}</p>}
    <div className="desk-tools">
     <button type="button" className="btn-primary" disabled={!ack||busy||selfApproval||legacyApproval}
      onClick={()=>void approve()}>{busy?'Approving…':'Approve policy for previews'}</button>
     <button type="button" className="btn-inline" disabled={busy} onClick={()=>{setApproveId(null);setAck(false);}}>Cancel review</button>
    </div>
   </div>}
   {approvalSuccess&&<p className="stay-feedback-success" role="status">{approvalSuccess}</p>}
  </Panel>
  </div>

  <div className="tax-support-card tax-preview-card">
  <Panel title="Approved policy preview">
   <div className="tax-card-intro"><span><Calculator size={19}/></span><p>Calculate an illustration using the approved policy covering the preview date. No guest charges or journals are posted.</p></div>
   <div className="tax-form-grid">
    <label>Preview date
     <input className="wizard-input" type="date" value={previewDate}
      onChange={e=>{setPreviewDate(e.target.value);setPreview(null);setPreviewError('');}}/>
    </label>
    <label>Input amount (PHP)
     <span className="tax-input-unit"><span>₱</span><input type="text" inputMode="decimal"
      className="wizard-input" value={previewAmount} placeholder="1120.00"
      aria-describedby="tax-preview-amount-help" onChange={e=>{setPreviewAmount(e.target.value);setPreview(null);setPreviewError('');}}/></span>
     <small id="tax-preview-amount-help">Enter pesos and centavos normally, for example 1120.00.</small>
    </label>
   </div>
   {current&&<button type="button" className="btn-inline" onClick={()=>{setPreviewDate(today);setPreview(null);setPreviewError('');}}>Use today's policy</button>}
   <div className="tax-applicable-policy" role="status">
    {!validDate(previewDate)?'Select a preview date to find the applicable policy.':
     applicablePolicy?'Applicable policy: #'+applicablePolicy.id+' · '+policyLabel(applicablePolicy):
     selectedPolicy.length>1?'Multiple approved policies cover this date. Resolve the overlap before calculating.':'No approved policy applies to '+fmt(previewDate)+'. No tax preview can be calculated for that date.'}
   </div>
   {previewError&&<p className="stay-feedback-error" role="alert">{previewError}</p>}
   <button type="button" className="btn-primary tax-primary-action" disabled={busy||!applicablePolicy||previewMinor===null}
    onClick={()=>void calculate()}><Calculator size={16}/> Calculate preview</button>
   {preview&&<div className="tax-preview-result" role="status" aria-live="polite">
    <strong>Policy #{preview.policy_id} · {policyLabel(preview.breakdown)} · {fmt(preview.effective_date)}</strong>
    <dl className="readable-audit-changes">
     <div><dt>Entered amount</dt><dd>{previewMinor===null?'—':peso(previewMinor)}</dd></div>
     <div><dt>Net amount before tax</dt><dd>{peso(preview.breakdown.base_minor)}</dd></div>
     <div><dt>{preview.breakdown.price_mode==='inclusive'?'Tax included in price':'Tax added to price'}</dt><dd>{peso(preview.breakdown.tax_minor)}</dd></div>
     <div><dt>Total guest price (preview)</dt><dd>{peso(preview.breakdown.total_minor)}</dd></div>
    </dl>
    <p className="gb-attention-note">Preview only — nothing was posted to a guest folio or accounting journal. This is not a tax invoice or final guest balance.</p>
   </div>}
   <p className="desk-muted">Entered amounts must already reflect independently validated discounts. The preview does not confirm statutory eligibility or money received.</p>
  </Panel>
  </div>
  </div>

  <details className="workflow-disclosure tax-safeguards"><summary><AlertTriangle size={16}/> Accounting and legal safeguards</summary>
   <p>This module does not establish VAT registration, zero-rating, senior/PWD eligibility, exemption, or compliant invoicing. A qualified Philippine tax professional must verify the hotel's registration and applicable treatment before live activation.</p>
   <p>Every approved period is inclusive of its end date; an absent end date means open-ended. The server is authoritative on overlaps and historical date locks. Previews never modify payments, invoices, folios, or journals.</p>
  </details>
  <details className="workflow-disclosure tax-history" open={showHistory} onToggle={e=>setShowHistory(e.currentTarget.open)}>
   <summary>Policy history ({policies.length})</summary>
   {query.isSuccess&&policies.length===0&&<p>No historical policy records.</p>}
   {policies.map(p=><article className="tax-policy-row" key={p.id}>
    <div><strong>Policy #{p.id} · {policyLabel(p)}</strong>
     <small>{p.status==='draft'?'Draft awaiting review':effectiveOn(p,today)?'Current approved preview policy':p.status==='approved'&&p.effective_from>today?'Approved — starts '+fmt(p.effective_from):p.status==='approved'?'Expired policy':p.status}</small>
     <small>Effective {fmt(p.effective_from)} – {p.effective_until?fmt(p.effective_until):'open-ended'}</small>
     <small>Created by {p.created_by_name??'Unverified legacy creator'} {p.created_at?'· '+readableDateTime(p.created_at):''}</small>
     <small>Reviewed by {p.approved_by_name??'Not reviewed'} {p.approved_at?'· '+readableDateTime(p.approved_at):''}</small>
     {p.review_note&&<p>{p.review_note}</p>}
    </div>
   </article>)}
  </details>
 </main>;
}
