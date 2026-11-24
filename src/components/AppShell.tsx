import {StaffNotifications} from './StaffNotifications';
import {Link,Outlet,useRouterState} from '@tanstack/react-router';
import {LayoutDashboard,CalendarDays,CalendarRange,BedDouble,Users,Wallet,ClipboardCheck,Wrench,ChartNoAxesCombined,Settings,Sun,Moon,Menu,X,Hotel,LogOut,ArrowRight,ChevronDown,ShieldCheck,ShieldAlert,ClipboardList,Receipt} from 'lucide-react';
import {Suspense,useEffect,useState} from 'react';
import {useTheme} from './ThemeProvider';
import {dataMode} from '../api';
import {useHotelAuth} from './AuthProvider';
import {StaffSignIn} from './StaffSignIn';
import {HotelChooser} from './HotelChooser';
import {ChangePassword} from '../pages/StaffPassword';
import {selectedRole,navigationForRole,canViewWorkspacePath} from '../features/workspaces/roleNavigation';

const daily=[
 {to:'/' as const,label:'Overview',icon:LayoutDashboard},
 {to:'/front-desk' as const,label:'Front desk',icon:Hotel},
 {to:'/reservations' as const,label:'Bookings',icon:CalendarDays},
 {to:'/group-reservations' as const,label:'Group Bookings',icon:CalendarRange},
 {to:'/room-calendar' as const,label:'Room calendar',icon:CalendarRange},
 {to:'/rooms' as const,label:'Rooms & readiness',icon:BedDouble},
 {to:'/guests' as const,label:'Guests',icon:Users},
 {to:'/housekeeping' as const,label:'Housekeeping',icon:ClipboardCheck},
 {to:'/maintenance' as const,label:'Maintenance',icon:Wrench},
 {to:'/billing' as const,label:'Billing',icon:Wallet},
 {to:'/cashier-shifts' as const,label:'Cashier shifts',icon:Wallet},
 {to:'/occupancy-verification' as const,label:'Occupancy checks',icon:ClipboardCheck},
 {to:'/occupancy-coverage' as const,label:'Occupancy report',icon:ClipboardList},
];
const primaryPaths=['/','/front-desk','/reservations','/group-reservations','/room-calendar','/rooms','/billing'];
const primaryDaily=daily.filter(item=>primaryPaths.includes(item.to));
const secondaryDaily=daily.filter(item=>!primaryPaths.includes(item.to));
const administration=[
 {to:'/my-expense-claims' as const,label:'My expense claims',icon:Receipt},
 {to:'/expenses' as const,label:'Expenses',icon:Receipt},
 {to:'/night-audit' as const,label:'Daily Closing',icon:ClipboardCheck},
 {to:'/tax-policies' as const,label:'Tax configuration',icon:Wallet},
 {to:'/folio-night-accounting' as const,label:'Nightly Room Charges',icon:ClipboardList},
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
 if(pathname==='/night-audit')return 'DAILY OPERATIONS & FINANCE';
 if(pathname==='/billing')return 'PARTIAL LIVE · REVIEW';
 return 'LIVE HOTEL DATA';
}
export function AppShell(){
 const {theme,toggle}=useTheme();
 const {user,hotelId,selectHotel,signOut,pending}=useHotelAuth();
 const [open,setOpen]=useState(false);
 const [showAdvanced,setShowAdvanced]=useState(false);
 const [showMoreOperations,setShowMoreOperations]=useState(false);
 const pathname=useRouterState({select:s=>s.location.pathname});
 const current=pathname.startsWith('/guests/')?'Customer stays':pathname.startsWith('/expenses/')?'Expense voucher':all.find(item=>item.to===pathname)?.label??'Overview';
 const role=selectedRole(user?.hotels,hotelId);
 const effectivePermissions=user?.hotels.find(h=>h.id===hotelId)?.permissions;
 const workspace=navigationForRole(role);
 const admin=role==='admin';
 useEffect(()=>{setOpen(false);},[pathname,hotelId]);
 if(dataMode==='api'&&!user&&['/forgot-password','/reset-password','/accept-invitation'].includes(pathname))return <Outlet/>;
 if(dataMode==='api'&&pending&&!user)
  return <div className="auth-shell"><div className="auth-card"><p role="status">Checking your staff session…</p></div></div>;
 if(dataMode==='api'&&!user)return <StaffSignIn/>;
 if(dataMode==='api'&&user?.mustChangePassword)return <div className="app-layout">
  <main className="main-area">
   <div className="page-content">
    <div className="notice" role="alert"><strong>Initial password change required.</strong> Your hotel administrator created this account with a temporary password. Choose a private new password before accessing any hotel records.</div>
    <ChangePassword/>
   </div>
  </main>
 </div>;
 if(dataMode==='api'&&user&&!hotelId&&pathname==='/change-password')return <Outlet/>;
 if(dataMode==='api'&&!hotelId)return <HotelChooser/>;

 const renderNav=(items:readonly NavItem[],section:'daily'|'management'|'advanced')=>items
  .filter(item=>dataMode==='api'||!['/change-password','/staff','/expenses','/my-expense-claims'].includes(item.to))
  .filter(item=>dataMode!=='api'||(
   canViewWorkspacePath(role,item.to,effectivePermissions)&&(
   section==='daily'?workspace.daily.includes(item.to):
   section==='management'?workspace.management.includes(item.to):
   workspace.advanced.includes(item.to))))
  .map(({to,label,icon:Icon})=><Link key={to} to={to} activeOptions={{exact:true}}
   aria-current={pathname===to?'page':undefined}
   className={'nav-link'+(pathname===to||to==='/expenses'&&pathname.startsWith('/expenses/')?' active':'')}>
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
    {renderNav(primaryDaily,'daily')}
    {(dataMode==='mock'||secondaryDaily.some(item=>workspace.daily.includes(item.to)))&&<>
     <button type="button" className="nav-link nav-expand"
      aria-expanded={showMoreOperations||secondaryDaily.some(item=>item.to===pathname)}
      onClick={()=>setShowMoreOperations(v=>!v)}>
      <ChevronDown size={17} className={showMoreOperations?'nav-chevron-open':''}/>
      <span>More operations</span>
     </button>
     {(showMoreOperations||secondaryDaily.some(item=>item.to===pathname))&&
      <div className="nav-nested">{renderNav(secondaryDaily,'daily')}</div>}
    </>}
    <p className="nav-heading nav-section">{admin||dataMode==='mock'?'MANAGEMENT':'ACCOUNT'}</p>
    {renderNav(administration,'management')}
    {dataMode==='api'&&workspace.advanced.length>0&&<>
     <button type="button" className="nav-link nav-expand" aria-expanded={showAdvanced||advanced.some(item=>item.to===pathname)}
      onClick={()=>setShowAdvanced(v=>!v)}>
      <ChevronDown size={17} className={showAdvanced?'nav-chevron-open':''}/>
      <span>Advanced tools</span>
     </button>
     {(showAdvanced||advanced.some(item=>item.to===pathname))&&<div className="nav-nested">
      {renderNav(advanced,'advanced')}
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
     <div className="topbar-heading"><span className="eyebrow">FRIENDSHIP ON HOTEL</span><h1>{current}</h1></div>
    </div>
    <div className="topbar-actions">
     {dataMode==='api'&&user&&<label className="hotel-context-select">Property
      <select aria-label="Selected hotel" value={hotelId??''} onChange={e=>selectHotel(e.target.value)}>
       {user.hotels.map(h=><option key={h.id} value={h.id}>{h.name}</option>)}
      </select>
     </label>}
     <span className="demo-pill" role="status">{experienceForPath(pathname,dataMode)}</span>
     <button className="icon-btn topbar-action-theme" type="button" aria-label={theme==='light'?'Switch to dark mode':'Switch to light mode'} onClick={toggle}>
      {theme==='light'?<Moon size={19}/>:<Sun size={19}/>}
     </button>
     {dataMode==='api'&&hotelId&&user&&(role==='admin'||role==='front_desk')&&
      <StaffNotifications key={user.id+':'+hotelId} userId={user.id} hotelId={hotelId}/>}
     {dataMode==='api'
      ?<button className="icon-btn topbar-action-signout" type="button" aria-label="Sign out" title="Sign out" disabled={pending} onClick={()=>void signOut()}><LogOut size={18}/></button>
      :<div className="topbar-avatar" aria-label="Demo user">FO</div>}
    </div>
   </header>
   {dataMode==='api'&&<div className="workflow-shortcuts" aria-label="Related actions">
    <span>RELATED</span>
    {pathname==='/group-reservations'?<>
     {(role==='admin'||role==='front_desk')&&canViewWorkspacePath(role,'/reservations',effectivePermissions)&&<Link to="/reservations">Bookings <ArrowRight size={13}/></Link>}
     {canViewWorkspacePath(role,'/room-calendar',effectivePermissions)&&<Link to="/room-calendar">Room calendar <ArrowRight size={13}/></Link>}
     {(role==='admin'||role==='front_desk')&&canViewWorkspacePath(role,'/front-desk',effectivePermissions)&&<Link to="/front-desk">Front desk <ArrowRight size={13}/></Link>}
    </>:pathname==='/room-calendar'?<>
     {canViewWorkspacePath(role,'/group-reservations',effectivePermissions)&&<Link to="/group-reservations">Group Bookings <ArrowRight size={13}/></Link>}
     {canViewWorkspacePath(role,'/reservations',effectivePermissions)&&<Link to="/reservations">Bookings <ArrowRight size={13}/></Link>}
     {canViewWorkspacePath(role,'/rooms',effectivePermissions)&&<Link to="/rooms">Room readiness <ArrowRight size={13}/></Link>}
    </>:pathname==='/billing'?<>
     {canViewWorkspacePath(role,'/group-reservations',effectivePermissions)&&<Link to="/group-reservations">Group Bookings <ArrowRight size={13}/></Link>}
     {canViewWorkspacePath(role,'/reservations',effectivePermissions)&&<Link to="/reservations">Bookings <ArrowRight size={13}/></Link>}
     {(role==='admin'||role==='front_desk')&&canViewWorkspacePath(role,'/cashier-shifts',effectivePermissions)&&<Link to="/cashier-shifts">Cashier shifts <ArrowRight size={13}/></Link>}
    </>:pathname==='/housekeeping'?<>
     {canViewWorkspacePath(role,'/rooms',effectivePermissions)&&<Link to="/rooms">Room readiness <ArrowRight size={13}/></Link>}
     {admin&&canViewWorkspacePath(role,'/operational-exceptions',effectivePermissions)&&<Link to="/operational-exceptions">Exceptions & audit <ArrowRight size={13}/></Link>}
    </>:<>
     {(role==='admin'||role==='front_desk')&&canViewWorkspacePath(role,'/front-desk',effectivePermissions)&&<Link to="/front-desk">Front desk <ArrowRight size={13}/></Link>}
     {(role==='admin'||role==='front_desk')&&canViewWorkspacePath(role,'/reservations',effectivePermissions)&&<Link to="/reservations">Bookings <ArrowRight size={13}/></Link>}
     {(role==='admin'||role==='front_desk')&&canViewWorkspacePath(role,'/group-reservations',effectivePermissions)&&<Link to="/group-reservations">Group Bookings <ArrowRight size={13}/></Link>}
     {(role==='admin'||role==='front_desk')&&canViewWorkspacePath(role,'/room-calendar',effectivePermissions)&&<Link to="/room-calendar">Room calendar <ArrowRight size={13}/></Link>}
     {role==='housekeeping'&&canViewWorkspacePath(role,'/housekeeping',effectivePermissions)&&<Link to="/housekeeping">Cleaning tasks <ArrowRight size={13}/></Link>}
     {role==='maintenance'&&canViewWorkspacePath(role,'/maintenance',effectivePermissions)&&<Link to="/maintenance">Work orders <ArrowRight size={13}/></Link>}
    </>}
   </div>}
   <div className="page-content">
    {dataMode==='api'&&!canViewWorkspacePath(role,pathname,effectivePermissions)
     ?<section className="panel" role="alert" aria-label="Page access denied">
       <h2>Page not available for your role</h2>
       <p>Your {workspace.label.toLowerCase()} account cannot open this page. Ask a hotel manager if your duties require access.</p>
       <Link className="btn-primary" to="/">Return to your workspace <ArrowRight size={15}/></Link>
      </section>
     :<Suspense fallback={<div role="status" className="workspace-loading">Loading hotel workspace…</div>}><Outlet/></Suspense>}
   </div>
  </main>
 </div>;
}
