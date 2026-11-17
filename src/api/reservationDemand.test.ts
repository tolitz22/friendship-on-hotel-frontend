import {afterEach,describe,expect,it,vi} from 'vitest';
import {clearSession,setSessionHotel,setSessionToken} from './session';
import {getReservationDemand} from './reservationDemand';

afterEach(()=>{clearSession();vi.unstubAllGlobals();});

describe('Phase 9 structural demand transport',()=>{
 it('sends property-scoped date-only reporting queries and bearer credentials',async()=>{
  setSessionToken('development-token');setSessionHotel('12');
  const fetchMock=vi.fn().mockResolvedValue({
   ok:true,json:async()=>({
    data:{days:[],matchingRecordCount:0},
    meta:{hotelId:'12',isAvailability:false,isOccupancy:false,complete:true,warnings:[]},
   }),
  });
  vi.stubGlobal('fetch',fetchMock);
  const result=await getReservationDemand('2026-11-17','2026-11-20');
  const [address,options]=fetchMock.mock.calls[0] as [string,RequestInit];
  const url=new URL(address);
  expect(url.pathname).toBe('/api/v1/hotels/12/reservation-demand');
  expect(url.searchParams.get('from')).toBe('2026-11-17');
  expect(url.searchParams.get('to')).toBe('2026-11-20');
  expect((options.headers as Record<string,string>).Authorization).toBe('Bearer development-token');
  expect(result.meta.isAvailability).toBe(false);
 });
 it('requires an authenticated hotel selection',async()=>{
  setSessionToken('development-token');
  const fetchMock=vi.fn();vi.stubGlobal('fetch',fetchMock);
  expect(()=>getReservationDemand('2026-11-17','2026-11-20')).toThrow('Choose a hotel');
  expect(fetchMock).not.toHaveBeenCalled();
 });
 it('propagates rejected reporting dates rather than switching to sample data',async()=>{
  setSessionToken('development-token');setSessionHotel('5');
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue({
   ok:false,status:422,json:async()=>({message:'Invalid dates',errors:{to:['Date window exceeds 31 nights']}}),
  }));
  await expect(getReservationDemand('2026-11-17','2027-01-17')).rejects.toMatchObject({
   status:422,fieldErrors:{to:['Date window exceeds 31 nights']},
  });
 });
});
