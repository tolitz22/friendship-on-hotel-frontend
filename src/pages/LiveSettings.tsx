import {useEffect,useState,type FormEvent} from 'react';
import {useQueryClient} from '@tanstack/react-query';
import {Link} from '@tanstack/react-router';
import {Building2,BedDouble,ShieldCheck,Plus,Save,X,Pencil,CalendarClock,Users,ReceiptText,ArrowRight} from 'lucide-react';
import {useLiveCatalogSummary,useLiveProperty,useLiveRoomTypes} from '../api/liveCatalogQueries';
import {CatalogCreateDialog,type CatalogCreateMode} from '../components/CatalogCreateDialog';
import {CatalogEditDialog} from '../components/CatalogEditDialog';
import {updateLiveProperty,type LiveRoomType,type UpdateHotelProfileInput} from '../api/liveCatalog';
import {useHotelAuth} from '../components/AuthProvider';
import {Heading,Panel} from '../components/ui';
import {RateBookingPolicyManager} from '../components/RateBookingPolicyManager';
import {SeasonalRateManager} from '../components/SeasonalRateManager';
import {QueryFeedback} from '../components/QueryFeedback';

const hotelProfile=(hotel:{name:string;address:string|null;contactEmail:string|null;contactPhone:string|null}):UpdateHotelProfileInput=>({
 name:hotel.name,address:hotel.address??'',contactEmail:hotel.contactEmail??'',contactPhone:hotel.contactPhone??'',
});
const normalizeProfile=(draft:UpdateHotelProfileInput):UpdateHotelProfileInput=>({
 name:draft.name.trim(),address:draft.address?.trim()||null,
 contactEmail:draft.contactEmail?.trim()||null,contactPhone:draft.contactPhone?.trim()||null,
});
export function LiveSettings(){
 const {hotelId,user}=useHotelAuth();
 const queryClient=useQueryClient();
 const [editingProfile,setEditingProfile]=useState(false);
 const [profile,setProfile]=useState<UpdateHotelProfileInput|null>(null);
 const [saving,setSaving]=useState(false);
 const [profileError,setProfileError]=useState('');
 const [profileNotice,setProfileNotice]=useState('');
 const [createMode,setCreateMode]=useState<CatalogCreateMode|null>(null);
 const [editingType,setEditingType]=useState<LiveRoomType|null>(null);
 useEffect(()=>{setCreateMode(null);setEditingType(null);setEditingProfile(false);setProfile(null);setProfileError('');setProfileNotice('');},[hotelId]);
 const admin=!!user?.hotels.some(h=>h.id===hotelId&&h.role==='admin');
 const roomTypes=useLiveRoomTypes();
 const property=useLiveProperty();
 const catalog=useLiveCatalogSummary();
 const hotel=property.data?.data;
 const data=catalog.data?.data;
 const startEditing=()=>{
  if(!hotel)return;
  setProfile(hotelProfile(hotel));setProfileError('');setProfileNotice('');setEditingProfile(true);
 };
 const cancelEditing=()=>{if(saving)return;setEditingProfile(false);setProfile(null);setProfileError('');};
 const changed=!!profile&&!!hotel&&JSON.stringify(normalizeProfile(profile))!==JSON.stringify(normalizeProfile(hotelProfile(hotel)));
 async function saveProfile(event:FormEvent<HTMLFormElement>){
  event.preventDefault();
  if(!admin||!hotelId||!profile||saving||!changed)return;
  const payload=normalizeProfile(profile);
  if(payload.name.length<2||payload.name.length>120){
   setProfileError('Hotel name must contain 2–120 characters.');return;
  }
  if((payload.address?.length??0)>300||(payload.contactEmail?.length??0)>255||(payload.contactPhone?.length??0)>40){
   setProfileError('Check the maximum length of the property information.');return;
  }
  const currentHotel=hotelId;
  setSaving(true);setProfileError('');setProfileNotice('');
  try{
   await updateLiveProperty(payload);
   if(currentHotel!==hotelId)return;
   await Promise.all([
    queryClient.invalidateQueries({queryKey:['live-property',currentHotel]}),
    queryClient.invalidateQueries({queryKey:['live-catalog',currentHotel]}),
   ]);
   setEditingProfile(false);setProfile(null);
   setProfileNotice('Hotel details saved successfully.');
  }catch(cause){
   if(currentHotel===hotelId)setProfileError(cause instanceof Error?cause.message:'Could not save hotel details.');
  }finally{setSaving(false);}
 }
 return <>
 <Heading title="Hotel settings" description="Manage hotel information and find operational configuration in one place." action={admin?<div className="catalog-actions"><button type="button" className="btn-inline" onClick={()=>setCreateMode('type')}><Plus size={16}/> Room type</button><button type="button" className="btn-primary" onClick={()=>setCreateMode('room')}><Plus size={16}/> Add room</button></div>:undefined}/>
 <QueryFeedback loading={property.isPending||catalog.isPending} error={property.error??catalog.error??roomTypes.error}/>
 {hotel&&data&&<>
 <div className="settings-summary"><div><Building2 size={19}/><span>Property</span><strong>{hotel.name}</strong></div>
 <div><BedDouble size={19}/><span>Registered rooms</span><strong>{data.totalRooms}</strong></div>
 <div><ShieldCheck size={19}/><span>Currency</span><strong>{hotel.currency}</strong></div></div>
 <section className="hotel-settings-profile" aria-labelledby="hotel-profile-title">
  <div className="hotel-settings-profile-heading">
   <div><h3 id="hotel-profile-title">Property information</h3>
    <p>Details staff use to identify and contact your hotel.</p></div>
   {admin&&!editingProfile&&<button type="button" className="btn-inline" onClick={startEditing}>
    <Pencil size={16}/> Edit details
   </button>}
  </div>
  {profileNotice&&<p className="guest-info" role="status">{profileNotice}</p>}
  {editingProfile&&profile?<form className="hotel-settings-profile-form" onSubmit={event=>void saveProfile(event)}>
    <label>Hotel name<input type="text" required minLength={2} maxLength={120}
     value={profile.name} disabled={saving}
     onChange={event=>setProfile(prev=>prev?{...prev,name:event.target.value}:prev)}/></label>
    <label>Address<textarea rows={2} maxLength={300} disabled={saving}
     placeholder="Street address, city, province" value={profile.address??''}
     onChange={event=>setProfile(prev=>prev?{...prev,address:event.target.value}:prev)}/></label>
    <label>Contact email<input type="email" maxLength={255} disabled={saving}
     placeholder="frontdesk@example.com" value={profile.contactEmail??''}
     onChange={event=>setProfile(prev=>prev?{...prev,contactEmail:event.target.value}:prev)}/></label>
    <label>Contact phone<input type="tel" maxLength={40} disabled={saving}
     placeholder="Hotel contact number" value={profile.contactPhone??''}
     onChange={event=>setProfile(prev=>prev?{...prev,contactPhone:event.target.value}:prev)}/></label>
    {profileError&&<p className="auth-error" role="alert">{profileError}</p>}
    <div className="hotel-settings-form-actions">
     <button type="button" className="btn-inline" onClick={cancelEditing} disabled={saving}><X size={15}/> Cancel</button>
     <button type="submit" className="btn-primary" disabled={!changed||saving}>
      <Save size={15}/> {saving?'Saving…':'Save changes'}
     </button>
    </div>
   </form>:<dl className="hotel-settings-profile-summary">
    <div><dt>Hotel name</dt><dd>{hotel.name}</dd></div>
    <div><dt>Address</dt><dd>{hotel.address||'Not provided'}</dd></div>
    <div><dt>Contact email</dt><dd>{hotel.contactEmail||'Not provided'}</dd></div>
    <div><dt>Contact phone</dt><dd>{hotel.contactPhone||'Not provided'}</dd></div>
   </dl>}
  <div className="hotel-settings-fixed">
   <span><strong>Timezone</strong> {hotel.timeZone}</span>
   <span><strong>Currency</strong> {hotel.currency}</span>
   <small>Timezone and currency are protected because changing them could affect business dates, reservations and accounting records.</small>
  </div>
 </section>
 <section className="hotel-settings-links" aria-label="Operational settings">
  <h3>Operational settings</h3>
  <p>Use the dedicated settings pages for policies that affect bookings and financial records.</p>
  <div className="hotel-settings-link-grid">
   <Link to="/reservation-policy"><CalendarClock size={19}/><span><strong>Reservation policies</strong><small>Booking rules and exceptions</small></span><ArrowRight size={16}/></Link>
   <Link to="/tax-policies"><ReceiptText size={19}/><span><strong>Taxes & charges</strong><small>Finance and tax configuration</small></span><ArrowRight size={16}/></Link>
   <Link to="/staff"><Users size={19}/><span><strong>Staff & permissions</strong><small>Accounts, roles, and access</small></span><ArrowRight size={16}/></Link>
  </div>
 </section>
 {admin&&hotelId&&<SeasonalRateManager key={hotelId} hotelId={hotelId}/>}
 {admin&&hotelId&&<RateBookingPolicyManager key={hotelId} hotelId={hotelId}/>}
 <Panel title="Registered room types"><div className="table-scroll"><table><thead><tr><th>Type</th><th>Capacity</th><th>Rooms</th>{admin&&<th>Action</th>}</tr></thead><tbody>
  {data.roomTypes.map(t=><tr key={t.id}><td>{t.name}</td><td>{t.maxOccupancy}</td><td>{t.roomCount}</td>{admin&&<td><button className="guest-edit-button" type="button" onClick={()=>{const record=roomTypes.data?.data.find(rt=>rt.id===t.id);if(record)setEditingType(record);}}>Edit</button></td>}</tr>)}
  </tbody></table></div></Panel>
  <Panel title="Registered floors"><div className="settings-floor-grid">{data.floors.map((floor,i)=><div key={floor.number??'unknown-'+i}><span>{floor.number===null?'Unassigned floor':'Floor '+floor.number}</span><strong>{floor.roomCount} room(s)</strong></div>)}
  {data.floors.length===0&&<p>No rooms registered yet.</p>}</div></Panel>
  {admin&&<p className="guest-info">Add and edit room types above. Edit individual rooms from the Rooms dashboard.</p>}
  <p className="guest-info">Operational policies are managed in their dedicated modules to preserve existing booking and financial safeguards.</p>
 </>}
 {editingType&&admin&&<CatalogEditDialog key={'edit-'+hotelId+'-'+editingType.id} target={{kind:'room_type',record:editingType}} roomTypes={roomTypes.data?.data??[]} onClose={()=>setEditingType(null)} onSaved={()=>setEditingType(null)}/>}
 {createMode&&admin&&<CatalogCreateDialog key={hotelId+'-'+createMode} mode={createMode} roomTypes={roomTypes.data?.data??[]} onClose={()=>setCreateMode(null)} onCreated={()=>setCreateMode(null)}/>}
 </>;
}
