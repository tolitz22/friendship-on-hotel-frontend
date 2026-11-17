import {afterEach,describe,expect,it,vi} from 'vitest';
import {clearSession,setSessionHotel,setSessionToken} from './session';
import {createHousekeepingTask,getHousekeepingHistory,listHousekeepingTasks,updateHousekeepingTask} from './liveHousekeeping';

afterEach(()=>{clearSession();vi.unstubAllGlobals();});

describe('Phase 14 live housekeeping API',()=>{
 it('reads tasks for the selected hotel with bearer authentication',async()=>{
  setSessionToken('staff-token');setSessionHotel('11');
  const fetchMock=vi.fn().mockResolvedValue({ok:true,json:async()=>({data:[],meta:{total:0}})});
  vi.stubGlobal('fetch',fetchMock);
  await listHousekeepingTasks(2,50);
  const [url,options]=fetchMock.mock.calls[0] as [string,RequestInit];
  const parsed=new URL(url);
  expect(parsed.pathname).toBe('/api/v1/hotels/11/housekeeping-tasks');
  expect(parsed.searchParams.get('page')).toBe('2');
  expect(parsed.searchParams.get('per_page')).toBe('50');
  expect((options.headers as Record<string,string>).Authorization).toBe('Bearer staff-token');
 });
 it('creates scoped cleaning tasks, not reservation blocks',async()=>{
  setSessionToken('admin-token');setSessionHotel('4');
  const fetchMock=vi.fn().mockResolvedValue({ok:true,json:async()=>({data:{id:'7'}})});
  vi.stubGlobal('fetch',fetchMock);
  await createHousekeepingTask({
   roomId:'3',type:'checkout_clean',assignedTo:'Staff A',dueAt:null,note:'Cleaning scheduled',
  });
  const [url,options]=fetchMock.mock.calls[0] as [string,RequestInit];
  expect(new URL(url).pathname).toBe('/api/v1/hotels/4/housekeeping-tasks');
  expect(options.method).toBe('POST');
  expect(JSON.parse(options.body as string)).toEqual({
   roomId:'3',type:'checkout_clean',assignedTo:'Staff A',dueAt:null,note:'Cleaning scheduled',
  });
  expect(fetchMock).toHaveBeenCalledTimes(1);
 });
 it('preserves 409 conflicts on stale revision writes',async()=>{
  setSessionToken('admin-token');setSessionHotel('4');
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue({
   ok:false,status:409,json:async()=>({message:'Task updated by another administrator'}),
  }));
  await expect(updateHousekeepingTask('7',{expectedRevision:1,status:'done'})).rejects.toMatchObject({
   status:409,message:'Task updated by another administrator',
  });
 });
 it('reads event history and requires a selected hotel',async()=>{
  setSessionToken('staff-token');setSessionHotel('4');
  const fetchMock=vi.fn().mockResolvedValue({ok:true,json:async()=>({data:[],meta:{}})});
  vi.stubGlobal('fetch',fetchMock);
  await getHousekeepingHistory('7');
  expect(new URL(fetchMock.mock.calls[0][0] as string).pathname)
   .toBe('/api/v1/hotels/4/housekeeping-tasks/7/history');
  setSessionHotel(null);
  await expect(getHousekeepingHistory('7')).rejects.toThrow('Choose a hotel');
 });
});
