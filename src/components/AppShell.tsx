import {useStaffRealtime} from '../features/messages/useStaffRealtime';
import {useMessageInbox} from '../pages/Messages';
import {MessageArrivalAlert} from './MessageArrivalAlert';
import {MessageCircle,Home,UserRound} from 'lucide-react';
import '../features/housekeeping/minimalMobile.css';
import './FloatingMessages.css';
import './AdminTopbar.css';
import {requestedNotificationHotel} from '../features/notifications/pushNavigation';
import {StaffNotifications} from './StaffNotifications';
import {HousekeepingInstallHelp} from './HousekeepingInstallHelp';
import {Link,Outlet,useNavigate,useRouterState} from '@tanstack/react-router';
import {LayoutDashboard,CalendarDays,CalendarRange,BedDouble,Users,Wallet,ClipboardCheck,Wrench,ChartNoAxesCombined,Settings,Sun,Moon,Menu,X,Hotel,LogOut,ArrowRight,ChevronDown,ShieldCheck,ShieldAlert,ClipboardList,Receipt,Search} from 'lucide-react';
import {Suspense,useEffect,useRef,useState,type KeyboardEvent} from 'react';
import {useTheme} from './ThemeProvider';
import {dataMode} from '../api';
import {useHotelAuth} from './AuthProvider';
import {StaffSignIn} from './StaffSignIn';
import {HotelChooser} from './HotelChooser';
import {ChangePassword} from '../pages/StaffPassword';
import {selectedRole,navigationForRole,canViewWorkspacePath} from '../features/workspaces/roleNavigation';

