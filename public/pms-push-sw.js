/* Push only: no fetch interception or private response caching. */
function safeDestination(value){
 if(typeof value!=='string')return '/front-desk';
 try{
  const url=new URL(value,self.location.origin);
  if(url.origin!==self.location.origin||url.pathname!=='/reservations')return '/front-desk';
  const hotel=url.searchParams.get('hotel'),booking=url.searchParams.get('booking'),action=url.searchParams.get('deskAction');
  if(!/^[1-9][0-9]*$/.test(hotel||'')||!/^[1-9][0-9]*$/.test(booking||''))return '/front-desk';
  const params=new URLSearchParams({hotel,booking});
  if(action==='assign'||action==='check-out')params.set('deskAction',action);
  return '/reservations?'+params.toString();
 }catch{return '/front-desk';}
}
self.addEventListener('push',event=>{
 let data={};
 try{const parsed=event.data?.json();if(parsed&&typeof parsed==='object')data=parsed;}catch{}
 const text=(value,fallback,max)=>typeof value==='string'?value.slice(0,max):fallback;
 event.waitUntil(self.registration.showNotification('Friendship On Hotel PMS',{
  body:text(data.body,'A hotel update requires attention.',180),
  tag:text(data.id,'pms-alert',160),
  renotify:false,
  data:{url:safeDestination(data.url)},
 }));
});
self.addEventListener('notificationclick',event=>{
 event.notification.close();
 event.waitUntil((async()=>{
  const url=new URL(safeDestination(event.notification.data?.url),self.location.origin).href;
  const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});
  const exact=windows.find(c=>c.url===url);
  if(exact)return exact.focus();
  return self.clients.openWindow(url);
 })());
});
