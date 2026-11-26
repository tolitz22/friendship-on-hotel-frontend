import {useEffect,useState,useRef} from 'react';
import {Link} from '@tanstack/react-router';
import {selectedRole,canViewWorkspacePath} from '../features/workspaces/roleNavigation';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {MessageCircle,Send,Plus,ArrowLeft,Hash,Paperclip,Download,FileText,Link2,ArrowUpRight,Megaphone,CheckCircle2} from 'lucide-react';
import {getJson,requestJson,downloadPrivateFile} from '../api/http';
import {useHotelAuth} from '../components/AuthProvider';
import {dataMode} from '../api';

type Staff={id:number|string;name:string;role:string};
type Attachment={id:number;filename:string;mime:string;size:number};
type RecordType='room'|'booking'|'housekeeping'|'maintenance';
type RecordRef={type:RecordType;id:string;label:string;target:string};
const recordTypes: {type:RecordType;label:string;path:string}[]=[{type:'room',label:'Rooms',path:'/rooms'},{type:'booking',label:'Bookings',path:'/reservations'},{type:'housekeeping',label:'Housekeeping tasks',path:'/housekeeping'},{type:'maintenance',label:'Maintenance work orders',path:'/maintenance'}];
function RecordLink({record}:{record:RecordRef}){
 const content=<><Link2 size={16}/><span className="flex-1 min-w-0 break-words">{record.label}<br/><small>Open record</small></span><ArrowUpRight size={16}/></>;
 const className='flex items-center gap-2 border rounded p-2 my-2 text-left';
 switch(record.type){
  case 'room':return <Link className={className} to="/rooms" search={{room:record.target}}>{content}</Link>;
  case 'booking':return <Link className={className} to="/reservations" search={{booking:record.target}}>{content}</Link>;
  case 'housekeeping':return <Link className={className} to="/housekeeping" search={{task:record.target}}>{content}</Link>;
  case 'maintenance':return <Link className={className} to="/maintenance" search={{order:record.target}}>{content}</Link>;
 }
}
type Message={id:number;sender_id:number|string|null;sender_name?:string;body:string;created_at:string;reply_to_id?:number|null;reply_body?:string|null;attachment?:Attachment|null;record?:RecordRef|null;record_unavailable?:boolean;is_announcement?:boolean;acknowledgement?:{required:boolean;acknowledged_at:string|null;total?:number;acknowledged?:number}};
type Conversation={id:number;kind:'channel'|'direct'|'group';title:string|null;members:(Staff & {last_read_message_id:number})[];latest:Message|null;unread:number};
const path=(hotel:string)=>'/hotels/'+encodeURIComponent(hotel)+'/staff-messaging';
export function useMessageInbox(hotel:string|null,user:string|undefined){
 return useQuery({queryKey:['staff-messages',hotel,user],queryFn:()=>getJson<{data:Conversation[]}>(path(hotel!)+'/conversations'),enabled:!!hotel&&!!user&&dataMode==='api',refetchInterval:5000,retry:false});
}
export function Messages(){
 const {hotelId,user}=useHotelAuth();
 if(!hotelId||!user||dataMode!=='api')return <section className="panel">Sign in to a hotel to use staff messaging.</section>;
 return <Inbox key={hotelId+':'+user.id} hotel={hotelId} user={user.id}/>;
}
function Inbox({hotel,user}:{hotel:string;user:string}){
 const client=useQueryClient(),base=path(hotel);
 const inbox=useMessageInbox(hotel,user);
 const directory=useQuery({queryKey:['message-directory',hotel,user],queryFn:()=>getJson<{data:Staff[]}>(base+'/directory')});
 const [selected,setSelected]=useState<number|null>(null),[compose,setCompose]=useState(false),[people,setPeople]=useState<string[]>([]),[title,setTitle]=useState(''),[filter,setFilter]=useState(''),[search,setSearch]=useState(''),[body,setBody]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false),[older,setOlder]=useState<Message[]>([]);
 const [announcement,setAnnouncement]=useState(false);
 const [ackBusy,setAckBusy]=useState<number|null>(null);
 const [reply,setReply]=useState<Message|null>(null);
 const [file,setFile]=useState<File|null>(null);
 const [record,setRecord]=useState<RecordRef|null>(null),[picker,setPicker]=useState(false),[recordType,setRecordType]=useState<RecordType>('room'),[recordSearch,setRecordSearch]=useState(''),[submittedSearch,setSubmittedSearch]=useState('');
 const auth=useHotelAuth();
 const role=selectedRole(auth.user?.hotels,hotel);
 const permissions=auth.user?.hotels.find(h=>h.id===hotel)?.permissions;
 const allowedTypes=recordTypes.filter(t=>canViewWorkspacePath(role,t.path,permissions));
 const records=useQuery({queryKey:['message-records',hotel,user,recordType,submittedSearch],queryFn:()=>getJson<{data:RecordRef[]}>(base+'/records',{type:recordType,q:submittedSearch}),enabled:picker&&allowedTypes.some(t=>t.type===recordType),retry:false,staleTime:0});
 const fileInput=useRef<HTMLInputElement>(null);
 const pending=useRef<{conversation:number;body:string;id:string;replyId:number|null;file:File|null;recordKey:string;announcement:boolean}|null>(null);
 const lock=useRef(false);
 const conversation=inbox.data?.data.find(c=>c.id===selected);
 const canAnnounce=role==='admin'&&conversation?.kind==='channel';
 const thread=useQuery({queryKey:['staff-thread',hotel,user,selected,search],queryFn:()=>getJson<{data:Message[]}>(base+'/conversations/'+selected,{q:search}),enabled:selected!==null,refetchInterval:3000,retry:false});
 const latest=thread.data?.data.at(-1)?.id;
 const readKey=useRef('');
 useEffect(()=>{
  if(!selected||!latest||search||document.visibilityState!=='visible'||thread.isError)return;
  const key=selected+':'+latest;
  if(readKey.current===key)return;
  readKey.current=key;
  void requestJson(base+'/conversations/'+selected+'/read',{method:'POST',body:{message_id:latest}}).then(()=>client.invalidateQueries({queryKey:['staff-messages',hotel,user]})).catch(()=>{readKey.current='';});
 },[selected,latest,search,thread.isError,thread.dataUpdatedAt,base,client,hotel,user]);
 const name=(c:Conversation)=>c.title??c.members.filter(m=>String(m.id)!==user).map(m=>m.name).join(', ');
 const visible=(inbox.data?.data??[]).filter(c=>name(c).toLowerCase().includes(filter.trim().toLowerCase()));
 const open=(id:number|null)=>{setSelected(id);setCompose(false);setSearch('');setOlder([]);setBody('');setReply(null);setFile(null);setRecord(null);setPicker(false);setAnnouncement(false);setError('');};
 async function create(){
  if(lock.current||!people.length)return;
  lock.current=true;setBusy(true);setError('');
  try{const result=await requestJson<{data:{id:number}}>(base+'/conversations',{method:'POST',body:{member_ids:people,title}});await inbox.refetch();open(result.data.id);setPeople([]);setTitle('');}
  catch(e){setError(e instanceof Error?e.message:'Unable to create conversation.');}
  finally{lock.current=false;setBusy(false);}
 }
 async function send(){
  if(lock.current||!selected||(!body.trim()&&!file&&!record)||announcement&&(!canAnnounce||!body.trim()))return;
  lock.current=true;setBusy(true);setError('');
  const text=body.trim(),id=selected,recordKey=record?record.type+':'+record.id:'';
  if(pending.current?.conversation!==id||pending.current.body!==text||pending.current.replyId!==(reply?.id??null)||pending.current.file!==file||pending.current.recordKey!==recordKey||pending.current.announcement!==announcement)pending.current={conversation:id,body:text,id:crypto.randomUUID(),replyId:reply?.id??null,file,recordKey,announcement};
  try{let attachment: {filename:string;content:string}|undefined;
   if(file){const bytes=new Uint8Array(await file.arrayBuffer());let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));attachment={filename:file.name,content:btoa(binary)};}
   await requestJson(base+'/conversations/'+id+'/messages',{method:'POST',body:{body:text,client_id:pending.current.id,reply_to_id:pending.current.replyId,attachment,record_type:record?.type,record_id:record?.id,is_announcement:announcement}});pending.current=null;setBody('');setReply(null);setFile(null);setRecord(null);setPicker(false);setAnnouncement(false);await Promise.all([thread.refetch(),inbox.refetch()]);}
  catch(e){setError(e instanceof Error?e.message:'Message not sent. Retry to continue.');}
  finally{lock.current=false;setBusy(false);}
 }
 async function acknowledge(m:Message){
  if(!selected||ackBusy!==null||!m.acknowledgement?.required||m.acknowledgement.acknowledged_at)return;
  setAckBusy(m.id);setError('');
  try{await requestJson(base+'/conversations/'+selected+'/announcements/'+m.id+'/acknowledge',{method:'POST'});setOlder(prev=>prev.map(row=>row.id===m.id&&row.acknowledgement?{...row,acknowledgement:{...row.acknowledgement,acknowledged_at:new Date().toISOString()}}:row));await Promise.all([thread.refetch(),inbox.refetch()]);}
  catch(e){setError(e instanceof Error?e.message:'Unable to acknowledge announcement.');}finally{setAckBusy(null);}
 }
 const messages=[...new Map([...older,...(thread.data?.data??[])].map(m=>[m.id,m])).values()].sort((a,b)=>a.id-b.id);
 async function loadOlder(){
  if(!selected||!messages.length||lock.current)return;
  lock.current=true;setBusy(true);
  try{const result=await getJson<{data:Message[]}>(base+'/conversations/'+selected,{before:messages[0].id,q:search});setOlder(prev=>[...result.data,...prev]);if(!result.data.length)setError('No earlier messages.');}
  catch(e){setError(e instanceof Error?e.message:'Unable to load history.');}
  finally{lock.current=false;setBusy(false);}
 }
 return <section className="panel" style={{padding:16}}>
  <div className="flex flex-wrap items-center justify-between gap-3 mb-4"><div><h2>Staff messages</h2><p>Connect with your hotel team in private conversations and department channels.</p></div><button className="btn-primary" disabled={busy} onClick={()=>{open(null);setCompose(true);}}><Plus size={16}/> New message</button></div>
  {error&&<p role="alert">{error}</p>}
  <div className="grid gap-4 md:grid-cols-[minmax(220px,1fr)_minmax(0,2fr)]">
   <aside className={(selected||compose?'hidden md:block':'')+' min-w-0'}>
    <input aria-label="Search conversations" placeholder="Search conversations" value={filter} onChange={e=>setFilter(e.target.value)} className="w-full mb-3 border rounded p-2"/>
    {inbox.isError?<p role="alert">Unable to load inbox. <button onClick={()=>void inbox.refetch()}>Retry</button></p>:inbox.isPending?<p>Loading inbox…</p>:!inbox.data?.data.length?<p>No conversations yet.</p>:visible.length===0?<p>No matching conversations.</p>:<>{(['channel','conversation'] as const).map(section=>{const items=visible.filter(c=>section==='channel'?c.kind==='channel':c.kind!=='channel');return items.length>0&&<div key={section} className="mb-4"><h3 className="text-xs font-semibold uppercase tracking-wide mb-2">{section==='channel'?'Hotel channels':'Conversations'}</h3>{items.map(c=><button key={c.id} disabled={busy} onClick={()=>open(c.id)} aria-pressed={selected===c.id} className={'block w-full text-left border rounded-lg p-3 mb-2 '+(selected===c.id?'ring-2 ring-blue-500':'')}><div className="flex items-center gap-2">{c.kind==='channel'&&<Hash size={16} aria-hidden="true"/>}<strong className="truncate">{name(c)}</strong>{c.unread>0&&<span className="ml-auto text-xs font-bold">{c.unread} unread</span>}</div><p className="truncate text-sm">{c.latest?.is_announcement?'Announcement · ':''}{c.latest?.body||c.latest?.record?.label||(c.latest?.record_unavailable?'Shared record':c.latest?'Attachment or message':'Start the conversation')}</p></button>)}</div>;})}</>}
   </aside>
   <div className={(!selected&&!compose?'hidden md:block':'')+' border rounded-lg p-4 min-w-0'}>
    {(selected||compose)&&<button className="md:hidden mb-3" disabled={busy} onClick={()=>open(null)}><ArrowLeft size={16}/> Inbox</button>}
    {compose?<><h3>New conversation</h3><p>Select one or more active staff members.</p>{directory.isError?<p role="alert">Could not load staff directory.</p>:directory.isPending?<p>Loading staff…</p>:directory.data?.data.map(s=><label key={s.id} className="flex gap-2 p-2"><input type="checkbox" checked={people.includes(String(s.id))} disabled={busy} onChange={e=>setPeople(p=>e.target.checked?[...p,String(s.id)]:p.filter(id=>id!==String(s.id)))}/>{s.name} · {s.role.replaceAll('_',' ')}</label>)}{people.length>1&&<input className="border rounded p-2 w-full" placeholder="Group name" aria-label="Group name" value={title} maxLength={120} onChange={e=>setTitle(e.target.value)}/>}<button className="btn-primary mt-3" disabled={busy||!people.length||people.length>1&&!title.trim()} onClick={()=>void create()}>Start conversation</button></>:selected?<><h3>{conversation?name(conversation):'Conversation'}</h3>{conversation?.kind==='channel'&&<p className="text-sm mb-2">Hotel channel · {conversation.members.length} eligible staff · Membership follows staff roles</p>}<input className="border rounded p-2 w-full my-2" aria-label="Search messages" placeholder="Search messages" value={search} onChange={e=>{setSearch(e.target.value);setOlder([]);}}/>
    <div className="overflow-y-auto h-[50vh] flex flex-col gap-3" aria-label="Message history">
     {thread.isError?<p role="alert">Unable to load messages. <button onClick={()=>void thread.refetch()}>Retry</button></p>:thread.isPending?<p>Loading messages…</p>:<>{messages.length>=100&&<button disabled={busy} onClick={()=>void loadOlder()}>Load earlier messages</button>}{!messages.length&&<p>{search?'No matching messages.':'Say hello!'}</p>}{messages.map(m=>{const own=String(m.sender_id)===user;return <div key={m.id} className={'rounded-lg border p-3 max-w-[85%] break-words '+(m.is_announcement?'self-stretch border-amber-500':own?'self-end bg-blue-700 text-white':'self-start')}>{m.is_announcement&&<div className="flex items-center gap-2 font-semibold mb-2"><Megaphone size={18}/> Manager announcement</div>}<small>{own?'You':m.sender_name??'Former staff'}</small>{m.reply_body&&<blockquote className="border-l-2 pl-2 text-sm opacity-80 whitespace-pre-wrap">{m.reply_body}</blockquote>}<p className="whitespace-pre-wrap">{m.body}</p>{m.record&&allowedTypes.some(t=>t.type===m.record?.type)?<RecordLink record={m.record}/>:m.record_unavailable||m.record?<p className="border rounded p-2 text-sm">Shared record unavailable or restricted.</p>:null}{m.attachment&&<button type="button" className="flex items-center gap-2 border rounded p-2 my-2 text-left max-w-full" onClick={()=>{const a=m.attachment;if(!a)return;setError('');void downloadPrivateFile(base+'/conversations/'+selected+'/attachments/'+a.id,a.filename).catch(e=>setError(e instanceof Error?e.message:'Download failed.'));}}><FileText size={18}/><span className="min-w-0 break-all">{m.attachment.filename}<br/><small>{Math.ceil(m.attachment.size/1024)} KB</small></span><Download size={16}/></button>}{m.is_announcement&&m.acknowledgement&&<div className="border-t mt-3 pt-2 text-sm">{typeof m.acknowledgement.total==='number'&&<div><p>{m.acknowledgement.acknowledged??0} of {m.acknowledgement.total} staff acknowledged</p><progress className="w-full" aria-label="Staff acknowledgments" max={Math.max(1,m.acknowledgement.total)} value={m.acknowledgement.acknowledged??0}/></div>}{m.acknowledgement.required&&(m.acknowledgement.acknowledged_at?<p className="flex gap-2 items-center"><CheckCircle2 size={16}/> Acknowledged</p>:<button type="button" className="btn-primary" disabled={ackBusy!==null} onClick={()=>void acknowledge(m)}>{ackBusy===m.id?'Acknowledging…':'Acknowledge announcement'}</button>)}</div>}<button type="button" disabled={busy} className="text-xs underline mr-2" onClick={()=>setReply(m)}>Reply</button><small>{m.created_at}{own&&conversation?.members.some(p=>String(p.id)!==user&&Number(p.last_read_message_id)>=m.id)?' · Read':''}</small></div>})}</>}
    </div>
    {canAnnounce&&<label className="flex items-center gap-2 border rounded p-2 mt-3"><input type="checkbox" checked={announcement} disabled={busy} onChange={e=>setAnnouncement(e.target.checked)}/><Megaphone size={18}/><span>Publish as manager announcement<small className="block">Staff will be asked to acknowledge this message.</small></span></label>}
    {reply&&<div className="border rounded p-2 mt-3 flex justify-between gap-2"><div className="min-w-0"><small>Replying to {String(reply.sender_id)===user?'yourself':reply.sender_name??'staff'}</small><p className="truncate">{reply.body}</p></div><button type="button" aria-label="Cancel reply" disabled={busy} onClick={()=>setReply(null)}>Cancel</button></div>}
    {record&&<div className="flex items-center gap-2 border rounded p-2 mt-3"><Link2 size={18}/><span className="flex-1 break-words">{record.label}</span><button type="button" disabled={busy} onClick={()=>setRecord(null)}>Remove record</button></div>}
    {picker&&<section className="border rounded-lg p-3 mt-3" aria-label="Share PMS record"><div className="flex justify-between items-center"><h4>Share PMS record</h4><button type="button" onClick={()=>setPicker(false)}>Close</button></div><label className="block mt-2">Record type<select className="border rounded p-2 w-full" value={recordType} onChange={e=>{setRecordType(e.target.value as RecordType);setRecordSearch('');setSubmittedSearch('');}}>{allowedTypes.map(t=><option key={t.type} value={t.type}>{t.label}</option>)}</select></label><form className="flex gap-2 my-2" onSubmit={e=>{e.preventDefault();if(submittedSearch===recordSearch.trim())void records.refetch();else setSubmittedSearch(recordSearch.trim());}}><input className="border rounded p-2 flex-1 min-w-0" aria-label="Search PMS records" placeholder="Room number, booking reference or record ID" maxLength={120} value={recordSearch} onChange={e=>setRecordSearch(e.target.value)}/><button type="submit" className="btn-primary">Search</button></form><div className="max-h-48 overflow-y-auto">{records.isError?<p role="alert">Unable to load records. <button type="button" onClick={()=>void records.refetch()}>Retry</button></p>:records.isPending?<p>Loading records…</p>:!records.data?.data.length?<p>No matching records.</p>:records.data.data.map(r=><button type="button" key={r.type+':'+r.id} className="block text-left border rounded p-2 mb-1 w-full" disabled={busy} onClick={()=>{setRecord(r);setPicker(false);}}>{r.label}</button>)}</div><small>Up to 30 results. Recipients must have permission to open the record.</small></section>}
    {file&&<div className="flex items-center gap-2 border rounded p-2 mt-3"><FileText size={18}/><span className="flex-1 min-w-0 break-all">{file.name} · {Math.ceil(file.size/1024)} KB</span><button type="button" disabled={busy} onClick={()=>setFile(null)}>Remove</button></div>}
    <form className="flex gap-2 mt-3 items-end" onSubmit={e=>{e.preventDefault();void send();}}><input ref={fileInput} type="file" hidden accept="image/jpeg,image/png,image/webp,application/pdf" onChange={e=>{const f=e.target.files?.[0];e.target.value='';if(!f)return;if(f.size===0||f.size>2097152||f.name.length>200||!['image/jpeg','image/png','image/webp','application/pdf'].includes(f.type)){setError('Choose a JPEG, PNG, WebP or PDF file up to 2 MB with a name up to 200 characters.');return;}setError('');setFile(f);}}/><button type="button" className="icon-btn" aria-label="Attach a file" title="Attach photo or PDF (up to 2 MB)" disabled={busy||thread.isError} onClick={()=>fileInput.current?.click()}><Paperclip size={20}/></button><button type="button" className="icon-btn" aria-label="Share PMS record" title="Share PMS record" disabled={busy||thread.isError||!allowedTypes.length} onClick={()=>{if(!allowedTypes.some(t=>t.type===recordType))setRecordType(allowedTypes[0].type);setRecordSearch('');setSubmittedSearch('');setPicker(v=>!v);}}><Link2 size={20}/></button><textarea className="border rounded p-2 flex-1 min-w-0" aria-label="Write a message" placeholder={announcement?'Write an announcement…':'Write a message…'} maxLength={4000} value={body} disabled={busy} onChange={e=>setBody(e.target.value)}/><button className="btn-primary" disabled={busy||(!body.trim()&&!file&&!record)||thread.isError||announcement&&(!canAnnounce||!body.trim())} type="submit">{announcement?<Megaphone size={16}/>:<Send size={16}/>} {announcement?'Publish':'Send'}</button></form>
    </>:<div className="p-8 text-center"><MessageCircle className="mx-auto"/><p>Select a conversation or start a new message.</p></div>}
   </div>
  </div>
 </section>;
}
