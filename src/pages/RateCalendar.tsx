import {useState,type FormEvent} from 'react';
import {useQuery,useMutation,useQueryClient} from '@tanstack/react-query';
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
 const [month,setMonth]=useState(()=>new Date().toISOString().slice(0,7));
 const [planId,setPlanId]=useState('');
 const [start,setStart]=useState(''),[end,setEnd]=useState('');
 const [name,setName]=useState(''),[amount,setAmount]=useState(''),[replace,setReplace]=useState(false),[notice,setNotice]=useState('');
 const plan=plans.data?.data.find(p=>p.id===planId&&p.active);
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
 const money=(n:number)=>new Intl.NumberFormat('en-PH',{style:'currency',currency:plan?.currency??'PHP',maximumFractionDigits:2}).format(n/100);
 const save=useMutation({mutationFn:()=>requestJson<{data:{nightsUpdated:number}}>(path+'/bulk-overrides',{method:'POST',body:{name:name.trim(),startsOn:start,endsOn:end,nightlyMinor:Math.round(Number(amount)*100),replaceExisting:replace,expectedRuleIds:conflicts.map(n=>n.ruleId)}}),onSuccess:async r=>{setNotice(r.data.nightsUpdated+' nightly overrides saved. Existing bookings are unchanged.');setStart('');setEnd('');setName('');setAmount('');setReplace(false);await Promise.all([client.invalidateQueries({queryKey:['rate-calendar',hotelId,planId]}),client.invalidateQueries({queryKey:['seasonal-rules',hotelId,planId]})]);}});
 const valid=!!plan&&calendar.isSuccess&&!calendar.isFetching&&!!start&&!!end&&start>=from&&end<to&&end>=start&&selected.length>0&&selected.length===(Date.parse(end)-Date.parse(start))/86400000+1&&!!name.trim()&&/^\d+(\.\d{1,2})?$/.test(amount)&&Number(amount)<=1000000000&&(!conflicts.length||replace)&&conflicts.every(n=>n.ruleId);
 function reset(){setStart('');setEnd('');setReplace(false);setNotice('');save.reset();}
 function changeMonth(m:string){reset();setMonth(m);}
 function selectNight(date:string){setNotice('');setReplace(false);save.reset();if(!start||start!==end){setStart(date);setEnd(date);}else{setStart(date<start?date:start);setEnd(date<start?start:date);}}
 function submit(e:FormEvent){e.preventDefault();if(valid&&!save.isPending)save.mutate();}
 const pad=(new Date(from+'T00:00:00Z').getUTCDay()+6)%7;
 return <>
  <Heading title="Rate calendar" description="Review public nightly prices and apply date-specific overrides." action={<Link to="/settings" className="btn-inline">Rate rules & policies</Link>}/>
  <p className="guest-info">Preview only. Changes do not affect existing or new live booking charges yet. Corporate and promotional rates are configured separately.</p>
  <QueryFeedback loading={plans.isPending||types.isPending} error={plans.error??types.error}/>
  <Panel title="Nightly pricing">
   <div className="rc-toolbar"><label className="wizard-label">Rate plan<select className="wizard-input" value={planId} disabled={save.isPending} onChange={e=>{reset();setPlanId(e.target.value);}}><option value="">Select rate plan</option>{plans.data?.data.filter(p=>p.active).map(p=><option key={p.id} value={p.id}>{types.data?.data.find(t=>t.id===p.roomTypeId)?.name??p.roomTypeId} · {p.name}</option>)}</select></label>
   <div className="rc-month"><button className="btn-inline" type="button" disabled={save.isPending} onClick={()=>changeMonth(shift(month,-1))} aria-label="Previous month">‹</button><strong>{new Date(from+'T00:00:00Z').toLocaleDateString('en-PH',{month:'long',year:'numeric',timeZone:'UTC'})}</strong><button className="btn-inline" type="button" disabled={save.isPending} onClick={()=>changeMonth(shift(month,1))} aria-label="Next month">›</button><button className="btn-inline" type="button" disabled={save.isPending} onClick={()=>changeMonth(new Date().toISOString().slice(0,7))}>This month</button></div></div>
   {plan&&<><p>Base rate: <strong>{money(plan.nightlyMinor)}</strong> / night</p><QueryFeedback loading={calendar.isPending} error={calendar.error}/><div className="rc-legend">{Object.entries(sourceLabels).map(([k,v])=><span key={k} className={'rc-tag rc-'+k}>{v}</span>)}</div>
    <p className="rc-hint">Click one night, then another to select an inclusive date range. You can also enter dates below.</p>
    <div className="rc-scroll"><div className="rc-grid">{['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d=><div className="rc-day-heading" key={d}>{d}</div>)}{Array.from({length:pad},(_,i)=><div key={'empty-'+i}/>)}{nights.map(n=><button key={n.date} type="button" disabled={save.isPending} aria-pressed={!!start&&!!end&&n.date>=start&&n.date<=end} aria-label={n.date+' '+money(n.amountMinor)+' '+(sourceLabels[n.source]??n.source)} className={'rc-night '+(start&&end&&n.date>=start&&n.date<=end?'rc-selected':'')} onClick={()=>selectNight(n.date)}><span>{Number(n.date.slice(-2))}</span><strong>{money(n.amountMinor)}</strong><small className={'rc-tag rc-'+n.source}>{sourceLabels[n.source]??n.source}</small></button>)}</div></div>
   </>}
  </Panel>
  {plan&&<Panel title="Bulk date override"><form onSubmit={submit}>
   <fieldset disabled={save.isPending} className="rc-fields"><label className="wizard-label">First night<input className="wizard-input" type="date" min={from} max={nights[nights.length-1]?.date} value={start} onChange={e=>{setStart(e.target.value);setReplace(false);setNotice('');}}/></label><label className="wizard-label">Last night (inclusive)<input className="wizard-input" type="date" min={start||from} max={nights[nights.length-1]?.date} value={end} onChange={e=>{setEnd(e.target.value);setReplace(false);setNotice('');}}/></label><label className="wizard-label">Rule name<input className="wizard-input" required maxLength={100} value={name} onChange={e=>setName(e.target.value)}/></label><label className="wizard-label">New nightly rate ({plan.currency})<input className="wizard-input" required inputMode="decimal" value={amount} onChange={e=>setAmount(e.target.value)}/></label></fieldset>
   <div className="rc-summary"><strong>{selected.length} night(s) selected</strong>{selected.length>0&&<span>Current subtotal: {money(selected.reduce((sum,n)=>sum+n.amountMinor,0))}</span>}{selected.length>0&&/^\d+(\.\d{1,2})?$/.test(amount)&&<span>New subtotal: {money(Math.round(Number(amount)*100)*selected.length)}</span>}</div>
   {conflicts.length>0&&<label className="guest-info"><input type="checkbox" checked={replace} disabled={save.isPending} onChange={e=>setReplace(e.target.checked)}/> Replace {conflicts.length} existing date override(s), preserving history.</label>}
   {save.error&&<p role="alert" className="auth-error">{save.error.message} <button type="button" className="btn-inline" onClick={()=>{setReplace(false);void calendar.refetch();}}>Refresh calendar</button></p>}{notice&&<p role="status" className="guest-info">{notice}</p>}
   <div className="rc-actions"><button className="btn-inline" type="button" disabled={save.isPending} onClick={reset}>Clear selection</button><button className="btn-primary" type="submit" disabled={!valid||save.isPending}>{save.isPending?'Saving…':'Apply nightly overrides'}</button></div>
  </form></Panel>}
 </>;
}
