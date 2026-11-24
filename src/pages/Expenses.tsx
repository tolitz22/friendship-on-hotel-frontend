import {useEffect,useRef,useState} from 'react';
import {ExpensePayoutModal} from '../components/ExpensePayoutModal';
import {useCurrentCashierShift} from '../api/cashierShifts';
import {EmployeeReimbursements} from '../components/EmployeeReimbursements';
import {SupplierBillRegister} from '../components/SupplierBillRegister';
import {SupplierDirectory} from '../components/SupplierDirectory';
import {ExpenseExceptionQueue} from '../components/ExpenseExceptionQueue';
import {ExpenseCorrectionHistory} from '../components/ExpenseCorrectionHistory';
import {useQueryClient} from '@tanstack/react-query';
import {ExpenseReviewDialog,ExpensePolicyDialog} from '../components/ExpenseManagerDialogs';
import {Link,useNavigate,useSearch} from '@tanstack/react-router';
import {Receipt,AlertTriangle} from 'lucide-react';
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

export type ExpenseView='expenses'|'bills'|'suppliers'|'reimbursements';

function Register({hotel,date,expense}:{hotel:string;date?:string;expense?:string}){
 const {user}=useHotelAuth();
 const client=useQueryClient();
 const policy=useExpensePolicy(hotel,true);
 const [payoutShiftId,setPayoutShiftId]=useState<string|null>(null);
 const payoutButton=useRef<HTMLButtonElement>(null);
 const [policyOpen,setPolicyOpen]=useState(false);
 const [reviewOpen,setReviewOpen]=useState(false);
 const [message,setMessage]=useState('');
 function refresh(){void Promise.all([client.invalidateQueries({queryKey:['live','expenses',hotel]}),client.invalidateQueries({queryKey:['live','expense-exceptions',hotel]}),client.invalidateQueries({queryKey:['live','expense-detail',hotel]}),client.invalidateQueries({queryKey:['live','expense-policy',hotel]}),client.invalidateQueries({queryKey:['live','cashier-shifts',hotel]}),client.invalidateQueries({queryKey:['live','cashier-shift-detail',hotel]}),client.invalidateQueries({queryKey:['live','current-cashier-shift',hotel]}),client.invalidateQueries({queryKey:['live','cashier-shift-history',hotel]}),client.invalidateQueries({queryKey:['live','night-audit-reconciliation',hotel]})]);}
 const [filters,setFilters]=useState<ExpenseFilters>({page:1,...(date?{from:date,to:date}:{})});
 const [selected,setSelected]=useState<string|null>(expense??null);
 const list=useExpenses(hotel,true,filters);
 const detail=useExpenseDetail(hotel,selected);
 const postingEnabled=list.data?.postingEnabled===true;
 const currentShift=useCurrentCashierShift(postingEnabled);
 const shift=currentShift.data;
 const payoutAvailable=postingEnabled&&currentShift.isSuccess&&shift?.hotelId===hotel&&
  shift.cashierId===user?.id&&shift.expensePostingEnabled===true;
 function closePayout(){
  setPayoutShiftId(null);
  payoutButton.current?.focus();
 }
 function payoutSaved(id:string){
  setPayoutShiftId(null);
  setMessage('Expense voucher #'+id+' recorded.');
  setReviewOpen(false);
  if(selected===id)voucher.current?.focus();
  setSelected(id);
  refresh();
 }
 const voucher=useRef<HTMLDivElement>(null);
 const register=useRef<HTMLDivElement>(null);
 const voucherTrigger=useRef<HTMLButtonElement>(null);
 useEffect(()=>{if(selected)voucher.current?.focus();},[selected]);
 function closeDetails(){
  setSelected(null);
  if(voucherTrigger.current?.isConnected)voucherTrigger.current.focus();
  else register.current?.focus();
 }
 const summary=list.data?.summary;
 function filter(next:Partial<ExpenseFilters>){setFilters(previous=>({...previous,...next,page:1}));}
 const hasFilters=!!(filters.search||filters.department||filters.reviewStatus||filters.from||filters.to);
 return <>
  <div className="expense-register-toolbar">
   <div>
    {policy.data&&<p className="desk-muted">Routine payout limit: {policy.data.routineLimitMinor===null?'All payouts need review':money(policy.data.routineLimitMinor)}</p>}
    {policy.isError&&<QueryFeedback loading={false} error={policy.error} onRetry={()=>void policy.refetch()}/>}
   </div>
   <div className="desk-tools">
    <button type="button" className="btn-inline" disabled={!policy.isSuccess} onClick={()=>setPolicyOpen(true)}>Expense policy</button>
    {postingEnabled&&<button ref={payoutButton} type="button" className="btn-primary" disabled={!payoutAvailable}
     onClick={()=>{if(payoutAvailable&&shift){setMessage('');setPayoutShiftId(shift.id);}}}>Record cash paid out</button>}
   </div>
  </div>
  {postingEnabled&&<QueryFeedback loading={currentShift.isPending} error={currentShift.error} onRetry={()=>void currentShift.refetch()}/>}
  {postingEnabled&&currentShift.isSuccess&&!payoutAvailable&&<div className="notice">
   {shift?.cashierId===user?.id&&shift?.hotelId===hotel
    ?'Expense posting is unavailable for this shift.'
    :<>Open your own cashier shift to record cash paid out. <Link to="/cashier-shifts">Go to Cashier shifts</Link></>}
  </div>}
  {payoutShiftId&&user?.id&&<ExpensePayoutModal key={hotel+':'+payoutShiftId+':'+user.id}
   hotel={hotel} shift={payoutShiftId} userId={user.id} onClose={closePayout} onSuccess={payoutSaved}/>}
  {message&&<p role="status" className="cashier-feedback-success">{message}</p>}
  {policyOpen&&policy.data&&<ExpensePolicyDialog hotel={hotel} currentLimit={policy.data.routineLimitMinor} onClose={()=>setPolicyOpen(false)} onSaved={()=>{setPolicyOpen(false);setMessage('Expense policy saved.');refresh();}}/>}
  {list.data&&!list.data.postingEnabled&&<div className="notice">Expense posting is not enabled for this deployment. Existing vouchers remain available for review.</div>}
  <div className="expense-summary expense-register-summary">
   <Stat label="Original expenses this month" value={summary?.monthExpenseMinor==null?'—':money(summary.monthExpenseMinor)} detail={summary?.businessDate?'Business date '+readableDate(summary.businessDate):'Financial business date required'} icon={<Receipt size={20}/>}/>
   <button className="expense-summary-button" type="button" aria-label={summary?'Needs review ('+summary.pendingReviewCount+')':'Needs review'}
    aria-pressed={filters.reviewStatus==='pending'} disabled={!summary}
    onClick={()=>{filter({reviewStatus:filters.reviewStatus==='pending'?undefined:'pending'});register.current?.focus();}}>
    <Stat label="Needs review" value={summary?String(summary.pendingReviewCount):'—'} detail={summary?summary.flaggedCount+' flagged for investigation':'Awaiting expense data'} icon={<AlertTriangle size={20}/>}/>
   </button>
  </div>
  <div ref={register} tabIndex={-1} role="region" aria-label="Expense register" className="expense-focus-target">
  <Panel title="Expense register">
   <div className="expense-filters">
    <label>Search<input className="wizard-input" value={filters.search??''} placeholder="Payee, purpose or invoice" onChange={e=>filter({search:e.target.value})}/></label>
    <label>Department<select className="wizard-input" value={filters.department??''} onChange={e=>filter({department:(e.target.value||undefined) as ExpenseFilters['department']})}><option value="">All departments</option>{expenseDepartments.map(d=><option key={d} value={d}>{labels[d]}</option>)}</select></label>
    <label>Review status<select className="wizard-input" value={filters.reviewStatus??''} onChange={e=>filter({reviewStatus:(e.target.value||undefined) as ExpenseFilters['reviewStatus']})}><option value="">All statuses</option>{reviewStatuses.map(s=><option key={s} value={s}>{reviewLabel(s)}</option>)}</select></label>
    <label>From business date<input type="date" className="wizard-input" value={filters.from??''} max={filters.to} onChange={e=>filter({from:e.target.value||undefined})}/></label>
    <label>To business date<input type="date" className="wizard-input" value={filters.to??''} min={filters.from} onChange={e=>filter({to:e.target.value||undefined})}/></label>
    <button className="btn-inline" type="button" disabled={!hasFilters} onClick={()=>setFilters({page:1})}>Clear filters</button>
   </div>
   <QueryFeedback loading={list.isPending} error={list.error} onRetry={()=>void list.refetch()}/>
   {list.data&&list.data.data.length===0&&<p>{hasFilters?'No expenses match these filters.':'No expense vouchers have been recorded yet.'}</p>}
   {!!list.data?.data.length&&<div className="table-scroll"><table><thead><tr><th>Expense</th><th>Department</th><th>Business date</th><th>Amount</th><th>Review</th><th>Voucher</th></tr></thead><tbody>
    {list.data.data.map(e=><tr key={e.id}><td><strong>{e.description}</strong><small className="expense-payee">{e.payee}</small></td><td>{labels[e.department]}</td><td>{readableDate(e.businessDate)}</td><td>{money(e.amountMinor)}</td><td><Status value={reviewLabel(e.reviewStatus)}/></td><td><button className="btn-inline" type="button" onClick={event=>{voucherTrigger.current=event.currentTarget;setReviewOpen(false);setSelected(e.id);voucher.current?.focus();}}>{e.reviewStatus==='pending'?'Inspect expense':'View details'}</button></td></tr>)}
   </tbody></table></div>}
   {list.data&&<div className="desk-tools"><button className="btn-inline" disabled={list.data.meta.page<=1} onClick={()=>setFilters(p=>({...p,page:(p.page??1)-1}))}>Previous</button><span>Page {list.data.meta.page} of {Math.max(1,list.data.meta.totalPages)}</span><button className="btn-inline" disabled={list.data.meta.page>=list.data.meta.totalPages} onClick={()=>setFilters(p=>({...p,page:(p.page??1)+1}))}>Next</button></div>}
  </Panel>
  </div>
  {selected&&<div ref={voucher} tabIndex={-1} role="region" aria-label="Expense voucher" className="expense-focus-target">
  <Panel title="Expense voucher" action={<button className="btn-inline" onClick={closeDetails}>Close details</button>}>
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
    {reviewOpen&&detail.data.reviewStatus==='pending'&&detail.data.recordedBy!==user?.id&&!!user?.id&&<ExpenseReviewDialog key={'review-'+detail.data.id} hotel={hotel} expense={detail.data} onClose={()=>setReviewOpen(false)} onSaved={()=>{setReviewOpen(false);setMessage('Expense review recorded.');refresh();}}/>}
    {detail.data.review&&<p><strong>{detail.data.review.reviewedByName??'Manager'} · {statusLabel(detail.data.review.decision)}</strong> — {detail.data.review.note} ({readableDateTime(detail.data.review.createdAt)})</p>}
    {user?.id&&<ExpenseCorrectionHistory key={'history-'+detail.data.id} hotel={hotel} expense={detail.data} userId={user.id}/>}
   </>}
  </Panel></div>}
  <ExpenseExceptionQueue hotel={hotel}/>
 </>;
}

