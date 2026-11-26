/* Push only: no fetch interception or private response caching. */
function safeDestination(value){
 if(typeof value!=='string')return '/front-desk';
 try{
  const url=new URL(value,self.location.origin);
  const keys={'/reservations':'booking','/billing':'booking','/expenses':'expense','/cashier-shifts':'shift','/housekeeping':'task','/maintenance':'order','/rooms':'room','/room-calendar':'room','/manager-approvals':'approval','/messages':'conversation','/night-audit':'date'};
  const key=keys[url.pathname];
  if(url.origin!==self.location.origin||url.username||url.password||!key)return '/front-desk';
  if(url.searchParams.getAll('hotel').length!==1||url.searchParams.getAll(key).length!==1)return '/front-desk';
  const hotel=url.searchParams.get('hotel'),id=url.searchParams.get(key);
  const numeric=value=>/^[1-9][0-9]*$/.test(value||'');
  const validDate=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&!Number.isNaN(Date.parse(value+'T00:00:00Z'))&&new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value;
  if(!numeric(hotel)||!(key==='date'?validDate(id):key==='room'?/^[A-Za-z0-9_-]{1,32}$/.test(id||''):numeric(id)))return '/front-desk';
  const params=new URLSearchParams({hotel,[key]:id,push:'1'});
  const action=url.searchParams.get('deskAction');
  if(url.pathname==='/reservations'&&(action==='assign'||action==='check-out'))params.set('deskAction',action);
  const payment=url.searchParams.get('payment');
  if(url.pathname==='/billing'&&numeric(payment))params.set('payment',payment);
  const date=url.searchParams.get('date');
  if(url.pathname==='/room-calendar'&&validDate(date))params.set('date',date);
  return url.pathname+'?'+params.toString();
 }catch{return '/front-desk';}
}
// No offline cache, authenticated network requests, or anonymous resubscription.
self.addEventListener('install',event=>event.waitUntil(self.skipWaiting()));
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('pushsubscriptionchange',event=>{
 event.waitUntil((async()=>{
  const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});
  for(const client of windows)client.postMessage({type:'pms-push-subscription-changed'});
 })());
});
self.addEventListener('push',event=>{
 let data={};
 try{const parsed=event.data?.json();if(parsed&&typeof parsed==='object')data=parsed;}catch{}
 const text=(value,fallback,max)=>typeof value==='string'?value.slice(0,max):fallback;
 event.waitUntil(self.registration.showNotification('Friendship On Hotel PMS',{
  body:text(data.body,'A hotel update requires attention.',180),
  tag:text(data.id,'pms-alert',160),
  icon:'/pms-icon.svg',
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
  if(exact){try{return await exact.focus();}catch{/* Open a fresh window if focus fails. */}}
  return self.clients.openWindow(url);
 })());
});
