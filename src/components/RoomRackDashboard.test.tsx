import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {describe,expect,it} from 'vitest';
import type {RackRoom} from '../api/roomRack';
import {RoomTile} from './RoomRackDashboard';
import rackSource from './RoomRackDashboard.tsx?raw';
import roomsPageSource from '../pages/LiveRooms.tsx?raw';

const room: RackRoom={
 roomId:'42',roomNumber:'402',roomTypeId:'2',roomTypeName:'Standard',floor:4,maxOccupancy:2,
 occupancy:'vacant',cleaning:'not_verified',advisoryReady:false,
 inspectionStatus:null,inspectionId:null,readinessStatus:'needs_inspection',
 blockers:{
  activeInventoryBlockToday:false,activeRoomImpactMaintenance:false,
  latestTurnoverIncomplete:false,newTurnoverSinceInspection:false,
  unfinishedHousekeeping:false,newRoomWorkSinceInspection:false,
 },
 openHousekeepingTaskId:null,activeMaintenanceOrderId:null,activeInventoryBlockId:null,
 cleanedAt:null,inspectedAt:null,reviewedAt:null,currentStay:null,upcomingStay:null,
};
describe('Room rack tile accessibility',()=>{
 it('is a single keyboard-reachable button with explicit state, icon, action and tooltip',()=>{
  const html=renderToStaticMarkup(createElement(RoomTile,{
   room,arrivals:[],today:'2026-11-19',onSelect:()=>{},
  }));
  expect(html).toContain('<button');
  expect(html).toContain('type="button"');
  expect(html).toContain('aria-label="Room 402');
  expect(html).toContain('title="Room 402');
  expect(html).toContain('Room inspection required');
  expect(html).toContain('Next: Inspect room');
  expect(html).toContain('Vacant in PMS');
  expect(html).not.toContain('Available for booking');
 });
 it('does not expose a guest name when the room has no stay',()=>{
  const html=renderToStaticMarkup(createElement(RoomTile,{
   room,arrivals:[],today:'2026-11-19',onSelect:()=>{},
  }));
  expect(html).not.toContain('Guest Example');
 });
});

describe('Responsive and keyboard interaction contract',()=>{
 it('keeps drawer dialog semantics, Escape closure, focus containment and restoration',()=>{
  expect(rackSource).toContain('role="dialog" aria-modal="true"');
  expect(rackSource).toContain("if(event.key==='Escape')");
  expect(rackSource).toContain("event.key!=='Tab'");
  expect(rackSource).toContain('restoreFocus();');
  expect(rackSource).toContain('aria-label={tooltip}');
  expect(rackSource).toContain('allowedActions.completeInspection');
 });
});

describe('Consolidated Rooms workspace',()=>{
 it('uses one rack and contextual management instead of switching room tabs',()=>{
  expect(roomsPageSource).toContain('<RoomRackDashboard');
  expect(roomsPageSource).toContain('onEditRoom=');
  expect(roomsPageSource).toContain('<CatalogCreateDialog');
  expect(roomsPageSource).not.toContain('rr-page-tabs');
  expect(roomsPageSource).not.toContain('changeView(');
 });
 it('keeps room tile details compact with accessible operations',()=>{
  const html=renderToStaticMarkup(createElement(RoomTile,{
   room,arrivals:[],today:'2026-11-19',canInspect:false,onSelect:()=>{},
  }));
  expect(html).toContain('rack-tile-number');
  expect(html).toContain('rack-tile-quick-icons');
  expect(html).toContain('Next: View inspection');
  expect(html).toContain('title="Room 402');
  expect(html).toContain('Housekeeping: not verified');
 });
});
