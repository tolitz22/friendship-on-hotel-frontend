import {useEffect,useRef,useState} from 'react';
import {ExpensePayoutModal} from '../components/ExpensePayoutModal';
import {useCurrentCashierShift} from '../api/cashierShifts';
import {EmployeeReimbursements} from '../components/EmployeeReimbursements';
import {SupplierBillRegister} from '../components/SupplierBillRegister';
import {SupplierDirectory} from '../components/SupplierDirectory';
import {ExpenseExceptionQueue} from '../components/ExpenseExceptionQueue';
import {useQueryClient} from '@tanstack/react-query';
import {ExpensePolicyDialog} from '../components/ExpenseManagerDialogs';
import {Link,Navigate,useNavigate,useRouterState,useSearch} from '@tanstack/react-router';
import {Receipt,AlertTriangle,X,Wallet,CreditCard,UserRound,FileText,ChevronRight,Plus,Settings2,Search,Building2} from 'lucide-react';
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
   <button className={"expense-summary-button"+(summary?.pendingReviewCount?" has-pending":"")} type="button" aria-label={summary?'Needs review ('+summary.pendingReviewCount+')':'Needs review'}
    aria-pressed={filters.reviewStatus==='pending'} disabled={!summary}
    onClick={()=>{filter({reviewStatus:filters.reviewStatus==='pending'?undefined:'pending'});register.current?.focus();}}>
    <Stat label="Needs review" value={summary?String(summary.pendingReviewCount):'—'} detail={summary?summary.flaggedCount+' flagged for investigation · Click to filter':'Awaiting expense data'} icon={<AlertTriangle size={20}/>}/>
   </button>
  </div>
  <div className="expense-register-toolbar">
   <div>
    {policy.data&&<p className="desk-muted">Routine payout limit: {policy.data.routineLimitMinor===null?'All payouts need review':money(policy.data.routineLimitMinor)}</p>}
    {policy.isError&&<QueryFeedback loading={false} error={policy.error} onRetry={()=>void policy.refetch()}/>}
   </div>
   <div className="desk-tools">
    <button type="button" className="btn-inline expense-policy-action" disabled={!policy.isSuccess} onClick={()=>setPolicyOpen(true)}><Settings2 size={16} aria-hidden="true"/> Expense policy</button>
   </div>
  </div>
  <div ref={register} tabIndex={-1} role="region" aria-label="Expense register" className="expense-focus-target">
  <Panel title="Expense register" action={<span className="expense-result-count">{list.data?`${list.data.meta.total.toLocaleString()} ${list.data.meta.total===1?'expense':'expenses'}`:''}</span>}>
   <div className="expense-filters expense-register-filters">
    <label className="expense-search-field">Search<div className="expense-search-input"><Search size={16} aria-hidden="true"/><input className="wizard-input" value={filters.search??''} placeholder="Payee, purpose or invoice" onChange={e=>filter({search:e.target.value})}/></div></label>
    <label>Department<select className="wizard-input" value={filters.department??''} onChange={e=>filter({department:(e.target.value||undefined) as ExpenseFilters['department']})}><option value="">All departments</option>{expenseDepartments.map(d=><option key={d} value={d}>{labels[d]}</option>)}</select></label>
    <label>Review status<select className="wizard-input" value={filters.reviewStatus??''} onChange={e=>filter({reviewStatus:(e.target.value||undefined) as ExpenseFilters['reviewStatus']})}><option value="">All statuses</option>{reviewStatuses.map(s=><option key={s} value={s}>{reviewLabel(s)}</option>)}</select></label>
    <label>From business date<input type="date" className="wizard-input" value={filters.from??''} max={filters.to} onChange={e=>filter({from:e.target.value||undefined})}/></label>
    <label>To business date<input type="date" className="wizard-input" value={filters.to??''} min={filters.from} onChange={e=>filter({to:e.target.value||undefined})}/></label>
    <button className="btn-inline" type="button" disabled={!hasFilters} onClick={()=>setFilters({page:1})}>Clear filters</button>
   </div>
   <QueryFeedback loading={list.isPending} error={list.error} onRetry={()=>void list.refetch()}/>
   {list.data&&list.data.data.length===0&&<div className="expense-empty"><Receipt size={30} aria-hidden="true"/><strong>{hasFilters?'No expenses match these filters.':'No expense vouchers have been recorded yet.'}</strong><p>{hasFilters?'Try a different search or clear your filters.':'Use Record expense to add the first transaction.'}</p></div>}
   {!!list.data?.data.length&&<div className="table-scroll expense-register-table"><table><thead><tr><th>Expense</th><th>Department</th><th>Business date</th><th>Paid from</th><th className="expense-amount">Amount</th><th>Review</th><th>Voucher</th></tr></thead><tbody>
    {list.data.data.map(e=><tr key={e.id}><td><strong className="expense-row-title">{e.description}</strong><small className="expense-payee">{e.payee} · #{e.id}</small></td><td>{labels[e.department]}</td><td>{readableDate(e.businessDate)}</td><td>{{cashier_drawer:'Cashier drawer',hotel_bank:'Hotel bank',hotel_card:'Hotel card'}[e.paymentSource]}</td><td className="expense-amount">{money(e.amountMinor)}</td><td><Status value={reviewLabel(e.reviewStatus)}/></td><td><Link className="btn-inline expense-row-action" to="/expenses/$expenseId" params={{expenseId:e.id}} search={{hotel,date}}
     state={{expenseRegister:{hotel,filters}}}>{e.reviewStatus==='pending'?'Inspect expense':'View details'}<ChevronRight size={14} aria-hidden="true"/></Link></td></tr>)}
   </tbody></table></div>}
   {list.data&&<div className="desk-tools expense-pagination"><button className="btn-inline" disabled={list.data.meta.page<=1} onClick={()=>setFilters(p=>({...p,page:(p.page??1)-1}))}>Previous</button><span>Page {list.data.meta.page} of {Math.max(1,list.data.meta.totalPages)}</span><button className="btn-inline" disabled={list.data.meta.page>=list.data.meta.totalPages} onClick={()=>setFilters(p=>({...p,page:(p.page??1)+1}))}>Next</button></div>}
  </Panel>
  </div>
  <ExpenseExceptionQueue hotel={hotel}/>
 </>;
}

