import {describe,expect,it} from 'vitest';
import {aggregateCards} from './aggregate';
import type {MonitoringMetrics} from '../../api/platformMonitoring';
const base:MonitoringMetrics={state:'ready',observedAt:'2026-11-27T12:00:00Z',minutes:60,counts:{requests:2512,serverErrors:12,errors:12,frontendErrors:4,authFailures:3},p95:123.5,latencyState:'ready',trend:[]};
describe('full-window monitoring cards',()=>{
 it('uses aggregate counts beyond the event-list limit',()=>{
  expect(aggregateCards(base)).toEqual({...base.counts,p95:123.5});
 });
 it('distinguishes unavailable counts and latency from observed zero',()=>{
  expect(aggregateCards(undefined).requests).toBeNull();
  expect(aggregateCards({...base,state:'partial',counts:null,latencyState:'unavailable'}).p95).toBeNull();
  expect(aggregateCards({...base,counts:{requests:0,serverErrors:0,errors:0,frontendErrors:0,authFailures:0},p95:null,latencyState:'no_data'}).requests).toBe(0);
 });
});
