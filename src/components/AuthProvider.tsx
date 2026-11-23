import {createContext,useContext,useEffect,useState,type ReactNode} from 'react';
import {useQueryClient} from '@tanstack/react-query';
import {dataMode} from '../api';
import {fetchStaffProfile,loginStaff,logoutStaff,type StaffProfile} from '../api/auth';
import {isCookieAuth,onSpaSessionExpired} from '../api/http';
import {clearSession,readSession,setSessionHotel,setSessionToken} from '../api/session';

interface AuthContextValue{
 user:StaffProfile|null;
 hotelId:string|null;
 pending:boolean;
 signIn:(email:string,password:string)=>Promise<void>;
 signOut:()=>Promise<void>;
 selectHotel:(id:string)=>void;
}
const AuthContext=createContext<AuthContextValue|null>(null);

export function AuthProvider({children}:{children:ReactNode}){
 const queryClient=useQueryClient();
 const cookieMode=dataMode==='api'&&isCookieAuth();
 const [user,setUser]=useState<StaffProfile|null>(null);
 const [hotelId,setHotelId]=useState<string|null>(null);
 const [pending,setPending]=useState(cookieMode||(!cookieMode&&dataMode==='api'&&!!readSession().token));

 useEffect(()=>{
  if(!cookieMode)return;
  onSpaSessionExpired(()=>{
   clearSession();queryClient.clear();setUser(null);setHotelId(null);setPending(false);
  });
  return ()=>onSpaSessionExpired(null);
 },[cookieMode,queryClient]);

 // Cookie mode restores identity via HttpOnly cookies. Opt-in bearer
 // mode restores a tab-scoped token, but always validates it with Laravel
 // before displaying any authenticated PMS content.
 useEffect(()=>{
  if(dataMode!=='api'||(!cookieMode&&!readSession().token))return;
  let cancelled=false;
  const restore=async()=>{
   try{
    const profile=(await fetchStaffProfile()).data;
    if(cancelled)return;
    setUser(profile);
    const previousHotel=readSession().hotelId;
    const authorized=profile.hotels.find(h=>h.id===previousHotel);
    const selected=authorized?.id??(profile.hotels.length===1?profile.hotels[0].id:null);
    setSessionHotel(selected);
    setHotelId(selected);
   }catch{
    if(!cancelled){clearSession();setUser(null);setHotelId(null);}
   }finally{
    if(!cancelled)setPending(false);
   }
  };
  void restore();
  return ()=>{cancelled=true;};
 },[cookieMode]);

 // Refresh role and individual permission changes while a staff member is
 // signed in. Backend authorization is immediate; this keeps navigation in sync.
 useEffect(()=>{
  if(dataMode!=='api'||!user)return;
  let disposed=false;
  const refresh=async()=>{
   try{
    const profile=(await fetchStaffProfile()).data;
    if(disposed||profile.id!==user.id)return;
    setUser(profile);
    if(hotelId&&!profile.hotels.some(h=>h.id===hotelId)){
     setSessionHotel(null);setHotelId(null);queryClient.clear();
    }
   }catch{/* A transient refresh failure must not silently log out staff. */}
  };
  const onFocus=()=>{void refresh();};
  window.addEventListener('focus',onFocus);
  const interval=window.setInterval(()=>{if(document.visibilityState==='visible')void refresh();},60000);
  return ()=>{disposed=true;window.removeEventListener('focus',onFocus);window.clearInterval(interval);};
 },[user?.id,hotelId,queryClient]);
 const signIn=async(email:string,password:string)=>{
  setPending(true);
  clearSession();setUser(null);setHotelId(null);queryClient.clear();
  let loggedIn=false;
  try{
   const login=await loginStaff(email,password);
   if(cookieMode){
    if(!('authMode' in login.data)||login.data.authMode!=='cookie')throw new Error('Laravel did not establish a secure SPA session.');
   }else{
    if(!('token' in login.data)||!login.data.token||login.data.tokenType!=='Bearer')
     throw new Error('The API did not provide a supported authentication token.');
    setSessionToken(login.data.token);
   }
   loggedIn=true;
   const profile=(await fetchStaffProfile()).data;
   setUser(profile);
   if(profile.hotels.length===1){
    setSessionHotel(profile.hotels[0].id);setHotelId(profile.hotels[0].id);
   }
  }catch(e){
   if(loggedIn||readSession().token){
    try{await logoutStaff();}catch{/* Session may expire on the server. */}
   }
   clearSession();setUser(null);setHotelId(null);queryClient.clear();
   throw e;
  }finally{setPending(false);}
 };
 const selectHotel=(id:string)=>{
  if(!user?.hotels.some(h=>h.id===id))throw new Error('You are not a member of this hotel.');
  setSessionHotel(id);setHotelId(id);queryClient.clear();
 };
 const signOut=async()=>{
  setPending(true);
  try{if(user)await logoutStaff();}
  catch{/* Clear client state even if logout fails; server session may persist until expiry. */}
  finally{clearSession();setUser(null);setHotelId(null);queryClient.clear();setPending(false);}
 };
 return <AuthContext.Provider value={{user,hotelId,pending,signIn,signOut,selectHotel}}>{children}</AuthContext.Provider>;
}
export function useHotelAuth(){
 const context=useContext(AuthContext);
 if(!context)throw new Error('AuthProvider is missing.');
 return context;
}
export const isLiveGuestsMode=dataMode==='api';
