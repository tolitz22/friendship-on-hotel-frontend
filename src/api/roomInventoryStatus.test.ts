import {describe,expect,it} from 'vitest';
import {cleaningLabel,occupancyLabel,parseRoomInventoryStatus} from './roomInventoryStatus';

const item={
 roomId:'10',roomNumber:'201',occupancy:'vacant',activeStayId:null,
 cleaning:'checkout_cleaning',turnoverTaskId:'56',turnoverStatus:'todo',
 assignedHousekeeperId:null,cleanedById:null,cleanedAt:null,
 inspectionId:null,inspectionStatus:null,inspectedById:null,inspectedAt:null,
 reviewedById:null,reviewedAt:null,advisoryReady:false,
 maintenanceBlocked:false,inventoryBlockedToday:false,
} as const;
const response={data:[item],meta:{
 hotelId:'1',hotelDate:'2027-01-12',snapshotOnly:true,
 advisoryOnly:true,physicalOccupancyVerified:false,
}};
describe('Room Inventory checkout cleaning contract',()=>{
 it('shows checkout cleaning separately from vacant PMS occupancy',()=>{
  const result=parseRoomInventoryStatus(response,'1',['10']);
  expect(result.data[0].occupancy).toBe('vacant');
  expect(result.data[0].cleaning).toBe('checkout_cleaning');
  expect(cleaningLabel(result.data[0].cleaning)).toBe('Checkout cleaning required');
  expect(occupancyLabel(result.data[0].occupancy)).toBe('Vacant in PMS');
 });
 it('shows completed checkout cleaning as inspection pending, not automatically ready',()=>{
  const done={...item,cleaning:'awaiting_inspection',turnoverStatus:'done',
   cleanedAt:'2027-01-12 10:00:00',cleanedById:'7'};
  expect(parseRoomInventoryStatus({...response,data:[done]},'1',['10'])
   .data[0].advisoryReady).toBe(false);
 });
 it('rejects cross-hotel or incomplete room observations',()=>{
  expect(()=>parseRoomInventoryStatus(response,'2',['10'])).toThrow(/hotel/);
  expect(()=>parseRoomInventoryStatus(response,'1',['10','11'])).toThrow(/incomplete/);
  expect(()=>parseRoomInventoryStatus(response,'1',['11'])).toThrow(/another hotel or room/);
 });
 it('never claims a blocked or unapproved room is ready',()=>{
  expect(()=>parseRoomInventoryStatus({...response,data:[{
   ...item,cleaning:'ready',turnoverStatus:'done',advisoryReady:false,
  }]},'1',['10'])).toThrow(/contradicts/);
  expect(()=>parseRoomInventoryStatus({...response,data:[{
   ...item,cleaning:'ready',turnoverStatus:'done',advisoryReady:true,
   maintenanceBlocked:true,
  }]},'1',['10'])).toThrow(/contradicts/);
 });
 it('rejects a forged physical occupancy proof flag',()=>{
  expect(()=>parseRoomInventoryStatus({...response,meta:{
   ...response.meta,physicalOccupancyVerified:true,
  }},'1',['10'])).toThrow();
 });
});
