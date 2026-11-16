import React from 'react';import ReactDOM from 'react-dom/client';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {createRootRoute,createRoute,createRouter,RouterProvider} from '@tanstack/react-router';
import {AppShell} from './components/AppShell';import {ThemeProvider} from './components/ThemeProvider';
import {Dashboard} from './pages/Dashboard';import {Reservations} from './pages/Reservations';import {Rooms} from './pages/Rooms';import {Placeholder} from './pages/Placeholder';import './styles.css';
const root=createRootRoute({component:AppShell});
const index=createRoute({getParentRoute:()=>root,path:'/',component:Dashboard});
const reservations=createRoute({getParentRoute:()=>root,path:'/reservations',component:Reservations});
const rooms=createRoute({getParentRoute:()=>root,path:'/rooms',component:Rooms});
const pages=['/front-desk','/guests','/billing','/housekeeping','/maintenance','/reports','/settings'] as const;
const other=pages.map(path=>createRoute({getParentRoute:()=>root,path,component:()=> <Placeholder title={path.slice(1).replace('-',' ').replace(/\b\w/g,c=>c.toUpperCase())}/>}));
const routeTree=root.addChildren([index,reservations,rooms,...other]);
const router=createRouter({routeTree,defaultPreload:'intent'});
declare module '@tanstack/react-router'{interface Register{router:typeof router}}
const client=new QueryClient({defaultOptions:{queries:{retry:1,refetchOnWindowFocus:false}}});
ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><ThemeProvider><QueryClientProvider client={client}><RouterProvider router={router}/></QueryClientProvider></ThemeProvider></React.StrictMode>);
