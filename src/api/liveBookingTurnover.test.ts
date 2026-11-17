import {describe,expect,it} from 'vitest';
import {parseTurnover} from './liveBookingTurnover';

const response={data:{
 hotelId:'4',bookingId:'31',
 task:{id:'82',roomId:'12',type:'checkout_clean',status:'todo',revision:1},
 determinesRoomReadiness:false,
}};

describe('Phase 40 linked checkout turnover',()=>{
 it('accepts the exact recorded checkout-cleaning task',()=>{
  expect(parseTurnover(response,'4','31').task?.id).toBe('82');
 });
 it('permits a missing task without inventing readiness or completion',()=>{
  expect(parseTurnover({data:{...response.data,task:null}},'4','31').task).toBeNull();
 });
 it('rejects another hotel or reservation identity',()=>{
  expect(()=>parseTurnover(response,'5','31')).toThrow(/another hotel/);
  expect(()=>parseTurnover(response,'4','30')).toThrow(/another hotel/);
 });
 it('rejects false readiness guarantees and non-turnover task types',()=>{
  expect(()=>parseTurnover({data:{...response.data,determinesRoomReadiness:true}},'4','31')).toThrow();
  expect(()=>parseTurnover({data:{...response.data,task:{...response.data.task,type:'stayover'}}},'4','31')).toThrow();
 });
 it('rejects malformed task identity and revision',()=>{
  expect(()=>parseTurnover({data:{...response.data,task:{...response.data.task,id:'abc'}}},'4','31')).toThrow();
  expect(()=>parseTurnover({data:{...response.data,task:{...response.data.task,revision:0}}},'4','31')).toThrow();
 });
});
