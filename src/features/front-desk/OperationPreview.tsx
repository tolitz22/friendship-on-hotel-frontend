import {useEffect,useRef,useState} from 'react';
import {CheckCircle2,AlertTriangle,X,ShieldCheck} from 'lucide-react';
import type {FrontDeskEntry} from '../../api/types';
import {dateLabel,statusLabel} from '../../lib/format';
import {Status} from '../../components/ui';
import {checklistFor,operationWarnings,type DeskChecklistKey,type DeskOperation} from './operations';

export function OperationPreview({entry,operation,onClose}:{entry:FrontDeskEntry;operation:DeskOperation;onClose:()=>void}){
 const [checked,setChecked]=useState<DeskChecklistKey[]>([]);
 const [complete,setComplete]=useState(false);
 const closeRef=useRef<HTMLButtonElement>(null);
 const items=checklistFor(operation);
 const warnings=operationWarnings(entry,operation);
 const title=operation==='check_in'?'Check-in':'Check-out';
 const allChecked=items.every(item=>checked.includes(item.key));
 useEffect(()=>{
  const previous=document.activeElement instanceof HTMLElement?document.activeElement:null;
  closeRef.current?.focus();
  function handler(e:KeyboardEvent){
   if(e.key==='Escape')onClose();
   if(e.key==='Tab'){
    const panel=document.querySelector<HTMLElement>('[data-front-desk-dialog]');
    const focusable=panel?.querySelectorAll<HTMLElement>('button:not([disabled]),input:not([disabled]),a[href]');
    if(focusable?.length){
     const first=focusable[0],last=focusable[focusable.length-1];
     if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}
     else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
    }
   }
  }
  window.addEventListener('keydown',handler);
  return ()=>{window.removeEventListener('keydown',handler);previous?.focus();};
 },[onClose]);
 return <div className="desk-modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}}>
  <section className="desk-modal" role="dialog" aria-modal="true" aria-labelledby="desk-operation-title" data-front-desk-dialog>
   <div className="desk-modal-heading"><div><small>SIMULATED OPERATION</small><h2 id="desk-operation-title">{title} preview</h2></div><button className="icon-btn" aria-label="Close operation preview" ref={closeRef} onClick={onClose}><X size={19}/></button></div>
   {!complete?<><p className="desk-modal-help">Review the mock checklist for {entry.reservation.primaryGuestName}. This workflow makes no changes to hotel data.</p>
   <div className="desk-guest-card"><strong>{entry.reservation.primaryGuestName}</strong><span>{entry.reservation.reference} · {entry.reservation.roomTypeName}</span><div><span>Room: {entry.room?.number??'Unassigned'}</span><Status value={statusLabel(entry.reservation.status)}/></div><small>{dateLabel(entry.reservation.checkIn)} – {dateLabel(entry.reservation.checkOut)}</small></div>
   {warnings.length>0&&<section className="desk-warnings" aria-label="Items needing attention"><h3><AlertTriangle size={16}/> Needs verification</h3>{warnings.map(w=><p key={w}>{w}</p>)}<small>These notices are illustrative. They do not enforce check-in or check-out eligibility.</small></section>}
   <fieldset className="desk-checklist"><legend>Staff checklist</legend>{items.map(item=><label key={item.key} className="desk-check-item"><input type="checkbox" checked={checked.includes(item.key)} onChange={e=>setChecked(previous=>e.target.checked?[...previous,item.key]:previous.filter(k=>k!==item.key))}/><span><strong>{item.label}</strong><small>{item.description}</small></span></label>)}</fieldset>
   <div className="desk-modal-footer"><button className="btn-inline" onClick={onClose}>Cancel</button><button className="btn-primary" disabled={!allChecked} onClick={()=>setComplete(true)}><ShieldCheck size={16}/> Complete demo walkthrough</button></div>
   </>:<div className="desk-completed" role="status"><CheckCircle2 size={39}/><h3>{title} preview complete</h3><p>This was only a simulated staff checklist. The reservation status, room assignment, occupancy, housekeeping, and folio have not changed.</p><button className="btn-primary" onClick={onClose}>Close preview</button></div>}
  </section>
 </div>;
}
