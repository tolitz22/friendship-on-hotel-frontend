import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {clearSession,setSessionHotel,setSessionToken} from './session';
import {createHousekeepingTask,getHousekeepingHistory,listHousekeepingTasks,updateHousekeepingTask,parseLiveHousekeeping,parseUpdatedHousekeeping,parseHousekeepingHistory,nextLiveHousekeepingStatus,canProgressHousekeeping} from './liveHousekeeping';
import type {LiveHousekeepingTask} from './liveHousekeeping';

beforeEach(()=>{vi.stubEnv('VITE_AUTH_MODE','bearer');});
afterEach(()=>{clearSession();vi.unstubAllGlobals();vi.unstubAllEnvs();});

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
  const fetchMock=vi.fn().mockResolvedValue({ok:true,json:async()=>({data:[],meta:{page:1,perPage:20,total:0,totalPages:1}})});
  vi.stubGlobal('fetch',fetchMock);
  await getHousekeepingHistory('7');
  expect(new URL(fetchMock.mock.calls[0][0] as string).pathname)
   .toBe('/api/v1/hotels/4/housekeeping-tasks/7/history');
  setSessionHotel(null);
  expect(()=>getHousekeepingHistory('7')).toThrow('Choose a hotel');
 });
});


const phase33Task:LiveHousekeepingTask={
 id:'21',hotelId:'4',roomId:'9',roomNumber:'205',
 type:'checkout_clean',status:'todo',assignedTo:null,assignedUserId:'13',
 dueAt:null,completedAt:null,revision:1,createdAt:'2026-11-17 10:00:00',
};
const phase33List={
 data:[phase33Task],
 meta:{page:1,perPage:20,total:1,totalPages:1,determinesRoomReadiness:false},
};
describe('Phase 33 validated housekeeping contract',()=>{
 it('accepts scoped task list without claiming room readiness',()=>{
  expect(parseLiveHousekeeping(phase33List,'4').data[0].type).toBe('checkout_clean');
  expect(parseLiveHousekeeping(phase33List,'4').meta.determinesRoomReadiness).toBe(false);
 });
 it('rejects another property and misleading readiness flags',()=>{
  expect(()=>parseLiveHousekeeping(phase33List,'5')).toThrow(/another hotel/);
  expect(()=>parseLiveHousekeeping({
   ...phase33List,meta:{...phase33List.meta,determinesRoomReadiness:true},
  },'4')).toThrow();
 });
 it('rejects unsupported status and invalid revisions',()=>{
  expect(()=>parseLiveHousekeeping({
   ...phase33List,data:[{...phase33Task,status:'guest_ready'}],
  },'4')).toThrow();
  expect(()=>parseLiveHousekeeping({
   ...phase33List,data:[{...phase33Task,revision:0}],
  },'4')).toThrow();
 });
 it('validates exact response identity after a revisioned update',()=>{
  expect(parseUpdatedHousekeeping({data:{...phase33Task,revision:2}},'4','21').revision).toBe(2);
  expect(()=>parseUpdatedHousekeeping({data:phase33Task},'5','21'))
   .toThrow(/different hotel or task/);
  expect(()=>parseUpdatedHousekeeping({data:phase33Task},'4','22'))
   .toThrow(/different hotel or task/);
 });
 it('enforces next status and member-assignment boundaries',()=>{
  expect(nextLiveHousekeepingStatus('todo')).toBe('in_progress');
  expect(nextLiveHousekeepingStatus('in_progress')).toBe('done');
  expect(nextLiveHousekeepingStatus('done')).toBeNull();
  expect(canProgressHousekeeping(phase33Task,false,'13')).toBe(true);
  expect(canProgressHousekeeping(phase33Task,false,'14')).toBe(false);
  expect(canProgressHousekeeping(phase33Task,true,'14')).toBe(true);
  expect(canProgressHousekeeping({...phase33Task,status:'done'},true,'13')).toBe(false);
 });
 it('validates actor-attributed event history and pagination',()=>{
  const event={
   id:'33',actorId:'13',action:'updated',
   before:{status:'todo'},after:{status:'in_progress'},
   note:'Started cleaning',createdAt:'2026-11-17 11:00:00',
  };
  expect(parseHousekeepingHistory({
   data:[event],meta:{page:1,perPage:20,total:1,totalPages:1},
  }).data[0].actorId).toBe('13');
  expect(()=>parseHousekeepingHistory({
   data:[event],meta:{page:0,perPage:20,total:1,totalPages:1},
  })).toThrow();
 });
 it('sends backend status and type filters as scoped query parameters',async()=>{
  setSessionToken('staff-token');setSessionHotel('4');
  const fetchMock=vi.fn().mockResolvedValue({ok:true,json:async()=>phase33List});
  vi.stubGlobal('fetch',fetchMock);
  await listHousekeepingTasks(3,20,{status:'todo',type:'checkout_clean'});
  const url=new URL(fetchMock.mock.calls[0][0] as string);
  expect(url.searchParams.get('status')).toBe('todo');
  expect(url.searchParams.get('type')).toBe('checkout_clean');
  expect(url.searchParams.get('page')).toBe('3');
 });
});
