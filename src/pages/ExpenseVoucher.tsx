import {useEffect,useRef,useState} from 'react';
import {Link,useParams,useRouterState,useSearch} from '@tanstack/react-router';
import {useQueryClient} from '@tanstack/react-query';
import {ArrowLeft} from 'lucide-react';
import {dataMode} from '../api';
import {useExpenseDetail} from '../api/expenses';
import {useHotelAuth} from '../components/AuthProvider';
import {ExpenseCorrectionHistory} from '../components/ExpenseCorrectionHistory';
import {ExpenseReviewDialog} from '../components/ExpenseManagerDialogs';
import {QueryFeedback} from '../components/QueryFeedback';
import {Heading,Panel,Status} from '../components/ui';
import {expenseDepartmentLabels,expenseMoney,expenseReviewLabel} from '../features/expenses/display';
import {readableDate,readableDateTime,statusLabel} from '../lib/format';
import './ExpenseVoucher.css';

export function ExpenseVoucher(){
 const {hotelId,user}=useHotelAuth();
 const {expenseId}=useParams({from:'/expenses/$expenseId'});
 const {hotel,date}=useSearch({from:'/expenses/$expenseId'});
 if(dataMode!=='api'||!hotelId||!user?.hotels.some(h=>h.id===hotelId&&h.role==='admin')){
  return <Heading title="Expense voucher" description="This workspace requires administrator access."/>;
 }
 if(hotel&&hotel!==hotelId)return <Heading title="Expense voucher" description="Select the original hotel to open this voucher."/>;
 if(!/^[1-9]\d*$/.test(expenseId))return <>
  <Heading title="Expense voucher" description="This voucher reference is invalid."/>
  <Link className="btn-inline" to="/expenses">Back to expense register</Link>
 </>;
 return <Voucher key={hotelId+':'+expenseId} hotel={hotelId} userId={user.id} expenseId={expenseId} date={date}/>;
}

function Voucher({hotel,userId,expenseId,date}:{hotel:string;userId:string;expenseId:string;date?:string}){
 const detail=useExpenseDetail(hotel,expenseId);
 const client=useQueryClient();
 const page=useRef<HTMLDivElement>(null);
 const [reviewOpen,setReviewOpen]=useState(false);
 const [reviewSaved,setReviewSaved]=useState(false);
 const state=useRouterState({select:s=>s.location.state});
 const previous=state.expenseRegister?.hotel===hotel?state.expenseRegister:undefined;
 useEffect(()=>{page.current?.focus();},[]);
 const expense=detail.data;
 const canReview=expense?.reviewStatus==='pending'&&expense.recordedBy!==userId;

 function savedReview(){
  setReviewOpen(false);
  setReviewSaved(true);
  for(const name of ['expenses','expense-exceptions','expense-detail','expense-history','cashier-shifts',
   'cashier-shift-detail','current-cashier-shift','cashier-shift-history','night-audit-reconciliation']){
   void client.invalidateQueries({queryKey:['live',name,hotel]});
  }
 }
 return <div className="expense-voucher-page expense-focus-target" ref={page} tabIndex={-1} role="region" aria-label="Expense voucher">
  <div className="desk-tools">
   <Link className="btn-inline" to="/expenses" search={{hotel,date}} state={{expenseRegister:previous}}><ArrowLeft size={16}/> Back to expense register</Link>
  </div>
  <Heading title={expense?.description??'Expense voucher'} description={'Voucher #'+expenseId}/>
  {state.recordedExpenseId===expenseId&&<p role="status" className="cashier-feedback-success">Expense voucher #{expenseId} recorded.</p>}
  {reviewSaved&&<p role="status" className="cashier-feedback-success">Expense review recorded.</p>}
  <QueryFeedback loading={detail.isPending} error={detail.error} onRetry={()=>void detail.refetch()}/>
  {expense&&<>
   <div className="expense-voucher-summary">
    <div><small>Amount paid</small><strong>{expenseMoney(expense.amountMinor)}</strong></div>
    <div><small>Payee</small><strong>{expense.payee}</strong></div>
    <div><small>Business date</small><strong>{readableDate(expense.businessDate)}</strong></div>
    <div><small>Review status</small><Status value={expenseReviewLabel(expense.reviewStatus)}/></div>
   </div>
   {expense.reviewStatus==='pending'&&<Panel title="Independent review required" action={
    canReview&&<button type="button" className="btn-primary" disabled={detail.isFetching} onClick={()=>setReviewOpen(true)}>Review expense</button>
   }>
    <p>{expense.reviewReason==='above_limit'?'This payout exceeded the routine limit.':'The expense policy requires a manager review.'}</p>
    {!canReview&&<p>Another manager needs to review this voucher because you recorded the payout.</p>}
   </Panel>}
   {expense.review&&<Panel title="Manager review">
    <p><strong>{expense.review.reviewedByName??'Manager'} · {statusLabel(expense.review.decision)}</strong> · {readableDateTime(expense.review.createdAt)}</p>
    <p>{expense.review.note}</p>
   </Panel>}
   <Panel title="Voucher details" action={expense.shiftId&&<Link className="btn-inline" to="/cashier-shifts" search={{shift:expense.shiftId,hotel}}>View cashier shift</Link>}>
    <dl className="expense-detail-grid">
     <div><dt>Department</dt><dd>{expenseDepartmentLabels[expense.department]}</dd></div>
     <div><dt>Category</dt><dd>{statusLabel(expense.category)}</dd></div>
     <div><dt>Purchase date</dt><dd>{readableDate(expense.serviceDate)}</dd></div>
     <div><dt>Payment source</dt><dd>{{cashier_drawer:'Cashier drawer',hotel_bank:'Hotel bank account',hotel_card:'Hotel card'}[expense.paymentSource]}</dd></div>
     <div><dt>Invoice reference</dt><dd>{expense.invoiceReference??'Not recorded'}</dd></div>
     <div><dt>Journal reference</dt><dd>#{expense.journalId}</dd></div>
     {expense.paymentReference&&<div><dt>Payment reference</dt><dd>{expense.paymentReference}</dd></div>}
     <div><dt>Recorded by</dt><dd>{expense.recordedByName??'Staff name unavailable'}</dd></div>
     <div><dt>Recorded at</dt><dd>{readableDateTime(expense.createdAt)}</dd></div>
    </dl>
   </Panel>
   {expense.paymentSource==='cashier_drawer'&&<ExpenseCorrectionHistory hotel={hotel} expense={expense} userId={userId}/>}
   {reviewOpen&&canReview&&<ExpenseReviewDialog hotel={hotel} expense={expense} onClose={()=>setReviewOpen(false)} onSaved={savedReview}/>}
  </>}
 </div>;
}
