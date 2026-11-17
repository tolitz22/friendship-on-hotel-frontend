import {useEffect,useState,type FormEvent} from 'react';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {Plus,ShieldCheck,History} from 'lucide-react';
import {attachHotelStaff,getHotelStaffHistory,listHotelStaff,updateHotelStaff,type StaffRole} from '../api/liveStaff';
import {ApiError} from '../api/http';
import {useHotelAuth} from '../components/AuthProvider';
import {Heading,Panel} from '../components/ui';
import {QueryFeedback} from '../components/QueryFeedback';

const roles:StaffRole[]=['front_desk','housekeeping','maintenance','admin'];
export function LiveStaff(){
 const {hotelId,user}=useHotelAuth();
 const admin=!!user?.hotels.some(h=>h.id===hotelId&&h.role==='admin');
 const client=useQueryClient();
 const staff=useQuery({queryKey:['hotel-staff',hotelId],queryFn:listHotelStaff,enabled:admin});
 const [email,setEmail]=useState('');
 const [role,setRole]=useState<StaffRole>('housekeeping');
 const [saving,setSaving]=useState<string|null>(null);
 const [error,setError]=useState('');
 const [notice,setNotice]=useState('');
 const [historyOpen,setHistoryOpen]=useState(false);
 const history=useQuery({queryKey:['hotel-staff-history',hotelId],queryFn:getHotelStaffHistory,enabled:admin&&historyOpen});
 useEffect(()=>{setEmail('');setError('');setNotice('');setHistoryOpen(false);},[hotelId]);
 async function attach(e:FormEvent<HTMLFormElement>){
  e.preventDefault();if(!admin||saving)return;
  setSaving('attach');setError('');setNotice('');
  try{
   await attachHotelStaff(email.trim(),role);
   await client.invalidateQueries({queryKey:['hotel-staff',hotelId]});
   await client.invalidateQueries({queryKey:['hotel-staff-history',hotelId]});
   setEmail('');setNotice('Existing account added to the selected hotel.');
  }catch(e){setError(e instanceof ApiError?e.message:e instanceof Error?e.message:'Unable to add staff.');}
  finally{setSaving(null);}
 }
 async function change(userId:string,patch:Partial<{role:StaffRole;isActive:boolean}>){
  if(!admin||saving)return;
  setSaving(userId);setError('');setNotice('');
  try{
   await updateHotelStaff(userId,patch);
   await client.invalidateQueries({queryKey:['hotel-staff',hotelId]});
   await client.invalidateQueries({queryKey:['hotel-staff-history',hotelId]});
   setNotice('Membership updated. Affected staff should sign in again to refresh their displayed role.');
  }catch(e){setError(e instanceof ApiError?e.message:e instanceof Error?e.message:'Unable to update staff.');}
  finally{setSaving(null);}
 }
 if(!admin)return <><Heading title="Hotel staff" description="Administrator access required"/><p className="notice">Only active hotel administrators can manage staff memberships.</p></>;
 return <>
  <div className="notice"><strong>Existing accounts only</strong> · Staff must already have a Laravel user account. This page does not send invitations, create passwords or register new users.</div>
  <Heading title="Hotel staff" description="Manage property memberships and operational roles without sharing administrator credentials"/>
  <Panel title="Attach an existing account">
   <form className="staff-add-form" onSubmit={e=>void attach(e)}>
    <label>Email address<input type="email" required maxLength={255} value={email} onChange={e=>setEmail(e.target.value)} placeholder="staff@example.com"/></label>
    <label>Hotel role<select value={role} onChange={e=>setRole(e.target.value as StaffRole)}>
     {roles.map(r=><option key={r} value={r}>{r.replaceAll('_',' ')}</option>)}
    </select></label>
    <button type="submit" className="btn-primary" disabled={saving!==null}><Plus size={16}/> Add staff</button>
   </form>
   <p className="guest-info">Users can belong to multiple hotels. A new membership does not grant permission to another property's data.</p>
  </Panel>
  {error&&<p className="auth-error" role="alert">{error}</p>}
  {notice&&<p className="guest-info" role="status">{notice}</p>}
  <Panel title="Current staff members">
   <QueryFeedback loading={staff.isPending} error={staff.error} empty={staff.data?.data.length===0}/>
   {staff.data&&<div className="table-scroll"><table><thead><tr><th>Staff</th><th>Role</th><th>Membership</th></tr></thead><tbody>
    {staff.data.data.map(member=><tr key={member.userId}>
     <td><strong>{member.name}</strong><div className="guest-info">{member.email}</div></td>
     <td><select aria-label={'Role for '+member.name} disabled={saving!==null||member.userId===user?.id}
       value={member.role} onChange={e=>void change(member.userId,{role:e.target.value as StaffRole})}>
       {roles.map(r=><option key={r} value={r}>{r.replaceAll('_',' ')}</option>)}
      </select></td>
     <td><button className="btn-inline" type="button" disabled={saving!==null||member.userId===user?.id}
      onClick={()=>void change(member.userId,{isActive:!member.isActive})}>
      <ShieldCheck size={15}/>{member.isActive?'Deactivate':'Activate'}
     </button>{!member.accountActive&&<span className="guest-info">Account inactive</span>}</td>
    </tr>)}
   </tbody></table></div>}
  </Panel>
  <Panel title="Membership audit history" action={<button type="button" className="btn-inline" onClick={()=>setHistoryOpen(v=>!v)}><History size={16}/>{historyOpen?'Hide':'View'} history</button>}>
   {historyOpen&&<><QueryFeedback loading={history.isPending} error={history.error} empty={history.data?.data.length===0}/>
    {history.data?.data.map(event=><article className="maintenance-history-event" key={event.id}>
     <strong>{event.action} · Staff #{event.targetUserId}</strong>
     <small>Changed by administrator #{event.actorId} · {event.createdAt}</small>
     <p>{event.before?.role??'No membership'} → {event.after.role} · {event.after.isActive?'Active':'Inactive'}</p>
    </article>)}
   </>}
  </Panel>
 </>;
}
