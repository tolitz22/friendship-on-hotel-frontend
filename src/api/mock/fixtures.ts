import {addDays,hotelToday} from '../../features/reservations/calendarDate';
import type {DashboardSummary,Folio,Guest,HousekeepingTask,Reservation,Room} from '../types';
export const hotelId='hotel-demo-001';
export const demoToday=hotelToday();
export const demoDay=(offset:number)=>addDays(demoToday,offset);
const php=(amountMinor:number)=>({amountMinor,currency:'PHP' as const});
export const rooms:Room[]=[
 {id:'r201',hotelId,number:'201',floor:2,roomTypeId:'standard',roomTypeName:'Standard',occupancyStatus:'vacant',housekeepingStatus:'clean',maintenanceStatus:'available',maxOccupancy:2},
 {id:'r202',hotelId,number:'202',floor:2,roomTypeId:'standard',roomTypeName:'Standard',occupancyStatus:'occupied',housekeepingStatus:'clean',maintenanceStatus:'available',maxOccupancy:2},
 {id:'r203',hotelId,number:'203',floor:2,roomTypeId:'standard',roomTypeName:'Standard',occupancyStatus:'vacant',housekeepingStatus:'dirty',maintenanceStatus:'available',maxOccupancy:2},
 {id:'r301',hotelId,number:'301',floor:3,roomTypeId:'deluxe',roomTypeName:'Deluxe',occupancyStatus:'vacant',housekeepingStatus:'clean',maintenanceStatus:'available',maxOccupancy:3},
 {id:'r302',hotelId,number:'302',floor:3,roomTypeId:'deluxe',roomTypeName:'Deluxe',occupancyStatus:'occupied',housekeepingStatus:'dirty',maintenanceStatus:'available',maxOccupancy:3},
 {id:'r303',hotelId,number:'303',floor:3,roomTypeId:'deluxe',roomTypeName:'Deluxe',occupancyStatus:'vacant',housekeepingStatus:'clean',maintenanceStatus:'out_of_order',maxOccupancy:3},
 {id:'r401',hotelId,number:'401',floor:4,roomTypeId:'suite',roomTypeName:'Suite',occupancyStatus:'vacant',housekeepingStatus:'inspecting',maintenanceStatus:'available',maxOccupancy:4},
 {id:'r407',hotelId,number:'407',floor:4,roomTypeId:'suite',roomTypeName:'Suite',occupancyStatus:'occupied',housekeepingStatus:'clean',maintenanceStatus:'available',maxOccupancy:4},
];
export const guests:Guest[]=[
 {id:'g1',hotelId,firstName:'Maria',lastName:'Santos',email:'maria.santos@example.test',phone:null,nationality:'Philippines',createdAt:'2026-11-01T09:00:00+08:00'},
 {id:'g2',hotelId,firstName:'James',lastName:'Reyes',email:'james.reyes@example.test',phone:null,nationality:'Philippines',createdAt:'2026-11-04T10:00:00+08:00'},
 {id:'g3',hotelId,firstName:'Anna',lastName:'Cruz',email:'anna.cruz@example.test',phone:null,nationality:'Philippines',createdAt:'2026-11-07T09:00:00+08:00'},
 {id:'g4',hotelId,firstName:'Paolo',lastName:'Garcia',email:'paolo.garcia@example.test',phone:null,nationality:'Philippines',createdAt:'2026-11-10T13:00:00+08:00'},
 {id:'g5',hotelId,firstName:'Lia',lastName:'Mendoza',email:'lia.mendoza@example.test',phone:null,nationality:'Philippines',createdAt:demoDay(-15)+'T13:00:00+08:00'},
 {id:'g6',hotelId,firstName:'Nico',lastName:'Villanueva',email:'nico.villanueva@example.test',phone:null,nationality:'Philippines',createdAt:demoDay(-15)+'T13:00:00+08:00'}
];
export const reservations:Reservation[]=[
 {id:'res1',reference:'FOH-1001',hotelId,primaryGuestId:'g1',primaryGuestName:'Maria Santos',roomTypeId:'deluxe',roomTypeName:'Deluxe',assignedRoomId:'r301',assignedRoomNumber:'301',checkIn:demoDay(0),checkOut:demoDay(2),status:'confirmed',adults:2,children:0,total:php(840000),createdAt:demoDay(-7)+'T10:00:00+08:00'},
 {id:'res2',reference:'FOH-1002',hotelId,primaryGuestId:'g2',primaryGuestName:'James Reyes',roomTypeId:'standard',roomTypeName:'Standard',assignedRoomId:null,assignedRoomNumber:null,checkIn:demoDay(0),checkOut:demoDay(3),status:'pending',adults:1,children:0,total:php(750000),createdAt:demoDay(-6)+'T10:00:00+08:00'},
 {id:'res3',reference:'FOH-1003',hotelId,primaryGuestId:'g3',primaryGuestName:'Anna Cruz',roomTypeId:'suite',roomTypeName:'Suite',assignedRoomId:'r407',assignedRoomNumber:'407',checkIn:demoDay(-2),checkOut:demoDay(0),status:'checked_in',adults:2,children:1,total:php(2240000),createdAt:demoDay(-9)+'T09:00:00+08:00'},
 {id:'res4',reference:'FOH-1004',hotelId,primaryGuestId:'g4',primaryGuestName:'Paolo Garcia',roomTypeId:'deluxe',roomTypeName:'Deluxe',assignedRoomId:null,assignedRoomNumber:null,checkIn:demoDay(2),checkOut:demoDay(3),status:'cancelled',adults:2,children:0,total:php(420000),createdAt:demoDay(-5)+'T14:00:00+08:00'},
 {id:'res5',reference:'FOH-1005',hotelId,primaryGuestId:'g5',primaryGuestName:'Lia Mendoza',roomTypeId:'standard',roomTypeName:'Standard',assignedRoomId:'r202',assignedRoomNumber:'202',checkIn:demoDay(-1),checkOut:demoDay(3),status:'checked_in',adults:1,children:0,total:php(1000000),createdAt:demoDay(-7)+'T09:00:00+08:00'},
 {id:'res6',reference:'FOH-1006',hotelId,primaryGuestId:'g2',primaryGuestName:'James Reyes',roomTypeId:'deluxe',roomTypeName:'Deluxe',assignedRoomId:null,assignedRoomNumber:null,checkIn:demoDay(1),checkOut:demoDay(4),status:'confirmed',adults:2,children:0,total:php(1260000),createdAt:demoDay(-4)+'T10:00:00+08:00'},
 {id:'res7',reference:'FOH-1007',hotelId,primaryGuestId:'g4',primaryGuestName:'Paolo Garcia',roomTypeId:'standard',roomTypeName:'Standard',assignedRoomId:'r201',assignedRoomNumber:'201',checkIn:demoDay(0),checkOut:demoDay(1),status:'confirmed',adults:2,children:0,total:php(250000),createdAt:demoDay(-3)+'T11:00:00+08:00'},
 {id:'res8',reference:'FOH-1008',hotelId,primaryGuestId:'g3',primaryGuestName:'Anna Cruz',roomTypeId:'deluxe',roomTypeName:'Deluxe',assignedRoomId:null,assignedRoomNumber:null,checkIn:demoDay(3),checkOut:demoDay(6),status:'pending',adults:2,children:0,total:php(1260000),createdAt:demoDay(-2)+'T12:00:00+08:00'},
 {id:'res9',reference:'FOH-1009',hotelId,primaryGuestId:'g6',primaryGuestName:'Nico Villanueva',roomTypeId:'deluxe',roomTypeName:'Deluxe',assignedRoomId:'r302',assignedRoomNumber:'302',checkIn:demoDay(-3),checkOut:demoDay(2),status:'checked_in',adults:2,children:0,total:php(2100000),createdAt:demoDay(-14)+'T09:00:00+08:00'},
 {id:'res10',reference:'FOH-1010',hotelId,primaryGuestId:'g4',primaryGuestName:'Paolo Garcia',roomTypeId:'standard',roomTypeName:'Standard',assignedRoomId:'r203',assignedRoomNumber:'203',checkIn:demoDay(-5),checkOut:demoDay(-2),status:'checked_out',adults:2,children:0,total:php(750000),createdAt:demoDay(-14)+'T09:00:00+08:00'}
];
export const housekeeping:HousekeepingTask[]=[
 {id:'hk1',hotelId,roomId:'r203',roomNumber:'203',type:'checkout_clean',status:'todo',assignedTo:'Team A',dueAt:null},
 {id:'hk2',hotelId,roomId:'r302',roomNumber:'302',type:'stayover',status:'in_progress',assignedTo:'Team B',dueAt:null},
 {id:'hk3',hotelId,roomId:'r401',roomNumber:'401',type:'inspection',status:'todo',assignedTo:null,dueAt:null},
 {id:'hk4',hotelId,roomId:'r201',roomNumber:'201',type:'inspection',status:'done',assignedTo:'Team A',dueAt:null}
];
export const folios:Folio[]=[
 {id:'f1',hotelId,reservationId:'res1',reservationReference:'FOH-1001',guestName:'Maria Santos',status:'open',balance:php(420000),totalCharges:php(840000),totalPayments:php(420000),samplePayment:{method:'Bank transfer',recordedBy:'Ella Bautista',reviewedBy:'Mika Flores'}},
 {id:'f2',hotelId,reservationId:'res3',reservationReference:'FOH-1003',guestName:'Anna Cruz',status:'settled',balance:php(0),totalCharges:php(2240000),totalPayments:php(2240000),samplePayment:{method:'Cash',recordedBy:'Jon Dela Peña',reviewedBy:'Mika Flores'}},
 {id:'f3',hotelId,reservationId:'res4',reservationReference:'FOH-1004',guestName:'Paolo Garcia',status:'voided',balance:php(0),totalCharges:php(0),totalPayments:php(0)},
 {id:'f4',hotelId,reservationId:'res9',reservationReference:'FOH-1009',guestName:'Nico Villanueva',status:'open',balance:php(2100000),totalCharges:php(2100000),totalPayments:php(0)},
 {id:'f5',hotelId,reservationId:'res10',reservationReference:'FOH-1010',guestName:'Paolo Garcia',status:'settled',balance:php(0),totalCharges:php(750000),totalPayments:php(750000),samplePayment:{method:'Card',recordedBy:'Ella Bautista',reviewedBy:'Mika Flores'}}
];
export const dashboard:DashboardSummary={hotelId,asOf:demoToday,totalRooms:rooms.length,occupiedRooms:rooms.filter(r=>r.occupancyStatus==='occupied').length,vacantRooms:rooms.filter(r=>r.occupancyStatus==='vacant').length,dirtyRooms:rooms.filter(r=>r.housekeepingStatus==='dirty').length,arrivalsToday:reservations.filter(r=>r.checkIn===demoToday&&['confirmed','pending'].includes(r.status)).length,departuresToday:reservations.filter(r=>r.checkOut===demoToday&&r.status==='checked_in').length,reservationsToday:reservations.filter(r=>r.checkIn<=demoToday&&r.checkOut>demoToday&&['confirmed','pending','checked_in'].includes(r.status)).length};
