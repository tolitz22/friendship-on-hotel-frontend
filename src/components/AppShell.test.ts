import {describe,expect,it} from 'vitest';
import {experienceForPath} from './AppShell';

describe('Phase 38 navigation status accuracy',()=>{
 it('does not label working live operational pages mock preview',()=>{
  for(const path of ['/','/reservations','/front-desk','/rooms',
   '/housekeeping','/maintenance','/guests']){
   expect(experienceForPath(path,'api')).toBe('LIVE HOTEL DATA');
  }
 });
 it('identifies partially live and non-persistent tools separately',()=>{
  expect(experienceForPath('/billing','api')).toMatch(/PARTIAL/);
  expect(experienceForPath('/reservation-simulation','api')).toMatch(/SIMULATION/);
  expect(experienceForPath('/reservation-policy','api')).toMatch(/DRAFT/);
  expect(experienceForPath('/reports','api')).toMatch(/PREVIEW/);
 });
 it('makes mock mode explicit across every screen',()=>{
  expect(experienceForPath('/reservations','mock')).toMatch(/PREVIEW/);
  expect(experienceForPath('/rooms','mock')).toMatch(/PREVIEW/);
 });
});
