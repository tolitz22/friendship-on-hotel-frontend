import {describe,it,expect} from 'vitest';
import {appendHealthObservation,formatDatabaseSize,type HealthObservation} from './health';
describe('infrastructure observations',()=>{
 it('keeps only twenty distinct observations in newest-first order',()=>{
  const item:HealthObservation={at:0,state:'healthy',database:'healthy',cache:'healthy',grafana:'healthy'};
  let history:HealthObservation[]=[];
  for(let i=0;i<25;i++)history=appendHealthObservation(history,{...item,at:i});
  history=appendHealthObservation(history,{...item,at:24,state:'degraded'});
  expect(history).toHaveLength(20);expect(history[0].state).toBe('degraded');expect(history[19].at).toBe(5);
 });
 it('does not present unavailable storage as zero',()=>{
  expect(formatDatabaseSize(null)).toBe('Unavailable');expect(formatDatabaseSize(0)).toBe('0 B');
  expect(formatDatabaseSize(1024**3)).toBe('1 GiB');
 });
});
