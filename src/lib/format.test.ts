import {describe,expect,it} from 'vitest';
import {readableDate,readableDateTime} from './format';

describe('readable hotel dates',()=>{
 it('shows calendar dates as month day year without timezone rollover',()=>{
  expect(readableDate('2026-11-19')).toBe('Nov 19, 2026');
  expect(readableDate('2026-11-21')).toBe('Nov 21, 2026');
  expect(readableDate('2026-11-19T00:00:00Z')).toBe('Nov 19, 2026');
 });
 it('does not invent dates from invalid source values',()=>{
  expect(readableDate(null)).toBe('—');
  expect(readableDate('2026-02-30')).toBe('2026-02-30');
  expect(readableDate('not-a-date')).toBe('not-a-date');
 });
 it('formats actual timestamps in Philippine hotel time',()=>{
  expect(readableDateTime('2026-11-18T06:45:00Z')).toBe('Nov 18, 2026, 2:45 PM');
  expect(readableDateTime('2026-11-19')).toBe('Nov 19, 2026');
 });
});
