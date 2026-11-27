import {parseGroupDetailTab} from './features/groups/groupNavigation';
import {Messages} from './pages/Messages';
import React from 'react';import ReactDOM from 'react-dom/client';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {createRootRoute,createRoute,createRouter,RouterProvider} from '@tanstack/react-router';
import {AppShell} from './components/AppShell';
import {AuthProvider} from './components/AuthProvider';import {ThemeProvider} from './components/ThemeProvider';
import {Dashboard} from './pages/Dashboard';
import {LiveDashboard} from './pages/LiveDashboard';
import {RoleHome} from './pages/RoleHome';
import {useHotelAuth} from './components/AuthProvider';
import {selectedRole} from './features/workspaces/roleNavigation';
import {LiveRooms} from './pages/LiveRooms';
import {LiveRoomCalendar} from './pages/LiveRoomCalendar';
const OperationalExceptions=React.lazy(async()=>({default:(await import('./pages/OperationalExceptions')).OperationalExceptions}));
import {ManagerApprovals} from './pages/ManagerApprovals';
import {CashierShifts} from './pages/CashierShifts';
import {MyExpenseClaims} from './pages/MyExpenseClaims';
import {Expenses} from './pages/Expenses';
import {ExpenseVoucher} from './pages/ExpenseVoucher';
import type {ExpenseView} from './pages/Expenses';
import {OccupancyVerification} from './pages/OccupancyVerification';
const OccupancyCoverageReport=React.lazy(async()=>({default:(await import('./pages/OccupancyCoverageReport')).OccupancyCoverageReport}));
const NightAuditPreview=React.lazy(async()=>({default:(await import('./pages/NightAuditPreview')).NightAuditPreview}));
const TaxPolicies=React.lazy(async()=>({default:(await import('./pages/TaxPolicies')).TaxPolicies}));
const FolioNightAccounting=React.lazy(async()=>({default:(await import('./pages/FolioNightAccounting')).FolioNightAccounting}));
import {RateCalendar} from './pages/RateCalendar';
import {LiveSettings} from './pages/LiveSettings';
import {LiveStaff} from './pages/LiveStaff';
import {AcceptInvitation} from './pages/AcceptInvitation';
import {ForgotPassword,ResetPassword,ChangePassword} from './pages/StaffPassword';
const LiveReservationDemand=React.lazy(async()=>({default:(await import('./pages/LiveReservationDemand')).LiveReservationDemand}));
const LiveReservationPolicy=React.lazy(async()=>({default:(await import('./pages/LiveReservationPolicy')).LiveReservationPolicy}));
const LiveReservationSimulation=React.lazy(async()=>({default:(await import('./pages/LiveReservationSimulation')).LiveReservationSimulation}));
import {dataMode} from './api';import {Reservations} from './pages/Reservations';
import {GroupReservations} from './pages/GroupReservations';import {Rooms} from './pages/Rooms';
import {GuestStays} from './pages/GuestStays';
import {Guests} from './pages/Guests';
import {Housekeeping} from './pages/Housekeeping';
import {LiveHousekeeping} from './pages/LiveHousekeeping';
import {Billing} from './pages/Billing';
import {FrontDesk} from './pages/FrontDesk';
import {Maintenance} from './pages/Maintenance';
import {LiveMaintenance} from './pages/LiveMaintenance';
import {LostFound} from './pages/LostFound';
const Reports=React.lazy(async()=>({default:(await import('./pages/Reports')).Reports}));
import {Settings} from './pages/Settings';import './styles.css';
import {normalizeBillingBookingId} from './features/billing/bookingLink';
const root=createRootRoute({component:AppShell});
function Home(){const {user,hotelId}=useHotelAuth();
 return selectedRole(user?.hotels,hotelId)==='admin'?<LiveDashboard/>:<RoleHome/>;
}
const index=createRoute({getParentRoute:()=>root,path:'/',component:dataMode==='api'?Home:Dashboard});
const reservations=createRoute({getParentRoute:()=>root,path:'/reservations',
 validateSearch:(value:Record<string,unknown>):{booking?:string;mode?:'new';guest?:string;room?:string;roomNumber?:string;checkIn?:string;checkOut?:string;deskAction?:'assign'|'check-in'|'check-out'|'extend';group?:string;hotel?:string;push?:string}=>({
  push:normalizeBillingBookingId(value.push)==='1'?'1':undefined,
  booking:(()=>{const raw=typeof value.booking==='string'?value.booking.trim():String(typeof value.booking==='number'?value.booking:'');
   const normalized=raw.replace(/^\"([1-9][0-9]*)\"$/,'$1');
   return /^[1-9][0-9]*$/.test(normalized)?normalized:undefined;
  })(),
  mode:value.mode==='new'?'new':undefined,
  guest:typeof value.guest==='string'&&/^[1-9][0-9]*$/.test(value.guest)?value.guest:undefined,
  room:typeof value.room==='string'&&/^[1-9][0-9]*$/.test(value.room)?value.room:undefined,
  roomNumber:typeof value.roomNumber==='string'&&value.roomNumber.length<=32?value.roomNumber:undefined,
  deskAction:value.deskAction==='assign'||value.deskAction==='check-in'||value.deskAction==='check-out'||value.deskAction==='extend'?value.deskAction:undefined,
  group:typeof value.group==='string'&&/^[1-9][0-9]*$/.test(value.group)?value.group:undefined,
  hotel:normalizeBillingBookingId(value.hotel),
  checkIn:typeof value.checkIn==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value.checkIn)&&!Number.isNaN(Date.parse(value.checkIn+'T00:00:00Z'))&&new Date(value.checkIn+'T00:00:00Z').toISOString().slice(0,10)===value.checkIn?value.checkIn:undefined,
  checkOut:typeof value.checkOut==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value.checkOut)&&!Number.isNaN(Date.parse(value.checkOut+'T00:00:00Z'))&&new Date(value.checkOut+'T00:00:00Z').toISOString().slice(0,10)===value.checkOut?value.checkOut:undefined,
 }),component:Reservations});
