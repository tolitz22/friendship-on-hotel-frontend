import {useEffect,useState,type FormEvent} from 'react';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {ClipboardList,History,Plus,RefreshCcw,ShieldAlert,Wrench,X} from 'lucide-react';
import {useHotelAuth} from '../components/AuthProvider';
import {useLiveRooms} from '../api/liveCatalogQueries';
import {createMaintenance,listMaintenance,maintenanceHistory,
 type LiveWorkOrder,type MaintenancePriority,type MaintenanceStatus,type MaintenanceFilters,
 parseLiveMaintenance,parseMaintenanceHistory,patchValidatedMaintenance,
 mayUpdateMaintenance} from '../api/liveMaintenance';
import {ApiError} from '../api/http';
import {readSession} from '../api/session';
import {listHotelStaff} from '../api/liveStaff';
import {Heading,Panel} from '../components/ui';
import {QueryFeedback} from '../components/QueryFeedback';

const priorities:MaintenancePriority[]=['low','medium','high','urgent'];
const transitions:Record<MaintenanceStatus,MaintenanceStatus[]>={
 open:['in_progress','resolved'],in_progress:['resolved'],resolved:['closed'],closed:[]
};
type Draft={roomId:string;title:string;description:string;priority:MaintenancePriority;
 status:MaintenanceStatus;assignedTo:string;assignedUserId:string;affectsRoom:boolean;note:string};
const newDraft=():Draft=>({
 roomId:'',title:'',description:'',priority:'medium',status:'open',assignedTo:'',assignedUserId:'',affectsRoom:false,note:'',
});
const fromOrder=(order:LiveWorkOrder):Draft=>({
 roomId:order.roomId,title:order.title,description:order.description,
 priority:order.priority,status:order.status,assignedTo:order.assignedTo??'',assignedUserId:order.assignedUserId??'',
 affectsRoom:order.affectsRoom,note:'',
});

