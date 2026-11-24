import {useRef,useState} from 'react';
import {ExpensePayoutModal} from '../components/ExpensePayoutModal';
import {useCurrentCashierShift} from '../api/cashierShifts';
import {EmployeeReimbursements} from '../components/EmployeeReimbursements';
import {SupplierBillRegister} from '../components/SupplierBillRegister';
import {SupplierDirectory} from '../components/SupplierDirectory';
import {ExpenseExceptionQueue} from '../components/ExpenseExceptionQueue';
import {useQueryClient} from '@tanstack/react-query';
import {ExpensePolicyDialog} from '../components/ExpenseManagerDialogs';
import {Link,Navigate,useNavigate,useRouterState,useSearch} from '@tanstack/react-router';
import {Receipt,AlertTriangle} from 'lucide-react';
import {useHotelAuth} from '../components/AuthProvider';
import {Heading,Panel,Stat,Status} from '../components/ui';
import {QueryFeedback} from '../components/QueryFeedback';
import {dataMode} from '../api';
import {useExpenses,useExpensePolicy,expenseDepartments,reviewStatuses} from '../api/expenses';
import type {ExpenseFilters} from '../api/expenses';
import {readableDate} from '../lib/format';
import {expenseMoney as money,expenseDepartmentLabels as labels,expenseReviewLabel as reviewLabel} from '../features/expenses/display';

type RecordPath='drawer'|'direct'|'bill'|'claim';

export type ExpenseView='expenses'|'bills'|'suppliers'|'reimbursements';

function Register({hotel,date,recordPath,onRecordClosed}:{hotel:string;date?:string;recordPath:RecordPath|null;onRecordClosed:()=>void}){
 const {user}=useHotelAuth();
 const client=useQueryClient();
 const navigate=useNavigate({from:'/expenses'});
 const returnedFilters=useRouterState({select:s=>s.location.state.expenseRegister?.hotel===hotel?s.location.state.expenseRegister.filters:undefined});
 const policy=useExpensePolicy(hotel,true);
 const [policyOpen,setPolicyOpen]=useState(false);
 const [message,setMessage]=useState('');
 function refresh(){void Promise.all([client.invalidateQueries({queryKey:['live','expenses',hotel]}),client.invalidateQueries({queryKey:['live','expense-exceptions',hotel]}),client.invalidateQueries({queryKey:['live','expense-detail',hotel]}),client.invalidateQueries({queryKey:['live','expense-policy',hotel]}),client.invalidateQueries({queryKey:['live','cashier-shifts',hotel]}),client.invalidateQueries({queryKey:['live','cashier-shift-detail',hotel]}),client.invalidateQueries({queryKey:['live','current-cashier-shift',hotel]}),client.invalidateQueries({queryKey:['live','cashier-shift-history',hotel]}),client.invalidateQueries({queryKey:['live','night-audit-reconciliation',hotel]})]);}
 const [filters,setFilters]=useState<ExpenseFilters>(returnedFilters??{page:1,...(date?{from:date,to:date}:{})});
 const list=useExpenses(hotel,true,filters);
 const postingEnabled=list.data?.postingEnabled===true;
 const currentShift=useCurrentCashierShift(postingEnabled&&recordPath==='drawer');
 const shift=currentShift.data;
 const payoutAvailable=postingEnabled&&currentShift.isSuccess&&shift?.hotelId===hotel&&
  shift.cashierId===user?.id&&shift.expensePostingEnabled===true;
 const directAvailable=postingEnabled&&recordPath==='direct';
 const payoutShiftId=recordPath==='drawer'&&payoutAvailable?shift.id:undefined;
 function payoutSaved(id:string){
  onRecordClosed();
  refresh();
  void navigate({to:'/expenses/$expenseId',params:{expenseId:id},search:{hotel,date},
   state:{expenseRegister:{hotel,filters},recordedExpenseId:id}});
 }
 const register=useRef<HTMLDivElement>(null);
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
   </div>
  </div>
  {recordPath==='drawer'&&postingEnabled&&<QueryFeedback loading={currentShift.isPending} error={currentShift.error} onRetry={()=>void currentShift.refetch()}/>}
  {recordPath==='drawer'&&postingEnabled&&currentShift.isSuccess&&!payoutAvailable&&<div className="notice">
   {shift?.cashierId===user?.id&&shift?.hotelId===hotel
    ?'Expense posting is unavailable for this shift.'
    :<>Open your own cashier shift to record cash paid out. <Link to="/cashier-shifts">Go to Cashier shifts</Link></>}
  </div>}
  {(payoutShiftId||directAvailable)&&user?.id&&<ExpensePayoutModal key={hotel+':'+recordPath+':'+user.id}
   hotel={hotel} shift={payoutShiftId} userId={user.id} onClose={onRecordClosed} onSuccess={payoutSaved}/>}
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
   {!!list.data?.data.length&&<div className="table-scroll"><table><thead><tr><th>Expense</th><th>Department</th><th>Business date</th><th>Paid from</th><th>Amount</th><th>Review</th><th>Voucher</th></tr></thead><tbody>
    {list.data.data.map(e=><tr key={e.id}><td><strong>{e.description}</strong><small className="expense-payee">{e.payee}</small></td><td>{labels[e.department]}</td><td>{readableDate(e.businessDate)}</td><td>{{cashier_drawer:'Cashier drawer',hotel_bank:'Hotel bank',hotel_card:'Hotel card'}[e.paymentSource]}</td><td>{money(e.amountMinor)}</td><td><Status value={reviewLabel(e.reviewStatus)}/></td><td><Link className="btn-inline" to="/expenses/$expenseId" params={{expenseId:e.id}} search={{hotel,date}}
     state={{expenseRegister:{hotel,filters}}}>{e.reviewStatus==='pending'?'Inspect expense':'View details'}</Link></td></tr>)}
   </tbody></table></div>}
   {list.data&&<div className="desk-tools"><button className="btn-inline" disabled={list.data.meta.page<=1} onClick={()=>setFilters(p=>({...p,page:(p.page??1)-1}))}>Previous</button><span>Page {list.data.meta.page} of {Math.max(1,list.data.meta.totalPages)}</span><button className="btn-inline" disabled={list.data.meta.page>=list.data.meta.totalPages} onClick={()=>setFilters(p=>({...p,page:(p.page??1)+1}))}>Next</button></div>}
  </Panel>
  </div>
  <ExpenseExceptionQueue hotel={hotel}/>
 </>;
}

