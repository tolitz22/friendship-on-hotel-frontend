import {useEffect,useState,type FormEvent} from 'react';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {Plus,ShieldCheck,History,Mail,RefreshCcw,ShieldAlert,X,ChevronRight,UserPlus,UserRoundCog} from 'lucide-react';
import {attachHotelStaff,getHotelStaffHistory,listHotelStaff,updateHotelStaff,inviteNewStaff,listStaffInvitations,revokeStaffInvitation,type StaffRole,getHotelRolePermissions,createHotelStaffAccount} from '../api/liveStaff';
import {ApiError} from '../api/http';
import {useHotelAuth} from '../components/AuthProvider';
import {Heading,Panel} from '../components/ui';
import {QueryFeedback} from '../components/QueryFeedback';
import {ReadableAuditEvent} from '../components/ReadableAuditEvent';

const roles:StaffRole[]=['front_desk','housekeeping','maintenance','admin'];
const roleName:Record<StaffRole,string>={front_desk:'Front Desk',housekeeping:'Housekeeping',maintenance:'Maintenance',admin:'Manager'};
type StaffChange={userId:string;name:string;previousRole:StaffRole;previousActive:boolean;role:StaffRole;isActive:boolean};
type PermissionEdit={userId:string;name:string;role:StaffRole;original:string[];selected:string[]};
const permissionNeeds:Record<string,string[]>={
 'booking.create':['guest.read','reservation.read'],
 'booking.assign_room':['reservation.read'],
 'booking.check_in':['reservation.read'],
 'booking.check_out':['reservation.read','finance.read'],
 'booking.special_request':['reservation.read'],
 'cashier.write':['cashier.read','finance.read'],
 'approval.request':['approval.read','reservation.read'],
 'keycard.request':['keycard.read'],
};
function updatePermissionSet(previous:string[],key:string,checked:boolean):string[]{
 const next=new Set(previous);
 if(checked){
  const add=(item:string)=>{next.add(item);for(const need of permissionNeeds[item]??[])add(need);};
  add(key);
 }else{
  next.delete(key);
  let changed=true;
  while(changed){
   changed=false;
   for(const [action,required] of Object.entries(permissionNeeds)){
    if(next.has(action)&&required.some(need=>!next.has(need))){next.delete(action);changed=true;}
   }
  }
 }
 return [...next];
}
export function LiveStaff(){
 const {hotelId,user}=useHotelAuth();
 const admin=!!user?.hotels.some(h=>h.id===hotelId&&h.role==='admin');
 const client=useQueryClient();
 const staff=useQuery({queryKey:['hotel-staff',hotelId],queryFn:listHotelStaff,enabled:admin});
 const roleProfiles=useQuery({queryKey:['hotel-staff-role-profiles',hotelId],queryFn:getHotelRolePermissions,enabled:admin,retry:false});
 const invitations=useQuery({queryKey:['staff-invitations',hotelId],queryFn:listStaffInvitations,enabled:admin});
 const [manualName,setManualName]=useState('');
 const [manualEmail,setManualEmail]=useState('');
 const [manualRole,setManualRole]=useState<StaffRole>('front_desk');
 const [manualPassword,setManualPassword]=useState('');
 const [manualPasswordConfirm,setManualPasswordConfirm]=useState('');
 const [manualManagerAcknowledged,setManualManagerAcknowledged]=useState(false);
 const [showManualPassword,setShowManualPassword]=useState(false);
 const [inviteName,setInviteName]=useState('');
 const [inviteEmail,setInviteEmail]=useState('');
 const [inviteRole,setInviteRole]=useState<StaffRole>('housekeeping');
 const [inviteManagerAcknowledged,setInviteManagerAcknowledged]=useState(false);
 const [email,setEmail]=useState('');
 const [role,setRole]=useState<StaffRole>('housekeeping');
 const [attachManagerAcknowledged,setAttachManagerAcknowledged]=useState(false);
 const [viewRole,setViewRole]=useState<StaffRole>('front_desk');
 const [saving,setSaving]=useState<string|null>(null);
 const [error,setError]=useState('');
 const [notice,setNotice]=useState('');
 const [historyOpen,setHistoryOpen]=useState(false);
 const [section,setSection]=useState<'team'|'roles'|'invite'|'audit'>('team');
 const [addOpen,setAddOpen]=useState(false);
 const [addMethod,setAddMethod]=useState<'manual'|'email'|'existing'>('manual');
 const [selectedStaffId,setSelectedStaffId]=useState<string|null>(null);
 const [staffSearch,setStaffSearch]=useState('');
 const [staffFilter,setStaffFilter]=useState<'all'|'active'|'inactive'>('all');
 const [proposed,setProposed]=useState<StaffChange|null>(null);
 const [permissionEdit,setPermissionEdit]=useState<PermissionEdit|null>(null);
 const history=useQuery({queryKey:['hotel-staff-history',hotelId],queryFn:getHotelStaffHistory,enabled:admin&&historyOpen});
 const profile=roleProfiles.data?.data.roles.find(item=>item.key===viewRole);
 const profileGroups=Array.from(new Set(roleProfiles.data?.data.capabilities.map(item=>item.group)??[]));
 useEffect(()=>{
  setEmail('');setInviteEmail('');setInviteName('');setError('');setNotice('');
  setManualName('');setManualEmail('');setManualRole('front_desk');
  setManualPassword('');setManualPasswordConfirm('');setManualManagerAcknowledged(false);setShowManualPassword(false);
  setHistoryOpen(false);setSection('team');setStaffSearch('');setStaffFilter('all');setProposed(null);setPermissionEdit(null);
  setAddOpen(false);setAddMethod('manual');setSelectedStaffId(null);
  setInviteManagerAcknowledged(false);setAttachManagerAcknowledged(false);
 },[hotelId]);
 const visibleStaff=(staff.data?.data??[]).filter(member=>{
  const term=staffSearch.trim().toLowerCase();
  return (!term||member.name.toLowerCase().includes(term)||member.email.toLowerCase().includes(term))
   &&(staffFilter==='all'||(staffFilter==='active'?member.isActive&&member.accountActive:!member.isActive||!member.accountActive));
 });
 const activeStaff=(staff.data?.data??[]).filter(member=>member.isActive&&member.accountActive).length;
 const selectedStaff=(staff.data?.data??[]).find(member=>member.userId===selectedStaffId)??null;
 const closeAdd=()=>{if(saving)return;setAddOpen(false);setManualPassword('');setManualPasswordConfirm('');setManualManagerAcknowledged(false);setShowManualPassword(false);};
 const openAdd=()=>{setError('');setNotice('');setAddMethod('manual');setAddOpen(true);};
 const pendingInvites=(invitations.data?.data??[]).filter(item=>
  !item.acceptedAt&&!item.revokedAt&&new Date(item.expiresAt).getTime()>Date.now()).length;
 const proposeChange=(member:{userId:string;name:string;role:StaffRole;isActive:boolean},patch:Partial<{role:StaffRole;isActive:boolean}>)=>{
  if(saving||member.userId===user?.id)return;
  const next={userId:member.userId,name:member.name,previousRole:member.role,previousActive:member.isActive,
   role:patch.role??member.role,isActive:patch.isActive??member.isActive};
  if(next.role!==member.role||next.isActive!==member.isActive){setSelectedStaffId(null);setProposed(next);}
 };

 const beginPermissionEdit=(member:{userId:string;name:string;role:StaffRole;permissions:string[]})=>{
  if(member.role==='admin'||member.userId===user?.id||saving)return;
  setError('');setNotice('');
  setSelectedStaffId(null);
  setPermissionEdit({userId:member.userId,name:member.name,role:member.role,
   original:[...member.permissions],selected:[...member.permissions]});
 };
 const changePermission=(key:string,checked:boolean)=>
  setPermissionEdit(current=>current?{...current,
   selected:updatePermissionSet(current.selected,key,checked)}:null);
 async function savePermissions(){
  if(!permissionEdit||!admin||saving||!hotelId)return;
  const current=permissionEdit;
  const template=roleProfiles.data?.data.roles.find(item=>item.key===current.role)?.editablePermissions??[];
  const selected=template.filter(key=>current.selected.includes(key));
  setSaving('permissions-'+current.userId);setError('');
  try{
   await updateHotelStaff(current.userId,{
    permissions:selected,expectedRole:current.role,expectedPermissions:current.original,
   });
   setPermissionEdit(null);
   await Promise.all([
    client.invalidateQueries({queryKey:['hotel-staff',hotelId]}),
    client.invalidateQueries({queryKey:['hotel-staff-history',hotelId]}),
   ]);
   setNotice('Permissions saved for '+current.name+'. Backend access changes apply immediately.');
  }catch(cause){
   if(cause instanceof ApiError&&cause.status===409){
    setPermissionEdit(null);
    void client.invalidateQueries({queryKey:['hotel-staff',hotelId]});
   }
   setError(cause instanceof Error?cause.message:'Could not save employee permissions.');
  }finally{setSaving(null);}
 }
 async function attach(e:FormEvent<HTMLFormElement>){
  e.preventDefault();if(!admin||saving||(role==='admin'&&!attachManagerAcknowledged))return;
  setSaving('attach');setError('');setNotice('');
  try{
   await attachHotelStaff(email.trim(),role);
   await client.invalidateQueries({queryKey:['hotel-staff',hotelId]});
   await client.invalidateQueries({queryKey:['hotel-staff-history',hotelId]});
   await client.invalidateQueries({queryKey:['hotel-staff-role-profiles',hotelId]});
   setEmail('');setAttachManagerAcknowledged(false);setAddOpen(false);setSection('team');setNotice('Existing account added to the selected hotel.');
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
 async function createManualAccount(e:FormEvent<HTMLFormElement>){
  e.preventDefault();
  if(!admin||saving||(manualRole==='admin'&&!manualManagerAcknowledged))return;
  if(manualPassword!==manualPasswordConfirm){
   setError('Initial password and confirmation do not match.');return;
  }
  if(manualPassword.length<12||!/[a-z]/.test(manualPassword)||!/[A-Z]/.test(manualPassword)||!/[0-9]/.test(manualPassword)){
   setError('Use at least 12 characters with uppercase, lowercase and a number.');return;
  }
  const property=hotelId;
  setSaving('create-account');setError('');setNotice('');
  try{
   const created=await createHotelStaffAccount(manualName.trim(),manualEmail.trim().toLowerCase(),
    manualRole,manualPassword,manualPasswordConfirm);
   // Never retain the administrator-known password after the request.
   setManualPassword('');setManualPasswordConfirm('');
   if(property!==hotelId)return;
   await Promise.all([
    client.invalidateQueries({queryKey:['hotel-staff',property]}),
    client.invalidateQueries({queryKey:['hotel-staff-history',property]}),
    client.invalidateQueries({queryKey:['hotel-staff-role-profiles',property]}),
   ]);
   setManualName('');setManualEmail('');setManualRole('front_desk');
   setManualManagerAcknowledged(false);
   setAddOpen(false);setSection('team');setNotice(created.message);
  }catch(cause){
   setManualPassword('');setManualPasswordConfirm('');
   if(property===hotelId)setError(cause instanceof Error?cause.message:'Unable to create staff account.');
  }finally{setSaving(null);}
 }
 async function sendInvitation(e:FormEvent<HTMLFormElement>){
  e.preventDefault();if(!admin||saving||(inviteRole==='admin'&&!inviteManagerAcknowledged))return;
  setSaving('invite');setError('');setNotice('');
  try{
   await inviteNewStaff(inviteEmail.trim(),inviteName.trim(),inviteRole);
   await client.invalidateQueries({queryKey:['staff-invitations',hotelId]});
   setInviteEmail('');setInviteName('');setInviteManagerAcknowledged(false);
   setAddOpen(false);setSection('invite');setNotice('Invitation sent. The link expires after 48 hours.');
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
  <div className="staff-page-heading">
   <Heading title="Staff & access" description="Manage employees, roles and permissions."/>
   <button type="button" className="btn-primary" onClick={openAdd}><UserPlus size={17}/> Add employee</button>
  </div>
  <div className="staff-overview" aria-label="Staff overview">
   <div><strong>{staff.isPending?'—':staff.data?.data.length??0}</strong><span>Total staff</span></div>
   <div><strong>{staff.isPending?'—':activeStaff}</strong><span>Active staff</span></div>
   <button type="button" onClick={()=>setSection('invite')}>
    <strong>{invitations.isPending?'—':pendingInvites}</strong><span>Pending invitations <ChevronRight size={13}/></span>
   </button>
  </div>
  <nav className="staff-page-tabs" aria-label="Staff management sections">
   {([['team','Employees'],['roles','Role guide'],['invite','Invitations'],['audit','Activity']] as const)
    .map(([id,label])=><button key={id} type="button" aria-current={section===id?'page':undefined}
     aria-pressed={section===id} className={section===id?'active':''}
     onClick={()=>{setSection(id);setError('');setNotice('');if(id==='audit')setHistoryOpen(true);}}>{label}</button>)}
  </nav>
  {error&&<p className="auth-error" role="alert">{error}</p>}
  {notice&&<p className="guest-info" role="status">{notice}</p>}
  {section==='roles'&&<Panel title="Roles & permissions" action={<button type="button" className="btn-inline"
   disabled={roleProfiles.isFetching} onClick={()=>void roleProfiles.refetch()}><RefreshCcw size={15}/> Refresh permissions</button>}>
   <p className="guest-info">Explore default access by role. Change employee roles on the Team tab. Individual staff permissions can be customized from the Team tab; sensitive Manager actions remain protected by Laravel.</p>
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
  {addOpen&&<div className="guest-modal-backdrop" role="presentation">
   <section className="guest-modal staff-add-dialog" role="dialog" aria-modal="true" aria-labelledby="staff-add-title">
    <div className="staff-dialog-title">
     <div><h3 id="staff-add-title">Add employee</h3><p>Choose how this person will sign in.</p></div>
     <button type="button" className="icon-btn" aria-label="Close add employee" onClick={closeAdd} disabled={saving!==null}><X size={19}/></button>
    </div>
    <div className="staff-method-selector" aria-label="Account creation method">
     <button type="button" className={addMethod==='manual'?'active':''} aria-pressed={addMethod==='manual'}
      disabled={saving!==null} onClick={()=>setAddMethod('manual')}>Create login</button>
     <button type="button" className={addMethod==='email'?'active':''} aria-pressed={addMethod==='email'}
      disabled={saving!==null} onClick={()=>{setManualPassword('');setManualPasswordConfirm('');setAddMethod('email');}}>Email invite</button>
     <button type="button" className={addMethod==='existing'?'active':''} aria-pressed={addMethod==='existing'}
      disabled={saving!==null} onClick={()=>{setManualPassword('');setManualPasswordConfirm('');setAddMethod('existing');}}>Existing login</button>
    </div>
    {addMethod==='manual'&&  <Panel title="Create account">
   <p className="guest-info">Create an employee account immediately and choose an initial password. They must replace that password at first sign-in before accessing hotel data. Use the invitation option below if you prefer employees to set their own password from the start.</p>
   <form className="staff-add-form" onSubmit={e=>void createManualAccount(e)}>
    <label>Full name<input required minLength={2} maxLength={120} autoComplete="off"
     disabled={saving!==null} value={manualName} onChange={e=>setManualName(e.target.value)}/></label>
    <label>Email address<input required type="email" maxLength={255} autoComplete="off"
     disabled={saving!==null} value={manualEmail} onChange={e=>setManualEmail(e.target.value)}/></label>
    <label>Hotel role<select value={manualRole} disabled={saving!==null}
     onChange={e=>{setManualRole(e.target.value as StaffRole);setManualManagerAcknowledged(false);}}>
     {roles.map(r=><option key={r} value={r}>{roleName[r]}</option>)}
    </select></label>
    <label>Initial password<input required type={showManualPassword?'text':'password'} minLength={12}
     maxLength={128} autoComplete="new-password" disabled={saving!==null}
     value={manualPassword} onChange={e=>setManualPassword(e.target.value)}/></label>
    <label>Confirm initial password<input required type={showManualPassword?'text':'password'} minLength={12}
     maxLength={128} autoComplete="new-password" disabled={saving!==null}
     value={manualPasswordConfirm} onChange={e=>setManualPasswordConfirm(e.target.value)}/></label>
    <label className="guest-info"><input type="checkbox" checked={showManualPassword}
     onChange={e=>setShowManualPassword(e.target.checked)}/> Show passwords</label>
    <p className="guest-info">At least 12 characters, uppercase and lowercase letters, and a number. Passwords are not shown in staff records or audit history.</p>
    {manualRole==='admin'&&<label className="guest-info"><input type="checkbox"
     checked={manualManagerAcknowledged} onChange={e=>setManualManagerAcknowledged(e.target.checked)}/>
     I understand this account has Manager access to sensitive hotel operations.</label>}
    <button type="submit" className="btn-primary"
     disabled={saving!==null||(manualRole==='admin'&&!manualManagerAcknowledged)}>
     <Plus size={16}/>{saving==='create-account'?'Creating account…':'Create staff account'}
    </button>
   </form>
  </Panel>}
    {addMethod==='email'&&  <Panel title="Invite by email">
   <form className="staff-add-form" onSubmit={e=>void sendInvitation(e)}>
    <label>Full name<input required minLength={2} maxLength={120} value={inviteName} onChange={e=>setInviteName(e.target.value)}/></label>
    <label>Email<input required type="email" maxLength={255} value={inviteEmail} onChange={e=>setInviteEmail(e.target.value)}/></label>
    <label>Hotel role<select value={inviteRole} onChange={e=>{setInviteRole(e.target.value as StaffRole);setInviteManagerAcknowledged(false);}}>
     {roles.map(r=><option value={r} key={r}>{roleName[r]}</option>)}
    </select></label>
    {inviteRole==='admin'&&<label className="guest-info">
     <input type="checkbox" checked={inviteManagerAcknowledged}
      onChange={event=>setInviteManagerAcknowledged(event.target.checked)}/>
     I understand this grants full manager access after the invitation is accepted.
    </label>}
    <p className="guest-info">{roleProfiles.data?.data.roles.find(item=>item.key===inviteRole)?.description}</p>
    <button className="btn-primary" disabled={saving!==null||(inviteRole==='admin'&&!inviteManagerAcknowledged)} type="submit"><Mail size={16}/> Send invitation</button>
   </form>
   <p className="guest-info">New accounts only. The recipient must use the emailed link within 48 hours. The role is granted only after acceptance.</p>
  </Panel>}
    {addMethod==='existing'&&  <Panel title="Link existing account">
   <form className="staff-add-form" onSubmit={e=>void attach(e)}>
    <label>Email address<input type="email" required maxLength={255} value={email} onChange={e=>setEmail(e.target.value)} placeholder="staff@example.com"/></label>
    <label>Hotel role<select value={role} onChange={e=>{setRole(e.target.value as StaffRole);setAttachManagerAcknowledged(false);}}>
     {roles.map(r=><option key={r} value={r}>{roleName[r]}</option>)}
    </select></label>
    {role==='admin'&&<label className="guest-info">
     <input type="checkbox" checked={attachManagerAcknowledged}
      onChange={event=>setAttachManagerAcknowledged(event.target.checked)}/>
     I understand this immediately grants full manager access in this hotel.
    </label>}
    <p className="guest-info">{roleProfiles.data?.data.roles.find(item=>item.key===role)?.description}</p>
    <button type="submit" className="btn-primary" disabled={saving!==null||(role==='admin'&&!attachManagerAcknowledged)}><Plus size={16}/> Add staff</button>
   </form>
   <p className="guest-info">Users can belong to multiple hotels. A new membership does not grant permission to another property's data.</p>
  </Panel>}
   </section>
  </div>}
  {section==='invite'&&  <Panel title="Sent invitations" action={<button type="button" className="btn-inline" onClick={()=>void invitations.refetch()}><RefreshCcw size={15}/> Refresh</button>}>
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
  </Panel>}
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
   {staff.data&&<div className="table-scroll staff-list-scroll"><table className="staff-directory-table">
    <thead><tr><th>Employee</th><th>Role</th><th>Status</th><th><span className="staff-sr-only">Manage access</span></th></tr></thead>
    <tbody>{visibleStaff.map(member=><tr key={member.userId}>
     <td><div className="staff-person">
      <span className="staff-initials" aria-hidden="true">{member.name.trim().slice(0,1).toUpperCase()}</span>
      <span><strong>{member.name}</strong><small>{member.email}</small>
       {member.userId===user?.id&&<small>Your account</small>}</span>
     </div></td>
     <td><span className="staff-role-pill">{roleName[member.role]}</span>
      {member.customPermissions&&<small className="staff-custom-note">Custom access</small>}</td>
     <td><span className={'staff-status-pill '+(member.isActive&&member.accountActive?'is-active':'is-inactive')}>
      {member.isActive&&member.accountActive?'Active':!member.accountActive?'Account inactive':'Access disabled'}
     </span></td>
     <td><button type="button" className="staff-manage-button" disabled={saving!==null}
       aria-label={'Manage '+member.name} onClick={()=>{setError('');setNotice('');setSelectedStaffId(member.userId);}}>
       <UserRoundCog size={16}/> Manage <ChevronRight size={15}/>
     </button></td>
    </tr>)}</tbody>
   </table></div>}
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
  {selectedStaff&&<div className="guest-modal-backdrop" role="presentation">
   <section className="guest-modal staff-manage-dialog" role="dialog" aria-modal="true" aria-labelledby="staff-manage-title">
    <div className="staff-dialog-title">
     <div><h3 id="staff-manage-title">{selectedStaff.name}</h3><p>{selectedStaff.email}</p></div>
     <button className="icon-btn" type="button" aria-label="Close staff details"
      onClick={()=>setSelectedStaffId(null)}><X size={18}/></button>
    </div>
    <div className="staff-member-summary">
     <span className={'staff-status-pill '+(selectedStaff.isActive&&selectedStaff.accountActive?'is-active':'is-inactive')}>
      {selectedStaff.isActive&&selectedStaff.accountActive?'Active':!selectedStaff.accountActive?'Account inactive':'Access disabled'}
     </span>
     <span className="staff-role-pill">{roleName[selectedStaff.role]}</span>
     {selectedStaff.customPermissions&&<span className="staff-custom-note">Custom permissions</span>}
    </div>
    <div className="staff-manage-section">
     <h4>Role</h4><p>Choose the type of work this employee performs.</p>
     <label>Assigned role
      <select value={selectedStaff.role} aria-label={'Role for '+selectedStaff.name}
       disabled={saving!==null||selectedStaff.userId===user?.id}
       onChange={event=>proposeChange(selectedStaff,{role:event.target.value as StaffRole})}>
       {roles.map(r=><option key={r} value={r}>{roleName[r]}</option>)}
      </select>
     </label>
     <small>{roleProfiles.data?.data.roles.find(r=>r.key===selectedStaff.role)?.description}</small>
    </div>
    <div className="staff-manage-section">
     <h4>Individual permissions</h4>
     <p>{selectedStaff.role==='admin'
       ?'Manager access is controlled by the role and cannot be customized here.'
       :'Customize which actions this employee can perform within their assigned role.'}</p>
     <button type="button" className="btn-inline" disabled={saving!==null||selectedStaff.role==='admin'||selectedStaff.userId===user?.id}
      onClick={()=>beginPermissionEdit(selectedStaff)}>
      <ShieldCheck size={16}/> {selectedStaff.customPermissions?'Review custom permissions':'Edit permissions'}
     </button>
    </div>
    <div className="staff-manage-section staff-access-section">
     <h4>Account access</h4>
     <p>{selectedStaff.isActive?'Deactivating blocks access to this hotel immediately without deleting employee history.':'Reactivating restores the employee’s role permissions in this hotel.'}</p>
     <button type="button" className="btn-inline" disabled={saving!==null||selectedStaff.userId===user?.id}
      onClick={()=>proposeChange(selectedStaff,{isActive:!selectedStaff.isActive})}>
      {selectedStaff.isActive?'Deactivate hotel access':'Reactivate hotel access'}
     </button>
     {selectedStaff.userId===user?.id&&<small>For safety, you cannot remove your own administrator access.</small>}
    </div>
    <div className="guest-modal-actions"><button type="button" className="btn-inline"
      onClick={()=>setSelectedStaffId(null)}>Close</button></div>
   </section>
  </div>}
  {permissionEdit&&<div className="guest-modal-backdrop" role="presentation">
   <section className="guest-modal" role="dialog" aria-modal="true" aria-labelledby="staff-permissions-title">
    <div className="catalog-modal-heading">
     <h3 id="staff-permissions-title">Edit employee permissions</h3>
     <button type="button" className="icon-btn" aria-label="Close permission editor"
      disabled={saving!==null} onClick={()=>setPermissionEdit(null)}><X size={18}/></button>
    </div>
    <p><strong>{permissionEdit.name}</strong> · {roleName[permissionEdit.role]}</p>
    <p className="guest-info">Choose which of this role's actions this employee can perform. Related access requirements are updated together. Manager privileges and independent financial reviews cannot be delegated.</p>
    {roleProfiles.isPending&&<p role="status">Loading role permissions…</p>}
    {roleProfiles.isError&&<p role="alert">Role permissions unavailable. Close and refresh this page.</p>}
    {roleProfiles.data&&(()=>{
     const allowed=roleProfiles.data.data.roles.find(item=>item.key===permissionEdit.role)?.editablePermissions??[];
     const labels=new Map(roleProfiles.data.data.capabilities.map(item=>[item.key,item]));
     const groups=Array.from(new Set(allowed.map(key=>labels.get(key)?.group??'Other operational access')));
     return <div className="table-scroll">
      {groups.map(group=><fieldset key={group} disabled={saving!==null}>
       <legend><strong>{group}</strong></legend>
       {allowed.filter(key=>(labels.get(key)?.group??'Other operational access')===group).map(key=>
        <label key={key} className="guest-info" style={{display:'flex',gap:8,alignItems:'center',margin:'8px 0'}}>
         <input type="checkbox" checked={permissionEdit.selected.includes(key)}
          onChange={event=>changePermission(key,event.target.checked)}/>
         <span>{labels.get(key)?.label??key}</span>
        </label>)}
      </fieldset>)}
     </div>;
    })()}
    <div className="guest-modal-actions">
     <button type="button" className="btn-inline" disabled={saving!==null}
      onClick={()=>setPermissionEdit(current=>{
       const template=roleProfiles.data?.data.roles.find(item=>item.key===current?.role)?.editablePermissions;
       return current&&template?{...current,selected:[...template]}:current;
      })}>Restore role defaults</button>
     <button type="button" className="btn-inline" disabled={saving!==null}
      onClick={()=>setPermissionEdit(null)}>Cancel</button>
     <button type="button" className="btn-primary" disabled={saving!==null||!roleProfiles.isSuccess
      ||permissionEdit.selected.length===permissionEdit.original.length
       &&permissionEdit.original.every(key=>permissionEdit.selected.includes(key))}
      onClick={()=>void savePermissions()}>{saving?'Saving…':'Save permissions'}</button>
    </div>
   </section>
  </div>}
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
