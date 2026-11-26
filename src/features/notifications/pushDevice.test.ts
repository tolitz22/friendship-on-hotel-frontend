import {afterEach,describe,expect,it,vi} from 'vitest';
import {decodePushKey,keyMatches,resetPushForDifferentAccount} from './pushDevice';
describe('push public key',()=>{
 it('decodes an uncompressed P-256 key',()=>{
  const bytes=new Uint8Array(65);bytes[0]=4;
  const key=btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  expect(decodePushKey(key)).toEqual(bytes);
 });
 it('rejects invalid keys',()=>{expect(()=>decodePushKey('AAAA')).toThrow();});
});

describe('shared browser push ownership',()=>{
 afterEach(()=>vi.unstubAllGlobals());
 function setup(owner:string|null,script='/pms-push-sw.js',removable=true){
  const rows=owner?[{userId:owner,hotelId:'1',id:'9'}]:[];
  const write=vi.fn();
  const close=vi.fn();
  let present=true;
  const unsubscribe=vi.fn(async()=>{if(removable)present=false;return removable;});
  vi.stubGlobal('localStorage',{getItem:()=>JSON.stringify(rows),setItem:write});
  vi.stubGlobal('location',{origin:'https://pms.example.test'});
  vi.stubGlobal('navigator',{serviceWorker:{getRegistration:async()=>({active:{scriptURL:'https://pms.example.test'+script},pushManager:{getSubscription:async()=>present?{unsubscribe}:null},getNotifications:async()=>[{close}]})}});
  return {unsubscribe,close,write};
 }
 it('preserves the same account subscription',async()=>{
  const {unsubscribe}=setup('1');
  await resetPushForDifferentAccount('1');
  expect(unsubscribe).not.toHaveBeenCalled();
 });
 it('unsubscribes and dismisses previous account notifications before clearing ownership',async()=>{
  const {unsubscribe,close,write}=setup('1');
  await resetPushForDifferentAccount('2');
  expect(unsubscribe).toHaveBeenCalledOnce();
  expect(close).toHaveBeenCalledOnce();
  expect(write).toHaveBeenCalledWith('pms.push-device:v1:','[]');
 });
 it('removes a subscription with unknown local ownership',async()=>{
  const {unsubscribe}=setup(null);
  await resetPushForDifferentAccount('2');
  expect(unsubscribe).toHaveBeenCalledOnce();
 });
 it('does not unsubscribe a different service worker',async()=>{
  const {unsubscribe}=setup(null,'/other-sw.js');
  await resetPushForDifferentAccount('2');
  expect(unsubscribe).not.toHaveBeenCalled();
 });
 it('does not clear previous ownership when browser revocation fails',async()=>{
  const {write}=setup('1','/pms-push-sw.js',false);
  await expect(resetPushForDifferentAccount('2')).rejects.toThrow('Unable to remove');
  expect(write).not.toHaveBeenCalled();
 });
});

it('detects a changed VAPID key instead of reusing an incompatible subscription',()=>{
 const key=new Uint8Array([4,1,2]);
 const sub={options:{applicationServerKey:new Uint8Array([4,1,2]).buffer}} as PushSubscription;
 expect(keyMatches(sub,key)).toBe(true);
 expect(keyMatches(sub,new Uint8Array([4,1,3]))).toBe(false);
 expect(keyMatches({options:{applicationServerKey:null}} as PushSubscription,key)).toBe(false);
});
