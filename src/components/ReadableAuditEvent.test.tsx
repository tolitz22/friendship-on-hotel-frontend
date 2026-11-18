import {describe,expect,it} from 'vitest';
import {cashEventDetails,describeAuditChanges} from './ReadableAuditEvent';

describe('staff-readable activity history',()=>{
 it('shows actual changed fields, not only a revision or numeric ID',()=>{
  const changes=describeAuditChanges(
   {status:'todo',priority:'medium',revision:1,assignedTo:'Maria'},
   {status:'in_progress',priority:'urgent',revision:2,assignedTo:'Jose'},
  );
  expect(changes).toEqual([
   {label:'Progress',from:'To Do',to:'In Progress'},
   {label:'Priority',from:'Medium',to:'Urgent'},
   {label:'Assigned staff',from:'Maria',to:'Jose'},
  ]);
 });
 it('does not display arbitrary or potentially sensitive audit snapshot keys',()=>{
  const changes=describeAuditChanges({status:'open'},{
   status:'resolved',password:'secret',token:'private',phone:'0912',revision:99,
   unknownPaymentToken:'hidden',apiKey:'bad',
  });
  expect(changes).toHaveLength(1);
  expect(JSON.stringify(changes)).not.toMatch(/secret|private|0912|hidden|bad/);
 });
 it('distinguishes a new record from an invented old value',()=>{
  expect(describeAuditChanges(null,{status:'todo',type:'checkout_clean'}))
   .toEqual([
    {label:'Progress',from:null,to:'To Do'},
    {label:'Task type',from:null,to:'Checkout Clean'},
   ]);
 });
 it('describes real cash receipt evidence with peso amount and booking reference',()=>{
  expect(cashEventDetails('cash_received',{
   paymentId:'17',bookingId:'2',amountMinor:250000,reference:'CASH-XYZ',
   password:'never visible',
  })).toEqual([
   {label:'Cash payment',value:'₱2,500.00'},
   {label:'Guest booking',value:'Booking #2'},
   {label:'Receipt reference',value:'CASH-XYZ'},
  ]);
 });
 it('describes the physical drawer count and discrepancy',()=>{
  expect(cashEventDetails('submitted',{
   countedCashMinor:105000,expectedCashMinor:100000,varianceMinor:5000,receiptCount:2,
  })).toEqual([
   {label:'Cash physically counted',value:'₱1,050.00'},
   {label:'Expected drawer total',value:'₱1,000.00'},
   {label:'Difference',value:'₱50.00'},
   {label:'Receipts included',value:'2'},
  ]);
 });
});
