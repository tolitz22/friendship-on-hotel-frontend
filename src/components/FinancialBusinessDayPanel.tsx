import {useEffect,useState} from 'react';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {AlertTriangle,CheckCircle2,LockKeyhole,RefreshCw} from 'lucide-react';
import {z} from 'zod';
import {getJson,requestJson} from '../api/http';
import {hotelPath,readSession} from '../api/session';
import {useHotelAuth} from './AuthProvider';
import {QueryFeedback} from './QueryFeedback';

const dataSchema=z.object({
 businessDate:z.iso.date(),nextBusinessDate:z.iso.date(),
 status:z.string(),version:z.number().int().nonnegative(),
 journalCount:z.number().int().nonnegative(),
 invalidJournalCount:z.number().int().nonnegative(),
 nightAuditReview:z.object({
  status:z.string(),reviewedBy:z.string(),reviewedAt:z.string(),
 }).nullable(),
 blockers:z.array(z.string()),canClose:z.boolean(),
 readinessIsAdvisory:z.literal(true),
});
type CloseReadiness=z.infer<typeof dataSchema>;
const closeResponse=z.object({data:z.object({
 closedBusinessDate:z.iso.date(),nextBusinessDate:z.iso.date(),
 reconciliationSnapshot:z.object({
  journal_count:z.number().int().nonnegative(),line_count:z.number().int().nonnegative(),
  debits_minor:z.number().int().nonnegative(),credits_minor:z.number().int().nonnegative(),
  currency:z.string(),scope:z.string(),
 }),
})});

export function FinancialBusinessDayPanel(){
 const {hotelId}=useHotelAuth();
 const client=useQueryClient();
 const [typedDate,setTypedDate]=useState('');
 const [ack,setAck]=useState(false);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [success,setSuccess]=useState('');
 const query=useQuery({
  queryKey:['live','financial-business-day',hotelId],
  enabled:!!hotelId,
  queryFn:async():Promise<CloseReadiness>=>{
   const response=z.object({data:dataSchema}).parse(await getJson<unknown>(
    hotelPath('/finance/business-day'))).data;
   return response;
  },
  retry:false,
 });
 useEffect(()=>{setTypedDate('');setAck(false);setError('');setSuccess('');},[hotelId]);
 const data=query.data;
 const ready=!!data?.canClose&&data.blockers.length===0;
 const confirmed=ready&&typedDate===data?.businessDate&&ack&&!busy&&!query.isFetching;

 async function closeDay(){
  if(!hotelId||readSession().hotelId!==hotelId||!confirmed||!data)return;
  setBusy(true);setError('');setSuccess('');
  try{
   // Get a fresh readiness snapshot immediately before the irreversible write.
   const current=(await query.refetch()).data;
   if(!current||!current.canClose||current.businessDate!==data.businessDate){
    throw new Error('Business-date readiness changed. Review the updated checklist before closing.');
   }
   if(readSession().hotelId!==hotelId)throw new Error('Hotel selection changed.');
   const result=closeResponse.parse(await requestJson<unknown>(
    hotelPath('/finance/business-day/close'),{
     method:'POST',body:{businessDate:data.businessDate,acknowledged:true},
    })).data;
   if(readSession().hotelId!==hotelId)return;
   setTypedDate('');setAck(false);
   setSuccess('Closed '+result.closedBusinessDate+'. New business date: '+
    result.nextBusinessDate+'. Journal totals: '+
    result.reconciliationSnapshot.debits_minor+' debit centavos and '+
    result.reconciliationSnapshot.credits_minor+' credit centavos.');
   await client.invalidateQueries({queryKey:['live','financial-business-day',hotelId]});
   await client.invalidateQueries({queryKey:['live','night-audit-preview',hotelId]});
  }catch(e){
   if(readSession().hotelId===hotelId){
    setError(e instanceof Error?e.message:'Financial close failed. Refresh status before retrying.');
    await client.invalidateQueries({queryKey:['live','financial-business-day',hotelId]});
   }
  }finally{setBusy(false);}
 }
 return <section className="night-review-panel" aria-label="Financial business-date close">
  <div className="night-review-header"><LockKeyhole size={18}/>
   <div><h3>Financial business-date close</h3>
    <p>Separate from the manager's operational night-audit review. Closing advances the accounting business date and locks past journal posting dates.</p>
   </div>
  </div>
  <div className="desk-tools">
   <button type="button" className="btn-inline" disabled={busy}
    onClick={()=>void query.refetch()}><RefreshCw size={15}/> Refresh readiness</button>
  </div>
  <QueryFeedback loading={query.isPending} error={query.error} onRetry={()=>void query.refetch()}/>
  {data&&<>
   <div className="night-audit-metrics">
    <div className="night-audit-metric"><small>Current business date</small><strong>{data.businessDate}</strong></div>
    <div className="night-audit-metric"><small>Next date</small><strong>{data.nextBusinessDate}</strong></div>
    <div className="night-audit-metric"><small>Journals to reconcile</small><strong>{data.journalCount}</strong></div>
    <div className="night-audit-metric"><small>Invalid journals</small><strong>{data.invalidJournalCount}</strong></div>
   </div>
   {ready?<p className="night-audit-clean"><CheckCircle2 size={17}/> Listed readiness checks passed. Final validation is repeated during the database transaction.</p>
    :<div className="night-audit-issues" role="status"><h4><AlertTriangle size={17}/> Closing blocked</h4>
     <ul>{data.blockers.map(item=><li key={item}>{item}</li>)}</ul></div>}
   <p className="desk-muted">Manager review: <strong>{data.nightAuditReview?.status??'Not yet recorded'}</strong>.
    This readiness check is advisory and can change while other staff post transactions.</p>
   <label className="night-review-note">Type <strong>{data.businessDate}</strong> to confirm the exact date
    <input className="wizard-input" type="text" autoComplete="off" value={typedDate}
     disabled={!ready||busy} placeholder="YYYY-MM-DD" onChange={e=>setTypedDate(e.target.value)}/>
   </label>
   <label className="night-review-ack"><input type="checkbox" checked={ack}
    disabled={!ready||busy} onChange={e=>setAck(e.target.checked)}/>
    <span>I verified the manager review and understand this locks the current financial journal date and advances the hotel business clock. It does not settle bank payments or calculate VAT.</span>
   </label>
   <button type="button" className="btn-primary" disabled={!confirmed}
    onClick={()=>void closeDay()}>{busy?'Closing financial day…':'Close financial business date'}</button>
  </>}
  {success&&<p className="stay-feedback-success" role="status">{success}</p>}
  {error&&<p className="stay-feedback-error" role="alert"><AlertTriangle size={15}/>{error}</p>}
 </section>;
}
