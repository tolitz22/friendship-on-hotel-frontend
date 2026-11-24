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
const departments:Record<string,string>={rooms:'Rooms',maintenance:'Property operations & maintenance',administration:'Administration',utilities:'Energy, water & waste',food_beverage:'Food & beverage'};
function csv(value:string|number|null){
 const text=value===null?'UNVERIFIED':String(value);
 return '"'+text.replaceAll('"','""')+'"';
}
export function NightAuditReconciliationPanel({selectedDate}:{selectedDate?:string}={}){
 const {hotelId,user}=useHotelAuth();
 const admin=!!hotelId&&!!user?.hotels.some(h=>h.id===hotelId&&h.role==='admin');
 const [date,setDate]=useState(()=>addDays(hotelToday(),-1));
 const reportDate=selectedDate??date;
 const report=useNightAuditReconciliation(hotelId,reportDate,admin);
 const data=report.data;
 function download(){
  if(!data||!hotelId)return;
  const rows:(string|number|null)[][]=[
   ['Friendship On Hotel - Audited Financial Reconciliation'],
   ['Hotel ID',data.hotelId],['Business date',data.businessDate],['Currency',data.currency],
   ['Financial journal reconciled',data.financialJournalReconciled?'YES':'NO'],
   ['Daily operational review',data.nightAudit.status],['Financial close',data.financialClose.status],
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
   ...(data.expenses?[
    ['Approved employee expenses (minor units)',data.expenses.employeeClaimExpenseMinor??null],
    ['Employee reimbursements (minor units)',data.expenses.employeeReimbursementMinor??null],
    ['Employee drawer reimbursements (minor units)',data.expenses.employeeDrawerReimbursementMinor??null],
    ['Employee bank reimbursements (minor units)',data.expenses.employeeBankReimbursementMinor??null],
    ['Employee payable balance (minor units)',data.expenses.employeeLiability?.outstandingMinor??null],
    ['Employee payable ledger difference (minor units)',data.expenses.employeeLiability?.differenceMinor??null],
    ['Supplier invoices recognized (minor units)',data.expenses.supplierInvoiceExpenseMinor??null],
    ['Supplier payments (minor units)',data.expenses.supplierPaymentMinor??null],
    ['Supplier drawer payments (minor units)',data.expenses.supplierDrawerPaymentMinor??null],
    ['Supplier bank payments (minor units)',data.expenses.supplierBankPaymentMinor??null],
    ['Gross operating expenses (minor units)',data.expenses.grossExpenseMinor??null],
    ['Accounting adjustments (minor units)',data.expenses.accountingAdjustmentMinor??null],
    ['Supplier refunds (minor units)',data.expenses.supplierRefundMinor??null],
    ['Net operating expenses (minor units)',data.expenses.netExpenseMinor],
    ['Physical cash returned (minor units)',data.expenses.physicalCashReturnMinor??null],
    ['Net clearing balance through date (minor units)',data.expenses.clearingBalanceMinor??null],
    ['Expense closed ledger verified',data.expenses.closedLedgerVerified?'YES':'NO'],
   ]:[]),
   ...(data.expenses?.breakdown?.available?data.expenses.breakdown.departments.map(d=>['Department: '+(departments[d.department]??d.department),d.grossMinor,d.adjustmentMinor,d.refundMinor,d.netMinor]):[]),
   ...data.blockers.map(b=>['BLOCKER',b]),
   ...data.limitations.map(l=>['LIMITATION',l]),
  ];
  const value=rows.map(row=>row.map(csv).join(',')).join('\r\n');
  const blob=new Blob(['\uFEFF'+value],{type:'text/csv;charset=utf-8'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');a.href=url;
  a.download='daily-closing-reconciliation-'+data.businessDate+'.csv';a.click();
  URL.revokeObjectURL(url);
 }
 if(!admin)return <p role="status">Financial reconciliation is available to authorized hotel managers.</p>;
 return <section className="report-financial" aria-label="Daily financial reconciliation">
  <header><h3>Daily financial report</h3><span>Accounting records · read-only</span></header>
  <div className="desk-tools">
   <label className="night-audit-date">Business date
    <input type="date" className="wizard-input" value={reportDate}
     max={hotelToday()} readOnly={!!selectedDate} onChange={e=>setDate(e.target.value)}/>
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
   {data.expenses?<section className="expense-correction-history" aria-label="Daily operating expenses">
    <div className="desk-tools"><h4>Operating expenses</h4><Link to="/expenses" search={{date:data.businessDate,hotel:data.hotelId}}>Open dated expense register</Link></div>
    <p className="desk-muted">{data.expenses.closedLedgerVerified?'Closed ledger totals verified.':'Recorded journal movements — not yet verified against a closed ledger.'}</p>
    <div className="night-audit-metrics">
     <div className="night-audit-metric"><small>Gross expenses</small><strong>{money(data.expenses.grossExpenseMinor??null,data.currency)}</strong></div>
     <div className="night-audit-metric"><small>Accounting adjustments</small><strong>{money(data.expenses.accountingAdjustmentMinor??null,data.currency)}</strong></div>
     <div className="night-audit-metric"><small>Supplier refunds reducing expense</small><strong>{money(data.expenses.supplierRefundMinor??null,data.currency)}</strong></div>
     <div className="night-audit-metric"><small>Net operating expenses</small><strong>{money(data.expenses.netExpenseMinor,data.currency)}</strong></div>
     <div className="night-audit-metric"><small>Physical cash returned</small><strong>{money(data.expenses.physicalCashReturnMinor??null,data.currency)}</strong></div>
     <div className="night-audit-metric"><small>Net clearing balance through date</small><strong>{money(data.expenses.clearingBalanceMinor??null,data.currency)}</strong></div>
    </div>
    {data.expenses.supplierInvoiceExpenseMinor!==undefined&&<>
     <h4>Supplier invoice activity</h4>
     <div className="night-audit-metrics">
      <div className="night-audit-metric"><small>New supplier expenses</small><strong>{money(data.expenses.supplierInvoiceExpenseMinor,data.currency)}</strong></div>
      <div className="night-audit-metric"><small>Supplier payments</small><strong>{money(data.expenses.supplierPaymentMinor??null,data.currency)}</strong></div>
      <div className="night-audit-metric"><small>Paid from drawer</small><strong>{money(data.expenses.supplierDrawerPaymentMinor??null,data.currency)}</strong></div>
      <div className="night-audit-metric"><small>Paid from hotel bank</small><strong>{money(data.expenses.supplierBankPaymentMinor??null,data.currency)}</strong></div>
     </div><p className="desk-muted">Supplier invoices are included in operating expenses. Payments settle existing liabilities and are not counted as additional expenses.</p>
    </>}
    {data.expenses.employeeLiability&&<><h4>Employee expenses and liabilities</h4>
    <div className="night-audit-metrics">
    {([['Approved employee expenses',data.expenses.employeeClaimExpenseMinor],['Reimbursements paid',data.expenses.employeeReimbursementMinor],['Paid from drawer',data.expenses.employeeDrawerReimbursementMinor],['Paid from hotel bank',data.expenses.employeeBankReimbursementMinor],['Outstanding employee payable',data.expenses.employeeLiability.outstandingMinor],['Employee payable ledger',data.expenses.employeeLiability.ledgerBalanceMinor],['Ledger difference',data.expenses.employeeLiability.differenceMinor]] as const).map(([label,value])=><div className="night-audit-metric" key={label}><small>{label}</small><strong>{money(value??null,data.currency)}</strong></div>)}
    </div><p className={data.expenses.employeeLiability.reconciled?'night-audit-clean':'night-audit-warning'}>{data.expenses.employeeLiability.reconciled?'Employee payable ledger matches the subledger.':'Employee payable discrepancies require investigation.'}</p>
    <details><summary>Outstanding by employee</summary><div className="table-scroll"><table><thead><tr><th>Employee</th><th>Claims</th><th>Outstanding</th></tr></thead><tbody>{data.expenses.employeeLiability.employees.map(e=><tr key={e.employeeId}><td>{e.employeeName}</td><td>{e.claimCount}</td><td>{money(e.outstandingMinor,data.currency)}</td></tr>)}</tbody></table></div></details></>}
    {!!data.expenses.clearingBalanceMinor&&<p className="notice">Net clearing balance requires investigation. A zero net balance alone does not establish that every voucher has been resolved.</p>}
    {data.expenses.breakdown?.available&&<>
     <h4>Expenses by original department</h4>
     <p className="desk-muted">Movements posted on this date, attributed to the original voucher classification. Later reclassifications do not rewrite historical reports.</p>
     {data.expenses.breakdown.departments.length===0?<p>No attributed expense movements on this date.</p>:<div className="table-scroll"><table><thead><tr><th>Department</th><th>Gross</th><th>Adjustments</th><th>Refunds</th><th>Net expense</th></tr></thead><tbody>
      {data.expenses.breakdown.departments.map(d=><tr key={d.department}><td>{departments[d.department]??d.department}</td><td>{money(d.grossMinor,data.currency)}</td><td>{money(d.adjustmentMinor,data.currency)}</td><td>{money(d.refundMinor,data.currency)}</td><td><strong>{money(d.netMinor,data.currency)}</strong></td></tr>)}
     </tbody></table></div>}
     {data.expenses.breakdown.unattributedNetMinor!==0&&<p role="alert" className="notice">Unattributed net journal movement: {money(data.expenses.breakdown.unattributedNetMinor,data.currency)}. Investigate before relying on department totals.</p>}
     <details><summary>Inspect voucher movements ({data.expenses.breakdown.movementCount})</summary>
      {data.expenses.breakdown.movementCount>data.expenses.breakdown.voucherMovements.length&&<p className="desk-muted">Showing the first {data.expenses.breakdown.voucherMovements.length} movements. Department totals include all attributed movements.</p>}
      <div className="table-scroll"><table><thead><tr><th>Voucher</th><th>Movement</th><th>Original date</th><th>Net amount</th></tr></thead><tbody>
       {data.expenses.breakdown.voucherMovements.map(v=><tr key={v.kind+':'+v.journalId}><td>{v.kind==='employee_claim'?<>Employee claim #{v.expenseId} · {v.description}</>:v.kind==='supplier_bill'?<>Supplier invoice #{v.expenseId} · {v.description}</>:<Link to="/expenses" search={{expense:v.expenseId,date:v.originalBusinessDate,hotel:data.hotelId}}>#{v.expenseId} · {v.description}</Link>}</td><td>{v.kind==='employee_claim'?'Employee claim':v.kind==='supplier_bill'?'Supplier invoice':v.kind==='expense'?'Original expense':v.kind==='adjustment'?'Accounting adjustment':'Supplier refund'}</td><td>{v.originalBusinessDate}</td><td>{money(v.netMinor,data.currency)}</td></tr>)}
      </tbody></table></div>
     </details>
    </>}
    <p className="desk-muted">Clearing cash returns settle previous adjustments; they do not reduce expenses again. This is not a complete profit and loss statement.</p>
   </section>:<p className="desk-muted">Expense accounting totals are unavailable from this API version.</p>}
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
    <p className="report-hint">Nightly room charge accounting is disabled. Ask the finance administrator to review the property setup before enabling it.</p>}
   {(data.kpis.adrMinor===null||data.kpis.revparMinor===null||data.kpis.occupancyPercent===null)&&
    <p className="report-hint">Publishing requires verified occupied room nights and historical sellable room-night inventory, plus recognized room revenue attributed to stay dates for ADR and RevPAR. <Link to="/folio-night-accounting">Review nightly room charges</Link>.</p>}
  </>}
 </section>;
}
