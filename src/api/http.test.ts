import {afterEach,describe,expect,it,vi} from 'vitest';
import {clearSession,setSessionToken} from './session';
import {ApiError,getJson,requestJson} from './http';

afterEach(()=>{clearSession();vi.unstubAllGlobals();});

describe('authenticated JSON transport',()=>{
 it('does not send property requests without a token',async()=>{
  const fetchSpy=vi.fn();
  vi.stubGlobal('fetch',fetchSpy);
  await expect(getJson('/hotels/1/guests')).rejects.toMatchObject({status:401,code:'AUTH_REQUIRED'});
  expect(fetchSpy).not.toHaveBeenCalled();
 });
 it('sends bearer credentials only when required',async()=>{
  setSessionToken('example-token');
  const fetchSpy=vi.fn().mockResolvedValue({
   ok:true,json:async()=>({data:[]}),
  });
  vi.stubGlobal('fetch',fetchSpy);
  await getJson('/hotels/1/guests',{page:1});
  const options=fetchSpy.mock.calls[0][1] as RequestInit;
  expect((options.headers as Record<string,string>).Authorization).toBe('Bearer example-token');
  expect(options.credentials).toBe('omit'); // Bearer mode must not send browser cookies.
 });
 it('omits authorization for login requests',async()=>{
  const fetchSpy=vi.fn().mockResolvedValue({
   ok:true,json:async()=>({data:{token:'example',tokenType:'Bearer'}}),
  });
  vi.stubGlobal('fetch',fetchSpy);
  await requestJson('/auth/login',{method:'POST',authenticated:false,body:{email:'demo@example.test',password:'example'}});
  const options=fetchSpy.mock.calls[0][1] as RequestInit;
  expect((options.headers as Record<string,string>).Authorization).toBeUndefined();
 });
 it('surfaces Laravel validation errors instead of showing fixture data',async()=>{
  setSessionToken('example-token');
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue({
   ok:false,status:422,json:async()=>({message:'Validation failed',errors:{email:['Invalid email']}}),
  }));
  try{
   await getJson('/hotels/1/guests');
   throw new Error('Expected API failure');
  }catch(error){
   expect(error).toBeInstanceOf(ApiError);
   expect(error).toMatchObject({status:422,fieldErrors:{email:['Invalid email']}});
  }
 });
});
