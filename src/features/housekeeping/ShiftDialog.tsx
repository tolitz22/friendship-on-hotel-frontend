import {useEffect,useId,useRef,type ReactNode} from 'react';
import {X} from 'lucide-react';
import './taskWorkspace.css';
import './shiftWorkspace.css';

export function ShiftDialog({title,context,busy=false,onClose,children,actions}:{
 title:string;context?:string;busy?:boolean;onClose:()=>void;children:ReactNode;actions?:ReactNode;
}){
 const id=useId();
 const ref=useRef<HTMLDialogElement>(null);
 useEffect(()=>{
  const dialog=ref.current;
  const previous=document.activeElement;
  dialog?.showModal();
  return ()=>{
   dialog?.close();
   if(previous instanceof HTMLElement&&previous.isConnected)previous.focus();
  };
 },[]);
 return <dialog ref={ref} className="hk-editor hk-shift-dialog" aria-labelledby={id}
  onCancel={event=>{event.preventDefault();if(!busy)onClose();}}>
  <header className="hk-editor-header">
   <div>{context&&<p>{context}</p>}<h2 id={id}>{title}</h2></div>
   <button type="button" className="icon-btn" onClick={onClose} disabled={busy} aria-label="Close dialog" autoFocus><X size={20}/></button>
  </header>
  <div className="hk-editor-content">{children}</div>
  {actions&&<footer className="hk-editor-footer"><div className="hk-editor-controls">{actions}</div></footer>}
 </dialog>;
}
