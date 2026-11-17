import React from 'react';import ReactDOM from 'react-dom/client';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {createRootRoute,createRoute,createRouter,RouterProvider} from '@tanstack/react-router';
import {AppShell} from './components/AppShell';
import {AuthProvider} from './components/AuthProvider';import {ThemeProvider} from './components/ThemeProvider';
import {Dashboard} from './pages/Dashboard';
import {LiveDashboard} from './pages/LiveDashboard';
import {LiveRooms} from './pages/LiveRooms';
import {LiveRoomCalendar} from './pages/LiveRoomCalendar';
import {LiveSettings} from './pages/LiveSettings';
import {LiveStaff} from './pages/LiveStaff';
import {AcceptInvitation} from './pages/AcceptInvitation';
import {ForgotPassword,ResetPassword,ChangePassword} from './pages/StaffPassword';
import {LiveReservationDemand} from './pages/LiveReservationDemand';
import {LiveReservationPolicy} from './pages/LiveReservationPolicy';
import {LiveReservationSimulation} from './pages/LiveReservationSimulation';
import {dataMode} from './api';import {Reservations} from './pages/Reservations';import {Rooms} from './pages/Rooms';
import {Guests} from './pages/Guests';
import {Housekeeping} from './pages/Housekeeping';
import {LiveHousekeeping} from './pages/LiveHousekeeping';
import {Billing} from './pages/Billing';
import {FrontDesk} from './pages/FrontDesk';
import {Maintenance} from './pages/Maintenance';
import {LiveMaintenance} from './pages/LiveMaintenance';
import {Reports} from './pages/Reports';
import {Settings} from './pages/Settings';import './styles.css';
const root=createRootRoute({component:AppShell});
const index=createRoute({getParentRoute:()=>root,path:'/',component:dataMode==='api'?LiveDashboard:Dashboard});
const reservations=createRoute({getParentRoute:()=>root,path:'/reservations',
 validateSearch:(value:Record<string,unknown>):{booking?:string;guest?:string;room?:string;roomNumber?:string;checkIn?:string}=>({
  booking:typeof value.booking==='string'&&/^[1-9][0-9]*$/.test(value.booking)?value.booking:undefined,
  guest:typeof value.guest==='string'&&/^[1-9][0-9]*$/.test(value.guest)?value.guest:undefined,
  room:typeof value.room==='string'&&/^[1-9][0-9]*$/.test(value.room)?value.room:undefined,
  roomNumber:typeof value.roomNumber==='string'&&value.roomNumber.length<=32?value.roomNumber:undefined,
  checkIn:typeof value.checkIn==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value.checkIn)&&!Number.isNaN(Date.parse(value.checkIn+'T00:00:00Z'))&&new Date(value.checkIn+'T00:00:00Z').toISOString().slice(0,10)===value.checkIn?value.checkIn:undefined,
 }),component:Reservations});
const rooms=createRoute({getParentRoute:()=>root,path:'/rooms',component:dataMode==='api'?LiveRooms:Rooms});
const roomCalendar=createRoute({getParentRoute:()=>root,path:'/room-calendar',component:LiveRoomCalendar});
const functionalRoutes=[
 createRoute({getParentRoute:()=>root,path:'/front-desk',component:FrontDesk}),
 createRoute({getParentRoute:()=>root,path:'/reservation-demand',component:LiveReservationDemand}),
 createRoute({getParentRoute:()=>root,path:'/reservation-policy',component:LiveReservationPolicy}),
 createRoute({getParentRoute:()=>root,path:'/reservation-simulation',component:LiveReservationSimulation}),
 createRoute({getParentRoute:()=>root,path:'/guests',component:Guests}),
 createRoute({getParentRoute:()=>root,path:'/billing',component:Billing}),
 createRoute({getParentRoute:()=>root,path:'/housekeeping',
  validateSearch:(value:Record<string,unknown>):{task?:string}=>({
   task:typeof value.task==='string'&&/^[1-9][0-9]*$/.test(value.task)?value.task:undefined,
  }),component:dataMode==='api'?LiveHousekeeping:Housekeeping}),
 createRoute({getParentRoute:()=>root,path:'/maintenance',component:dataMode==='api'?LiveMaintenance:Maintenance}),
 createRoute({getParentRoute:()=>root,path:'/reports',component:Reports}),
 createRoute({getParentRoute:()=>root,path:'/settings',component:dataMode==='api'?LiveSettings:Settings}),
 createRoute({getParentRoute:()=>root,path:'/staff',component:LiveStaff}),
 createRoute({getParentRoute:()=>root,path:'/accept-invitation',component:AcceptInvitation}),
 createRoute({getParentRoute:()=>root,path:'/forgot-password',component:ForgotPassword}),
 createRoute({getParentRoute:()=>root,path:'/reset-password',component:ResetPassword}),
 createRoute({getParentRoute:()=>root,path:'/change-password',component:ChangePassword}),
];
const routeTree=root.addChildren([index,reservations,rooms,roomCalendar,...functionalRoutes]);
const router=createRouter({routeTree,defaultPreload:'intent'});
declare module '@tanstack/react-router'{interface Register{router:typeof router}}
const client=new QueryClient({defaultOptions:{queries:{retry:1,refetchOnWindowFocus:false}}});
ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><ThemeProvider><QueryClientProvider client={client}><AuthProvider><RouterProvider router={router}/></AuthProvider></QueryClientProvider></ThemeProvider></React.StrictMode>);
