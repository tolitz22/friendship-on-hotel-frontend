import {useEffect,useMemo,useRef,useState} from 'react';
import {LiveMaintenance} from './LiveMaintenance';
import {AlertTriangle,ClipboardList,History,RotateCcw,Search,ShieldAlert,Wrench,X} from 'lucide-react';
import {useMaintenanceBoard} from '../api/queries';
import {dataMode} from '../api';
import type {MaintenanceWorkOrder,WorkOrderStatus} from '../api/types';
import {DemoNotice,Heading,Status} from '../components/ui';
import {QueryFeedback} from '../components/QueryFeedback';
import {statusLabel} from '../lib/format';
import {applyWorkOrderDrafts,priorityRank,roomImpact,stages,type WorkOrderDraft} from '../features/maintenance/workOrders';

const openStatuses:WorkOrderStatus[]=['open','in_progress'];
function timestamp(value:string){return new Intl.DateTimeFormat('en-PH',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Manila'}).format(new Date(value));}
function MockMaintenance(){
 const query=useMaintenanceBoard(),data=query.data?.data;
 const [search,setSearch]=useState(''),[priority,setPriority]=useState('all'),[status,setStatus]=useState('active');
 const [selected,setSelected]=useState<string|null>(null),[note,setNote]=useState('');
 const [drafts,setDrafts]=useState<Record<string,WorkOrderDraft>>({});
 const closeRef=useRef<HTMLButtonElement>(null);
 const canEdit=dataMode==='mock';
 const orders=useMemo(()=>applyWorkOrderDrafts(data?.workOrders??[],drafts),[data,drafts]);
 const rooms=useMemo(()=>new Map((data?.rooms??[]).map(room=>[room.id,room])),[data]);
 const active=orders.filter(item=>openStatuses.includes(item.status));
 const displayed=orders.filter(item=>{
  const q=search.trim().toLowerCase();
  return (priority==='all'||item.priority===priority)&&
   (status==='all'||status==='active'&&openStatuses.includes(item.status)||status===item.status)&&
   (!q||[item.id,item.title,item.roomNumber,item.assignedTo??''].some(value=>value.toLowerCase().includes(q)));
 }).sort((a,b)=>priorityRank(a.priority)-priorityRank(b.priority)||b.reportedAt.localeCompare(a.reportedAt));
 const current=orders.find(item=>item.id===selected);
 const currentRoom=current?rooms.get(current.roomId):undefined;
 useEffect(()=>{
  if(!selected)return;
  const previous=document.activeElement instanceof HTMLElement?document.activeElement:null;
  closeRef.current?.focus();
  function keyboard(e:KeyboardEvent){
   if(e.key==='Escape')setSelected(null);
   if(e.key==='Tab'){
    const elements=document.querySelectorAll<HTMLElement>('[data-maintenance-dialog] button:not([disabled]),[data-maintenance-dialog] select:not([disabled]),[data-maintenance-dialog] textarea:not([disabled])');
    if(elements.length){
     const first=elements[0],last=elements[elements.length-1];
     if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}
     else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
    }
   }
  }
  window.addEventListener('keydown',keyboard);
  return ()=>{window.removeEventListener('keydown',keyboard);previous?.focus();};
 },[selected]);
 function update(item:MaintenanceWorkOrder,patch:Partial<WorkOrderDraft>){
  if(!canEdit)return;
  setDrafts(prev=>({...prev,[item.id]:{status:patch.status??prev[item.id]?.status??item.status,assignedTo:patch.assignedTo===undefined?(prev[item.id]?.assignedTo??item.assignedTo):patch.assignedTo,note:patch.note??prev[item.id]?.note??''}}));
 }
 function open(item:MaintenanceWorkOrder){setSelected(item.id);setNote(drafts[item.id]?.note??'');}
 return <><DemoNotice/><Heading title="Maintenance" description="Sample work orders, technician assignments, repair history and physical room impact."/>
 <div className="mnt-summary">
  <div><Wrench size={20}/><span>Active work orders</span><strong>{active.length}</strong></div>
  <div><ShieldAlert size={20}/><span>Urgent / high active</span><strong>{active.filter(x=>x.priority==='urgent'||x.priority==='high').length}</strong></div>
  <div><AlertTriangle size={20}/><span>Flagged room impact</span><strong>{active.filter(x=>x.affectsRoom).length}</strong></div>
  <div><History size={20}/><span>Resolved / closed</span><strong>{orders.filter(x=>!openStatuses.includes(x.status)).length}</strong></div>
 </div>
 <section className="mnt-board">
  <div className="mnt-toolbar">
   <label className="search-box"><Search size={17}/><input aria-label="Search maintenance work orders" placeholder="Order, issue, room or technician" value={search} onChange={e=>setSearch(e.target.value)}/></label>
   <label><span className="sr-only">Priority</span><select aria-label="Filter priority" value={priority} onChange={e=>setPriority(e.target.value)}><option value="all">All priorities</option>{['urgent','high','medium','low'].map(p=><option key={p} value={p}>{statusLabel(p)}</option>)}</select></label>
   <label><span className="sr-only">Status</span><select aria-label="Filter work order status" value={status} onChange={e=>setStatus(e.target.value)}><option value="active">Active orders</option><option value="all">All statuses / history</option>{stages.map(stage=><option key={stage.status} value={stage.status}>{stage.label}</option>)}</select></label>
   {Object.keys(drafts).length>0&&<button className="btn-inline mnt-reset" onClick={()=>{setDrafts({});setSelected(null);}}><RotateCcw size={15}/> Reset preview</button>}
  </div>
  <p className="mnt-notice"><AlertTriangle size={16}/> Mock-only changes to technician and status are temporary UI drafts. They do not update room availability, housekeeping or reservations.</p>
  <QueryFeedback loading={query.isPending} error={query.error} empty={!!query.data&&displayed.length===0}/>
  {query.data&&displayed.length>0&&<div className="mnt-order-grid">{displayed.map(order=>{
    const room=rooms.get(order.roomId),warnings=roomImpact(order,room);
    return <article className="mnt-order" key={order.id}>
      <div className="mnt-order-top"><strong>{order.id.toUpperCase()}</strong><span className={'mnt-priority mnt-priority-'+order.priority}>{statusLabel(order.priority)}</span></div>
      <h3>{order.title}</h3><p>{order.description}</p>
      <div className="mnt-order-tags"><Status value={statusLabel(order.status)}/><span>Room {order.roomNumber}</span></div>
      <div className="mnt-order-info"><span>Technician</span><strong>{order.assignedTo??'Unassigned'}</strong></div>
      <div className="mnt-order-info"><span>Reported</span><strong>{timestamp(order.reportedAt)}</strong></div>
      {warnings.length>0&&<div className="mnt-warning"><AlertTriangle size={15}/> {warnings.length} room-impact note(s)</div>}
      <button className="btn-inline mnt-review" onClick={()=>open(order)}>View work order <ClipboardList size={15}/></button>
    </article>;
  })}</div>}
 </section>
 {current&&<div className="mnt-overlay" onMouseDown={e=>{if(e.currentTarget===e.target)setSelected(null);}}>
   <section className="mnt-drawer" data-maintenance-dialog role="dialog" aria-modal="true" aria-labelledby="mnt-dialog-title">
    <header><div><small>MAINTENANCE · {canEdit?'MOCK PREVIEW':'READ ONLY'}</small><h2 id="mnt-dialog-title">{current.title}</h2></div><button className="icon-btn" ref={closeRef} aria-label="Close work order" onClick={()=>setSelected(null)}><X size={20}/></button></header>
    <p>{current.id.toUpperCase()} · Room {current.roomNumber} · {statusLabel(current.priority)} priority</p>
    <div className="mnt-facts"><div><span>Work-order status</span><Status value={statusLabel(current.status)}/></div><div><span>Physical room maintenance</span><Status value={statusLabel(currentRoom?.maintenanceStatus??'unknown')}/></div><div><span>Occupancy</span><Status value={statusLabel(currentRoom?.occupancyStatus??'unknown')}/></div><div><span>Housekeeping</span><Status value={statusLabel(currentRoom?.housekeepingStatus??'unknown')}/></div></div>
    {roomImpact(current,currentRoom).length>0&&<div className="mnt-impact"><AlertTriangle size={17}/><ul>{roomImpact(current,currentRoom).map(w=><li key={w}>{w}</li>)}</ul></div>}
    <label htmlFor="mnt-tech">Assigned technician</label><select className="wizard-input" id="mnt-tech" disabled={!canEdit} value={current.assignedTo??''} onChange={e=>update(current,{assignedTo:e.target.value||null})}><option value="">Unassigned</option>{data?.technicians.map(t=><option key={t.id} value={t.name}>{t.name}</option>)}</select>
    <label htmlFor="mnt-status">Preview work-order status</label><select className="wizard-input" id="mnt-status" disabled={!canEdit} value={current.status} onChange={e=>update(current,{status:e.target.value as WorkOrderStatus})}>{stages.map(stage=><option key={stage.status} value={stage.status}>{stage.label}</option>)}</select>
    <label htmlFor="mnt-note">Local handover note</label><textarea id="mnt-note" className="mnt-textarea" disabled={!canEdit} value={note} onChange={e=>setNote(e.target.value)} placeholder="Example: replacement part requested"/>
    <section className="mnt-history"><h3><History size={17}/> Sample maintenance history</h3>{current.history.map(entry=><div key={entry.id}><small>{timestamp(entry.at)}</small><span>{entry.message}</span></div>)}</section>
    <p className="mnt-note">Resolving a work order here does not release an out-of-order room or modify an inventory block. No history is added to the backend.</p>
    <footer><button className="btn-inline" onClick={()=>setSelected(null)}>Close</button>{canEdit&&<button className="btn-primary" onClick={()=>{update(current,{note});setSelected(null);}}>Apply locally</button>}</footer>
   </section>
 </div>}
 </>;
}


export function Maintenance(){
 return dataMode==='api'?<LiveMaintenance/>:<MockMaintenance/>;
}
