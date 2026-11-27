import {useState,type FormEvent} from 'react';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {useSearch} from '@tanstack/react-router';
import {useHotelAuth} from '../components/AuthProvider';
import {useLiveRooms} from '../api/liveCatalogQueries';
import {Heading} from '../components/ui';
import {QueryFeedback} from '../components/QueryFeedback';
import {createLostFound,listLostFound,lostFoundHistory,updateLostFound,type CustodyAction,type LostFoundItem} from '../api/lostFound';
import {readSession} from '../api/session';
import {useNetworkStatus} from '../features/housekeeping/useNetworkStatus';
export function LostFound(){
 const {hotelId,user}=useHotelAuth();
 const {room,item}=useSearch({from:'/lost-found'});
 if(!hotelId||!user)return null;
 const member=user.hotels.find(h=>h.id===hotelId);
 return <Register key={hotelId+':'+user.id+':'+(room??'')+':'+(item??'')} hotelId={hotelId} userId={user.id} admin={member?.role==='admin'} canRegister={member?.role==='admin'||member?.role==='housekeeping'&&member.permissions?.includes('housekeeping.assigned')!==false} initialRoom={room} initialItem={item}/>;
}
function Register({hotelId,userId,admin,canRegister,initialRoom,initialItem}:{hotelId:string;userId:string;admin:boolean;canRegister:boolean;initialRoom?:string;initialItem?:string}){
 const client=useQueryClient();
 const online=useNetworkStatus();
 const [page,setPage]=useState(1);const [status,setStatus]=useState('');const [itemFilter,setItemFilter]=useState(initialItem);
 const [open,setOpen]=useState(!!initialRoom&&canRegister);const [roomId,setRoomId]=useState(initialRoom??'');
 const [search,setSearch]=useState('');const [description,setDescription]=useState('');const [storage,setStorage]=useState('');
 const [requestKey,setRequestKey]=useState(()=>crypto.randomUUID());const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');const [message,setMessage]=useState('');
 const [selected,setSelected]=useState<LostFoundItem|null>(null);const [action,setAction]=useState<CustodyAction>('move');
 const [destination,setDestination]=useState('');const [note,setNote]=useState('');const [historyPage,setHistoryPage]=useState(1);
 const rooms=useLiveRooms({page:1,perPage:100,search:search.trim()||undefined},open);
 const list=useQuery({queryKey:['lost-found',hotelId,userId,page,status,itemFilter],queryFn:()=>listLostFound(hotelId,page,status,admin?undefined:userId,itemFilter),retry:false});
 const history=useQuery({queryKey:['lost-found-history',hotelId,selected?.id,historyPage],enabled:!!selected,queryFn:()=>lostFoundHistory(hotelId,selected!.id,historyPage),retry:false});
 const refresh=()=>void client.invalidateQueries({queryKey:['lost-found',hotelId]});
 async function register(event:FormEvent){
  event.preventDefault();if(!online||busy||!canRegister||!roomId||!description.trim()||!storage.trim())return;
  setBusy(true);setError('');setMessage('');
  try{const row=await createLostFound(hotelId,{roomId,description:description.trim(),storageLocation:storage.trim(),requestKey});
   if(readSession().hotelId!==hotelId)return;
   setMessage('Item LF-'+row.id+' registered. Label and store the item securely.');setOpen(false);setDescription('');setStorage('');setRequestKey(crypto.randomUUID());setPage(1);setStatus('');setItemFilter(undefined);refresh();}
  catch(e){setError(e instanceof Error?e.message:'Unable to register item.');}finally{setBusy(false);}
 }
 async function custody(event:FormEvent){
  event.preventDefault();if(!online||!admin||!selected||busy||note.trim().length<5||action==='move'&&!destination.trim())return;
  setBusy(true);setError('');setMessage('');
  try{const row=await updateLostFound(hotelId,selected,{action,note:note.trim(),...(action==='move'?{storageLocation:destination.trim()}:{})});
   if(readSession().hotelId!==hotelId)return;
   setSelected(row);setNote('');setMessage('Custody update recorded.');refresh();void client.invalidateQueries({queryKey:['lost-found-history',hotelId,row.id]});}
  catch(e){setError(e instanceof Error?e.message:'Unable to update custody.');}finally{setBusy(false);}
 }
 return <div className="hk-room-board">
  <div className="hk-board-heading"><Heading title="Lost & found" description={admin?'Register, store and track items recovered at this hotel.':'Register found items and track your own reports.'}/>
   {canRegister&&<button type="button" className="btn-primary" disabled={busy} onClick={()=>{setOpen(v=>!v);setSelected(null);setError('');}}>{open?'Close registration':'Register found item'}</button>}</div>
  <p className="role-note">Record a neutral description and secure storage location. Do not record ID numbers, payment details or other sensitive guest information.</p>
  {!online&&<p className="hk-network-alert" role="status">You are offline. Reconnect before registering or transferring items.</p>}
  {message&&<p role="status" className="stay-feedback-success">{message}</p>}{error&&<p role="alert">{error}</p>}
  {open&&canRegister&&<form className="hk-report-form hk-report-panel" onSubmit={e=>void register(e)}>
   <label>Find room<input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search room number" disabled={busy}/></label>
   <label>Room<select required value={roomId} disabled={busy} onChange={e=>setRoomId(e.target.value)}><option value="">Select room</option>
    {roomId&&!rooms.data?.data.some(r=>r.id===roomId)&&<option value={roomId}>Selected room #{roomId}</option>}
    {rooms.data?.data.map(r=><option key={r.id} value={r.id}>Room {r.number}</option>)}</select></label>
   {rooms.data&&rooms.data.meta.total>100&&<small>Search by room number to find rooms outside the first 100.</small>}
   <label>Item description<textarea required maxLength={500} value={description} disabled={busy} onChange={e=>setDescription(e.target.value)} placeholder="e.g. Black umbrella"/></label>
   <label>Secure storage location<input required maxLength={160} value={storage} disabled={busy} onChange={e=>setStorage(e.target.value)} placeholder="e.g. Reception locker A"/></label>
   <button type="submit" className="btn-primary" disabled={!online||busy||!roomId||!description.trim()||!storage.trim()}>{busy?'Saving…':'Register item'}</button>
  </form>}
  {itemFilter&&<p role="status">Showing item LF-{itemFilter}. <button className="btn-inline" type="button" onClick={()=>{setItemFilter(undefined);setPage(1);}}>Show all items</button></p>}
  <div className="hk-queue-tabs" role="group" aria-label="Item status">{['','stored','returned','disposed'].map(value=><button type="button" key={value} aria-pressed={status===value} className={status===value?'active':''} onClick={()=>{setStatus(value);setPage(1);}}>{value||'All items'}</button>)}</div>
  <QueryFeedback loading={list.isPending} error={list.error} onRetry={()=>void list.refetch()}/>
  {list.isSuccess&&<><div className="hk-board-grid">{list.data.data.map(row=><article className="hk-board-room" key={row.id}>
   <strong>LF-{row.id} · {row.status}</strong><span>{row.description}</span><small>Room {row.roomNumber} · {row.reportedAt}</small><span>Storage: {row.storageLocation}</span>
   <button type="button" className="btn-inline" disabled={busy} onClick={()=>{setSelected(row);setOpen(false);setAction('move');setDestination(row.storageLocation);setNote('');setHistoryPage(1);setError('');}}>View custody history</button>
  </article>)}</div>{list.data.data.length===0&&<p>No items in this view.</p>}
  <div className="hk-report-actions"><button type="button" className="btn-inline" disabled={page<=1} onClick={()=>setPage(p=>p-1)}>Previous</button><span>Page {page} of {Math.max(1,list.data.meta.totalPages)} · {list.data.meta.total} items</span><button type="button" className="btn-inline" disabled={page>=list.data.meta.totalPages} onClick={()=>setPage(p=>p+1)}>Next</button></div></>}
  {selected&&<section className="hk-report-panel" aria-label="Item custody details"><div className="hk-board-heading"><h3>Item LF-{selected.id} · {selected.status}</h3><button type="button" className="btn-inline" disabled={busy} onClick={()=>setSelected(null)}>Close details</button></div>
   <p>{selected.description} · Room {selected.roomNumber}</p><p>Recorded storage: {selected.storageLocation}</p>
   {admin&&selected.status==='stored'&&<form className="hk-report-form" onSubmit={e=>void custody(e)}>
    <label>Custody action<select value={action} disabled={busy} onChange={e=>setAction(e.target.value as CustodyAction)}><option value="move">Transfer storage</option><option value="return">Return to verified claimant</option><option value="dispose">Record approved disposal</option></select></label>
    {action==='move'&&<label>New storage location<input required maxLength={160} value={destination} disabled={busy} onChange={e=>setDestination(e.target.value)}/></label>}
    <label>{action==='dispose'?'Policy authorization and disposal evidence':action==='return'?'Claim verification and handover evidence':'Transfer reason'}<textarea required minLength={5} maxLength={2000} value={note} disabled={busy} onChange={e=>setNote(e.target.value)}/></label>
    {action!=='move'&&<p>Only record an actual completed handover or policy-authorized disposal. This final outcome cannot be reversed here.</p>}
    <button type="submit" className="btn-primary" disabled={!online||busy||note.trim().length<5||action==='move'&&!destination.trim()}>{busy?'Saving…':'Record custody action'}</button>
   </form>}
   <h4>Custody history</h4><QueryFeedback loading={history.isPending} error={history.error} onRetry={()=>void history.refetch()}/>
   {history.data?.data.map(event=><div key={event.id} className="hk-custody-event"><strong>{event.action} · {event.after.status}</strong><small>{event.createdAt} · Staff #{event.actorId}</small><span>{event.after.storageLocation}</span>{event.note&&<p>{event.note}</p>}</div>)}
   {history.data&&<div className="hk-report-actions"><button className="btn-inline" type="button" disabled={historyPage<=1} onClick={()=>setHistoryPage(p=>p-1)}>Previous events</button><button className="btn-inline" type="button" disabled={historyPage>=history.data.meta.totalPages} onClick={()=>setHistoryPage(p=>p+1)}>Next events</button></div>}
  </section>}
 </div>;
}
