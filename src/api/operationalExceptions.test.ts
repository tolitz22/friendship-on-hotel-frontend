import {describe,expect,it} from 'vitest';
import {parseOperationalExceptions} from './operationalExceptions';

const fixture=()=>({
 data:{
  hotelId:'1',asOfHotelDate:'2026-11-17',windowEndExclusive:'2026-11-24',
  summary:{total:1,critical:0,attention:1,review:0},
  items:[{id:'unassigned_arrival:11:abc',type:'unassigned_arrival',severity:'attention',
   bookingId:'11',reference:'SYNTH-11',reason:'No room assignment',
   suggestion:'Review record',recordDate:'2026-11-18'}],
  activity:[],
 },
 meta:{readOnly:true,complete:true,isFraudDetermination:false,
  keycardLogsConnected:false,cctvEventsConnected:false,
  housekeepingPhysicalOccupancyConnected:false,sourceLimit:500,
  notes:'Operational review only'},
});
describe('operational exception API safety',()=>{
 it('accepts a complete, neutral hotel-scoped report',()=>{
  expect(parseOperationalExceptions(fixture(),'1').data.summary.total).toBe(1);
 });
 it('rejects a report from another property',()=>{
  expect(()=>parseOperationalExceptions(fixture(),'2')).toThrow('another hotel');
 });
 it('rejects false fraud determinations and connected log claims',()=>{
  const response=fixture();
  expect(()=>parseOperationalExceptions({...response,meta:{...response.meta,isFraudDetermination:true}},'1')).toThrow();
  expect(()=>parseOperationalExceptions({...response,meta:{...response.meta,keycardLogsConnected:true}},'1')).toThrow();
 });
 it('accepts room, investigation and cashier items without fictitious booking IDs',()=>{
  const base=fixture();
  const items=[
   {id:'room_inspection:1',type:'room_inspection_review',severity:'attention',bookingId:null,
    roomId:'10',roomNumber:'201',ownerName:'Housekeeper A',reference:'Room 201',
    reason:'Inspection awaiting manager review',suggestion:'Review checklist',recordDate:'2026-11-18T05:00:00Z'},
   {id:'occupancy_check:5',type:'occupancy_investigation',severity:'critical',bookingId:null,
    roomId:'10',roomNumber:'201',checkDate:'2026-11-18',ownerName:'Manager B',
    reference:'Room 201',reason:'Physical discrepancy',suggestion:'Continue investigation',
    recordDate:'2026-11-18T05:00:00Z'},
   {id:'cashier_shift:6',type:'cashier_shift_review',severity:'review',bookingId:null,
    roomId:null,roomNumber:null,ownerName:'Cashier A',reference:'Cashier shift 6',
    reason:'Submitted count',suggestion:'Review cash',recordDate:'2026-11-18T05:00:00Z'},
  ];
  const value={...base,data:{...base.data,items,summary:{
   total:3,critical:1,attention:1,review:1,
  }}};
  const parsed=parseOperationalExceptions(value,'1');
  expect(parsed.data.items).toHaveLength(3);
  expect(parsed.data.items[1].roomNumber).toBe('201');
  expect(parsed.data.items[2].bookingId).toBeNull();
 });
 it('rejects mismatched totals rather than silently showing incomplete reporting',()=>{
  const response=fixture();
  response.data.summary.total=2;
  expect(()=>parseOperationalExceptions(response,'1')).toThrow('totals');
 });
});
