/* Push only: no fetch interception or private response caching. */
function safeDestination(value){
 if(typeof value!=='string')return '/front-desk';
 try{
  const url=new URL(value,self.location.origin);
  const keys={'/reservations':'booking','/billing':'booking','/expenses':'expense','/cashier-shifts':'shift','/housekeeping':'task','/maintenance':'order','/rooms':'room','/room-calendar':'room','/manager-approvals':'approval','/messages':'conversation'};
  const key=keys[url.pathname];
  if(url.origin!==self.location.origin||!key)return '/front-desk';
  const hotel=url.searchParams.get('hotel'),id=url.searchParams.get(key);
  const numeric=value=>/^[1-9][0-9]*$/.test(value||'');
  if(!numeric(hotel)||!(key==='room'?/^[A-Za-z0-9_-]{1,32}$/.test(id||''):numeric(id)))return '/front-desk';
  const params=new URLSearchParams({hotel,[key]:id,push:'1'});
  const action=url.searchParams.get('deskAction');
  if(url.pathname==='/reservations'&&(action==='assign'||action==='check-out'))params.set('deskAction',action);
  const payment=url.searchParams.get('payment');
  if(url.pathname==='/billing'&&numeric(payment))params.set('payment',payment);
  const date=url.searchParams.get('date');
  if(url.pathname==='/room-calendar'&&/^\d{4}-\d{2}-\d{2}$/.test(date||''))params.set('date',date);
  return url.pathname+'?'+params.toString();
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
