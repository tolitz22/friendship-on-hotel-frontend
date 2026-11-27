import {ArrowLeft,ArrowRight,CalendarDays,Clock3} from 'lucide-react';
import {addDays} from '../features/reservations/calendarDate';
import {dateLabel} from '../lib/format';

/** Date navigation shared by the manager overview and front desk. */
export function OperationalDateStrip({date,today,onChange,label,hidden=false,id}:{date:string;today:string;onChange:(value:string)=>void;label:string;hidden?:boolean;id?:string}){
 return <div id={id} className="fdc-date-strip" hidden={hidden}>
  <div className="desk-date-nav">
   <button type="button" className="icon-btn" aria-label="Previous date" onClick={()=>onChange(addDays(date,-1))}><ArrowLeft size={16}/></button>
   <button type="button" className="btn-inline" onClick={()=>onChange(today)}>Today</button>
   <button type="button" className="icon-btn" aria-label="Next date" onClick={()=>onChange(addDays(date,1))}><ArrowRight size={16}/></button>
   <label><CalendarDays size={16}/><input type="date" aria-label={label} value={date} onChange={event=>onChange(event.target.value||today)}/></label>
  </div>
  <span><Clock3 size={15}/> {dateLabel(date)} · Hotel-local date</span>
 </div>;
}