const daily=[
 {to:'/messages' as const,label:'Messages',icon:MessageCircle},
 {to:'/' as const,label:'Overview',icon:LayoutDashboard},
 {to:'/front-desk' as const,label:'Front desk',icon:Hotel},
 {to:'/reservations' as const,label:'Bookings',icon:CalendarDays},
 {to:'/group-reservations' as const,label:'Group Bookings',icon:CalendarRange},
 {to:'/room-calendar' as const,label:'Room calendar',icon:CalendarRange},
 {to:'/rooms' as const,label:'Rooms & readiness',icon:BedDouble},
 {to:'/guests' as const,label:'Guests',icon:Users},
 {to:'/housekeeping' as const,label:'Housekeeping',icon:ClipboardCheck},
 {to:'/lost-found' as const,label:'Lost & found',icon:ClipboardList},
 {to:'/maintenance' as const,label:'Maintenance',icon:Wrench},
 {to:'/billing' as const,label:'Billing',icon:Wallet},
 {to:'/cashier-shifts' as const,label:'Cashier shifts',icon:Wallet},
 {to:'/occupancy-verification' as const,label:'Occupancy checks',icon:ClipboardCheck},
 {to:'/occupancy-coverage' as const,label:'Occupancy report',icon:ClipboardList},
];
const primaryPaths=['/messages','/','/front-desk','/reservations','/group-reservations','/room-calendar','/rooms','/billing'];
const primaryDaily=daily.filter(item=>primaryPaths.includes(item.to));
const secondaryDaily=daily.filter(item=>!primaryPaths.includes(item.to));
const administration=[
 {to:'/rate-calendar' as const,label:'Rate calendar',icon:Wallet},
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
 const navigate=useNavigate();
 const [bookingSearch,setBookingSearch]=useState('');
 const adminProfile=useRef<HTMLDetailsElement>(null);
 const {user,hotelId,selectHotel,signOut,pending}=useHotelAuth();
 useStaffRealtime(dataMode==='api'&&!user?.mustChangePassword?hotelId:null,user?.id);
 const messageInbox=useMessageInbox(hotelId,user?.id);
 const unreadMessages=messageInbox.data?.data.reduce((sum,c)=>sum+Number(c.unread),0)??0;
 const [open,setOpen]=useState(false);
 const menuButton=useRef<HTMLButtonElement>(null);
 const profileButton=useRef<HTMLButtonElement>(null);
 const menuTrigger=useRef<'header'|'profile'>('header');
 const closeButton=useRef<HTMLButtonElement>(null);
 const restoreMenuFocus=useRef(false);
 const [showAdvanced,setShowAdvanced]=useState(false);
 const [showMoreOperations,setShowMoreOperations]=useState(false);
 const [notificationPromptHost,setNotificationPromptHost]=useState<HTMLDivElement|null>(null);
 const pathname=useRouterState({select:s=>s.location.pathname});
 const search=useRouterState({select:s=>s.location.searchStr});
 const current=pathname.startsWith('/guests/')?'Customer stays':pathname.startsWith('/expenses/')?'Expense voucher':all.find(item=>item.to===pathname)?.label??'Overview';
 const role=selectedRole(user?.hotels,hotelId);
 const effectivePermissions=user?.hotels.find(h=>h.id===hotelId)?.permissions;
 const workspace=navigationForRole(role);
 const admin=role==='admin';
 const adminLive=dataMode==='api'&&admin;
 useEffect(()=>{setBookingSearch('');if(adminProfile.current)adminProfile.current.open=false;},[hotelId,pathname]);
 useEffect(()=>{if(!adminLive)return;const close=(event:PointerEvent)=>{const menu=adminProfile.current;if(menu?.open&&event.target instanceof Node&&!menu.contains(event.target))menu.open=false;};document.addEventListener('pointerdown',close);return()=>document.removeEventListener('pointerdown',close);},[adminLive]);
 const housekeepingMobile=dataMode==='api'&&role==='housekeeping';
 const receptionMobile=dataMode==='api'&&role==='front_desk';
 const staffMobile=housekeepingMobile||receptionMobile;
 const selectedHotelName=user?.hotels.find(h=>h.id===hotelId)?.name??'Hotel';
 const mobileTabs=(receptionMobile?[{to:'/' as const,label:'Overview',icon:Home},{to:'/front-desk' as const,label:'Front desk',icon:Hotel},{to:'/rooms' as const,label:'Rooms',icon:BedDouble},{to:'/messages' as const,label:'Messages',icon:MessageCircle}]:[{to:'/' as const,label:'Home',icon:Home},{to:'/housekeeping' as const,label:'Tasks',icon:ClipboardCheck},{to:'/rooms' as const,label:'Rooms',icon:BedDouble},{to:'/messages' as const,label:'Messages',icon:MessageCircle}]).filter(item=>canViewWorkspacePath(role,item.to,effectivePermissions));
 const canMessage=dataMode==='api'&&!!user&&!!hotelId&&!user.mustChangePassword&&canViewWorkspacePath(role,'/messages',effectivePermissions);
 const showMessageShortcut=canMessage&&pathname!=='/messages'&&!open;
 const messageScope=hotelId+':'+user?.id;
 const previousUnread=useRef<{scope:string;count:number}|null>(null);
 const [attention,setAttention]=useState(0);
 useEffect(()=>{
  if(!canMessage||!messageInbox.isSuccess){previousUnread.current=null;return;}
  const old=previousUnread.current;
  previousUnread.current={scope:messageScope,count:unreadMessages};
  if(unreadMessages>0&&(!old||old.scope!==messageScope||unreadMessages>old.count))setAttention(n=>n+1);
 },[canMessage,messageInbox.isSuccess,messageScope,unreadMessages]);
 useEffect(()=>{setOpen(false);},[pathname,hotelId]);
 useEffect(()=>{
  if(!open){
   if(restoreMenuFocus.current)(menuTrigger.current==='profile'?profileButton:menuButton).current?.focus();
   restoreMenuFocus.current=false;
   return;
  }
  closeButton.current?.focus();
  const mobile=window.matchMedia('(max-width: 760px)');
  const closeOnDesktop=(event:MediaQueryListEvent)=>{if(!event.matches)setOpen(false);};
  mobile.addEventListener('change',closeOnDesktop);
  return ()=>mobile.removeEventListener('change',closeOnDesktop);
 },[open]);

 const closeNavigation=()=>{
  restoreMenuFocus.current=true;
  setOpen(false);
 };
 const handleNavigationKey=(event:KeyboardEvent<HTMLElement>)=>{
  if(!open)return;
  if(event.key==='Escape'){
   event.preventDefault();
   closeNavigation();
  }
  if(event.key==='Tab'){
   const controls=Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], select:not(:disabled)')).filter(control=>control.getClientRects().length>0);
   const first=controls[0];
   const last=controls[controls.length-1];
   const boundary=event.shiftKey?first:last;
   if(document.activeElement===boundary){
    event.preventDefault();
    (event.shiftKey?last:first)?.focus();
   }
  }
 };
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
 // A native push link must be checked even when it opens an already signed-in tab.
 if(dataMode==='api'&&user&&new URLSearchParams(search).has('push')){
  const target=requestedNotificationHotel(pathname,search,user.hotels);
  if(!target||target!==hotelId)return <div className="auth-shell"><div className="auth-card">
   <h1>{target?'Switch hotel to open this alert':'Notification unavailable'}</h1>
   <p>{target?'This notification belongs to a different authorized hotel. Switch before viewing its records.':'This notification is invalid or your account no longer has administrator access to its hotel.'}</p>
   {target&&<button type="button" className="btn-primary" onClick={()=>selectHotel(target)}>Switch hotel</button>}
   <Link to="/" className="btn-inline">Return to workspace</Link>
  </div></div>;
 }
 if(dataMode==='api'&&user&&!hotelId&&pathname==='/change-password')return <Outlet/>;
 if(dataMode==='api'&&!hotelId)return <HotelChooser/>;

 const renderNav=(items:readonly NavItem[],section:'daily'|'management'|'advanced')=>items
  .filter(item=>dataMode==='api'||!['/change-password','/staff','/expenses','/my-expense-claims','/messages','/lost-found'].includes(item.to))
  .filter(item=>dataMode!=='api'||(
   canViewWorkspacePath(role,item.to,effectivePermissions)&&(
   section==='daily'?workspace.daily.includes(item.to):
   section==='management'?workspace.management.includes(item.to):
   workspace.advanced.includes(item.to))))
  .map(({to,label,icon:Icon})=><Link key={to} to={to} activeOptions={{exact:true}} onClick={open?closeNavigation:undefined}
   aria-current={pathname===to?'page':undefined}
   className={'nav-link'+(pathname===to||to==='/expenses'&&pathname.startsWith('/expenses/')?' active':'')}>
   <Icon size={18} aria-hidden="true"/><span>{dataMode==='api'&&role==='housekeeping'?(to==='/'?'My dashboard':to==='/housekeeping'?'My tasks':to==='/rooms'?'Room status':label):label}{to==='/messages'&&unreadMessages>0?' ('+unreadMessages+')':''}</span>
  </Link>);

 return <div className={'app-layout'+(housekeepingMobile?' housekeeping-shell':receptionMobile?' reception-shell':adminLive?' admin-shell':'')}>
  {open&&<div className="mobile-overlay" aria-hidden="true" onClick={closeNavigation}/>}
  <aside id="workspace-sidebar" className={'sidebar'+(open?' sidebar-open':'')}
   role={open?'dialog':undefined} aria-modal={open||undefined}
   aria-label={open?'Workspace navigation':undefined} onKeyDown={handleNavigationKey}>
   <div className="brand"><div className="brand-mark">FO</div>
    <div><strong>FRIENDSHIP</strong><span>ON HOTEL · PMS</span></div>
    <button ref={closeButton} type="button" className="close-mobile" aria-label="Close menu" onClick={closeNavigation}><X size={20}/></button>
   </div>
   <nav aria-label="Hotel workspace navigation" className="workspace-nav">
    <p className="nav-heading">{dataMode==='api'?workspace.label.toUpperCase()+' WORKSPACE':'DAILY OPERATIONS'}</p>
    {dataMode==='api'&&role==='housekeeping'?renderNav(workspace.daily.flatMap(path=>daily.filter(item=>item.to===path)),'daily'):renderNav(primaryDaily,'daily')}
    {(dataMode==='mock'||role!=='housekeeping'&&secondaryDaily.some(item=>workspace.daily.includes(item.to)))&&<>
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
   {staffMobile&&<div className="hk-mobile-account-actions">
    <div className="hk-profile-property"><span>Current hotel</span>
     {user&&user.hotels.length>1?<select aria-label="Switch hotel" value={hotelId??''} disabled={pending} onChange={event=>selectHotel(event.target.value)}>
      {user.hotels.map(h=><option key={h.id} value={h.id}>{h.name}</option>)}
     </select>:<strong>{selectedHotelName}</strong>}
    </div>
    <button type="button" onClick={toggle} className="nav-link">{theme==='light'?<Moon size={18}/>:<Sun size={18}/>} {theme==='light'?'Dark mode':'Light mode'}</button>
    <button type="button" onClick={()=>void signOut()} disabled={pending} className="nav-link"><LogOut size={18}/> Sign out</button>
   </div>}
   <div className="sidebar-footer"><div className="avatar">FO</div>
    <div><strong>{dataMode==='api'?user?.name:'Demo workspace'}</strong>
     <span>{dataMode==='api'?workspace.label+' workspace':'Design preview only'}</span>
    </div>
   </div>
  </aside>
  <main className={'main-area'+(showMessageShortcut?' has-message-shortcut':'')+(staffMobile?' hk-bottom-nav-shell':'')+(housekeepingMobile&&pathname==='/'?' hk-minimal-home-shell':'')} inert={open}>
   <header className="topbar">
    <div className="topbar-left">
     <button ref={menuButton} className="icon-btn mobile-menu" type="button" onClick={()=>{menuTrigger.current='header';setOpen(true);}}
      aria-label="Open navigation" aria-haspopup="dialog" aria-expanded={open} aria-controls="workspace-sidebar"><Menu size={20}/></button>
     {staffMobile&&<div className="hk-mobile-brand"><span className="hk-mobile-brand-mark" aria-hidden="true"><Hotel size={22}/></span><span className="hk-mobile-brand-name">{selectedHotelName}</span></div>}
     <div className="topbar-heading"><span className="eyebrow">FRIENDSHIP ON HOTEL</span><h1>{current}</h1></div>
    </div>
    <div className="topbar-actions">
     {dataMode==='api'&&user&&<label className="hotel-context-select">Property
      <select aria-label="Selected hotel" value={hotelId??''} onChange={e=>selectHotel(e.target.value)}>
       {user.hotels.map(h=><option key={h.id} value={h.id}>{h.name}</option>)}
      </select>
     </label>}
     {adminLive&&<form className="admin-top-search" role="search" onSubmit={event=>{event.preventDefault();const q=bookingSearch.trim();if(q)void navigate({to:'/reservations',search:{q}});}}><Search size={17} aria-hidden="true"/><input aria-label="Search bookings" placeholder="Search guest, booking, room…" maxLength={120} value={bookingSearch} onChange={event=>setBookingSearch(event.target.value)}/><button type="submit" aria-label="Submit booking search" disabled={!bookingSearch.trim()}>Search</button></form>}
     <span className="demo-pill" role="status">{experienceForPath(pathname,dataMode)}</span>
     <button className="icon-btn topbar-action-theme" type="button" aria-label={theme==='light'?'Switch to dark mode':'Switch to light mode'} onClick={toggle}>
      {theme==='light'?<Moon size={19}/>:<Sun size={19}/>}
     </button>
     {dataMode==='api'&&hotelId&&user&&(role==='admin'||role==='front_desk'||role==='housekeeping')&&
      <StaffNotifications key={user.id+':'+hotelId} userId={user.id} hotelId={hotelId} canPush={admin} housekeeping={role==='housekeeping'} promptHost={notificationPromptHost}/>}
     {dataMode==='api'
      ?<button className="icon-btn topbar-action-signout" type="button" aria-label="Sign out" title="Sign out" disabled={pending} onClick={()=>void signOut()}><LogOut size={18}/></button>
      :<div className="topbar-avatar" aria-label="Demo user">FO</div>}
     {adminLive&&<details className="admin-profile" ref={adminProfile} onKeyDown={event=>{if(event.key==='Escape'){event.currentTarget.open=false;event.currentTarget.querySelector('summary')?.focus();}}}><summary><span className="admin-profile-avatar"><UserRound size={18}/></span><span>{user?.name??'Manager'}</span><ChevronDown size={15}/></summary><div className="admin-profile-menu"><Link to="/change-password" onClick={()=>{if(adminProfile.current)adminProfile.current.open=false;}}><ShieldCheck size={16}/> Account security</Link><button type="button" onClick={()=>{toggle();if(adminProfile.current)adminProfile.current.open=false;}}>{theme==='light'?<Moon size={16}/>:<Sun size={16}/>} {theme==='light'?'Dark mode':'Light mode'}</button><button type="button" disabled={pending} onClick={()=>void signOut()}><LogOut size={16}/> Sign out</button></div></details>}
    </div>
   </header>
   {dataMode==='api'&&!(adminLive&&pathname==='/')&&<div className="workflow-shortcuts" aria-label="Related actions">
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
    {dataMode==='api'&&(admin||role==='housekeeping'||role==='front_desk')&&!((staffMobile||adminLive)&&pathname==='/')&&<div ref={setNotificationPromptHost}/>}
    {dataMode==='api'&&!canViewWorkspacePath(role,pathname,effectivePermissions)
     ?<section className="panel" role="alert" aria-label="Page access denied">
       <h2>Page not available for your role</h2>
       <p>Your {workspace.label.toLowerCase()} account cannot open this page. Ask a hotel manager if your duties require access.</p>
       <Link className="btn-primary" to="/">Return to your workspace <ArrowRight size={15}/></Link>
      </section>
     :<Suspense fallback={<div role="status" className="workspace-loading">Loading hotel workspace…</div>}><Outlet/></Suspense>}
    {(staffMobile||adminLive)&&pathname==='/'&&<div className="hk-phone-secondary"><div ref={setNotificationPromptHost}/>{housekeepingMobile&&<HousekeepingInstallHelp/>}</div>}
   </div>
   {staffMobile&&<nav className="hk-bottom-nav" aria-label={housekeepingMobile?'Housekeeping mobile navigation':'Front desk mobile navigation'}>
    {mobileTabs.map(({to,label,icon:Icon})=><Link to={to} key={to} className={'hk-bottom-tab'+(pathname===to?' is-current':'')} activeOptions={{exact:true}} aria-current={pathname===to?'page':undefined} aria-label={label+(to==='/messages'&&unreadMessages>0?', '+unreadMessages+' unread messages':'')}><span className="hk-bottom-icon"><Icon size={22} aria-hidden="true"/>{to==='/messages'&&unreadMessages>0&&<span className="hk-bottom-unread" aria-hidden="true">{unreadMessages>99?'99+':unreadMessages}</span>}</span><span>{label}</span></Link>)}
    <button ref={profileButton} type="button" className={'hk-bottom-tab'+(!mobileTabs.some(item=>item.to===pathname)?' is-current':'')} aria-haspopup="dialog" aria-expanded={open} aria-controls="workspace-sidebar" onClick={()=>{menuTrigger.current='profile';setOpen(true);}}><span className="hk-bottom-icon"><UserRound size={22} aria-hidden="true"/></span><span>Profile</span></button>
   </nav>}
   {canMessage&&<MessageArrivalAlert key={messageScope} conversations={messageInbox.isSuccess?messageInbox.data.data:undefined} userId={user.id}/>}
   {showMessageShortcut&&<Link key={messageScope+':'+attention} to="/messages" className={'floating-messages'+(unreadMessages>0?' has-unread is-new':'')}
    aria-label={unreadMessages>0?'Open messages, '+unreadMessages+' unread messages':'Open messages'} title={unreadMessages>0?unreadMessages+' unread messages':'Open messages'}>
    <MessageCircle size={26} aria-hidden="true"/>
    {unreadMessages>0&&<><span className="floating-messages-label">New messages</span><span className="floating-messages-count" aria-hidden="true">{unreadMessages>99?'99+':unreadMessages}</span></>}
   </Link>}
   {canMessage&&<span role="status" aria-live="polite" style={{position:'absolute',width:1,height:1,padding:0,margin:-1,overflow:'hidden',clipPath:'inset(50%)',whiteSpace:'nowrap'}}>{unreadMessages>0?unreadMessages+' unread staff messages':''}</span>}
  </main>
 </div>;
}
