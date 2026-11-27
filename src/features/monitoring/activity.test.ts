import {describe,it,expect} from 'vitest';
import {isMonitoringActivity,monitoringRequestIds} from './activity';
import type {MonitoringEvent} from '../../api/platformMonitoring';
const event=(overrides:Partial<MonitoringEvent>):MonitoringEvent=>({timestamp:'2026-11-27T12:00:00Z',event:'pms.api.request.completed',level:'WARNING',environment:'staging',serviceRole:'backend',requestId:'id-1',relatedRequestId:null,route:null,statusCode:429,durationMs:34,screen:null,...overrides});
describe('monitoring activity',()=>{
 it('correlates legacy paired rate-limit events without classifying unrelated security warnings',()=>{
  const request=event({route:'api/v1/platform/monitoring/metrics'});
  const security=event({event:'pms.security.access.rate_limited'});
  const unrelated=event({event:'pms.security.access.rate_limited',requestId:'id-2'});
  const ids=monitoringRequestIds([request,security,unrelated]);
  expect(isMonitoringActivity(request,ids)).toBe(true);
  expect(isMonitoringActivity(security,ids)).toBe(true);
  expect(isMonitoringActivity(unrelated,ids)).toBe(false);
  expect(isMonitoringActivity(event({event:'pms.security.access.rate_limited',route:'api/v1/platform/health'}),new Set())).toBe(true);
 });
});
