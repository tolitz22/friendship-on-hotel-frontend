/**
 * Bearer auth persists in tab-scoped sessionStorage by default so
 * staff sessions survive reloads on separate Railway hostnames.
 * Set VITE_AUTH_PERSISTENCE=memory to opt out.
 * IMPORTANT: sessionStorage is readable by JS and is vulnerable to XSS.
 * Prefer same-site HttpOnly Sanctum cookies for an operational PMS.
 */
const persistenceEnabled=import.meta.env.VITE_AUTH_MODE!=='cookie'
 &&import.meta.env.VITE_AUTH_PERSISTENCE!=='memory';
const tokenKey='foh.staff.bearer.v1';
const hotelKey='foh.staff.hotel.v1';
const storage=():Storage|null=>{
 if(!persistenceEnabled||typeof window==='undefined')return null;
 try{return window.sessionStorage;}catch{return null;}
};
const fromStorage=(key:string):string|null=>{
 try{return storage()?.getItem(key)??null;}catch{return null;}
};
const save=(key:string,value:string|null):void=>{
 try{
  const target=storage();
  if(!target)return;
  if(value===null)target.removeItem(key);else target.setItem(key,value);
 }catch{/* Storage may be disabled; auth falls back to memory-only. */}
};
let token:string|null=fromStorage(tokenKey);
let hotelId:string|null=token?fromStorage(hotelKey):null;

export function readSession(){return {token,hotelId};}
export function setSessionToken(value:string|null){
 token=value;hotelId=null;
 save(tokenKey,value);save(hotelKey,null);
}
export function setSessionHotel(value:string|null){
 hotelId=value;save(hotelKey,value);
}
export function clearSession(){
 token=null;hotelId=null;
 // Clear an older stored token even when persistence was disabled in a new build.
 try{
  if(typeof window!=='undefined'){
   window.sessionStorage.removeItem(tokenKey);
   window.sessionStorage.removeItem(hotelKey);
  }
 }catch{}
}
export function hotelPath(path:string):string{
 if(!hotelId)throw new Error('Choose a hotel before requesting property records.');
 return '/hotels/'+encodeURIComponent(hotelId)+path;
}
