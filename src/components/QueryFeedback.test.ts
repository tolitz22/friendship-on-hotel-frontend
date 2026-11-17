import {describe,expect,it} from 'vitest';
import {ApiError} from '../api/http';
import {messageForQueryError} from './QueryFeedback';

describe('Phase 38 staff-facing failure guidance',()=>{
 it('explains expired sessions without asking users to keep retrying',()=>{
  const result=messageForQueryError(new ApiError(401,'UNAUTHORIZED','Expired'));
  expect(result.title).toMatch(/session/i);
  expect(result.action).toMatch(/sign in/i);
 });
 it('separates access denial from unavailable server',()=>{
  expect(messageForQueryError(new ApiError(403,'FORBIDDEN','No access')).action)
   .toMatch(/administrator/i);
  expect(messageForQueryError(new ApiError(0,'NETWORK_ERROR','Could not connect')).title)
   .toMatch(/connect/i);
 });
 it('provides stale-record guidance for conflicts',()=>{
  expect(messageForQueryError(new ApiError(409,'CONFLICT','Outdated')).action)
   .toMatch(/reload/i);
 });
 it('identifies stale Laravel deployments rather than suggesting repeated retries',()=>{
  const routeMissing=new ApiError(404,'HTTP_ERROR',
   'The route api/v1/hotels/1/approval-requests could not be found.');
  expect(messageForQueryError(routeMissing).title).toMatch(/deployed backend/);
  expect(messageForQueryError(routeMissing).action).toMatch(/latest Laravel main/);
  expect(messageForQueryError(new ApiError(404,'NOT_FOUND','Booking not found')).title)
   .not.toMatch(/missing this API route/);
 });
 it('handles unknown parsing and unexpected errors without implying a success',()=>{
  const result=messageForQueryError(new Error('Invalid server response'));
  expect(result.title).toMatch(/unable to load/i);
  expect(result.action).toMatch(/retry/i);
 });
});
