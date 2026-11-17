import {useState} from 'react';
import {LiveFrontDesk} from './LiveFrontDesk';
import {Link} from '@tanstack/react-router';
import {ArrowLeft,ArrowRight,BedDouble,CalendarDays,LogIn,LogOut,Search,Users,AlertTriangle} from 'lucide-react';
import {useFrontDeskBoard} from '../api/queries';
import {dataMode} from '../api';
import {DemoNotice,Heading,Panel,Status} from '../components/ui';
import {QueryFeedback} from '../components/QueryFeedback';
import {dateLabel,statusLabel} from '../lib/format';
import {addDays,hotelToday} from '../features/reservations/calendarDate';
import {OperationPreview} from '../features/front-desk/OperationPreview';
import type {FrontDeskEntry} from '../api/types';
import type {DeskOperation} from '../features/front-desk/operations';

type QueueName='arrivals'|'departures'|'inHouse';
function MockFrontDesk(){
 const [date,setDate]=useState(hotelToday);
 const [queue,setQueue]=useState<QueueName>('arrivals');
 const [search,setSearch]=useState('');
 const [operation,setOperation]=useState<{entry:FrontDeskEntry;operation:DeskOperation}|null>(null);
 const board=useFrontDeskBoard(date);
 const data=board.data?.data;
 const current=data?.[queue]??[];
 const filtered=current.filter(entry=>[entry.reservation.primaryGuestName,entry.reservation.reference,entry.reservation.assignedRoomNumber??'',entry.reservation.roomTypeName].some(value=>value.toLowerCase().includes(search.trim().toLowerCase())));
 const tabs:[QueueName,string,number][]=[
  ['arrivals','Arrivals',data?.arrivals.length??0],
  ['departures','Departures',data?.departures.length??0],
  ['inHouse','In-house',data?.inHouse.length??0]
 ];
 return <><DemoNotice/><Heading title="Front desk" description="Review sample arrivals, departures, and in-house guests. Operational changes remain unavailable."/>
 <section className="desk-summary"><div className="desk-stat"><LogIn size={21}/><span>Expected arrivals</span><strong>{data?.arrivals.length??'—'}</strong></div><div className="desk-stat"><LogOut size={21}/><span>Due departures</span><strong>{data?.departures.length??'—'}</strong></div><div className="desk-stat"><Users size={21}/><span>In-house</span><strong>{data?.inHouse.length??'—'}</strong></div><div className="desk-stat"><BedDouble size={21}/><span>Assigned arrivals</span><strong>{data?.arrivals.filter(entry=>entry.room).length??'—'}</strong></div></section>
 <Panel title="Front desk work queue" action={<Link to="/reservations" className="text-link">View reservations</Link>}>
  <div className="desk-tools"><div className="desk-date-nav"><button className="icon-btn" aria-label="Previous date" onClick={()=>setDate(value=>addDays(value,-1))}><ArrowLeft size={16}/></button><button className="btn-inline" onClick={()=>setDate(hotelToday())}>Today</button><button className="icon-btn" aria-label="Next date" onClick={()=>setDate(value=>addDays(value,1))}><ArrowRight size={16}/></button><label><CalendarDays size={16}/><input type="date" value={date} aria-label="Front desk operational date" onChange={event=>setDate(event.target.value||hotelToday())}/></label></div>
  <span className="table-count">{dateLabel(date)} · Asia/Manila</span></div>
  <div className="desk-tab-row"><div className="view-switch" role="group" aria-label="Front desk queue">{tabs.map(([value,label,count])=><button key={value} className={queue===value?'selected':''} aria-pressed={queue===value} onClick={()=>setQueue(value)}>{label} <span className="desk-tab-count">{count}</span></button>)}</div>
  <label className="search-box"><Search size={16}/><input aria-label="Search front desk queue" placeholder="Find guest, reference or room" value={search} onChange={event=>setSearch(event.target.value)}/></label></div>
  <QueryFeedback loading={board.isPending} error={board.error} empty={!!board.data&&filtered.length===0}/>
  {board.data&&filtered.length>0&&<div className="table-scroll"><table><thead><tr><th>Guest & reference</th><th>Stay</th><th>Room</th><th>Status</th><th>Attention</th><th>Preview</th></tr></thead><tbody>{filtered.map(entry=>{
   const r=entry.reservation;
   const op:DeskOperation=queue==='departures'?'check_out':'check_in';
   const canPreview=(queue==='arrivals'||queue==='departures')&&dataMode==='mock';
   return <tr key={r.id}><td><strong>{r.primaryGuestName}</strong><span className="cell-note">{r.reference} · {r.roomTypeName}</span></td><td>{dateLabel(r.checkIn)} – {dateLabel(r.checkOut)}</td><td>{entry.room?.number??'Unassigned'}</td><td><Status value={statusLabel(r.status)}/></td><td>{entry.alerts.length>0?<span className="desk-attention"><AlertTriangle size={14}/> {entry.alerts.length} review item(s)</span>:<span className="desk-muted">Verify at desk</span>}</td><td>{canPreview?<button className="btn-inline" onClick={()=>setOperation({entry,operation:op})}>Preview {op==='check_in'?'check-in':'check-out'}</button>:<span className="desk-muted">{queue==='inHouse'?'View only':'Backend pending'}</span>}</td></tr>;
  })}</tbody></table></div>}
  <div className="desk-preview-note"><AlertTriangle size={17}/><p>Sample workflows are not permission or availability checks. Completing a checklist does not change reservation status, create a folio charge, move housekeeping tasks, or grant room access. Use the date picker to explore different sample arrival and departure days.</p></div>
 </Panel>
 {operation&&<OperationPreview key={operation.entry.reservation.id+'-'+operation.operation} entry={operation.entry} operation={operation.operation} onClose={()=>setOperation(null)}/>}
 </>;
}


export function FrontDesk(){
 return dataMode==='api'?<LiveFrontDesk/>:<MockFrontDesk/>;
}
