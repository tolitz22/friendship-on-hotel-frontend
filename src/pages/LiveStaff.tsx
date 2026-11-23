import {useEffect,useState,type FormEvent} from 'react';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {Plus,ShieldCheck,History,Mail,RefreshCcw,ShieldAlert,X} from 'lucide-react';
import {attachHotelStaff,getHotelStaffHistory,listHotelStaff,updateHotelStaff,inviteNewStaff,listStaffInvitations,revokeStaffInvitation,type StaffRole,getHotelRolePermissions} from '../api/liveStaff';
import {ApiError} from '../api/http';
import {useHotelAuth} from '../components/AuthProvider';
import {Heading,Panel} from '../components/ui';
import {QueryFeedback} from '../components/QueryFeedback';
import {ReadableAuditEvent} from '../components/ReadableAuditEvent';

const roles:StaffRole[]=['front_desk','housekeeping','maintenance','admin'];
const roleName:Record<StaffRole,string>={front_desk:'Front Desk',housekeeping:'Housekeeping',maintenance:'Maintenance',admin:'Manager'};
type StaffChange={userId:string;name:string;previousRole:StaffRole;previousActive:boolean;role:StaffRole;isActive:boolean};
export function LiveStaff(){
 const {hotelId,user}=useHotelAuth();
 const admin=!!user?.hotels.some(h=>h.id===hotelId&&h.role==='admin');
 const client=useQueryClient();
 const staff=useQuery({queryKey:['hotel-staff',hotelId],queryFn:listHotelStaff,enabled:admin});
 const roleProfiles=useQuery({queryKey:['hotel-staff-role-profiles',hotelId],queryFn:getHotelRolePermissions,enabled:admin,retry:false});
 const invitations=useQuery({queryKey:['staff-invitations',hotelId],queryFn:listStaffInvitations,enabled:admin});
 const [inviteName,setInviteName]=useState('');
 const [inviteEmail,setInviteEmail]=useState('');
 const [inviteRole,setInviteRole]=useState<StaffRole>('housekeeping');
 const [email,setEmail]=useState('');
 const [role,setRole]=useState<StaffRole>('housekeeping');
 const [viewRole,setViewRole]=useState<StaffRole>('front_desk');
 const [saving,setSaving]=useState<string|null>(null);
 const [error,setError]=useState('');
 const [notice,setNotice]=useState('');
 const [historyOpen,setHistoryOpen]=useState(false);
 const [section,setSection]=useState<'team'|'roles'|'invite'|'audit'>('team');
 const [staffSearch,setStaffSearch]=useState('');
 const [staffFilter,setStaffFilter]=useState<'all'|'active'|'inactive'>('all');
 const [proposed,setProposed]=useState<StaffChange|null>(null);
 const history=useQuery({queryKey:['hotel-staff-history',hotelId],queryFn:getHotelStaffHistory,enabled:admin&&historyOpen});
 const profile=roleProfiles.data?.data.roles.find(item=>item.key===viewRole);
 const profileGroups=Array.from(new Set(roleProfiles.data?.data.capabilities.map(item=>item.group)??[]));
 useEffect(()=>{
  setEmail('');setInviteEmail('');setInviteName('');setError('');setNotice('');
  setHistoryOpen(false);setSection('team');setStaffSearch('');setStaffFilter('all');setProposed(null);
 },[hotelId]);
 const visibleStaff=(staff.data?.data??[]).filter(member=>{
  const term=staffSearch.trim().toLowerCase();
  return (!term||member.name.toLowerCase().includes(term)||member.email.toLowerCase().includes(term))
   &&(staffFilter==='all'||(staffFilter==='active'?member.isActive&&member.accountActive:!member.isActive||!member.accountActive));
 });
 const activeStaff=(staff.data?.data??[]).filter(member=>member.isActive&&member.accountActive).length;
 const pendingInvites=(invitations.data?.data??[]).filter(item=>
  !item.acceptedAt&&!item.revokedAt&&new Date(item.expiresAt).getTime()>Date.now()).length;
 const proposeChange=(member:{userId:string;name:string;role:StaffRole;isActive:boolean},patch:Partial<{role:StaffRole;isActive:boolean}>)=>{
  if(saving||member.userId===user?.id)return;
  const next={userId:member.userId,name:member.name,previousRole:member.role,previousActive:member.isActive,
   role:patch.role??member.role,isActive:patch.isActive??member.isActive};
  if(next.role!==member.role||next.isActive!==member.isActive)setProposed(next);
 };

 async function attach(e:FormEvent<HTMLFormElement>){
  e.preventDefault();if(!admin||saving)return;
  setSaving('attach');setError('');setNotice('');
  try{
   await attachHotelStaff(email.trim(),role);
   await client.invalidateQueries({queryKey:['hotel-staff',hotelId]});
   await client.invalidateQueries({queryKey:['hotel-staff-history',hotelId]});
   await client.invalidateQueries({queryKey:['hotel-staff-role-profiles',hotelId]});
   setEmail('');setNotice('Existing account added to the selected hotel.');
  }catch(e){setError(e instanceof ApiError?e.message:e instanceof Error?e.message:'Unable to add staff.');}
  finally{setSaving(null);}
 }
 async function confirmChange(){
  if(!admin||saving||!proposed)return;
  const change=proposed;
  setSaving(change.userId);setError('');setNotice('');
  try{
   await updateHotelStaff(change.userId,{
    role:change.role,isActive:change.isActive,
    expectedRole:change.previousRole,expectedIsActive:change.previousActive,
   });
   setProposed(null);
   await Promise.all([
    client.invalidateQueries({queryKey:['hotel-staff',hotelId]}),
    client.invalidateQueries({queryKey:['hotel-staff-history',hotelId]}),
    client.invalidateQueries({queryKey:['hotel-staff-role-profiles',hotelId]}),
   ]);
   setNotice('Access updated for '+change.name+'. Permissions are enforced immediately. Staff may need to sign in again to refresh the visible workspace.');
  }catch(e){
   if(e instanceof ApiError&&e.status===409){
    setProposed(null);
    void client.invalidateQueries({queryKey:['hotel-staff',hotelId]});
   }
   setError(e instanceof Error?e.message:'Unable to update staff access.');
  }finally{setSaving(null);}
 }
 async function sendInvitation(e:FormEvent<HTMLFormElement>){
  e.preventDefault();if(!admin||saving)return;
  setSaving('invite');setError('');setNotice('');
  try{
   await inviteNewStaff(inviteEmail.trim(),inviteName.trim(),inviteRole);
   await client.invalidateQueries({queryKey:['staff-invitations',hotelId]});
   setInviteEmail('');setInviteName('');
   setNotice('Invitation sent. The link expires after 48 hours.');
  }catch(e){setError(e instanceof Error?e.message:'Unable to send invitation.');}
  finally{setSaving(null);}
 }
 async function revokeInvitation(id:string){
  if(!admin||saving)return;
  setSaving('revoke-'+id);setError('');setNotice('');
  try{
   await revokeStaffInvitation(id);
   await client.invalidateQueries({queryKey:['staff-invitations',hotelId]});
   setNotice('Invitation revoked.');
  }catch(e){setError(e instanceof Error?e.message:'Unable to revoke invitation.');}
  finally{setSaving(null);}
 }
 if(!admin)return <><Heading title="Hotel staff" description="Administrator access required"/><p className="notice">Only active hotel administrators can manage staff memberships.</p></>;
 return <>
  <Heading title="Staff & access" description="Manage team membership, review role access, and invite employees to this property."/>
  <div className="notice"><strong>{activeStaff} active staff</strong> · {pendingInvites} pending invitations · Access changes affect only this hotel.</div>
  <nav className="hk-queue-tabs" aria-label="Staff management sections">
   {([['team','Team'],['roles','Roles & permissions'],['invite','Invitations'],['audit','Access history']] as const)
    .map(([id,label])=><button key={id} type="button" aria-current={section===id?'page':undefined}
     aria-pressed={section===id} className={section===id?'active':''}
     onClick={()=>{setSection(id);setError('');setNotice('');if(id==='audit')setHistoryOpen(true);}}>{label}</button>)}
  </nav>
  {error&&<p className="auth-error" role="alert">{error}</p>}
  {notice&&<p className="guest-info" role="status">{notice}</p>}
  {section==='roles'&&<Panel title="Roles & permissions" action={<button type="button" className="btn-inline"
   disabled={roleProfiles.isFetching} onClick={()=>void roleProfiles.refetch()}><RefreshCcw size={15}/> Refresh permissions</button>}>
   <p className="guest-info">Choose a role to see the hotel's default access. Assign roles below. Individual permission toggles are not enabled; sensitive actions remain protected by Laravel.</p>
   <QueryFeedback loading={roleProfiles.isPending} error={roleProfiles.error}
    onRetry={()=>void roleProfiles.refetch()}/>
   {roleProfiles.data&&<>
    <div className="staff-add-form">
     <label>View role
      <select aria-label="View role permissions" value={viewRole} onChange={event=>setViewRole(event.target.value as StaffRole)}>
       {roleProfiles.data.data.roles.map(item=><option key={item.key} value={item.key}>
        {item.label} · {item.activeStaff} active {item.activeStaff===1?'employee':'employees'}</option>)}
      </select>
     </label>
    </div>
    {profile&&<div aria-live="polite">
     <p><strong>{profile.label}</strong> · {profile.description}</p>
     <div className="table-scroll"><table>
      <thead><tr><th>Area</th><th>Action</th><th>{profile.label} access</th></tr></thead>
      <tbody>
       {profileGroups.flatMap(group=>(roleProfiles.data?.data.capabilities??[])
        .filter(item=>item.group===group).map(item=><tr key={item.key}>
         <td>{group}</td><td>{item.label}</td>
         <td>{profile.permissions.includes(item.key)?'Allowed':'Not allowed'}</td>
        </tr>))}
      </tbody>
     </table></div>
    </div>}
    <p className="guest-info">{roleProfiles.data.data.note}</p>
   </>}
  </Panel>}
  {section==='invite'&&<><Panel title="Invite a new employee">
   <form className="staff-add-form" onSubmit={e=>void sendInvitation(e)}>
    <label>Full name<input required minLength={2} maxLength={120} value={inviteName} onChange={e=>setInviteName(e.target.value)}/></label>
    <label>Email<input required type="email" maxLength={255} value={inviteEmail} onChange={e=>setInviteEmail(e.target.value)}/></label>
    <label>Hotel role<select value={inviteRole} onChange={e=>setInviteRole(e.target.value as StaffRole)}>
     {roles.map(r=><option value={r} key={r}>{r.replaceAll('_',' ')}</option>)}
    </select></label>
    <button className="btn-primary" disabled={saving!==null} type="submit"><Mail size={16}/> Send invitation</button>
   </form>
   <p className="guest-info">New accounts only. The recipient must use the emailed link within 48 hours. The role is granted only after acceptance.</p>
  </Panel>
  <Panel title="Sent invitations" action={<button type="button" className="btn-inline" onClick={()=>void invitations.refetch()}><RefreshCcw size={15}/> Refresh</button>}>
   <QueryFeedback loading={invitations.isPending} error={invitations.error} empty={invitations.data?.data.length===0}/>
   {invitations.data&&<div className="table-scroll"><table><thead><tr><th>Recipient</th><th>Role</th><th>Status</th><th></th></tr></thead><tbody>
    {invitations.data.data.map(item=>{
     const pending=!item.acceptedAt&&!item.revokedAt&&new Date(item.expiresAt).getTime()>Date.now();
     const status=item.acceptedAt?'Accepted':item.revokedAt?'Revoked':pending?'Pending':'Expired';
     return <tr key={item.id}><td><strong>{item.name}</strong><div className="guest-info">{item.email}</div></td>
      <td>{item.role.replaceAll('_',' ')}</td><td>{status}</td>
      <td>{pending&&<button type="button" className="btn-inline" disabled={saving!==null} onClick={()=>void revokeInvitation(item.id)}>Revoke</button>}</td>
     </tr>;
    })}
   </tbody></table></div>}
  </Panel>
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
  </>}
  {section==='team'&&<Panel title="Current staff members">
   <div className="staff-add-form">
    <label>Search staff <input type="search" value={staffSearch} placeholder="Search name or email"
     onChange={event=>setStaffSearch(event.target.value)}/></label>
    <label>Status <select value={staffFilter}
     onChange={event=>setStaffFilter(event.target.value as 'all'|'active'|'inactive')}>
      <option value="all">All staff</option><option value="active">Active</option>
      <option value="inactive">Inactive</option>
     </select></label>
    <button type="button" className="btn-inline" disabled={staff.isFetching}
     onClick={()=>void staff.refetch()}><RefreshCcw size={15}/> Refresh</button>
   </div>
   <QueryFeedback loading={staff.isPending} error={staff.error} empty={staff.data?.data.length===0}/>
   {staff.data&&<div className="table-scroll"><table><thead><tr><th>Staff</th><th>Role</th><th>Membership</th></tr></thead><tbody>
    {visibleStaff.map(member=><tr key={member.userId}>
     <td><strong>{member.name}</strong><div className="guest-info">{member.email}</div></td>
     <td><select aria-label={'Role for '+member.name} disabled={saving!==null||member.userId===user?.id}
       value={member.role} onChange={e=>proposeChange(member,{role:e.target.value as StaffRole})}>
       {roles.map(r=><option key={r} value={r}>{r.replaceAll('_',' ')}</option>)}
      </select></td>
     <td><button className="btn-inline" type="button" disabled={saving!==null||member.userId===user?.id}
      onClick={()=>proposeChange(member,{isActive:!member.isActive})}>
      <ShieldCheck size={15}/>{member.isActive?'Deactivate':'Reactivate'}
     </button>{!member.accountActive&&<span className="guest-info">Account inactive</span>}{member.userId===user?.id&&<span className="guest-info">Your account · manager access protected</span>}</td>
    </tr>)}
   </tbody></table></div>}
   {staff.isSuccess&&visibleStaff.length===0&&<p className="guest-info" role="status">No staff match these filters.</p>}
  </Panel>}
  {section==='audit'&&<Panel title="Membership audit history" action={<button type="button" className="btn-inline" onClick={()=>setHistoryOpen(v=>!v)}><History size={16}/>{historyOpen?'Hide':'View'} history</button>}>
   {historyOpen&&<><QueryFeedback loading={history.isPending} error={history.error} empty={history.data?.data.length===0}/>
    {history.data?.data.map(event=><div key={event.id} className="staff-audit-entry">
     <p className="staff-audit-target"><strong>Employee affected:</strong> {event.targetName??staff.data?.data.find(member=>member.userId===event.targetUserId)?.name??'Employee name unavailable'}</p>
     <ReadableAuditEvent event={{
      id:event.id,actorId:event.actorId,action:event.action,
      before:event.before?{...event.before}:null,after:{...event.after},
      note:null,createdAt:event.createdAt,
     }} actorName={event.actorName??staff.data?.data.find(member=>member.userId===event.actorId)?.name}
      currentUserId={user?.id} currentUserName={user?.name}/>
    </div>)}
   </>}
  </Panel>}
  {proposed&&<div className="guest-modal-backdrop" role="presentation">
   <section className="guest-modal" role="dialog" aria-modal="true" aria-labelledby="staff-change-title">
    <div className="catalog-modal-heading">
     <h3 id="staff-change-title">Confirm staff access change</h3>
     <button type="button" className="icon-btn" aria-label="Cancel access change"
      disabled={saving!==null} onClick={()=>setProposed(null)}><X size={18}/></button>
    </div>
    <p><strong>{proposed.name}</strong> · This change affects the selected hotel only.</p>
    <p><strong>Current:</strong> {roleName[proposed.previousRole]} · {proposed.previousActive?'Active':'Inactive'}</p>
    <p><strong>New:</strong> {roleName[proposed.role]} · {proposed.isActive?'Active':'Inactive'}</p>
    {proposed.role==='admin'&&proposed.previousRole!=='admin'&&<p role="alert" className="notice">
     <ShieldAlert size={16}/> Manager access includes staff administration and sensitive hotel operations. Grant only to trusted managers.
    </p>}
    {!proposed.isActive&&proposed.previousActive&&<p role="alert" className="notice">
     Deactivation immediately blocks this person's hotel API access. Reassign their open tasks first.
    </p>}
    {proposed.role!==proposed.previousRole&&<p className="guest-info">
     {roleProfiles.data?.data.roles.find(item=>item.key===proposed.role)?.description??'Check Roles & permissions for details.'}
    </p>}
    <div className="guest-modal-actions">
     <button type="button" className="btn-inline" disabled={saving!==null}
      onClick={()=>setProposed(null)}>Cancel</button>
     <button type="button" className="btn-primary" disabled={saving!==null}
      onClick={()=>void confirmChange()}>{saving?'Saving access…':'Confirm change'}</button>
    </div>
   </section>
  </div>}
 </>;
}
