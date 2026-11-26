import {z} from 'zod';

const line=z.object({accountCode:z.string(),debitMinor:z.number().int(),creditMinor:z.number().int()});
const journal=z.object({journalId:z.string(),sourceType:z.string(),businessDate:z.string(),currency:z.string(),postedBy:z.string().nullable(),postedAt:z.string(),originalJournalId:z.string().nullable(),originalSourceType:z.string().nullable(),originalBusinessDate:z.string().nullable(),originalJournalFound:z.boolean().nullable(),subsequentlyReversed:z.boolean(),businessDateClosed:z.boolean(),originalLines:z.array(line),lines:z.array(line)});
export const correctionAuditSchema=z.object({
 kind:z.enum(['room','fee']),proposalId:z.string(),businessDate:z.string(),proposedBy:z.string(),proposedAt:z.string(),reason:z.string(),reviewId:z.string().nullable(),reviewedBy:z.string().nullable(),reviewedAt:z.string().nullable(),reviewReason:z.string().nullable(),snapshotIntegrityValid:z.boolean(),independentReview:z.boolean(),postingActorMatchesReviewer:z.boolean().nullable(),status:z.string(),
 integrityIssues:z.array(z.object({reason:z.string(),journalId:z.string(),firstJournalId:z.string().optional()})),originalJournalIds:z.array(z.string()),replacementJournalIds:z.array(z.string()),
 accountMovements:z.array(z.object({accountCode:z.string(),originalNetMinor:z.number().int(),correctionNetMinor:z.number().int(),combinedNetMinor:z.number().int()})),journals:z.array(journal),
});
type Audit=z.infer<typeof correctionAuditSchema>;
type Line=z.infer<typeof line>;
const money=(n:number)=>new Intl.NumberFormat('en-PH',{style:'currency',currency:'PHP'}).format(n/100);
const net=(n:number)=>n===0?money(0):money(Math.abs(n))+(n>0?' Dr':' Cr');
const readable=(s:string)=>s.replaceAll('_',' ');
const statuses:Record<string,string>={awaiting_review:'Awaiting independent approval',approved_unposted:'Approved · not posted',posted_verified:'Posted and validated',posted_requires_reconciliation:'Posted · reconciliation required',invalid_snapshot:'Invalid evidence snapshot'};
function Lines({lines,title}:{lines:Line[];title:string}){
 return <div className="no-show-ledger-table-wrap"><table className="no-show-ledger-table"><caption>{title}</caption><thead><tr><th scope="col">Account</th><th scope="col">Debit</th><th scope="col">Credit</th></tr></thead><tbody>{lines.map((l,i)=><tr key={i}><th scope="row">{l.accountCode}</th><td>{money(l.debitMinor)}</td><td>{money(l.creditMinor)}</td></tr>)}</tbody></table></div>;
}
export function NoShowCorrectionAudit({corrections}:{corrections:Audit[]}){
 const ordered=[...corrections].sort((a,b)=>b.proposedAt.localeCompare(a.proposedAt)||b.proposalId.localeCompare(a.proposalId));
 return <section className="no-show-overview" aria-label="Financial correction audit trail">
  <h4>Financial correction audit trail</h4><p>Read-only history of proposals, approvals and posted accounting corrections. This is not a closing certificate.</p>
  {ordered.length===0?<p>No correction history recorded.</p>:ordered.map(g=><details className="no-show-ledger-trace" key={g.kind+g.proposalId}>
   <summary>{g.kind==='room'?'Room reversal':'Fee correction'} #{g.proposalId} · {statuses[g.status]??'Unknown status'}</summary>
   <div className="no-show-audit-content">
    <p><strong>Proposed:</strong> {g.proposedAt} · Staff #{g.proposedBy} · Business date {g.businessDate}</p><p>{g.reason}</p>
    {g.reviewId?<><p><strong>Reviewed:</strong> {g.reviewedAt} · Staff #{g.reviewedBy} · Review #{g.reviewId}</p><p>{g.reviewReason}</p></>:<p>Independent approval not recorded.</p>}
    <p>Evidence snapshot: {g.snapshotIntegrityValid?'Valid':'Invalid'} · Independent approval: {g.independentReview?'Confirmed':'Not confirmed'} · Posting actor: {g.postingActorMatchesReviewer===null?'Not posted':g.postingActorMatchesReviewer?'Matches reviewer':'Mismatch'}</p>
    {g.integrityIssues.length>0&&<ul>{g.integrityIssues.map((issue,i)=><li key={i}>{readable(issue.reason)} · Journal #{issue.journalId}{issue.firstJournalId?' · Related journal #'+issue.firstJournalId:''}</li>)}</ul>}
    {g.status==='posted_requires_reconciliation'&&<p role="alert">Do not rely on this correction until accounting discrepancies are resolved.</p>}
    {g.journals.length===0?<p>No correction journals posted.</p>:<>
     <p>Original journals: {g.originalJournalIds.map(id=>'#'+id).join(', ')||'None linked'} · Replacement journals: {g.replacementJournalIds.map(id=>'#'+id).join(', ')||'None'}</p>
     {g.journals.map(j=><div className="no-show-deposit-row" key={j.journalId}>
      <strong>Journal #{j.journalId} · {readable(j.sourceType)}</strong>
      <p>{j.businessDate} · {j.businessDateClosed?'Closed business date':'Not marked closed'} · Posted {j.postedAt} · Staff {j.postedBy?'#'+j.postedBy:'unavailable'}</p>
      {j.originalJournalId&&<p>Reverses journal #{j.originalJournalId} · {j.originalBusinessDate??'Date unavailable'}{j.originalJournalFound===false?' · Original not found':''}</p>}
      {j.subsequentlyReversed&&<p role="alert">This correction journal was subsequently reversed.</p>}
      {j.originalLines.length>0&&<Lines lines={j.originalLines} title="Original journal lines"/>}
      <Lines lines={j.lines} title="Correction journal lines"/>
     </div>)}
     <div className="no-show-ledger-table-wrap"><table className="no-show-ledger-table"><caption>Linked net accounting movements</caption><thead><tr><th scope="col">Account</th><th scope="col">Original</th><th scope="col">Correction</th><th scope="col">Combined</th></tr></thead><tbody>{g.accountMovements.map(m=><tr key={m.accountCode}><th scope="row">{m.accountCode}</th><td>{net(m.originalNetMinor)}</td><td>{net(m.correctionNetMinor)}</td><td>{net(m.combinedNetMinor)}</td></tr>)}</tbody></table></div>
     <p>Dr = net debit; Cr = net credit. These are linked movements, not general ledger balances.</p>
    </>}
   </div>
  </details>)}
 </section>;
}
