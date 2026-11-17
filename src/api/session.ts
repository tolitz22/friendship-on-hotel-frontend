/**
 * Phase 5 development authentication only.
 * Bearer credentials are kept in module memory, never in local/session storage.
 * A full reload signs out. Do not print or log tokens.
 */
let token: string|null = null;
let hotelId: string|null = null;

export function readSession(){return {token,hotelId};}
export function setSessionToken(value:string|null){token=value;hotelId=null;}
export function setSessionHotel(value:string|null){hotelId=value;}
export function clearSession(){token=null;hotelId=null;}
export function hotelPath(path:string):string{
 if(!hotelId)throw new Error('Choose a hotel before requesting property records.');
 return '/hotels/'+encodeURIComponent(hotelId)+path;
}
