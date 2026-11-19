import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {clearSession,setSessionHotel,setSessionToken} from './session';
import {createLiveRoom,createLiveRoomType,getCatalogAudit,getLiveCatalogSummary,getLiveProperty,getLiveRooms,updateLiveRoom,updateLiveRoomType} from './liveCatalog';

beforeEach(()=>{vi.stubEnv('VITE_AUTH_MODE','bearer');});
afterEach(()=>{clearSession();vi.unstubAllGlobals();vi.unstubAllEnvs();});

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

describe('Phase 7 catalogue write requests',()=>{
 it('posts a room type within the selected hotel using the bearer token',async()=>{
  setSessionToken('admin-token');setSessionHotel('7');
  const fetchMock=vi.fn().mockResolvedValue({ok:true,json:async()=>({data:{id:'3',name:'Deluxe'}})});
  vi.stubGlobal('fetch',fetchMock);
  await createLiveRoomType({name:'Deluxe',maxOccupancy:3});
  const [url,init]=fetchMock.mock.calls[0] as [string,RequestInit];
  expect(new URL(url).pathname).toBe('/api/v1/hotels/7/room-types');
  expect(init.method).toBe('POST');
  expect(JSON.parse(init.body as string)).toEqual({name:'Deluxe',maxOccupancy:3});
  expect((init.headers as Record<string,string>).Authorization).toBe('Bearer admin-token');
 });
 it('posts a physical room and nullable floor to the current hotel',async()=>{
  setSessionToken('admin-token');setSessionHotel('12');
  const fetchMock=vi.fn().mockResolvedValue({ok:true,json:async()=>({data:{id:'9',number:'201'}})});
  vi.stubGlobal('fetch',fetchMock);
  await createLiveRoom({roomTypeId:'4',number:'201',floor:null});
  const [url,init]=fetchMock.mock.calls[0] as [string,RequestInit];
  expect(new URL(url).pathname).toBe('/api/v1/hotels/12/rooms');
  expect(JSON.parse(init.body as string)).toEqual({roomTypeId:'4',number:'201',floor:null});
 });
 it('surfaces duplicate room validation instead of fabricating success',async()=>{
  setSessionToken('admin-token');setSessionHotel('3');
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue({
   ok:false,status:422,json:async()=>({message:'Invalid room',errors:{number:['The number has already been taken.']}})
  }));
  await expect(createLiveRoom({roomTypeId:'2',number:'101',floor:1})).rejects.toMatchObject({
   status:422,fieldErrors:{number:['The number has already been taken.']}
  });
 });
 it('rejects catalogue writes before a hotel is selected',async()=>{
  setSessionToken('admin-token');
  const fetchMock=vi.fn();
  vi.stubGlobal('fetch',fetchMock);
  expect(()=>createLiveRoomType({name:'Suite',maxOccupancy:2})).toThrow('Choose a hotel');
  expect(fetchMock).not.toHaveBeenCalled();
 });
});

describe('Phase 8 audited catalogue edit transport',()=>{
 it('patches a room number and nullable floor within the selected hotel',async()=>{
  setSessionToken('admin');setSessionHotel('14');
  const fetchMock=vi.fn().mockResolvedValue({ok:true,json:async()=>({data:{id:'7',number:'208'}})});
  vi.stubGlobal('fetch',fetchMock);
  await updateLiveRoom('7',{number:'208',floor:null});
  const [url,init]=fetchMock.mock.calls[0] as [string,RequestInit];
  expect(new URL(url).pathname).toBe('/api/v1/hotels/14/rooms/7');
  expect(init.method).toBe('PATCH');
  expect(JSON.parse(init.body as string)).toEqual({number:'208',floor:null});
  expect((init.headers as Record<string,string>).Authorization).toBe('Bearer admin');
 });
 it('edits a room type through the scoped endpoint',async()=>{
  setSessionToken('admin');setSessionHotel('6');
  const fetchMock=vi.fn().mockResolvedValue({ok:true,json:async()=>({data:{id:'9'}})});
  vi.stubGlobal('fetch',fetchMock);
  await updateLiveRoomType('9',{name:'Deluxe Plus',maxOccupancy:3});
  const [url,init]=fetchMock.mock.calls[0] as [string,RequestInit];
  expect(new URL(url).pathname).toBe('/api/v1/hotels/6/room-types/9');
  expect(JSON.parse(init.body as string)).toEqual({name:'Deluxe Plus',maxOccupancy:3});
 });
 it('fetches the current hotel audit records for one subject',async()=>{
  setSessionToken('admin');setSessionHotel('4');
  const fetchMock=vi.fn().mockResolvedValue({ok:true,json:async()=>({data:[],meta:{}})});
  vi.stubGlobal('fetch',fetchMock);
  await getCatalogAudit('room_type','3');
  const url=new URL(fetchMock.mock.calls[0][0] as string);
  expect(url.pathname).toBe('/api/v1/hotels/4/catalog-audit');
  expect(url.searchParams.get('subjectType')).toBe('room_type');
  expect(url.searchParams.get('subjectId')).toBe('3');
 });
 it('propagates reservation-linked edit conflicts instead of concealing them',async()=>{
  setSessionToken('admin');setSessionHotel('4');
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue({
   ok:false,status:422,json:async()=>({
    message:'Capacity cannot be changed',
    errors:{maxOccupancy:['Room type has existing reservation records.']},
   }),
  }));
  await expect(updateLiveRoomType('3',{maxOccupancy:5})).rejects.toMatchObject({
   status:422,fieldErrors:{maxOccupancy:['Room type has existing reservation records.']},
  });
 });
});
