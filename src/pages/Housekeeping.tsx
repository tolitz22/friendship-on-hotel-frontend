import {useMemo,useState} from 'react';
import {AlertTriangle,ClipboardCheck,Filter,RotateCcw,Search,UserRound,CheckCircle2,Wrench} from 'lucide-react';
import type {DraftUpdate,TaskColumn} from '../features/housekeeping/board';
import {applyDrafts,columns,nextStatus,roomAlerts} from '../features/housekeeping/board';
import {useHousekeepingBoard} from '../api/queries';
import {dataMode} from '../api';
import {DemoNotice,Heading,Status} from '../components/ui';
import {QueryFeedback} from '../components/QueryFeedback';
import {statusLabel} from '../lib/format';

export function Housekeeping(){
 const board=useHousekeepingBoard();
 const [search,setSearch]=useState('');
 const [floor,setFloor]=useState('all');
 const [assignee,setAssignee]=useState('all');
 const [drafts,setDrafts]=useState<Record<string,DraftUpdate>>({});
 const [selected,setSelected]=useState<string|null>(null);
 const [note,setNote]=useState('');
 const data=board.data?.data;
 const tasks=useMemo(()=>applyDrafts(data?.tasks??[],drafts),[data,drafts]);
 const roomById=useMemo(()=>new Map((data?.rooms??[]).map(r=>[r.id,r])),[data]);
 const floors=Array.from(new Set((data?.rooms??[]).map(room=>room.floor))).sort((a,b)=>a-b);
 const staff=data?.staff??[];
 const filtered=tasks.filter(task=>{
  const room=roomById.get(task.roomId);
  const q=search.trim().toLowerCase();
  return (floor==='all'||room?.floor===Number(floor))&&(assignee==='all'||(assignee==='unassigned'?task.assignedTo===null:task.assignedTo===assignee))&&(!q||[task.roomNumber,task.type,task.assignedTo??'',task.status,room?.roomTypeName??''].some(value=>value.toLowerCase().includes(q)));
 });
 const chosen=tasks.find(task=>task.id===selected);
 const chosenRoom=chosen?roomById.get(chosen.roomId):undefined;
 const canDraft=dataMode==='mock';
 const isPreviewEdited=Object.keys(drafts).length>0;
 function editTask(taskId:string,patch:Partial<DraftUpdate>){
  if(!canDraft)return;
  const source=tasks.find(item=>item.id===taskId);
  if(!source)return;
  setDrafts(old=>({...old,[taskId]:{taskId,status:patch.status??source.status,assignedTo:patch.assignedTo===undefined?source.assignedTo:patch.assignedTo,note:patch.note??old[taskId]?.note??''}}));
 }
 function openTask(taskId:string){setSelected(taskId);setNote(drafts[taskId]?.note??'');}
 function reset(){setDrafts({});setSelected(null);setNote('');}
 return <><DemoNotice/>
  <Heading title="Housekeeping" description="Sample task board, staff assignments, room conditions, and inspection review."/>
  <div className="hk-headline">
   <div className="hk-stat"><ClipboardCheck size={19}/><span>All tasks</span><strong>{tasks.length}</strong></div>
   <div className="hk-stat"><AlertTriangle size={19}/><span>To do</span><strong>{tasks.filter(t=>t.status==='todo').length}</strong></div>
   <div className="hk-stat"><UserRound size={19}/><span>In progress</span><strong>{tasks.filter(t=>t.status==='in_progress').length}</strong></div>
   <div className="hk-stat"><CheckCircle2 size={19}/><span>Completed</span><strong>{tasks.filter(t=>t.status==='done').length}</strong></div>
  </div>
  <div className="hk-toolbar">
   <label className="search-box"><Search size={17}/><input value={search} onChange={e=>setSearch(e.target.value)} aria-label="Search housekeeping" placeholder="Search room, task, or staff"/></label>
   <label><Filter size={16}/><span className="sr-only">Floor filter</span><select aria-label="Filter by floor" value={floor} onChange={e=>setFloor(e.target.value)}><option value="all">All floors</option>{floors.map(f=><option key={f} value={String(f)}>Floor {f}</option>)}</select></label>
   <label><UserRound size={16}/><span className="sr-only">Assigned staff filter</span><select aria-label="Filter by assignee" value={assignee} onChange={e=>setAssignee(e.target.value)}><option value="all">All staff</option><option value="unassigned">Unassigned</option>{staff.map(person=><option key={person.id} value={person.name}>{person.name}</option>)}</select></label>
   {isPreviewEdited&&<button className="btn-inline" onClick={reset} title="Revert local sample changes"><RotateCcw size={15}/> Reset preview</button>}
  </div>
  <div className="hk-notice"><AlertTriangle size={17}/><span>All changes here are temporary <b>UI-only simulations</b>. Room housekeeping status, maintenance, occupancy, and reservation data are unchanged. Refreshing resets the preview.</span></div>
  <QueryFeedback loading={board.isPending} error={board.error} empty={!!board.data&&filtered.length===0}/>
  {board.data&&<div className="hk-board">{columns.map(col=>{
   const items=filtered.filter(task=>task.status===col.status);
   return <section key={col.status} className="hk-column" aria-label={col.label+' tasks'}>
    <header><div><span className={'hk-column-dot hk-dot-'+col.status}/><h3>{col.label}</h3></div><span className="hk-count">{items.length}</span></header>
    <div className="hk-task-list">{items.length===0?<p className="hk-column-empty">No matching tasks</p>:items.map(task=>{
     const room=roomById.get(task.roomId),alerts=roomAlerts(room),next=nextStatus(task.status);
     return <article key={task.id} className="hk-task">
      <div className="hk-task-top"><strong>Room {task.roomNumber}</strong><span className="hk-room-type">{room?.roomTypeName??'Unknown type'}</span></div>
      <p>{statusLabel(task.type)}</p><div className="hk-tag-line"><Status value={statusLabel(task.status)}/>{room&&<Status value={statusLabel(room.housekeepingStatus)}/>}</div>
      {alerts.length>0&&<div className="hk-alert"><AlertTriangle size={14}/> {alerts.length} room condition(s) to review</div>}
      <small className="hk-assignee">{task.assignedTo??'Unassigned'}</small>
      <div className="hk-task-actions"><button type="button" className="btn-inline" onClick={()=>openTask(task.id)}>Details</button>
       {canDraft&&next&&<button className="btn-inline" onClick={()=>editTask(task.id,{status:next})}>Preview → {statusLabel(next)}</button>}
      </div>
     </article>;
    })}</div>
   </section>;
  })}</div>}
  {data?.rooms.some(room=>room.maintenanceStatus!=='available')&&<section className="hk-maintenance"><h3><Wrench size={18}/> Maintenance review</h3><p>Maintenance flags do not change when a housekeeping task is completed.</p><div>{data.rooms.filter(room=>room.maintenanceStatus!=='available').map(room=><div key={room.id}><strong>Room {room.number}</strong><Status value={statusLabel(room.maintenanceStatus)}/></div>)}</div></section>}
  {chosen&&<div className="hk-overlay" onMouseDown={e=>{if(e.currentTarget===e.target)setSelected(null);}}>
   <section className="hk-drawer" role="dialog" aria-modal="true" aria-labelledby="hk-details-title">
    <div className="hk-drawer-top"><small>HOUSEKEEPING · {canDraft?'DEMO PREVIEW':'READ ONLY'}</small><button className="icon-btn" autoFocus aria-label="Close task details" onClick={()=>setSelected(null)}>×</button></div>
    <h2 id="hk-details-title">Room {chosen.roomNumber}</h2><p>{statusLabel(chosen.type)} · {chosenRoom?.roomTypeName??'Room type unavailable'}</p>
    <div className="hk-room-facts"><div><span>Task status</span><Status value={statusLabel(chosen.status)}/></div><div><span>Housekeeping condition (read only)</span><Status value={statusLabel(chosenRoom?.housekeepingStatus??'unknown')}/></div><div><span>Occupancy (read only)</span><Status value={statusLabel(chosenRoom?.occupancyStatus??'unknown')}/></div><div><span>Maintenance (read only)</span><Status value={statusLabel(chosenRoom?.maintenanceStatus??'unknown')}/></div></div>
    {roomAlerts(chosenRoom).length>0&&<div className="hk-drawer-alert"><AlertTriangle size={17}/><ul>{roomAlerts(chosenRoom).map(alert=><li key={alert}>{alert}</li>)}</ul></div>}
    <label htmlFor="hk-assignee">Assigned staff / team</label>
    <select id="hk-assignee" className="wizard-input" disabled={!canDraft} value={chosen.assignedTo??''} onChange={e=>editTask(chosen.id,{assignedTo:e.target.value||null})}><option value="">Unassigned</option>{staff.map(person=><option key={person.id} value={person.name}>{person.name}</option>)}</select>
    <label htmlFor="hk-status">Task progress</label>
    <select id="hk-status" className="wizard-input" disabled={!canDraft} value={chosen.status} onChange={e=>editTask(chosen.id,{status:e.target.value as TaskColumn})}>{columns.map(col=><option key={col.status} value={col.status}>{col.label}</option>)}</select>
    <label htmlFor="hk-note">Preview inspection / handover note</label>
    <textarea id="hk-note" className="hk-note" disabled={!canDraft} value={note} onChange={e=>setNote(e.target.value)} placeholder="Example: linen change inspected; maintenance still pending"/>
    <p className="hk-drawer-disclaimer">Notes and task updates are not saved. Changing task progress does not mark a room clean, available, or ready for check-in.</p>
    <div className="hk-drawer-actions"><button className="btn-inline" onClick={()=>setSelected(null)}>Close</button>{canDraft&&<button className="btn-primary" onClick={()=>{editTask(chosen.id,{note});setSelected(null);}}>Apply to local preview</button>}</div>
   </section>
  </div>}
 </>;
}
