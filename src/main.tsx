import React from 'react';import ReactDOM from 'react-dom/client';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {createRootRoute,createRoute,createRouter,RouterProvider} from '@tanstack/react-router';
import {AppShell} from './components/AppShell';
import {AuthProvider} from './components/AuthProvider';import {ThemeProvider} from './components/ThemeProvider';
import {Dashboard} from './pages/Dashboard';
import {LiveDashboard} from './pages/LiveDashboard';
import {LiveRooms} from './pages/LiveRooms';
import {LiveSettings} from './pages/LiveSettings';
import {LiveReservationDemand} from './pages/LiveReservationDemand';
import {LiveReservationPolicy} from './pages/LiveReservationPolicy';
import {LiveReservationSimulation} from './pages/LiveReservationSimulation';
import {dataMode} from './api';import {Reservations} from './pages/Reservations';import {Rooms} from './pages/Rooms';
import {Guests} from './pages/Guests';
import {Housekeeping} from './pages/Housekeeping';
import {Billing} from './pages/Billing';
import {FrontDesk} from './pages/FrontDesk';
import {Maintenance} from './pages/Maintenance';
import {Reports} from './pages/Reports';
import {Settings} from './pages/Settings';import './styles.css';
const root=createRootRoute({component:AppShell});
const index=createRoute({getParentRoute:()=>root,path:'/',component:dataMode==='api'?LiveDashboard:Dashboard});
const reservations=createRoute({getParentRoute:()=>root,path:'/reservations',component:Reservations});
const rooms=createRoute({getParentRoute:()=>root,path:'/rooms',component:dataMode==='api'?LiveRooms:Rooms});
const functionalRoutes=[
 createRoute({getParentRoute:()=>root,path:'/front-desk',component:FrontDesk}),
 createRoute({getParentRoute:()=>root,path:'/reservation-demand',component:LiveReservationDemand}),
 createRoute({getParentRoute:()=>root,path:'/reservation-policy',component:LiveReservationPolicy}),
 createRoute({getParentRoute:()=>root,path:'/reservation-simulation',component:LiveReservationSimulation}),
 createRoute({getParentRoute:()=>root,path:'/guests',component:Guests}),
 createRoute({getParentRoute:()=>root,path:'/billing',component:Billing}),
 createRoute({getParentRoute:()=>root,path:'/housekeeping',component:Housekeeping}),
 createRoute({getParentRoute:()=>root,path:'/maintenance',component:Maintenance}),
 createRoute({getParentRoute:()=>root,path:'/reports',component:Reports}),
 createRoute({getParentRoute:()=>root,path:'/settings',component:dataMode==='api'?LiveSettings:Settings}),
];
const routeTree=root.addChildren([index,reservations,rooms,...functionalRoutes]);
const router=createRouter({routeTree,defaultPreload:'intent'});
declare module '@tanstack/react-router'{interface Register{router:typeof router}}
const client=new QueryClient({defaultOptions:{queries:{retry:1,refetchOnWindowFocus:false}}});
ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><ThemeProvider><QueryClientProvider client={client}><AuthProvider><RouterProvider router={router}/></AuthProvider></QueryClientProvider></ThemeProvider></React.StrictMode>);
