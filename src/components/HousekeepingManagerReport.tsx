import {useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {RefreshCw} from 'lucide-react';
import {getHousekeepingManagerReport} from '../api/housekeepingManagerReport';
import type {HotelStaffMember} from '../api/liveStaff';
import type {HousekeepingQueue} from '../api/liveHousekeeping';
import {QueryFeedback} from './QueryFeedback';
const duration=(minutes:number|null)=>minutes===null?'—':minutes.toFixed(1)+' min';
export function HousekeepingManagerReport({hotelId,staff,onQueue}:{hotelId:string;staff:HotelStaffMember[];onQueue:(queue:HousekeepingQueue,assignee?:string)=>void}){
 const [days,setDays]=useState(7);
 const report=useQuery({queryKey:['live','housekeeping-manager-report',hotelId,days],queryFn:()=>getHousekeepingManagerReport(hotelId,days),retry:false,refetchInterval:60000,refetchIntervalInBackground:false});
 const data=report.isSuccess?report.data:null;
 const s=data?.summary;
 const metrics=[{label:'To do',value:s?.todo,queue:'active'},{label:'In progress',value:s?.inProgress,queue:'active'},
  {label:'Unassigned',value:s?.unassigned,queue:'unassigned'},{label:'Overdue',value:s?.overdue,queue:'overdue'},
  {label:'Pending inspection evidence',value:s?.pendingInspection,queue:'pending_inspection'}] as const;
 return <section className="hk-manager-handoff hk-manager-report" aria-label="Manager housekeeping overview">
  <div className="hk-work-heading"><div><span className="rr-eyebrow">MANAGER · OPERATIONS OVERVIEW</span><h3>Housekeeping performance</h3><p>Current workload and recorded daily activity. No routine approval required.</p></div>
   <button className="btn-inline" type="button" disabled={report.isFetching} onClick={()=>void report.refetch()}><RefreshCw size={16}/> Refresh</button></div>
  <div className="hk-work-metrics">{metrics.map(item=><button type="button" key={item.label} className="hk-manager-metric" disabled={!s} onClick={()=>onQueue(item.queue)}><span>{item.label}</span><strong>{item.value??'—'}</strong><small>View queue</small></button>)}</div>
  <label className="hk-assignee-filter">Performance period <select value={days} onChange={e=>setDays(Number(e.target.value))}><option value={1}>Today</option><option value={7}>Last 7 days</option><option value={14}>Last 14 days</option></select></label>
  <QueryFeedback loading={report.isPending} error={report.error} onRetry={()=>void report.refetch()}/>
  {data&&s&&<>
   <p className="desk-muted">Hotel date {data.hotelDate}. Workload is current; activity totals cover the selected period.</p>
   <div className="hk-board-summary">
    <div className="hk-board-summary-card"><span>Checkout cleans</span><strong>{s.checkoutCompleted}</strong></div>
    <div className="hk-board-summary-card"><span>Stayover services</span><strong>{s.stayoverCompleted}</strong></div>
    <div className="hk-board-summary-card"><span>Approved inspections</span><strong>{s.inspectionsCompleted}</strong></div>
    <div className="hk-board-summary-card"><span>Average cleaning elapsed time</span><strong>{duration(s.averageCleaningMinutes)}</strong><small>{s.cleaningSamples} of {s.checkoutCompleted+s.stayoverCompleted} cleans with start evidence</small></div>
    <div className="hk-board-summary-card"><span>Average checkout-to-inspection</span><strong>{duration(s.averageTurnoverMinutes)}</strong><small>{s.turnoverSamples} recorded turnovers</small></div>
   </div>
   <p className="desk-muted">Cleaning elapsed time runs from recorded start to completion, including interruptions. Turnover runs from checkout handoff to first approved inspection; neither is a measure of labor hours. Missing start evidence is excluded.</p>
   <h4>Staff activity & workload</h4>
   <div className="hk-report-table-wrap"><table className="hk-report-table"><thead><tr><th>Staff</th><th>To do</th><th>In progress</th><th>Overdue</th><th>Cleans</th><th>Avg elapsed</th><th>Queue</th></tr></thead>
    <tbody>{[...data.staff].sort((a,b)=>b.todo+b.inProgress-a.todo-a.inProgress).map(row=><tr key={row.userId??'unknown'}>
     <th>{row.userId?staff.find(m=>m.userId===row.userId)?.name??'Staff #'+row.userId:'Unassigned / unknown actor'}</th><td>{row.todo}</td><td>{row.inProgress}</td><td>{row.overdue}</td><td>{row.checkoutCompleted+row.stayoverCompleted}</td><td>{duration(row.averageCleaningMinutes)} ({row.cleaningSamples})</td>
     <td><button type="button" className="btn-inline" onClick={()=>onQueue(row.userId?'active':'unassigned',row.userId??undefined)}>Open queue</button></td></tr>)}</tbody></table></div>
   <p className="desk-muted">Completed work is credited to the recorded completion actor, not the current assignee. Duration samples are task elapsed times, not individual productivity rankings.</p>
   <h4>Daily performance</h4>
   <div className="hk-report-table-wrap"><table className="hk-report-table"><thead><tr><th>Hotel date</th><th>Checkout</th><th>Stayover</th><th>Inspections</th><th>Avg clean (n)</th><th>Avg turnover (n)</th></tr></thead><tbody>
    {data.daily.map(row=><tr key={row.date}><th>{row.date}</th><td>{row.checkoutCompleted}</td><td>{row.stayoverCompleted}</td><td>{row.inspectionsCompleted}</td><td>{duration(row.averageCleaningMinutes)} ({row.cleaningSamples})</td><td>{duration(row.averageTurnoverMinutes)} ({row.turnoverSamples})</td></tr>)}
   </tbody></table></div>
  </>}
 </section>;
}
