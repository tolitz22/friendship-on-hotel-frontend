import {useEffect,useState} from 'react';
import {Link,useNavigate,useSearch} from '@tanstack/react-router';
import {
 AlertTriangle,ArrowRight,Banknote,CheckCircle2,ClipboardList,
 FileText,Info,RefreshCcw,Search,ShieldCheck,Wallet,X,
} from 'lucide-react';
import {useHotelAuth} from '../components/AuthProvider';
import {useFolios} from '../api/queries';
import {dataMode} from '../api';
import {useBillingFolios,formatBillingMoney} from '../api/billing';
import {DemoNotice,Heading,Panel,Status} from '../components/ui';
import {QueryFeedback} from '../components/QueryFeedback';
import {SettlementPanel} from '../components/SettlementPanel';
import {currency,statusLabel} from '../lib/format';

function LiveBilling(){
 const {booking:requestedBooking}=useSearch({from:'/billing'});
 const navigate=useNavigate();
 const {hotelId,user}=useHotelAuth();
 const role=user?.hotels.find(h=>h.id===hotelId)?.role;
 const canRead=role==='admin'||role==='front_desk';
 const manager=role==='admin';
 const [page,setPage]=useState(1);
 const [search,setSearch]=useState('');
 const [debounced,setDebounced]=useState('');
 const [directId,setDirectId]=useState('');
 useEffect(()=>{
  const timer=window.setTimeout(()=>{setDebounced(search.trim());setPage(1);},300);
  return ()=>window.clearTimeout(timer);
 },[search]);
 useEffect(()=>{setPage(1);setSearch('');setDebounced('');setDirectId('');},[hotelId]);
 const folios=useBillingFolios(page,debounced);
 const selectedId=requestedBooking??null;
 const select=(booking:string)=>void navigate({to:'/billing',search:{booking}});
 const clear=()=>void navigate({to:'/billing',search:{}});
 const loadingSearch=debounced!==search.trim();
 if(!hotelId||!canRead)return <>
  <Heading title="Billing & guest folios" description="Hotel billing is available to authorized reception and finance staff."/>
  <Panel title="Access required"><p>Select an authorized hotel and sign in with a billing-enabled staff account.</p></Panel>
 </>;
 return <div className="billing-workspace">
  <div className="billing-header">
   <div><span className="rr-eyebrow">GUEST ACCOUNTS · CASHIERING</span>
    <Heading title="Billing & guest folios" description="Review charges, record verified evidence, and prepare guest checkout statements."/></div>
   <div className="billing-header-actions">
    <Link to="/cashier-shifts" className="rr-secondary-action"><Banknote size={16}/> {manager?'Cash reconciliation':'Cashier shifts'} <ArrowRight size={14}/></Link>
    <Link to="/reservations" className="rr-secondary-action"><ClipboardList size={16}/> Reservations</Link>
   </div>
  </div>
  <div className="billing-guidance"><Info size={18}/><p><strong>Financial records are not proof of bank settlement.</strong>
   Staff-confirmed payments still require independent verification. Only approved and signed folios are final internal settlement records; these statements are not tax invoices.</p></div>
  <section className="billing-index" aria-label="Guest folio directory">
   <div className="billing-section-heading">
    <div><span className="rr-eyebrow">LIVE HOTEL RECORDS</span><h3>Find a guest folio</h3>
     <p>Search by guest name, booking reference, or reservation ID, then open the recorded account.</p></div>
    <button type="button" className="rr-secondary-action" disabled={folios.isFetching}
     onClick={()=>void folios.refetch()}><RefreshCcw size={15}/>{folios.isFetching?'Refreshing…':'Refresh list'}</button>
   </div>
   <form className="billing-direct-search" onSubmit={e=>{
    e.preventDefault();if(/^[1-9]\d*$/.test(directId))select(directId);
   }}>
    <label>Open a reservation by ID
     <input className="wizard-input" inputMode="numeric" pattern="[1-9][0-9]*"
      value={directId} onChange={e=>setDirectId(e.target.value.trim())} placeholder="Reservation ID"/>
    </label>
    <button type="submit" className="btn-primary" disabled={!/^[1-9]\d*$/.test(directId)}>
     Open folio <ArrowRight size={15}/></button>
   </form>
   <div className="billing-directory-controls">
    <label className="billing-list-search"><Search size={17}/>
     <input type="search" value={search} aria-label="Search folios" placeholder="Guest name, reference, or booking ID…"
      onChange={e=>setSearch(e.target.value)}/>
    </label>
    {search&&<button type="button" className="btn-inline" onClick={()=>{setSearch('');setDebounced('');setPage(1);}}><X size={15}/> Clear search</button>}
    <span className="billing-count" role="status">{loadingSearch?'Searching…':folios.isSuccess?folios.data.meta.total+' priced folios found':'Loading folios…'}</span>
   </div>
   <QueryFeedback loading={folios.isPending||loadingSearch} error={folios.error} onRetry={()=>void folios.refetch()}
    empty={folios.isSuccess&&!loadingSearch&&folios.data.data.length===0}
    emptyMessage={debounced?'No matching priced folios. Check the reference or clear search.':'No priced folios have been recorded yet. Create a priced reservation first.'}/>
   {folios.isSuccess&&!loadingSearch&&folios.data.data.length>0&&<>
    <div className="billing-folio-list">
     {folios.data.data.map(folio=><article className={'billing-folio-row'+(selectedId===folio.bookingId?' selected':'')} key={folio.folioId}>
      <div className="billing-folio-identity"><span className="billing-folio-icon"><FileText size={18}/></span>
       <div><strong>{folio.guestName?.trim()||folio.reference}</strong><small>{folio.reference} · Reservation #{folio.bookingId}</small><small>Folio #{folio.folioId}</small>
        <small>{folio.checkIn} – {folio.checkOut}</small></div>
      </div>
      <div className="billing-folio-amount"><small>Recorded charges</small>
       <strong>{formatBillingMoney(folio.netRecordedChargesMinor,folio.currency)}</strong></div>
      <div className="billing-folio-amount"><small>Staff-confirmed evidence</small>
       <strong>{formatBillingMoney(folio.staffConfirmedPaymentsMinor,folio.currency)}</strong>
       {folio.pendingReviewPaymentsMinor>0&&<span className="billing-pending">Evidence awaiting review</span>}</div>
      <div className="billing-folio-status">{folio.signed?
       <span className="billing-signed"><CheckCircle2 size={14}/> Signed account</span>:
       <span className="billing-provisional"><AlertTriangle size={14}/> Not yet signed</span>}
       <small>{statusLabel(folio.status)}</small>
      </div>
      <Link to="/billing" search={{booking:folio.bookingId}} className="billing-open-link"
       aria-label={'Open folio for booking '+folio.reference}>{selectedId===folio.bookingId?'Viewing folio':'Open folio'} <ArrowRight size={15}/></Link>
     </article>)}
    </div>
    {folios.data.meta.totalPages>1&&<div className="billing-pagination">
     <span>Page {folios.data.meta.page} of {folios.data.meta.totalPages}</span>
     <div><button type="button" className="btn-inline" disabled={page<=1} onClick={()=>setPage(v=>Math.max(1,v-1))}>Previous</button>
      <button type="button" className="btn-inline" disabled={page>=folios.data.meta.totalPages} onClick={()=>setPage(v=>v+1)}>Next</button></div>
    </div>}
   </>}
  </section>
  {selectedId?<section className="billing-selected" aria-label="Selected guest folio">
   <div className="billing-selected-heading">
    <div><span className="rr-eyebrow">SELECTED ACCOUNT</span><h3>Reservation #{selectedId}</h3>
     <p>Itemized charges, verified allocations, payment reviews and checkout statement.</p></div>
    <button type="button" className="btn-inline" onClick={clear}><X size={16}/> Close folio</button>
   </div>
   <SettlementPanel key={hotelId+'-'+selectedId} bookingId={selectedId}/>
  </section>:<div className="billing-unselected"><Wallet size={25}/>
   <div><strong>Choose a folio to review</strong>
    <p>Select an account above or enter a reservation ID. Its current settlement status and eligible actions appear here.</p></div></div>}
  <p className="billing-footer-note"><ShieldCheck size={16}/> All financial changes are subject to the existing hotel permissions, independent reviews, and signed-folio restrictions.</p>
 </div>;
}
function DemoBilling(){
 const [search,setSearch]=useState('');
 const q=useFolios({search,perPage:50});
 return <>
  <DemoNotice/>
  <Heading title="Guest folios · Demo" description="Sample balances only. No actual charges, collections or refunds can be recorded here."/>
  <Panel title="Sample folios" action={<span className="table-count">{q.data?.meta.total??'—'} examples</span>}>
   <div className="table-toolbar"><label className="search-box"><Search size={17}/>
    <input value={search} onChange={e=>setSearch(e.target.value)}
     aria-label="Search sample folios" placeholder="Search sample guest or reference"/></label></div>
   <QueryFeedback loading={q.isPending} error={q.error} empty={q.data?.data.length===0}/>
   {q.data&&q.data.data.length>0&&<div className="table-scroll"><table><thead><tr>
    <th>Reservation</th><th>Guest</th><th>Charges</th><th>Payments</th><th>Balance</th><th>Status</th>
   </tr></thead><tbody>{q.data.data.map(f=><tr key={f.id}>
    <td>{f.reservationReference}</td><td>{f.guestName}</td><td>{currency(f.totalCharges)}</td>
    <td>{currency(f.totalPayments)}</td><td>{currency(f.balance)}</td>
    <td><Status value={statusLabel(f.status)}/></td>
   </tr>)}</tbody></table></div>}
  </Panel>
 </>;
}
export function Billing(){
 return dataMode==='api'?<LiveBilling/>:<DemoBilling/>;
}
