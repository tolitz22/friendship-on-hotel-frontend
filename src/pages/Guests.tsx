import {useEffect,useState,type FormEvent} from 'react';
import {useQueryClient} from '@tanstack/react-query';
import {Link} from '@tanstack/react-router';
import {Search,Pencil,Plus,RotateCcw} from 'lucide-react';
import {useGuests} from '../api/queries';
import {dataMode} from '../api';
import {createLiveGuest,updateLiveGuest} from '../api/httpDataSource';
import {ApiError} from '../api/http';
import {useHotelAuth} from '../components/AuthProvider';
import {DemoNotice,Heading,Panel} from '../components/ui';
import {QueryFeedback} from '../components/QueryFeedback';
import {dateLabel} from '../lib/format';
import type {Guest} from '../api/types';
import {GuestStayHistory} from '../components/GuestStayHistory';

type GuestDraft={firstName:string;lastName:string;email:string;phone:string;nationality:string};
const emptyDraft=():GuestDraft=>({firstName:'',lastName:'',email:'',phone:'',nationality:''});
const fromGuest=(guest:Guest):GuestDraft=>({
 firstName:guest.firstName,lastName:guest.lastName,email:guest.email??'',phone:guest.phone??'',nationality:guest.nationality??''
});
export function Guests(){
 const live=dataMode==='api';
 const {user,hotelId}=useHotelAuth();
 const admin=live&&!!user?.hotels.some(h=>h.id===hotelId&&h.role==='admin');
 const [search,setSearch]=useState('');
 const [page,setPage]=useState(1);
 const query=useGuests({search,page,perPage:20});
 const queryClient=useQueryClient();
 const [editing,setEditing]=useState<Guest|null>(null);
 const [historyGuest,setHistoryGuest]=useState<Guest|null>(null);
 const [draft,setDraft]=useState<GuestDraft|null>(null);
 const [saving,setSaving]=useState(false);
 const [formError,setFormError]=useState('');
 const [fieldErrors,setFieldErrors]=useState<Record<string,string[]>>({});
 // A property switch must not leave a different hotel's guest profile in the editor.
 useEffect(()=>{setHistoryGuest(null);setDraft(null);setEditing(null);setFormError('');setFieldErrors({});setSearch('');setPage(1);},[hotelId]);
 const openCreate=()=>{setEditing(null);setDraft(emptyDraft());setFormError('');setFieldErrors({});};
 const openEdit=(guest:Guest)=>{setEditing(guest);setDraft(fromGuest(guest));setFormError('');setFieldErrors({});};
 const close=()=>{setDraft(null);setFormError('');setFieldErrors({});};
 const setField=(field:keyof GuestDraft,value:string)=>setDraft(current=>current?{...current,[field]:value}:null);
 async function save(e:FormEvent<HTMLFormElement>){
  e.preventDefault();
  if(!draft||saving||!admin)return;
  setSaving(true);setFormError('');setFieldErrors({});
  try{
   const body={firstName:draft.firstName.trim(),lastName:draft.lastName.trim(),
    email:draft.email.trim()||null,phone:draft.phone.trim()||null,nationality:draft.nationality.trim()||null};
   if(editing)await updateLiveGuest(editing.id,body);
   else await createLiveGuest(body);
   await queryClient.invalidateQueries({queryKey:['guests']});
   close();
  }catch(error){
   setFormError(error instanceof Error?error.message:'Could not save guest.');
   if(error instanceof ApiError)setFieldErrors(error.fieldErrors??{});
  }finally{setSaving(false);}
 }
 const totalPages=query.data?.meta.totalPages??1;
 return <>
 {live?<div className="notice"><strong>Guest records</strong> · Manage the guest directory for the selected hotel. Reservation and payment activities are handled in their respective sections.</div>:<DemoNotice/>}
 <Heading title="Guest directory" description={live?'View and manage guest profiles for this hotel.':'Example guest profiles and contact details, using fictional sample records.'}
  action={<button type="button" className="btn-primary" disabled={!admin} onClick={openCreate}><Plus size={16}/>{live?'Add guest':'Add guest (available in live mode)'}</button>}/>
 <Panel title="Guest profiles" action={<span className="table-count">{query.data?.meta.total??'—'} profiles</span>}>
 <div className="table-toolbar"><label className="search-box"><Search size={17}/><input value={search} onChange={e=>{setSearch(e.target.value);setPage(1);}} aria-label="Search guests" placeholder="Search guest name or email"/></label>
 <button type="button" className="btn-inline" onClick={()=>void query.refetch()}><RotateCcw size={15}/> Refresh</button></div>
 <QueryFeedback loading={query.isPending} error={query.error} empty={query.data?.data.length===0}/>
 {query.data&&query.data.data.length>0&&<div className="table-scroll"><table><thead><tr><th>Guest</th><th>Email</th><th>Phone</th><th>Nationality</th><th>Created</th>{live&&<th>Stay history</th>}{admin&&<th>Actions</th>}</tr></thead><tbody>{query.data.data.map(g=><tr key={g.id}><td><strong>{g.firstName} {g.lastName}</strong></td><td>{g.email??'—'}</td><td>{g.phone??'—'}</td><td>{g.nationality??'—'}</td><td>{dateLabel(g.createdAt.slice(0,10))}</td>{live&&<td><button type="button" className="btn-inline" onClick={()=>setHistoryGuest(g)}>View stays</button></td>}{admin&&<td><div className="guest-inline-actions">
 <button type="button" className="guest-edit-button" onClick={()=>openEdit(g)}><Pencil size={14}/> Edit</button>
 {live&&<Link className="inline-task-link" to="/reservations" search={{guest:g.id}}>Create booking</Link>}
 </div></td>}</tr>)}</tbody></table></div>}
 {query.data&&<div className="guest-pagination"><span>Page {query.data.meta.page} of {Math.max(1,totalPages)}</span><div><button className="btn-inline" disabled={page<=1} onClick={()=>setPage(p=>Math.max(1,p-1))}>Previous</button><button className="btn-inline" disabled={page>=totalPages} onClick={()=>setPage(p=>p+1)}>Next</button></div></div>}
 </Panel>
 {live&&historyGuest&&<GuestStayHistory key={hotelId+'-'+historyGuest.id}
  guestId={historyGuest.id} name={historyGuest.firstName+' '+historyGuest.lastName}
  onClose={()=>setHistoryGuest(null)}/>}
 {live&&!admin&&<div className="guest-info">Guest creation and editing are restricted to hotel administrators in this milestone.</div>}
 {draft&&admin&&<div className="guest-modal-backdrop" role="presentation"><section className="guest-modal" role="dialog" aria-modal="true" aria-label={editing?'Edit guest':'Add guest'}>
 <h3>{editing?'Edit guest profile':'Add guest'}</h3><p>Only the selected hotel's guest profile will be changed.</p>
 <form onSubmit={e=>void save(e)}>
 <div className="guest-fields">
 {(['firstName','lastName','email','phone','nationality'] as const).map(field=><label key={field}>
  {({firstName:'First name',lastName:'Last name',email:'Email',phone:'Phone',nationality:'Nationality'} as const)[field]}
  <input type={field==='email'?'email':'text'} value={draft[field]} required={field==='firstName'||field==='lastName'} maxLength={field==='phone'?40:field==='nationality'?100:field==='email'?255:120} disabled={saving} onChange={e=>setField(field,e.target.value)} />
  {fieldErrors[field]?.map((error,i)=><small role="alert" key={i}>{error}</small>)}
 </label>)}
 </div>
 {formError&&<p role="alert" className="auth-error">{formError}</p>}
 <div className="guest-modal-actions"><button type="button" className="btn-inline" onClick={close} disabled={saving}>Cancel</button><button type="submit" className="btn-primary" disabled={saving}>{saving?'Saving…':'Save guest'}</button></div>
 </form>
 </section></div>}
 </>;
}
