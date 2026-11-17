import {afterEach,describe,expect,it,vi} from 'vitest';
import {clearSession,setSessionHotel,setSessionToken} from './session';
import {inviteNewStaff,listStaffInvitations,revokeStaffInvitation} from './liveStaff';
import {acceptStaffInvitation} from './auth';

afterEach(()=>{clearSession();vi.unstubAllGlobals();vi.unstubAllEnvs();});

describe('Phase 18 hotel staff invitations',()=>{
 it('sends an invite within the selected hotel with administrator credentials',async()=>{
  setSessionToken('admin-token');setSessionHotel('14');
  const fetchMock=vi.fn().mockResolvedValue({ok:true,json:async()=>({
   message:'Invitation email sent.',data:{id:'5',email:'new@example.test',expiresInHours:48},
  })});
  vi.stubGlobal('fetch',fetchMock);
  const response=await inviteNewStaff('new@example.test','New Cleaner','housekeeping');
  const [url,init]=fetchMock.mock.calls[0] as [string,RequestInit];
  expect(new URL(url).pathname).toBe('/api/v1/hotels/14/staff/invitations');
  expect(init.method).toBe('POST');
  expect((init.headers as Record<string,string>).Authorization).toBe('Bearer admin-token');
  expect(JSON.parse(init.body as string)).toEqual({
   email:'new@example.test',name:'New Cleaner',role:'housekeeping',
  });
  expect(response.data.expiresInHours).toBe(48);
 });
 it('lists and revokes scoped invitations without exposing a token',async()=>{
  setSessionToken('admin-token');setSessionHotel('14');
  const fetchMock=vi.fn().mockResolvedValue({ok:true,json:async()=>({data:[]})});
  vi.stubGlobal('fetch',fetchMock);
  await listStaffInvitations();
  expect(new URL(fetchMock.mock.calls[0][0] as string).pathname)
   .toBe('/api/v1/hotels/14/staff/invitations');
  await revokeStaffInvitation('19');
  const [url,init]=fetchMock.mock.calls[1] as [string,RequestInit];
  expect(new URL(url).pathname).toBe('/api/v1/hotels/14/staff/invitations/19/revoke');
  expect(init.method).toBe('PATCH');
 });
 it('accepts an invitation publicly without requiring a bearer token',async()=>{
  const fetchMock=vi.fn().mockResolvedValue({ok:true,json:async()=>({
   message:'Account created. Sign in with your new password.',
   data:{hotelId:'14'},
  })});
  vi.stubGlobal('fetch',fetchMock);
  const response=await acceptStaffInvitation('token-from-mail','SecureWorkerPass123!','SecureWorkerPass123!');
  const [url,init]=fetchMock.mock.calls[0] as [string,RequestInit];
  expect(new URL(url).pathname).toBe('/api/v1/auth/accept-invitation');
  expect(init.method).toBe('POST');
  expect((init.headers as Record<string,string>).Authorization).toBeUndefined();
  expect(JSON.parse(init.body as string).token).toBe('token-from-mail');
  expect(response.data.hotelId).toBe('14');
 });
 it('propagates expired and revoked token errors without mock fallbacks',async()=>{
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue({
   ok:false,status:422,json:async()=>({
    message:'Invalid invitation',errors:{token:['Invalid, expired, or already-used invitation.']},
   }),
  }));
  await expect(acceptStaffInvitation('revoked','SecureWorkerPass123!','SecureWorkerPass123!'))
   .rejects.toMatchObject({status:422,fieldErrors:{token:['Invalid, expired, or already-used invitation.']}});
 });
 it('does not allow invitations without selected hotel context',async()=>{
  setSessionToken('admin-token');
  const fetchMock=vi.fn();vi.stubGlobal('fetch',fetchMock);
  expect(()=>inviteNewStaff('new@example.test','Cleaner','housekeeping')).toThrow('Choose a hotel');
  expect(fetchMock).not.toHaveBeenCalled();
 });
});
