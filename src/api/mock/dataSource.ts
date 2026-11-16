import type {CalendarParams,CollectionResponse,HotelDataSource,ListParams} from '../types';
import {dashboard,folios,guests,housekeeping,reservations,rooms} from './fixtures';
const wait=()=>new Promise<void>(resolve=>setTimeout(resolve,120));
function collect<T>(items:T[],params:ListParams={},matcher:(row:T,search:string)=>boolean=()=>true):CollectionResponse<T>{
 const filtered=params.search?items.filter(row=>matcher(row,params.search!.toLowerCase())):items;
 const perPage=Math.max(1,Math.min(100,params.perPage??20)),page=Math.max(1,params.page??1);
 return {data:filtered.slice((page-1)*perPage,page*perPage),meta:{page,perPage,total:filtered.length,totalPages:Math.ceil(filtered.length/perPage)}};
}
const match=(...values:(string|null)[])=>(q:string)=>values.some(value=>(value??'').toLowerCase().includes(q));
export const mockDataSource:HotelDataSource={
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
