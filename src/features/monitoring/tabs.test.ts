import {describe,it,expect} from 'vitest';
import {monitoringTabs,monitoringQueryScope,nextMonitoringTab} from './tabs';
describe('platform monitoring tabs',()=>{
 it('activates only one monitoring query group per tab',()=>{
  for(const tab of monitoringTabs)expect(Object.values(monitoringQueryScope(tab)).filter(Boolean)).toHaveLength(1);
  expect(monitoringQueryScope('overview').metrics).toBe(true);
  expect(monitoringQueryScope('logs').events).toBe(true);
  expect(monitoringQueryScope('health').health).toBe(true);
  expect(monitoringQueryScope('workers').workers).toBe(true);
 });
 it('supports keyboard tab navigation and wrapping',()=>{
  expect(nextMonitoringTab('overview','ArrowLeft')).toBe('logs');
  expect(nextMonitoringTab('logs','ArrowRight')).toBe('overview');
  expect(nextMonitoringTab('health','Home')).toBe('overview');
  expect(nextMonitoringTab('health','End')).toBe('logs');
  expect(nextMonitoringTab('health','Enter')).toBeNull();
 });
});
