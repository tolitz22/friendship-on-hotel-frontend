import {useEffect,useRef,useState,type FormEvent} from 'react';
import {createPortal} from 'react-dom';
import {useQueryClient} from '@tanstack/react-query';
import {X,UserPlus} from 'lucide-react';
import {createLiveGuest} from '../api/httpDataSource';
import {ApiError} from '../api/http';
import {useHotelAuth} from './AuthProvider';
import type {Guest} from '../api/types';

export function QuickGuestDialog({onClose,onCreated}:{
 onClose:()=>void;onCreated:(guest:Guest)=>void;
}){
 const {hotelId}=useHotelAuth();
 const client=useQueryClient();
 const [firstName,setFirstName]=useState('');
 const [lastName,setLastName]=useState('');
 const [email,setEmail]=useState('');
 const [phone,setPhone]=useState('');
 const [nationality,setNationality]=useState('');
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [fields,setFields]=useState<Record<string,string[]>>({});
 const firstInput=useRef<HTMLInputElement>(null);
 useEffect(()=>{
  firstInput.current?.focus();
  const previous=document.body.style.overflow;
  document.body.style.overflow='hidden';
  const onKey=(event:KeyboardEvent)=>{
   if(event.key==='Escape'&&!busy)onClose();
   if(event.key==='Tab'){
    const root=document.getElementById('quick-guest-dialog');
    const controls=Array.from(root?.querySelectorAll<HTMLElement>('input:not([disabled]), button:not([disabled])')??[]);
    if(!controls.length)return;
    const first=controls[0],last=controls[controls.length-1];
    if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
    else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
   }
  };
  window.addEventListener('keydown',onKey);
  return ()=>{document.body.style.overflow=previous;window.removeEventListener('keydown',onKey);};
 },[busy,onClose]);
 async function submit(event:FormEvent){
  event.preventDefault();
  if(busy||!hotelId)return;
  setError('');setFields({});setBusy(true);
  const originalHotel=hotelId;
  try{
   const response=await createLiveGuest({
    firstName:firstName.trim(),lastName:lastName.trim(),
    email:email.trim()||null,phone:phone.trim()||null,
    nationality:nationality.trim()||null,
   });
   if(originalHotel!==hotelId)return;
   await client.invalidateQueries({queryKey:['guests']});
   onCreated(response.data);
  }catch(cause){
   setError(cause instanceof Error?cause.message:'Unable to register guest.');
   if(cause instanceof ApiError)setFields(cause.fieldErrors??{});
  }finally{setBusy(false);}
 }
 const input=(name:string,field:string,required:boolean,value:string,set:(v:string)=>void,type='text')=>
  <label className="qg-field" key={field}>{name}
   <input ref={field==='firstName'?firstInput:undefined} type={type} required={required}
    maxLength={field==='email'?255:field==='phone'?40:field==='nationality'?100:120}
    value={value} disabled={busy} onChange={e=>set(e.target.value)}/>
   {fields[field]?.map((message,i)=><small role="alert" key={i}>{message}</small>)}
  </label>;
 return createPortal(<div className="qg-backdrop" role="presentation" onMouseDown={e=>{if(e.currentTarget===e.target&&!busy)onClose();}}>
  <section id="quick-guest-dialog" className="qg-dialog" role="dialog" aria-modal="true" aria-labelledby="quick-guest-title">
   <header className="qg-head"><div><span className="detail-kicker">NEW GUEST PROFILE</span>
    <h2 id="quick-guest-title">Register a guest</h2>
    <p>Stay on this booking. The guest will be selected automatically after saving.</p></div>
    <button type="button" className="btn-inline" aria-label="Close guest registration" disabled={busy} onClick={onClose}><X size={18}/></button>
   </header>
   <form onSubmit={e=>void submit(e)}>
    <div className="qg-fields">
     {input('First name','firstName',true,firstName,setFirstName)}
     {input('Last name','lastName',true,lastName,setLastName)}
     {input('Email (optional)','email',false,email,setEmail,'email')}
     {input('Phone (optional)','phone',false,phone,setPhone,'tel')}
     {input('Nationality (optional)','nationality',false,nationality,setNationality)}
    </div>
    {error&&<p role="alert" className="auth-error">{error}</p>}
    <footer className="qg-actions"><button type="button" className="btn-inline" disabled={busy} onClick={onClose}>Cancel</button>
     <button type="submit" className="btn-primary" disabled={busy}><UserPlus size={16}/>{busy?'Saving guest…':'Save and select guest'}</button>
    </footer>
   </form>
  </section>
 </div>,document.body);
}
