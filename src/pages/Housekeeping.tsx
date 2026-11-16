import {useState} from 'react';import {Search,ClipboardCheck} from 'lucide-react';
import {useHousekeeping} from '../api/queries';import {DemoNotice,Heading,Panel,Status} from '../components/ui';import {QueryFeedback} from '../components/QueryFeedback';import {statusLabel} from '../lib/format';
export function Housekeeping(){
 const [search,setSearch]=useState('');const q=useHousekeeping({search,perPage:50});
 return <><DemoNotice/><Heading title="Housekeeping" description="Sample tasks for cleaning, stayovers, and inspection. Task updates require the backend." action={<button disabled className="btn-primary"><ClipboardCheck size={16}/> Assign task (planned)</button>}/>
 <Panel title="Housekeeping tasks" action={<span className="table-count">{q.data?.meta.total??'—'} tasks</span>}><div className="table-toolbar"><label className="search-box"><Search size={17}/><input aria-label="Search housekeeping tasks" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search room, task or staff"/></label></div>
 <QueryFeedback loading={q.isPending} error={q.error} empty={q.data?.data.length===0}/>
 {q.data&&q.data.data.length>0&&<div className="table-scroll"><table><thead><tr><th>Room</th><th>Task</th><th>Assigned to</th><th>Status</th></tr></thead><tbody>{q.data.data.map(task=><tr key={task.id}><td><strong>Room {task.roomNumber}</strong></td><td>{statusLabel(task.type)}</td><td>{task.assignedTo??'Unassigned'}</td><td><Status value={statusLabel(task.status)}/></td></tr>)}</tbody></table></div>}</Panel></>;
}
