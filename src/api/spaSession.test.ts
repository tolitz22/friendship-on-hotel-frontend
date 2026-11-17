import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {clearSession,setSessionToken} from './session';
import {initializeSpaCsrf,onSpaSessionExpired,requestJson} from './http';
import {fetchStaffProfile,loginStaff,logoutStaff,requestPasswordReset} from './auth';

beforeEach(()=>{
 vi.stubEnv('VITE_AUTH_MODE','cookie');
 vi.stubGlobal('document',{cookie:'XSRF-TOKEN=csrf%3Dtoken'});
});
afterEach(()=>{
 clearSession();
 vi.unstubAllGlobals();
 vi.unstubAllEnvs();
 onSpaSessionExpired(null);
});

describe('Phase 17 Sanctum cookie SPA transport',()=>{
 it('initializes CSRF using credentialed GET without sending a bearer token',async()=>{
  const fetchMock=vi.fn().mockResolvedValue({ok:true,status:204});
  vi.stubGlobal('fetch',fetchMock);
  await initializeSpaCsrf();
  const [url,opts]=fetchMock.mock.calls[0] as [string,RequestInit];
  expect(new URL(url).pathname).toBe('/sanctum/csrf-cookie');
  expect(opts.method).toBe('GET');
  expect(opts.credentials).toBe('include');
  expect((opts.headers as Record<string,string>).Authorization).toBeUndefined();
 });
 it('sends existing session cookies with GET calls and no Authorization header',async()=>{
  setSessionToken('old-token-that-must-not-be-used');
  const fetchMock=vi.fn().mockResolvedValue({ok:true,json:async()=>({data:{id:'1',hotels:[]}})});
  vi.stubGlobal('fetch',fetchMock);
  await fetchStaffProfile();
  const [url,opts]=fetchMock.mock.calls[0] as [string,RequestInit];
  expect(new URL(url).pathname).toBe('/api/v1/auth/me');
  expect(opts.credentials).toBe('include');
  expect((opts.headers as Record<string,string>).Authorization).toBeUndefined();
 });
 it('includes a decoded X-XSRF-TOKEN header on JSON writes',async()=>{
  const fetchMock=vi.fn().mockResolvedValue({ok:true,json:async()=>({message:'Signed out.'})});
  vi.stubGlobal('fetch',fetchMock);
  await logoutStaff();
  const [url,opts]=fetchMock.mock.calls[0] as [string,RequestInit];
  expect(new URL(url).pathname).toBe('/api/v1/auth/spa-logout');
  expect(opts.method).toBe('POST');
  expect(opts.credentials).toBe('include');
  expect((opts.headers as Record<string,string>)['X-XSRF-TOKEN']).toBe('csrf=token');
 });
 it('bootstraps CSRF and signs in without receiving a bearer token',async()=>{
  const fetchMock=vi.fn()
   .mockResolvedValueOnce({ok:true,status:204})
   .mockResolvedValueOnce({ok:true,json:async()=>({
    data:{authenticated:true,authMode:'cookie',user:{id:'1',name:'Staff',email:'staff@example.test'}},
   })});
  vi.stubGlobal('fetch',fetchMock);
  const result=await loginStaff('staff@example.test','SecretPassword123!');
  expect(fetchMock).toHaveBeenCalledTimes(2);
  const [url,opts]=fetchMock.mock.calls[1] as [string,RequestInit];
  expect(new URL(url).pathname).toBe('/api/v1/auth/spa-login');
  expect(opts.credentials).toBe('include');
  expect((opts.headers as Record<string,string>).Authorization).toBeUndefined();
  expect('token' in result.data).toBe(false);
 });
 it('initializes CSRF before public forgot-password requests in cookie mode',async()=>{
  const fetchMock=vi.fn().mockResolvedValueOnce({ok:true,status:204})
   .mockResolvedValueOnce({ok:true,json:async()=>({message:'Sent if account exists'})});
  vi.stubGlobal('fetch',fetchMock);
  await requestPasswordReset('staff@example.test');
  expect(new URL(fetchMock.mock.calls[0][0] as string).pathname).toBe('/sanctum/csrf-cookie');
  const [url,opts]=fetchMock.mock.calls[1] as [string,RequestInit];
  expect(new URL(url).pathname).toBe('/api/v1/auth/forgot-password');
  expect(opts.credentials).toBe('include');
 });
 it('refuses mutation if the CSRF cookie cannot be read',async()=>{
  vi.stubGlobal('document',{cookie:''});
  const fetchMock=vi.fn();
  vi.stubGlobal('fetch',fetchMock);
  await expect(requestJson('/auth/spa-logout',{method:'POST'}))
   .rejects.toMatchObject({status:419,code:'CSRF_COOKIE_MISSING'});
  expect(fetchMock).not.toHaveBeenCalled();
 });
 it('notifies the app when a protected cookie request loses its session',async()=>{
  const expired=vi.fn();onSpaSessionExpired(expired);
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue({
   ok:false,status:401,json:async()=>({message:'Unauthenticated.'}),
  }));
  await expect(fetchStaffProfile()).rejects.toMatchObject({status:401});
  expect(expired).toHaveBeenCalledOnce();
 });
 it('propagates Laravel 419 responses without bypassing CSRF enforcement',async()=>{
  const fetchMock=vi.fn().mockResolvedValue({ok:false,status:419,json:async()=>({message:'Page Expired'})});
  vi.stubGlobal('fetch',fetchMock);
  await expect(requestJson('/auth/spa-logout',{method:'POST'})).rejects.toMatchObject({status:419});
 });
});
