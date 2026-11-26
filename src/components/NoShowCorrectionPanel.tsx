import {useRef,useState} from 'react';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {z} from 'zod';
import {NoShowCorrectionAudit,correctionAuditSchema} from './NoShowCorrectionAudit';
import {getJson,requestJson} from '../api/http';
import {hotelPath,readSession} from '../api/session';

const amountSchema=z.number().int().nullable();
const groupSchema=correctionAuditSchema.extend({kind:z.enum(['room','fee']),proposalId:z.string(),businessDate:z.string(),proposedBy:z.string(),reviewedBy:z.string().nullable(),reason:z.string(),status:z.string(),snapshotIntegrityValid:z.boolean(),originalFeeMinor:amountSchema,replacementFeeMinor:amountSchema,replacementVatMinor:amountSchema.optional(),replacementRevenueMinor:amountSchema.optional(),taxClassification:z.string().nullable().optional()});
const schema=z.object({data:z.object({bookingId:z.string(),currency:z.literal('PHP'),businessDate:z.string().nullable(),open:z.boolean(),roomReviewEnabled:z.boolean(),roomPostingEnabled:z.boolean(),feeReviewEnabled:z.boolean(),feePostingEnabled:z.boolean(),
 room:z.object({requiresCorrection:z.boolean(),eligibleForReview:z.boolean(),blockers:z.array(z.string()),totals:z.object({grossMinor:z.number(),assessedVatMinor:z.number(),recognizedRevenueMinor:z.number()}),nights:z.array(z.object({assessmentId:z.string(),stayDate:z.string(),issues:z.array(z.string())}))}),
 fee:z.object({originalFeeMinor:amountSchema,replacementFeeMinor:z.number(),proposedFolioCreditMinor:amountSchema,originalVatMinor:amountSchema,originalRevenueMinor:amountSchema,projectedCollectionMinor:amountSchema,projectedExcessDepositMinor:amountSchema,eligibleForReview:z.boolean(),blockers:z.array(z.string())}),
 corrections:z.array(groupSchema)})});
