import {afterEach,describe,expect,it,vi} from 'vitest';
import {clearSession,setSessionHotel,setSessionToken} from './session';
import {getLiveCatalogSummary,getLiveProperty,getLiveRooms} from './liveCatalog';

afterEach(()=>{clearSession();vi.unstubAllGlobals();});

describe('Phase 6 hotel-scoped catalogue requests',()=>{
 it('requests the selected hotel property with a bearer token',async()=>{
  setSessionToken('example-token');setSessionHotel('42');
  const fetchMock=vi.fn().mockResolvedValue({ok:true,json:async()=>({data:{id:'42',name:'Hotel'}})});
  vi.stubGlobal('fetch',fetchMock);
  await getLiveProperty();
  expect(String(fetchMock.mock.calls[0][0])).toContain('/api/v1/hotels/42');
  expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer example-token');
 });
 it('sends room-number, floor and pagination filters to the selected property',async()=>{
  setSessionToken('token');setSessionHotel('10');
  const fetchMock=vi.fn().mockResolvedValue({ok:true,json:async()=>({data:[],meta:{page:1,perPage:24,total:0,totalPages:1}})});
  vi.stubGlobal('fetch',fetchMock);
  await getLiveRooms({page:2,perPage:24,floor:3,search:'301'});
  const url=new URL(fetchMock.mock.calls[0][0] as string);
  expect(url.pathname).toBe('/api/v1/hotels/10/rooms');
  expect(url.searchParams.get('floor')).toBe('3');
  expect(url.searchParams.get('search')).toBe('301');
  expect(url.searchParams.get('page')).toBe('2');
 });
 it('does not silently use fixtures when the live summary endpoint fails',async()=>{
  setSessionToken('token');setSessionHotel('1');
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue({
   ok:false,status:500,json:async()=>({message:'Database unavailable'}),
  }));
  await expect(getLiveCatalogSummary()).rejects.toMatchObject({status:500,message:'Database unavailable'});
 });
});
