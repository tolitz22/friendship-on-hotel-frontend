import {useEffect,useRef,useState} from 'react';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {AlertTriangle,KeyRound,RefreshCw,ShieldCheck} from 'lucide-react';
import {Link,useSearch} from '@tanstack/react-router';
import {useHotelAuth} from '../components/AuthProvider';
import {Heading,Panel} from '../components/ui';
import {QueryFeedback} from '../components/QueryFeedback';
import {readSession} from '../api/session';
import {createKeycardRequest,keycardHistory,reviewKeycard,revokeKeycard,useKeycardAuthorizations} from '../api/keycardAuthorizations';
import type {KeycardAuthorization,KeycardKind} from '../api/keycardAuthorizations';

function KeycardRow({item,manager,onChanged}:{item:KeycardAuthorization;manager:boolean;onChanged:()=>void}){
 const {hotelId}=useHotelAuth();
 const [note,setNote]=useState('');
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [showHistory,setShowHistory]=useState(false);
 const history=useQuery({
  queryKey:['live','keycard-history',hotelId,item.id],
  enabled:!!hotelId&&showHistory,
  queryFn:()=>keycardHistory(hotelId!,item.id),retry:false,
 });
 async function decide(action:'approve'|'reject'|'revoke'){
  if(!hotelId||busy||note.trim().length<10)return;
  setBusy(true);setError('');
  try{
   if(action==='revoke')await revokeKeycard(hotelId,item.id,note.trim());
   else await reviewKeycard(hotelId,item.id,action,note.trim());
   if(readSession().hotelId===hotelId){setNote('');onChanged();}
  }catch(e){setError(e instanceof Error?e.message:'Review outcome unknown. Refresh before retrying.');}
  finally{setBusy(false);}
 }
 return <article className="ex-record">
  <div className="desk-tools"><strong>#{item.id} · {item.kind.replaceAll('_',' ')}</strong>
   <span className="table-count">{item.status.replaceAll('_',' ')}</span></div>
  <p>Room #{item.roomId} · {item.bookingId
   ?<Link to="/reservations" search={{booking:item.bookingId}}>Reservation #{item.bookingId}</Link>
   :'Emergency request (no guest booking)'}</p>
  <p><strong>Reason:</strong> {item.reason}</p>
  <p className="desk-muted">Requested by staff #{item.requestedBy} · Valid window {item.validFrom} to {item.validUntil}
   {' · '}Provider: {item.provider} · No card encoded</p>
  {item.providerReference&&<p className="desk-muted">Simulation reference: {item.providerReference}</p>}
  {item.reviewNote&&<p>Manager review: {item.reviewNote}</p>}
  {item.revocationNote&&<p>Revocation note: {item.revocationNote}</p>}
  {manager&&(item.status==='pending_manager'||item.status==='authorized_mock')&&<div className="wizard-fields">
   <label>Manager decision evidence (at least 10 characters)
    <textarea className="wizard-input" rows={2} value={note} maxLength={1000}
     onChange={e=>setNote(e.target.value)} placeholder="Record your independent verification and reason"/></label>
   <div className="desk-tools">
    {item.status==='pending_manager'&&<>
     <button className="btn-primary" disabled={busy||note.trim().length<10} type="button"
      onClick={()=>void decide('approve')}><ShieldCheck size={16}/> Approve mock authorization</button>
     <button className="btn-inline" disabled={busy||note.trim().length<10} type="button"
      onClick={()=>void decide('reject')}>Reject request</button>
    </>}
    {item.status==='authorized_mock'&&<button className="btn-inline" type="button"
     disabled={busy||note.trim().length<10} onClick={()=>void decide('revoke')}>
     Revoke authorization record</button>}
   </div>
  </div>}
  <button type="button" className="btn-inline" aria-expanded={showHistory}
   onClick={()=>setShowHistory(v=>!v)}>{showHistory?'Hide':'Show'} audit trail</button>
  {showHistory&&<div><QueryFeedback loading={history.isPending} error={history.error}
   onRetry={()=>void history.refetch()}/>
   {history.data?.data.map(event=><p key={event.id} className="desk-muted">
    {event.event} · Staff #{event.actorId} · {event.createdAt}
   </p>)}</div>}
  {error&&<p role="alert" className="auth-error"><AlertTriangle size={16}/>{error}</p>}
 </article>;
}

