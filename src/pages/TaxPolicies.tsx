import {useEffect,useState} from 'react';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {z} from 'zod';
import {AlertTriangle,Calculator,ClipboardCheck,RefreshCw,ShieldCheck} from 'lucide-react';
import {getJson,requestJson} from '../api/http';
import {hotelPath,readSession} from '../api/session';
import {useHotelAuth} from '../components/AuthProvider';
import {Heading,Panel} from '../components/ui';
import {QueryFeedback} from '../components/QueryFeedback';

const policySchema=z.object({
 id:z.number(),hotel_id:z.number(),classification:z.string(),
 price_mode:z.string(),rate_bps:z.number(),effective_from:z.string(),
 effective_until:z.string().nullable(),status:z.string(),
 approved_by:z.number().nullable(),approved_at:z.string().nullable(),
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

const classificationOptions=[
 {value:'vat_standard',label:'VAT standard (registered, taxable)'},
 {value:'vat_zero',label:'VAT zero-rated (requires eligibility review)'},
 {value:'vat_exempt',label:'VAT-exempt (requires eligibility review)'},
 {value:'non_vat',label:'Non-VAT registration'},
];

function peso(minor:number){
 return new Intl.NumberFormat('en-PH',{style:'currency',currency:'PHP'}).format(minor/100);
}

export function TaxPolicies(){
 const {user,hotelId}=useHotelAuth();
 const admin=!!hotelId&&!!user?.hotels.some(h=>h.id===hotelId&&h.role==='admin');
 const client=useQueryClient();
 const [classification,setClassification]=useState('vat_standard');
 const [priceMode,setPriceMode]=useState('inclusive');
 const [rateBps,setRateBps]=useState('1200');
 const [from,setFrom]=useState('');
 const [until,setUntil]=useState('');
 const [note,setNote]=useState('');
 const [busy,setBusy]=useState(false);
 const [approveId,setApproveId]=useState<number|null>(null);
 const [ack,setAck]=useState(false);
 const [error,setError]=useState('');
 const [success,setSuccess]=useState('');
 const [previewDate,setPreviewDate]=useState('');
 const [previewAmount,setPreviewAmount]=useState('');
 const [preview,setPreview]=useState<Preview|null>(null);
 useEffect(()=>{
  setClassification('vat_standard');setPriceMode('inclusive');setRateBps('1200');
  setFrom('');setUntil('');setNote('');setBusy(false);setApproveId(null);
  setAck(false);setError('');setSuccess('');setPreview(null);
  setPreviewDate('');setPreviewAmount('');
 },[hotelId]);
 const query=useQuery({
  queryKey:['live','tax-policies',hotelId],
  enabled:admin,
  queryFn:async():Promise<Policy[]>=>policyListSchema.parse(
   await getJson<unknown>(hotelPath('/finance/tax-policies'))).data,
  retry:false,
 });
 function safeHotel(){return !!hotelId&&readSession().hotelId===hotelId;}
 async function createDraft(){
  if(!safeHotel()||busy)return;
  setBusy(true);setError('');setSuccess('');
  try{
   await requestJson<unknown>(hotelPath('/finance/tax-policies'),{
    method:'POST',body:{
     classification,priceMode,rateBps:Number(rateBps),
     effectiveFrom:from,effectiveUntil:until||null,reviewNote:note.trim(),
    },
   });
   if(!safeHotel())return;
   setNote('');setSuccess('Draft saved. Explicit approval is still required before preview.');
   await client.invalidateQueries({queryKey:['live','tax-policies',hotelId]});
  }catch(e){if(safeHotel())setError(e instanceof Error?e.message:'Unable to save draft.');}
  finally{setBusy(false);}
 }
 async function approve(){
  if(!safeHotel()||busy||approveId===null||!ack)return;
  setBusy(true);setError('');setSuccess('');
  try{
   await requestJson<unknown>(hotelPath('/finance/tax-policies/'+approveId+'/approve'),{
    method:'POST',body:{acknowledged:true},
   });
   if(!safeHotel())return;
   setSuccess('Tax policy approved for its effective date range. No guest charges or journals were created.');
   setApproveId(null);setAck(false);
   await client.invalidateQueries({queryKey:['live','tax-policies',hotelId]});
  }catch(e){if(safeHotel())setError(e instanceof Error?e.message:'Approval failed.');}
  finally{setBusy(false);}
 }
 async function calculate(){
  if(!safeHotel()||busy)return;
  setError('');setPreview(null);
  if(!/^\d+$/.test(previewAmount)||!previewDate){
   setError('Provide a date and a nonnegative integer amount in centavos.');return;
  }
  try{
   const result=breakdownSchema.parse((await getJson<unknown>(
    hotelPath('/finance/tax-preview'),{date:previewDate,amountMinor:previewAmount}
   ) as {data:unknown}).data);
   if(safeHotel())setPreview(result);
  }catch(e){if(safeHotel())setError(e instanceof Error?e.message:'Tax preview is unavailable.');}
 }
 if(!admin)return <>
  <Heading title="Tax configuration" description="Hotel administrator access required."/>
  <Panel title="Restricted"><p>Only active hotel administrators can review tax policies.</p></Panel>
 </>;
 return <>
  <Heading title="Tax policies & VAT preview"
   description="Effective-dated Philippine tax configuration. Preview amounts only; no folio, payment, invoice or journal changes."/>
  <Panel title="Important accounting safeguards">
   <p className="night-audit-warning"><AlertTriangle size={18}/>
    This module does not establish statutory eligibility for senior/PWD discounts or VAT exemption.
    A qualified Philippine tax professional must confirm the hotel's registration, rate treatment, discounts and invoicing obligations before live activation.</p>
   <p className="desk-muted">Each effective date can have only one approved hotel tax policy. Tax previews do not represent money owed or settled.</p>
  </Panel>
  <Panel title="Current and draft policies">
   <div className="desk-tools">
    <button type="button" className="btn-inline" onClick={()=>void query.refetch()}>
     <RefreshCw size={15}/> Refresh policies
    </button>
   </div>
   <QueryFeedback loading={query.isPending} error={query.error} onRetry={()=>void query.refetch()}/>
   {query.data?.length===0&&<p>No tax policy is configured. Create a draft before preparing previews.</p>}
   {query.data?.map(policy=><article className="ex-record" key={policy.id}>
    <div className="desk-tools"><strong>Policy #{policy.id} · {policy.classification.replaceAll('_',' ')}</strong>
     <span>{policy.status.toUpperCase()}</span></div>
    <p>{policy.price_mode} · {policy.rate_bps/100}% · {policy.effective_from} through {policy.effective_until??'open-ended'}</p>
    {policy.review_note&&<p className="desk-muted">{policy.review_note}</p>}
    {policy.status==='draft'&&<button type="button" className="btn-inline"
     disabled={busy} onClick={()=>{setApproveId(policy.id);setAck(false);setError('');}}>
     <ShieldCheck size={15}/> Review for approval
    </button>}
   </article>)}
   {approveId!==null&&<div className="night-review-panel">
    <h3>Approve policy #{approveId}</h3>
    <p>This affects future tax previews and reporting assumptions. It does not post tax journals or update guest bills.</p>
    <label className="night-review-ack"><input type="checkbox" checked={ack}
     disabled={busy} onChange={e=>setAck(e.target.checked)}/>
     <span>I confirmed the hotel's tax treatment, registration and effective date with the responsible finance reviewer.</span>
    </label>
    <div className="desk-tools">
     <button type="button" className="btn-primary" disabled={!ack||busy}
      onClick={()=>void approve()}>{busy?'Approving…':'Approve policy'}</button>
     <button type="button" className="btn-inline" disabled={busy} onClick={()=>setApproveId(null)}>Cancel</button>
    </div>
   </div>}
  </Panel>
  <Panel title="Prepare a tax policy draft">
   <div className="desk-tools">
    <label>Classification
     <select className="wizard-input" value={classification}
      onChange={e=>{setClassification(e.target.value);if(e.target.value!=='vat_standard')setRateBps('0');else setRateBps('1200');}}>
      {classificationOptions.map(option=><option key={option.value} value={option.value}>{option.label}</option>)}
     </select>
    </label>
    <label>Pricing
     <select className="wizard-input" value={priceMode} onChange={e=>setPriceMode(e.target.value)}>
      <option value="inclusive">VAT inclusive</option><option value="exclusive">VAT exclusive</option>
     </select>
    </label>
    <label>Rate (basis points)
     <input className="wizard-input" type="number" min="0" max="10000" step="1"
      value={rateBps} onChange={e=>setRateBps(e.target.value)}/>
    </label>
   </div>
   <div className="desk-tools">
    <label>Effective from <input className="wizard-input" type="date" value={from} onChange={e=>setFrom(e.target.value)}/></label>
    <label>Effective until (optional) <input className="wizard-input" type="date" min={from||undefined}
     value={until} onChange={e=>setUntil(e.target.value)}/></label>
   </div>
   <label className="night-review-note">Finance review note
    <textarea className="wizard-input" rows={3} maxLength={2000} value={note}
     onChange={e=>setNote(e.target.value)} placeholder="Document the registration and tax treatment evidence."/>
   </label>
   <button type="button" className="btn-primary" disabled={busy||!from||note.trim().length<15||rateBps===''||!Number.isInteger(Number(rateBps))}
    onClick={()=>void createDraft()}><ClipboardCheck size={16}/> Save draft policy</button>
  </Panel>
  <Panel title="Tax breakdown preview (no postings)">
   <div className="desk-tools">
    <label>Effective date <input type="date" className="wizard-input" value={previewDate}
     onChange={e=>{setPreviewDate(e.target.value);setPreview(null);}}/></label>
    <label>Input amount (centavos) <input type="text" inputMode="numeric" className="wizard-input"
     value={previewAmount} placeholder="11200 = ₱112.00" onChange={e=>{setPreviewAmount(e.target.value);setPreview(null);}}/></label>
    <button type="button" className="btn-inline" disabled={!previewDate||busy}
     onClick={()=>void calculate()}><Calculator size={16}/> Calculate preview</button>
   </div>
   {preview&&<div className="night-audit-metrics">
    <div className="night-audit-metric"><small>Net base</small><strong>{peso(preview.breakdown.base_minor)}</strong></div>
    <div className="night-audit-metric"><small>VAT portion</small><strong>{peso(preview.breakdown.tax_minor)}</strong></div>
    <div className="night-audit-metric"><small>Total</small><strong>{peso(preview.breakdown.total_minor)}</strong></div>
    <div className="night-audit-metric"><small>Policy</small><strong>#{preview.policy_id}</strong></div>
   </div>}
   <p className="desk-muted">Input must already reflect any applicable legally approved discounts. No guest charges, tax journals or tax invoices are generated here.</p>
  </Panel>
  {success&&<p className="stay-feedback-success" role="status">{success}</p>}
  {error&&<p className="stay-feedback-error" role="alert"><AlertTriangle size={15}/>{error}</p>}
 </>;
}
