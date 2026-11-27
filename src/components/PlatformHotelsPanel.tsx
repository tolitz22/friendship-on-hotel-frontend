import {useRef,useState,type FormEvent} from 'react';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {Building2,Plus,Search,RefreshCw,Users,DoorOpen,ShieldCheck,X} from 'lucide-react';
import {ApiError} from '../api/http';
import {createPlatformHotel,fetchPlatformHotels} from '../api/platformHotels';
import './PlatformHotelsPanel.css';
import {PlatformHotelAccessPanel} from './PlatformHotelAccessPanel';
import {accessLabels} from '../api/platformHotelAccess';
import type {PlatformHotel} from '../api/platformHotels';

export function PlatformHotelsPanel({userId}:{userId:string}){
 const client=useQueryClient();
 const [search,setSearch]=useState(''),[applied,setApplied]=useState(''),[page,setPage]=useState(1);
 const [creating,setCreating]=useState(false),[saving,setSaving]=useState(false),[error,setError]=useState(''),[success,setSuccess]=useState('');
 const [accessHotel,setAccessHotel]=useState<PlatformHotel|null>(null);
 const submitting=useRef(false);
 const query=useQuery({queryKey:['platform-hotels',userId,applied,page],queryFn:({signal})=>fetchPlatformHotels(applied,page,signal),retry:false,gcTime:0,staleTime:30000,refetchOnWindowFocus:false});
 const result=query.isError?undefined:query.data;
 async function submit(e:FormEvent<HTMLFormElement>){
  e.preventDefault();
  if(submitting.current)return;
  const form=e.currentTarget;
  const fields=new FormData(form);
  const value=(name:string)=>String(fields.get(name)??'');
  const password=value('password'),confirmation=value('password_confirmation');
  if(password!==confirmation){setError('Passwords do not match.');return;}
  submitting.current=true;setSaving(true);setError('');setSuccess('');
  try{
   const response=await createPlatformHotel({name:value('name').trim(),adminName:value('adminName').trim(),adminEmail:value('adminEmail').trim(),password,password_confirmation:confirmation});
   form.reset();setCreating(false);setSearch('');setApplied('');setPage(1);
   setSuccess(response.data.name+' was created with its first manager. Share the initial credentials securely; the manager must change the password at sign-in.');
   await client.invalidateQueries({queryKey:['platform-hotels',userId]});
  }catch(failure){
   setError(failure instanceof ApiError&&failure.status===422?'Check the property name, new manager email and password requirements. Existing accounts cannot be reused.':failure instanceof ApiError&&failure.status===429?'Too many onboarding attempts. Wait before trying again.':'Creation could not be confirmed. Refresh the directory before retrying.');
  }finally{submitting.current=false;setSaving(false);}
 }
 return <section className="platform-hotels" aria-label="Customer hotels">
  <div className="platform-title"><div><span className="eyebrow">CUSTOMER MANAGEMENT</span><h1>Hotels</h1><p>Manage customer properties and onboard their first administrator.</p></div><button className="btn-primary" disabled={creating||saving} onClick={()=>{setError('');setSuccess('');setAccessHotel(null);setCreating(true);}}><Plus size={17}/> New hotel</button></div>
  {success&&<div className="panel platform-hotel-feedback" role="status"><ShieldCheck size={19}/><span>{success}</span><button className="icon-btn" aria-label="Dismiss confirmation" onClick={()=>setSuccess('')}><X size={16}/></button></div>}
  {accessHotel&&<PlatformHotelAccessPanel key={accessHotel.id} hotelId={accessHotel.id} hotelName={accessHotel.name} userId={userId} onClose={()=>setAccessHotel(null)} onSaved={()=>{void client.invalidateQueries({queryKey:['platform-hotels',userId]});}}/>}
  {creating&&<section className="panel platform-hotel-form"><div className="panel-title"><div><h2>Onboard a hotel</h2><p>Create a Philippine property and its first manager together.</p></div><button className="icon-btn" disabled={saving} aria-label="Close onboarding" onClick={()=>{setCreating(false);setError('');}}><X size={18}/></button></div>
   <form onSubmit={e=>void submit(e)}><fieldset disabled={saving}><h3>Property</h3><label>Hotel name<input name="name" required minLength={2} maxLength={160} autoComplete="organization" placeholder="Property name"/></label><div className="platform-hotel-defaults"><span>Currency: <strong>PHP</strong></span><span>Time zone: <strong>Asia/Manila</strong></span></div><h3>First manager</h3><div className="platform-hotel-fields"><label>Full name<input name="adminName" required minLength={2} maxLength={120} autoComplete="off"/></label><label>Email address<input name="adminEmail" type="email" required maxLength={254} autoComplete="off"/></label><label>Initial password<input name="password" type="password" required minLength={12} maxLength={72} autoComplete="new-password"/></label><label>Confirm password<input name="password_confirmation" type="password" required minLength={12} maxLength={72} autoComplete="new-password"/></label></div><p className="platform-note">At least 12 characters with uppercase, lowercase and numbers. The manager must change the initial password. No email is sent automatically.</p><p className="platform-note">This creates an active property, not a paid subscription. Room setup and business date configuration are still required.</p>{error&&<p className="platform-error" role="alert">{error}</p>}<div className="platform-hotel-form-actions"><button type="button" className="btn-inline" onClick={()=>{setCreating(false);setError('');}}>Cancel</button><button type="submit" className="btn-primary">{saving?'Creating…':'Create hotel & manager'}</button></div></fieldset></form>
  </section>}
  <section className="panel platform-hotel-directory"><div className="panel-title"><div><h2>Hotel directory</h2><p>{result?result.meta.total.toLocaleString()+' matching properties':'Customer properties'}</p></div><button className="icon-btn" aria-label="Refresh directory" disabled={query.isFetching} onClick={()=>void query.refetch({cancelRefetch:false})}><RefreshCw size={17} className={query.isFetching?'platform-spin':''}/></button></div>
   <form className="platform-hotel-search" onSubmit={e=>{e.preventDefault();setApplied(search.trim());setPage(1);}}><label><span>Search hotels</span><input value={search} onChange={e=>setSearch(e.target.value)} maxLength={100} placeholder="Search by property name"/></label><button className="btn-inline" aria-label="Search hotels"><Search size={17}/></button>{applied&&<button type="button" className="btn-inline" onClick={()=>{setSearch('');setApplied('');setPage(1);}}>Clear</button>}</form>
   {query.isPending?<p role="status" className="empty-state">Loading hotels…</p>:query.isError?<p role="alert" className="empty-state">Hotel directory unavailable. Check your access and connection, then refresh.</p>:result?.data.length===0?<p className="empty-state">No matching properties.</p>:<div className="platform-hotel-list">{result?.data.map(h=><article key={h.id} className="platform-hotel-row"><div className="platform-hotel-name"><div className="platform-hotel-icon"><Building2 size={21}/></div><div><h3>{h.name}</h3><small>Property #{h.id} · {h.currency} · {h.timezone}</small>{h.createdAt&&<small>Created {new Date(h.createdAt).toLocaleDateString()}</small>}</div></div><div className="platform-hotel-counts"><div><DoorOpen size={15}/><strong>{h.roomCount}</strong><small>Rooms</small></div><div><Users size={15}/><strong>{h.activeStaffCount}</strong><small>Active staff</small></div><div><ShieldCheck size={15}/><strong>{h.activeAdminCount}</strong><small>Active admins</small></div></div><div className="hotel-access-directory-actions"><span className={'hotel-access-label '+(h.accessState??'')}>{h.accessState?accessLabels[h.accessState]:'Access unknown'}</span><button type="button" className="btn-inline" disabled={creating||saving||!!accessHotel} onClick={()=>setAccessHotel(h)}>Manage access</button><span className={'platform-hotel-readiness'+(h.activeAdminCount===0?' needs-admin':'')}>{h.activeAdminCount===0?'No active manager':h.roomCount===0?'Room setup needed':'Rooms registered'}</span></div></article>)}</div>}
   {result&&<div className="platform-pagination"><button className="btn-inline" disabled={page<=1||query.isFetching} onClick={()=>setPage(p=>p-1)}>Previous</button><span>Page {result.meta.page} of {result.meta.lastPage}</span><button className="btn-inline" disabled={page>=result.meta.lastPage||query.isFetching} onClick={()=>setPage(p=>p+1)}>Next</button></div>}
  </section><p className="platform-note">Directory counts describe registered rooms and active memberships, not subscription or full operational readiness.</p>
 </section>;
}
