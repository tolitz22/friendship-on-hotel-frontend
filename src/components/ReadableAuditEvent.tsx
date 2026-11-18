import {Clock3,History,UserRound} from 'lucide-react';
import {readableDate,readableDateTime,statusLabel} from '../lib/format';

type AuditEvent={
 id:string;actorId:string;action:string;before:Record<string,unknown>|null;
 after:Record<string,unknown>;note:string|null;createdAt:string;
};
type CashEvent={id:string;actorId:string;event:string;details:unknown;createdAt:string};
type Change={label:string;from:string|null;to:string};

const FIELDS:Record<string,string>={
 status:'Progress',priority:'Priority',type:'Task type',title:'Title',
 description:'Description',assignedTo:'Assigned staff',assignedUserId:'Assigned employee',
 dueAt:'Due date',completedAt:'Completed at',resolvedAt:'Resolved at',
 affectsRoom:'Room affected',roomNumber:'Room',note:'Note',
};
const DISPLAY_KEYS=new Set(Object.keys(FIELDS));
const INTERNAL_KEYS=new Set(['revision','updatedAt','createdAt','id','hotelId','roomId',
 'reportedAt','requestKey','password','token','secret','apiKey','email','phone']);
const money=(n:number)=>new Intl.NumberFormat('en-PH',{style:'currency',currency:'PHP'}).format(n/100);
const cleanText=(value:unknown,key:string):string=>{
 if(value===null||value===undefined||value==='')return 'Not set';
 if(typeof value==='boolean')return value?'Yes':'No';
 if(typeof value==='number')return String(value);
 if(typeof value!=='string')return 'Updated';
 if(key==='dueAt'||key==='completedAt'||key==='resolvedAt')return readableDateTime(value);
 if(key==='status'||key==='priority'||key==='type')return statusLabel(value);
 if(key==='assignedUserId')return value?'Staff member #'+value:'Unassigned';
 if(key==='assignedTo')return value||'Unassigned';
 return value.length>160?value.slice(0,160)+'…':value;
};
export function describeAuditChanges(before:Record<string,unknown>|null,after:Record<string,unknown>):Change[]{
 return Object.keys(after).filter(key=>DISPLAY_KEYS.has(key)&&!INTERNAL_KEYS.has(key)).flatMap(key=>{
  const old=before?.[key],next=after[key];
  // An initial snapshot shows assigned and selected details, not fabricated transitions.
  if(before!==null&&Object.is(old,next))return [];
  if(key==='note'&&(!next||next===''))return [];
  return [{
   label:FIELDS[key],
   from:before===null?null:cleanText(old,key),
   to:cleanText(next,key),
  }];
 });
}
const headline=(action:string):string=>{
 const labels:Record<string,string>={
  created:'Created this record',updated:'Updated the record',status_changed:'Changed work progress',
  assigned:'Changed the assignment',completed:'Completed the task',
  reopened:'Reopened the work order',resolved:'Marked repair resolved',
  closed:'Closed the record',
 };
 return labels[action]??statusLabel(action).replace(/_/g,' ');
};
const staff=(id:string,name?:string|null,currentId?:string|null)=>{
 if(name?.trim())return name;
 if(currentId&&id===currentId)return 'You';
 return 'Staff member #'+id;
};

export function ReadableAuditEvent({event,actorName,currentUserId}:{
 event:AuditEvent;actorName?:string|null;currentUserId?:string|null;
}){
 const changes=describeAuditChanges(event.before,event.after);
 return <article className="readable-audit-event">
  <div className="readable-audit-heading"><span className="readable-audit-icon"><History size={16}/></span>
   <div><strong>{headline(event.action)}</strong><span><UserRound size={13}/>
    {staff(event.actorId,actorName,currentUserId)} <span aria-hidden="true">·</span>
    <Clock3 size={13}/> {readableDateTime(event.createdAt)}</span></div></div>
  {changes.length>0?<dl className="readable-audit-changes">
   {changes.map(change=><div key={change.label}>
    <dt>{change.label}</dt>
    <dd>{change.from!==null&&<><span>{change.from}</span><span aria-label="changed to">→</span></>}
     <strong>{change.to}</strong></dd>
   </div>)}
  </dl>:<p className="readable-audit-context">
   {event.before===null?'Record was created.':'The action was recorded; no additional field changes are available.'}
  </p>}
  {event.note&&<p className="readable-audit-note"><strong>Staff note:</strong> {event.note}</p>}
 </article>;
}

type CashDetail={label:string;value:string};
const cashEventTitle=(event:string):string=>({
 opened:'Cashier shift opened',cash_received:'Cash payment recorded',
 submitted:'Cash counted and shift submitted',
 reconciled:'Manager reconciled the drawer',flagged:'Manager flagged a discrepancy',
}[event]??headline(event));
export function cashEventDetails(event:string,details:unknown):CashDetail[]{
 if(!details||typeof details!=='object'||Array.isArray(details))return [];
 const obj=details as Record<string,unknown>;
 const number=(key:string)=>typeof obj[key]==='number'&&Number.isSafeInteger(obj[key])
  ?money(obj[key] as number):null;
 const safe=(key:string)=>typeof obj[key]==='string'&&String(obj[key]).length<=120
  ?String(obj[key]):null;
 const result:CashDetail[]=[];
 if(event==='opened'&&number('openingFloatMinor')!==null)
  result.push({label:'Starting cash in drawer',value:number('openingFloatMinor')!});
 if(event==='cash_received'){
  if(number('amountMinor')!==null)result.push({label:'Cash payment',value:number('amountMinor')!});
  if(safe('bookingId')!==null)result.push({label:'Guest booking',value:'Booking #'+safe('bookingId')});
  if(safe('reference')!==null)result.push({label:'Receipt reference',value:safe('reference')!});
 }
 if(event==='submitted'){
  if(number('countedCashMinor')!==null)result.push({label:'Cash physically counted',value:number('countedCashMinor')!});
  if(number('expectedCashMinor')!==null)result.push({label:'Expected drawer total',value:number('expectedCashMinor')!});
  if(number('varianceMinor')!==null)result.push({label:'Difference',value:number('varianceMinor')!});
  if(typeof obj.receiptCount==='number')result.push({label:'Receipts included',value:String(obj.receiptCount)});
 }
 if(event==='reconciled'||event==='flagged'){
  if(number('varianceMinor')!==null)result.push({label:'Difference reviewed',value:number('varianceMinor')!});
  if(safe('note'))result.push({label:'Manager decision note',value:safe('note')!});
 }
 return result;
}
export function ReadableCashAuditEvent({event,actorName,currentUserId}:{
 event:CashEvent;actorName?:string|null;currentUserId?:string|null;
}){
 const details=cashEventDetails(event.event,event.details);
 return <article className="readable-audit-event">
  <div className="readable-audit-heading"><span className="readable-audit-icon"><History size={16}/></span>
   <div><strong>{cashEventTitle(event.event)}</strong><span><UserRound size={13}/>
    {staff(event.actorId,actorName,currentUserId)} <span aria-hidden="true">·</span>
    <Clock3 size={13}/> {readableDateTime(event.createdAt)}</span></div></div>
  {details.length>0?<dl className="readable-audit-changes">
   {details.map(detail=><div key={detail.label}><dt>{detail.label}</dt><dd><strong>{detail.value}</strong></dd></div>)}
  </dl>:<p className="readable-audit-context">Event recorded. No further details are available.</p>}
 </article>;
}
