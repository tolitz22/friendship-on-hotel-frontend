import {Link} from '@tanstack/react-router';
import {useState} from 'react';
import {AlertTriangle,CheckCircle2,Download,RefreshCw} from 'lucide-react';
import {useHotelAuth} from './AuthProvider';
import {QueryFeedback} from './QueryFeedback';
import {useNightAuditReconciliation} from '../api/nightAuditReconciliation';
import {hotelToday,addDays} from '../features/reservations/calendarDate';

function money(amount:number|null,currency:string){
 if(amount===null)return 'Not verified';
 return new Intl.NumberFormat('en-PH',{style:'currency',currency}).format(amount/100);
}
function csv(value:string|number|null){
 const text=value===null?'UNVERIFIED':String(value);
 return '"'+text.replaceAll('"','""')+'"';
}
export function NightAuditReconciliationPanel(){
 const {hotelId,user}=useHotelAuth();
 const admin=!!hotelId&&!!user?.hotels.some(h=>h.id===hotelId&&h.role==='admin');
 const [date,setDate]=useState(()=>addDays(hotelToday(),-1));
 const report=useNightAuditReconciliation(hotelId,date,admin);
 const data=report.data;
 function download(){
  if(!data||!hotelId)return;
  const rows:(string|number|null)[][]=[
   ['Friendship On Hotel - Audited Financial Reconciliation'],
   ['Hotel ID',data.hotelId],['Business date',data.businessDate],['Currency',data.currency],
   ['Financial journal reconciled',data.financialJournalReconciled?'YES':'NO'],
   ['Night audit',data.nightAudit.status],['Financial close',data.financialClose.status],
   ['Journal debit (minor units)',data.financialClose.debitsMinor],
   ['Journal credit (minor units)',data.financialClose.creditsMinor],
   ['Room revenue movement (minor units)',data.kpis.recognizedRoomRevenueMinor],
   ['VAT liability movement (minor units)',data.kpis.vatLiabilityMovementMinor],
   ['Inspected occupied rooms',data.kpis.inspectionOccupiedRooms],
   ['Inspection occupancy percent',data.kpis.inspectionOccupancyPercent],
   ['Official overnight occupancy percent',data.kpis.occupancyPercent],
   ['Official ADR (minor units)',data.kpis.adrMinor],
   ['Official RevPAR (minor units)',data.kpis.revparMinor],
   ['Cashier shifts reconciled',data.cashier.reconciledCount],
   ['Cashier shifts pending',data.cashier.pendingCount],
   ['Cashier shifts flagged',data.cashier.flaggedCount],
   ['Cashier variance (minor units)',data.cashier.varianceMinor],
   ...data.blockers.map(b=>['BLOCKER',b]),
   ...data.limitations.map(l=>['LIMITATION',l]),
  ];
  const value=rows.map(row=>row.map(csv).join(',')).join('\r\n');
  const blob=new Blob(['\uFEFF'+value],{type:'text/csv;charset=utf-8'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');a.href=url;
  a.download='night-audit-reconciliation-'+data.businessDate+'.csv';a.click();
  URL.revokeObjectURL(url);
 }
 if(!admin)return <p role="status">Financial reconciliation is available to authorized hotel managers.</p>;
 return <section className="report-financial" aria-label="Live night-audit financial reconciliation">
  <header><h3>Live financial reconciliation</h3><span>Accounting records · read-only</span></header>
  <div className="desk-tools">
   <label className="night-audit-date">Business date
    <input type="date" className="wizard-input" value={date}
     max={hotelToday()} onChange={e=>setDate(e.target.value)}/>
   </label>
   <button className="btn-inline" type="button" disabled={report.isFetching}
    onClick={()=>void report.refetch()}><RefreshCw size={15}/> Refresh</button>
   <button className="btn-inline" type="button" disabled={!data||report.isFetching}
    onClick={download}><Download size={15}/> Export evidence CSV</button>
  </div>
  <QueryFeedback loading={report.isPending} error={report.error}
   onRetry={()=>void report.refetch()}/>
  {data&&<>
   <p className={data.financialJournalReconciled?'night-audit-clean':'night-audit-warning'}>
    {data.financialJournalReconciled?<CheckCircle2 size={17}/>:<AlertTriangle size={17}/>}
    {data.financialJournalReconciled
     ?'Financial journal and close snapshot reconciled; this is not bank settlement certification.'
     :'Financial close, audit coverage, or accounting exceptions require review.'}
   </p>
   <div className="report-financial-grid">
    <div><span>Earned room revenue movements</span>
     <strong>{money(data.kpis.recognizedRoomRevenueMinor,data.currency)}</strong></div>
    <div><span>VAT payable movements</span>
     <strong>{money(data.kpis.vatLiabilityMovementMinor,data.currency)}</strong></div>
    <div><span>Verified inspection occupancy</span>
     <strong>{data.kpis.inspectionOccupancyPercent===null?'Incomplete':
      data.kpis.inspectionOccupancyPercent.toFixed(2)+'%'}</strong></div>
   </div>
   <div className="night-audit-metrics">
    <div className="night-audit-metric"><small>Debits</small><strong>{money(data.financialClose.debitsMinor,data.currency)}</strong></div>
    <div className="night-audit-metric"><small>Credits</small><strong>{money(data.financialClose.creditsMinor,data.currency)}</strong></div>
    <div className="night-audit-metric"><small>Unbalanced journals</small><strong>{data.financialClose.unbalancedJournalCount}</strong></div>
    <div className="night-audit-metric"><small>Reconciled shifts</small><strong>{data.cashier.reconciledCount}</strong></div>
    <div className="night-audit-metric"><small>Flagged / pending shifts</small><strong>{data.cashier.flaggedCount} / {data.cashier.pendingCount}</strong></div>
    <div className="night-audit-metric"><small>Cash discrepancy</small><strong>{money(data.cashier.varianceMinor,data.currency)}</strong></div>
    <div className="night-audit-metric"><small>Counted reconciled cash</small><strong>{money(data.cashier.reconciledCountedCashMinor,data.currency)}</strong></div>
    <div className="night-audit-metric"><small>Official ADR</small><strong>{data.kpis.adrMinor===null?'Unavailable':money(data.kpis.adrMinor,data.currency)}</strong></div>
    <div className="night-audit-metric"><small>Official RevPAR</small><strong>{data.kpis.revparMinor===null?'Unavailable':money(data.kpis.revparMinor,data.currency)}</strong></div>
    <div className="night-audit-metric"><small>Official overnight occupancy</small><strong>{data.kpis.occupancyPercent===null?'Unavailable':data.kpis.occupancyPercent.toFixed(2)+'%'}</strong></div>
   </div>
   {data.blockers.length>0&&<div className="night-audit-issues" role="status">
    <h4>Required investigations</h4>
    <ul>{data.blockers.map((message,i)=><li key={i}>{message}</li>)}</ul>
   </div>}
   <p className="report-hint">
    Occupancy is a verified point-in-time room inspection, not evidence of overnight room nights.
    Revenue and VAT are posted account movements for the selected business date; corrections may
    apply to earlier stays. Cashier totals are independently reviewed counts, not bank deposits.

   </p>
   {data.folioTaxAccountingEnabled===false&&
    <p className="report-hint">Folio-night accounting is disabled. Ask the finance administrator to review the property setup before enabling it.</p>}
   {(data.kpis.adrMinor===null||data.kpis.revparMinor===null||data.kpis.occupancyPercent===null)&&
    <p className="report-hint">Publishing requires verified occupied room nights and historical sellable room-night inventory, plus recognized room revenue attributed to stay dates for ADR and RevPAR. <Link to="/folio-night-accounting">Review folio-night accounting</Link>.</p>}
  </>}
 </section>;
}
