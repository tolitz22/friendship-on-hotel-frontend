import {useEffect,useState} from 'react';
import {Link} from '@tanstack/react-router';
import {AlertTriangle,CalendarDays,ClipboardCheck,RefreshCw,ShieldAlert,Wallet} from 'lucide-react';
import {useHotelAuth} from '../components/AuthProvider';
import {Heading,Panel} from '../components/ui';
import {QueryFeedback} from '../components/QueryFeedback';
import {hotelToday} from '../features/reservations/calendarDate';
import {useNightAuditPreview} from '../api/nightAuditPreview';
import {NightAuditReviewPanel} from '../components/NightAuditReviewPanel';
import type {NightAuditPreview as Preview} from '../api/nightAuditPreview';

function money(amount:number,currency:string){
 return new Intl.NumberFormat('en-PH',{style:'currency',currency}).format(amount/100);
}
function Metric({label,value}:{label:string;value:string|number}){
 return <div className="night-audit-metric"><small>{label}</small><strong>{value}</strong></div>;
}
function Exceptions({label,items}:{label:string;items:Preview['missingNightEntries']}){
 if(items.length===0)return null;
 return <div className="night-audit-exception-group">
  <h4>{label} ({items.length})</h4>
  {items.slice(0,30).map(item=><div key={item.bookingId} className="night-audit-exception">
   <span>{item.reference} · Booking #{item.bookingId} {item.reason?'· '+item.reason:''}</span>
   <Link to="/reservations" search={{booking:item.bookingId}}>Review booking</Link>
  </div>)}
  {items.length>30&&<p>Showing first 30 exceptions. Use the reservation list to investigate additional cases.</p>}
 </div>;
}
export function NightAuditPreview(){
 const {user,hotelId}=useHotelAuth();
 const manager=!!hotelId&&user?.hotels.some(h=>h.id===hotelId&&h.role==='admin');
 const [date,setDate]=useState(hotelToday);
 useEffect(()=>setDate(hotelToday()),[hotelId]);
 const query=useNightAuditPreview(date,!!manager);
 if(!manager)return <>
  <Heading title="Night audit preflight" description="Manager-only operational and financial review."/>
  <Panel title="Restricted"><p>A current active hotel manager is required to view financial details.</p></Panel>
 </>;
 const data=query.data;
 return <>
  <Heading title="Night audit preflight" description="Review posted room nights, missing charges and cashier exceptions before designing an authoritative business-date close."/>
  <Panel title="Review hotel date">
   <div className="desk-tools">
    <label className="night-audit-date">Hotel-local date
     <input type="date" className="wizard-input" value={date} max={data?.hotelDate??hotelToday()}
      onChange={e=>setDate(e.target.value)}/>
    </label>
    <button type="button" className="btn-inline" onClick={()=>void query.refetch()}>
     <RefreshCw size={16}/> Refresh preflight
    </button>
   </div>
   <p className="night-audit-warning"><AlertTriangle size={18}/>
    This is a <strong>read-only preview, NOT a night close.</strong> It does not post nightly charges,
    roll the business date, lock transactions, calculate VAT, or confirm gateway settlement.
    Existing room nights are already posted when priced bookings are created.</p>
   <QueryFeedback loading={query.isPending} error={query.error}
    onRetry={()=>void query.refetch()}/>
   {data&&<>
    <div className="night-audit-headline">
     <div><CalendarDays size={18}/><strong>{data.businessDate}</strong><span>Hotel-local review date</span></div>
     <span className={data.preflightClear?'night-audit-pass':'night-audit-needs-review'}>
      {data.preflightClear?'No listed exceptions':'Exceptions require review'}
     </span>
    </div>
    <div className="night-audit-metrics">
     <Metric label="Rooms in current inventory" value={data.roomCount}/>
     <Metric label="Scheduled room nights" value={data.scheduledRoomNights}/>
     <Metric label="Priced room nights" value={data.pricedRoomNights}/>
     <Metric label="Room charges posted for date" value={money(data.postedRoomChargesMinor,data.currency)}/>
     <Metric label="Open cashier shifts" value={data.openCashierShifts}/>
     <Metric label="Shift reviews outstanding" value={data.unreconciledCashierShifts}/>
     <Metric label="Payment records pending review" value={data.pendingPaymentEvidence}/>
     <Metric label="Missing room-night entries" value={data.missingNightEntries.length}/>
    </div>
    {data.issues.length>0?<section className="night-audit-issues" aria-label="Issues requiring investigation">
     <h3><ShieldAlert size={19}/> Issues requiring investigation</h3>
     {data.issues.map(issue=><p key={issue}>{issue}</p>)}
    </section>:<p className="night-audit-clean"><ClipboardCheck size={18}/>
     No issues detected by this limited preflight. This does not certify a balanced or closed ledger.</p>}
    <Exceptions label="Missing room-night charge" items={data.missingNightEntries}/>
    <Exceptions label="Duplicate room-night charge" items={data.duplicateNightEntries}/>
    <Exceptions label="Unpriced reservations" items={data.unpricedBookings}/>
    <div className="night-audit-next-actions">
     <Link to="/cashier-shifts"><Wallet size={16}/> Review cashier shifts</Link>
     <Link to="/billing">Review reservation folios</Link>
     <Link to="/operational-exceptions">Review operational exceptions</Link>
    </div>
    <NightAuditReviewPanel key={hotelId+'-'+data.businessDate} date={data.businessDate} preflight={data}/>
    <p className="night-audit-fineprint">The scheduled-night count is based on current reservation records, not historical physical room occupancy. Current inventory counts may differ from the inventory on the selected historical date. Payment totals are staff-maintained evidence, not settlement. The cashier and payment exception counts are current property-wide counts, not date-scoped historical snapshots.</p>
   </>}
  </Panel>
 </>;
}
