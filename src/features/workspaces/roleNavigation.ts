import type {StaffHotel} from '../../api/auth';

export type HotelRole='admin'|'front_desk'|'housekeeping'|'maintenance';
export type WorkspacePath='/'|'/front-desk'|'/reservations'|'/room-calendar'|
 '/rooms'|'/guests'|'/housekeeping'|'/maintenance'|'/billing'|'/cashier-shifts'|
 '/reports'|'/operational-exceptions'|'/manager-approvals'|'/settings'|'/staff'|
 '/occupancy-verification'|'/occupancy-coverage'|'/night-audit'|'/tax-policies'|'/change-password'|'/reservation-demand'|'/reservation-policy'|'/reservation-simulation';

const allDaily:WorkspacePath[]=['/','/front-desk','/reservations','/room-calendar','/rooms','/guests','/housekeeping','/maintenance','/billing','/cashier-shifts','/occupancy-verification','/occupancy-coverage'];
const allManagement:WorkspacePath[]=['/night-audit','/tax-policies','/reports','/operational-exceptions','/manager-approvals','/settings','/staff','/change-password'];
const allAdvanced:WorkspacePath[]=['/reservation-demand','/reservation-policy','/reservation-simulation'];
const roleNav:Record<HotelRole,{daily:WorkspacePath[];management:WorkspacePath[];advanced:WorkspacePath[];label:string}>={
 admin:{daily:allDaily,management:allManagement,advanced:allAdvanced,label:'Manager'},
 front_desk:{daily:['/','/front-desk','/reservations','/room-calendar','/rooms','/guests','/billing','/cashier-shifts'],
  management:['/change-password'],advanced:[],label:'Reception'},
 housekeeping:{daily:['/','/housekeeping','/rooms','/maintenance','/occupancy-verification'],
  management:['/change-password'],advanced:[],label:'Housekeeping'},
 maintenance:{daily:['/','/maintenance','/rooms','/housekeeping'],
  management:['/change-password'],advanced:[],label:'Maintenance'},
};
export function selectedRole(hotels:StaffHotel[]|undefined,hotelId:string|null):HotelRole|null{
 const role=hotels?.find(hotel=>hotel.id===hotelId)?.role;
 return role==='admin'||role==='front_desk'||role==='housekeeping'||role==='maintenance'?role:null;
}
export function navigationForRole(role:HotelRole|null):{daily:WorkspacePath[];management:WorkspacePath[];advanced:WorkspacePath[];label:string}{
 return role?roleNav[role]:{daily:['/' as WorkspacePath],management:['/change-password' as WorkspacePath],advanced:[],label:'Staff'};
}
/** This controls presentation only. Laravel authorization remains authoritative. */
export function canDisplayAction(role:HotelRole|null,action:'new_reservation'|'assign_room'|'manage_staff'|'update_assigned_housekeeping'){
 if(action==='update_assigned_housekeeping')return role==='housekeeping'||role==='admin';
 if(action==='new_reservation'||action==='assign_room')return role==='front_desk'||role==='admin';
 return role==='admin';
}
