import {describe,expect,it} from 'vitest';
import {groupHousekeepingRooms,parseHousekeepingRoomBoard,type HousekeepingBoardRoom} from './housekeepingRoomBoard';
const room:HousekeepingBoardRoom={roomId:'1',roomNumber:'201',roomType:'Standard',floor:2,occupancy:'vacant',stage:'dirty',arrivalToday:true,maintenanceBlocked:false,inventoryBlocked:false,task:{id:'3',type:'checkout_clean',status:'todo',assignment:'mine'}};
const sample={data:{hotelId:'1',userId:'2',hotelDate:'2026-11-27',rooms:[room]},meta:{total:1,snapshotOnly:true,physicalOccupancyVerified:false}};
describe('HK-05 room board',()=>{
 it('rejects cross-hotel and inconsistent room readiness',()=>{
  expect(parseHousekeepingRoomBoard(sample,'1','2').data.rooms).toEqual([room]);
  expect(()=>parseHousekeepingRoomBoard(sample,'1','3')).toThrow();
  expect(()=>parseHousekeepingRoomBoard({...sample,data:{...sample.data,rooms:[{...room,stage:'ready'}]}},'1','2')).toThrow();
 });
 it('groups actual floors and keeps unknown floors separate',()=>{
  const groups=groupHousekeepingRooms([room,{...room,roomId:'2',floor:null},{...room,roomId:'3',floor:0}]);
  expect(groups.map(group=>group.floor)).toEqual([0,2,null]);
 });
});
