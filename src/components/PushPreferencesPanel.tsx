import {useState} from 'react';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {Settings2,Trash2} from 'lucide-react';
import {z} from 'zod';
import {getJson,requestJson} from '../api/http';
import {registeredDevice} from '../features/notifications/pushDevice';
import {groupFor,notificationGroups} from '../features/notifications/notificationView';
import './PushPreferencesPanel.css';

const schema=z.object({enabled:z.boolean(),new_booking:z.boolean(),checkout_due:z.boolean(),checkout_overdue:z.boolean(),room_assignment:z.boolean(),guest_check_in:z.boolean().default(true),guest_check_out:z.boolean().default(true),booking_cancelled:z.boolean().default(true),booking_no_show:z.boolean().default(true),stay_extended:z.boolean().default(true),payment_recorded:z.boolean().default(true),payment_pending_review:z.boolean().default(true),payment_verified:z.boolean().default(true),payment_rejected:z.boolean().default(true),payment_voided:z.boolean().default(true),refund_requested:z.boolean().default(true),refund_verified:z.boolean().default(true),expense_recorded:z.boolean().default(true),expense_correction_requested:z.boolean().default(true),cashier_discrepancy:z.boolean().default(true),housekeeping_completed:z.boolean().default(true),room_inspection_approved:z.boolean().default(true),room_inspection_rejected:z.boolean().default(true),maintenance_created:z.boolean().default(true),maintenance_urgent:z.boolean().default(true),maintenance_resolved:z.boolean().default(true),room_blocked:z.boolean().default(true),room_unblocked:z.boolean().default(true),approval_requested:z.boolean().default(true),approval_approved:z.boolean().default(true),approval_rejected:z.boolean().default(true),staff_message:z.boolean().default(true),staff_announcement:z.boolean().default(true),staff_handover:z.boolean().default(true),staff_acknowledged:z.boolean().default(true),daily_close_completed:z.boolean().default(true),daily_close_blocked:z.boolean().default(true),closing_cashier_unreconciled:z.boolean().default(true),closing_payment_pending:z.boolean().default(true),closing_journal_integrity:z.boolean().default(true),closing_no_show_unresolved:z.boolean().default(true),closing_room_night_issue:z.boolean().default(true)});
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
 ['housekeeping_completed','Housekeeping completed'],
 ['room_inspection_approved','Room inspection approved'],
 ['room_inspection_rejected','Room inspection rejected'],
 ['maintenance_created','Maintenance work order created'],
 ['maintenance_urgent','Urgent maintenance'],
 ['maintenance_resolved','Maintenance resolved'],
 ['room_blocked','Room blocked'],
 ['room_unblocked','Room unblocked'],
 ['approval_requested','Manager approval requested'],
 ['approval_approved','Manager approval granted'],
 ['approval_rejected','Manager approval rejected'],
 ['staff_message','New staff message'],
 ['staff_announcement','Staff announcement'],
 ['staff_handover','Shift handover'],
 ['staff_acknowledged','Staff update acknowledged'],
 ['daily_close_completed','Daily closing completed'],
 ['daily_close_blocked','Daily closing blocked'],
 ['closing_cashier_unreconciled','Cashier reconciliation outstanding'],
 ['closing_payment_pending','Payment evidence outstanding'],
 ['closing_journal_integrity','Journal integrity issue'],
 ['closing_no_show_unresolved','No-show financial review outstanding'],
 ['closing_room_night_issue','Nightly room accounting issue'],
] as const;

export function PushPreferencesPanel({userId,hotelId,onRemoveCurrent,active=true}:{userId:string;hotelId:string;onRemoveCurrent:()=>Promise<void>;active?:boolean}){
 const [open,setOpen]=useState(true);
 const [draft,setDraft]=useState<Preferences|null>(null);
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState('');
 const [confirmId,setConfirmId]=useState<string|null>(null);
 const client=useQueryClient();
 const root='/hotels/'+encodeURIComponent(hotelId);
 const key=['push-preferences',hotelId,userId];
 const deviceKey=['push-devices',hotelId,userId];
 const prefs=useQuery({queryKey:key,enabled:open&&active,staleTime:30_000,refetchOnWindowFocus:false,queryFn:async()=>z.object({data:schema}).parse(await getJson<unknown>(root+'/push-preferences')).data,retry:false});
 const devices=useQuery({queryKey:deviceKey,enabled:open&&active,staleTime:30_000,refetchOnWindowFocus:false,queryFn:async()=>z.object({data:z.array(deviceSchema)}).parse(await getJson<unknown>(root+'/push-subscriptions')).data,retry:false});
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
     {notificationGroups.map(group=>{
      const entries=categories.filter(([kind])=>groupFor(kind)===group);
      const enabledCount=entries.filter(([kind])=>value[kind]).length;
      return <details className="push-category" key={group}><summary>{group}<span>{enabledCount}/{entries.length} enabled</span></summary>
       <button type="button" className="btn-inline" onClick={()=>setDraft({...value,...Object.fromEntries(entries.map(([kind])=>[kind,enabledCount!==entries.length]))})}>{enabledCount===entries.length?'Disable':'Enable'} all {group.toLowerCase()} alerts</button>
       {entries.map(([kind,label])=><label key={kind} className="push-setting"><span>{label}</span><input type="checkbox" checked={value[kind]} onChange={e=>setDraft({...value,[kind]:e.target.checked})}/></label>)}
      </details>;
     })}
    </fieldset>
    <div className="push-setting-actions"><button type="button" className="btn-primary" disabled={!draft||busy} onClick={()=>void save()}>Save preferences</button>{draft&&<button type="button" className="btn-inline" disabled={busy} onClick={()=>setDraft(null)}>Cancel</button>}</div>
   </>}
   <h3>Registered devices</h3><p>Removing a device stops future push delivery for this property. Other devices stay registered.</p>
   {devices.isPending&&<p role="status">Loading devices…</p>}
   {devices.isError&&<p role="alert">Devices unavailable. <button type="button" onClick={()=>void devices.refetch()}>Retry</button></p>}
   {devices.data?.length===0&&<p>No registered devices.</p>}
   {devices.data?.map(device=><div className="push-device-row" key={device.id}>
    <div><strong>{device.deviceName}</strong>{device.id===current&&<small> · This browser</small>}<small className="push-device-date">Registration updated {new Date(device.updatedAt).toLocaleDateString()}</small></div>
    {confirmId===device.id?<div className="push-setting-actions"><button type="button" disabled={busy} onClick={()=>void remove(device.id)}>Remove device</button><button type="button" disabled={busy} onClick={()=>setConfirmId(null)}>Cancel</button></div>:<button type="button" className="icon-btn" disabled={busy} aria-label={'Remove '+device.deviceName} onClick={()=>setConfirmId(device.id)}><Trash2 size={17}/></button>}
   </div>)}
   {message&&<p role="status">{message}</p>}
  </div>}
 </section>;
}