const groupReservations=createRoute({getParentRoute:()=>root,path:'/group-reservations',
 validateSearch:(value:Record<string,unknown>):{group?:string;tab?:'rooms'|'billing'|'activity';hotel?:string}=>({
  group:typeof value.group==='string'&&/^[1-9][0-9]*$/.test(value.group)?value.group:undefined,
  tab:parseGroupDetailTab(value.tab),
  hotel:normalizeBillingBookingId(value.hotel),
 }),component:GroupReservations});
const rooms=createRoute({getParentRoute:()=>root,path:'/rooms',
 validateSearch:(value:Record<string,unknown>):{room?:string;inspect?:boolean;hotel?:string;push?:string}=>({
  hotel:normalizeBillingBookingId(value.hotel),push:normalizeBillingBookingId(value.push)==='1'?'1':undefined,
  inspect:value.inspect===true?true:undefined,
  room:(typeof value.room==='string'||typeof value.room==='number')&&String(value.room).trim().length<=50
   ?String(value.room).trim()||undefined:undefined,
 }),
 component:dataMode==='api'?LiveRooms:Rooms});
const roomCalendar=createRoute({getParentRoute:()=>root,path:'/room-calendar',
 validateSearch:(value:Record<string,unknown>):{date?:string;end?:string;group?:string;hotel?:string;room?:string;push?:string}=>({
  push:normalizeBillingBookingId(value.push)==='1'?'1':undefined,
  room:(typeof value.room==='string'||typeof value.room==='number')&&/^[A-Za-z0-9_-]{1,32}$/.test(String(value.room))?String(value.room):undefined,
  date:typeof value.date==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value.date)
    &&!Number.isNaN(Date.parse(value.date+'T00:00:00Z'))
    &&new Date(value.date+'T00:00:00Z').toISOString().slice(0,10)===value.date
     ?value.date:undefined,
  group:typeof value.group==='string'&&/^[1-9][0-9]*$/.test(value.group)?value.group:undefined,
  end:typeof value.end==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value.end)
    &&!Number.isNaN(Date.parse(value.end+'T00:00:00Z'))
    &&new Date(value.end+'T00:00:00Z').toISOString().slice(0,10)===value.end
     ?value.end:undefined,
  hotel:normalizeBillingBookingId(value.hotel),
 }),component:LiveRoomCalendar});
