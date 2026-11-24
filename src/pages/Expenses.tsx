import {useState} from 'react';
import {ExpenseCorrectionHistory} from '../components/ExpenseCorrectionHistory';
import {useQueryClient} from '@tanstack/react-query';
import {ExpenseReviewDialog,ExpensePolicyDialog} from '../components/ExpenseManagerDialogs';
import {Link} from '@tanstack/react-router';
import {Receipt,Wallet,AlertTriangle} from 'lucide-react';
import {useHotelAuth} from '../components/AuthProvider';
import {Heading,Panel,Stat,Status} from '../components/ui';
import {QueryFeedback} from '../components/QueryFeedback';
import {dataMode} from '../api';
import {useExpenses,useExpenseDetail,useExpensePolicy,expenseDepartments,reviewStatuses} from '../api/expenses';
import type {ExpenseFilters} from '../api/expenses';
import {readableDate,readableDateTime,statusLabel} from '../lib/format';

const money=(n:number)=>new Intl.NumberFormat('en-PH',{style:'currency',currency:'PHP'}).format(n/100);
const labels={rooms:'Rooms',maintenance:'Property operations & maintenance',administration:'Administration',utilities:'Energy, water & waste',food_beverage:'Food & beverage'};
const reviewLabel=(value:string)=>value==='not_required'?'No review required':value==='pending'?'Needs review':statusLabel(value);

