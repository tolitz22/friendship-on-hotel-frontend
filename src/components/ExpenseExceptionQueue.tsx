import {useState} from 'react';
import {Link} from '@tanstack/react-router';
import {AlertTriangle,CheckCircle2,RefreshCw,ArrowRight} from 'lucide-react';
import {useExpenseExceptions} from '../api/expenses';
import type {ExpenseExceptions} from '../api/expenses';
import {QueryFeedback} from './QueryFeedback';
import {readableDate} from '../lib/format';

type Kind=ExpenseExceptions['items'][number]['kind'];
const labels:Record<Kind,string>={pending_correction:'Pending corrections',pending_return:'Cash returns to review',flagged_return:'Flagged cash returns',unresolved_clearing:'Unresolved clearing'};
const actions:Record<Kind,string>={pending_correction:'Review correction',pending_return:'Review cash return',flagged_return:'Investigate return',unresolved_clearing:'Inspect clearing'};
const money=(n:number)=>new Intl.NumberFormat('en-PH',{style:'currency',currency:'PHP'}).format(n/100);

export function ExpenseExceptionQueue({hotel}:{hotel:string}){
 const query=useExpenseExceptions(hotel);
 const [filter,setFilter]=useState<Kind|null>(null);
 const data=query.data;
 const counts:Record<Kind,number>={pending_correction:data?.pendingCorrectionCount??0,pending_return:data?.pendingReturnCount??0,flagged_return:data?.flaggedReturnCount??0,unresolved_clearing:data?.unresolvedClearingCount??0};
 const total=Object.values(counts).reduce((a,b)=>a+b,0);
 const items=data?.items.filter(item=>!filter||item.kind===filter)??[];
 return <section className="expense-correction-history" aria-label="Financial issues requiring attention">
  <div className="desk-tools"><h3>Financial issues requiring attention</h3><button type="button" className="btn-inline" disabled={query.isFetching} onClick={()=>void query.refetch()}><RefreshCw size={15}/> Refresh issues</button></div>
  <p className="desk-muted">Current issues across all business dates for this hotel. A voucher can have more than one issue.</p>
  <QueryFeedback loading={query.isPending} error={query.error} onRetry={()=>void query.refetch()}/>
  {data&&!query.isError&&<>
   {total===0?<p className="night-audit-clean"><CheckCircle2 size={17}/> No outstanding corrections, cash-return reviews or clearing issues.</p>:<>
    <div className="night-audit-metrics">
     {(Object.keys(labels) as Kind[]).map(kind=><button type="button" key={kind} className="expense-summary-button night-audit-metric" aria-pressed={filter===kind} disabled={counts[kind]===0} onClick={()=>setFilter(previous=>previous===kind?null:kind)}><small>{labels[kind]}</small><strong>{counts[kind]}</strong></button>)}
    </div>
    {filter&&<button className="btn-inline" type="button" onClick={()=>setFilter(null)}>Show all issues</button>}
    {items.map(item=><article key={item.kind+':'+item.id} className="readable-audit-event">
     <strong><AlertTriangle size={15}/> {item.description} · Voucher #{item.expenseId}</strong>
     <p>{labels[item.kind]} · Original business date {readableDate(item.businessDate)}{item.amountMinor!==null?' · '+money(item.amountMinor):''}</p>
     <Link className="btn-inline" to="/expenses" search={{hotel,expense:item.expenseId,date:item.businessDate}}>{actions[item.kind]} <ArrowRight size={15}/></Link>
    </article>)}
    {items.length===0&&<p>No issues in this category.</p>}
    {(filter?counts[filter]:total)>items.length&&<p className="desk-muted">Showing {items.length} of {filter?counts[filter]:total} issues. Refresh after resolving items to see remaining issues.</p>}
   </>}
  </>}
 </section>;
}
