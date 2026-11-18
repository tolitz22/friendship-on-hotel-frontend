import {describe,expect,it} from 'vitest';
import {normalizeBillingBookingId} from './bookingLink';

describe('guest billing deep links',()=>{
 it('accepts ordinary reservation numbers',()=>{
  expect(normalizeBillingBookingId('2')).toBe('2');
  expect(normalizeBillingBookingId(2)).toBe('2');
 });
 it('accepts accidentally quoted positive IDs such as booking=%222%22',()=>{
  expect(normalizeBillingBookingId('"2"')).toBe('2');
  expect(normalizeBillingBookingId('  "2"  ')).toBe('2');
 });
 it('rejects missing, negative, untrusted or malformed IDs',()=>{
  for(const value of ['',null,0,-2,'2+2','"2";drop','0','2x'])expect(normalizeBillingBookingId(value)).toBeUndefined();
 });
});
