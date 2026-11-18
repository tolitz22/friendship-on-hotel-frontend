import {describe,expect,it} from 'vitest';
import {calculateCashChange,formatBillingMoney,parseBillingAmount} from './billing';

describe('billing money entry safeguards',()=>{
 it('accepts whole and two-decimal positive monetary amounts only',()=>{
  expect(parseBillingAmount('1')).toBe(100);
  expect(parseBillingAmount('0.01')).toBe(1);
  expect(parseBillingAmount('1250.50')).toBe(125050);
 });
 it('rejects zero, negative, precision errors, exponent and unsafe input',()=>{
  for(const invalid of ['', '0', '0.00', '-10', '+10', '1.005','1e5',
   '12,500', '1.2.3', '9999999999999999',' 100'])expect(parseBillingAmount(invalid)).toBeNull();
 });
 it('calculates cash change using centavos without recording overpayment',()=>{
  expect(calculateCashChange(250000,300000)).toBe(50000);
  expect(calculateCashChange(250000,250000)).toBe(0);
  expect(calculateCashChange(250000,200000)).toBeNull();
  expect(calculateCashChange(null,300000)).toBeNull();
  expect(calculateCashChange(0,50000)).toBeNull();
 });
 it('formats PHP centavos as pesos without rounding integer minor units incorrectly',()=>{
  expect(formatBillingMoney(125050,'PHP')).toContain('1,250.50');
 });
});
