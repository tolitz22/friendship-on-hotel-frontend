import {useQueries,useQuery} from '@tanstack/react-query';
import {z} from 'zod';
import {Link} from '@tanstack/react-router';
import {dataMode} from '../api';
import type {ReactNode} from 'react';
import {NightAuditReconciliationPanel} from '../components/NightAuditReconciliationPanel';
import {useMemo,useState} from 'react';
import {Activity,BedDouble,CalendarDays,ClipboardCheck,Download,Wallet,Wrench} from 'lucide-react';
import {useReports} from '../api/queries';
import {useLiveManifest, type ManifestKind} from '../api/liveFrontDesk';
import {nightAuditReconciliationOptions} from '../api/nightAuditReconciliation';
import {getJson} from '../api/http';
import {hotelPath} from '../api/session';
import {useHotelAuth} from '../components/AuthProvider';
import {DemoNotice,Heading,Panel} from '../components/ui';
import {QueryFeedback} from '../components/QueryFeedback';
import {addDays,dayHeading,hotelToday} from '../features/reservations/calendarDate';
import {isReportRange} from '../features/reports/reportMath';
import {currency,dateLabel,statusLabel} from '../lib/format';
import type {ReportMetrics} from '../api/types';
const peso=(value:number)=>currency({amountMinor:value,currency:'PHP'});
const initialToday=()=>hotelToday();
function csvEscape(value:string|number){const s=String(value);return /[",\n]/.test(s)?'"'+s.replaceAll('"','""')+'"':s;}
function reportCsv(data:ReportMetrics,from:string,to:string){
 const rows:(string|number)[][]=[
  ['Friendship On Hotel - SAMPLE REPORT'],['Date range',from,to],
  ['This is illustrative mock data. Booking value is not revenue. Folio totals are not period-scoped.'],
  [],['Metric','Value'],['Arrivals (date filtered)',data.totalArrivals],['Indicative booking value (PHP)',data.bookingValueMinor/100],
  ['Current occupied rooms (snapshot)',data.roomSnapshot.occupied],['Current total rooms (snapshot)',data.roomSnapshot.total],
  ['Folio payment total (ALL sample records PHP)',data.folios.paymentsMinor/100],
  [],['Status','Arriving reservation count'],...data.reservationsByStatus.map(item=>[item.status,item.count]),
  [],['Arrival day','Reservation count'],...data.arrivalsByDay.map(item=>[item.date,item.count])
 ];
 return rows.map(row=>row.map(csvEscape).join(',')).join('\r\n');
}
function Metric({title,value,subtitle,icon}:{title:string;value:string;subtitle:string;icon:ReactNode}){
 return <div className="report-metric"><div><span>{title}</span>{icon}</div><strong>{value}</strong><small>{subtitle}</small></div>;
}
export function Reports(){
 return dataMode==='api'?<LiveReports/>:<SampleReports/>;
}

const reportViews=[
 ['finance','Financial reconciliation'],['operations','Front desk activity'],
 ['monthly','Monthly Performance'],['forecast','Next 14 Days'],
] as const;

function LiveReports(){
 const {hotelId,user}=useHotelAuth();
 const [view,setView]=useState<(typeof reportViews)[number][0]>('finance');
 const admin=user?.hotels.some(hotel=>hotel.id===hotelId&&hotel.role==='admin');

 return <>
  <Heading title="Reports" description="Review daily hotel operations and financial reconciliation."/>
  {admin&&<section className="report-controls" aria-label="Report views">
   <div className="view-switch" role="group" aria-label="Report view">
    {reportViews.map(([id,label])=><button key={id} type="button"
      className={view===id?'selected':undefined} aria-pressed={view===id}
      onClick={()=>setView(id)}>{label}</button>)}
   </div>
   <Link className="btn-inline" to="/occupancy-coverage">Occupancy report</Link>
  </section>}
  {(!admin||view==='finance')&&<NightAuditReconciliationPanel/>}
  {admin&&view==='operations'&&<FrontDeskActivityReport key={hotelId}/>}
  {admin&&hotelId&&view==='monthly'&&<MonthlyPerformance key={hotelId} hotelId={hotelId}/>}
  {admin&&hotelId&&view==='forecast'&&<BookingForecast key={hotelId} hotelId={hotelId}/>}
 </>;
}

function MonthlyPerformance({hotelId}:{hotelId:string}){
 const yesterday=addDays(hotelToday(),-1);
 const [month,setMonth]=useState(()=>yesterday.slice(0,7));
 const dates=/^\d{4}-(0[1-9]|1[0-2])$/.test(month)
  ?Array.from({length:31},(_,index)=>addDays(month+'-01',index))
   .filter(date=>date.startsWith(month+'-')&&date<=yesterday)
  :[];
 const reports=useQueries({queries:dates.map(date=>({
  ...nightAuditReconciliationOptions(hotelId,date,true),staleTime:60_000,
 }))});
 const unavailable='Unavailable';
 const money=(amount:number|null|undefined,code:string)=>amount==null
  ?unavailable:new Intl.NumberFormat('en-PH',{style:'currency',currency:code}).format(amount/100);
 return <Panel title="Monthly Performance">
  <div className="report-controls">
   <div className="report-date-inputs">
    <label>Month<input type="month" value={month} max={yesterday.slice(0,7)}
     onChange={event=>setMonth(event.target.value)}/></label>
   </div>
   <button type="button" className="btn-inline" disabled={!dates.length||reports.some(report=>report.isFetching)}
     onClick={()=>reports.forEach(report=>void report.refetch())}>Refresh</button>
  </div>
  <p className="report-hint">Room revenue is the posted movement for each business date. Corrections can relate to earlier stays. Official occupancy, ADR and RevPAR appear when the underlying room-night figures are verified.</p>
  {!dates.length?<p role="status">Choose a month with completed dates.</p>:<div className="table-scroll">
   <table>
    <thead><tr><th scope="col">Business date</th><th scope="col">Occupancy</th><th scope="col">Room revenue</th><th scope="col">ADR</th><th scope="col">RevPAR</th><th scope="col">Financial close</th></tr></thead>
    <tbody>{dates.map((date,index)=>{
     const report=reports[index]!;
     if(report.isPending||report.isError)return <tr key={date}><th scope="row">{dayHeading(date)}</th>
      <td colSpan={5}>{report.isError?'Could not load this date':'Loading…'}</td></tr>;
     const {kpis,currency:code,financialClose}=report.data;
     return <tr key={date}><th scope="row">{dayHeading(date)}</th>
      <td>{kpis.occupancyPercent===null?unavailable:kpis.occupancyPercent.toFixed(2)+'%'}</td>
      <td>{money(kpis.recognizedRoomRevenueMinor,code)}</td><td>{money(kpis.adrMinor,code)}</td>
      <td>{money(kpis.revparMinor,code)}</td><td>{statusLabel(financialClose.status)}</td>
     </tr>;
    })}</tbody>
   </table>
  </div>}
 </Panel>;
}

const count=z.number().int().nonnegative();
const forecastSchema=z.object({data:z.object({
 hotelId:z.string(),
 nights:z.array(z.object({date:z.iso.date(),sellable:count,reserved:count,blocked:count,
  groupHeld:count,remaining:count,arrivals:count,departures:count,overcommitted:z.boolean()})).length(14),
})});

function BookingForecast({hotelId}:{hotelId:string}){
 const today=hotelToday();
 const forecast=useQuery({
  queryKey:['live','booking-forecast',hotelId,today],
  retry:false,
  queryFn:async()=>{
   const {data}=forecastSchema.parse(await getJson<unknown>(hotelPath('/reports/booking-forecast')));
   if(data.hotelId!==hotelId||data.nights.some((night,index)=>night.date!==addDays(data.nights[0]!.date,index)))
    throw new Error('The booking forecast does not match the property or date range.');
   return data;
  },
 });
 return <Panel title="Next 14 Days">
  <div className="report-controls">
   <button type="button" className="btn-inline" disabled={forecast.isFetching}
    onClick={()=>void forecast.refetch()}>Refresh</button>
   <Link className="btn-inline" to="/room-calendar">Open Room Calendar</Link>
  </div>
  <p className="report-hint">Booked occupancy uses reservations divided by sellable rooms. Rooms left account for active maintenance blocks and group holds. Departures are scheduled, and housekeeping readiness is checked separately.</p>
  <QueryFeedback loading={forecast.isPending} error={forecast.error} onRetry={()=>void forecast.refetch()}/>
  {forecast.data&&!forecast.isError&&<div className="table-scroll">
   <table>
    <thead><tr><th scope="col">Date</th><th scope="col">Booked / sellable</th><th scope="col">Booked occupancy</th><th scope="col">Arrivals</th><th scope="col">Departures</th><th scope="col">Blocked</th><th scope="col">Group holds</th><th scope="col">Rooms left</th></tr></thead>
    <tbody>{forecast.data.nights.map(night=><tr key={night.date}>
     <th scope="row">{dayHeading(night.date)}</th><td>{night.reserved} / {night.sellable}</td>
     <td>{night.sellable?(night.reserved/night.sellable*100).toFixed(1)+'%':'Unavailable'}</td>
     <td>{night.arrivals}</td><td>{night.departures}</td><td>{night.blocked}</td><td>{night.groupHeld}</td>
     <td><strong>{night.remaining}</strong>{night.overcommitted&&<span className="cell-note">Room type overcommitted</span>}</td>
    </tr>)}</tbody>
   </table>
  </div>}
 </Panel>;
}

const frontDeskMetrics=[
 {kind:'arrivals',title:'Expected arrivals',description:'Confirmed arrivals for the selected date.'},
 {kind:'departures',title:'Due departures',description:'Checked-in stays due to depart on the selected date.'},
 {kind:'in_house',title:'In-house bookings',description:'Registered checked-in stays on the selected date.'},
] satisfies {kind:ManifestKind;title:string;description:string}[];

function FrontDeskActivityReport(){
 const [date,setDate]=useState(initialToday);
 return <Panel title="Front desk activity">
  <div className="report-controls">
   <div className="report-date-inputs">
    <label>Activity date<input type="date" value={date} onChange={event=>setDate(event.target.value)}/></label>
   </div>
   <button type="button" className="btn-inline" onClick={()=>setDate(initialToday())}>Today</button>
   <Link className="btn-inline" to="/front-desk">Open Front Desk</Link>
  </div>
  <p className="report-hint">Counts reflect current booking records for the selected date. Use the Occupancy report for physical room checks.</p>
  {isReportRange(date,date)?<div className="report-financial-grid">
   {frontDeskMetrics.map(metric=><FrontDeskReportMetric key={metric.kind} date={date} {...metric}/>)}
  </div>:<p role="alert">Choose a valid activity date.</p>}
 </Panel>;
}

function FrontDeskReportMetric({date,kind,title,description}:{
 date:string;kind:ManifestKind;title:string;description:string;
}){
 const query=useLiveManifest(date,kind,1,1);
 const count=query.data?.meta.queueTotal??query.data?.meta.total;
 return <div>
  <span>{title}</span>
  <QueryFeedback loading={query.isPending} error={query.error} onRetry={()=>void query.refetch()}/>
  {!query.error&&count!==undefined&&<strong>{count}</strong>}
  <p className="report-hint">{description}</p>
 </div>;
}

function SampleReports(){
 const [from,setFrom]=useState(()=>addDays(initialToday(),-29));
 const [to,setTo]=useState(initialToday);
 const valid=isReportRange(from,to);
 const q=useReports({from,to},valid);
 const data=q.data?.data;
 const maxStatus=Math.max(1,...(data?.reservationsByStatus.map(s=>s.count)??[]));
 const maxDay=Math.max(1,...(data?.arrivalsByDay.map(s=>s.count)??[]));
 const arrivalDays=useMemo(()=>data?.arrivalsByDay??[],[data]);
 function preset(days:number){const today=hotelToday();setTo(today);setFrom(addDays(today,1-days));}
 function exportCsv(){
  if(!data||!valid)return;
  const blob=new Blob([reportCsv(data,from,to)],{type:'text/csv;charset=utf-8'});
  const url=URL.createObjectURL(blob);
  const anchor=document.createElement('a');anchor.href=url;anchor.download='friendship-hotel-sample-report-'+from+'-to-'+to+'.csv';
  anchor.click();URL.revokeObjectURL(url);
 }
 return <><DemoNotice/>
  <Heading title="Reports & analytics" description="Explore sample operational reports with clearly separated date-based metrics and current-state snapshots." action={<button className="btn-primary" disabled={!data||!valid} onClick={exportCsv}><Download size={16}/> Export sample CSV</button>}/>
  <section className="report-controls">
   <div className="report-date-inputs"><label>From<input type="date" value={from} onChange={e=>setFrom(e.target.value)}/></label><label>To<input type="date" value={to} onChange={e=>setTo(e.target.value)}/></label></div>
   <div className="view-switch" role="group" aria-label="Report presets">{[7,30,90].map(days=><button key={days} onClick={()=>preset(days)}>{days} days</button>)}</div>
   <span className="table-count">Selected range is inclusive</span>
  </section>
  {!valid&&<p className="report-error" role="alert">Choose valid dates; “From” cannot be later than “To”.</p>}
  {valid&&<QueryFeedback loading={q.isPending} error={q.error}/>}
  {data&&valid&&<>
   <p className="report-notice"><Activity size={17}/> Illustration only. Date filters apply to reservation arrival dates and maintenance report dates. Room and housekeeping figures are current-state mock snapshots; folio totals cover all sample records.</p>
   <div className="report-metrics">
    <Metric title="Arriving reservations" value={String(data.totalArrivals)} subtitle="Check-in within selected dates" icon={<CalendarDays size={19}/>}/>
    <Metric title="Booking value" value={peso(data.bookingValueMinor)} subtitle="Non-cancelled arrivals; NOT revenue" icon={<Wallet size={19}/>}/>
    <Metric title="Rooms occupied" value={String(data.roomSnapshot.occupied)+' / '+data.roomSnapshot.total} subtitle={'Snapshot: '+dateLabel(q.data?.meta.roomSnapshotAsOf??'')} icon={<BedDouble size={19}/>}/>
    <Metric title="Maintenance reported" value={String(data.maintenance.reported)} subtitle="Work orders opened in date range" icon={<Wrench size={19}/>}/>
   </div>
   <div className="report-panels">
    <Panel title="Reservations by status · arrival date"><div className="report-bars">
     {data.reservationsByStatus.map(item=><div key={item.status} className="report-bar-row"><span>{statusLabel(item.status)}</span><div className="report-bar-track"><div style={{width:(item.count/maxStatus*100)+'%'}}/></div><strong>{item.count}</strong></div>)}
    </div></Panel>
    <Panel title="Arrivals by date"><div className="report-chart">
     {arrivalDays.length===0?<div className="report-empty">No arriving reservations in this sample period.</div>:arrivalDays.map(item=><div className="report-chart-column" key={item.date} title={dateLabel(item.date)+': '+item.count}><strong>{item.count}</strong><div style={{height:Math.max(8,item.count/maxDay*130)+'px'}}/><small>{item.date.slice(5)}</small></div>)}
    </div><p className="report-hint">Only dates with sample arrivals are shown. Counts do not represent occupied room nights.</p></Panel>
   </div>
   <div className="report-panels">
    <Panel title="Housekeeping · current task snapshot"><div className="report-mini-stats"><div><ClipboardCheck size={17}/><span>To do</span><strong>{data.housekeeping.todo}</strong></div><div><span>In progress</span><strong>{data.housekeeping.inProgress}</strong></div><div><span>Completed</span><strong>{data.housekeeping.done}</strong></div></div><p className="report-hint">Current task statuses, not productivity over the selected dates.</p></Panel>
    <Panel title="Maintenance · reported in selected dates"><div className="report-mini-stats"><div><span>Open</span><strong>{data.maintenance.open}</strong></div><div><span>In progress</span><strong>{data.maintenance.inProgress}</strong></div><div><span>Resolved</span><strong>{data.maintenance.resolved}</strong></div><div><span>Closed</span><strong>{data.maintenance.closed}</strong></div></div><p className="report-hint">{data.maintenance.highPriority} reported work orders are marked high or urgent. These statuses are current, not historical states at the reporting date.</p></Panel>
   </div>
   <section className="report-financial">
    <header><h3>Folio snapshot · all sample records</h3><span>Not filtered by date · Not a P&L report</span></header>
    <div className="report-financial-grid"><div><span>Sample charges</span><strong>{peso(data.folios.chargesMinor)}</strong></div><div><span>Recorded sample payments</span><strong>{peso(data.folios.paymentsMinor)}</strong></div><div><span>Open balances</span><strong>{peso(data.folios.balanceMinor)}</strong></div></div>
    <p>These figures summarize fictional folio records. Payment totals are not recognized revenue, and date-attributed sales, VAT, RevPAR, ADR, and financial occupancy metrics require a real ledger and explicit hotel reporting policies.</p>
   </section>
  </>}
 </>;
}