function Register({hotel}:{hotel:string}){
 const {user}=useHotelAuth();
 const client=useQueryClient();
 const policy=useExpensePolicy(hotel,true);
 const [policyOpen,setPolicyOpen]=useState(false);
 const [reviewOpen,setReviewOpen]=useState(false);
 const [message,setMessage]=useState('');
 function refresh(){void Promise.all([client.invalidateQueries({queryKey:['live','expenses',hotel]}),client.invalidateQueries({queryKey:['live','expense-detail',hotel]}),client.invalidateQueries({queryKey:['live','expense-policy',hotel]}),client.invalidateQueries({queryKey:['live','cashier-shifts',hotel]}),client.invalidateQueries({queryKey:['live','cashier-shift-detail',hotel]}),client.invalidateQueries({queryKey:['live','current-cashier-shift',hotel]})]);}
 const [filters,setFilters]=useState<ExpenseFilters>({page:1});
 const [selected,setSelected]=useState<string|null>(null);
 const list=useExpenses(hotel,true,filters);
 const detail=useExpenseDetail(hotel,selected);
 const summary=list.data?.summary;
 function filter(next:Partial<ExpenseFilters>){setFilters(previous=>({...previous,...next,page:1}));}
 return <>
  <Heading title="Expenses" description="Track hotel operating costs, cash payouts and independent reviews."
   action={<div className="desk-tools"><button type="button" className="btn-inline" disabled={!policy.isSuccess} onClick={()=>setPolicyOpen(true)}>Expense policy</button>{list.data?.postingEnabled&&<Link className="btn-primary" to="/cashier-shifts">Record cash paid out</Link>}</div>}/>
  {message&&<p role="status" className="cashier-feedback-success">{message}</p>}
  <QueryFeedback loading={policy.isPending} error={policy.error} onRetry={()=>void policy.refetch()}/>
  {policy.data&&<p className="desk-muted">Routine payout limit: {policy.data.routineLimitMinor===null?'Not configured — all payouts need review':money(policy.data.routineLimitMinor)}</p>}
  {policyOpen&&policy.data&&<ExpensePolicyDialog hotel={hotel} currentLimit={policy.data.routineLimitMinor} onClose={()=>setPolicyOpen(false)} onSaved={()=>{setPolicyOpen(false);setMessage('Expense policy saved.');refresh();}}/>}
  {list.data&&!list.data.postingEnabled&&<div className="notice">Expense posting is not enabled for this deployment. Existing vouchers remain available for review.</div>}
  <div className="expense-summary">
   <Stat label="Expenses this month" value={summary?.monthExpenseMinor==null?'—':money(summary.monthExpenseMinor)} detail={summary?.businessDate?'Business date '+readableDate(summary.businessDate):'Financial business date required'} icon={<Receipt size={20}/>}/>
   <Stat label="Unpaid bills" value="—" detail="Supplier billing is not available yet" icon={<Wallet size={20}/>}/>
   <button className="expense-summary-button" type="button" onClick={()=>filter({reviewStatus:'pending'})}>
    <Stat label="Needs review" value={summary?String(summary.pendingReviewCount):'—'} detail={summary?summary.flaggedCount+' flagged for investigation':'Awaiting expense data'} icon={<AlertTriangle size={20}/>}/>
   </button>
  </div>
  <Panel title="Expense register">
   <div className="expense-filters">
    <label>Search<input className="wizard-input" value={filters.search??''} placeholder="Payee, purpose or invoice" onChange={e=>filter({search:e.target.value})}/></label>
    <label>Department<select className="wizard-input" value={filters.department??''} onChange={e=>filter({department:(e.target.value||undefined) as ExpenseFilters['department']})}><option value="">All departments</option>{expenseDepartments.map(d=><option key={d} value={d}>{labels[d]}</option>)}</select></label>
    <label>Review status<select className="wizard-input" value={filters.reviewStatus??''} onChange={e=>filter({reviewStatus:(e.target.value||undefined) as ExpenseFilters['reviewStatus']})}><option value="">All statuses</option>{reviewStatuses.map(s=><option key={s} value={s}>{reviewLabel(s)}</option>)}</select></label>
    <button className="btn-inline" type="button" onClick={()=>setFilters({page:1})}>Clear filters</button>
   </div>
   <QueryFeedback loading={list.isPending} error={list.error} onRetry={()=>void list.refetch()}/>
   {list.data&&list.data.data.length===0&&<p>No expenses match these filters.</p>}
   {!!list.data?.data.length&&<div className="table-scroll"><table><thead><tr><th>Expense</th><th>Department</th><th>Business date</th><th>Amount</th><th>Payment</th><th>Review</th><th>Voucher</th></tr></thead><tbody>
    {list.data.data.map(e=><tr key={e.id}><td><strong>{e.description}</strong><small className="expense-payee">{e.payee}</small></td><td>{labels[e.department]}</td><td>{readableDate(e.businessDate)}</td><td>{money(e.amountMinor)}</td><td><Status value="Paid"/></td><td><Status value={reviewLabel(e.reviewStatus)}/></td><td><button className="btn-inline" type="button" onClick={()=>{setReviewOpen(false);setSelected(e.id);}}>{e.reviewStatus==='pending'?'Inspect expense':'View details'}</button></td></tr>)}
   </tbody></table></div>}
   {list.data&&<div className="desk-tools"><button className="btn-inline" disabled={list.data.meta.page<=1} onClick={()=>setFilters(p=>({...p,page:(p.page??1)-1}))}>Previous</button><span>Page {list.data.meta.page} of {Math.max(1,list.data.meta.totalPages)}</span><button className="btn-inline" disabled={list.data.meta.page>=list.data.meta.totalPages} onClick={()=>setFilters(p=>({...p,page:(p.page??1)+1}))}>Next</button></div>}
  </Panel>
  {selected&&<Panel title="Expense voucher" action={<button className="btn-inline" onClick={()=>setSelected(null)}>Close details</button>}>
   <QueryFeedback loading={detail.isPending} error={detail.error} onRetry={()=>void detail.refetch()}/>
   {detail.data&&<><h3>{detail.data.description} · {money(detail.data.amountMinor)}</h3><dl className="expense-detail-grid">
    <div><dt>Payee</dt><dd>{detail.data.payee}</dd></div><div><dt>Department</dt><dd>{labels[detail.data.department]}</dd></div>
    <div><dt>Category</dt><dd>{statusLabel(detail.data.category)}</dd></div><div><dt>Service date</dt><dd>{readableDate(detail.data.serviceDate)}</dd></div>
    <div><dt>Business date</dt><dd>{readableDate(detail.data.businessDate)}</dd></div><div><dt>Invoice reference</dt><dd>{detail.data.invoiceReference??'Not recorded'}</dd></div>
    <div><dt>Recorded by</dt><dd>{detail.data.recordedByName??'Staff name unavailable'}</dd></div><div><dt>Recorded at</dt><dd>{readableDateTime(detail.data.createdAt)}</dd></div>
    <div><dt>Payment source</dt><dd>Cashier drawer</dd></div><div><dt>Review</dt><dd>{reviewLabel(detail.data.reviewStatus)}</dd></div>
    <div><dt>Journal reference</dt><dd>#{detail.data.journalId}</dd></div></dl>
    {detail.data.shiftId&&<Link to="/cashier-shifts" search={{shift:detail.data.shiftId,hotel}}>View cashier shift</Link>}
    {detail.data.reviewStatus==='pending'&&<div className="notice"><strong>Independent review required.</strong> {detail.data.reviewReason==='above_limit'?'This payout exceeded the routine limit.':'Review is required by the expense policy.'} {detail.data.recordedBy===user?.id?'Another administrator must review your own expense.':''}
    {detail.data.recordedBy!==user?.id&&!!user?.id&&<button type="button" className="btn-primary" onClick={()=>setReviewOpen(true)}>Review expense</button>}</div>}
    {reviewOpen&&detail.data.reviewStatus==='pending'&&detail.data.recordedBy!==user?.id&&!!user?.id&&<ExpenseReviewDialog key={detail.data.id} hotel={hotel} expense={detail.data} onClose={()=>setReviewOpen(false)} onSaved={()=>{setReviewOpen(false);setMessage('Expense review recorded.');refresh();}}/>}
    {detail.data.review&&<p><strong>{detail.data.review.reviewedByName??'Manager'} · {statusLabel(detail.data.review.decision)}</strong> — {detail.data.review.note} ({readableDateTime(detail.data.review.createdAt)})</p>}
    {user?.id&&<ExpenseCorrectionHistory key={detail.data.id} hotel={hotel} expense={detail.data} userId={user.id}/>}
   </>}
  </Panel>}
 </>;
}

export function Expenses(){
 const {hotelId,user}=useHotelAuth();
 if(dataMode!=='api')return <Heading title="Expenses" description="Available with live hotel data."/>;
 if(!hotelId||user?.hotels.find(h=>h.id===hotelId)?.role!=='admin')return <Heading title="Expenses" description="This workspace requires administrator access."/>;
 return <Register key={hotelId} hotel={hotelId}/>;
}
