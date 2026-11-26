import {Link} from '@tanstack/react-router';
import {AlertTriangle,CheckCircle2} from 'lucide-react';
import type {NoShowClosingIntegrityReport} from './FinancialBusinessDayPanel';

const guidance:Record<string,[string,string]>={
 ledger_not_reconciled:['Guest account needs reconciliation','Open the guest bill and compare verified deposits, fees, allocations and refunds with the accounting ledger.'],
 correction_requires_resolution:['Financial correction needs resolution','Open the correction history and review the proposal, independent approval and posting status.'],
 unsupported_folio_currency:['Unsupported folio currency','Ask a finance administrator to review this account before closing.'],
 orphaned_journal:['Orphaned accounting journal','The original transaction cannot be located. Investigate the journal reference; do not create a replacement payment or delete the journal.'],
 invalid_source_reference:['Invalid journal source reference','Ask a finance administrator to trace the original transaction and document an approved correction.'],
 duplicate_journal:['Duplicate accounting journal','Compare the listed journal references and the original transaction. Use an approved correction rather than deleting entries.'],
 duplicate_reversal:['Duplicate reversal','Review the original journal and all reversal entries before posting any further corrections.'],
 orphaned_reversal:['Missing original journal','Trace the original accounting entry before treating the reversal as valid.'],
 correction_review_missing:['Correction approval missing','Investigate the journal and its independent approval record.'],
 correction_original_not_in_snapshot:['Correction evidence mismatch','Compare the approved snapshot with the linked original journal.'],
};
const readable=(s:string)=>s.replaceAll('_',' ');
export function NoShowClosingIntegrity({report,refreshing}:{report?:NoShowClosingIntegrityReport|null;refreshing:boolean}){
 return <section className="night-audit-issues" aria-label="No-show financial integrity">
  <h4>No-show financial integrity</h4>
  {refreshing?<p role="status">Refreshing financial integrity checks…</p>:!report?<p>Extended no-show integrity validation is not active or not available in this response. Existing closing checks still apply.</p>:<>
   <div className="night-audit-metrics">
    <div className="night-audit-metric"><small>Bookings checked</small><strong>{report.scannedBookingCount}</strong></div>
    <div className="night-audit-metric"><small>Journal sources checked</small><strong>{report.scannedJournalCount}</strong></div>
    <div className="night-audit-metric"><small>Integrity issues</small><strong>{report.issues.length}</strong></div>
   </div>
   {report.integrityValid?<p className="night-audit-clean"><CheckCircle2 size={17}/> No discrepancies found in the checked no-show accounting scope.</p>:<>
    <p role="status"><AlertTriangle size={17}/> Closing is blocked until these financial discrepancies are resolved.</p>
    {report.issues.map((issue,i)=>{
     const [title,description]=guidance[issue.reason]??['Financial discrepancy','Ask a finance administrator to investigate the affected record before closing.'];
     return <div className="no-show-closing-issue" key={i}>
      <strong>{title}</strong><p>{description}</p>
      <p>{[issue.bookingId?'Booking #'+issue.bookingId:null,issue.journalId?'Journal #'+issue.journalId:null,issue.firstJournalId?'Related journal #'+issue.firstJournalId:null,issue.proposalId?'Proposal #'+issue.proposalId:null,issue.sourceReference,issue.status?readable(issue.status):null].filter(Boolean).join(' · ')}</p>
      {!!issue.details?.length&&<details><summary>Accounting discrepancies ({issue.details.length})</summary><ul>{issue.details.map((d,j)=><li key={j}>{readable(d.reason)} · {d.reference}{d.journalIds?.length?' · Journal '+d.journalIds.map(id=>'#'+id).join(', '):''}</li>)}</ul></details>}
      {issue.bookingId?<Link to="/billing" search={{booking:issue.bookingId,action:'no-show'}}>Open guest account #{issue.bookingId}</Link>:<p>Property-wide issue; no verified booking link is available.</p>}
     </div>;
    })}
    <p>After resolving the issues, use Refresh readiness to recheck the financial date.</p>
   </>}
   <p className="desk-muted">Current carry-forward no-show checks only; not a historical trial balance or full accounting certification.</p>
  </>}
 </section>;
}
