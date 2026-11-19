import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {clearSession,setSessionHotel,setSessionToken} from './session';
import {attachHotelStaff,getHotelStaffHistory,listHotelStaff,updateHotelStaff} from './liveStaff';
import {updateHousekeepingTask} from './liveHousekeeping';
import {updateMaintenance} from './liveMaintenance';

beforeEach(()=>{vi.stubEnv('VITE_AUTH_MODE','bearer');});
afterEach(()=>{clearSession();vi.unstubAllGlobals();vi.unstubAllEnvs();});

describe('Phase 15 hotel staff and scoped task updates',()=>{
 it('lists property staff with bearer credentials',async()=>{
  setSessionToken('admin-token');setSessionHotel('17');
  const fetchMock=vi.fn().mockResolvedValue({ok:true,json:async()=>({data:[]})});
  vi.stubGlobal('fetch',fetchMock);
  await listHotelStaff();
  const [url,opts]=fetchMock.mock.calls[0] as [string,RequestInit];
  expect(new URL(url).pathname).toBe('/api/v1/hotels/17/staff');
  expect((opts.headers as Record<string,string>).Authorization).toBe('Bearer admin-token');
 });
 it('attaches only an existing account within the selected hotel',async()=>{
  setSessionToken('admin-token');setSessionHotel('17');
  const fetchMock=vi.fn().mockResolvedValue({ok:true,json:async()=>({data:[]})});
  vi.stubGlobal('fetch',fetchMock);
  await attachHotelStaff('cleaner@example.test','housekeeping');
  const [url,opts]=fetchMock.mock.calls[0] as [string,RequestInit];
  expect(new URL(url).pathname).toBe('/api/v1/hotels/17/staff');
  expect(opts.method).toBe('POST');
  expect(JSON.parse(opts.body as string)).toEqual({email:'cleaner@example.test',role:'housekeeping'});
 });
 it('patches membership activation without a cross-hotel request',async()=>{
  setSessionToken('admin-token');setSessionHotel('17');
  const fetchMock=vi.fn().mockResolvedValue({ok:true,json:async()=>({data:[]})});
  vi.stubGlobal('fetch',fetchMock);
  await updateHotelStaff('9',{isActive:false});
  const [url,opts]=fetchMock.mock.calls[0] as [string,RequestInit];
  expect(new URL(url).pathname).toBe('/api/v1/hotels/17/staff/9');
  expect(JSON.parse(opts.body as string)).toEqual({isActive:false});
 });
 it('sends limited assigned-worker housekeeping updates',async()=>{
  setSessionToken('worker-token');setSessionHotel('17');
  const fetchMock=vi.fn().mockResolvedValue({ok:true,json:async()=>({data:{revision:2}})});
  vi.stubGlobal('fetch',fetchMock);
  await updateHousekeepingTask('3',{expectedRevision:1,status:'in_progress',note:'Started'});
  const [url,opts]=fetchMock.mock.calls[0] as [string,RequestInit];
  expect(new URL(url).pathname).toBe('/api/v1/hotels/17/housekeeping-tasks/3');
  expect(JSON.parse(opts.body as string)).toEqual({expectedRevision:1,status:'in_progress',note:'Started'});
 });
 it('sends limited assigned-worker maintenance updates',async()=>{
  setSessionToken('worker-token');setSessionHotel('17');
  const fetchMock=vi.fn().mockResolvedValue({ok:true,json:async()=>({data:{revision:2}})});
  vi.stubGlobal('fetch',fetchMock);
  await updateMaintenance('2',{expectedRevision:1,status:'in_progress',note:'On site'});
  const [url,opts]=fetchMock.mock.calls[0] as [string,RequestInit];
  expect(new URL(url).pathname).toBe('/api/v1/hotels/17/maintenance-work-orders/2');
  expect(JSON.parse(opts.body as string)).toEqual({expectedRevision:1,status:'in_progress',note:'On site'});
 });
 it('loads scoped membership audit history',async()=>{
  setSessionToken('admin-token');setSessionHotel('17');
  const fetchMock=vi.fn().mockResolvedValue({ok:true,json:async()=>({data:[],meta:{page:1,total:0}})});
  vi.stubGlobal('fetch',fetchMock);
  await getHotelStaffHistory();
  expect(new URL(fetchMock.mock.calls[0][0] as string).pathname)
   .toBe('/api/v1/hotels/17/staff/history');
 });
 it('propagates staff access denials instead of showing demo data',async()=>{
  setSessionToken('staff-token');setSessionHotel('17');
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue({
   ok:false,status:403,json:async()=>({message:'Administrator access required'}),
  }));
  await expect(listHotelStaff()).rejects.toMatchObject({
   status:403,message:'Administrator access required',
  });
 });
});