const expenseViews:ReadonlyArray<{id:ExpenseView;label:string}>=[
 {id:'expenses',label:'Expense register'},
 {id:'bills',label:'Supplier bills'},
 {id:'suppliers',label:'Suppliers'},
 {id:'reimbursements',label:'Reimbursements'},
];

function ExpensesWorkspace({hotel,date,tab}:{hotel:string;date?:string;tab:ExpenseView}){
 const {user}=useHotelAuth();
 const navigate=useNavigate({from:'/expenses'});
 const [chooserOpen,setChooserOpen]=useState(false);
 const [recordPath,setRecordPath]=useState<RecordPath|null>(null);
 const recordButton=useRef<HTMLButtonElement>(null);
 function stopRecording(){
  setChooserOpen(false);
  setRecordPath(null);
  recordButton.current?.focus();
 }
 function record(path:RecordPath,view:ExpenseView){
  setChooserOpen(false);
  setRecordPath(path);
  void navigate({search:previous=>({...previous,tab:view==='expenses'?undefined:view})});
 }
 return <>
  <Heading title="Expenses" description="Record and review hotel expenses, supplier bills, and employee claims."/>
  <div className="desk-tools">
   <button type="button" ref={recordButton} className="btn-primary" aria-expanded={chooserOpen}
    onClick={()=>{setRecordPath(null);setChooserOpen(open=>!open);}}>Record expense</button>
  </div>
  {chooserOpen&&<Panel title="How was this expense paid?">
   <div className="desk-tools">
    <button type="button" className="btn-inline" onClick={()=>record('drawer','expenses')}>Front-desk drawer paid</button>
    <button type="button" className="btn-inline" onClick={()=>record('direct','expenses')}>Hotel bank account or card paid</button>
    <button type="button" className="btn-inline" onClick={()=>record('claim','reimbursements')}>I paid with my own money</button>
    <button type="button" className="btn-inline" onClick={()=>record('bill','bills')}>Supplier hasn’t been paid yet</button>
   </div>
  </Panel>}
  <div className="expense-workspace-nav" role="group" aria-label="Expenses workspace">
   {expenseViews.map(view=><button key={view.id} type="button" className="btn-inline"
    aria-pressed={tab===view.id}
    onClick={()=>{setRecordPath(null);setChooserOpen(false);void navigate({search:previous=>({...previous,tab:view.id==='expenses'?undefined:view.id})});}}>
    {view.label}
   </button>)}
  </div>
  {tab==='expenses'&&<Register hotel={hotel} date={date} recordPath={recordPath} onRecordClosed={stopRecording}/>}
  {tab==='bills'&&<SupplierBillRegister hotel={hotel} recordRequested={recordPath==='bill'} onRecordClosed={stopRecording}/>}
  {tab==='suppliers'&&<SupplierDirectory hotel={hotel}/>}
  {tab==='reimbursements'&&user&&<EmployeeReimbursements hotel={hotel} userId={user.id} admin canSubmit recordRequested={recordPath==='claim'} onRecordClosed={stopRecording}/>}
 </>;
}

export function Expenses(){
 const {hotelId,user}=useHotelAuth();
 const search=useSearch({from:'/expenses'});
 if(dataMode!=='api')return <Heading title="Expenses" description="Available with live hotel data."/>;
 if(!hotelId||user?.hotels.find(h=>h.id===hotelId)?.role!=='admin')return <Heading title="Expenses" description="This workspace requires administrator access."/>;
 if(search.hotel&&search.hotel!==hotelId)return <Heading title="Expenses" description="Select the original hotel to open this voucher."/>; 
 if(search.expense)return <Navigate to="/expenses/$expenseId" params={{expenseId:search.expense}} search={{hotel:hotelId,date:search.date}} replace/>;
 return <ExpensesWorkspace key={hotelId+':'+(search.date??'')} hotel={hotelId} date={search.date} tab={search.tab??'expenses'}/>;
}
