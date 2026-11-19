import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {clearSession,setSessionHotel,setSessionToken} from './session';
import {getReservationSimulation} from './reservationSimulation';

beforeEach(()=>{vi.stubEnv('VITE_AUTH_MODE','bearer');});
afterEach(()=>{clearSession();vi.unstubAllGlobals();vi.unstubAllEnvs();});

describe('Phase 12 structural reservation simulation',()=>{
 it('calls the selected property read-only endpoint with bearer authentication',async()=>{
  setSessionToken('staff-token');setSessionHotel('23');
  const fetchMock=vi.fn().mockResolvedValue({
   ok:true,json:async()=>({data:{hasAssignedRoomOverlap:false},meta:{isAvailability:false,isBookable:false}}),
  });
  vi.stubGlobal('fetch',fetchMock);
  const result=await getReservationSimulation('9','2026-11-20','2026-11-24');
  const [url,init]=fetchMock.mock.calls[0] as [string,RequestInit];
  const parsed=new URL(url);
  expect(parsed.pathname).toBe('/api/v1/hotels/23/reservation-simulation');
  expect(parsed.searchParams.get('roomId')).toBe('9');
  expect(parsed.searchParams.get('from')).toBe('2026-11-20');
  expect(parsed.searchParams.get('to')).toBe('2026-11-24');
  expect(init.method).toBe('GET');
  expect((init.headers as Record<string,string>).Authorization).toBe('Bearer staff-token');
  expect(result.meta.isBookable).toBe(false);
 });
 it('refuses to run without a selected property',async()=>{
  setSessionToken('staff-token');
  const fetchMock=vi.fn();vi.stubGlobal('fetch',fetchMock);
  expect(()=>getReservationSimulation('9','2026-11-20','2026-11-24')).toThrow('Choose a hotel');
  expect(fetchMock).not.toHaveBeenCalled();
 });
 it('surfaces validation errors and does not return sample data after an API failure',async()=>{
  setSessionToken('staff-token');setSessionHotel('23');
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue({
   ok:false,status:422,json:async()=>({message:'Date window exceeds limit',errors:{to:['31 nights maximum']}}),
  }));
  await expect(getReservationSimulation('9','2026-11-20','2027-01-30')).rejects.toMatchObject({
   status:422,fieldErrors:{to:['31 nights maximum']},
  });
 });
});
