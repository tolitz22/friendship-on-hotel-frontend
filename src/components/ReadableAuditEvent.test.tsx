import {describe,expect,it} from 'vitest';
import {auditActorName,cashEventDetails,describeAuditChanges,ReadableInspectionAuditEvent} from './ReadableAuditEvent';
import {renderToStaticMarkup} from 'react-dom/server';

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
 it('prioritizes attributed actor names and does not show opaque IDs',()=>{
  expect(auditActorName('1','Angelito')).toBe('Angelito');
  expect(auditActorName('1',null,'1','Angelito')).toBe('Angelito');
  expect(auditActorName('22',null,'1','Angelito')).toBe('Employee name unavailable');
 });
 it('renders the actual inspection checks and review note with actor name',()=>{
  const html=renderToStaticMarkup(<ReadableInspectionAuditEvent event={{
   id:'10',inspectionId:'7',actorId:'1',actorName:'Angelito',action:'submitted',
   details:{checks:{cleaningVerified:true,safetyVerified:true,amenitiesVerified:false}},
   createdAt:'2026-11-18T06:44:20Z',
  }}/>);
  expect(html).toContain('Angelito');
  expect(html).toContain('Submitted room inspection');
  expect(html).toContain('Cleanliness');
  expect(html).toContain('Not verified');
  expect(html).not.toContain('Staff #1');
 });
 it('describes real cash receipt evidence with peso amount and booking reference',()=>{
  expect(cashEventDetails('cash_received',{
   paymentId:'17',bookingId:'2',amountMinor:250000,reference:'CASH-XYZ',
   password:'never visible',
  })).toEqual([
   {label:'Net cash payment (older receipt; tender/change not captured)',value:'₱2,500.00'},
   {label:'Guest booking',value:'Booking #2'},
   {label:'Receipt reference',value:'CASH-XYZ'},
  ]);
 });
 it('distinguishes modern cash tender and change from older net-only receipts',()=>{
  expect(cashEventDetails('cash_received',{
   cashTenderedMinor:300000,changeGivenMinor:50000,netReceiptMinor:250000,
   bookingId:'2',reference:'CASH-NEW',password:'never visible',
  })).toEqual([
   {label:'Cash handed over',value:'₱3,000.00'},
   {label:'Change returned to guest',value:'₱500.00'},
   {label:'Net cash kept in drawer',value:'₱2,500.00'},
   {label:'Guest booking',value:'Booking #2'},
   {label:'Receipt reference',value:'CASH-NEW'},
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

it('describes expense payout evidence and excludes unrelated fields',()=>{
 expect(cashEventDetails('expense_payout',{amountMinor:35000,payee:'Supply Shop',description:'Cleaning supplies',expenseId:'7',password:'secret'})).toEqual([
  {label:'Cash paid out',value:'₱350.00'}, {label:'Payee',value:'Supply Shop'}, {label:'Purpose',value:'Cleaning supplies'}, {label:'Expense voucher',value:'#7'},
 ]);
});
