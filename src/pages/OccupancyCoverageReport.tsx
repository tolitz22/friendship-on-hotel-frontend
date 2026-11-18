import {useEffect,useState} from 'react';
import {Link} from '@tanstack/react-router';
import {AlertTriangle,ClipboardList,RefreshCw,ShieldCheck} from 'lucide-react';
import {useHotelAuth} from '../components/AuthProvider';
import {Heading,Panel} from '../components/ui';
import {QueryFeedback} from '../components/QueryFeedback';
import {useOccupancyCoverageReport} from '../api/occupancyCoverageReport';
import type {CoverageFilter,CoverageRow} from '../api/occupancyCoverageReport';

const filters:{value:CoverageFilter;label:string}[]=[
 {value:'all',label:'All rooms'},
 {value:'missing',label:'No check assigned'},
 {value:'assigned',label:'Assigned, not observed'},
 {value:'needs_review',label:'Submitted, awaiting review'},
 {value:'mismatch',label:'Mismatch or unknown'},
 {value:'flagged',label:'Flagged for investigation'},
 {value:'verified',label:'Manager verified'},
];

function category(row:CoverageRow):string{
 if(row.status==='missing')return 'No check assigned';
 if(row.status==='assigned')return 'Awaiting observation';
 if(row.discrepancy==='unexpected_occupied')return 'Observed occupied · PMS vacant';
 if(row.discrepancy==='expected_occupied_vacant')return 'Observed vacant · PMS occupied';
 if(row.discrepancy==='unverified')return 'Unable to verify';
 if(row.status==='submitted')return 'Observation submitted · review pending';
 if(row.status==='flagged')return 'Flagged for investigation';
 if(row.status==='verified')return 'Reviewed and verified';
 return 'Observation matches PMS';
}
function Count({label,value}:{label:string;value:number|string}){
 return <div className="reservation-selection-summary" style={{display:'block'}}>
  <div><small>{label}</small><strong>{value}</strong></div>
 </div>;
}
export function OccupancyCoverageReport(){
 const {user,hotelId}=useHotelAuth();
 const manager=!!hotelId&&!!user?.hotels.some(h=>h.id===hotelId&&h.role==='admin');
 const [page,setPage]=useState(1);
 const [filter,setFilter]=useState<CoverageFilter>('all');
 const [date,setDate]=useState('');
 const [error,setError]=useState('');
 const report=useOccupancyCoverageReport(manager,page,filter,date||undefined);
 useEffect(()=>{setPage(1);setFilter('all');setDate('');setError('');},[hotelId]);
 const summary=report.data?.summary;
 if(!manager)return <>
  <Heading title="Occupancy coverage" description="Only property managers can view independent inspection coverage and reports."/>
  <Panel title="Restricted"><p>Only authorized staff can view this report.</p></Panel>
 </>;
 return <>
  <Heading title="Independent occupancy coverage"
   description="Review missing room checks, observed discrepancies and unresolved follow-ups without treating alerts as proof of misconduct."/>
  <Panel title="Coverage by hotel-local day">
   <div className="desk-tools">
    <label>Inspection date (hotel local)
     <input className="wizard-input" type="date" value={date}
      max={summary?.hotelDate} onChange={e=>{setDate(e.target.value);setPage(1);setError('');}}/>
    </label>
    <label>Show rooms
     <select className="wizard-input" value={filter}
      onChange={e=>{setFilter(e.target.value as CoverageFilter);setPage(1);}}>
      {filters.map(item=><option key={item.value} value={item.value}>{item.label}</option>)}
     </select>
    </label>
    <button type="button" className="btn-inline" onClick={()=>void report.refetch()}>
     <RefreshCw size={16}/> Refresh report</button>
   </div>
   <QueryFeedback loading={report.isPending} error={report.error}
    onRetry={()=>void report.refetch()}/>
   {summary&&<>
    <p className="desk-muted">Inspection date: {summary.inspectionDate} · Rooms in today's catalogue: {summary.roomCount}.
     Coverage includes assigned checks; observations completed are shown separately.</p>
    <div className="occupancy-coverage-stats">
     <Count label="Rooms" value={summary.roomCount}/>
     <Count label="Checks assigned" value={summary.checked}/>
     <Count label="Missing checks" value={summary.missing}/>
     <Count label="Observations completed" value={summary.observed}/>
     <Count label="Awaiting observation" value={summary.assigned}/>
     <Count label="Awaiting review" value={summary.submitted}/>
     <Count label="Flagged" value={summary.flagged}/>
     <Count label="Verified" value={summary.verified}/>
    </div>
    <p className="desk-muted">Assignment coverage {summary.coveragePercent}% · Observation coverage {summary.observationPercent}%.
     Reported occupied but PMS vacant: <strong>{summary.unexpectedOccupied}</strong>. PMS occupied but observed vacant:
     <strong> {summary.expectedOccupiedVacant}</strong>. Unable to verify: <strong>{summary.unverified}</strong>.</p>
   </>}
   <div className="desk-tools">
    <strong>{report.data?.meta.total??0} rooms in selected filter</strong>
    <Link className="btn-inline" to="/occupancy-verification"><ClipboardList size={15}/> Assign checks and review reports</Link>
   </div>
   {report.isSuccess&&report.data.data.length===0&&
    <p role="status">No rooms match the selected date and filter.</p>}
   <div className="occupancy-coverage-rows">
    {report.data?.data.map(room=><article key={room.roomId} className="ex-record">
     <div className="desk-tools">
      <strong>Room {room.roomNumber} {room.floor!==null?'· Floor '+room.floor:''}</strong>
      <span>{room.status.replaceAll('_',' ')}</span>
     </div>
     <p><strong>{category(room)}</strong></p>
     {room.verificationId&&<p className="desk-muted">
      Verification #{room.verificationId} · Assigned staff #{room.assignedUserId??'—'}
      {room.observedBy?' · Observed by #'+room.observedBy:''}
      {room.reviewedBy?' · Reviewed by #'+room.reviewedBy:''}
     </p>}
     {room.discrepancy&&<p className="desk-muted">
      Observed: {room.observedOccupancy??'not submitted'} · PMS record: {room.expectedOccupancy??'not recorded'}
     </p>}
    </article>)}
   </div>
   {report.data&&<div className="desk-tools">
    <span>Page {report.data.meta.page} of {Math.max(1,report.data.meta.totalPages)}</span>
    <div className="desk-date-nav">
     <button className="btn-inline" type="button" disabled={page<=1}
      onClick={()=>setPage(p=>p-1)}>Previous</button>
     <button className="btn-inline" type="button"
      disabled={page>=report.data.meta.totalPages}
      onClick={()=>setPage(p=>p+1)}>Next</button>
    </div>
   </div>}
   {error&&<p role="alert">{error}</p>}
  </Panel>
  <p className="desk-preview-note"><AlertTriangle size={16}/>
   Missing checks do not mean vacant rooms. Observations reflect their original inspection-time PMS snapshot,
   not subsequent booking changes. A flagged discrepancy requires an independent investigation; it is not proof of fraud.
   <ShieldCheck size={16}/> This report is manager-only and does not modify bookings or payments.</p>
 </>;
}
