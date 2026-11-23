import {describe,expect,it} from 'vitest';
import {isGuestBillSettled} from './reviewedPaymentSettlement';

const payment={status:'staff_confirmed',verificationStatus:null,amountMinor:5000};
const bill={netRecordedChargesMinor:10000,payments:[payment,payment],refunds:[]};

describe('guest bill settlement after payment review',()=>{
 it('settles when confirmed payments exactly cover the recorded charges',()=>{
  expect(isGuestBillSettled(bill)).toBe(true);
 });
 it('keeps partial payments, excess payments and pending reviews open',()=>{
  expect(isGuestBillSettled({...bill,payments:[payment]})).toBe(false);
  expect(isGuestBillSettled({...bill,payments:[payment,payment,payment]})).toBe(false);
  expect(isGuestBillSettled({...bill,payments:[payment,{...payment,status:'pending_review'}]})).toBe(false);
 });
 it('keeps rejected evidence and unresolved refunds open',()=>{
  expect(isGuestBillSettled({...bill,payments:[payment,{...payment,verificationStatus:'rejected'}]})).toBe(false);
  expect(isGuestBillSettled({...bill,refunds:[{status:'requested'}]})).toBe(false);
 });
});