const expenseViews:ReadonlyArray<{id:ExpenseView;label:string;Icon:typeof Receipt}>=[
 {id:'expenses',label:'Expense register',Icon:Receipt},
 {id:'bills',label:'Supplier bills',Icon:FileText},
 {id:'suppliers',label:'Suppliers',Icon:Building2},
 {id:'reimbursements',label:'Reimbursements',Icon:UserRound},
];

function ExpensesWorkspace({hotel,date,tab,recordRequested=false}:{hotel:string;date?:string;tab:ExpenseView;recordRequested?:boolean}){
 const {user}=useHotelAuth();
 const navigate=useNavigate({from:'/expenses'});
 const [chooserOpen,setChooserOpen]=useState(recordRequested);
 useEffect(()=>{if(recordRequested){setChooserOpen(true);void navigate({search:previous=>({...previous,record:undefined}),replace:true});}},[recordRequested,navigate]);
 const [recordPath,setRecordPath]=useState<RecordPath|null>(null);
 const recordButton=useRef<HTMLButtonElement>(null);
 const chooser=useRef<HTMLDialogElement>(null);
 useEffect(()=>{
  const dialog=chooser.current;
  if(chooserOpen&&dialog&&!dialog.open)dialog.showModal();
  else if(!chooserOpen&&dialog?.open)dialog.close();
 },[chooserOpen]);
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
 return <div className="expenses-page">
  <Heading title="Expenses" description="Record and review hotel expenses, supplier bills, and employee claims." action={
   <button type="button" ref={recordButton} className="btn-primary" aria-expanded={chooserOpen} aria-haspopup="dialog"
    onClick={()=>{setRecordPath(null);setChooserOpen(open=>!open);}}><Plus size={18} aria-hidden="true"/> Record expense</button>}/>
  <style>{`
.expenses-page{min-width:0}
.expenses-page .heading{display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-bottom:20px}
.expenses-page .heading .btn-primary{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:42px;white-space:nowrap}
.expenses-page .expense-workspace-nav{display:flex;flex-wrap:nowrap;gap:20px;overflow-x:auto;padding:0;margin:0 0 20px;border-bottom:1px solid var(--border)}
.expenses-page .expense-workspace-nav .btn-inline{display:inline-flex;align-items:center;gap:8px;flex-shrink:0;border:0;border-bottom:2px solid transparent;border-radius:0;background:none;color:var(--muted);padding:12px 3px;white-space:nowrap}
.expenses-page .expense-workspace-nav .btn-inline[aria-pressed=true]{background:none;border-bottom-color:var(--accent);color:var(--text)}
.expenses-page .expense-register-summary{grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;margin-bottom:16px}
.expenses-page .expense-register-summary .stat{border-radius:12px;min-width:0}
.expenses-page .expense-summary-button.has-pending .stat{border-color:color-mix(in srgb,var(--accent) 60%,var(--border))}
.expenses-page .expense-summary-button:hover .stat{border-color:var(--accent)}
.expenses-page .expense-summary-button[aria-pressed=true] .stat{outline:2px solid var(--accent);outline-offset:-2px}
.expenses-page .expense-register-toolbar{padding:10px 14px;border:1px solid var(--border);border-radius:10px;background:var(--surface);margin-bottom:16px}
.expenses-page .expense-policy-action,.expenses-page .expense-row-action{display:inline-flex;align-items:center;gap:6px;white-space:nowrap}
.expenses-page .expense-result-count{font-size:12px;color:var(--muted);white-space:nowrap}
.expenses-page .expense-register-filters{grid-template-columns:repeat(6,minmax(0,1fr));gap:12px;align-items:end;padding:12px;background:var(--canvas);border:1px solid var(--border);border-radius:10px}
.expenses-page .expense-register-filters>label{grid-column:span 2;font-size:12px;font-weight:600}
.expenses-page .expense-register-filters .expense-search-field{grid-column:span 2}
.expenses-page .expense-search-input{position:relative;min-width:0}
.expenses-page .expense-search-input svg{position:absolute;left:11px;top:50%;transform:translateY(-50%);color:var(--muted);pointer-events:none}
.expenses-page .expense-search-input input{padding-left:35px}
.expenses-page .expense-register-filters .wizard-input{min-height:40px}
.expenses-page .expense-register-filters>button{grid-column:span 2;justify-self:end;min-height:40px}
.expenses-page .expense-register-table table{min-width:840px}
.expenses-page .expense-register-table th{font-size:11px;white-space:nowrap;background:var(--canvas)}
.expenses-page .expense-register-table th,.expenses-page .expense-register-table td{padding:13px 12px;vertical-align:middle}
.expenses-page .expense-register-table tbody tr:hover{background:color-mix(in srgb,var(--accent) 4%,var(--surface))}
.expenses-page .expense-register-table .expense-amount{text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums}
.expenses-page .expense-register-table td.expense-amount{font-weight:700}
.expenses-page .expense-row-title{display:block;overflow-wrap:anywhere}
.expenses-page .expense-register-table .expense-payee{color:var(--muted);opacity:1;font-size:11px}
.expenses-page .expense-pagination{display:flex;justify-content:flex-end;align-items:center;gap:12px;flex-wrap:wrap;margin-top:14px;font-size:12px;color:var(--muted)}
.expenses-page .expense-empty{display:grid;justify-items:center;text-align:center;gap:8px;padding:40px 16px;color:var(--muted)}
.expenses-page .expense-empty strong{color:var(--text)}
.expenses-page .expense-empty p{margin:0;font-size:12px}
.expenses-page dialog.expense-payout-dialog::backdrop{background:rgba(15,23,42,.55)}
.expenses-page dialog.expense-payout-dialog .btn-inline:hover{border-color:var(--accent)}
.expenses-page button:focus-visible,.expenses-page a:focus-visible,.expenses-page input:focus-visible,.expenses-page select:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
@media(max-width:760px){.expenses-page .expense-register-filters{grid-template-columns:repeat(2,minmax(0,1fr))}.expenses-page .expense-register-filters>label{grid-column:span 1}.expenses-page .expense-register-filters .expense-search-field{grid-column:1/-1}.expenses-page .expense-register-filters>button{grid-column:1/-1}.expenses-page .expense-workspace-nav{gap:16px}}
@media(max-width:480px){.expenses-page .expense-register-summary{grid-template-columns:1fr}.expenses-page .heading .btn-primary{width:100%}.expenses-page .expense-register-filters{grid-template-columns:1fr}.expenses-page .expense-pagination{justify-content:center}.expenses-page .expense-register-toolbar{align-items:flex-start}}
`}</style>
  <dialog ref={chooser} aria-labelledby="expense-record-title" onCancel={e=>{e.preventDefault();stopRecording();}} className="billing-action-modal expense-payout-dialog" style={{margin:'auto',maxWidth:'min(560px, calc(100% - 32px))',maxHeight:'calc(100% - 32px)',overflowY:'auto'}}>
   <div className="billing-action-modal-header">
    <div><h3 id="expense-record-title">How was this expense paid?</h3><p>Choose how the purchase was funded to record it correctly.</p></div>
    <button type="button" className="billing-modal-dismiss" aria-label="Close expense options" onClick={stopRecording}><X size={20}/></button>
   </div>
   <div style={{display:'grid',gap:10}}>
    {([
     {path:'drawer',view:'expenses',label:'Front-desk drawer paid',hint:'Cash taken from your active cashier shift.',Icon:Wallet},
     {path:'direct',view:'expenses',label:'Hotel bank account or card paid',hint:'Already paid using hotel funds outside the drawer.',Icon:CreditCard},
     {path:'claim',view:'reimbursements',label:'I paid with my own money',hint:'Submit an employee reimbursement claim.',Icon:UserRound},
     {path:'bill',view:'bills',label:'Supplier hasn’t been paid yet',hint:'Record an unpaid supplier invoice.',Icon:FileText},
    ] as const).map(({path,view,label,hint,Icon})=><button key={path} type="button" className="btn-inline" aria-label={label} onClick={()=>record(path,view)} style={{display:'flex',alignItems:'center',gap:12,width:'100%',textAlign:'left',whiteSpace:'normal',padding:12}}>
     <Icon size={20} aria-hidden="true"/><span style={{flex:1}}><strong style={{display:'block'}}>{label}</strong><small className="desk-muted">{hint}</small></span><ChevronRight size={18} aria-hidden="true"/>
    </button>)}
   </div>
   <div className="cash-shift-close-buttons"><button type="button" className="btn-inline" onClick={stopRecording}>Cancel</button></div>
  </dialog>
  <div className="expense-workspace-nav" role="group" aria-label="Expenses workspace">
   {expenseViews.map(view=><button key={view.id} type="button" className="btn-inline"
    aria-pressed={tab===view.id}
    onClick={()=>{setRecordPath(null);setChooserOpen(false);void navigate({search:previous=>({...previous,tab:view.id==='expenses'?undefined:view.id})});}}>
    <view.Icon size={17} aria-hidden="true"/>{view.label}
   </button>)}
  </div>
  {tab==='expenses'&&<Register hotel={hotel} date={date} recordPath={recordPath} onRecordClosed={stopRecording}/>}
  {tab==='bills'&&<SupplierBillRegister hotel={hotel} recordRequested={recordPath==='bill'} onRecordClosed={stopRecording}/>}
  {tab==='suppliers'&&<SupplierDirectory hotel={hotel}/>}
  {tab==='reimbursements'&&user&&<EmployeeReimbursements hotel={hotel} userId={user.id} admin canSubmit recordRequested={recordPath==='claim'} onRecordClosed={stopRecording}/>}
 </div>;
}

export function Expenses(){
 const {hotelId,user}=useHotelAuth();
 const search=useSearch({from:'/expenses'});
 if(dataMode!=='api')return <Heading title="Expenses" description="Available with live hotel data."/>;
 if(!hotelId||user?.hotels.find(h=>h.id===hotelId)?.role!=='admin')return <Heading title="Expenses" description="This workspace requires administrator access."/>;
 if(search.hotel&&search.hotel!==hotelId)return <Heading title="Expenses" description="Select the original hotel to open this voucher."/>; 
 if(search.expense)return <Navigate to="/expenses/$expenseId" params={{expenseId:search.expense}} search={{hotel:hotelId,date:search.date}} replace/>;
 return <ExpensesWorkspace key={hotelId+':'+(search.date??'')} hotel={hotelId} date={search.date} tab={search.tab??'expenses'} recordRequested={search.record===true}/>;
}
