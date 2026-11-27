import {describe,expect,it} from 'vitest';
import {errorPayload,safeScreen} from './frontendErrors';

describe('frontend error metadata',()=>{
 it('uses fixed screen names and excludes paths, tokens and exception text',()=>{
  expect(safeScreen('/expenses/42')).toBe('expenses');
  expect(safeScreen('/guests/12/stays')).toBe('guests');
  expect(safeScreen('/private/guest@example.test')).toBe('other');
  const error=new TypeError('password=private');
  const result=errorPayload('react_render','/billing',{error,requestId:'private-token'});
  expect(result).toEqual({kind:'react_render',screen:'billing',error_type:'TypeError'});
  expect(JSON.stringify(result)).not.toContain('private');
 });
 it('preserves valid correlation hints and status only',()=>{
  const id='7cdb572a-df2d-45ee-811b-273e998e8f14';
  expect(errorPayload('api_server_error','/front-desk',{status:503,requestId:id})).toEqual({
   kind:'api_server_error',screen:'front-desk',status_code:503,related_request_id:id,
  });
  expect(errorPayload('api_server_error','/billing',{status:422})).not.toHaveProperty('status_code');
 });
});
