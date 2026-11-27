import {Clock3,History,UserRound} from 'lucide-react';
import {readableDateTime,statusLabel} from '../lib/format';

type AuditEvent={
 id:string;actorId:string;actorName?:string|null;action:string;before:Record<string,unknown>|null;
 after:Record<string,unknown>;note:string|null;createdAt:string;
};
type CashEvent={id:string;actorId:string;actorName?:string|null;event:string;details:unknown;createdAt:string};
type Change={label:string;from:string|null;to:string};

const FIELDS:Record<string,string>={
 status:'Progress',role:'Hotel role',isActive:'Membership active',priority:'Priority',type:'Task type',title:'Title',
 description:'Description',assignedTo:'Assigned staff',assignedUserId:'Assigned employee',
 dueAt:'Due date',completedAt:'Completed at',resolvedAt:'Resolved at',
 affectsRoom:'Room affected',roomNumber:'Room',note:'Note',
 number:'Room number',floor:'Floor',name:'Name',maxOccupancy:'Maximum guests',roomTypeId:'Room category',
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
 if(key==='status'&&value==='todo')return 'To Do';
 if(key==='status'||key==='priority'||key==='type')return statusLabel(value);
 if(key==='assignedUserId')return value?'Assigned employee changed':'Unassigned';
 if(key==='assignedTo')return value||'Unassigned';
 if(key==='floor'&&value==='0')return 'Ground floor';
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
const checklistLabels:Record<string,string>={trash:'Remove trash',linens:'Replace bed linens',bed:'Make bed',bathroom:'Clean bathroom',towels:'Refresh towels',amenities:'Replenish amenities',floors:'Clean floors',surfaces:'Disinfect surfaces',fixtures:'Check fixtures'};
export function housekeepingAuditChanges(before:Record<string,unknown>|null,after:Record<string,unknown>,items?:readonly {key:string;label:string}[]):Change[]{
 const result:Change[]=[];
 const old=before?.checkedItems,next=after.checkedItems;
 if(Array.isArray(old)&&Array.isArray(next)){
  const label=(key:string)=>items?.find(item=>item.key===key)?.label??checklistLabels[key]??'Checklist item '+key;
  const added=next.filter((key):key is string=>typeof key==='string'&&!old.includes(key));
  const removed=old.filter((key):key is string=>typeof key==='string'&&!next.includes(key));
  for(const key of added)result.push({label:label(key),from:'Not checked',to:'Checked'});
  for(const key of removed)result.push({label:label(key),from:'Checked',to:'Unchecked'});
 }
 if(after.inspectionStatus==='approved'&&before?.inspectionStatus!=='approved')result.push({label:'Final inspection',from:null,to:'Physical checks verified'});
 if(after.completedBy!==undefined&&before?.status!=='done'&&after.status==='done')result.push({label:'Completion recorded',from:null,to:'By the employee shown above'});
 return result;
}
const headline=(action:string):string=>{
 const labels:Record<string,string>={
  created:'Created this record',updated:'Updated the record',status_changed:'Changed work progress',
  assigned:'Changed the assignment',completed:'Completed the task',
  reopened:'Reopened the work order',resolved:'Marked repair resolved',
  closed:'Closed the record',inspection_completed:'Completed final room inspection',
 };
 return labels[action]??statusLabel(action).replace(/_/g,' ');
};
export const auditActorName=(id:string,name?:string|null,currentId?:string|null,currentName?:string|null)=>{
 if(name?.trim())return name.trim();
 if(currentId&&id===currentId)return currentName?.trim()||'You';
 return 'Employee name unavailable';
};

export function ReadableAuditEvent({event,actorName,currentUserId,currentUserName,housekeepingChecklist,hotelTimeZone}:{
 event:AuditEvent;actorName?:string|null;currentUserId?:string|null;currentUserName?:string|null;housekeepingChecklist?:readonly {key:string;label:string}[];hotelTimeZone?:string;
}){
 const changes=[...describeAuditChanges(event.before,event.after),...housekeepingAuditChanges(event.before,event.after,housekeepingChecklist)];
 const eventTime = hotelTimeZone && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(event.createdAt)
  ?event.createdAt.replace(' ','T')+'Z':event.createdAt;
 const title=event.action==='updated'&&event.before?.status!==event.after.status?event.after.status==='done'?'Completed cleaning':event.after.status==='in_progress'?'Started cleaning':headline(event.action):event.action==='updated'&&changes.some(change=>change.to==='Checked'||change.to==='Unchecked')?'Updated cleaning checklist':headline(event.action);
 return <article className="readable-audit-event">
  <div className="readable-audit-heading"><span className="readable-audit-icon"><History size={16}/></span>
   <div><strong>{title}</strong><span><UserRound size={13}/>
    {auditActorName(event.actorId,event.actorName??actorName,currentUserId,currentUserName)} <span aria-hidden="true">·</span>
    <Clock3 size={13}/> <time dateTime={eventTime}>{readableDateTime(eventTime,hotelTimeZone)}</time></span></div></div>
  {changes.length>0?<dl className="readable-audit-changes">
   {changes.map(change=><div key={change.label}>
    <dt>{change.label}</dt>
    <dd>{change.from!==null&&<><span>{change.from}</span><span aria-label="changed to">→</span></>}
     <strong>{change.to}</strong></dd>
   </div>)}
  </dl>:<p className="readable-audit-context">
   {event.before===null?'Record was created.':'The action was recorded; no additional field changes are available.'}
  </p>}
  {event.note&&<p className="readable-audit-note"><strong>{event.action==='inspection_completed'?'Inspection note':housekeepingChecklist?'Handover note':'Staff note'}:</strong> {event.note}</p>}
 </article>;
}

type CashDetail={label:string;value:string};
const cashEventTitle=(event:string):string=>({
 opened:'Cashier shift opened',cash_received:'Cash payment recorded',expense_payout:'Recorded hotel expense payout',
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
  if(number('cashTenderedMinor')!==null)
   result.push({label:'Cash handed over',value:number('cashTenderedMinor')!});
  if(number('changeGivenMinor')!==null)
   result.push({label:'Change returned to guest',value:number('changeGivenMinor')!});
  if(number('netReceiptMinor')!==null)
   result.push({label:'Net cash kept in drawer',value:number('netReceiptMinor')!});
  else if(number('amountMinor')!==null)
   result.push({label:'Net cash payment (older receipt; tender/change not captured)',value:number('amountMinor')!});
  if(safe('bookingId')!==null)result.push({label:'Guest booking',value:'Booking #'+safe('bookingId')});
  if(safe('reference')!==null)result.push({label:'Receipt reference',value:safe('reference')!});
 }
 if(event==='expense_payout'){
  if(number('amountMinor')!==null)result.push({label:'Cash paid out',value:number('amountMinor')!});
  if(safe('payee'))result.push({label:'Payee',value:safe('payee')!});
  if(typeof obj.description==='string')result.push({label:'Purpose',value:obj.description.slice(0,255)});
  if(safe('expenseId'))result.push({label:'Expense voucher',value:'#'+safe('expenseId')});
 }
 if(event==='submitted'){
  if(number('expensePayoutTotalMinor')!==null)result.push({label:'Expense payouts included',value:number('expensePayoutTotalMinor')!});
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
export function ReadableCashAuditEvent({event,actorName,currentUserId,currentUserName}:{
 event:CashEvent;actorName?:string|null;currentUserId?:string|null;currentUserName?:string|null;
}){
 const details=cashEventDetails(event.event,event.details);
 return <article className="readable-audit-event">
  <div className="readable-audit-heading"><span className="readable-audit-icon"><History size={16}/></span>
   <div><strong>{cashEventTitle(event.event)}</strong><span><UserRound size={13}/>
    {auditActorName(event.actorId,event.actorName??actorName,currentUserId,currentUserName)} <span aria-hidden="true">·</span>
    <Clock3 size={13}/> {readableDateTime(event.createdAt)}</span></div></div>
  {details.length>0?<dl className="readable-audit-changes">
   {details.map(detail=><div key={detail.label}><dt>{detail.label}</dt><dd><strong>{detail.value}</strong></dd></div>)}
  </dl>:<p className="readable-audit-context">Event recorded. No further details are available.</p>}
 </article>;
}

type InspectionHistoryEvent={
 id:string;inspectionId:string;actorId:string;actorName?:string|null;
 action:'submitted'|'approved'|'rejected';details:Record<string,unknown>;createdAt:string;
};
export function ReadableInspectionAuditEvent({event,currentUserId,currentUserName}:{
 event:InspectionHistoryEvent;currentUserId?:string|null;currentUserName?:string|null;
}){
 const checks=event.details.checks;
 const isOneStepCompletion=event.action==='approved'&&checks!==null&&typeof checks==='object'&&!Array.isArray(checks);
 const action=event.action==='submitted'?'Submitted room inspection':
  event.action==='approved'?(isOneStepCompletion?'Completed room inspection':'Reviewed and approved room inspection'):'Rejected room inspection';
 const checklist=checks&&typeof checks==='object'&&!Array.isArray(checks)
  ?checks as Record<string,unknown>:null;
 const note=typeof event.details.note==='string'?event.details.note:null;
 const rows:Array<[string,unknown]>|null=checklist?[
  ['Cleanliness',checklist.cleaningVerified],
  ['Safety',checklist.safetyVerified],
  ['Room amenities',checklist.amenitiesVerified],
 ]:null;
 return <article className="readable-audit-event">
  <div className="readable-audit-heading"><span className="readable-audit-icon"><History size={16}/></span>
   <div><strong>{action}</strong><span><UserRound size={13}/>
    {auditActorName(event.actorId,event.actorName,currentUserId,currentUserName)}
    <span aria-hidden="true"> · </span><Clock3 size={13}/> {readableDateTime(event.createdAt)}</span></div></div>
  {rows&&<dl className="readable-audit-changes">{rows.map(([label,checked])=>
   <div key={String(label)}><dt>{label}</dt><dd><strong>{checked===true?'Checked and verified':checked===false?'Not verified':'Not recorded'}</strong></dd></div>)}</dl>}
  {note&&<p className="readable-audit-note"><strong>{isOneStepCompletion||event.action==='submitted'?'Inspection':'Review'} note:</strong> {note}</p>}
  {!rows&&!note&&<p className="readable-audit-context">Inspection decision recorded. No additional details were supplied.</p>}
 </article>;
}
