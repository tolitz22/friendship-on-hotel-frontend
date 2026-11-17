import {useEffect,useId,useRef,useState} from 'react';
import {Check,ChevronDown,Search,UserRound,X} from 'lucide-react';
import {useGuests} from '../api/queries';
import type {Guest} from '../api/types';

export function BookingGuestPicker({value,selectedGuest,disabled,onChange}:{
 value:string;selectedGuest?:Guest;disabled?:boolean;onChange:(id:string)=>void;
}){
 const [open,setOpen]=useState(false);
 const [input,setInput]=useState('');
 const [query,setQuery]=useState('');
 const [active,setActive]=useState(0);
 const root=useRef<HTMLDivElement>(null);
 const field=useRef<HTMLInputElement>(null);
 const id=useId();
 const listId=id+'-results';
 useEffect(()=>{
  const timeout=window.setTimeout(()=>setQuery(input.trim().slice(0,120)),250);
  return ()=>window.clearTimeout(timeout);
 },[input]);
 useEffect(()=>{setOpen(false);setInput('');setQuery('');setActive(0);},[selectedGuest?.id]);
 useEffect(()=>{
  const close=(e:PointerEvent)=>{
   if(root.current&&!root.current.contains(e.target as Node)){setOpen(false);setInput('');}
  };
  document.addEventListener('pointerdown',close);
  return ()=>document.removeEventListener('pointerdown',close);
 },[]);
 const search=useGuests({search:query||undefined,page:1,perPage:20});
 const matches=search.data?.data??[];
 const current=matches.findIndex(item=>item.id===value);
 const selectedIndex=active>=0&&active<matches.length?active:current>=0?current:0;
 const choose=(guest:Guest)=>{
  onChange(guest.id);setInput('');setOpen(false);setActive(0);
 };
 const show=()=>{
  if(disabled)return;
  setOpen(true);setActive(0);
  window.requestAnimationFrame(()=>field.current?.focus());
 };
 return <div className="booking-guest-picker" ref={root}>
  <button type="button" className="booking-guest-trigger" disabled={disabled}
   aria-expanded={open} aria-haspopup="listbox" aria-controls={open?listId:undefined}
   onClick={()=>open?(setOpen(false),setInput('')):show()}>
   <UserRound size={18} aria-hidden="true"/>
   <span className={selectedGuest?'booking-guest-selected':'booking-guest-placeholder'}>
    {selectedGuest?selectedGuest.firstName+' '+selectedGuest.lastName:'Search and select a guest'}
   </span>
   <ChevronDown size={17} className={open?'booking-guest-chevron open':'booking-guest-chevron'}/>
  </button>
  {open&&<div className="booking-guest-popover">
   <div className="booking-guest-search">
    <Search size={17} aria-hidden="true"/>
    <input ref={field} value={input} type="search" role="combobox"
     aria-label="Search hotel guests"
     aria-autocomplete="list" aria-expanded={open} aria-controls={listId}
     aria-activedescendant={matches.length?listId+'-'+selectedIndex:undefined}
     autoComplete="off" maxLength={120}
     placeholder="Type guest name, email or phone..."
     onChange={e=>{setInput(e.target.value);setActive(0);}}
     onKeyDown={e=>{
      if(e.key==='Escape'){e.preventDefault();setOpen(false);setInput('');}
      if(e.key==='ArrowDown'){e.preventDefault();setActive(x=>Math.min(x+1,matches.length-1));}
      if(e.key==='ArrowUp'){e.preventDefault();setActive(x=>Math.max(0,x-1));}
      if(e.key==='Enter'&&matches[selectedIndex]){e.preventDefault();choose(matches[selectedIndex]);}
     }}/>
    {input&&<button type="button" className="booking-guest-clear" aria-label="Clear search"
     onClick={()=>{setInput('');setActive(0);field.current?.focus();}}><X size={15}/></button>}
   </div>
   <div id={listId} className="booking-guest-results" role="listbox" aria-label="Matching guests">
    {search.isPending?<p role="status" className="booking-guest-message">Searching hotel guests…</p>:
     search.isError?<div role="alert" className="booking-guest-message">
      Could not search guests. <button type="button" className="btn-inline" onClick={()=>void search.refetch()}>Retry</button>
     </div>:matches.length===0?
      <p role="status" className="booking-guest-message">No guests found. Try another name or add a new guest.</p>:
      matches.map((guest,index)=><button key={guest.id} type="button"
       id={listId+'-'+index} role="option" aria-selected={guest.id===value}
       className={'booking-guest-option'+(index===selectedIndex?' active':'')}
       onMouseEnter={()=>setActive(index)} onClick={()=>choose(guest)}>
       <span className="booking-guest-avatar">{guest.firstName.slice(0,1).toUpperCase()}{guest.lastName.slice(0,1).toUpperCase()}</span>
       <span className="booking-guest-option-info">
        <strong>{guest.firstName} {guest.lastName}</strong>
        <small>{guest.email||guest.phone||'Guest profile'}</small>
       </span>
       {guest.id===value&&<Check size={17} aria-hidden="true"/>}
      </button>)}
   </div>
   {search.isSuccess&&<div className="booking-guest-footer">
    Showing {matches.length} of {search.data.meta.total} matching guests
    {search.data.meta.total>matches.length?' · Type more to narrow the results':''}
   </div>}
  </div>}
 </div>;
}
