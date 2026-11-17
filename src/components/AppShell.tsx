import {Link,Outlet,useRouterState} from '@tanstack/react-router';
import {LayoutDashboard,CalendarDays,CalendarRange,BedDouble,Users,Wallet,ClipboardCheck,Wrench,ChartNoAxesCombined,Settings,Bell,Sun,Moon,Menu,X,Hotel,LogOut,ArrowRight,ChevronDown,ShieldCheck,ShieldAlert,ClipboardList,KeyRound} from 'lucide-react';
import {useEffect,useState} from 'react';
import {useTheme} from './ThemeProvider';
import {dataMode} from '../api';
import {useHotelAuth} from './AuthProvider';
import {StaffSignIn} from './StaffSignIn';
import {HotelChooser} from './HotelChooser';
import {selectedRole,navigationForRole} from '../features/workspaces/roleNavigation';

const daily=[
 {to:'/' as const,label:'Overview',icon:LayoutDashboard},
 {to:'/front-desk' as const,label:'Front desk',icon:Hotel},
 {to:'/reservations' as const,label:'Reservations',icon:CalendarDays},
 {to:'/room-calendar' as const,label:'Room calendar',icon:CalendarRange},
 {to:'/rooms' as const,label:'Rooms & readiness',icon:BedDouble},
 {to:'/guests' as const,label:'Guests',icon:Users},
 {to:'/housekeeping' as const,label:'Housekeeping',icon:ClipboardCheck},
 {to:'/maintenance' as const,label:'Maintenance',icon:Wrench},
 {to:'/billing' as const,label:'Billing',icon:Wallet},
 {to:'/cashier-shifts' as const,label:'Cashier shifts',icon:Wallet},
 {to:'/occupancy-verification' as const,label:'Occupancy checks',icon:ClipboardCheck},
 {to:'/keycard-access' as const,label:'Keycard requests',icon:KeyRound},
];
const administration=[
 {to:'/reports' as const,label:'Reports',icon:ChartNoAxesCombined},
 {to:'/operational-exceptions' as const,label:'Exceptions & audit',icon:ShieldAlert},
 {to:'/manager-approvals' as const,label:'Manager approvals',icon:ClipboardList},
 {to:'/settings' as const,label:'Hotel settings',icon:Settings},
 {to:'/staff' as const,label:'Staff access',icon:Users},
 {to:'/change-password' as const,label:'Account security',icon:ShieldCheck},
];
const advanced=[
 {to:'/reservation-demand' as const,label:'Demand diagnostic',icon:CalendarDays},
 {to:'/reservation-policy' as const,label:'Booking policy drafts',icon:Settings},
 {to:'/reservation-simulation' as const,label:'Stay simulator',icon:CalendarDays},
];
const all=[...daily,...administration,...advanced];
type NavItem=(typeof all)[number];
export function experienceForPath(pathname:string,mode:typeof dataMode){
 if(mode==='mock')return 'DESIGN PREVIEW';
 if(pathname==='/reservation-simulation')return 'SIMULATION · NO WRITES';
 if(pathname==='/reservation-policy')return 'POLICY DRAFT';
 if(pathname==='/reservation-demand')return 'DIAGNOSTIC';
 if(pathname==='/reports')return 'PREVIEW REPORT';
 if(pathname==='/billing')return 'PARTIAL LIVE · REVIEW';
 return 'LIVE HOTEL DATA';
}
export function AppShell(){
 const {theme,toggle}=useTheme();
 const {user,hotelId,selectHotel,signOut,pending}=useHotelAuth();
 const [open,setOpen]=useState(false);
 const [showAdvanced,setShowAdvanced]=useState(false);
 const pathname=useRouterState({select:s=>s.location.pathname});
 const current=all.find(item=>item.to===pathname)?.label??'Overview';
 const role=selectedRole(user?.hotels,hotelId);
 const workspace=navigationForRole(role);
 const admin=role==='admin';
 useEffect(()=>{setOpen(false);},[pathname,hotelId]);
 if(dataMode==='api'&&!user&&['/forgot-password','/reset-password','/accept-invitation'].includes(pathname))return <Outlet/>;
 if(dataMode==='api'&&pending&&!user)
  return <div className="auth-shell"><div className="auth-card"><p role="status">Checking your staff session…</p></div></div>;
 if(dataMode==='api'&&!user)return <StaffSignIn/>;
 if(dataMode==='api'&&user&&!hotelId&&pathname==='/change-password')return <Outlet/>;
 if(dataMode==='api'&&!hotelId)return <HotelChooser/>;

 const renderNav=(items:readonly NavItem[])=>items
  .filter(item=>dataMode==='api'||!['/change-password','/staff'].includes(item.to))
  .filter(item=>dataMode!=='api'||(
   items===daily?workspace.daily.includes(item.to):
   items===administration?workspace.management.includes(item.to):
   workspace.advanced.includes(item.to)))
  .map(({to,label,icon:Icon})=><Link key={to} to={to} activeOptions={{exact:true}}
   aria-current={pathname===to?'page':undefined}
   className={'nav-link'+(pathname===to?' active':'')}>
   <Icon size={18} aria-hidden="true"/><span>{label}</span>
  </Link>);

 return <div className="app-layout">
  {open&&<button className="mobile-overlay" aria-label="Close navigation" onClick={()=>setOpen(false)}/>}
  <aside className={'sidebar'+(open?' sidebar-open':'')}>
   <div className="brand"><div className="brand-mark">FO</div>
    <div><strong>FRIENDSHIP</strong><span>ON HOTEL · PMS</span></div>
    <button className="close-mobile" aria-label="Close menu" onClick={()=>setOpen(false)}><X size={20}/></button>
   </div>
   <nav aria-label="Hotel workspace navigation" className="workspace-nav">
    <p className="nav-heading">{dataMode==='api'?workspace.label.toUpperCase()+' WORKSPACE':'DAILY OPERATIONS'}</p>
    {renderNav(daily)}
    <p className="nav-heading nav-section">{admin||dataMode==='mock'?'MANAGEMENT':'ACCOUNT'}</p>
    {renderNav(administration)}
    {dataMode==='api'&&workspace.advanced.length>0&&<>
     <button type="button" className="nav-link nav-expand" aria-expanded={showAdvanced||advanced.some(item=>item.to===pathname)}
      onClick={()=>setShowAdvanced(v=>!v)}>
      <ChevronDown size={17} className={showAdvanced?'nav-chevron-open':''}/>
      <span>Advanced tools</span>
     </button>
     {(showAdvanced||advanced.some(item=>item.to===pathname))&&<div className="nav-nested">
      {renderNav(advanced)}
     </div>}
    </>}
   </nav>
   <div className="sidebar-footer"><div className="avatar">FO</div>
    <div><strong>{dataMode==='api'?user?.name:'Demo workspace'}</strong>
     <span>{dataMode==='api'?workspace.label+' workspace':'Design preview only'}</span>
    </div>
   </div>
  </aside>
  <main className="main-area">
   <header className="topbar">
    <div className="topbar-left">
     <button className="icon-btn mobile-menu" type="button" onClick={()=>setOpen(true)} aria-label="Open navigation"><Menu size={20}/></button>
     <div><span className="eyebrow">FRIENDSHIP ON HOTEL</span><h1>{current}</h1></div>
    </div>
    <div className="topbar-actions">
     {dataMode==='api'&&user&&<label className="hotel-context-select">Property
      <select aria-label="Selected hotel" value={hotelId??''} onChange={e=>selectHotel(e.target.value)}>
       {user.hotels.map(h=><option key={h.id} value={h.id}>{h.name}</option>)}
      </select>
     </label>}
     <span className="demo-pill" role="status">{experienceForPath(pathname,dataMode)}</span>
     <button className="icon-btn" type="button" aria-label={theme==='light'?'Switch to dark mode':'Switch to light mode'} onClick={toggle}>
      {theme==='light'?<Moon size={19}/>:<Sun size={19}/>}
     </button>
     <button className="icon-btn" disabled title="Notifications not connected" aria-label="Notifications unavailable"><Bell size={19}/></button>
     {dataMode==='api'
      ?<button className="icon-btn" type="button" aria-label="Sign out" title="Sign out" disabled={pending} onClick={()=>void signOut()}><LogOut size={18}/></button>
      :<div className="topbar-avatar" aria-label="Demo user">FO</div>}
    </div>
   </header>
   {dataMode==='api'&&<div className="workflow-shortcuts" aria-label="Quick actions">
    <span>QUICK ACTIONS</span>
    {(role==='admin'||role==='front_desk')&&<Link to="/front-desk">Today's front desk <ArrowRight size={13}/></Link>}
    {role==='admin'&&<Link to="/reservations">Manage bookings <ArrowRight size={13}/></Link>}
    {(role==='admin'||role==='front_desk')&&<Link to="/room-calendar">Room calendar <ArrowRight size={13}/></Link>}
    {(role==='admin'||role==='housekeeping'||role==='maintenance')&&<Link to="/housekeeping">Cleaning tasks <ArrowRight size={13}/></Link>}
    <Link to="/rooms">Room readiness <ArrowRight size={13}/></Link>
    {role==='maintenance'&&<Link to="/maintenance">Work orders <ArrowRight size={13}/></Link>}
    {admin&&<Link to="/operational-exceptions">Exceptions & audit <ArrowRight size={13}/></Link>}
    {admin&&<Link to="/manager-approvals">Review approvals <ArrowRight size={13}/></Link>}
    {(role==='admin'||role==='front_desk')&&<Link to="/cashier-shifts">Cash drawer <ArrowRight size={13}/></Link>}
    {(role==='admin'||role==='housekeeping')&&<Link to="/occupancy-verification">Occupancy checks <ArrowRight size={13}/></Link>}
    {(role==='admin'||role==='front_desk')&&<Link to="/keycard-access">Keycard requests <ArrowRight size={13}/></Link>}
   </div>}
   <div className="page-content"><Outlet/></div>
  </main>
 </div>;
}
