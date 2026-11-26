import {describe,expect,it} from 'vitest';
import {parseNoShowLedgerReconciliation,noShowLedgerReconciliationOptions} from './noShowLedgerReconciliation';

const movements={deposits:300000,fees:200000,allocations:200000,refunds:100000};
const balances={depositLiabilityMinor:0,receivableMinor:0};
const data={
 bookingId:'42',currency:'PHP',businessDate:'2026-11-26',scope:'current_no_show_matched_journals_only',
 expectedMinor:movements,matchedJournalMinor:movements,expectedBalances:balances,matchedJournalBalances:balances,
 issues:[],reconciled:true,settled:true,readOnly:true,closingCertified:false,
};
describe('No-show ledger reconciliation API contract',()=>{
 it('accepts a matched and settled booking',()=>{
  expect(parseNoShowLedgerReconciliation({data},'42')).toEqual(data);
 });
 it('accepts a reconciled booking with outstanding balances',()=>{
  const partial={deposits:300000,fees:200000,allocations:100000,refunds:100000};
  const outstanding={depositLiabilityMinor:100000,receivableMinor:100000};
  expect(parseNoShowLedgerReconciliation({data:{...data,expectedMinor:partial,matchedJournalMinor:partial,
   expectedBalances:outstanding,matchedJournalBalances:outstanding,settled:false}},'42').settled).toBe(false);
 });
 it('preserves unmatched journals without presenting false settlement',()=>{
  const result=parseNoShowLedgerReconciliation({data:{...data,matchedJournalMinor:{...movements,refunds:0},
   matchedJournalBalances:{...balances,depositLiabilityMinor:100000},reconciled:false,settled:false,
   issues:[{kind:'refund',reference:'refund-evidence-1',reason:'missing_journal'}]}},'42');
  expect(result.issues[0].reason).toBe('missing_journal');
 });
 it('rejects a different booking and invalid financial values',()=>{
  expect(()=>parseNoShowLedgerReconciliation({data},'43')).toThrow();
  for(const deposits of [1.5,-1,Number.MAX_SAFE_INTEGER+1]){
   expect(()=>parseNoShowLedgerReconciliation({data:{...data,expectedMinor:{...movements,deposits}}},'42')).toThrow();
  }
 });
 it('rejects inconsistent totals, settlement status and reconciliation status',()=>{
  expect(()=>parseNoShowLedgerReconciliation({data:{...data,expectedBalances:{...balances,receivableMinor:1}}},'42')).toThrow();
  expect(()=>parseNoShowLedgerReconciliation({data:{...data,reconciled:false}},'42')).toThrow();
  expect(()=>parseNoShowLedgerReconciliation({data:{...data,issues:[{kind:'deposit',reference:'1',reason:'missing_journal'}]}},'42')).toThrow();
  expect(()=>parseNoShowLedgerReconciliation({data:{...data,closingCertified:true}},'42')).toThrow();
 });
 it('scopes query keys by hotel, booking and user and disables unauthorized requests',()=>{
  expect(noShowLedgerReconciliationOptions('1','42','7',true).queryKey).toEqual(['live','no-show-ledger-reconciliation','1','42','7']);
  expect(noShowLedgerReconciliationOptions('1','42','7',false).enabled).toBe(false);
  expect(noShowLedgerReconciliationOptions('1','invalid','7',true).enabled).toBe(false);
  expect(noShowLedgerReconciliationOptions('1','42','',true).enabled).toBe(false);
 });
});
