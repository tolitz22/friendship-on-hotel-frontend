import {ApiError} from '../api/http';
import {useNoShowLedgerReconciliation} from '../api/noShowLedgerReconciliation';
import './NoShowLedgerPanel.css';

type Props={hotelId:string;bookingId:string;userId:string};
const movements=[['deposits','Verified deposits'],['fees','No-show fee'],['allocations','Applied payments'],['refunds','Verified refunds']] as const;
const reasonLabels:Record<string,string>={
 missing_journal:'Missing accounting journal',duplicate_journal:'Duplicate accounting journals',
 reversed_journal:'Journal was reversed',journal_mismatch:'Journal amount or account mismatch',
 invalid_clearance:'Financial clearance needs review',
 payment_evidence_unresolved:'Payment evidence needs resolution',
};
const reasonGuidance:Record<string,string>={
 missing_journal:'Check the original verified transaction and ask a finance administrator to reconcile its accounting entry. Do not record the payment or refund again.',
 duplicate_journal:'Compare both journal references with the original transaction. Request an approved accounting correction; do not delete either entry.',
 reversed_journal:'Review the reversal and its documented reason. Confirm whether a replacement journal is required before treating this item as settled.',
 journal_mismatch:'Compare the original amount, currency and account codes with the journal. Escalate the difference for an approved correction.',
 invalid_clearance:'Review the no-show fee, booking policy and tax treatment. Resolve the accounting clearance before relying on these balances.',
 payment_evidence_unresolved:'Review the listed payment record. An erroneous entry may require an audited void or an approved finance correction.',
};
const kindLabels:Record<string,string>={deposit:'Guest deposit',fee:'No-show fee',allocation:'Payment allocation',refund:'Refund evidence',payment_evidence:'Payment evidence'};
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
   <p>{data.reconciled?'Folio amounts match the checked accounting entries.':'Resolve differences before relying on the settlement balances. A matched amount excludes entries that failed validation.'}</p>
   <dl className="no-show-ledger-balances">
    <div><dt>Outstanding receivable</dt><dd>{money(data.expectedBalances.receivableMinor)}</dd><small>Matched ledger: {money(data.matchedJournalBalances.receivableMinor)}</small>{data.expectedBalances.receivableMinor!==data.matchedJournalBalances.receivableMinor&&<small className="ledger-difference">Difference (folio − ledger): {money(data.expectedBalances.receivableMinor-data.matchedJournalBalances.receivableMinor)}</small>}</div>
    <div><dt>Remaining deposit liability</dt><dd>{money(data.expectedBalances.depositLiabilityMinor)}</dd><small>Matched ledger: {money(data.matchedJournalBalances.depositLiabilityMinor)}</small>{data.expectedBalances.depositLiabilityMinor!==data.matchedJournalBalances.depositLiabilityMinor&&<small className="ledger-difference">Difference (folio − ledger): {money(data.expectedBalances.depositLiabilityMinor-data.matchedJournalBalances.depositLiabilityMinor)}</small>}</div>
   </dl>
   <div className="no-show-ledger-table-wrap"><table className="no-show-ledger-table">
    <caption>Transaction comparison</caption>
    <thead><tr><th scope="col">Transaction</th><th scope="col">Folio</th><th scope="col">Matched ledger</th><th scope="col">Difference</th></tr></thead>
    <tbody>{movements.map(([key,label])=><tr key={key} data-mismatch={data.expectedMinor[key]!==data.matchedJournalMinor[key]}>
     <th scope="row">{label}</th><td>{money(data.expectedMinor[key])}</td><td>{money(data.matchedJournalMinor[key])}
      {data.expectedMinor[key]!==data.matchedJournalMinor[key]&&<small>Mismatch</small>}</td><td>{money(data.expectedMinor[key]-data.matchedJournalMinor[key])}</td>
    </tr>)}</tbody>
   </table></div>
   {!data.reconciled&&<div className="no-show-ledger-issues">
    <h5>Items to review</h5>
    {data.issues.length>0?<ul>{data.issues.map((issue,index)=><li key={issue.kind+issue.reference+index}>
     <strong>{reasonLabels[issue.reason]??'Accounting discrepancy'}</strong><span>{kindLabels[issue.kind]??'Transaction'} · {issue.reference}</span>
     {!!issue.journalIds?.length&&<span>Journal references: {issue.journalIds.map(id=>'#'+id).join(', ')}</span>}
     <p>{reasonGuidance[issue.reason]??'Ask a finance administrator to review the original transaction and its journal before making corrections.'}</p>
    </li>)}</ul>:<p>Folio balances or payment evidence need further review.</p>}
    <p>After the authorized correction is complete, select Refresh to check the updated ledger. This report cannot post or reverse entries.</p>
   </div>}
   <details className="no-show-ledger-trace">
    <summary>Accounting details and journal references</summary>
    {data.journalTrace===undefined?<p>Journal trace details are unavailable on this API version.</p>:data.journalTrace.length===0?<p>No matched transaction references available.</p>:<ul>{data.journalTrace.map((entry,index)=><li key={entry.kind+entry.reference+index}>
     <strong>{kindLabels[entry.kind]??entry.kind} · {money(entry.amountMinor)}</strong>
     <span>{entry.reference} · {entry.status==='matched'?'Matched':reasonLabels[entry.status]??'Review needed'}</span>
     <span>{entry.journalIds.length?entry.journalIds.map(id=>'Journal #'+id).join(', '):'No linked journal reference'}</span>
    </li>)}</ul>}
    <p>Property-wide orphaned journal detection is separate from this booking report. Unlinked journals cannot safely be assigned to this booking.</p>
   </details>
   <p className="no-show-ledger-note">Read-only booking report. Matched entries only; not a complete general ledger or Daily Closing certification.</p>
  </>:<p role="status">No accounting report available.</p>}
 </section>;
}
