import {describe,expect,it} from 'vitest';
import {messageArrivals,type ArrivalConversation} from './messageArrivals';
const conversation=(id:number,message:number,sender:number,unread=0):ArrivalConversation=>({id,unread,latest:{id:message,sender_id:sender}});
describe('staff message arrivals',()=>{
 it('baselines initial inbox without replaying old messages',()=>{
  expect(messageArrivals(null,[conversation(1,10,2,3)],'1').arrivals).toEqual([]);
 });
 it('alerts on a new incoming ID even when the active conversation was already marked read',()=>{
  const {next}=messageArrivals(null,[conversation(1,10,2)],'1');
  const result=messageArrivals(next,[conversation(1,11,2)],'1');
  expect(result.arrivals).toEqual([1]);
  expect(messageArrivals(result.next,[conversation(1,11,2)],'1').arrivals).toEqual([]);
 });
 it('ignores self-sent messages and stale responses',()=>{
  const {next}=messageArrivals(null,[conversation(1,10,2)],'1');
  const result=messageArrivals(next,[conversation(1,11,1)],'1');
  expect(result.arrivals).toEqual([]);
  expect(messageArrivals(result.next,[conversation(1,10,2,1)],'1').arrivals).toEqual([]);
 });
 it('alerts for newly discovered unread conversations without replaying read history',()=>{
  const {next}=messageArrivals(null,[],'1');
  expect(messageArrivals(next,[conversation(1,10,2,1),conversation(2,11,2)],'1').arrivals).toEqual([1]);
 });
 it('detects separate conversations even if aggregate unread count is unchanged',()=>{
  const {next}=messageArrivals(null,[conversation(1,10,2,1),conversation(2,20,2)],'1');
  expect(messageArrivals(next,[conversation(1,10,2),conversation(2,21,2,1)],'1').arrivals).toEqual([2]);
 });
});