const expenseViews:ReadonlyArray<{id:ExpenseView;label:string}>=[
 {id:'expenses',label:'Expense register'},
 {id:'bills',label:'Supplier bills'},
 {id:'suppliers',label:'Suppliers'},
 {id:'reimbursements',label:'Reimbursements'},
];

function ExpensesWorkspace({hotel,date,expense,tab}:{hotel:string;date?:string;expense?:string;tab:ExpenseView}){
 const {user}=useHotelAuth();
 const navigate=useNavigate({from:'/expenses'});
 return <>
  <Heading title="Expenses" description="Review cash payouts, supplier invoices, and employee expense claims."/>
  <div className="expense-workspace-nav" role="group" aria-label="Expenses workspace">
   {expenseViews.map(view=><button key={view.id} type="button" className="btn-inline"
    aria-pressed={tab===view.id}
    onClick={()=>void navigate({search:previous=>({...previous,tab:view.id==='expenses'?undefined:view.id})})}>
    {view.label}
   </button>)}
  </div>
  {tab==='expenses'&&<Register hotel={hotel} date={date} expense={expense}/>}
  {tab==='bills'&&<SupplierBillRegister hotel={hotel}/>}
  {tab==='suppliers'&&<SupplierDirectory hotel={hotel}/>}
  {tab==='reimbursements'&&user&&<EmployeeReimbursements hotel={hotel} userId={user.id} admin canSubmit/>}
 </>;
}

export function Expenses(){
 const {hotelId,user}=useHotelAuth();
 const search=useSearch({from:'/expenses'});
 if(dataMode!=='api')return <Heading title="Expenses" description="Available with live hotel data."/>;
 if(!hotelId||user?.hotels.find(h=>h.id===hotelId)?.role!=='admin')return <Heading title="Expenses" description="This workspace requires administrator access."/>;
 if(search.hotel&&search.hotel!==hotelId)return <Heading title="Expenses" description="Select the original hotel to open this voucher."/>; 
 return <ExpensesWorkspace key={hotelId+':'+(search.date??'')+':'+(search.expense??'')} hotel={hotelId} date={search.date} expense={search.expense} tab={search.tab??'expenses'}/>;
}
