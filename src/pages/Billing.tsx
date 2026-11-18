import {useEffect,useState} from 'react';
import {Link,useSearch} from '@tanstack/react-router';
import {useHotelAuth} from '../components/AuthProvider';
import {Search,Wallet} from 'lucide-react';
import {useFolios} from '../api/queries';
import {dataMode} from '../api';
import {useLiveFolioLedger} from '../api/liveFinance';
import {DemoNotice,Heading,Panel,Status} from '../components/ui';
import {QueryFeedback} from '../components/QueryFeedback';
import {SettlementPanel} from '../components/SettlementPanel';
import {currency,statusLabel} from '../lib/format';

function LiveFolioLookup(){
 const {booking:requestedBooking}=useSearch({from:'/billing'});
 const {hotelId,user}=useHotelAuth();
 const cashAccess=!!user?.hotels.some(h=>h.id===hotelId&&(h.role==='admin'||h.role==='front_desk'));
 const [draftId,setDraftId]=useState(requestedBooking??'');
 const [reservationId,setReservationId]=useState(requestedBooking??'');
 useEffect(()=>{
  setDraftId(requestedBooking??'');
  setReservationId(requestedBooking??'');
 },[hotelId,requestedBooking]);
 const valid=/^[1-9]\d*$/.test(reservationId);
 const ledger=useLiveFolioLedger(reservationId);
 const summary=ledger.data?.data.summary;
 const display=(amountMinor:number,currencyCode:string)=>
  currencyCode==='PHP'
   ? new Intl.NumberFormat('en-PH',{style:'currency',currency:'PHP'}).format(amountMinor/100)
   : amountMinor.toLocaleString()+' '+currencyCode+' minor units';

 return <Panel title="Live reservation folio (read-only)">
  <p>Look up a priced reservation by its ID. This reads the selected hotel's real Laravel ledger. It does not show a legally final balance or verified payment settlement.</p>
  {cashAccess&&<p><Link to="/cashier-shifts">Cash collections and shift reconciliation</Link> · Cash payments must be recorded against an active staff shift, not from this read-only ledger.</p>}
  {requestedBooking&&<p className="calendar-booking-context">From room calendar · Reservation #{requestedBooking}. <Link to="/reservations" search={{booking:requestedBooking}}>Back to booking</Link></p>}
  <form onSubmit={event=>{event.preventDefault();setReservationId(draftId.trim());}}>
   <label htmlFor="live-folio-id">Reservation ID</label>
   <div className="table-toolbar">
    <input id="live-folio-id" value={draftId} onChange={e=>setDraftId(e.target.value)}
     inputMode="numeric" pattern="[1-9][0-9]*" placeholder="Reservation ID" required/>
    <button className="btn-primary" type="submit">View ledger</button>
   </div>
  </form>
  {reservationId&&!valid&&<p role="alert">Enter a positive numeric reservation ID.</p>}
  {valid&&ledger.isPending&&<p role="status">Loading real folio…</p>}
  {valid&&ledger.isError&&<p role="alert">The real folio could not be loaded: {ledger.error.message}</p>}
  {summary&&<div aria-live="polite">
   <p><strong>Recorded room subtotal:</strong> {display(summary.roomSubtotalMinor,summary.currency)}</p>
   <p><strong>Adjustments (debits):</strong> {display(summary.additionalDebitsMinor,summary.currency)}</p>
   <p><strong>Adjustments (credits):</strong> {display(summary.creditsMinor,summary.currency)}</p>
   <p><strong>Staff-confirmed evidence:</strong> {display(summary.staffConfirmedPaymentsMinor,summary.currency)}</p>
   <p><strong>Pending evidence:</strong> {display(summary.pendingReviewPaymentsMinor,summary.currency)}</p>
   <p><strong>Provisional difference:</strong> {display(summary.provisionalDifferenceMinor,summary.currency)}</p>
   <p role="note">Taxes and fees are not finalized. Payment evidence is not bank or gateway verification. This is not a final amount payable, receipt, or proof of settlement.</p>
  </div>}
  {valid&&ledger.isSuccess&&<SettlementPanel key={hotelId+'-'+reservationId} bookingId={reservationId}/>}
 </Panel>;
}

export function Billing(){
 const [search,setSearch]=useState('');
 const q=useFolios({search,perPage:50});
 return <>
  {dataMode!=='api'&&<DemoNotice/>}
  <Heading title="Guest folios"
   description={dataMode==='api'?'Read verified hotel-ledger records by reservation ID. Demo tables remain labeled separately.':'Illustrative balances only; no live charges, payments, receipts or refunds.'}
   action={<button disabled className="btn-primary"><Wallet size={16}/> Add charge (planned)</button>}/>
  {dataMode==='api'&&<LiveFolioLookup/>}
  <Panel title="Sample folio overview (demo only)"
   action={<span className="table-count">{q.data?.meta.total??'—'} folios</span>}>
   <div className="table-toolbar"><label className="search-box">
    <Search size={17}/>
    <input value={search} onChange={e=>setSearch(e.target.value)}
     aria-label="Search sample folios" placeholder="Search guest, reference or status"/>
   </label></div>
   <QueryFeedback loading={q.isPending} error={q.error} empty={q.data?.data.length===0}/>
   {q.data&&q.data.data.length>0&&<div className="table-scroll">
    <table><thead><tr><th>Reservation</th><th>Guest</th><th>Charges</th><th>Payments</th><th>Balance</th><th>Status</th></tr></thead>
     <tbody>{q.data.data.map(f=><tr key={f.id}>
      <td className="table-id">{f.reservationReference}</td>
      <td><strong>{f.guestName}</strong></td>
      <td>{currency(f.totalCharges)}</td>
      <td>{currency(f.totalPayments)}</td>
      <td>{currency(f.balance)}</td>
      <td><Status value={statusLabel(f.status)}/></td>
     </tr>)}</tbody>
    </table>
   </div>}
  </Panel>
 </>;
}
