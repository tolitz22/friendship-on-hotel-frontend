import {createContext,useContext,useEffect,useState,type ReactNode} from 'react';
import {useQueryClient} from '@tanstack/react-query';
import {dataMode} from '../api';
import {fetchStaffProfile,loginStaff,logoutStaff,type StaffProfile} from '../api/auth';
import {isCookieAuth} from '../api/http';
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
 const [pending,setPending]=useState(cookieMode);

 // The browser owns the HttpOnly Laravel session cookie. After a refresh,
 // recover identity from /auth/me instead of storing tokens in JS storage.
 useEffect(()=>{
  if(!cookieMode)return;
  let cancelled=false;
  const restore=async()=>{
   try{
    const profile=(await fetchStaffProfile()).data;
    if(cancelled)return;
    setUser(profile);
    if(profile.hotels.length===1){
     setSessionHotel(profile.hotels[0].id);
     setHotelId(profile.hotels[0].id);
    }
   }catch{
    if(!cancelled){clearSession();setUser(null);setHotelId(null);}
   }finally{
    if(!cancelled)setPending(false);
   }
  };
  void restore();
  return ()=>{cancelled=true;};
 },[cookieMode]);

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
