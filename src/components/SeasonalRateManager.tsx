import {useState,type FormEvent} from 'react';
import {useQuery,useMutation,useQueryClient} from '@tanstack/react-query';
import {getJson,requestJson} from '../api/http';
import {useLiveRatePlans,useLiveRoomTypes,validLiveStay} from '../api/liveReservations';
import {Panel} from './ui';
import {QueryFeedback} from './QueryFeedback';

type Rule={id:number|string;name:string;kind:'seasonal'|'date_override'|'weekend'|'holiday';weekend_days?:string|null;starts_on:string;ends_on:string;nightly_minor:number|string;retired_at:string|null};
type Draft={name:string;kind:Rule['kind'];startsOn:string;endsOn:string;amount:string;weekendDays:number[]};
type Preview={currency:string;roomSubtotalMinor:number;nightlyRates:{date:string;amountMinor:number;source:string}[];previewOnly:true;appliedToBookings:false};
const blank=():Draft=>({name:'',kind:'seasonal',startsOn:'',endsOn:'',amount:'',weekendDays:[5,6]});
export function SeasonalRateManager({hotelId}:{hotelId:string}){
 const plans=useLiveRatePlans(),types=useLiveRoomTypes(),client=useQueryClient();
 const [planId,setPlanId]=useState(''),[page,setPage]=useState(1);
 const [draft,setDraft]=useState<Draft|null>(null),[edit,setEdit]=useState<string|null>(null);
 const [retire,setRetire]=useState<Rule|null>(null);
 const [checkIn,setCheckIn]=useState(''),[checkOut,setCheckOut]=useState('');
 const [preview,setPreview]=useState<Preview|null>(null),[notice,setNotice]=useState('');
 const plan=plans.data?.data.find(p=>p.id===planId);
 const path='/hotels/'+encodeURIComponent(hotelId)+'/rate-plans/'+encodeURIComponent(planId);
 const key=['seasonal-rules',hotelId,planId];
 const rules=useQuery({queryKey:[...key,page],enabled:!!plan,queryFn:()=>getJson<{data:{data:Rule[];current_page:number;last_page:number;total:number}}>(path+'/rules',{page}),retry:false});
 const money=(minor:number|string)=>new Intl.NumberFormat('en-PH',{style:'currency',currency:plan?.currency??'PHP'}).format(Number(minor)/100);
 const save=useMutation({mutationFn:async(payload:{draft:Draft;edit:string|null})=>{
  const d=payload.draft;
  return requestJson(path+'/rules'+(payload.edit?'/'+payload.edit:''),{method:payload.edit?'PUT':'POST',body:{name:d.name.trim(),kind:d.kind,startsOn:d.startsOn,endsOn:d.kind==='date_override'?d.startsOn:d.endsOn,weekendDays:d.kind==='weekend'?d.weekendDays:undefined,nightlyMinor:Math.round(Number(d.amount)*100)}});
 },onSuccess:async()=>{setDraft(null);setEdit(null);setPreview(null);setNotice('Rate rule saved. Existing bookings are unchanged.');setPage(1);await client.invalidateQueries({queryKey:key});}});
 const retirement=useMutation({mutationFn:(id:string)=>requestJson(path+'/rules/'+id+'/retire',{method:'POST'}),onSuccess:async()=>{setRetire(null);setPreview(null);setNotice('Rate rule retired. History retained.');setPage(1);await client.invalidateQueries({queryKey:key});}});
 const quote=useMutation({mutationFn:()=>getJson<{data:Preview}>(path+'/seasonal-preview',{roomTypeId:plan!.roomTypeId,checkIn,checkOut}),onSuccess:r=>{if(r.data.previewOnly===true&&r.data.appliedToBookings===false)setPreview(r.data);}});
 const busy=save.isPending||retirement.isPending||quote.isPending;
 const valid=!!draft&&!!draft.name.trim()&&!!draft.startsOn&&(draft.kind==='date_override'||!!draft.endsOn&&draft.endsOn>=draft.startsOn)&&(draft.kind!=='weekend'||draft.weekendDays.length>0)&&/^\d+(\.\d{1,2})?$/.test(draft.amount)&&Number(draft.amount)<=1000000000;
 const error=save.error??retirement.error??quote.error;
 function submit(e:FormEvent){e.preventDefault();if(draft&&valid&&!busy)save.mutate({draft,edit});}
 function reset(){setDraft(null);setEdit(null);setRetire(null);setPreview(null);setNotice('');save.reset();retirement.reset();quote.reset();}
 return <Panel title="Seasonal, weekend & holiday rates">
  <p className="guest-info">Preview only. Seasonal rules do not change live booking charges yet. Priority: date override, holiday, seasonal, weekend, then base rate. Holidays are configured manually.</p>
  <QueryFeedback loading={plans.isPending||types.isPending} error={plans.error??types.error}/>
  <label className="wizard-label">Rate plan<select className="wizard-input" value={planId} disabled={busy} onChange={e=>{reset();setPlanId(e.target.value);setPage(1);}}>
   <option value="">Select a rate plan</option>{plans.data?.data.filter(p=>p.active).map(p=><option key={p.id} value={p.id}>{types.data?.data.find(t=>t.id===p.roomTypeId)?.name??p.roomTypeId} · {p.name}</option>)}
  </select></label>
  {plans.isSuccess&&!plans.data.data.some(p=>p.active)&&<p>No active rate plans are configured.</p>}
  {plan&&<>
   <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:12,flexWrap:'wrap',margin:'12px 0'}}><strong>Base rate: {money(plan.nightlyMinor)} / night</strong><button type="button" className="btn-primary" disabled={busy||!!draft||!!retire} onClick={()=>{reset();setDraft(blank());}}>Add rate rule</button></div>
   {notice&&<p role="status" className="guest-info">{notice}</p>}{error&&<p role="alert" className="auth-error">{error.message}</p>}
   {draft&&<form onSubmit={submit} style={{border:'1px solid var(--border,#ddd)',borderRadius:10,padding:12,marginBottom:12}}>
    <h3>{edit?'Edit rate rule':'New rate rule'}</h3>
    <fieldset disabled={busy} style={{border:0,padding:0,margin:0}}>
     <div className="wizard-fields">
      <label className="wizard-label">Rule name<input className="wizard-input" required maxLength={100} value={draft.name} onChange={e=>setDraft({...draft,name:e.target.value})}/></label>
      <label className="wizard-label">Rule type<select className="wizard-input" value={draft.kind} onChange={e=>setDraft({...draft,kind:e.target.value as Rule['kind']})}><option value="seasonal">Seasonal</option><option value="date_override">Single-date override</option><option value="weekend">Recurring weekend</option><option value="holiday">Holiday period</option></select></label>
      <label className="wizard-label">{draft.kind==='date_override'?'Date':'First night'}<input className="wizard-input" type="date" required value={draft.startsOn} onChange={e=>setDraft({...draft,startsOn:e.target.value})}/></label>
      {draft.kind!=='date_override'&&<label className="wizard-label">Last night (inclusive)<input className="wizard-input" type="date" required min={draft.startsOn} value={draft.endsOn} onChange={e=>setDraft({...draft,endsOn:e.target.value})}/></label>}
      {draft.kind==='weekend'&&<div><span className="wizard-label">Applicable weekdays</span><div style={{display:'flex',flexWrap:'wrap',gap:10}}>{['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map((day,i)=><label key={day}><input type="checkbox" checked={draft.weekendDays.includes(i+1)} onChange={e=>setDraft({...draft,weekendDays:e.target.checked?[...draft.weekendDays,i+1]:draft.weekendDays.filter(n=>n!==i+1)})}/>{day}</label>)}</div></div>}
      <label className="wizard-label">Nightly rate ({plan.currency})<input className="wizard-input" inputMode="decimal" required value={draft.amount} onChange={e=>setDraft({...draft,amount:e.target.value})}/></label>
     </div>
    </fieldset>
    <div style={{display:'flex',gap:8,justifyContent:'flex-end',marginTop:12}}><button type="button" className="btn-inline" disabled={busy} onClick={reset}>Cancel</button><button className="btn-primary" type="submit" disabled={!valid||busy}>{save.isPending?'Saving…':'Save rule'}</button></div>
   </form>}
   {retire&&<div role="group" aria-label="Confirm rate retirement" className="guest-info"><p>Retire {retire.name}? The rule will no longer apply to previews; its history will remain.</p><button type="button" className="btn-inline" disabled={busy} onClick={reset}>Cancel</button> <button type="button" className="btn-primary" disabled={busy} onClick={()=>retirement.mutate(String(retire.id))}>Confirm retirement</button></div>}
   <QueryFeedback loading={rules.isPending} error={rules.error} empty={rules.isSuccess&&rules.data.data.data.length===0} emptyMessage="No rate rules yet."/>
   {!!rules.data?.data.data.length&&<div className="table-scroll"><table><thead><tr><th>Rule</th><th>Dates</th><th>Nightly rate</th><th>Status</th><th>Actions</th></tr></thead><tbody>{rules.data.data.data.map(rule=><tr key={rule.id}><td><strong>{rule.name}</strong><br/><small>{rule.kind==='seasonal'?'Seasonal':rule.kind==='weekend'?'Weekend':rule.kind==='holiday'?'Holiday':'Date override'}</small></td><td>{rule.starts_on}{rule.starts_on!==rule.ends_on?' – '+rule.ends_on:''}</td><td>{money(rule.nightly_minor)}</td><td>{rule.retired_at?'Retired':'Active'}</td><td>{!rule.retired_at&&<><button type="button" className="btn-inline" disabled={busy||!!draft||!!retire} onClick={()=>{reset();setEdit(String(rule.id));setDraft({name:rule.name,kind:rule.kind,startsOn:rule.starts_on,endsOn:rule.ends_on,amount:(Number(rule.nightly_minor)/100).toFixed(2),weekendDays:rule.weekend_days?JSON.parse(rule.weekend_days):[5,6]});}}>Edit</button> <button type="button" className="btn-inline" disabled={busy||!!draft||!!retire} onClick={()=>{reset();setRetire(rule);}}>Retire</button></>}</td></tr>)}</tbody></table></div>}
   {(rules.data?.data.last_page??0)>1&&<div className="bk-pager"><button type="button" className="btn-inline" disabled={page<=1||busy} onClick={()=>setPage(p=>p-1)}>Previous</button><span>Page {page} of {rules.data?.data.last_page}</span><button type="button" className="btn-inline" disabled={page>=(rules.data?.data.last_page??1)||busy} onClick={()=>setPage(p=>p+1)}>Next</button></div>}
   <div style={{marginTop:20}}><h3>Preview nightly pricing</h3><div className="wizard-fields">
    <label className="wizard-label">Check-in<input className="wizard-input" type="date" value={checkIn} disabled={busy} onChange={e=>{setCheckIn(e.target.value);setPreview(null);}}/></label>
    <label className="wizard-label">Check-out<input className="wizard-input" type="date" value={checkOut} disabled={busy} onChange={e=>{setCheckOut(e.target.value);setPreview(null);}}/></label>
   </div><button type="button" className="btn-inline" disabled={busy||!validLiveStay({roomTypeId:plan.roomTypeId,checkIn,checkOut})} onClick={()=>{setPreview(null);quote.mutate();}}> {quote.isPending?'Calculating…':'Preview rates'}</button>
   {preview&&<div className="table-scroll"><table><thead><tr><th>Night</th><th>Rule</th><th>Price</th></tr></thead><tbody>{preview.nightlyRates.map(n=><tr key={n.date}><td>{n.date}</td><td>{n.source==='date_override'?'Date override':n.source==='seasonal'?'Seasonal':n.source==='weekend'?'Weekend':n.source==='holiday'?'Holiday':'Base rate'}</td><td>{money(n.amountMinor)}</td></tr>)}</tbody><tfoot><tr><th colSpan={2}>Room subtotal (preview)</th><th>{money(preview.roomSubtotalMinor)}</th></tr></tfoot></table></div>}</div>
  </>}
 </Panel>;
}