export function LiveMaintenance(){
 const {hotelId,user}=useHotelAuth();
 const role=user?.hotels.find(h=>h.id===hotelId)?.role;
 const admin=role==='admin';
 const staff=useQuery({queryKey:['hotel-staff',hotelId],queryFn:listHotelStaff,enabled:admin});
 const queryClient=useQueryClient();
 const [page,setPage]=useState(1);
 const [statusFilter,setStatusFilter]=useState<MaintenanceStatus|''>('');
 const [priorityFilter,setPriorityFilter]=useState<MaintenancePriority|''>('');
 const [search,setSearch]=useState('');
 const filters:MaintenanceFilters={...(statusFilter?{status:statusFilter}:{}),...(priorityFilter?{priority:priorityFilter}:{})};
 const orders=useQuery({
  queryKey:['live-maintenance',hotelId,page,statusFilter,priorityFilter],
  enabled:!!hotelId,retry:false,
  queryFn:async()=>parseLiveMaintenance(await listMaintenance(page,20,filters),hotelId!),
 });
 const rooms=useLiveRooms({page:1,perPage:100});
 const [selected,setSelected]=useState<LiveWorkOrder|null>(null);
 const [draft,setDraft]=useState<Draft|null>(null);
 const [saving,setSaving]=useState(false);
 const [error,setError]=useState('');
 const [fieldErrors,setFieldErrors]=useState<Record<string,string[]>>({});
 const [historyVisible,setHistoryVisible]=useState(false);
 const [historyPage,setHistoryPage]=useState(1);
 const history=useQuery({
  queryKey:['maintenance-history',hotelId,selected?.id,historyPage],
  queryFn:async()=>parseMaintenanceHistory(await maintenanceHistory(selected!.id,historyPage)),
  enabled:!!selected&&historyVisible,
 });
 useEffect(()=>{
  setSelected(null);setDraft(null);setHistoryVisible(false);setError('');setPage(1);
  setStatusFilter('');setPriorityFilter('');setSearch('');setHistoryPage(1);
 },[hotelId]);
 const openCreate=()=>{
  setSelected(null);setDraft(newDraft());setHistoryVisible(false);setError('');setFieldErrors({});setHistoryPage(1);
 };
 const openEdit=(order:LiveWorkOrder)=>{
  setSelected(order);setDraft(fromOrder(order));setHistoryVisible(false);setError('');setFieldErrors({});setHistoryPage(1);
 };
 const close=()=>{setDraft(null);setSelected(null);setError('');setHistoryVisible(false);};
 const change=<K extends keyof Draft>(field:K,value:Draft[K])=>
  setDraft(current=>current?{...current,[field]:value}:current);
 async function submit(e:FormEvent<HTMLFormElement>){
  e.preventDefault();
  const assigned=!!selected&&role==='maintenance'&&selected.assignedUserId===user?.id;
  if(!(admin||assigned)||!draft||saving)return;
  setSaving(true);setError('');setFieldErrors({});
  try{
   if(selected){
    await patchValidatedMaintenance(hotelId!,selected,admin?{
     expectedRevision:selected.revision,priority:draft.priority,status:draft.status,
     assignedTo:draft.assignedTo.trim()||null,assignedUserId:draft.assignedUserId||null,
     affectsRoom:draft.affectsRoom,note:draft.note.trim()||null,
    }:{expectedRevision:selected.revision,status:draft.status,note:draft.note.trim()||null});
   }else{
    await createMaintenance({
     roomId:draft.roomId,title:draft.title.trim(),description:draft.description.trim(),
     priority:draft.priority,assignedTo:draft.assignedTo.trim()||null,
     assignedUserId:draft.assignedUserId||null,affectsRoom:draft.affectsRoom,note:draft.note.trim()||null,
    });
   }
   if(readSession().hotelId!==hotelId)return;
   setPage(1);close();
   // A refresh error must not make a committed work order look unsuccessful.
   void Promise.all([
    queryClient.invalidateQueries({queryKey:['live-maintenance',hotelId]}),
    queryClient.invalidateQueries({queryKey:['maintenance-history',hotelId]}),
    queryClient.invalidateQueries({queryKey:['live','maintenance-for-housekeeping',hotelId]}),
    queryClient.invalidateQueries({queryKey:['live','readiness-dashboard',hotelId]}),
    queryClient.invalidateQueries({queryKey:['live','room-readiness',hotelId]}),
   ]).catch(()=>{});
  }catch(caught){
   // Do not show a previous property's late failure in the selected hotel.
   if(readSession().hotelId!==hotelId)return;
   if(caught instanceof ApiError){
    setFieldErrors(caught.fieldErrors??{});
    setError(caught.status===409?'This ticket changed. Close it and reopen the latest record before saving.':caught.message);
   }else setError(caught instanceof Error?caught.message:'Unable to save work order.');
  }finally{setSaving(false);}
 }
 const data=orders.data?.data??[];
 const term=search.trim().toLocaleLowerCase();
 const visible=data.filter(order=>!term||[
  order.id,order.roomNumber,order.title,order.description,order.assignedTo??'',
 ].some(value=>value.toLocaleLowerCase().includes(term)));
 const canUpdate=(order:LiveWorkOrder)=>mayUpdateMaintenance(order,admin,role,user?.id??null);
 const maySave=admin||(!!selected&&canUpdate(selected));
 const active=data.filter(o=>o.status==='open'||o.status==='in_progress');
 return <>
  <div className="notice"><strong>Live Laravel maintenance tickets</strong> · Work orders are saved in the selected hotel. An “affects room” flag is only a note: it does not block availability, change reservations or release inventory.</div>
  <Heading title="Maintenance" description="Real, hotel-scoped work orders and recorded status history" action={admin?
    <button type="button" className="btn-primary" onClick={openCreate}><Plus size={16}/> Create work order</button>:undefined}/>
  <div className="mnt-summary">
   <div><Wrench size={20}/><span>Active on this page</span><strong>{active.length}</strong></div>
   <div><ShieldAlert size={20}/><span>High / urgent active</span><strong>{active.filter(o=>o.priority==='urgent'||o.priority==='high').length}</strong></div>
   <div><ClipboardList size={20}/><span>Work orders on this page</span><strong>{data.length}</strong></div>
   <div><History size={20}/><span>All saved work orders</span><strong>{orders.data?.meta.total??'—'}</strong></div>
  </div>
  <Panel title="Maintenance work orders" action={<button className="btn-inline" type="button" onClick={()=>void orders.refetch()}><RefreshCcw size={15}/> Refresh</button>}>
   <div className="mnt-toolbar">
    <label>Status <select aria-label="Filter saved maintenance status" value={statusFilter}
     onChange={e=>{setStatusFilter(e.target.value as MaintenanceStatus|'');setPage(1);close();}}>
     <option value="">All statuses</option>
     {(['open','in_progress','resolved','closed'] as const).map(status=><option key={status} value={status}>{status.replaceAll('_',' ')}</option>)}
    </select></label>
    <label>Priority <select aria-label="Filter saved maintenance priority" value={priorityFilter}
     onChange={e=>{setPriorityFilter(e.target.value as MaintenancePriority|'');setPage(1);close();}}>
     <option value="">All priorities</option>
     {priorities.map(priority=><option key={priority} value={priority}>{priority}</option>)}
    </select></label>
    <label>Search this page <input aria-label="Search current maintenance page" value={search}
     onChange={e=>setSearch(e.target.value)}/></label>
   </div>
   <p className="mnt-notice">Status and priority filters run on Laravel. Text search filters this page only. A flagged room impact does not create an inventory block or prove room readiness.</p>
   <QueryFeedback loading={orders.isPending} error={orders.error} empty={!!orders.data&&visible.length===0}/>
   {visible.length>0&&<div className="mnt-order-grid">{visible.map(o=><article key={o.id} className="mnt-order">
    <div className="mnt-order-top"><strong>WO-{o.id}</strong><span className={'mnt-priority mnt-priority-'+o.priority}>{o.priority}</span></div>
    <h3>{o.title}</h3><p>{o.description}</p>
    <div className="mnt-order-tags"><span className="status">{o.status.replaceAll('_',' ')}</span><span>Room {o.roomNumber}</span></div>
    <div className="mnt-order-info"><span>Assigned to</span><strong>{o.assignedUserId?(admin?staff.data?.data.find(m=>m.userId===o.assignedUserId)?.name??('Staff #'+o.assignedUserId):o.assignedUserId===user?.id?'You':'Linked staff #'+o.assignedUserId):o.assignedTo??'Unassigned'}</strong></div>
    <div className="mnt-order-info"><span>Revision</span><strong>{o.revision}</strong></div>
    {o.affectsRoom&&<p className="mnt-warning"><ShieldAlert size={15}/> Room impact noted; inventory not blocked</p>}
    <button type="button" className="btn-inline mnt-review" onClick={()=>openEdit(o)}>{canUpdate(o)?'Manage ticket':'View ticket'} <ClipboardList size={15}/></button>
   </article>)}</div>}
   {orders.data&&<div className="guest-pagination"><span>Page {orders.data.meta.page} of {Math.max(1,orders.data.meta.totalPages)}</span>
    <div><button type="button" className="btn-inline" disabled={page<=1} onClick={()=>setPage(p=>Math.max(1,p-1))}>Previous</button>
    <button type="button" className="btn-inline" disabled={page>=orders.data.meta.totalPages} onClick={()=>setPage(p=>p+1)}>Next</button></div></div>}
  </Panel>
  {draft&&<div className="guest-modal-backdrop" role="presentation">
   <section className="guest-modal" role="dialog" aria-modal="true" aria-labelledby="maintenance-title">
    <div className="catalog-modal-heading"><h3 id="maintenance-title">{selected?'Work order WO-'+selected.id:'Create work order'}</h3>
     <button className="icon-btn" type="button" disabled={saving} onClick={close} aria-label="Close"><X size={19}/></button></div>
    <p>{selected?'Updates are revision-checked and audited.':'Create a work order without affecting bookable inventory.'}</p>
    {rooms.data&&rooms.data.meta.total>100&&!selected&&<p className="guest-info">This room selector shows only the first 100 registered rooms. A searchable picker is planned.</p>}
    <form onSubmit={e=>void submit(e)}>
     <div className="guest-fields">
      <label>Room<select required disabled={!!selected||!admin||saving} value={draft.roomId} onChange={e=>change('roomId',e.target.value)}>
       <option value="">Choose a room</option>
       {rooms.data?.data.map(room=><option key={room.id} value={room.id}>Room {room.number}</option>)}
      </select></label>
      <label>Title<input required maxLength={160} disabled={!!selected||!admin||saving} value={draft.title} onChange={e=>change('title',e.target.value)}/></label>
      <label>Description<textarea required maxLength={5000} rows={3} disabled={!!selected||!admin||saving} value={draft.description} onChange={e=>change('description',e.target.value)}/></label>
      <label>Priority<select disabled={!admin||saving} value={draft.priority} onChange={e=>change('priority',e.target.value as MaintenancePriority)}>{priorities.map(p=><option key={p} value={p}>{p}</option>)}</select></label>
      <label>Status<select disabled={!selected||!maySave||saving} value={draft.status} onChange={e=>change('status',e.target.value as MaintenanceStatus)}>
       {[selected?.status??'open',...(transitions[selected?.status??'open']??[])].filter((x,i,arr)=>arr.indexOf(x)===i).map(s=><option value={s} key={s}>{s.replaceAll('_',' ')}</option>)}
      </select></label>
      {admin&&<label>Linked technician account<select value={draft.assignedUserId} disabled={saving} onChange={e=>change('assignedUserId',e.target.value)}>
       <option value="">No linked account</option>
       {staff.data?.data.filter(m=>m.isActive&&m.accountActive&&(m.role==='maintenance'||m.role==='admin')).map(m=><option key={m.userId} value={m.userId}>{m.name} ({m.role})</option>)}
      </select></label>}
      <label>Assigned technician (legacy text)<input maxLength={120} disabled={!admin||saving} value={draft.assignedTo} onChange={e=>change('assignedTo',e.target.value)}/></label>
      <label className="maintenance-checkbox"><input type="checkbox" disabled={!admin||saving} checked={draft.affectsRoom} onChange={e=>change('affectsRoom',e.target.checked)}/> Affects room (flag only; never blocks inventory)</label>
      {maySave&&<label>Handover note<textarea rows={2} maxLength={2000} disabled={saving} value={draft.note} onChange={e=>change('note',e.target.value)}/></label>}
     </div>
     {Object.entries(fieldErrors).flatMap(([field,errors])=>errors.map((message,i)=><p role="alert" key={field+i} className="catalog-field-error">{field}: {message}</p>))}
     {error&&<p role="alert" className="auth-error">{error}</p>}
     <div className="guest-modal-actions"><button type="button" className="btn-inline" disabled={saving} onClick={close}>Close</button>
      {maySave&&<button type="submit" className="btn-primary" disabled={saving}>{saving?'Saving…':selected?'Save changes':'Create work order'}</button>}</div>
    </form>
    {selected&&<div className="catalog-audit-section">
     <button className="btn-inline" type="button" onClick={()=>setHistoryVisible(value=>!value)}><History size={15}/>{historyVisible?'Hide':'View'} recorded history</button>
     {historyVisible&&<><QueryFeedback loading={history.isPending} error={history.error}/>
      {history.data?.data.map(e=><article className="maintenance-history-event" key={e.id}><strong>{e.action} · Staff #{e.actorId}</strong>
       <small>{e.createdAt}</small>{e.note&&<p>{e.note}</p>}</article>)}
      {history.data&&<div className="guest-pagination">
       <span>History page {history.data.meta.page} of {Math.max(1,history.data.meta.totalPages)}</span>
       <div><button type="button" className="btn-inline" disabled={historyPage<=1}
        onClick={()=>setHistoryPage(n=>n-1)}>Previous events</button>
        <button type="button" className="btn-inline" disabled={historyPage>=history.data.meta.totalPages}
        onClick={()=>setHistoryPage(n=>n+1)}>Next events</button></div>
      </div>}</>}
    </div>}
   </section>
  </div>}
 </>;
}
