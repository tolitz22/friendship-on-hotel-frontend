import {describe,expect,it,vi} from 'vitest';
import source from '../../../public/pms-push-sw.js?raw';

function worker(){
 const listeners:Record<string,(event:any)=>void>={};
 const showNotification=vi.fn(async()=>{});
 const openWindow=vi.fn(async()=>{});
 const postMessage=vi.fn();
 const skipWaiting=vi.fn(async()=>{});
 const claim=vi.fn(async()=>{});
 const self={location:{origin:'https://pms.example.test'},registration:{showNotification},
  clients:{matchAll:async()=>[{url:'https://pms.example.test/',postMessage}],openWindow,claim},
  skipWaiting,addEventListener:(name:string,fn:(event:any)=>void)=>{listeners[name]=fn;}};
 new Function('self',source)(self);
 async function dispatch(name:string,fields:Record<string,unknown>={}){
  let task:Promise<unknown>|undefined;
  listeners[name]({...fields,waitUntil:(value:Promise<unknown>)=>{task=value;}});
  await task;
 }
 return {dispatch,showNotification,openWindow,postMessage,skipWaiting,claim};
}
describe('push-only service worker',()=>{
 it('activates updates without adding a fetch handler and informs open tabs about subscription changes',async()=>{
  const w=worker();await w.dispatch('install');await w.dispatch('activate');await w.dispatch('pushsubscriptionchange');
  expect(w.skipWaiting).toHaveBeenCalledOnce();expect(w.claim).toHaveBeenCalledOnce();
  expect(w.postMessage).toHaveBeenCalledWith({type:'pms-push-subscription-changed'});
  expect(source).not.toContain("addEventListener('fetch'");
 });
 it('validates native notification destinations and keeps the admin marker',async()=>{
  const w=worker();
  await w.dispatch('push',{data:{json:()=>({id:'1:payment:2',body:'Payment requires review.',url:'/billing?hotel=1&booking=2&payment=3'})}});
  expect(w.showNotification).toHaveBeenCalledWith('Friendship On Hotel PMS',expect.objectContaining({tag:'1:payment:2',data:{url:'/billing?hotel=1&booking=2&push=1&payment=3'}}));
  await w.dispatch('notificationclick',{notification:{close:vi.fn(),data:{url:'/billing?hotel=1&booking=2&push=1&payment=3'}}});
  expect(w.openWindow).toHaveBeenCalledWith('https://pms.example.test/billing?hotel=1&booking=2&push=1&payment=3');
 });
 it('rejects external and duplicate-property destinations',async()=>{
  const w=worker();
  for(const url of ['https://evil.example/billing?hotel=1&booking=2','/billing?hotel=1&hotel=2&booking=3','/night-audit?hotel=1&date=2026-02-30']){
   await w.dispatch('push',{data:{json:()=>({url})}});
   expect(w.showNotification).toHaveBeenLastCalledWith('Friendship On Hotel PMS',expect.objectContaining({data:{url:'/front-desk'}}));
  }
 });
});

it('routes a found-item alert through the safe push worker',async()=>{
 const w=worker();
 await w.dispatch('push',{data:{json:()=>({url:'/lost-found?hotel=1&item=7'})}});
 expect(w.showNotification).toHaveBeenCalledWith('Friendship On Hotel PMS',expect.objectContaining({data:{url:'/lost-found?hotel=1&item=7&push=1'}}));
});
