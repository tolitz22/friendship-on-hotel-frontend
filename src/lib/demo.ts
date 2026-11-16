/** Illustrative UI fixtures only. Not real hotel inventory, prices or confirmed reservations. */
export const demoReservations = [
 {id:'FOH-1001',guest:'Maria Santos',room:'301',type:'Deluxe',checkIn:'2026-12-10',checkOut:'2026-12-12',status:'Confirmed'},
 {id:'FOH-1002',guest:'James Reyes',room:'—',type:'Standard',checkIn:'2026-12-10',checkOut:'2026-12-13',status:'Pending'},
 {id:'FOH-1003',guest:'Anna Cruz',room:'407',type:'Suite',checkIn:'2026-12-11',checkOut:'2026-12-14',status:'Checked in'},
 {id:'FOH-1004',guest:'Paolo Garcia',room:'205',type:'Deluxe',checkIn:'2026-12-12',checkOut:'2026-12-13',status:'Cancelled'},
] as const;
export const demoRooms = [
 {number:'201',type:'Standard',occupancy:'Vacant',housekeeping:'Clean',maintenance:'Available'},
 {number:'202',type:'Standard',occupancy:'Occupied',housekeeping:'Clean',maintenance:'Available'},
 {number:'203',type:'Standard',occupancy:'Vacant',housekeeping:'Dirty',maintenance:'Available'},
 {number:'301',type:'Deluxe',occupancy:'Vacant',housekeeping:'Clean',maintenance:'Available'},
 {number:'302',type:'Deluxe',occupancy:'Occupied',housekeeping:'Dirty',maintenance:'Available'},
 {number:'303',type:'Deluxe',occupancy:'Vacant',housekeeping:'Clean',maintenance:'Out of order'},
 {number:'401',type:'Suite',occupancy:'Vacant',housekeeping:'Clean',maintenance:'Available'},
 {number:'407',type:'Suite',occupancy:'Occupied',housekeeping:'Clean',maintenance:'Available'},
] as const;
