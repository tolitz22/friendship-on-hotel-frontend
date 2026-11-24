import {useEffect,useState,type FormEvent} from 'react';
import {useQuery,useMutation,useQueryClient} from '@tanstack/react-query';
import {CalendarDays,ChevronLeft,ChevronRight,RefreshCw,SlidersHorizontal,Info,MousePointer2} from 'lucide-react';
import {useLiveProperty} from '../api/liveCatalogQueries';
import {hotelToday} from '../features/reservations/calendarDate';
import {Link} from '@tanstack/react-router';
import {useHotelAuth} from '../components/AuthProvider';
import {Heading,Panel} from '../components/ui';
import {QueryFeedback} from '../components/QueryFeedback';
import {useLiveRatePlans,useLiveRoomTypes} from '../api/liveReservations';
import {getJson,requestJson} from '../api/http';
import './RateCalendar.css';

type Night={date:string;amountMinor:number;source:string;ruleId:string|null};
type Quote={nightlyRates:Night[];currency:string;previewOnly:true;appliedToBookings:false};
const sourceLabels:Record<string,string>={base:'Base',weekend:'Weekend',seasonal:'Seasonal',holiday:'Holiday',date_override:'Override'};
const iso=(date:Date)=>date.toISOString().slice(0,10);
const monthStart=(month:string)=>month+'-01';
const shift=(month:string,n:number)=>{const d=new Date(monthStart(month)+'T00:00:00Z');d.setUTCMonth(d.getUTCMonth()+n);return iso(d).slice(0,7);};
export function RateCalendar(){
 const {hotelId,user}=useHotelAuth();
 const admin=!!user?.hotels.some(h=>h.id===hotelId&&h.role==='admin');
 return admin&&hotelId?<CalendarWorkspace key={hotelId} hotelId={hotelId}/>:<Heading title="Rate calendar" description="Select an authorized hotel manager account to manage rates."/>;
}
function CalendarWorkspace({hotelId}:{hotelId:string}){
 const plans=useLiveRatePlans(),types=useLiveRoomTypes(),client=useQueryClient();
 const property=useLiveProperty();
 const today=hotelToday(new Date(),property.data?.data.timeZone??'Asia/Manila');
 const [month,setMonth]=useState(()=>today.slice(0,7));
 const [planId,setPlanId]=useState('');
 const [start,setStart]=useState(''),[end,setEnd]=useState('');
 const [name,setName]=useState(''),[amount,setAmount]=useState(''),[replace,setReplace]=useState(false),[notice,setNotice]=useState('');
 const activePlans=plans.data?.data.filter(p=>p.active)??[];
 useEffect(()=>{if(plans.isSuccess&&!plans.data.data.some(p=>p.id===planId&&p.active)){setPlanId(plans.data.data.find(p=>p.active)?.id??'');setStart('');setEnd('');setReplace(false);}},[plans.data,plans.isSuccess,planId]);
 const plan=activePlans.find(p=>p.id===planId);
 const path='/hotels/'+encodeURIComponent(hotelId)+'/rate-plans/'+encodeURIComponent(planId);
 const key=['rate-calendar',hotelId,planId,month];
 const from=monthStart(month),to=monthStart(shift(month,1));
 const calendar=useQuery({queryKey:key,enabled:!!plan,queryFn:async()=>{
  const r=await getJson<{data:Quote}>(path+'/seasonal-preview',{roomTypeId:plan!.roomTypeId,checkIn:from,checkOut:to});
  if(!r.data.previewOnly||r.data.appliedToBookings!==false||r.data.nightlyRates.some(n=>n.date<from||n.date>=to))throw new Error('Unexpected calendar data.');
  return r.data;
 },retry:false});
 const nights=calendar.data?.nightlyRates??[];
 const selected=nights.filter(n=>start&&end&&n.date>=start&&n.date<=end);
 const conflicts=selected.filter(n=>n.source==='date_override');
 const conflictKey=conflicts.map(n=>n.ruleId).join(',');
 useEffect(()=>{setReplace(false);},[conflictKey]);
 const [anchor,setAnchor]=useState<string|null>(null);
 const currentTotal=selected.reduce((sum,n)=>sum+n.amountMinor,0);
 const amountValid=/^\d+(\.\d{1,2})?$/.test(amount)&&Number(amount)<=1000000000;
 const proposedTotal=amountValid?Math.round(Number(amount)*100)*selected.length:null;
 const money=(n:number)=>new Intl.NumberFormat('en-PH',{style:'currency',currency:plan?.currency??'PHP',minimumFractionDigits:0,maximumFractionDigits:2}).format(n/100);
 const save=useMutation({mutationFn:()=>requestJson<{data:{nightsUpdated:number}}>(path+'/bulk-overrides',{method:'POST',body:{name:name.trim(),startsOn:start,endsOn:end,nightlyMinor:Math.round(Number(amount)*100),replaceExisting:replace,expectedRuleIds:conflicts.map(n=>n.ruleId)}}),onSuccess:async r=>{setNotice(r.data.nightsUpdated+' nightly overrides saved. Existing bookings are unchanged.');setStart('');setEnd('');setAnchor(null);setName('');setAmount('');setReplace(false);await Promise.all([client.invalidateQueries({queryKey:['rate-calendar',hotelId,planId]}),client.invalidateQueries({queryKey:['seasonal-rules',hotelId,planId]})]);}});
 const valid=!!plan&&calendar.isSuccess&&!calendar.isFetching&&!!start&&!!end&&start>=from&&end<to&&end>=start&&selected.length>0&&selected.length===(Date.parse(end)-Date.parse(start))/86400000+1&&!!name.trim()&&/^\d+(\.\d{1,2})?$/.test(amount)&&Number(amount)<=1000000000&&(!conflicts.length||replace)&&conflicts.every(n=>n.ruleId);
 function reset(){setAnchor(null);setStart('');setEnd('');setName('');setAmount('');setReplace(false);setNotice('');save.reset();}
 function changeMonth(m:string){reset();setMonth(m);}
 function selectNight(date:string){setNotice('');setReplace(false);save.reset();if(anchor===null){setStart(date);setEnd(date);setAnchor(date);}else{setStart(date<anchor?date:anchor);setEnd(date<anchor?anchor:date);setAnchor(null);}}
 function submit(e:FormEvent){e.preventDefault();if(valid&&!save.isPending)save.mutate();}
 const pad=(new Date(from+'T00:00:00Z').getUTCDay()+6)%7;
 return <div className="rc-page">
  <Heading title="Rate calendar" description="Manage nightly room prices across your hotel." action={<Link to="/settings" className="btn-inline"><SlidersHorizontal size={16}/> Rate rules & policies</Link>}/>
  <div className="rc-preview-notice"><Info size={17}/><div><strong>Pricing preview</strong><span>Rate changes are saved but do not affect live booking charges yet.</span></div></div>
  <QueryFeedback loading={plans.isPending||types.isPending} error={plans.error??types.error}/>
  <section className="rc-controls panel" aria-label="Calendar controls">
   <label className="wizard-label">Room type & rate plan<select className="wizard-input" value={planId} disabled={save.isPending} onChange={e=>{reset();setPlanId(e.target.value);}}><option value="">Select rate plan</option>{activePlans.map(p=><option key={p.id} value={p.id}>{types.data?.data.find(t=>t.id===p.roomTypeId)?.name??p.roomTypeId} · {p.name}</option>)}</select></label>
   <div className="rc-month"><button className="btn-inline rc-icon" type="button" disabled={save.isPending} onClick={()=>changeMonth(shift(month,-1))} aria-label="Previous month"><ChevronLeft size={18}/></button><strong>{new Date(from+'T00:00:00Z').toLocaleDateString('en-PH',{month:'long',year:'numeric',timeZone:'UTC'})}</strong><button className="btn-inline rc-icon" type="button" disabled={save.isPending} onClick={()=>changeMonth(shift(month,1))} aria-label="Next month"><ChevronRight size={18}/></button><button className="btn-inline" type="button" disabled={save.isPending} onClick={()=>changeMonth(today.slice(0,7))}>Today</button><button className="btn-inline rc-icon" type="button" disabled={!plan||save.isPending||calendar.isFetching} aria-label="Refresh rates" onClick={()=>{setReplace(false);void calendar.refetch();}}><RefreshCw size={16}/></button></div>
  </section>
  {plans.isSuccess&&!activePlans.length&&<Panel title="No active rate plans"><p>Configure a room rate plan before managing nightly prices.</p><Link to="/settings" className="btn-inline">Hotel settings</Link></Panel>}
  {plan&&<>
   {calendar.isSuccess&&nights.length>0&&<div className="rc-metrics">
    <div><span>Base rate</span><strong>{money(plan.nightlyMinor)}</strong><small>Per night</small></div>
    <div><span>Monthly rate range</span><strong>{money(Math.min(...nights.map(n=>n.amountMinor)))} – {money(Math.max(...nights.map(n=>n.amountMinor)))}</strong><small>Public nightly prices</small></div>
    <div><span>Average nightly rate</span><strong>{money(Math.round(nights.reduce((sum,n)=>sum+n.amountMinor,0)/nights.length))}</strong><small>Configured prices, not actual ADR</small></div>
    <div><span>Date overrides</span><strong>{nights.filter(n=>n.source==='date_override').length}</strong><small>Of {nights.length} nights</small></div>
   </div>}
   <div className="rc-workspace">
    <Panel title="Nightly rates" action={<span className="rc-count">{selected.length?selected.length+' selected':'Select dates'}</span>}>
     <QueryFeedback loading={calendar.isPending} error={calendar.error}/>
     <div className="rc-legend">{Object.entries(sourceLabels).map(([k,v])=><span key={k} className={'rc-tag rc-'+k}>{v}</span>)}</div>
     <p className="rc-hint"><MousePointer2 size={14}/> {anchor?'Choose the last night, or click the same date for one night.':'Click a date to begin selecting a range.'}</p>
     <div className="rc-scroll"><div className="rc-grid">{['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d=><div className="rc-day-heading" key={d}>{d}</div>)}{Array.from({length:pad},(_,i)=><div className="rc-empty-day" key={'empty-'+i}/>)}{nights.map(n=><button key={n.date} type="button" disabled={save.isPending||calendar.isFetching} aria-pressed={!!start&&!!end&&n.date>=start&&n.date<=end} aria-label={n.date+' '+money(n.amountMinor)+' '+(sourceLabels[n.source]??n.source)} className={'rc-night rc-source-'+n.source+(start&&end&&n.date>=start&&n.date<=end?' rc-selected':'')+(n.date===today?' rc-today':'')} onClick={()=>selectNight(n.date)}><span className="rc-day-number">{Number(n.date.slice(-2))}{n.date===today&&<i aria-label="Today"/>}</span><strong>{money(n.amountMinor)}</strong><small className={'rc-tag rc-'+n.source}>{sourceLabels[n.source]??n.source}</small></button>)}</div></div>
     <p className="rc-hint rc-bottom-hint">Public rates only. Corporate and promotional rates are managed in Rate rules & policies.</p>
    </Panel>
    <Panel title="Update rates" action={selected.length>0?<button type="button" className="btn-inline" disabled={save.isPending} onClick={reset}>Clear</button>:undefined}>
     {notice&&<p role="status" className="guest-info">{notice}</p>}
     {!selected.length&&!start&&!end&&<div className="rc-selection-empty"><CalendarDays size={28}/><strong>Choose dates to update</strong><span>Select one or more consecutive nights on the calendar, or enter dates below.</span></div>}
     <form onSubmit={submit}>
      <fieldset disabled={save.isPending} className="rc-fields">
       <div className="rc-date-fields"><label className="wizard-label">First night<input className="wizard-input" type="date" min={from} max={nights[nights.length-1]?.date} value={start} onChange={e=>{setAnchor(null);setStart(e.target.value);setReplace(false);setNotice('');}}/></label><label className="wizard-label">Last night (inclusive)<input className="wizard-input" type="date" min={start||from} max={nights[nights.length-1]?.date} value={end} onChange={e=>{setAnchor(null);setEnd(e.target.value);setReplace(false);setNotice('');}}/></label></div>
       {selected.length>0&&<>
        <label className="wizard-label">Rule name<input className="wizard-input" required maxLength={100} placeholder="e.g. Holiday adjustment" value={name} onChange={e=>setName(e.target.value)}/></label>
        <label className="wizard-label">New nightly rate ({plan.currency})<input className="wizard-input" required inputMode="decimal" placeholder="0.00" value={amount} onChange={e=>setAmount(e.target.value)}/></label>
       </>}
      </fieldset>
      {start&&end&&end<start&&<p className="auth-error" role="alert">Last night must not be before the first night.</p>}
      {selected.length>0&&<div className="rc-summary"><div><span>Selected nights</span><strong>{selected.length}</strong></div><div><span>Current subtotal</span><strong>{money(currentTotal)}</strong></div><div className="rc-proposed"><span>New subtotal</span><strong>{proposedTotal===null?'—':money(proposedTotal)}</strong></div>{proposedTotal!==null&&<div><span>Difference</span><strong>{proposedTotal>currentTotal?'+':''}{money(proposedTotal-currentTotal)}</strong></div>}</div>}
      {conflicts.length>0&&<label className="rc-replace"><input type="checkbox" checked={replace} disabled={save.isPending} onChange={e=>setReplace(e.target.checked)}/><span><strong>Replace {conflicts.length} existing override(s)</strong><small>Previous rates will remain in history.</small></span></label>}
      {save.error&&<p role="alert" className="auth-error">{save.error.message} <button type="button" className="btn-inline" onClick={()=>{setReplace(false);void calendar.refetch();}}>Refresh calendar</button></p>}
      <button className="btn-primary rc-submit" type="submit" disabled={!valid||save.isPending}>{save.isPending?'Saving…':selected.length?'Apply rate to '+selected.length+' night'+(selected.length===1?'':'s'):'Apply rate'}</button>
      <p className="rc-hint">Changes apply to selected dates in this month only. Existing bookings remain unchanged.</p>
     </form>
    </Panel>
   </div>
  </>}
 </div>;
}
