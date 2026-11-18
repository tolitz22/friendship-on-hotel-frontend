import {useEffect,useState} from 'react';
import {Link,useNavigate,useSearch} from '@tanstack/react-router';
import {
 AlertTriangle,ArrowRight,Banknote,ClipboardList,
 FileText,Info,RefreshCcw,Search,X,
} from 'lucide-react';
import {useHotelAuth} from '../components/AuthProvider';
import {useFolios} from '../api/queries';
import {dataMode} from '../api';
import {useBillingFolios,useBillingReservationFallback,formatBillingMoney} from '../api/billing';
import {DemoNotice,Heading,Panel,Status} from '../components/ui';
import {QueryFeedback} from '../components/QueryFeedback';
import {SettlementPanel} from '../components/SettlementPanel';
import {currency,statusLabel,readableDate} from '../lib/format';

function LiveBilling(){
 const {booking:requestedBooking,group:originGroup,hotel:originHotel,
  checkIn:groupCheckIn,checkOut:groupCheckOut}=useSearch({from:'/billing'});
 const navigate=useNavigate();
 const {hotelId,user}=useHotelAuth();
 const role=user?.hotels.find(h=>h.id===hotelId)?.role;
 const canRead=role==='admin'||role==='front_desk';
 const [page,setPage]=useState(1);
 const [search,setSearch]=useState('');
 const [debounced,setDebounced]=useState('');
 useEffect(()=>{
  const timer=window.setTimeout(()=>{setDebounced(search.trim());setPage(1);},300);
  return ()=>window.clearTimeout(timer);
 },[search]);
 useEffect(()=>{setPage(1);setSearch('');setDebounced('');},[hotelId]);
 const folios=useBillingFolios(page,debounced);
 const fallback=useBillingReservationFallback(folios.isError,page,debounced);
 const selectedId=requestedBooking??null;
 const select=(booking:string)=>void navigate({to:'/billing',search:{booking}});
 const clear=()=>void navigate({to:'/billing',search:originGroup&&(!originHotel||originHotel===hotelId)
  ?{group:originGroup,hotel:originHotel,checkIn:groupCheckIn,checkOut:groupCheckOut}:{}});
 const loadingSearch=debounced!==search.trim();
 const directId=/^[1-9]\d*$/.test(search.trim())?search.trim():null;
 if(!hotelId||!canRead)return <>
  <Heading title="Guest billing" description="Hotel billing is available to authorized reception and finance staff."/>
  <Panel title="Access required"><p>Select an authorized hotel and sign in with a billing-enabled staff account.</p></Panel>
 </>;
 return <div className="billing-workspace">
  <div className="billing-header">
   <div><span className="rr-eyebrow">GUEST ACCOUNTS · CASHIERING</span>
    <Heading title="Guest billing" description="Find a guest, review their bill, and manage payments or checkout statements."/></div>
   <div className="billing-header-actions">
    <Link to="/cashier-shifts" className="rr-secondary-action"><Banknote size={16}/> Cashier shifts</Link>
    <Link to="/reservations" className="rr-secondary-action"><ClipboardList size={16}/> Bookings</Link>
   </div>
  </div>
  {originGroup&&<div className="gb-workflow-notice">
   {originHotel&&originHotel!==hotelId
    ?<strong role="alert">This group link belongs to a different property. Select the original hotel before continuing.</strong>
    :<><strong>Opened from a group booking</strong>
     {groupCheckIn&&groupCheckOut&&<span> · {readableDate(groupCheckIn)} – {readableDate(groupCheckOut)}</span>}
     <div className="gb-context-actions">
      <Link to="/group-reservations" search={{group:originGroup,tab:'billing' as const,
       hotel:originHotel??undefined}}>Return to group billing <ArrowRight size={14}/></Link>
      {groupCheckIn&&<Link to="/room-calendar" search={{date:groupCheckIn,group:originGroup,
       hotel:originHotel??undefined}}>View group calendar <ArrowRight size={14}/></Link>}
     </div></>}
  </div>}
  <div className="billing-guidance"><Info size={18}/><p><strong>Before collecting or closing an account:</strong> Check recorded charges and payment reviews. Displayed differences are not final amounts due until finance verifies the account.</p></div>
  {!selectedId&&<section className="billing-index" aria-label="Guest folio directory">
   <div className="billing-section-heading">
    <div><span className="rr-eyebrow">GUEST ACCOUNTS</span><h3>Who would you like to bill?</h3>
     <p>Search by guest name or reservation reference, then select the guest account.</p></div>
    <button type="button" className="rr-secondary-action" disabled={folios.isFetching}
     onClick={()=>void folios.refetch()}><RefreshCcw size={15}/>{folios.isFetching?'Refreshing…':'Refresh list'}</button>
   </div>
   <div className="billing-directory-controls billing-primary-search">
    <label className="billing-list-search"><Search size={19}/>
     <input type="search" value={search} aria-label="Search folios" autoFocus
      placeholder="Search guest name, booking reference, or number"
      onChange={e=>setSearch(e.target.value)}/>
    </label>
    {directId&&<button type="button" className="btn-primary" onClick={()=>select(directId)}>
     Open booking #{directId} <ArrowRight size={16}/></button>}
    {search&&!directId&&<button type="button" className="btn-inline" onClick={()=>{setSearch('');setDebounced('');setPage(1);}}>
     <X size={15}/> Clear</button>}
    <span className="billing-count" role="status">{loadingSearch?'Searching…':folios.isSuccess
     ?folios.data.meta.total+' guest accounts found':folios.isError?'Account list unavailable':'Loading accounts…'}</span>
   </div>
   {folios.isPending&&!loadingSearch&&<QueryFeedback loading error={null}/>}
   {folios.isError&&!loadingSearch&&<div className="billing-recovery" role="alert">
    <div className="billing-recovery-head"><AlertTriangle size={20}/>
     <div><strong>Guest account list is unavailable</strong>
      <p>Your accounts couldn't be loaded right now. You can still find bookings below or open a booking by its number above.</p></div>
    </div>
    <button type="button" className="rr-secondary-action" onClick={()=>void folios.refetch()}>
     <RefreshCcw size={16}/> Retry account list</button>
    {fallback.isPending&&<p className="billing-fallback-status">Looking for available reservations…</p>}
    {fallback.isSuccess&&<div className="billing-recovery-bookings">
     <h4>Find a reservation instead</h4>
     <p>These are reservation records, not bills. Open one to check whether it has a recorded folio.</p>
     {fallback.data.data.map(record=><div className="billing-fallback-booking" key={record.id}>
      <div><strong>{record.guestName?.trim()||record.reference}</strong>
       <small>{record.reference} · {readableDate(record.checkIn)} – {readableDate(record.checkOut)}</small></div>
      <button type="button" className="btn-inline" onClick={()=>select(record.id)}>Check bill <ArrowRight size={15}/></button>
     </div>)}
     {fallback.data.data.length===0&&<p>No matching reservations. Try another name or booking reference.</p>}
    </div>}
    {fallback.isError&&<p>Reservation search is also unavailable. Try again or contact the hotel administrator.</p>}
   </div>}
   {folios.isSuccess&&!loadingSearch&&folios.data.data.length===0&&
    <div className="billing-quiet-empty"><Search size={23}/><strong>No matching guest accounts</strong>
     <p>{debounced?'Try a different name or reference.':'There are no priced guest folios recorded yet.'}</p>
     <Link to="/reservations">View reservations <ArrowRight size={15}/></Link>
    </div>}
   {folios.isSuccess&&!loadingSearch&&folios.data.data.length>0&&<>
    <div className="billing-list-labels"><span>Guest & stay</span><span>Recorded charges</span><span>Staff-reviewed payments</span><span>Difference (not final)</span><span>Action</span></div>
    <div className="billing-folio-list">
     {folios.data.data.map(folio=>{
      const difference=folio.netRecordedChargesMinor-folio.staffConfirmedPaymentsMinor;
      return <article className="billing-folio-row" key={folio.folioId}>
       <div className="billing-folio-identity"><span className="billing-folio-icon"><FileText size={18}/></span>
        <div><strong>{folio.guestName?.trim()||'Guest name unavailable'}</strong>
         <small>{folio.reference} · {readableDate(folio.checkIn)} to {readableDate(folio.checkOut)}</small>
         <span className="billing-stay-status">{statusLabel(folio.status)}</span></div>
       </div>
       <div className="billing-folio-amount"><small>Charges</small>
        <strong>{formatBillingMoney(folio.netRecordedChargesMinor,folio.currency)}</strong></div>
       <div className="billing-folio-amount"><small>Reviewed payments</small>
        <strong>{formatBillingMoney(folio.staffConfirmedPaymentsMinor,folio.currency)}</strong>
        {folio.pendingReviewPaymentsMinor>0&&<span className="billing-pending">Payment evidence awaiting review</span>}</div>
       <div className="billing-folio-amount billing-folio-difference"><small>Difference · not final</small>
        <strong>{formatBillingMoney(difference,folio.currency)}</strong>
        <span className="billing-provisional">{folio.signed===null?'Settlement status unavailable':folio.signed?'Signed account':'Under review'}</span>
       </div>
       <Link to="/billing" search={{booking:folio.bookingId}} className="billing-open-link"
        aria-label={'Open folio for booking '+folio.reference}>View bill <ArrowRight size={15}/></Link>
      </article>;
     })}
    </div>
    {folios.data.meta.totalPages>1&&<div className="billing-pagination">
     <span>Page {folios.data.meta.page} of {folios.data.meta.totalPages}</span>
     <div><button type="button" className="btn-inline" disabled={page<=1} onClick={()=>setPage(v=>Math.max(1,v-1))}>Previous</button>
      <button type="button" className="btn-inline" disabled={page>=folios.data.meta.totalPages} onClick={()=>setPage(v=>v+1)}>Next</button></div>
    </div>}
   </>}
  </section>}
  {selectedId?<section className="billing-selected" aria-label="Selected guest folio">
   <div className="billing-selected-heading">
    <div><span className="rr-eyebrow">GUEST BILL</span><h3>Review guest charges and payments</h3>
     <p>Check the recorded amounts first. Use the manager tools only if an update is needed.</p></div>
    <button type="button" className="rr-secondary-action" onClick={clear}><ArrowRight size={16} style={{transform:'rotate(180deg)'}}/> Back to guest accounts</button>
   </div>
   <SettlementPanel key={hotelId+'-'+selectedId} bookingId={selectedId}/>
  </section>:null}
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
