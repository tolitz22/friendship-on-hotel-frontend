import type {DashboardSummary,Folio,Guest,HousekeepingTask,Reservation,Room} from '../types';
export const hotelId='hotel-demo-001';
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
 {id:'g4',hotelId,firstName:'Paolo',lastName:'Garcia',email:'paolo.garcia@example.test',phone:null,nationality:'Philippines',createdAt:'2026-11-10T13:00:00+08:00'}
];
export const reservations:Reservation[]=[
 {id:'res1',reference:'FOH-1001',hotelId,primaryGuestId:'g1',primaryGuestName:'Maria Santos',roomTypeId:'deluxe',roomTypeName:'Deluxe',assignedRoomId:'r301',assignedRoomNumber:'301',checkIn:'2026-12-10',checkOut:'2026-12-12',status:'confirmed',adults:2,children:0,total:php(840000),createdAt:'2026-11-10T10:00:00+08:00'},
 {id:'res2',reference:'FOH-1002',hotelId,primaryGuestId:'g2',primaryGuestName:'James Reyes',roomTypeId:'standard',roomTypeName:'Standard',assignedRoomId:null,assignedRoomNumber:null,checkIn:'2026-12-10',checkOut:'2026-12-13',status:'pending',adults:1,children:0,total:php(750000),createdAt:'2026-11-11T10:00:00+08:00'},
 {id:'res3',reference:'FOH-1003',hotelId,primaryGuestId:'g3',primaryGuestName:'Anna Cruz',roomTypeId:'suite',roomTypeName:'Suite',assignedRoomId:'r407',assignedRoomNumber:'407',checkIn:'2026-11-15',checkOut:'2026-11-19',status:'checked_in',adults:2,children:1,total:php(2240000),createdAt:'2026-11-08T09:00:00+08:00'},
 {id:'res4',reference:'FOH-1004',hotelId,primaryGuestId:'g4',primaryGuestName:'Paolo Garcia',roomTypeId:'deluxe',roomTypeName:'Deluxe',assignedRoomId:null,assignedRoomNumber:null,checkIn:'2026-12-12',checkOut:'2026-12-13',status:'cancelled',adults:2,children:0,total:php(420000),createdAt:'2026-11-12T14:00:00+08:00'}
];
export const housekeeping:HousekeepingTask[]=[
 {id:'hk1',hotelId,roomId:'r203',roomNumber:'203',type:'checkout_clean',status:'todo',assignedTo:'Team A',dueAt:null},
 {id:'hk2',hotelId,roomId:'r302',roomNumber:'302',type:'stayover',status:'in_progress',assignedTo:'Team B',dueAt:null},
 {id:'hk3',hotelId,roomId:'r401',roomNumber:'401',type:'inspection',status:'todo',assignedTo:null,dueAt:null},
 {id:'hk4',hotelId,roomId:'r201',roomNumber:'201',type:'inspection',status:'done',assignedTo:'Team A',dueAt:null}
];
export const folios:Folio[]=[
 {id:'f1',hotelId,reservationId:'res1',reservationReference:'FOH-1001',guestName:'Maria Santos',status:'open',balance:php(420000),totalCharges:php(840000),totalPayments:php(420000)},
 {id:'f2',hotelId,reservationId:'res3',reservationReference:'FOH-1003',guestName:'Anna Cruz',status:'open',balance:php(640000),totalCharges:php(2240000),totalPayments:php(1600000)},
 {id:'f3',hotelId,reservationId:'res4',reservationReference:'FOH-1004',guestName:'Paolo Garcia',status:'settled',balance:php(0),totalCharges:php(0),totalPayments:php(0)}
];
export const dashboard:DashboardSummary={hotelId,asOf:'2026-11-17',totalRooms:rooms.length,occupiedRooms:rooms.filter(r=>r.occupancyStatus==='occupied').length,vacantRooms:rooms.filter(r=>r.occupancyStatus==='vacant').length,dirtyRooms:rooms.filter(r=>r.housekeepingStatus==='dirty').length,arrivalsToday:0,departuresToday:0,reservationsToday:0};
