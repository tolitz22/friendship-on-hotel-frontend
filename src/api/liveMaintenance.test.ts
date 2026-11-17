import {afterEach,describe,expect,it,vi} from 'vitest';
import {clearSession,setSessionHotel,setSessionToken} from './session';
import {createMaintenance,listMaintenance,maintenanceHistory,updateMaintenance,parseLiveMaintenance,parseUpdatedMaintenance,parseMaintenanceHistory,nextLiveMaintenanceStatus,mayUpdateMaintenance,patchValidatedMaintenance} from './liveMaintenance';
import type {LiveWorkOrder} from './liveMaintenance';

afterEach(()=>{clearSession();vi.unstubAllGlobals();});

describe('Phase 13 live maintenance API',()=>{
 it('reads work orders only in the selected hotel with authorization',async()=>{
  setSessionToken('staff-token');setSessionHotel('14');
  const fetchMock=vi.fn().mockResolvedValue({ok:true,json:async()=>({data:[],meta:{page:1,total:0}})});
  vi.stubGlobal('fetch',fetchMock);
  await listMaintenance(2,50);
  const [address,opts]=fetchMock.mock.calls[0] as [string,RequestInit];
  const url=new URL(address);
  expect(url.pathname).toBe('/api/v1/hotels/14/maintenance-work-orders');
  expect(url.searchParams.get('page')).toBe('2');
  expect(url.searchParams.get('per_page')).toBe('50');
  expect((opts.headers as Record<string,string>).Authorization).toBe('Bearer staff-token');
 });
 it('creates real tickets without any booking or block request',async()=>{
  setSessionToken('admin-token');setSessionHotel('7');
  const fetchMock=vi.fn().mockResolvedValue({ok:true,json:async()=>({data:{id:'5'}})});
  vi.stubGlobal('fetch',fetchMock);
  await createMaintenance({
   roomId:'3',title:'Aircon',description:'Broken compressor',
   priority:'high',assignedTo:null,affectsRoom:true,
  });
  const [address,opts]=fetchMock.mock.calls[0] as [string,RequestInit];
  expect(new URL(address).pathname).toBe('/api/v1/hotels/7/maintenance-work-orders');
  expect(opts.method).toBe('POST');
  expect(JSON.parse(opts.body as string).affectsRoom).toBe(true);
  expect(fetchMock).toHaveBeenCalledTimes(1);
 });
 it('sends optimistic revision and preserves 409 conflict errors',async()=>{
  setSessionToken('admin-token');setSessionHotel('7');
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue({
   ok:false,status:409,json:async()=>({message:'Work order was updated'}),
  }));
  await expect(updateMaintenance('9',{expectedRevision:2,status:'resolved'})).rejects.toMatchObject({
   status:409,message:'Work order was updated',
  });
 });
 it('reads audit history and rejects calls without selected hotel',async()=>{
  setSessionToken('staff-token');setSessionHotel('1');
  const fetchMock=vi.fn().mockResolvedValue({ok:true,json:async()=>({data:[],meta:{}})});
  vi.stubGlobal('fetch',fetchMock);
  await maintenanceHistory('10');
  expect(new URL(fetchMock.mock.calls[0][0] as string).pathname)
   .toBe('/api/v1/hotels/1/maintenance-work-orders/10/history');
  setSessionHotel(null);
  expect(()=>maintenanceHistory('10')).toThrow('Choose a hotel');
 });
});


