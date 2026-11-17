import {afterEach,describe,expect,it,vi} from 'vitest';
import {clearSession,setSessionHotel,setSessionToken} from './session';
import {createMaintenance,listMaintenance,maintenanceHistory,updateMaintenance} from './liveMaintenance';

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
  await expect(maintenanceHistory('10')).rejects.toThrow('Choose a hotel');
 });
});
