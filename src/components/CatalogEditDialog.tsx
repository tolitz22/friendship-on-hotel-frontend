import {useEffect,useState,type FormEvent} from 'react';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {History,Pencil,X} from 'lucide-react';
import {ApiError} from '../api/http';
import {getCatalogAudit,updateLiveRoom,updateLiveRoomType,type LiveRoom,type LiveRoomType} from '../api/liveCatalog';
import {useHotelAuth} from './AuthProvider';
import {listHotelStaff} from '../api/liveStaff';
import {ReadableAuditEvent} from './ReadableAuditEvent';

type EditTarget={kind:'room';record:LiveRoom}|{kind:'room_type';record:LiveRoomType};
type Props={target:EditTarget;roomTypes:LiveRoomType[];onClose:()=>void;onSaved:()=>void};

export function CatalogEditDialog({target,roomTypes,onClose,onSaved}:Props){
 const {hotelId,user}=useHotelAuth();
 const admin=!!user?.hotels.some(h=>h.id===hotelId&&h.role==='admin');
 const staff=useQuery({queryKey:['hotel-staff',hotelId],queryFn:listHotelStaff,enabled:admin&&!!hotelId});
 const queryClient=useQueryClient();
 const [name,setName]=useState(target.kind==='room_type'?target.record.name:'');
 const [capacity,setCapacity]=useState(target.kind==='room_type'?String(target.record.maxOccupancy):'');
 const [number,setNumber]=useState(target.kind==='room'?target.record.number:'');
 const [floor,setFloor]=useState(target.kind==='room'?(target.record.floor?.toString()??''):'');
 const [roomTypeId,setRoomTypeId]=useState(target.kind==='room'?target.record.roomTypeId:'');
 const [saving,setSaving]=useState(false);
 const [error,setError]=useState('');
 const [fieldErrors,setFieldErrors]=useState<Record<string,string[]>>({});
 const [showHistory,setShowHistory]=useState(false);
 const audit=useQuery({
  queryKey:['catalog-audit',hotelId,target.kind,target.record.id],
  queryFn:()=>getCatalogAudit(target.kind,target.record.id),
  enabled:admin&&showHistory,
 });
 useEffect(()=>{setError('');setFieldErrors({});setShowHistory(false);},[hotelId,target.record.id,target.kind]);

 async function save(e:FormEvent<HTMLFormElement>){
  e.preventDefault();if(!admin||saving)return;
  setError('');setFieldErrors({});
  const errors:Record<string,string[]>={};
  if(target.kind==='room_type'){
   if(name.trim().length===0||name.trim().length>120)errors.name=['Enter a name of up to 120 characters.'];
   if(!Number.isInteger(Number(capacity))||Number(capacity)<1||Number(capacity)>65535)
    errors.maxOccupancy=['Capacity must be a whole number between 1 and 65,535.'];
  }else{
   if(number.trim().length===0||number.trim().length>32)errors.number=['Enter a room number of up to 32 characters.'];
   if(!roomTypes.some(t=>t.id===roomTypeId))errors.roomTypeId=['Select a room type in this hotel.'];
   if(floor.trim()!==''&&(!/^\d+$/.test(floor.trim())||Number(floor)>65535))
    errors.floor=['Floor must be 0–65,535 or left blank.'];
  }
  if(Object.keys(errors).length){setFieldErrors(errors);return;}
  setSaving(true);
  try{
   if(target.kind==='room_type'){
    await updateLiveRoomType(target.record.id,{name:name.trim(),maxOccupancy:Number(capacity)});
   }else{
    await updateLiveRoom(target.record.id,{
     number:number.trim(),roomTypeId,floor:floor.trim()===''?null:Number(floor),
    });
   }
   await Promise.all([
    queryClient.invalidateQueries({queryKey:['live-catalog']}),
    queryClient.invalidateQueries({queryKey:['live-room-types']}),
    queryClient.invalidateQueries({queryKey:['live-rooms']}),
    queryClient.invalidateQueries({queryKey:['catalog-audit']}),
   ]);
   onSaved();
  }catch(caught){
   if(caught instanceof ApiError){
    setFieldErrors(caught.fieldErrors??{});
    setError(caught.status===403?'Administrator permission is required.':caught.message);
   }else setError(caught instanceof Error?caught.message:'Could not update the catalogue.');
  }finally{setSaving(false);}
 }
 if(!admin)return null;
 return <div className="guest-modal-backdrop" role="presentation"><section className="guest-modal" role="dialog" aria-modal="true" aria-labelledby="catalog-edit-title">
  <div className="catalog-modal-heading"><h3 id="catalog-edit-title">{target.kind==='room_type'?'Edit room type':'Edit physical room'}</h3>
   <button className="icon-btn" type="button" disabled={saving} onClick={onClose} aria-label="Close edit form"><X size={19}/></button>
  </div>
  <p>Changes to reservation-linked room types or room capacity may be rejected. All saved changes are recorded in the change history.</p>
  <form onSubmit={e=>void save(e)}>
   <div className="guest-fields">
    {target.kind==='room_type'?<>
     <label>Room type name<input required maxLength={120} value={name} onChange={e=>setName(e.target.value)} disabled={saving}/></label>
     <label>Max occupants<input type="number" required min={1} max={65535} value={capacity} onChange={e=>setCapacity(e.target.value)} disabled={saving}/></label>
    </>:<>
     <label>Room number<input required maxLength={32} value={number} onChange={e=>setNumber(e.target.value)} disabled={saving}/></label>
     <label>Room type<select value={roomTypeId} disabled={saving} onChange={e=>setRoomTypeId(e.target.value)}>
      {roomTypes.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}
     </select></label>
     <label>Floor (optional)<input type="number" min={0} max={65535} value={floor} onChange={e=>setFloor(e.target.value)} disabled={saving} placeholder="Unassigned"/></label>
    </>}
   </div>
   {Object.entries(fieldErrors).flatMap(([field,values])=>values.map((message,index)=>
    <p key={field+'-'+index} role="alert" className="catalog-field-error">{field}: {message}</p>))}
   {error&&<p role="alert" className="auth-error">{error}</p>}
   <div className="guest-modal-actions"><button type="button" className="btn-inline" disabled={saving} onClick={onClose}>Cancel</button>
    <button type="submit" className="btn-primary" disabled={saving}><Pencil size={15}/>{saving?'Saving…':'Save changes'}</button></div>
  </form>
  <div className="catalog-audit-section">
   <button type="button" className="btn-inline" onClick={()=>setShowHistory(!showHistory)}><History size={15}/>{showHistory?'Hide history':'View edit history'}</button>
   {showHistory&&<div className="catalog-audit-events">
    {audit.isPending&&<p>Loading history…</p>}
    {audit.error&&<p className="auth-error">{audit.error.message}</p>}
    {audit.data?.data.length===0&&<p>No changes recorded yet.</p>}
    {audit.data?.data.map(event=><ReadableAuditEvent key={event.id} event={{
     id:event.id,actorId:event.actorId,action:'updated',
     before:Object.fromEntries(Object.entries(event.before).map(([key,value])=>[
      key,key==='roomTypeId'?roomTypes.find(type=>type.id===String(value))?.name??'Previous room category':value,
     ])),
     after:Object.fromEntries(Object.entries(event.after).map(([key,value])=>[
      key,key==='roomTypeId'?roomTypes.find(type=>type.id===String(value))?.name??'Room category changed':value,
     ])),
     note:null,createdAt:event.createdAt,
    }} actorName={event.actorName??staff.data?.data.find(member=>member.userId===event.actorId)?.name}
     currentUserId={user?.id} currentUserName={user?.name}/>)}
   </div>}
  </div>
 </section></div>;
}