export function KeycardAccess(){
 const {booking:prefilledBooking}=useSearch({from:'/keycard-access'});
 const {hotelId,user}=useHotelAuth();
 const role=user?.hotels.find(h=>h.id===hotelId)?.role;
 const manager=role==='admin';
 const allowed=manager||role==='front_desk';
 const client=useQueryClient();
 const [kind,setKind]=useState<KeycardKind>('initial');
 const [bookingId,setBookingId]=useState('');
 const [roomId,setRoomId]=useState('');
 const [reason,setReason]=useState('');
 const [page,setPage]=useState(1);
 const [status,setStatus]=useState('all');
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [success,setSuccess]=useState('');
 const key=useRef<string|null>(null);
 const records=useKeycardAuthorizations(allowed,page,
  status==='all'?undefined:status as KeycardAuthorization['status']);
 useEffect(()=>{
  setKind('initial');setBookingId(prefilledBooking??'');setRoomId('');setReason('');setPage(1);
  setStatus('all');setError('');setSuccess('');key.current=null;
 },[hotelId,prefilledBooking]);
 const refresh=()=>{if(hotelId)void client.invalidateQueries({queryKey:['live','keycard-authorizations',hotelId]});};
 const valid=reason.trim().length>=10&&(kind==='emergency_access'
  ?/^[1-9]\d*$/.test(roomId):/^[1-9]\d*$/.test(bookingId));
 async function submit(){
  if(!hotelId||busy||!valid)return;
  setBusy(true);setError('');setSuccess('');
  if(!key.current)key.current=crypto.randomUUID();
  try{
   const result=await createKeycardRequest(hotelId,{
    idempotencyKey:key.current,kind,reason:reason.trim(),
    ...(kind==='emergency_access'?{roomId:Number(roomId)}:{bookingId:Number(bookingId)}),
   });
   if(readSession().hotelId!==hotelId)return;
   key.current=null;setReason('');
   setSuccess(result.status==='authorized_mock'
    ?'Mock authorization recorded. No card was encoded or door access granted.'
    :'Request submitted for independent manager review. No door access granted.');
   refresh();
  }catch(e){setError(e instanceof Error?e.message:'Request status uncertain; retry unchanged details.');}
  finally{setBusy(false);}
 }
 if(!allowed)return <><Heading title="Keycard access" description="Only receptionists and property managers can request or review access."/>
  <Panel title="Restricted"><p>The Laravel backend enforces active property roles.</p></Panel></>;
 return <>
  <Heading title="Keycard access · Simulation" description="Register eligible guest keycard requests, review exceptions, and audit decisions. Physical lock connectivity is disabled."/>
  <Panel title="New access request">
   <p className="desk-preview-note"><AlertTriangle size={16}/> Simulation only. A recorded request does not encode a card, revoke an actual key, or unlock a door.</p>
   <div className="wizard-fields">
    <label>Request type
     <select className="wizard-input" value={kind} disabled={busy}
      onChange={e=>{setKind(e.target.value as KeycardKind);key.current=null;setError('');setSuccess('');}}>
      <option value="initial">Initial checked-in guest authorization</option>
      <option value="replacement">Replacement card · manager review</option>
      <option value="emergency_access">Emergency access · manager review</option>
     </select></label>
    {kind==='emergency_access'?<label>Physical room ID
     <input className="wizard-input" inputMode="numeric" disabled={busy} value={roomId}
      onChange={e=>{setRoomId(e.target.value);key.current=null;}} placeholder="Room ID"/></label>
    :<label>Checked-in reservation ID
     <input className="wizard-input" inputMode="numeric" disabled={busy} value={bookingId}
      onChange={e=>{setBookingId(e.target.value);key.current=null;}} placeholder="Reservation ID"/></label>}
    <label>Document the request (10–1000 characters)
     <textarea className="wizard-input" maxLength={1000} rows={3} disabled={busy} value={reason}
      onChange={e=>{setReason(e.target.value);key.current=null;}} placeholder="Reason and evidence; do not include card secrets or sensitive guest identity details."/></label>
    <button className="btn-primary" type="button" disabled={!valid||busy} onClick={()=>void submit()}>
     <KeyRound size={16}/>{busy?'Submitting…':error?'Retry unchanged request':'Record authorization request'}</button>
   </div>
   {success&&<p role="status">{success}</p>}
   {error&&<p role="alert" className="auth-error">{error}. Refresh the list before retrying with a changed request.</p>}
  </Panel>
  <Panel title={manager?'Hotel access review inbox':'My keycard requests'}>
   <div className="desk-tools"><label>Status{' '}
    <select className="wizard-input" value={status}
     onChange={e=>{setStatus(e.target.value);setPage(1);}}>
     <option value="all">All</option>
     <option value="pending_manager">Awaiting manager</option>
     <option value="authorized_mock">Mock authorized</option>
     <option value="rejected">Rejected</option><option value="revoked">Revoked</option>
    </select></label>
    <button type="button" className="btn-inline" onClick={()=>void records.refetch()}>
     <RefreshCw size={16}/> Refresh</button></div>
   <QueryFeedback loading={records.isPending} error={records.error}
    empty={records.isSuccess&&records.data.data.length===0} onRetry={()=>void records.refetch()}/>
   {records.data?.data.map(item=><KeycardRow key={hotelId+'-'+item.id} item={item}
    manager={manager} onChanged={refresh}/>)}
   {records.data&&<div className="desk-tools">
    <span>Page {records.data.meta.page} / {Math.max(1,records.data.meta.totalPages)}</span>
    <div className="desk-date-nav">
     <button type="button" className="btn-inline" disabled={page<=1} onClick={()=>setPage(p=>p-1)}>Previous</button>
     <button type="button" className="btn-inline" disabled={page>=records.data.meta.totalPages}
      onClick={()=>setPage(p=>p+1)}>Next</button>
    </div></div>}
  </Panel>
 </>;
}
