import {describe,it,expect} from 'vitest';
import {capacityBlocked,type SubscriptionCapacity} from './subscriptionCapacity';
const full:SubscriptionCapacity={assigned:true,enforced:true,rooms:{used:10,limit:10,remaining:0,state:'full'},staff:{used:2,limit:5,remaining:3,state:'available'}};
describe('capacity controls',()=>{
 it('only blocks growth for enforced full or over-limit resources',()=>{
  expect(capacityBlocked(full,'rooms')).toBe(true);
  expect(capacityBlocked(full,'staff')).toBe(false);
  expect(capacityBlocked({...full,enforced:false},'rooms')).toBe(false);
  expect(capacityBlocked(undefined,'rooms')).toBe(false);
 });
});
