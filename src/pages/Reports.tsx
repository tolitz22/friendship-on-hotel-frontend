import {useMemo,useState} from 'react';
import {Activity,BarChart3,BedDouble,CalendarDays,ClipboardCheck,Download,Wallet,Wrench} from 'lucide-react';
import {useReports} from '../api/queries';
import {DemoNotice,Heading,Panel} from '../components/ui';
import {QueryFeedback} from '../components/QueryFeedback';
import {addDays,hotelToday} from '../features/reservations/calendarDate';
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
function Metric({title,value,subtitle,icon}:{title:string;value:string;subtitle:string;icon:React.ReactNode}){
 return <div className="report-metric"><div><span>{title}</span>{icon}</div><strong>{value}</strong><small>{subtitle}</small></div>;
}
export function Reports(){
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
    <Metric title="Rooms occupied" value={String(data.roomSnapshot.occupied)+' / '+data.roomSnapshot.total} subtitle={'Snapshot: '+dateLabel(q.data.meta.roomSnapshotAsOf)} icon={<BedDouble size={19}/>}/>
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
