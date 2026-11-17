import {createContext,useContext,useState,type ReactNode} from 'react';
import {useQueryClient} from '@tanstack/react-query';
import {dataMode} from '../api';
import {fetchStaffProfile,loginStaff,logoutStaff,type StaffProfile} from '../api/auth';
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
 const [user,setUser]=useState<StaffProfile|null>(null);
 const [hotelId,setHotelId]=useState<string|null>(null);
 const [pending,setPending]=useState(false);
 const signIn=async(email:string,password:string)=>{
  setPending(true);
  clearSession();
  setUser(null);
  setHotelId(null);
  queryClient.clear();
  try{
   const login=await loginStaff(email,password);
   if(!login.data.token||login.data.tokenType!=='Bearer')throw new Error('The API did not provide a supported authentication token.');
   setSessionToken(login.data.token);
   const profile=(await fetchStaffProfile()).data;
   setUser(profile);
   if(profile.hotels.length===1){
    setSessionHotel(profile.hotels[0].id);
    setHotelId(profile.hotels[0].id);
   }
  }catch(e){
   // A successful login followed by a failed /auth/me should not leave an unused token behind.
   if(!user&&readSession().token){try{await logoutStaff();}catch{/* Token expires server-side. */}}
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
  try{if(user)await logoutStaff();}catch{/* Clear locally even if the request fails; server token may remain until expiry. */}
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
