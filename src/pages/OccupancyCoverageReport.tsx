import {useEffect,useState} from 'react';
import {Link} from '@tanstack/react-router';
import {AlertTriangle,ArrowRight,CheckCircle2,ClipboardList,Info,RefreshCw,Search} from 'lucide-react';
import {useHotelAuth} from '../components/AuthProvider';
import {Heading,Panel} from '../components/ui';
import {QueryFeedback} from '../components/QueryFeedback';
import {useOccupancyCoverageReport} from '../api/occupancyCoverageReport';
import type {CoverageFilter,CoverageRow} from '../api/occupancyCoverageReport';
import {readableDate,readableDateTime} from '../lib/format';

const filters:{value:CoverageFilter;label:string}[]=[
 {value:'all',label:'All rooms'},
 {value:'missing',label:'Not assigned'},
 {value:'assigned',label:'Not observed'},
 {value:'needs_review',label:'Needs review'},
 {value:'mismatch',label:'Mismatches / unclear'},
 {value:'flagged',label:'Needs investigation'},
 {value:'verified',label:'Reviewed — matching'},
];
function statusFor(row:CoverageRow):{label:string;tone:'attention'|'danger'|'success'|'neutral';next:string}{
 if(row.status==='flagged')return{label:'Investigation needed',tone:'danger',next:'Manager to investigate separately and document the outcome.'};
 if(row.discrepancy==='unexpected_occupied')return{label:'Observed occupied · PMS vacant',tone:'danger',next:'Privately confirm the registration and physical observation.'};
 if(row.discrepancy==='expected_occupied_vacant')return{label:'Observed vacant · PMS occupied',tone:'danger',next:'Check guest departure and front-desk registration.'};
 if(row.discrepancy==='unverified')return{label:'Could not verify',tone:'attention',next:'Arrange a safe follow-up observation.'};
 if(row.status==='missing')return{label:'No check assigned',tone:'neutral',next:'Manager to assign a check if needed.'};
 if(row.status==='assigned')return{label:'Waiting for observation',tone:'neutral',next:'Assigned employee should report what can safely be observed.'};
 if(row.status==='submitted')return{label:'Waiting for manager review',tone:'attention',next:'A different manager must review the saved observation.'};
 return{label:'Reviewed · matches PMS snapshot',tone:'success',next:'No discrepancy in the original observation. Not proof of live occupancy.'};
}
export function OccupancyCoverageReport(){
 const {user,hotelId}=useHotelAuth();
 const manager=!!hotelId&&!!user?.hotels.some(h=>h.id===hotelId&&h.role==='admin');
 const [page,setPage]=useState(1);
 const [filter,setFilter]=useState<CoverageFilter>('all');
 const [date,setDate]=useState('');
 const [showDetails,setShowDetails]=useState(false);
 const report=useOccupancyCoverageReport(manager,page,filter,date||undefined);
 useEffect(()=>{setPage(1);setFilter('all');setDate('');setShowDetails(false);},[hotelId]);
 const summary=report.data?.summary;
 if(!manager)return <>
  <Heading title="Room occupancy report" description="Independent room checks are available to authorized hotel managers."/>
  <Panel title="Access restricted"><p>Only an authorized manager can view the hotel's observation reports.</p></Panel>
 </>;
 return <div className="occ-workspace">
  <div className="occ-page-heading">
   <div><span className="rr-eyebrow">ROOM OPERATIONS</span>
    <Heading title="Room occupancy report" description="See which rooms were checked, what differed from the PMS, and what still needs follow-up."/></div>
   <Link to="/occupancy-verification" className="btn-primary occ-nav-link"><ClipboardList size={16}/> Manage room checks <ArrowRight size={15}/></Link>
  </div>
  <div className="occ-guidance"><Info size={17}/><p>This is an <strong>independent physical observation report</strong>, not live occupancy or proof of fraud.
   Comparisons use the reservation records saved when each observation was made. Missing checks do not mean a room was vacant.</p></div>
  <section className="occ-report-section">
   <div className="occ-report-tools">
    <label>Report date
     <input className="wizard-input" type="date" value={date} max={summary?.hotelDate}
      onChange={e=>{setDate(e.target.value);setPage(1);}}/>
    </label>
    <button type="button" className="rr-secondary-action" disabled={report.isFetching}
     onClick={()=>void report.refetch()}><RefreshCw size={16}/>{report.isFetching?'Refreshing…':'Refresh'}</button>
   </div>
   <QueryFeedback loading={report.isPending} error={report.error} onRetry={()=>void report.refetch()}/>
   {summary&&<>
    <div className="occ-report-day"><strong>{readableDate(summary.inspectionDate)}</strong>
     <span>{summary.roomCount} registered rooms in the current room directory</span></div>
    <div className="occ-report-metrics">
     <div><small>Total rooms</small><strong>{summary.roomCount}</strong></div>
     <div><small>Observed</small><strong>{summary.observed}</strong><span>{summary.observationPercent}% of rooms</span></div>
     <div><small>Manager reviewed</small><strong>{summary.reviewed}</strong><span>Includes flagged investigations</span></div>
     <div className="occ-attention-metric"><small>Still needs action</small><strong>{summary.unresolved}</strong><span>Unassigned, pending, or flagged</span></div>
    </div>
    <div className="occ-discrepancy-summary">
     <AlertTriangle size={18}/><p><strong>{summary.unexpectedOccupied+summary.expectedOccupiedVacant} occupancy mismatches</strong>
      {' · '}{summary.unverified} observations could not be verified.
      These require follow-up, not automatic changes to bookings or room status.</p>
    </div>
    <div className="occ-report-filters">
     <div><h3>Room-by-room checks</h3><p>Filter to the cases you want to review.</p></div>
     <label>Show
      <select className="wizard-input" value={filter}
       onChange={e=>{setFilter(e.target.value as CoverageFilter);setPage(1);}}>
       {filters.map(option=><option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
     </label>
    </div>
    <p className="occ-list-count">{report.data?.meta.total??0} rooms in this view</p>
    <div className="occ-report-list">
     {report.data?.data.map(row=>{
      const state=statusFor(row);
      return <article className="occ-report-row" key={row.roomId}>
       <div className="occ-room-identity"><strong>Room {row.roomNumber}</strong>
        <small>{row.floor!==null?'Floor '+row.floor:'Floor not recorded'}</small></div>
       <div><span className={'occ-status occ-'+state.tone}>{state.label}</span>
        <p>{state.next}</p>
        {row.status!=='missing'&&<small>Assigned to {row.assignedName??'Employee name unavailable'}
         {row.observedAt?' · Observed '+readableDateTime(row.observedAt):''}</small>}
        {row.reviewedAt&&<small>Reviewed by {row.reviewerName??'Employee name unavailable'}
         {' · '}{readableDateTime(row.reviewedAt)}</small>}
       </div>
       <Link to="/occupancy-verification" className="occ-room-link">Open checks <ArrowRight size={15}/></Link>
      </article>;
     })}
    </div>
    {report.isSuccess&&report.data.data.length===0&&<div className="occ-empty">
     <Search size={22}/><strong>No rooms in this filter</strong><span>Try another category or report date.</span>
    </div>}
    {report.data&&report.data.meta.totalPages>1&&<div className="occ-pages">
     <span>Page {report.data.meta.page} of {report.data.meta.totalPages}</span>
     <div><button className="btn-inline" type="button" disabled={page<=1} onClick={()=>setPage(p=>p-1)}>Previous</button>
      <button className="btn-inline" type="button" disabled={page>=report.data.meta.totalPages}
       onClick={()=>setPage(p=>p+1)}>Next</button></div>
    </div>}
    <button className="occ-method-button" type="button" aria-expanded={showDetails} onClick={()=>setShowDetails(x=>!x)}>
     <Info size={16}/> {showDetails?'Hide':'Show'} report methodology
    </button>
    {showDetails&&<div className="occ-methodology">
     <p><strong>Assignment coverage:</strong> {summary.checked} assigned ({summary.coveragePercent}%). This does not mean those rooms were observed.</p>
     <p><strong>Observations:</strong> {summary.observed}. <strong>Reviewed:</strong> {summary.reviewed}.
      Matching observations: {summary.matching}; flagged investigations: {summary.flagged}.</p>
     <p>Historical reports use the <strong>current registered-room directory</strong>; rooms added or retired after the selected date can affect historical coverage counts. Recorded observation comparisons are never retroactively recalculated.</p>
     <p>Staff must follow the property's access and privacy procedures. Do not enter occupied guest rooms without appropriate authorization.</p>
    </div>}
   </>}
  </section>
 </div>;
}
