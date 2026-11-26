import {useEffect,useState} from 'react';
import {Link} from '@tanstack/react-router';
import {CalendarDays,ClipboardCheck,RefreshCw,ShieldAlert,Wallet} from 'lucide-react';
import {useHotelAuth} from '../components/AuthProvider';
import {Heading,Panel} from '../components/ui';
import {QueryFeedback} from '../components/QueryFeedback';
import {hotelToday} from '../features/reservations/calendarDate';
import {useNightAuditPreview} from '../api/nightAuditPreview';
import {NightAuditReviewPanel} from '../components/NightAuditReviewPanel';
import {FinancialBusinessDayPanel,useFinancialBusinessDay} from '../components/FinancialBusinessDayPanel';
import {NightAuditReconciliationPanel} from '../components/NightAuditReconciliationPanel';
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
 if(!hotelId||!user?.hotels.some(h=>h.id===hotelId&&h.role==='admin'))return <>
  <Heading title="Daily Closing" description="Manager-only operational and financial review."/>
  <Panel title="Restricted"><p>Ask an active administrator for this hotel to open Daily Closing and set up the business date.</p></Panel>
 </>;
 return <DailyClosing key={hotelId} hotelId={hotelId}/>;
}

function DailyClosing({hotelId}:{hotelId:string}){
 const financialDay=useFinancialBusinessDay(hotelId);
 const currentDate=financialDay.data?.businessDate;
 const [selectedDate,setDate]=useState<string|null>(null);
 const date=selectedDate??currentDate??hotelToday();
 const [showReport,setShowReport]=useState(false);
 useEffect(()=>{
  if(currentDate)setDate(selected=>selected??currentDate);
 },[currentDate]);
 const query=useNightAuditPreview(date,!financialDay.isPending);
 const data=query.data;
 return <>
  <Heading title="Daily Closing" description="Review hotel activity, check daily finances, and close the business date."/>
  <Panel title="Review daily activity">
   <div className="desk-tools">
    <label className="night-audit-date">Date to review
     <input type="date" className="wizard-input" value={date} max={data?.hotelDate??hotelToday()}
      onChange={e=>{if(e.target.value)setDate(e.target.value);}}/>
    </label>
    {currentDate&&date!==currentDate&&<button type="button" className="btn-inline" onClick={()=>setDate(currentDate)}>Review current business date</button>}
    <button type="button" className="btn-inline" onClick={()=>{
     const current=data?.hotelDate??hotelToday();
     const utc=new Date(current+'T00:00:00Z');
     utc.setUTCDate(utc.getUTCDate()-1);
     setDate(utc.toISOString().slice(0,10));
    }}>Review yesterday</button>
    <button type="button" className="btn-inline" disabled={financialDay.isPending||query.isFetching} onClick={()=>void query.refetch()}>
     <RefreshCw size={16}/> {query.isFetching?'Refreshing…':'Refresh checks'}
    </button>
   </div>
   <p className="desk-muted">Review activity, record the manager review, then close the financial day. Reviewing alone does not close the day.</p>
   <section className="night-review-panel" aria-label="Closing readiness">
    <div className="night-review-header"><ClipboardCheck size={20}/><div>
     <h3>{financialDay.isError?'Closing readiness unavailable':financialDay.isPending||financialDay.isFetching?'Checking closing readiness…':currentDate!==date?'Historical date review':financialDay.data?.canClose&&financialDay.data.blockers.length===0?'Ready to close':'Closing requires attention'}</h3>
     <p>{currentDate?'Current business date: '+currentDate:'No current business date available.'}{financialDay.data?' · Next date: '+financialDay.data.nextBusinessDate:''}</p>
    </div></div>
    {!financialDay.isError&&!financialDay.isFetching&&currentDate===date&&financialDay.data&&financialDay.data.blockers.length>0&&<div className="night-audit-issues">
     <h4>Resolve before closing ({financialDay.data.blockers.length})</h4>
     <ul>{financialDay.data.blockers.map(item=><li key={item}>{item}</li>)}</ul>
     <div className="night-audit-next-actions">
      {financialDay.data.openShiftIds?.map(shift=><Link key={shift} to="/cashier-shifts" search={{hotel:hotelId,shift}}>Review shift #{shift}</Link>)}
      {data&&data.pendingPaymentEvidence>0&&<Link to="/operational-exceptions">Review payment evidence</Link>}
      {financialDay.data.unresolvedNoShowBookings?.map(booking=><Link key={booking.id} to="/billing" search={{booking:booking.id,action:'no-show'}}>Review {booking.reference}</Link>)}
     </div>
    </div>}
    <div className="night-audit-next-actions">
     <a href="#daily-close-action">{financialDay.data?.canClose&&currentDate===date?'Go to close confirmation':'View closing requirements'}</a>
     <button type="button" className="btn-inline" disabled={financialDay.isFetching||query.isFetching} onClick={()=>{void Promise.all([financialDay.refetch(),query.refetch()]);}}>Refresh all readiness checks</button>
    </div>
   </section>
   <QueryFeedback loading={query.isPending} error={query.error}
    onRetry={()=>void query.refetch()}/>
   {data&&<>
    <div className="night-audit-headline">
     <div><CalendarDays size={18}/><strong>{new Intl.DateTimeFormat('en-PH',{dateStyle:'long',timeZone:'UTC'}).format(new Date(data.businessDate+'T00:00:00Z'))}</strong><span>Selected review date</span></div>
     <span className={data.preflightClear?'night-audit-pass':'night-audit-needs-review'}>
      {data.preflightClear?'Activity checks passed':'Action required'}
     </span>
    </div>
    <h3>1. Check hotel activity</h3>
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
     No operational exceptions found. Financial readiness is checked separately.</p>}
    <Exceptions label="Missing room-night charge" items={data.missingNightEntries}/>
    <Exceptions label="Duplicate room-night charge" items={data.duplicateNightEntries}/>
    <Exceptions label="Unpriced reservations" items={data.unpricedBookings}/>
    <div className="night-audit-next-actions">
     {(data.openCashierShifts>0||data.unreconciledCashierShifts>0)&&<Link to="/cashier-shifts"><Wallet size={16}/> Review cashier shifts</Link>}
     {data.pendingPaymentEvidence>0&&<Link to="/operational-exceptions">Review payment evidence</Link>}
    </div>
    <h3>2. Record manager review</h3>
    <NightAuditReviewPanel key={hotelId+'-'+data.businessDate} date={data.businessDate} preflight={data}/>
    <h3>3. Review daily finances</h3>
    <button type="button" className="btn-inline" aria-expanded={showReport} onClick={()=>setShowReport(v=>!v)}>{showReport?'Hide financial report':'View financial report and expenses'}</button>
    {showReport&&<NightAuditReconciliationPanel key={'reconciliation-'+hotelId} selectedDate={data.businessDate}/>}
    <h3 id="daily-close-action" className="scroll-mt-24">4. Close the business day</h3>
    <FinancialBusinessDayPanel selectedDate={data.businessDate} query={financialDay} onSelectDate={setDate}/>
    <details><summary>About these figures</summary><p className="night-audit-fineprint">The scheduled-night count is based on current reservation records, not historical physical room occupancy. Current inventory counts may differ from the inventory on the selected historical date. Payment totals are staff-maintained evidence, not settlement. The cashier and payment exception counts are current property-wide counts, not date-scoped historical snapshots.</p></details>
   </>}
  </Panel>
 </>;
}
