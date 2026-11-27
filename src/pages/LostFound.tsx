import {useState,type FormEvent} from 'react';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {useSearch} from '@tanstack/react-router';
import {useHotelAuth} from '../components/AuthProvider';
import {useLiveRooms} from '../api/liveCatalogQueries';
import {Package,Plus,RefreshCw} from 'lucide-react';
import {ShiftDialog} from '../features/housekeeping/ShiftDialog';
import {readableDate} from '../lib/format';
import {QueryFeedback} from '../components/QueryFeedback';
import {createLostFound,listLostFound,lostFoundHistory,updateLostFound,type CustodyAction,type LostFoundItem} from '../api/lostFound';
import {readSession} from '../api/session';
import {useNetworkStatus} from '../features/housekeeping/useNetworkStatus';
const statuses={stored:'In storage',returned:'Returned',disposed:'Disposed'};
const custodyEvents={registered:'Item registered',move:'Storage transferred',return:'Returned to claimant',dispose:'Disposal recorded'};
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
 const readyToRegister=online&&!busy&&!!roomId&&!!description.trim()&&!!storage.trim();
 return <div className="hk-shift">
  <header className="hk-shift-header">
   <div><h2>Lost &amp; found</h2><p>{admin?'Register and track recovered items.':'Register an item and check where you stored it.'}</p></div>
   {canRegister&&<button type="button" className="btn-primary" disabled={busy} onClick={()=>{setOpen(true);setSelected(null);setError('');setMessage('');}}><Plus size={16} aria-hidden="true"/> Register found item</button>}
  </header>
  {!online&&<p className="hk-network-alert" role="status">You’re offline. Reconnect to load records or save changes.</p>}
  {message&&!selected&&<p role="status" className="stay-feedback-success">{message}</p>}
  <div className="hk-shift-toolbar" role="group" aria-label="Item status">
   {(['','stored','returned','disposed'] as const).map(value=><button type="button" key={value} className="btn-inline" aria-pressed={status===value}
    onClick={()=>{setStatus(value);setPage(1);}}>{value?statuses[value]:admin?'All items':'My reports'}</button>)}
   <button type="button" className="btn-inline" disabled={!online||list.isFetching} onClick={()=>void list.refetch()}><RefreshCw size={15} aria-hidden="true"/> Refresh</button>
  </div>
  {itemFilter&&<div className="hk-shift-actions"><p className="hk-shift-muted">Showing item LF-{itemFilter}</p><button className="btn-inline" type="button" onClick={()=>{setItemFilter(undefined);setPage(1);}}>Show all items</button></div>}
  {online&&<QueryFeedback loading={list.isPending} error={list.error} onRetry={()=>void list.refetch()}
   empty={list.isSuccess&&list.data.data.length===0} emptyMessage={status||itemFilter?'No items match this view.':admin?'No found items have been registered.':'You haven’t registered any found items yet.'}/>}
  {online&&list.isSuccess&&<>
   <div className="hk-shift-cards">{list.data.data.map(row=><article className="hk-shift-card" key={row.id}>
    <div className="hk-shift-card-title"><h3>{row.description}</h3><span className="hk-shift-pill">{statuses[row.status]}</span></div>
    <small>Room {row.roomNumber} · {readableDate(row.reportedAt)} · LF-{row.id}</small>
    <p><Package size={16} aria-hidden="true" className="inline"/> {row.storageLocation}</p>
    <div className="hk-shift-actions"><button type="button" className="btn-inline" disabled={busy}
     onClick={()=>{setSelected(row);setOpen(false);setAction('move');setDestination(row.storageLocation);setNote('');setHistoryPage(1);setError('');setMessage('');}}>View item history</button></div>
   </article>)}</div>
   {list.data.meta.totalPages>1&&<div className="hk-shift-actions"><button className="btn-inline" type="button" disabled={page<=1} onClick={()=>setPage(p=>p-1)}>Previous</button>
    <span className="hk-shift-muted">Page {page} of {list.data.meta.totalPages}</span><button className="btn-inline" type="button" disabled={page>=list.data.meta.totalPages} onClick={()=>setPage(p=>p+1)}>Next</button></div>}
  </>}

  {open&&canRegister&&<ShiftDialog title="Register found item" busy={busy} onClose={()=>{setOpen(false);setError('');}}
   actions={<button form="hk-register-item" type="submit" className="btn-primary" disabled={!readyToRegister}>{busy?'Registering…':'Register item'}</button>}>
   <form id="hk-register-item" className="hk-shift-fields" onSubmit={e=>void register(e)}>
    {!online&&<p className="hk-network-alert" role="status">You’re offline. Your draft is still open.</p>}
    {!initialRoom&&<label>Find room<input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search room number" disabled={busy}/></label>}
    <label>Room<select required value={roomId} disabled={busy} onChange={e=>setRoomId(e.target.value)}><option value="">Select room</option>
     {roomId&&!rooms.data?.data.some(room=>room.id===roomId)&&<option value={roomId}>Selected room #{roomId}</option>}
     {rooms.data?.data.map(room=><option key={room.id} value={room.id}>Room {room.number}</option>)}</select></label>
    <QueryFeedback loading={rooms.isPending} error={rooms.error} onRetry={()=>void rooms.refetch()}/>
    {!!initialRoom&&<label>Find a different room<input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search room number" disabled={busy}/></label>}
    <label>Item description<textarea required maxLength={500} rows={3} value={description} disabled={busy} onChange={e=>setDescription(e.target.value)} placeholder="e.g. Black umbrella"/></label>
    <label>Secure storage location<input required maxLength={160} value={storage} disabled={busy} onChange={e=>setStorage(e.target.value)} placeholder="e.g. Reception locker A"/></label>
    <p className="hk-shift-muted">Use a description without guest names, ID numbers or payment details.</p>
    {error&&<p role="alert" className="auth-error">{error}</p>}
   </form>
  </ShiftDialog>}

  {selected&&<ShiftDialog title={selected.description} context={'Room '+selected.roomNumber+' · LF-'+selected.id} busy={busy} onClose={()=>{setSelected(null);setError('');}}>
   <div className="hk-shift">
    <dl className="hk-shift-details"><div><dt>Status</dt><dd>{statuses[selected.status]}</dd></div><div><dt>Storage</dt><dd>{selected.storageLocation}</dd></div></dl>
    {admin&&selected.status==='stored'&&<form className="hk-shift-fields" onSubmit={e=>void custody(e)}>
     <label>Custody action<select value={action} disabled={busy} onChange={e=>setAction(e.target.value as CustodyAction)}><option value="move">Transfer storage</option><option value="return">Return to verified claimant</option><option value="dispose">Record approved disposal</option></select></label>
     {action==='move'&&<label>New storage location<input required maxLength={160} value={destination} disabled={busy} onChange={e=>setDestination(e.target.value)}/></label>}
     <label>{action==='dispose'?'Disposal approval and evidence':action==='return'?'Claim verification and handover evidence':'Transfer reason'}<textarea required minLength={5} maxLength={2000} value={note} disabled={busy} onChange={e=>setNote(e.target.value)}/></label>
     {action!=='move'&&<p className="hk-shift-muted">Record the outcome after completing the handover or approved disposal. The outcome is final.</p>}
     <button type="submit" className="btn-primary" disabled={!online||busy||note.trim().length<5||action==='move'&&!destination.trim()}>{busy?'Saving…':'Record custody action'}</button>
    </form>}
    {error&&<p role="alert" className="auth-error">{error}</p>}
    {message&&<p role="status" className="stay-feedback-success">{message}</p>}
    <section aria-label="Custody history">
     <h3>Custody history</h3>
     <QueryFeedback loading={history.isPending} error={history.error} onRetry={()=>void history.refetch()} empty={history.isSuccess&&!history.data.data.length} emptyMessage="No custody activity has been recorded."/>
     {history.isSuccess&&history.data.data.map(event=><article key={event.id} className="readable-audit-event">
      <strong>{custodyEvents[event.action]}</strong> <span className="hk-shift-muted">{readableDate(event.createdAt)} · {event.actorId===userId?'You':'Staff #'+event.actorId}</span>
      <p>{event.after.storageLocation}</p>{event.note&&<p className="readable-audit-note">{event.note}</p>}
     </article>)}
     {history.isSuccess&&history.data.meta.totalPages>1&&<div className="hk-shift-actions"><button className="btn-inline" type="button" disabled={historyPage<=1} onClick={()=>setHistoryPage(p=>p-1)}>Newer events</button>
      <button className="btn-inline" type="button" disabled={historyPage>=history.data.meta.totalPages} onClick={()=>setHistoryPage(p=>p+1)}>Older events</button></div>}
    </section>
   </div>
  </ShiftDialog>}
 </div>;
}
