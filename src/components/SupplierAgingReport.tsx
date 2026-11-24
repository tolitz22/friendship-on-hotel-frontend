import {useState} from 'react';
import {Download} from 'lucide-react';
import {useSupplierAging} from '../api/supplierBills';
import type {SupplierAging} from '../api/supplierBills';
import {Panel} from './ui';
import {QueryFeedback} from './QueryFeedback';
import {readableDate} from '../lib/format';

const money=(n:number)=>new Intl.NumberFormat('en-PH',{style:'currency',currency:'PHP'}).format(n/100);
const buckets=[['current','Current'],['days1To30','1–30 days'],['days31To60','31–60 days'],['days61To90','61–90 days'],['over90','Over 90 days']] as const;
function csvCell(value:string|number){
 let s=String(value);
 if(typeof value==='string'&&/^[\s\uFEFF]*[=+@-]/.test(s))s="'"+s;
 return '"'+s.replace(/"/g,'""')+'"';
}
function exportCsv(report:SupplierAging){
 const decimal=(n:number)=>(n/100).toFixed(2);
 const rows:(string|number)[][]=[
  ['Accounts payable aging',report.asOf,'PHP'],
  ['Supplier','Invoices',...buckets.map(([,label])=>label),'Outstanding'],
  ...report.suppliers.map(s=>[s.supplierName,s.invoiceCount,...buckets.map(([k])=>decimal(s.buckets[k])),decimal(s.outstandingMinor)]),
  ['Total',report.outstandingCount,...buckets.map(([k])=>decimal(report.buckets[k])),decimal(report.outstandingMinor)],
  ['Overdue',decimal(report.overdueMinor)],['Signed subledger',decimal(report.signedSubledgerMinor)],
  ['Accounts payable ledger',decimal(report.ledgerBalanceMinor)],['Difference',decimal(report.differenceMinor)],['Inconsistent invoices',report.inconsistentCount],
  ['Reconciled',report.reconciled?'Yes':'No'],
 ];
 const url=URL.createObjectURL(new Blob(['\uFEFF'+rows.map(row=>row.map(csvCell).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8;'}));
 const a=document.createElement('a');a.href=url;a.download='supplier-aging-'+report.asOf+'.csv';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
export function SupplierAgingReport({hotel,businessDate}:{hotel:string;businessDate:string}){
 const [selectedDate,setSelectedDate]=useState('');
 const date=selectedDate||businessDate;
 const valid=!!date&&date<=businessDate;
 const query=useSupplierAging(hotel,date,valid);
 const report=query.data;
 return <Panel title="Accounts payable aging" action={<button type="button" className="btn-inline" disabled={!report||!valid||query.isFetching||query.isError} onClick={()=>{if(report&&report.asOf===date)exportCsv(report);}}><Download size={16}/> Export CSV</button>}>
  <div className="expense-filters"><label>Report date<input type="date" className="wizard-input" max={businessDate} value={date} onChange={e=>setSelectedDate(e.target.value)}/></label><button type="button" className="btn-inline" onClick={()=>setSelectedDate('')}>Current business date</button></div>
  <p className="desk-muted">Balances include invoices and payments posted through the selected date. Aging is measured from invoice due dates.</p>
  {!valid?<p role="alert">Choose a date no later than the financial business date.</p>:<QueryFeedback loading={query.isPending} error={query.error} onRetry={()=>void query.refetch()}/>}
  {valid&&report&&<>
   <dl className="expense-detail-grid"><div><dt>As of</dt><dd>{readableDate(report.asOf)}</dd></div><div><dt>Outstanding</dt><dd>{money(report.outstandingMinor)}</dd></div><div><dt>Overdue</dt><dd>{money(report.overdueMinor)}</dd></div><div><dt>Outstanding invoices</dt><dd>{report.outstandingCount}</dd></div></dl>
   <div className="table-scroll"><table><thead><tr><th>Supplier</th><th>Invoices</th>{buckets.map(([key,label])=><th key={key}>{label}</th>)}<th>Outstanding</th></tr></thead><tbody>
    {report.suppliers.map(s=><tr key={s.supplierId}><td><strong>{s.supplierName}</strong></td><td>{s.invoiceCount}</td>{buckets.map(([key])=><td key={key}>{money(s.buckets[key])}</td>)}<td>{money(s.outstandingMinor)}</td></tr>)}
   </tbody><tfoot><tr><th>Total</th><td>{report.outstandingCount}</td>{buckets.map(([key])=><td key={key}>{money(report.buckets[key])}</td>)}<td>{money(report.outstandingMinor)}</td></tr></tfoot></table></div>
   {!report.suppliers.length&&<p>No positive outstanding balances on this date.</p>}
   <h3>Ledger reconciliation</h3>
   <dl className="expense-detail-grid"><div><dt>Signed supplier subledger</dt><dd>{money(report.signedSubledgerMinor)}</dd></div><div><dt>Accounts payable ledger</dt><dd>{money(report.ledgerBalanceMinor)}</dd></div><div><dt>Ledger less subledger</dt><dd>{money(report.differenceMinor)}</dd></div><div><dt>Inconsistent invoices</dt><dd>{report.inconsistentCount}</dd></div></dl>
   <p className={report.reconciled?'cashier-feedback-success':'notice'}>{report.reconciled?'Accounts payable balances match.':'Reconciliation needs investigation. Do not treat these balances as verified.'}</p>
  </>}
 </Panel>;
}
