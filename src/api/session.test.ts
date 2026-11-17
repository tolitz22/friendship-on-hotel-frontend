import {afterEach,describe,expect,it} from 'vitest';
import {clearSession,hotelPath,readSession,setSessionHotel,setSessionToken} from './session';

afterEach(()=>clearSession());

describe('memory-only authenticated hotel context',()=>{
 it('requires an active hotel selection for property paths',()=>{
  expect(()=>hotelPath('/guests')).toThrow('Choose a hotel');
 });
 it('encodes selected hotel IDs and prefixes the property route',()=>{
  setSessionToken('temporary-token');
  setSessionHotel('hotel 1');
  expect(hotelPath('/guests')).toBe('/hotels/hotel%201/guests');
 });
 it('clears selected hotel when a new login token is set',()=>{
  setSessionToken('token-a');
  setSessionHotel('1');
  setSessionToken('token-b');
  expect(readSession().hotelId).toBeNull();
 });
 it('clears both credentials and selected property during sign-out',()=>{
  setSessionToken('token');
  setSessionHotel('12');
  clearSession();
  expect(readSession()).toEqual({token:null,hotelId:null});
 });
});
