import {describe,expect,it} from 'vitest';
import {projectRackBars} from './roomRackLayout';
const period={start:'2026-11-15',end:'2026-11-22'};
const b=(id:string,checkIn:string,checkOut:string)=>({id,roomId:'1',checkIn,checkOut});
describe('Phase 47 continuous room rack bars',()=>{
 it('spans the occupied nights and excludes checkout day',()=>{
  const [bar]=projectRackBars([b('1','2026-11-16','2026-11-19')],period);
  expect(bar).toMatchObject({startColumn:3,span:3,lane:0,clippedStart:false,clippedEnd:false,overlap:false});
 });
 it('clips stays crossing either edge of the visible period',()=>{
  const bars=projectRackBars([b('left','2026-11-12','2026-11-16'),b('right','2026-11-21','2026-11-28')],period);
  expect(bars[0]).toMatchObject({startColumn:2,span:1,clippedStart:true,clippedEnd:false});
  expect(bars[1]).toMatchObject({startColumn:8,span:1,clippedStart:false,clippedEnd:true});
 });
 it('puts overlapping reservations and maintenance into separate lanes',()=>{
  const bars=projectRackBars([
   b('first','2026-11-16','2026-11-19'),
   b('block','2026-11-18','2026-11-20'),
   b('after','2026-11-20','2026-11-22'),
  ],period);
  expect(bars.map(x=>x.lane)).toEqual([0,1,0]);
  expect(bars.map(x=>x.overlap)).toEqual([true,true,false]);
 });
 it('does not render records ending on the start or beginning on the end',()=>{
  expect(projectRackBars([
   b('past','2026-11-13','2026-11-15'),b('future','2026-11-22','2026-11-25'),
  ],period)).toHaveLength(0);
 });
});
