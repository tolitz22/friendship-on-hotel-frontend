import {describe,expect,it} from 'vitest';
import {pesosToMinor,minorToPesos,parsePlanLimit} from './planPricing';
describe('subscription pricing',()=>{
 it('converts decimal pesos to exact centavos',()=>{
  expect(pesosToMinor('4999.99')).toBe(499999);expect(pesosToMinor('0.01')).toBe(1);expect(pesosToMinor('0')).toBe(0);expect(minorToPesos(499999)).toBe('4999.99');
 });
 it('rejects invalid prices and excessive precision',()=>{
  for(const input of ['', '-1','1.001','1e3','10000000','1,000'])expect(pesosToMinor(input)).toBeNull();
 });
 it('distinguishes unlimited and invalid limits',()=>{
  expect(parsePlanLimit('')).toBeNull();expect(parsePlanLimit('25')).toBe(25);expect(parsePlanLimit('0')).toBeUndefined();expect(parsePlanLimit('100001')).toBeUndefined();expect(parsePlanLimit('2.5')).toBeUndefined();
 });
});
