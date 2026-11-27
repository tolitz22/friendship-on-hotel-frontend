import {describe,it,expect} from 'vitest';
import {recordableBalance} from './billingPayments';
describe('subscription payment capacity',()=>{
 it('reserves pending payments without presenting them as verified',()=>{
 const balance={amountMinor:500000,verifiedMinor:100000,pendingMinor:200000,outstandingMinor:400000};
 expect(recordableBalance(balance)).toBe(200000);
 expect(recordableBalance({...balance,pendingMinor:400000})).toBe(0);
 expect(recordableBalance({...balance,pendingMinor:500000})).toBe(0);
 });
});
