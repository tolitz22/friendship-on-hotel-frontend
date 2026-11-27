import {describe,expect,it} from 'vitest';
import {summarizeMonitoring} from './summary';
import type {MonitoringEvent} from '../../api/platformMonitoring';
const event=(overrides:Partial<MonitoringEvent>):MonitoringEvent=>({timestamp:'2026-11-27T12:00:00Z',event:'pms.api.request.completed',level:'INFO',environment:'staging',serviceRole:'backend',requestId:null,relatedRequestId:null,route:'api/v1/hotels',statusCode:200,durationMs:10,screen:null,...overrides});
describe('monitoring sample',()=>{
 it('counts only request events as HTTP server failures and computes sampled p95',()=>{
  const summary=summarizeMonitoring([event({}),event({level:'ERROR',statusCode:503,durationMs:200}),event({event:'pms.frontend.error_reported',level:'WARNING',statusCode:500}),event({event:'pms.security.login.failed',level:'WARNING'})],'2026-11-27T12:01:00Z',15);
  expect(summary.requests).toBe(2);expect(summary.serverErrors).toBe(1);expect(summary.p95).toBe(200);
  expect(summary.frontendErrors).toBe(1);expect(summary.authFailures).toBe(1);expect(summary.slowRoutes[0].average).toBe(105);
  expect(summary.trend.reduce((n,b)=>n+b.errors,0)).toBe(1);
 });
 it('has no invented latency when no request duration is available',()=>{
  expect(summarizeMonitoring([],'2026-11-27T12:00:00Z',60).p95).toBeNull();
 });
});