const phase34Order:LiveWorkOrder={
 id:'12',hotelId:'7',roomId:'3',roomNumber:'205',
 title:'Aircon repair',description:'Outdoor unit inspection',
 priority:'high',status:'open',assignedTo:null,assignedUserId:'21',
 affectsRoom:true,revision:2,reportedAt:'2026-11-17 12:00:00',resolvedAt:null,
};
const phase34Response={
 data:[phase34Order],
 meta:{page:1,perPage:20,total:1,totalPages:1,affectsRoomDoesNotBlockInventory:true},
};
describe('Phase 34 live maintenance contracts',()=>{
 it('accepts only hotel-scoped maintenance records and a nonblocking flag',()=>{
  const result=parseLiveMaintenance(phase34Response,'7');
  expect(result.data[0].affectsRoom).toBe(true);
  expect(result.meta.affectsRoomDoesNotBlockInventory).toBe(true);
  expect(()=>parseLiveMaintenance(phase34Response,'8')).toThrow(/another hotel/);
 });
 it('rejects claims that maintenance automatically changes room inventory',()=>{
  expect(()=>parseLiveMaintenance({
   ...phase34Response,meta:{...phase34Response.meta,affectsRoomDoesNotBlockInventory:false},
  },'7')).toThrow();
 });
 it('rejects invalid status, priority or revision values',()=>{
  expect(()=>parseLiveMaintenance({
   ...phase34Response,data:[{...phase34Order,status:'ready'}],
  },'7')).toThrow();
  expect(()=>parseLiveMaintenance({
   ...phase34Response,data:[{...phase34Order,revision:0}],
  },'7')).toThrow();
 });
 it('requires an exact hotel and work-order identity on successful PATCH',()=>{
  const body={data:{...phase34Order,status:'in_progress',revision:3}};
  expect(parseUpdatedMaintenance(body,'7','12').revision).toBe(3);
  expect(()=>parseUpdatedMaintenance(body,'9','12')).toThrow(/selected hotel or order/);
  expect(()=>parseUpdatedMaintenance(body,'7','13')).toThrow(/selected hotel or order/);
 });
 it('restricts progression and editing to current eligible staff',()=>{
  expect(nextLiveMaintenanceStatus('open')).toBe('in_progress');
  expect(nextLiveMaintenanceStatus('in_progress')).toBe('resolved');
  expect(nextLiveMaintenanceStatus('resolved')).toBe('closed');
  expect(nextLiveMaintenanceStatus('closed')).toBeNull();
  expect(mayUpdateMaintenance(phase34Order,false,'maintenance','21')).toBe(true);
  expect(mayUpdateMaintenance(phase34Order,false,'maintenance','22')).toBe(false);
  expect(mayUpdateMaintenance(phase34Order,false,'front_desk','21')).toBe(false);
  expect(mayUpdateMaintenance(phase34Order,true,'admin','22')).toBe(true);
 });
 it('validates paginated, actor-attributed Laravel work order history',()=>{
  const response={data:[{
   id:'44',actorId:'21',action:'updated',
   before:{status:'open'},after:{status:'in_progress'},
   note:'Inspection started',createdAt:'2026-11-17 13:00:00',
  }],meta:{page:1,perPage:20,total:1,totalPages:1}};
  expect(parseMaintenanceHistory(response).data[0].actorId).toBe('21');
  expect(()=>parseMaintenanceHistory({
   ...response,meta:{...response.meta,page:0},
  })).toThrow();
 });
 it('uses backend status and priority filters',async()=>{
  setSessionToken('staff-token');setSessionHotel('7');
  const fetchMock=vi.fn().mockResolvedValue({ok:true,json:async()=>phase34Response});
  vi.stubGlobal('fetch',fetchMock);
  await listMaintenance(2,20,{status:'open',priority:'high'});
  const url=new URL(fetchMock.mock.calls[0][0] as string);
  expect(url.searchParams.get('status')).toBe('open');
  expect(url.searchParams.get('priority')).toBe('high');
  expect(url.searchParams.get('page')).toBe('2');
 });
 it('rejects stale expected revisions before sending a PATCH',async()=>{
  setSessionToken('staff-token');setSessionHotel('7');
  const fetchMock=vi.fn();
  vi.stubGlobal('fetch',fetchMock);
  await expect(patchValidatedMaintenance('7',phase34Order,{
   expectedRevision:1,status:'in_progress',
  })).rejects.toThrow(/revision/);
  expect(fetchMock).not.toHaveBeenCalled();
 });
});
