import {afterEach,describe,expect,it,vi} from 'vitest';
import {clearSession,setSessionHotel,setSessionToken} from './session';
import {getReservationPolicyDraft,getReservationPolicyHistory,updateReservationPolicyDraft} from './reservationPolicy';

afterEach(()=>{clearSession();vi.unstubAllGlobals();});

describe('Phase 10 hotel-scoped policy drafts',()=>{
 it('reads the selected hotel draft with authentication',async()=>{
  setSessionToken('staff-token');setSessionHotel('12');
  const fetchMock=vi.fn().mockResolvedValue({ok:true,json:async()=>({data:{revision:0}})});
  vi.stubGlobal('fetch',fetchMock);
  await getReservationPolicyDraft();
  const [address,init]=fetchMock.mock.calls[0] as [string,RequestInit];
  expect(new URL(address).pathname).toBe('/api/v1/hotels/12/reservation-policy-draft');
  expect((init.headers as Record<string,string>).Authorization).toBe('Bearer staff-token');
 });
 it('saves a partial revision with optimistic concurrency',async()=>{
  setSessionToken('admin-token');setSessionHotel('7');
  const fetchMock=vi.fn().mockResolvedValue({ok:true,json:async()=>({data:{revision:2}})});
  vi.stubGlobal('fetch',fetchMock);
  await updateReservationPolicyDraft(1,{sellableUnit:'hybrid',overbooking:'prohibited'});
  const [address,init]=fetchMock.mock.calls[0] as [string,RequestInit];
  expect(new URL(address).pathname).toBe('/api/v1/hotels/7/reservation-policy-draft');
  expect(init.method).toBe('PATCH');
  expect(JSON.parse(init.body as string)).toEqual({
   expectedRevision:1,
   decisions:{sellableUnit:'hybrid',overbooking:'prohibited'},
  });
 });
 it('surfaces concurrent write conflicts rather than overwriting saved decisions',async()=>{
  setSessionToken('admin-token');setSessionHotel('7');
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue({
   ok:false,status:409,json:async()=>({message:'The policy draft has changed.'}),
  }));
  await expect(updateReservationPolicyDraft(0,{holdPolicy:'timed_pending_holds'}))
   .rejects.toMatchObject({status:409,message:'The policy draft has changed.'});
 });
 it('fetches hotel-scoped revision history and cannot run without hotel selection',async()=>{
  setSessionToken('admin-token');setSessionHotel('3');
  const fetchMock=vi.fn().mockResolvedValue({ok:true,json:async()=>({data:[],meta:{}})});
  vi.stubGlobal('fetch',fetchMock);
  await getReservationPolicyHistory();
  expect(new URL(fetchMock.mock.calls[0][0] as string).pathname)
   .toBe('/api/v1/hotels/3/reservation-policy-draft/history');
  setSessionHotel(null);
  await expect(getReservationPolicyHistory()).rejects.toThrow('Choose a hotel');
 });
});
