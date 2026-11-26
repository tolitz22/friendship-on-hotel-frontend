import {useState} from 'react';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {Settings2,Trash2} from 'lucide-react';
import {z} from 'zod';
import {getJson,requestJson} from '../api/http';
import {registeredDevice} from '../features/notifications/pushDevice';
import './PushPreferencesPanel.css';

const schema=z.object({enabled:z.boolean(),new_booking:z.boolean(),checkout_due:z.boolean(),checkout_overdue:z.boolean(),room_assignment:z.boolean(),guest_check_in:z.boolean().default(true),guest_check_out:z.boolean().default(true),booking_cancelled:z.boolean().default(true),booking_no_show:z.boolean().default(true),stay_extended:z.boolean().default(true),payment_recorded:z.boolean().default(true),payment_pending_review:z.boolean().default(true),payment_verified:z.boolean().default(true),payment_rejected:z.boolean().default(true),payment_voided:z.boolean().default(true),refund_requested:z.boolean().default(true),refund_verified:z.boolean().default(true),expense_recorded:z.boolean().default(true),expense_correction_requested:z.boolean().default(true),cashier_discrepancy:z.boolean().default(true)});
type Preferences=z.infer<typeof schema>;
const deviceSchema=z.object({id:z.string(),deviceName:z.string(),updatedAt:z.string()});
const categories=[
 ['new_booking','New bookings'],
 ['checkout_due','Checkout due today'],
 ['checkout_overdue','Overdue checkouts'],
 ['room_assignment','Arrivals needing a room'],
 ['guest_check_in','Guest check-ins'],
 ['guest_check_out','Guest checkouts'],
 ['booking_cancelled','Booking cancellations'],
 ['booking_no_show','No-show bookings'],
 ['stay_extended','Stay extensions'],
 ['payment_recorded','Payments recorded'],
 ['payment_pending_review','Payments awaiting verification'],
 ['payment_verified','Verified payments'],
 ['payment_rejected','Rejected payments'],
 ['payment_voided','Voided payments'],
 ['refund_requested','Refund requests'],
 ['refund_verified','Verified refund evidence'],
 ['expense_recorded','Expenses recorded'],
 ['expense_correction_requested','Expense correction requests'],
 ['cashier_discrepancy','Cashier discrepancies'],
] as const;

export function PushPreferencesPanel({userId,hotelId,onRemoveCurrent}:{userId:string;hotelId:string;onRemoveCurrent:()=>Promise<void>}){
 const [open,setOpen]=useState(false);
 const [draft,setDraft]=useState<Preferences|null>(null);
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState('');
 const [confirmId,setConfirmId]=useState<string|null>(null);
 const client=useQueryClient();
 const root='/hotels/'+encodeURIComponent(hotelId);
 const key=['push-preferences',hotelId,userId];
 const deviceKey=['push-devices',hotelId,userId];
 const prefs=useQuery({queryKey:key,enabled:open,queryFn:async()=>z.object({data:schema}).parse(await getJson<unknown>(root+'/push-preferences')).data,retry:false});
 const devices=useQuery({queryKey:deviceKey,enabled:open,queryFn:async()=>z.object({data:z.array(deviceSchema)}).parse(await getJson<unknown>(root+'/push-subscriptions')).data,retry:false});
 const value=draft??prefs.data;
 const current=registeredDevice(userId,hotelId)?.id;
 async function save(){
  if(!value)return;
  setBusy(true);setMessage('');
  try{
   const result=z.object({data:schema}).parse(await requestJson<unknown>(root+'/push-preferences',{method:'PUT',body:value})).data;
   client.setQueryData(key,result);setDraft(null);setMessage('Preferences saved.');
  }catch{setMessage('Could not save preferences. Try again.');}
  finally{setBusy(false);}
 }
 async function remove(id:string){
  setBusy(true);setMessage('');
  try{
   if(id===current)await onRemoveCurrent();
   else await requestJson(root+'/push-subscriptions/'+encodeURIComponent(id),{method:'DELETE'});
   await client.invalidateQueries({queryKey:deviceKey});setConfirmId(null);setMessage('Device removed.');
  }catch{setMessage('Could not remove this device. Try again.');}
  finally{setBusy(false);}
 }
 return <section className="push-preferences">
  <button type="button" className="btn-inline" aria-expanded={open} onClick={()=>{setOpen(v=>!v);setConfirmId(null);}}><Settings2 size={16} aria-hidden="true"/> {open?'Hide push settings':'Manage push settings'}</button>
  {open&&<div className="push-settings-content">
   <h3>Push preferences</h3>
   <p>Applies to your devices for this property. In-app alerts are not affected.</p>
   {prefs.isPending&&<p role="status">Loading preferences…</p>}
   {prefs.isError&&<p role="alert">Preferences unavailable. <button type="button" onClick={()=>void prefs.refetch()}>Retry</button></p>}
   {value&&<>
    <label className="push-setting"><span>All push notifications</span><input type="checkbox" checked={value.enabled} disabled={busy} onChange={e=>setDraft({...value,enabled:e.target.checked})}/></label>
    <fieldset disabled={!value.enabled||busy}><legend>Alert categories</legend>
     {categories.map(([kind,label])=><label key={kind} className="push-setting"><span>{label}</span><input type="checkbox" checked={value[kind]} onChange={e=>setDraft({...value,[kind]:e.target.checked})}/></label>)}
    </fieldset>
    <div className="push-setting-actions"><button type="button" className="btn-primary" disabled={!draft||busy} onClick={()=>void save()}>Save preferences</button>{draft&&<button type="button" className="btn-inline" disabled={busy} onClick={()=>setDraft(null)}>Cancel</button>}</div>
   </>}
   <h3>Registered devices</h3>
   {devices.isPending&&<p role="status">Loading devices…</p>}
   {devices.isError&&<p role="alert">Devices unavailable. <button type="button" onClick={()=>void devices.refetch()}>Retry</button></p>}
   {devices.data?.length===0&&<p>No registered devices.</p>}
   {devices.data?.map(device=><div className="push-device-row" key={device.id}>
    <div><strong>{device.deviceName}</strong>{device.id===current&&<small> · This browser</small>}<small className="push-device-date">Updated {new Date(device.updatedAt).toLocaleDateString()}</small></div>
    {confirmId===device.id?<div className="push-setting-actions"><button type="button" disabled={busy} onClick={()=>void remove(device.id)}>Confirm removal</button><button type="button" disabled={busy} onClick={()=>setConfirmId(null)}>Cancel</button></div>:<button type="button" className="icon-btn" disabled={busy} aria-label={'Remove '+device.deviceName} onClick={()=>setConfirmId(device.id)}><Trash2 size={17}/></button>}
   </div>)}
   {message&&<p role="status">{message}</p>}
  </div>}
 </section>;
}
