import {useEffect,useState,type FormEvent} from 'react';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {Plus,X} from 'lucide-react';
import {ApiError} from '../api/http';
import {fetchSubscriptionCapacity,capacityBlocked} from '../api/subscriptionCapacity';
import {SubscriptionCapacityMeter} from './SubscriptionCapacityMeter';
import {createLiveRoom,createLiveRoomType,type LiveRoomType} from '../api/liveCatalog';
import {useHotelAuth} from './AuthProvider';

export type CatalogCreateMode='room'|'type';

interface Props{
 mode:CatalogCreateMode;
 roomTypes:LiveRoomType[];
 onClose:()=>void;
 onCreated:()=>void;
}

export function CatalogCreateDialog({mode,roomTypes,onClose,onCreated}:Props){
 const {hotelId,user}=useHotelAuth();
 const queryClient=useQueryClient();
 const authorized=!!user?.hotels.some(h=>h.id===hotelId&&h.role==='admin');
 const capacity=useQuery({queryKey:['subscription-capacity',hotelId],queryFn:({signal})=>fetchSubscriptionCapacity(hotelId!,signal),enabled:authorized&&!!hotelId&&mode==='room',retry:false,staleTime:0});
 const usage=capacity.isError?undefined:capacity.data?.data;
 const roomFull=mode==='room'&&capacityBlocked(usage,'rooms');
 const [name,setName]=useState('');
 const [occupancy,setOccupancy]=useState('2');
 const [number,setNumber]=useState('');
 const [roomTypeId,setRoomTypeId]=useState(roomTypes[0]?.id??'');
 const [floor,setFloor]=useState('');
 const [pending,setPending]=useState(false);
 const [error,setError]=useState('');
 const [fieldErrors,setFieldErrors]=useState<Record<string,string[]>>({});
 // Keep a selection valid if the room types arrive after opening the dialog.
 useEffect(()=>{
  if(!roomTypes.some(t=>t.id===roomTypeId))setRoomTypeId(roomTypes[0]?.id??'');
 },[roomTypes,roomTypeId]);

 async function submit(e:FormEvent<HTMLFormElement>){
  e.preventDefault();
  if(!authorized||pending||roomFull)return;
  setError('');setFieldErrors({});
  const errors:Record<string,string[]>={};
  if(mode==='type'){
   if(!name.trim()||name.trim().length>120)errors.name=['Enter a room type name (1–120 characters).'];
   const cap=Number(occupancy);
   if(!Number.isInteger(cap)||cap<1||cap>65535)errors.maxOccupancy=['Capacity must be between 1 and 65,535.'];
  }else{
   if(!roomTypeId||!roomTypes.some(type=>type.id===roomTypeId))errors.roomTypeId=['Choose a registered room type.'];
   if(!number.trim()||number.trim().length>32)errors.number=['Enter a room number (1–32 characters).'];
   if(floor.trim()!==''&&(!/^\d+$/.test(floor.trim())||Number(floor)>65535))errors.floor=['Floor must be a whole number from 0 to 65,535.'];
  }
  if(Object.keys(errors).length){setFieldErrors(errors);return;}
  setPending(true);
  try{
   if(mode==='type')await createLiveRoomType({name:name.trim(),maxOccupancy:Number(occupancy)});
   else await createLiveRoom({roomTypeId,number:number.trim(),floor:floor.trim()===''?null:Number(floor)});
   // Refresh every catalogue view. No live cache may retain old counts.
   await Promise.all([
    queryClient.invalidateQueries({queryKey:['subscription-capacity',hotelId]}),
    queryClient.invalidateQueries({queryKey:['live-catalog']}),
    queryClient.invalidateQueries({queryKey:['live-rooms']}),
    queryClient.invalidateQueries({queryKey:['live-room-types']}),
   ]);
   onCreated();
  }catch(caught){
   if(caught instanceof ApiError){
    setFieldErrors(caught.fieldErrors??{});
    setError(caught.status===403?'Your account is not authorized to manage the selected hotel.':caught.message);
   }else setError(caught instanceof Error?caught.message:'Could not save the catalogue entry.');
  }finally{setPending(false);}
 }

 if(!authorized)return null;
 return <div className="guest-modal-backdrop" role="presentation">
  <section className="guest-modal" role="dialog" aria-modal="true" aria-labelledby="catalog-create-title">
   <div className="catalog-modal-heading"><h3 id="catalog-create-title">{mode==='type'?'Add room type':'Add physical room'}</h3><button type="button" className="icon-btn" aria-label="Close form" disabled={pending} onClick={onClose}><X size={19}/></button></div>
   <p>{mode==='type'?'Create a room category for this hotel.':'Add a physical room to the selected hotel catalogue. This does not create availability or occupancy.'}</p>
   <form onSubmit={e=>void submit(e)}>
    <div className="guest-fields">
     {mode==='type'?<>
      <label>Room type name<input autoFocus maxLength={120} value={name} onChange={e=>setName(e.target.value)} disabled={pending} required placeholder="Standard"/></label>
      <label>Maximum occupants<input type="number" min={1} max={65535} step={1} value={occupancy} onChange={e=>setOccupancy(e.target.value)} disabled={pending} required/></label>
     </>:<>
      <label>Room number<input autoFocus maxLength={32} value={number} onChange={e=>setNumber(e.target.value)} disabled={pending} required placeholder="201"/></label>
      <label>Room type<select value={roomTypeId} disabled={pending||roomTypes.length===0} onChange={e=>setRoomTypeId(e.target.value)} required>
       {roomTypes.length===0?<option value="">Create a room type first</option>:roomTypes.map(type=><option key={type.id} value={type.id}>{type.name}</option>)}
      </select></label>
      <label>Floor (optional)<input type="number" min={0} max={65535} step={1} value={floor} onChange={e=>setFloor(e.target.value)} disabled={pending} placeholder="Unassigned"/></label>
     </>}
    </div>
    {mode==='room'&&usage?.assigned&&<div className="hotel-capacity-notice"><SubscriptionCapacityMeter label="Registered rooms" resource={usage.rooms} enforced={usage.enforced}/>{roomFull&&<p>Room limit reached. Contact your PMS provider to increase capacity.</p>}</div>}
    {Object.entries(fieldErrors).map(([field,messages])=>messages.map((message,i)=><p key={field+'-'+i} className="catalog-field-error" role="alert">{field}: {message}</p>))}
    {error&&<p className="auth-error" role="alert">{error}</p>}
    <div className="guest-modal-actions"><button type="button" className="btn-inline" disabled={pending} onClick={onClose}>Cancel</button>
     <button className="btn-primary" type="submit" disabled={pending||roomFull||(mode==='room'&&roomTypes.length===0)}><Plus size={16}/>{pending?'Saving…':mode==='type'?'Create room type':'Create room'}</button>
    </div>
   </form>
  </section>
 </div>;
}
