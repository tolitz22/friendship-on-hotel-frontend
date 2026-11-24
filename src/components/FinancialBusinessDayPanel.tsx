import {Link} from '@tanstack/react-router';
import {useEffect,useState} from 'react';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {AlertTriangle,CheckCircle2,LockKeyhole,RefreshCw} from 'lucide-react';
import {z} from 'zod';
import {ApiError,getJson,requestJson} from '../api/http';
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
 openShiftIds:z.array(z.string()).optional(),
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

function readableDay(date:string){return new Intl.DateTimeFormat('en-PH',{dateStyle:'long',timeZone:'UTC'}).format(new Date(date+'T00:00:00Z'));}

export function useFinancialBusinessDay(hotelId:string){
 return useQuery({
  queryKey:['live','financial-business-day',hotelId],
  queryFn:async():Promise<CloseReadiness>=>{
   const response=z.object({data:dataSchema}).parse(await getJson<unknown>(
    hotelPath('/finance/business-day'))).data;
   return response;
  },
  retry:false,
 });
}

export function FinancialBusinessDayPanel({selectedDate,query,onSelectDate}:{selectedDate:string;query:ReturnType<typeof useFinancialBusinessDay>;onSelectDate:(date:string)=>void}){
 const {hotelId}=useHotelAuth();
 const client=useQueryClient();
 const [typedDate,setTypedDate]=useState('');
 const [setupDate,setSetupDate]=useState('');
 const [ack,setAck]=useState(false);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [success,setSuccess]=useState('');
 useEffect(()=>{setSetupDate('');setTypedDate('');setAck(false);setError('');setSuccess('');},[hotelId,selectedDate]);
 const data=query.data;
 const dateMatches=data?.businessDate===selectedDate;
 const ready=!!data?.canClose&&dateMatches&&data.blockers.length===0;
 const configurationError=query.error instanceof ApiError&&query.error.code==='BUSINESS_DATE_NOT_CONFIGURED'?query.error.message:null;
 const confirmed=ready&&typedDate===data?.businessDate&&ack&&!busy&&!query.isFetching;

 async function initializeDay(){
  if(!hotelId||readSession().hotelId!==hotelId||busy||setupDate!==selectedDate)return;
  setBusy(true);setError('');setSuccess('');
  try{
   await requestJson(hotelPath('/finance/business-day/initialize'),{
    method:'POST',body:{businessDate:setupDate},
   });
   if(readSession().hotelId!==hotelId)return;
   setSuccess('Business date set to '+setupDate+'.');
  }catch(e){
   if(readSession().hotelId===hotelId)setError(e instanceof Error?e.message:'Business date setup failed.');
  }finally{
   if(readSession().hotelId===hotelId){setSetupDate('');await query.refetch();}
   setBusy(false);
  }
 }

 async function closeDay(){
  if(!hotelId||readSession().hotelId!==hotelId||!confirmed||!data)return;
  setBusy(true);setError('');setSuccess('');
  try{
   // Get a fresh readiness snapshot immediately before the irreversible write.
   const refresh=await query.refetch();
   const current=refresh.data;
   if(refresh.isError||!current){
    throw new Error('Unable to verify financial close readiness. Refresh and try again.');
   }
   if(current.businessDate!==selectedDate){
    throw new Error('The financial business date has changed. Select the current date before closing.');
   }
   if(!current.canClose||current.blockers.length>0){
    throw new Error('Closing is blocked. Review the updated checklist.');
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
    new Intl.NumberFormat('en-PH',{style:'currency',currency:result.reconciliationSnapshot.currency}).format(result.reconciliationSnapshot.debits_minor/100)+' debits and '+
    new Intl.NumberFormat('en-PH',{style:'currency',currency:result.reconciliationSnapshot.currency}).format(result.reconciliationSnapshot.credits_minor/100)+' credits.');
   await Promise.all([
    client.invalidateQueries({queryKey:['live','financial-business-day',hotelId]}),
    client.invalidateQueries({queryKey:['live','night-audit-preview',hotelId]}),
    client.invalidateQueries({queryKey:['live','night-audit-reconciliation',hotelId]}),
   ]);
  }catch(e){
   if(readSession().hotelId===hotelId){
    setError(e instanceof Error?e.message:'Financial close failed. Refresh status before retrying.');
    await client.invalidateQueries({queryKey:['live','financial-business-day',hotelId]});
   }
  }finally{setBusy(false);}
 }
 return <section className="night-review-panel" aria-label="Financial business-date close">
  <div className="night-review-header"><LockKeyhole size={18}/>
   <div><h3>Close business day</h3>
    <p>Closing locks the current financial date and opens the next business date.</p>
   </div>
  </div>
  <div className="desk-tools">
   <button type="button" className="btn-inline" disabled={busy}
    onClick={()=>void query.refetch()}><RefreshCw size={15}/> Refresh readiness</button>
  </div>
  {!data&&<p>Selected date <strong>{selectedDate}</strong></p>}
  {configurationError&&<div className="night-audit-issues">
   <h4>Set up the first business date</h4>
   <p>A hotel administrator can initialize the clock for this property. Folio-night accounting is activated separately.</p>
   {setupDate===selectedDate?<><p>Start on <strong>{selectedDate}</strong>? Setup opens any missing calendar-month periods needed for the first close.</p>
    <button type="button" className="btn-primary" disabled={busy} onClick={()=>void initializeDay()}>Confirm starting date</button>
    <button type="button" className="btn-inline" disabled={busy} onClick={()=>setSetupDate('')}>Cancel</button></>
    :<button type="button" className="btn-primary" disabled={busy} onClick={()=>setSetupDate(selectedDate)}>Set up business date</button>}
  </div>}
  {query.error instanceof ApiError&&query.error.status===403&&<p>Ask an active administrator for this hotel to set up the business date in Daily Closing.</p>}
  <QueryFeedback loading={query.isPending} error={configurationError?null:query.error} onRetry={()=>void query.refetch()}/>
  {data&&<>
   <div className="night-audit-metrics">
    <div className="night-audit-metric"><small>Selected date</small><strong>{readableDay(selectedDate)}</strong></div>
    <div className="night-audit-metric"><small>Current business date</small><strong>{readableDay(data.businessDate)}</strong></div>
    <div className="night-audit-metric"><small>Next date</small><strong>{readableDay(data.nextBusinessDate)}</strong></div>
    <div className="night-audit-metric"><small>Journals to reconcile</small><strong>{data.journalCount}</strong></div>
    <div className="night-audit-metric"><small>Invalid journals</small><strong>{data.invalidJournalCount}</strong></div>
   </div>
   {ready?<p className="night-audit-clean"><CheckCircle2 size={17}/> Ready to close. The system will check again before closing.</p>
    :dateMatches&&<div className="night-audit-issues" role="status"><h4><AlertTriangle size={17}/> Complete these items before closing</h4>
     <ul>
      {data.blockers.map(item=><li key={item}>{item}</li>)}
      {data.openShiftIds?.map(shift=><li key={shift}><Link to="/cashier-shifts" search={{hotel:hotelId??undefined,shift}}>Open cashier shift #{shift}</Link></li>)}
     </ul></div>}
   {!dateMatches&&<div className="desk-tools">
    <p>Closing is available for the current financial business date.</p>
    <button type="button" className="btn-inline" disabled={busy} onClick={()=>onSelectDate(data.businessDate)}>Review current business date</button>
   </div>}
   <p className="desk-muted">Manager review: <strong>{data.nightAuditReview?.status??'Not yet recorded'}</strong>.
    This readiness check is advisory and can change while other staff post transactions.</p>
   {ready&&<>
   <label className="night-review-note">Type <strong>{data.businessDate}</strong> to confirm the exact date
    <input className="wizard-input" type="text" autoComplete="off" value={typedDate}
     disabled={!ready||busy} placeholder="YYYY-MM-DD" onChange={e=>setTypedDate(e.target.value)}/>
   </label>
   <label className="night-review-ack"><input type="checkbox" checked={ack}
    disabled={!ready||busy} onChange={e=>setAck(e.target.checked)}/>
    <span>I verified the manager review and understand this locks the current financial journal date and advances the hotel business clock. It does not settle bank payments or calculate VAT.</span>
   </label>
   <button type="button" className="btn-primary" disabled={!confirmed}
    onClick={()=>void closeDay()}>{busy?'Closing financial day…':'Close business day'}</button>
   </>}
  </>}
  {success&&<p className="stay-feedback-success" role="status">{success}</p>}
  {error&&<p className="stay-feedback-error" role="alert"><AlertTriangle size={15}/>{error}</p>}
 </section>;
}
