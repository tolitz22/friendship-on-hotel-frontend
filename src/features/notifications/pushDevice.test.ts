import {describe,expect,it} from 'vitest';
import {decodePushKey} from './pushDevice';
describe('push public key',()=>{
 it('decodes an uncompressed P-256 key',()=>{
  const bytes=new Uint8Array(65);bytes[0]=4;
  const key=btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  expect(decodePushKey(key)).toEqual(bytes);
 });
 it('rejects invalid keys',()=>{expect(()=>decodePushKey('AAAA')).toThrow();});
});
