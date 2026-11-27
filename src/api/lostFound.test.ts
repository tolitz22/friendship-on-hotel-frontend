import {describe,expect,it} from 'vitest';
import {parseLostFoundList} from './lostFound';
const row={id:'1',hotelId:'2',roomId:'3',roomNumber:'101',description:'Umbrella',storageLocation:'Locker A',status:'stored',reportedBy:'4',revision:1,reportedAt:'2026-11-27',updatedAt:'2026-11-27'};
const raw={data:[row],meta:{hotelId:'2',page:1,total:1,totalPages:1}};
describe('HK-06 register scope',()=>{
 it('accepts the reporting employee and rejects other staff and hotels',()=>{
  expect(parseLostFoundList(raw,'2','4').data[0].description).toBe('Umbrella');
  expect(()=>parseLostFoundList(raw,'2','5')).toThrow();
  expect(()=>parseLostFoundList(raw,'3')).toThrow();
 });
 it('rejects an unsupported custody outcome',()=>expect(()=>parseLostFoundList({...raw,data:[{...row,status:'deleted'}]},'2')).toThrow());
});
