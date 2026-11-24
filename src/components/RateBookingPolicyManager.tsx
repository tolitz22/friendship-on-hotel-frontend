import {useState,type FormEvent} from 'react';
import {useQuery,useMutation,useQueryClient} from '@tanstack/react-query';
import {getJson,requestJson} from '../api/http';
import {useLiveRatePlans,useLiveRoomTypes,validLiveStay} from '../api/liveReservations';
import {Panel} from './ui';
import {QueryFeedback} from './QueryFeedback';

type Kind='none'|'fixed'|'first_night'|'percent'|'full';
type Policy={version:number;deposit_kind:Kind;deposit_value:number|string;free_cancel_days:number;late_cancel_kind:Kind;late_cancel_value:number|string;no_show_kind:Kind;no_show_value:number|string;reason:string};
type Charge={kind:Kind;value:string};
type Draft={deposit:Charge;late:Charge;noShow:Charge;days:string;reason:string;expectedVersion:number};
type Preview={policyVersion:number;currency:string;roomSubtotalMinor:number;depositRequiredMinor:number;remainingRoomSubtotalMinor:number;freeCancellationThrough:string;cancellationFeeMinor:number;noShowFeeMinor:number;freeCancellation:boolean;previewOnly:true;appliedToBookings:false};
const labels:Record<Kind,string>={none:'None',fixed:'Fixed amount',first_night:'First night',percent:'Percentage of room subtotal',full:'Full room subtotal'};
const charge=(kind:Kind='none',value:number|string=0):Charge=>({kind,value:String(Number(value)/100)});
const makeDraft=(p?:Policy):Draft=>({deposit:charge(p?.deposit_kind,p?.deposit_value),late:charge(p?.late_cancel_kind,p?.late_cancel_value),noShow:charge(p?.no_show_kind,p?.no_show_value),days:String(p?.free_cancel_days??1),reason:'',expectedVersion:p?.version??0});
const validCharge=(c:Charge)=>!['fixed','percent'].includes(c.kind)||(/^\d+(\.\d{1,2})?$/.test(c.value)&&Number(c.value)>0&&Number(c.value)<=(c.kind==='percent'?100:1000000000));
const units=(c:Charge)=>['fixed','percent'].includes(c.kind)?Math.round(Number(c.value)*100):0;
function ChargeField({label,value,onChange,currency}:{label:string;value:Charge;onChange:(c:Charge)=>void;currency:string}){
 return <div><label className="wizard-label">{label}<select className="wizard-input" value={value.kind} onChange={e=>onChange({kind:e.target.value as Kind,value:''})}>{Object.entries(labels).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label>
 {['fixed','percent'].includes(value.kind)&&<label className="wizard-label">{label} ({value.kind==='percent'?'%':currency})<input className="wizard-input" required inputMode="decimal" value={value.value} onChange={e=>onChange({...value,value:e.target.value})}/></label>}</div>;
}
export function RateBookingPolicyManager({hotelId}:{hotelId:string}){
 const plans=useLiveRatePlans(),types=useLiveRoomTypes(),client=useQueryClient();
 const [planId,setPlanId]=useState(''),[page,setPage]=useState(1),[draft,setDraft]=useState<Draft|null>(null);
 const [checkIn,setCheckIn]=useState(''),[checkOut,setCheckOut]=useState(''),[cancelDate,setCancelDate]=useState('');
 const [mode,setMode]=useState<'public'|'corporate'|'promotion'>('public'),[code,setCode]=useState('');
 const [preview,setPreview]=useState<Preview|null>(null),[notice,setNotice]=useState('');
 const plan=plans.data?.data.find(p=>p.id===planId);
 const path='/hotels/'+encodeURIComponent(hotelId)+'/rate-plans/'+encodeURIComponent(planId);
 const key=['rate-booking-policies',hotelId,planId];
 const current=useQuery({queryKey:[...key,1],enabled:!!plan,queryFn:()=>getJson<{data:{data:Policy[];last_page:number}}>(path+'/booking-policies',{page:1}),retry:false});
 const history=useQuery({queryKey:[...key,page],enabled:!!plan&&page!==1,queryFn:()=>getJson<{data:{data:Policy[];last_page:number}}>(path+'/booking-policies',{page}),retry:false});
 const latest=current.data?.data.data[0];
 const rows=(page===1?current.data:history.data)?.data.data??[];
 const money=(n:number)=>new Intl.NumberFormat('en-PH',{style:'currency',currency:plan?.currency??'PHP'}).format(n/100);
 const describe=(kind:Kind,v:number|string)=>kind==='fixed'?money(Number(v)):kind==='percent'?Number(v)/100+'%':labels[kind];
 const save=useMutation({mutationFn:(d:Draft)=>requestJson(path+'/booking-policies',{method:'POST',body:{expectedVersion:d.expectedVersion,depositKind:d.deposit.kind,depositValue:units(d.deposit),freeCancelDays:Number(d.days),lateCancelKind:d.late.kind,lateCancelValue:units(d.late),noShowKind:d.noShow.kind,noShowValue:units(d.noShow),reason:d.reason.trim()}}),onSuccess:async()=>{setDraft(null);setPreview(null);setNotice('New policy version saved. No booking charges changed.');setPage(1);await client.invalidateQueries({queryKey:key});}});
 const quote=useMutation({mutationFn:()=>getJson<{data:Preview}>(path+'/booking-policy-preview',{checkIn,checkOut,cancellationDate:cancelDate,corporateCode:mode==='corporate'?code.trim():undefined,promoCode:mode==='promotion'?code.trim():undefined}),onSuccess:r=>{if(r.data.previewOnly===true&&r.data.appliedToBookings===false)setPreview(r.data);}});
 const busy=save.isPending||quote.isPending;
 const valid=!!draft&&validCharge(draft.deposit)&&validCharge(draft.late)&&validCharge(draft.noShow)&&/^\d+$/.test(draft.days)&&Number(draft.days)<=365&&draft.reason.trim().length>=3;
 const previewValid=!!plan&&!!cancelDate&&cancelDate<checkOut&&validLiveStay({roomTypeId:plan.roomTypeId,checkIn,checkOut})&&(mode==='public'||/^[A-Za-z0-9_-]{1,40}$/.test(code.trim()));
 function submit(e:FormEvent){e.preventDefault();if(draft&&valid&&!busy)save.mutate(draft);}
 return <Panel title="Cancellation & deposit policies">
  <p className="guest-info">Preview only. Policies are saved per rate plan as immutable versions. Amounts are based on room subtotal before taxes and fees; no deposits, fees or refunds are posted.</p>
  <QueryFeedback loading={plans.isPending||types.isPending} error={plans.error??types.error}/>
  <label className="wizard-label">Policy rate plan<select className="wizard-input" value={planId} disabled={busy} onChange={e=>{setPlanId(e.target.value);setPage(1);setDraft(null);setPreview(null);setNotice('');save.reset();quote.reset();}}><option value="">Select rate plan</option>{plans.data?.data.filter(p=>p.active).map(p=><option key={p.id} value={p.id}>{types.data?.data.find(t=>t.id===p.roomTypeId)?.name??p.roomTypeId} · {p.name}</option>)}</select></label>
  {plan&&<>
   <QueryFeedback loading={current.isPending} error={current.error}/>
   {current.isSuccess&&<div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:12,flexWrap:'wrap',margin:'12px 0'}}><strong>{latest?'Current policy · v'+latest.version:'No policy configured'}</strong><button className="btn-primary" type="button" disabled={busy||!!draft} onClick={()=>{setNotice('');save.reset();setDraft(makeDraft(latest));}}>{latest?'Edit policy':'Configure policy'}</button></div>}
   {notice&&<p role="status" className="guest-info">{notice}</p>}
   {(save.error||quote.error)&&<p role="alert" className="auth-error">{(save.error??quote.error)?.message}</p>}
   {draft&&<form onSubmit={submit} style={{border:'1px solid var(--border,#ddd)',borderRadius:10,padding:12}}>
    <fieldset disabled={busy} style={{border:0,padding:0,margin:0}}><div className="wizard-fields">
     <ChargeField label="Required deposit" value={draft.deposit} currency={plan.currency} onChange={v=>setDraft({...draft,deposit:v})}/>
     <label className="wizard-label">Free cancellation days before arrival<input className="wizard-input" type="number" min={0} max={365} required value={draft.days} onChange={e=>setDraft({...draft,days:e.target.value})}/><small>Calendar days in the hotel timezone. Arrival-day cancellation is always late; zero means through the previous day.</small></label>
     <ChargeField label="Late cancellation fee" value={draft.late} currency={plan.currency} onChange={v=>setDraft({...draft,late:v})}/>
     <ChargeField label="No-show fee" value={draft.noShow} currency={plan.currency} onChange={v=>setDraft({...draft,noShow:v})}/>
     <label className="wizard-label">Reason for change<textarea className="wizard-input" required minLength={3} maxLength={500} value={draft.reason} onChange={e=>setDraft({...draft,reason:e.target.value})}/></label>
    </div></fieldset><div style={{display:'flex',justifyContent:'flex-end',gap:8,marginTop:12}}><button className="btn-inline" type="button" disabled={busy} onClick={()=>{setDraft(null);save.reset();}}>Cancel</button><button className="btn-primary" type="submit" disabled={busy||!valid}>{save.isPending?'Saving…':'Save policy version'}</button></div>
   </form>}
   {!!rows.length&&<div className="table-scroll"><table><thead><tr><th>Version</th><th>Deposit</th><th>Free cancellation</th><th>Late fee</th><th>No-show</th><th>Reason</th></tr></thead><tbody>{rows.map(p=><tr key={p.version}><td>v{p.version}{latest?.version===p.version?' · Current':''}</td><td>{describe(p.deposit_kind,p.deposit_value)}</td><td>{p.free_cancel_days} day(s) before arrival</td><td>{describe(p.late_cancel_kind,p.late_cancel_value)}</td><td>{describe(p.no_show_kind,p.no_show_value)}</td><td>{p.reason}</td></tr>)}</tbody></table></div>}
   {page!==1&&<QueryFeedback loading={history.isPending} error={history.error}/>}
   {(current.data?.data.last_page??0)>1&&<div className="bk-pager"><button className="btn-inline" type="button" disabled={page<=1||busy} onClick={()=>setPage(p=>p-1)}>Previous</button><span>Page {page}</span><button className="btn-inline" type="button" disabled={page>=(current.data?.data.last_page??1)||busy} onClick={()=>setPage(p=>p+1)}>Next</button></div>}
   {latest&&<div style={{marginTop:20}}><h3>Preview booking policy</h3><div className="wizard-fields">
    <label className="wizard-label">Check-in<input className="wizard-input" type="date" disabled={busy} value={checkIn} onChange={e=>{setCheckIn(e.target.value);setPreview(null);}}/></label>
    <label className="wizard-label">Check-out<input className="wizard-input" type="date" disabled={busy} value={checkOut} onChange={e=>{setCheckOut(e.target.value);setPreview(null);}}/></label>
    <label className="wizard-label">Hypothetical cancellation date<input className="wizard-input" type="date" disabled={busy} value={cancelDate} onChange={e=>{setCancelDate(e.target.value);setPreview(null);}}/></label>
    <label className="wizard-label">Rate eligibility<select className="wizard-input" disabled={busy} value={mode} onChange={e=>{setMode(e.target.value as typeof mode);setCode('');setPreview(null);}}><option value="public">Public rate</option><option value="corporate">Corporate</option><option value="promotion">Promotion</option></select></label>
    {mode!=='public'&&<label className="wizard-label">Eligibility code<input className="wizard-input" disabled={busy} value={code} maxLength={40} onChange={e=>{setCode(e.target.value);setPreview(null);}}/></label>}
   </div><button type="button" className="btn-inline" disabled={busy||!previewValid} onClick={()=>{setPreview(null);quote.mutate();}}>{quote.isPending?'Calculating…':'Preview policy'}</button>
   {preview&&<div className="table-scroll"><table><tbody><tr><th>Policy version</th><td>{preview.policyVersion}</td></tr><tr><th>Room subtotal</th><td>{money(preview.roomSubtotalMinor)}</td></tr><tr><th>Deposit required</th><td>{money(preview.depositRequiredMinor)}</td></tr><tr><th>Remaining room subtotal</th><td>{money(preview.remainingRoomSubtotalMinor)}</td></tr><tr><th>Free cancellation through</th><td>{preview.freeCancellationThrough}</td></tr><tr><th>Cancellation fee ({preview.freeCancellation?'Free cancellation':'Late cancellation'})</th><td>{money(preview.cancellationFeeMinor)}</td></tr><tr><th>No-show fee (alternative scenario)</th><td>{money(preview.noShowFeeMinor)}</td></tr></tbody></table></div>}</div>}
  </>}
 </Panel>;
}
