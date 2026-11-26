import {useEffect,useState,useRef} from 'react';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {MessageCircle,Send,Plus,ArrowLeft} from 'lucide-react';
import {getJson,requestJson} from '../api/http';
import {useHotelAuth} from '../components/AuthProvider';
import {dataMode} from '../api';

type Staff={id:number|string;name:string;role:string};
type Message={id:number;sender_id:number|string|null;sender_name?:string;body:string;created_at:string;reply_to_id?:number|null;reply_body?:string|null};
type Conversation={id:number;title:string|null;members:(Staff & {last_read_message_id:number})[];latest:Message|null;unread:number};
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
 const [reply,setReply]=useState<Message|null>(null);
 const pending=useRef<{conversation:number;body:string;id:string;replyId:number|null}|null>(null);
 const lock=useRef(false);
 const conversation=inbox.data?.data.find(c=>c.id===selected);
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
 const open=(id:number|null)=>{setSelected(id);setCompose(false);setSearch('');setOlder([]);setBody('');setReply(null);setError('');};
 async function create(){
  if(lock.current||!people.length)return;
  lock.current=true;setBusy(true);setError('');
  try{const result=await requestJson<{data:{id:number}}>(base+'/conversations',{method:'POST',body:{member_ids:people,title}});await inbox.refetch();open(result.data.id);setPeople([]);setTitle('');}
  catch(e){setError(e instanceof Error?e.message:'Unable to create conversation.');}
  finally{lock.current=false;setBusy(false);}
 }
 async function send(){
  if(lock.current||!selected||!body.trim())return;
  lock.current=true;setBusy(true);setError('');
  const text=body.trim(),id=selected;
  if(pending.current?.conversation!==id||pending.current.body!==text||pending.current.replyId!==(reply?.id??null))pending.current={conversation:id,body:text,id:crypto.randomUUID(),replyId:reply?.id??null};
  try{await requestJson(base+'/conversations/'+id+'/messages',{method:'POST',body:{body:text,client_id:pending.current.id,reply_to_id:pending.current.replyId}});pending.current=null;setBody('');setReply(null);await Promise.all([thread.refetch(),inbox.refetch()]);}
  catch(e){setError(e instanceof Error?e.message:'Message not sent. Retry to continue.');}
  finally{lock.current=false;setBusy(false);}
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
  <div className="flex flex-wrap items-center justify-between gap-3 mb-4"><div><h2>Staff messages</h2><p>Private conversations with your hotel team.</p></div><button className="btn-primary" disabled={busy} onClick={()=>{open(null);setCompose(true);}}><Plus size={16}/> New message</button></div>
  {error&&<p role="alert">{error}</p>}
  <div className="grid gap-4 md:grid-cols-[minmax(220px,1fr)_minmax(0,2fr)]">
   <aside className={(selected||compose?'hidden md:block':'')+' min-w-0'}>
    <input aria-label="Search conversations" placeholder="Search conversations" value={filter} onChange={e=>setFilter(e.target.value)} className="w-full mb-3 border rounded p-2"/>
    {inbox.isError?<p role="alert">Unable to load inbox. <button onClick={()=>void inbox.refetch()}>Retry</button></p>:inbox.isPending?<p>Loading inbox…</p>:!inbox.data?.data.length?<p>No conversations yet.</p>:inbox.data.data.filter(c=>name(c).toLowerCase().includes(filter.toLowerCase())).map(c=><button key={c.id} disabled={busy} onClick={()=>open(c.id)} aria-pressed={selected===c.id} className={'block w-full text-left border rounded-lg p-3 mb-2 '+(selected===c.id?'ring-2 ring-blue-500':'')}><strong>{name(c)}</strong>{c.unread>0&&<span className="ml-2 font-bold">({c.unread} unread)</span>}<p className="truncate text-sm">{c.latest?.body??'Start the conversation'}</p></button>)}
   </aside>
   <div className={(!selected&&!compose?'hidden md:block':'')+' border rounded-lg p-4 min-w-0'}>
    {(selected||compose)&&<button className="md:hidden mb-3" disabled={busy} onClick={()=>open(null)}><ArrowLeft size={16}/> Inbox</button>}
    {compose?<><h3>New conversation</h3><p>Select one or more active staff members.</p>{directory.isError?<p role="alert">Could not load staff directory.</p>:directory.isPending?<p>Loading staff…</p>:directory.data?.data.map(s=><label key={s.id} className="flex gap-2 p-2"><input type="checkbox" checked={people.includes(String(s.id))} disabled={busy} onChange={e=>setPeople(p=>e.target.checked?[...p,String(s.id)]:p.filter(id=>id!==String(s.id)))}/>{s.name} · {s.role.replaceAll('_',' ')}</label>)}{people.length>1&&<input className="border rounded p-2 w-full" placeholder="Group name" aria-label="Group name" value={title} maxLength={120} onChange={e=>setTitle(e.target.value)}/>}<button className="btn-primary mt-3" disabled={busy||!people.length||people.length>1&&!title.trim()} onClick={()=>void create()}>Start conversation</button></>:selected?<><h3>{conversation?name(conversation):'Conversation'}</h3><input className="border rounded p-2 w-full my-2" aria-label="Search messages" placeholder="Search messages" value={search} onChange={e=>{setSearch(e.target.value);setOlder([]);}}/>
    <div className="overflow-y-auto h-[50vh] flex flex-col gap-3" aria-label="Message history">
     {thread.isError?<p role="alert">Unable to load messages. <button onClick={()=>void thread.refetch()}>Retry</button></p>:thread.isPending?<p>Loading messages…</p>:<>{messages.length>=100&&<button disabled={busy} onClick={()=>void loadOlder()}>Load earlier messages</button>}{!messages.length&&<p>{search?'No matching messages.':'Say hello!'}</p>}{messages.map(m=>{const own=String(m.sender_id)===user;return <div key={m.id} className={'rounded-lg border p-3 max-w-[85%] break-words '+(own?'self-end bg-blue-700 text-white':'self-start')}><small>{own?'You':m.sender_name??'Former staff'}</small>{m.reply_body&&<blockquote className="border-l-2 pl-2 text-sm opacity-80 whitespace-pre-wrap">{m.reply_body}</blockquote>}<p className="whitespace-pre-wrap">{m.body}</p><button type="button" disabled={busy} className="text-xs underline mr-2" onClick={()=>setReply(m)}>Reply</button><small>{m.created_at}{own&&conversation?.members.some(p=>String(p.id)!==user&&Number(p.last_read_message_id)>=m.id)?' · Read':''}</small></div>})}</>}
    </div>
    {reply&&<div className="border rounded p-2 mt-3 flex justify-between gap-2"><div className="min-w-0"><small>Replying to {String(reply.sender_id)===user?'yourself':reply.sender_name??'staff'}</small><p className="truncate">{reply.body}</p></div><button type="button" aria-label="Cancel reply" disabled={busy} onClick={()=>setReply(null)}>Cancel</button></div>}
    <form className="flex gap-2 mt-3 items-end" onSubmit={e=>{e.preventDefault();void send();}}><textarea className="border rounded p-2 flex-1 min-w-0" aria-label="Write a message" placeholder="Write a message…" maxLength={4000} value={body} disabled={busy} onChange={e=>setBody(e.target.value)}/><button className="btn-primary" disabled={busy||!body.trim()||thread.isError} type="submit"><Send size={16}/> Send</button></form>
    </>:<div className="p-8 text-center"><MessageCircle className="mx-auto"/><p>Select a conversation or start a new message.</p></div>}
   </div>
  </div>
 </section>;
}
