import type {HotelSettingsResponse} from '../types';
import {hotelId,rooms} from './fixtures';
const typeRates:Record<string,number>={standard:250000,deluxe:420000,suite:560000};
const types=new Map(rooms.map(room=>[room.roomTypeId,room.roomTypeName]));
const floors=[...new Set(rooms.map(r=>r.floor))].sort((a,b)=>a-b);
export const sampleHotelSettings:HotelSettingsResponse={
 data:{
  property:{id:hotelId,name:'Friendship On Hotel',address:'Sample property address — replace with verified information',contactEmail:'hello@example.test',contactPhone:'',timeZone:'Asia/Manila',currency:'PHP',checkInTime:'14:00',checkOutTime:'12:00'},
  roomTypes:[...types].map(([id,name])=>({id,name,maxOccupancy:Math.max(...rooms.filter(r=>r.roomTypeId===id).map(r=>r.maxOccupancy)),roomCount:rooms.filter(r=>r.roomTypeId===id).length,sampleRate:{amountMinor:typeRates[id]??0,currency:'PHP'}})),
  floors:floors.map(number=>({number,roomCount:rooms.filter(room=>room.floor===number).length})),
  roles:[
   {id:'administrator',name:'Administrator',description:'Example property administration role',permissionLabels:['Property setup','Staff role management','Reporting'],staffCount:1},
   {id:'front_desk',name:'Front Desk',description:'Example reception workflow role',permissionLabels:['Reservations','Guest records','Front desk'],staffCount:3},
   {id:'housekeeping',name:'Housekeeping',description:'Example room care role',permissionLabels:['Room condition','Cleaning tasks'],staffCount:4},
   {id:'maintenance',name:'Maintenance',description:'Example repair role',permissionLabels:['Work orders','Maintenance review'],staffCount:2}
  ]
 },meta:{hotelId,isPreview:true}
};
