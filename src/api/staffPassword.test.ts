import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {clearSession,setSessionToken} from './session';
import {changeStaffPassword,requestPasswordReset,resetStaffPassword} from './auth';

beforeEach(()=>{vi.stubEnv('VITE_AUTH_MODE','bearer');});
afterEach(()=>{clearSession();vi.unstubAllGlobals();vi.unstubAllEnvs();});

describe('Phase 16 staff password API',()=>{
 it('requests password reset without requiring a bearer token',async()=>{
  const fetchMock=vi.fn().mockResolvedValue({ok:true,json:async()=>({
   message:'If an active staff account exists, instructions will be sent.',
  })});
  vi.stubGlobal('fetch',fetchMock);
  await requestPasswordReset('staff@example.test');
  const [url,init]=fetchMock.mock.calls[0] as [string,RequestInit];
  expect(new URL(url).pathname).toBe('/api/v1/auth/forgot-password');
  expect(init.method).toBe('POST');
  expect((init.headers as Record<string,string>).Authorization).toBeUndefined();
  expect(JSON.parse(init.body as string)).toEqual({email:'staff@example.test'});
 });
 it('redeems reset token with a confirmed new password but no access token',async()=>{
  const fetchMock=vi.fn().mockResolvedValue({ok:true,json:async()=>({message:'Password reset.'})});
  vi.stubGlobal('fetch',fetchMock);
  await resetStaffPassword('staff@example.test','reset-token','BrandNewPass123!','BrandNewPass123!');
  const [url,init]=fetchMock.mock.calls[0] as [string,RequestInit];
  expect(new URL(url).pathname).toBe('/api/v1/auth/reset-password');
  expect(JSON.parse(init.body as string)).toEqual({
   email:'staff@example.test',token:'reset-token',password:'BrandNewPass123!',
   password_confirmation:'BrandNewPass123!',
  });
  expect((init.headers as Record<string,string>).Authorization).toBeUndefined();
 });
 it('requires authentication to change a signed-in password',async()=>{
  const fetchMock=vi.fn();
  vi.stubGlobal('fetch',fetchMock);
  await expect(changeStaffPassword('CurrentPass123!','BrandNewPass123!','BrandNewPass123!'))
   .rejects.toMatchObject({status:401});
  expect(fetchMock).not.toHaveBeenCalled();
 });
 it('posts current password with bearer token and confirmed replacement',async()=>{
  setSessionToken('live-token');
  const fetchMock=vi.fn().mockResolvedValue({ok:true,json:async()=>({
   message:'Password changed.',
  })});
  vi.stubGlobal('fetch',fetchMock);
  await changeStaffPassword('CurrentPass123!','BrandNewPass123!','BrandNewPass123!');
  const [url,init]=fetchMock.mock.calls[0] as [string,RequestInit];
  expect(new URL(url).pathname).toBe('/api/v1/auth/change-password');
  expect(init.method).toBe('POST');
  expect((init.headers as Record<string,string>).Authorization).toBe('Bearer live-token');
  expect(JSON.parse(init.body as string)).toEqual({
   currentPassword:'CurrentPass123!',password:'BrandNewPass123!',
   password_confirmation:'BrandNewPass123!',
  });
 });
 it('propagates validation errors on expired links without replacing API results',async()=>{
  const fetchMock=vi.fn().mockResolvedValue({
   ok:false,status:422,json:async()=>({
    message:'Invalid token',errors:{token:['The reset link is invalid or expired.']},
   }),
  });
  vi.stubGlobal('fetch',fetchMock);
  await expect(resetStaffPassword('staff@example.test','expired','BrandNewPass123!','BrandNewPass123!'))
   .rejects.toMatchObject({
    status:422,fieldErrors:{token:['The reset link is invalid or expired.']},
   });
 });
});
