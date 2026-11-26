import {ApiError} from '../api/http';
import {useNoShowLedgerReconciliation} from '../api/noShowLedgerReconciliation';
import './NoShowLedgerPanel.css';

type Props={hotelId:string;bookingId:string;userId:string};
const movements=[['deposits','Verified deposits'],['fees','No-show fee'],['allocations','Applied payments'],['refunds','Verified refunds']] as const;
const reasonLabels:Record<string,string>={
 missing_journal:'Missing accounting journal',duplicate_journal:'Duplicate accounting journals',
 reversed_journal:'Journal was reversed',journal_mismatch:'Journal amount or account mismatch',
 invalid_clearance:'Financial clearance needs review',
};
const money=(minor:number)=>new Intl.NumberFormat('en-PH',{style:'currency',currency:'PHP'}).format(minor/100);

export function NoShowLedgerPanel({hotelId,bookingId,userId}:Props){
 const query=useNoShowLedgerReconciliation(hotelId,bookingId,userId,true);
 const data=query.isFetching||query.isError?undefined:query.data;
 return <section className="no-show-ledger" aria-label="Accounting ledger reconciliation">
  <header className="no-show-ledger-header">
   <div><h4>Accounting ledger</h4><p>Compare folio activity with matched accounting entries.</p></div>
   <button type="button" className="btn-inline" disabled={query.isFetching} onClick={()=>void query.refetch()}>Refresh</button>
  </header>
  {query.isFetching?<p role="status">Checking accounting entries…</p>:query.isError?
   <p role="alert">{query.error instanceof ApiError&&query.error.status===403
    ?'Accounting reconciliation requires administrator access.'
    :'Accounting reconciliation is unavailable. Refresh to try again.'}</p>:data?<>
   <div className="no-show-ledger-status" data-state={data.reconciled?'matched':'review'} role="status">
    <strong>{data.settled?'Ledger reconciled and settled':data.reconciled?'Ledger reconciled · settlement incomplete':'Accounting review needed'}</strong>
    <span>{data.businessDate?'Business date: '+data.businessDate:'Business date unavailable'}</span>
   </div>
   <dl className="no-show-ledger-balances">
    <div><dt>Outstanding receivable</dt><dd>{money(data.expectedBalances.receivableMinor)}</dd><small>Matched ledger: {money(data.matchedJournalBalances.receivableMinor)}</small></div>
    <div><dt>Remaining deposit liability</dt><dd>{money(data.expectedBalances.depositLiabilityMinor)}</dd><small>Matched ledger: {money(data.matchedJournalBalances.depositLiabilityMinor)}</small></div>
   </dl>
   <div className="no-show-ledger-table-wrap"><table className="no-show-ledger-table">
    <caption>Transaction comparison</caption>
    <thead><tr><th scope="col">Transaction</th><th scope="col">Folio</th><th scope="col">Matched ledger</th></tr></thead>
    <tbody>{movements.map(([key,label])=><tr key={key} data-mismatch={data.expectedMinor[key]!==data.matchedJournalMinor[key]}>
     <th scope="row">{label}</th><td>{money(data.expectedMinor[key])}</td><td>{money(data.matchedJournalMinor[key])}
      {data.expectedMinor[key]!==data.matchedJournalMinor[key]&&<small>Mismatch</small>}</td>
    </tr>)}</tbody>
   </table></div>
   {!data.reconciled&&<div className="no-show-ledger-issues">
    <h5>Items to review</h5>
    {data.issues.length>0?<ul>{data.issues.map((issue,index)=><li key={issue.kind+issue.reference+index}>
     <strong>{reasonLabels[issue.reason]??'Accounting discrepancy'}</strong><span>{issue.reference}</span>
    </li>)}</ul>:<p>Folio balances or payment evidence need further review.</p>}
    <p>Review the original payment evidence and accounting records before making corrections.</p>
   </div>}
   <p className="no-show-ledger-note">Read-only booking report. Matched entries only; not a complete general ledger or Daily Closing certification.</p>
  </>:<p role="status">No accounting report available.</p>}
 </section>;
}
