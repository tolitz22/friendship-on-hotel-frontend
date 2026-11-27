import {describe,it,expect} from 'vitest';
import {formatWorkerAge,pushRunStatus} from './workers';
import type {WorkerHeartbeat} from '../../api/platformWorkers';
const pulse=(overrides:Partial<WorkerHeartbeat>):WorkerHeartbeat=>({state:'recent',observedAt:'2026-11-27T12:00:00Z',ageSeconds:1,outcome:'started',serviceRole:'worker',...overrides});
describe('worker observations',()=>{
 it('distinguishes unknown timing from a real zero',()=>{expect(formatWorkerAge(null)).toBe('—');expect(formatWorkerAge(0)).toBe('0s');expect(formatWorkerAge(121)).toBe('2m 1s');});
 it('distinguishes overdue, disabled and failed runs',()=>{
  const start=pulse({state:'stale',observedAt:'2026-11-27T12:05:00Z'});
  expect(pushRunStatus(start,pulse({outcome:'succeeded'}))).toBe('Completion overdue');
  expect(pushRunStatus(pulse({}),pulse({outcome:'disabled'}))).toBe('Delivery disabled');
  expect(pushRunStatus(pulse({}),pulse({outcome:'failed'}))).toBe('Last run failed');
  expect(pushRunStatus(undefined,undefined)).toBe('Unknown');
 });
});
