import type {CalendarParams,CollectionResponse,HotelDataSource,ListParams} from '../types';
import {dashboard,folios,guests,housekeeping,reservations,rooms} from './fixtures';
import {maintenanceOrders,technicians} from './maintenanceFixtures';
import {aggregateReports,isReportRange} from '../../features/reports/reportMath';
import {sampleHotelSettings} from './settingsFixtures';
const wait=()=>new Promise<void>(resolve=>setTimeout(resolve,120));
function collect<T>(items:T[],params:ListParams={},matcher:(row:T,search:string)=>boolean=()=>true):CollectionResponse<T>{
 const filtered=params.search?items.filter(row=>matcher(row,params.search!.toLowerCase())):items;
 const perPage=Math.max(1,Math.min(100,params.perPage??20)),page=Math.max(1,params.page??1);
 return {data:filtered.slice((page-1)*perPage,page*perPage),meta:{page,perPage,total:filtered.length,totalPages:Math.ceil(filtered.length/perPage)}};
}
const match=(...values:(string|null)[])=>(q:string)=>values.some(value=>(value??'').toLowerCase().includes(q));
const sampleRates:Record<string,number>={standard:250000,deluxe:420000,suite:560000};
const frontDeskEntry=(reservation:typeof reservations[number])=>{
 const room=reservation.assignedRoomId?rooms.find(r=>r.id===reservation.assignedRoomId)??null:null;
 const alerts:string[]=[];
 if(!room)alerts.push('No physical room assigned');
 if(room?.maintenanceStatus!=='available'&&room)alerts.push('Room is marked for maintenance');
 if(room&&room.housekeepingStatus!=='clean')alerts.push('Housekeeping status requires verification');
 return {reservation,room,readiness:'review_required' as const,alerts};
};
export const mockDataSource:HotelDataSource={
 async getHotelSettings(){await wait();return sampleHotelSettings;},

 async getReports({from,to}){
  await wait();
  if(!isReportRange(from,to))throw new Error('Choose a valid report date range');
  return {data:aggregateReports({reservations,rooms,housekeeping,folios,maintenance:maintenanceOrders},from,to),
   meta:{hotelId:'hotel-demo-001',from,to,currency:'PHP' as const,isIllustrative:true,
    roomSnapshotAsOf:'2026-11-17',folioScope:'all_sample_records' as const}};
 },
 async getMaintenanceBoard(){
  await wait();
  return {data:{workOrders:maintenanceOrders,rooms,technicians},meta:{hotelId:'hotel-demo-001',isPreview:true}};
 },
 async getHousekeepingBoard(){
  await wait();
  return {data:{tasks:housekeeping,rooms,staff:[
   {id:'team-a',name:'Team A'},{id:'team-b',name:'Team B'},{id:'team-c',name:'Team C'}
  ]},meta:{hotelId:'hotel-demo-001',isPreview:true}};
 },
 async getFrontDeskBoard(date){
  await wait();
  const arrivals=reservations.filter(r=>r.checkIn===date&&['confirmed','pending'].includes(r.status)).map(frontDeskEntry);
  const departures=reservations.filter(r=>r.checkOut===date&&r.status==='checked_in').map(frontDeskEntry);
  const inHouse=reservations.filter(r=>r.checkIn<=date&&r.checkOut>=date&&r.status==='checked_in').map(frontDeskEntry);
  return {data:{arrivals,departures,inHouse},meta:{date,hotelId:'hotel-demo-001',timeZone:'Asia/Manila',isPreview:true}};
 },
 async getBookingOptions(){
  await wait();
  const types=new Map(rooms.map(r=>[r.roomTypeId,r.roomTypeName]));
  return {data:{roomTypes:Array.from(types,([id,name])=>({
   id,name,maxOccupancy:Math.max(...rooms.filter(r=>r.roomTypeId===id).map(r=>r.maxOccupancy)),
   sampleNightlyRate:{amountMinor:sampleRates[id]??0,currency:'PHP' as const}
  }))}};
 },
 async getBookingQuote(p){
  await wait();
  const rate=sampleRates[p.roomTypeId];
  const start=Date.parse(p.checkIn+'T00:00:00Z'),end=Date.parse(p.checkOut+'T00:00:00Z');
  const nights=Math.round((end-start)/86400000);
  if(rate===undefined||!Number.isSafeInteger(nights)||nights<1||nights>30||!Number.isInteger(p.adults)||p.adults<1||!Number.isInteger(p.children)||p.children<0)throw new Error('Invalid sample quote inputs');
  return {data:{nights,nightlyRate:{amountMinor:rate,currency:'PHP' as const},roomSubtotal:{amountMinor:rate*nights,currency:'PHP' as const},currency:'PHP' as const,isIllustrative:true}};
 },
 async getRoomTimeline({from,to}:CalendarParams){
  await wait();
  const active=reservations.filter(r=>['pending','confirmed','checked_in'].includes(r.status)&&r.checkIn<to&&r.checkOut>from);
  const blocks=active.filter(r=>r.assignedRoomId).map(r=>({
   id:'block-'+r.id,kind:'reservation' as const,roomId:r.assignedRoomId!,
   from:r.checkIn,to:r.checkOut,reservationId:r.id,reference:r.reference,guestName:r.primaryGuestName,status:r.status
  }));
  const maintenance=rooms.filter(r=>r.maintenanceStatus==='out_of_order').map(r=>({
   id:'maintenance-'+r.id,kind:'maintenance' as const,roomId:r.id,from:'2026-11-16',to:'2026-11-25',
   reason:'Example scheduled repairs'
  })).filter(b=>b.from<to&&b.to>from);
  return {data:{rooms,blocks:[...blocks,...maintenance],unassignedReservations:active.filter(r=>!r.assignedRoomId)},meta:{hotelId:'hotel-demo-001',from,to}};
 },
 async getReservationCalendar({from,to}:CalendarParams){
  await wait();
  const overlapping=reservations.filter(r=>r.checkIn<to&&r.checkOut>from);
  const names=new Map<string,string>();
  for(const room of rooms)names.set(room.roomTypeId,room.roomTypeName);
  for(const reservation of overlapping)names.set(reservation.roomTypeId,reservation.roomTypeName);
  const roomTypes=Array.from(names,([id,name])=>({id,name}));
  return {data:overlapping,meta:{from,to,roomTypes}};
 },
 async getDashboard(){await wait();return {data:dashboard};},
 async listReservations(params){await wait();return collect(reservations,params,(r,q)=>match(r.reference,r.primaryGuestName,r.roomTypeName,r.assignedRoomNumber,r.status)(q));},
 async listRooms(params){await wait();return collect(rooms.filter(r=>!params?.floor||r.floor===params.floor),params,(r,q)=>match(r.number,r.roomTypeName,r.occupancyStatus,r.housekeepingStatus,r.maintenanceStatus)(q));},
 async listGuests(params){await wait();return collect(guests,params,(g,q)=>match(g.firstName,g.lastName,g.email,g.phone)(q));},
 async listHousekeeping(params){await wait();return collect(housekeeping,params,(t,q)=>match(t.roomNumber,t.type,t.status,t.assignedTo)(q));},
 async listFolios(params){await wait();return collect(folios,params,(f,q)=>match(f.reservationReference,f.guestName,f.status)(q));}
};