const functionalRoutes=[
 createRoute({getParentRoute:()=>root,path:'/messages',validateSearch:(value:Record<string,unknown>):{conversation?:string;hotel?:string;push?:string}=>({conversation:normalizeBillingBookingId(value.conversation),hotel:normalizeBillingBookingId(value.hotel),push:normalizeBillingBookingId(value.push)==='1'?'1':undefined}),component:Messages}),
 createRoute({getParentRoute:()=>root,path:'/my-expense-claims',component:MyExpenseClaims}),
 createRoute({getParentRoute:()=>root,path:'/expenses',component:Expenses,
 validateSearch:(value:Record<string,unknown>):{expense?:string;date?:string;hotel?:string;tab?:ExpenseView;push?:string}=>({
 push:normalizeBillingBookingId(value.push)==='1'?'1':undefined,
 tab:value.tab==='bills'||value.tab==='suppliers'||value.tab==='reimbursements'?value.tab:undefined,
 expense:normalizeBillingBookingId(value.expense),
 hotel:normalizeBillingBookingId(value.hotel),
 date:typeof value.date==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value.date)?value.date:undefined,
 })}),
 createRoute({getParentRoute:()=>root,path:'/expenses/$expenseId',component:ExpenseVoucher,
 validateSearch:(value:Record<string,unknown>):{date?:string;hotel?:string}=>({
  hotel:normalizeBillingBookingId(value.hotel),
  date:typeof value.date==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value.date)?value.date:undefined,
 })}),
 createRoute({getParentRoute:()=>root,path:'/front-desk',
  validateSearch:(value:Record<string,unknown>):{queue?:'arrivals'|'departures'|'in_house'|'overdue'}=>({
   queue:value.queue==='arrivals'||value.queue==='departures'||value.queue==='in_house'||value.queue==='overdue'?value.queue:undefined,
  }),
  component:FrontDesk}),
 createRoute({getParentRoute:()=>root,path:'/operational-exceptions',component:OperationalExceptions}),
 createRoute({getParentRoute:()=>root,path:'/manager-approvals',validateSearch:(value:Record<string,unknown>):{approval?:string;hotel?:string;push?:string}=>({approval:normalizeBillingBookingId(value.approval),hotel:normalizeBillingBookingId(value.hotel),push:normalizeBillingBookingId(value.push)==='1'?'1':undefined}),component:ManagerApprovals}),
 createRoute({getParentRoute:()=>root,path:'/cashier-shifts',
  validateSearch:(value:Record<string,unknown>):{booking?:string;hotel?:string;shift?:string;push?:string}=>({
   push:normalizeBillingBookingId(value.push)==='1'?'1':undefined,
   booking:normalizeBillingBookingId(value.booking),
   hotel:normalizeBillingBookingId(value.hotel),
   shift:normalizeBillingBookingId(value.shift),
  }),component:CashierShifts}),
 createRoute({getParentRoute:()=>root,path:'/occupancy-verification',
  validateSearch:(value:Record<string,unknown>):{room?:string;date?:string}=>({
   room:typeof value.room==='string'&&/^[1-9][0-9]*$/.test(value.room)?value.room:undefined,
   date:typeof value.date==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value.date)?value.date:undefined,
  }),component:OccupancyVerification}),
 createRoute({getParentRoute:()=>root,path:'/occupancy-coverage',component:OccupancyCoverageReport}),
 createRoute({getParentRoute:()=>root,path:'/night-audit',validateSearch:(value:Record<string,unknown>):{date?:string;hotel?:string;push?:string}=>({date:typeof value.date==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value.date)&&!Number.isNaN(Date.parse(value.date+'T00:00:00Z'))&&new Date(value.date+'T00:00:00Z').toISOString().slice(0,10)===value.date?value.date:undefined,hotel:normalizeBillingBookingId(value.hotel),push:normalizeBillingBookingId(value.push)==='1'?'1':undefined}),component:NightAuditPreview}),
 createRoute({getParentRoute:()=>root,path:'/rate-calendar',component:RateCalendar}),
 createRoute({getParentRoute:()=>root,path:'/tax-policies',component:TaxPolicies}),
 createRoute({getParentRoute:()=>root,path:'/folio-night-accounting',component:FolioNightAccounting}),
 createRoute({getParentRoute:()=>root,path:'/reservation-demand',component:LiveReservationDemand}),
 createRoute({getParentRoute:()=>root,path:'/reservation-policy',component:LiveReservationPolicy}),
 createRoute({getParentRoute:()=>root,path:'/reservation-simulation',component:LiveReservationSimulation}),
 createRoute({getParentRoute:()=>root,path:'/guests',component:Guests}),
 createRoute({getParentRoute:()=>root,path:'/guests/$guestId/stays',component:GuestStays}),
 createRoute({getParentRoute:()=>root,path:'/billing',
  validateSearch:(value:Record<string,unknown>):{booking?:string;payment?:string;action?:'signoff'|'no-show';group?:string;hotel?:string;checkIn?:string;checkOut?:string;push?:string}=>({
   push:normalizeBillingBookingId(value.push)==='1'?'1':undefined,
   booking:normalizeBillingBookingId(value.booking),
   payment:normalizeBillingBookingId(value.payment),
   action:value.action==='signoff'||value.action==='no-show'?value.action:undefined,
   group:typeof value.group==='string'&&/^[1-9][0-9]*$/.test(value.group)?value.group:undefined,
   hotel:normalizeBillingBookingId(value.hotel),
   checkIn:typeof value.checkIn==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value.checkIn)?value.checkIn:undefined,
   checkOut:typeof value.checkOut==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value.checkOut)?value.checkOut:undefined,
  }),component:Billing}),
 createRoute({getParentRoute:()=>root,path:'/housekeeping',
  validateSearch:(value:Record<string,unknown>):{task?:string;hotel?:string;push?:string;queue?:'active'|'arrival_today'|'overdue'|'pending_inspection';status?:'todo'|'in_progress'|'done'}=>({
   hotel:normalizeBillingBookingId(value.hotel),push:normalizeBillingBookingId(value.push)==='1'?'1':undefined,
   task:normalizeBillingBookingId(value.task),
   queue:value.queue==='active'||value.queue==='arrival_today'||value.queue==='overdue'||value.queue==='pending_inspection'?value.queue:undefined,
   status:value.status==='todo'||value.status==='in_progress'||value.status==='done'?value.status:undefined,
  }),component:dataMode==='api'?LiveHousekeeping:Housekeeping}),
 createRoute({getParentRoute:()=>root,path:'/lost-found',component:LostFound,validateSearch:(value:Record<string,unknown>):{room?:string;item?:string;hotel?:string;push?:string}=>({room:normalizeBillingBookingId(value.room),item:normalizeBillingBookingId(value.item),hotel:normalizeBillingBookingId(value.hotel),push:normalizeBillingBookingId(value.push)==='1'?'1':undefined})}),
 createRoute({getParentRoute:()=>root,path:'/maintenance',
  validateSearch:(value:Record<string,unknown>):{order?:string;hotel?:string;push?:string}=>({
   hotel:normalizeBillingBookingId(value.hotel),push:normalizeBillingBookingId(value.push)==='1'?'1':undefined,
   order:normalizeBillingBookingId(value.order),
  }),component:dataMode==='api'?LiveMaintenance:Maintenance}),
 createRoute({getParentRoute:()=>root,path:'/reports',component:Reports}),
 createRoute({getParentRoute:()=>root,path:'/settings',component:dataMode==='api'?LiveSettings:Settings}),
 createRoute({getParentRoute:()=>root,path:'/staff',component:LiveStaff}),
 createRoute({getParentRoute:()=>root,path:'/accept-invitation',component:AcceptInvitation}),
 createRoute({getParentRoute:()=>root,path:'/forgot-password',component:ForgotPassword}),
 createRoute({getParentRoute:()=>root,path:'/reset-password',component:ResetPassword}),
 createRoute({getParentRoute:()=>root,path:'/change-password',component:ChangePassword}),
];
const routeTree=root.addChildren([index,reservations,groupReservations,rooms,roomCalendar,...functionalRoutes]);
const router=createRouter({routeTree,defaultPreload:'intent'});
declare module '@tanstack/react-router'{interface Register{router:typeof router}}
const client=new QueryClient({defaultOptions:{queries:{retry:1,refetchOnWindowFocus:false}}});
ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><ThemeProvider><QueryClientProvider client={client}><AuthProvider><RouterProvider router={router}/></AuthProvider></QueryClientProvider></ThemeProvider></React.StrictMode>);
