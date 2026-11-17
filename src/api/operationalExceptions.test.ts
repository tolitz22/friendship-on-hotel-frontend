import {describe,expect,it} from 'vitest';
import {parseOperationalExceptions} from './operationalExceptions';

const fixture=()=>({
 data:{
  hotelId:'1',asOfHotelDate:'2026-11-17',windowEndExclusive:'2026-11-24',
  summary:{total:1,critical:0,attention:1,review:0},
  items:[{id:'unassigned_arrival:11:abc',type:'unassigned_arrival',severity:'attention',
   bookingId:'11',reference:'SYNTH-11',reason:'No room assignment',
   suggestion:'Review record',recordDate:'2026-11-18'}],
  activity:[],
 },
 meta:{readOnly:true,complete:true,isFraudDetermination:false,
  keycardLogsConnected:false,cctvEventsConnected:false,
  housekeepingPhysicalOccupancyConnected:false,sourceLimit:500,
  notes:'Operational review only'},
});
describe('operational exception API safety',()=>{
 it('accepts a complete, neutral hotel-scoped report',()=>{
  expect(parseOperationalExceptions(fixture(),'1').data.summary.total).toBe(1);
 });
 it('rejects a report from another property',()=>{
  expect(()=>parseOperationalExceptions(fixture(),'2')).toThrow('another hotel');
 });
 it('rejects false fraud determinations and connected log claims',()=>{
  const response=fixture();
  expect(()=>parseOperationalExceptions({...response,meta:{...response.meta,isFraudDetermination:true}},'1')).toThrow();
  expect(()=>parseOperationalExceptions({...response,meta:{...response.meta,keycardLogsConnected:true}},'1')).toThrow();
 });
 it('rejects mismatched totals rather than silently showing incomplete reporting',()=>{
  const response=fixture();
  response.data.summary.total=2;
  expect(()=>parseOperationalExceptions(response,'1')).toThrow('totals');
 });
});
