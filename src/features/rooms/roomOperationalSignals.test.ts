import {describe,expect,it} from 'vitest';
import {informationalMaintenanceCount,roomOperationalSignal} from './roomOperationalSignals';
import type {InventoryRoomStatus} from '../../api/roomInventoryStatus';

const base:InventoryRoomStatus={
 roomId:'1',roomNumber:'101',occupancy:'vacant',activeStayId:null,
 cleaning:'not_verified',turnoverTaskId:null,turnoverStatus:null,
 assignedHousekeeperId:null,assignedHousekeeperName:null,
 cleanedById:null,cleanedByName:null,cleanedAt:null,
 inspectionId:null,inspectionStatus:null,inspectedById:null,inspectedByName:null,
 inspectedAt:null,reviewedById:null,reviewedByName:null,reviewedAt:null,
 advisoryReady:false,maintenanceBlocked:false,inventoryBlockedToday:false,
};
describe('shared room operation signals',()=>{
 it('treats a real maintenance restriction as a block',()=>{
  expect(roomOperationalSignal({...base,maintenanceBlocked:true}).tone).toBe('blocked');
 });
 it('treats an inventory block as a block',()=>{
  expect(roomOperationalSignal({...base,inventoryBlockedToday:true}).tone).toBe('blocked');
 });
 it('does not call cleaning or missing inspection a sellable room',()=>{
  expect(roomOperationalSignal({...base,cleaning:'checkout_cleaning',turnoverStatus:'todo'}).tone).toBe('attention');
  expect(roomOperationalSignal(base).title).toBe('Readiness not verified');
 });
 it('treats an approved inspection as evidence, not a booking guarantee',()=>{
  const signal=roomOperationalSignal({...base,cleaning:'ready',advisoryReady:true});
  expect(signal.tone).toBe('approved');
  expect(signal.action).toMatch(/availability/);
 });
 it('shows registered occupancy ahead of inspection approval',()=>{
  expect(roomOperationalSignal({...base,occupancy:'occupied',activeStayId:'5'}).tone).toBe('occupied');
 });
 it('does not transform a work-order impact note into a room block',()=>{
  expect(informationalMaintenanceCount([
   {status:'open',affectsRoom:true},
   {status:'in_progress',affectsRoom:true},
   {status:'closed',affectsRoom:true},
   {status:'open',affectsRoom:false},
  ])).toBe(2);
 });
});
