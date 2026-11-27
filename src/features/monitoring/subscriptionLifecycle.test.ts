import {describe,it,expect} from 'vitest';
import type {HotelSubscription} from '../../api/platformSubscriptions';
import {subscriptionActions} from './subscriptionLifecycle';
const agreement:HotelSubscription={id:'1',planId:'1',planRevision:1,planName:'Synthetic',currency:'PHP',cycle:'monthly',priceMinor:499900,roomLimit:30,staffLimit:null,kind:'paid',startsOn:'2026-01-01',expiresOn:'2026-02-01',status:'active',trialUsed:true,revision:2};
describe('subscription actions',()=>{
 it('allows one initial trial or agreement and preserves active agreements',()=>{
  expect(subscriptionActions(null)).toEqual(['trial','assign']);
  expect(subscriptionActions(agreement)).toEqual(['renew']);
  expect(subscriptionActions({...agreement,kind:'trial',status:'trial'})).toEqual(['assign']);
  expect(subscriptionActions({...agreement,kind:'trial',status:'expired'})).toEqual(['assign']);
  expect(subscriptionActions({...agreement,status:'expired'})).toEqual(['renew','assign']);
 });
});
