import {describe,expect,it} from 'vitest';
import {percentToBps,pesosToMinor} from './TaxPolicies';

describe('tax form staff-facing units',()=>{
 it('converts pesos to integer centavos without floating-point rounding',()=>{
  expect(pesosToMinor('1120.00')).toBe(112000);
  expect(pesosToMinor('0.01')).toBe(1);
  expect(pesosToMinor('12.3')).toBe(1230);
  expect(pesosToMinor('12.345')).toBeNull();
  expect(pesosToMinor('-1')).toBeNull();
  expect(pesosToMinor('10000000000.01')).toBeNull();
 });
 it('converts percentage to basis points and enforces range',()=>{
  expect(percentToBps('12.00')).toBe(1200);
  expect(percentToBps('0.01')).toBe(1);
  expect(percentToBps('100')).toBe(10000);
  expect(percentToBps('100.01')).toBeNull();
  expect(percentToBps('12.345')).toBeNull();
 });
});
