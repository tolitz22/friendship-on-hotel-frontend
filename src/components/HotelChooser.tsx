import {Building2} from 'lucide-react';
import {useHotelAuth} from './AuthProvider';
export function HotelChooser(){
 const {user,selectHotel,hotelId}=useHotelAuth();
 if(!user)return null;
 return <div className="auth-shell"><div className="auth-card">
  <Building2 size={31} color="var(--accent)"/>
  <h1>Choose a property</h1>
  <p>Select a hotel assigned to your account before opening staff records.</p>
  {user.hotels.length===0?<p className="auth-error">Your account has no active hotel memberships. Contact your administrator.</p>:<div className="auth-hotel-list">{user.hotels.map(h=><button key={h.id} type="button" onClick={()=>selectHotel(h.id)} aria-pressed={hotelId===h.id}><strong>{h.name}</strong><span>{h.role}</span></button>)}</div>}
 </div></div>;
}
