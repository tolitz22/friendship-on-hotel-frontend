/* Push only: no fetch interception or private response caching. */
self.addEventListener('push',event=>{
 let data={};
 try{data=event.data?.json()??{};}catch{}
 const text=(value,fallback,max)=>typeof value==='string'?value.slice(0,max):fallback;
 event.waitUntil(self.registration.showNotification('Friendship On Hotel PMS',{
  body:text(data.body,'A hotel update requires attention.',180),
  tag:text(data.id,'pms-alert',160),
  data:{url:'/front-desk'},
 }));
});
self.addEventListener('notificationclick',event=>{
 event.notification.close();
 event.waitUntil((async()=>{
  const url=new URL('/front-desk',self.location.origin).href;
  const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});
  const client=windows.find(c=>c.url===url);
  if(client)return client.focus();
  return self.clients.openWindow(url);
 })());
});
