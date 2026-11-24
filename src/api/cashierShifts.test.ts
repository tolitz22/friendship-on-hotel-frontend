import {describe,expect,it} from 'vitest';
import {parseShifts} from './cashierShifts';
const row={
 id:'4',hotelId:'1',cashierId:'8',currency:'PHP',status:'submitted',
 openingFloatMinor:5000,expectedCashMinor:15000,countedCashMinor:14500,
 varianceMinor:-500,receiptCount:1,unconfirmedReceiptCount:1,
 closingNote:null,managerNote:null,reviewedBy:null,
 openedAt:'2026-11-18 08:00:00',submittedAt:'2026-11-18 16:00:00',
 reconciledAt:null,
};
const payload={data:[row],meta:{page:1,perPage:20,total:1,totalPages:1}};

describe('Phase 52 cashier response safety',()=>{
 it('preserves integer minor-unit variance and hotel context',()=>{
  const result=parseShifts(payload,'1');
  expect(result.data[0].varianceMinor).toBe(-500);
  expect(result.data[0].unconfirmedReceiptCount).toBe(1);
 });
 it('rejects foreign hotel data',()=>{
  expect(()=>parseShifts(payload,'2')).toThrow(/hotel boundaries/);
 });
 it('rejects fabricated states and malformed amounts',()=>{
  expect(()=>parseShifts({...payload,data:[{...row,status:'paid'}]},'1')).toThrow();
  expect(()=>parseShifts({...payload,data:[{...row,openingFloatMinor:-2}]},'1')).toThrow();
 });
 it('requires hidden expected cash for an open shift',()=>{
  const open={...row,status:'open',expectedCashMinor:null,countedCashMinor:null,varianceMinor:null,
   submittedAt:null};
  expect(parseShifts({...payload,data:[open]},'1').data[0].expectedCashMinor).toBeNull();
 });
});

it('preserves expense payouts without exposing expected cash before count submission',()=>{
 const payout={id:'1',expenseId:'7',amountMinor:35000,payee:'Supply Shop',description:'Cleaning supplies',department:'rooms',category:'cleaning_supplies',reviewStatus:'pending',createdAt:'2026-11-24'};
 const open={...row,status:'open',expectedCashMinor:null,countedCashMinor:null,varianceMinor:null,expensePostingEnabled:true,expensePayoutTotalMinor:35000,expensePayoutCount:1,expensePayouts:[payout]};
 const parsed=parseShifts({...payload,data:[open]},'1').data[0];
 expect(parsed.expensePayouts).toEqual([payout]);
 expect(parsed.expensePayoutTotalMinor).toBe(35000);
 expect(parsed.expectedCashMinor).toBeNull();
 expect(()=>parseShifts({...payload,data:[{...open,expensePayoutTotalMinor:-1}]},'1')).toThrow();
});