type Kind='room'|'fee';
type Action={kind:Kind;mode:'propose'|'approve'|'post';id?:string};
const money=(n:number|null|undefined)=>n==null?'—':new Intl.NumberFormat('en-PH',{style:'currency',currency:'PHP'}).format(n/100);
const readable=(s:string)=>s.replaceAll('_',' ');
const taxOptions=[['vat_standard','VAT-inclusive (12%)'],['vat_zero','Zero-rated VAT'],['vat_exempt','VAT-exempt'],['non_vat','Outside VAT']];
export function NoShowCorrectionPanel({hotelId,bookingId,userId,onBusyChange}:{hotelId:string;bookingId:string;userId:string;onBusyChange?:(busy:boolean)=>void}){
 const client=useQueryClient();
 const [replacement,setReplacement]=useState('0.00');
 const [previewMinor,setPreviewMinor]=useState(0);
 const [action,setAction]=useState<Action|null>(null);
 const [reason,setReason]=useState('');
 const [tax,setTax]=useState('');
 const [basis,setBasis]=useState('');
 const [confirmed,setConfirmed]=useState(false);
 const [busy,setBusy]=useState(false);
 const [notice,setNotice]=useState('');
 const [error,setError]=useState('');
 const lock=useRef(false);
 const path='/bookings/'+bookingId+'/no-show-corrections';
 const minor=/^\d+(\.\d{1,2})?$/.test(replacement)?Math.round(Number(replacement)*100):NaN;
 const validAmount=Number.isSafeInteger(minor)&&minor>=0&&minor<=1000000000000;
 const query=useQuery({queryKey:['live','no-show-corrections',hotelId,bookingId,previewMinor],retry:false,staleTime:0,queryFn:async()=>{
  if(readSession().hotelId!==hotelId)throw new Error('Hotel context changed.');
  const result=schema.parse(await getJson<unknown>(hotelPath(path+'?replacementMinor='+previewMinor))).data;
  if(result.bookingId!==bookingId||readSession().hotelId!==hotelId)throw new Error('Booking context changed.');
  return result;
 }});
 const data=query.isFetching||query.isError?undefined:query.data;
 const group=data?.corrections.find(g=>g.kind===action?.kind&&g.proposalId===action?.id);
 const reviewEnabled=action?.kind==='room'?data?.roomReviewEnabled:data?.feeReviewEnabled;
 const postingEnabled=action?.kind==='room'?data?.roomPostingEnabled:data?.feePostingEnabled;
 const proposalValid=!!data&&!!action&&(action.kind==='room'?data.room.eligibleForReview:data.fee.eligibleForReview&&validAmount&&minor===previewMinor);
 const documentValid=reason.trim().length>=15&&reason.trim().length<=1000;
 const allowed=!!data?.open&&!!action&&!!reviewEnabled&&confirmed&&(
  action.mode==='propose'?proposalValid&&documentValid&&!data.corrections.some(g=>g.kind===action.kind):
  action.mode==='approve'?!!group&&group.status==='awaiting_review'&&group.proposedBy!==userId&&group.snapshotIntegrityValid&&group.businessDate===data.businessDate&&documentValid&&(action.kind==='room'||!!tax&&basis.trim().length>=15&&basis.trim().length<=1000):
  !!group&&group.status==='approved_unposted'&&group.reviewedBy===userId&&group.snapshotIntegrityValid&&group.businessDate===data.businessDate&&!!postingEnabled);
 const begin=(a:Action)=>{setAction(a);setReason('');setTax('');setBasis('');setConfirmed(false);setError('');setNotice('');};
 async function submit(){
  if(!allowed||!action||lock.current||readSession().hotelId!==hotelId)return;
  const url=path+'/'+action.kind+(action.mode==='propose'?'':'/'+action.id+'/'+action.mode);
  const body=action.mode==='post'?{acknowledged:true}:action.mode==='propose'?{reason:reason.trim(),...(action.kind==='fee'?{replacementMinor:previewMinor}:{})}:{reason:reason.trim(),...(action.kind==='fee'?{taxClassification:tax,taxBasis:basis.trim()}:{})};
  lock.current=true;setBusy(true);onBusyChange?.(true);setError('');setNotice('');
  try{
   await requestJson(hotelPath(url),{method:'POST',body});
   setNotice(action.mode==='post'?'Correction posted. No refund was issued.':action.mode==='approve'?'Correction approved. No journals posted yet.':'Correction proposed. Independent approval required.');
   setAction(null);
  }catch(cause){setError(cause instanceof Error?cause.message:'Correction outcome not confirmed. Refresh before retrying.');}
  finally{
   setConfirmed(false);
   await Promise.allSettled([query.refetch(),...['no-show-corrections','no-show-financial-review','no-show-ledger-reconciliation','no-show-deposits','no-show-allocations','no-show-refunds','settlement-statement','folio-ledger','billing-folios','financial-business-day'].map(key=>client.invalidateQueries({queryKey:['live',key,hotelId]}))]);
   lock.current=false;setBusy(false);onBusyChange?.(false);
  }
 }
 return <section className="no-show-overview" aria-label="Room revenue and fee corrections">
  <div className="no-show-overview-heading"><div><h4>Room revenue and fee corrections</h4><p>Preserve original accounting entries. Propose, independently approve, then post a correction.</p></div><button type="button" className="btn-inline" disabled={busy||query.isFetching} onClick={()=>{setConfirmed(false);void query.refetch();}}>Refresh corrections</button></div>
  {query.isFetching?<p role="status">Checking correction eligibility…</p>:query.isError?<p role="alert">Correction information unavailable. Refresh to retry.</p>:data&&<>
   {!data.open&&<p>An open financial business date is required.</p>}
   <div className="no-show-deposit-row"><h5>Unused room-night accounting</h5>
    <div className="no-show-overview-metrics"><div><span>Original room charges</span><strong>{money(data.room.totals.grossMinor)}</strong></div><div><span>Assessed VAT</span><strong>{money(data.room.totals.assessedVatMinor)}</strong></div><div><span>Recognized revenue</span><strong>{money(data.room.totals.recognizedRevenueMinor)}</strong></div></div>
    {!data.room.requiresCorrection?<p>No linked room-night assessments require correction.</p>:<>
     {data.room.blockers.map(b=><p key={b}>{readable(b)}</p>)}
     {data.room.nights.map(n=><p key={n.assessmentId}>{n.stayDate} · {n.issues.length?n.issues.map(readable).join('; '):'Original accounting matched'}</p>)}
     {!data.roomReviewEnabled&&<p>Room correction review is disabled.</p>}
     {!action&&data.roomReviewEnabled&&data.open&&data.room.eligibleForReview&&!data.corrections.some(g=>g.kind==='room')&&<button type="button" className="btn-inline" onClick={()=>begin({kind:'room',mode:'propose'})}>Propose room reversal</button>}
    </>}
   </div>
   <div className="no-show-deposit-row"><h5>No-show fee reduction or waiver</h5>
    <label>Corrected fee (PHP)<input className="wizard-input" inputMode="decimal" value={replacement} disabled={busy||!!action} onChange={e=>{setReplacement(e.target.value);setConfirmed(false);}}/></label>
    <button type="button" className="btn-inline" disabled={!validAmount||busy||!!action} onClick={()=>{setPreviewMinor(minor);if(minor===previewMinor)void query.refetch();}}>Preview corrected fee</button>
    {minor===previewMinor&&validAmount?<><div className="no-show-overview-metrics">
     <div><span>Original fee</span><strong>{money(data.fee.originalFeeMinor)}</strong></div><div><span>Corrected fee</span><strong>{money(data.fee.replacementFeeMinor)}</strong></div>
     <div><span>Original VAT</span><strong>{money(data.fee.originalVatMinor)}</strong></div><div><span>Proposed folio credit</span><strong>{money(data.fee.proposedFolioCreditMinor)}</strong></div>
     <div><span>Projected collection</span><strong>{money(data.fee.projectedCollectionMinor)}</strong></div><div><span>Projected excess deposit</span><strong>{money(data.fee.projectedExcessDepositMinor)}</strong></div></div>
     <p>Replacement VAT and revenue are calculated at independent approval. Projections do not authorize refunds.</p>
     {data.fee.blockers.map(b=><p key={b}>{readable(b)}</p>)}
     {!data.feeReviewEnabled&&<p>Fee correction review is disabled.</p>}
     {!action&&data.open&&data.feeReviewEnabled&&data.fee.eligibleForReview&&!data.corrections.some(g=>g.kind==='fee')&&<button type="button" className="btn-inline" onClick={()=>begin({kind:'fee',mode:'propose'})}>Propose fee correction</button>}
    </>:<p>Preview the changed amount before proposing a correction.</p>}
   </div>
   <h5>Correction proposals</h5>
   {data.corrections.length===0?<p>No correction proposals recorded.</p>:data.corrections.map(g=><div className="no-show-deposit-row" key={g.kind+g.proposalId}>
    <div className="no-show-overview-heading"><strong>{g.kind==='room'?'Room reversal':'Fee correction'} #{g.proposalId}</strong><span className="no-show-overview-state">{readable(g.status)}</span></div>
    <p>{g.reason} · Business date {g.businessDate}</p>
    {g.kind==='fee'&&<p>{money(g.originalFeeMinor)} to {money(g.replacementFeeMinor)} · Approved VAT {money(g.replacementVatMinor)} · Approved revenue {money(g.replacementRevenueMinor)}</p>}
    {g.status==='awaiting_review'&&g.proposedBy===userId&&<p>Another administrator must approve this proposal.</p>}
    {!action&&data.open&&g.snapshotIntegrityValid&&g.businessDate===data.businessDate&&(g.kind==='room'?data.roomReviewEnabled:data.feeReviewEnabled)&&g.status==='awaiting_review'&&g.proposedBy!==userId&&<button type="button" className="btn-inline" onClick={()=>begin({kind:g.kind,mode:'approve',id:g.proposalId})}>Review correction #{g.proposalId}</button>}
    {!action&&data.open&&g.snapshotIntegrityValid&&g.businessDate===data.businessDate&&(g.kind==='room'?data.roomReviewEnabled&&data.roomPostingEnabled:data.feeReviewEnabled&&data.feePostingEnabled)&&g.status==='approved_unposted'&&g.reviewedBy===userId&&<button type="button" className="btn-inline" onClick={()=>begin({kind:g.kind,mode:'post',id:g.proposalId})}>Post approved correction #{g.proposalId}</button>}
   </div>)}
   {action&&<form className="billing-payment-fields" onSubmit={e=>{e.preventDefault();void submit();}}>
    <h5>{action.mode==='propose'?'Propose':action.mode==='approve'?'Approve':'Post approved'} {action.kind==='room'?'room reversal':'fee correction'}</h5>
    {action.kind==='fee'&&<p>Corrected fee: {money(action.mode==='propose'?previewMinor:group?.replacementFeeMinor)}</p>}
    {action.mode!=='post'&&<label>Documented reason<textarea value={reason} maxLength={1000} disabled={busy} onChange={e=>{setReason(e.target.value);setConfirmed(false);}}/></label>}
    {action.mode==='approve'&&action.kind==='fee'&&<><label>Tax treatment<select className="wizard-input" value={tax} disabled={busy} onChange={e=>{setTax(e.target.value);setConfirmed(false);}}><option value="">Select treatment</option>{taxOptions.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label><label>Tax basis<textarea maxLength={1000} value={basis} disabled={busy} onChange={e=>{setBasis(e.target.value);setConfirmed(false);}}/></label></>}
    <label><input type="checkbox" checked={confirmed} disabled={busy} onChange={e=>setConfirmed(e.target.checked)}/> {action.mode==='post'?'Post the independently approved accounting correction. No funds will be sent.':'I confirm the correction details and supporting evidence.'}</label>
    <button type="submit" className="btn-primary" disabled={busy||!allowed}>{busy?'Saving…':action.mode==='post'?'Confirm posting':action.mode==='approve'?'Approve correction':'Submit proposal'}</button>
    <button type="button" className="btn-inline" disabled={busy} onClick={()=>{setAction(null);setConfirmed(false);}}>Cancel</button>
   </form>}
  </>}
  {data&&<NoShowCorrectionAudit corrections={data.corrections}/>}
  {notice&&<p role="status">{notice}</p>}{error&&<p role="alert">{error}</p>}
 </section>;
}
