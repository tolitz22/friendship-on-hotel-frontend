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
 it('handles unknown parsing and unexpected errors without implying a success',()=>{
  const result=messageForQueryError(new Error('Invalid server response'));
  expect(result.title).toMatch(/unable to load/i);
  expect(result.action).toMatch(/retry/i);
 });
});
