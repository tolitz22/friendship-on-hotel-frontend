import {useEffect} from 'react';
import {useQueryClient} from '@tanstack/react-query';
import {requestJson} from '../../api/http';

export function useStaffRealtime(hotel:string|null,user:string|undefined){
 const client=useQueryClient();
 useEffect(()=>{
  const key=import.meta.env.VITE_STAFF_REALTIME_KEY as string|undefined;
  const endpoint=import.meta.env.VITE_STAFF_REALTIME_WS_URL as string|undefined;
  if(!hotel||!user||!key||!endpoint)return;
  const appKey:string=key,wsEndpoint:string=endpoint,hotelKey:string=hotel;
  let url:URL;
  try{
   url=new URL(wsEndpoint);
   if(url.protocol!=='wss:'||url.username||url.password||url.search||url.hash)return;
   url.pathname=url.pathname.replace(/\/$/,'')+'/app/'+encodeURIComponent(appKey);
   url.searchParams.set('protocol','7');url.searchParams.set('client','js');url.searchParams.set('version','1.0');
  }catch{return;}
  const socketUrl=url.toString(),channel='private-staff.hotel.'+hotelKey+'.user.'+user;
  let stopped=false,socket:WebSocket|null=null,attempt=0;
  let retry:number|undefined,handshake:number|undefined,heartbeat:number|undefined,pong:number|undefined,refreshTimer:number|undefined;
  const clear=(id:number|undefined)=>{if(id!==undefined)window.clearTimeout(id);};
  const clearConnectionTimers=()=>{clear(handshake);clear(heartbeat);clear(pong);handshake=heartbeat=pong=undefined;};
  const current=(ws:WebSocket)=>!stopped&&socket===ws;
  const refresh=()=>{
   if(stopped||refreshTimer!==undefined)return;
   refreshTimer=window.setTimeout(()=>{
    refreshTimer=undefined;
    if(stopped)return;
    void client.invalidateQueries({queryKey:['staff-messages',hotelKey,user]});
    void client.invalidateQueries({queryKey:['staff-thread',hotelKey,user]});
   },350);
  };
  function schedule(minDelay=0){
   if(stopped||!navigator.onLine||retry!==undefined)return;
   const backoff=Math.min(60000,1000*2**Math.min(attempt++,6));
   const delay=Math.max(minDelay,Math.round(backoff*(0.5+Math.random()*0.5)));
   retry=window.setTimeout(()=>{retry=undefined;connect();},delay);
  }
  function disconnect(){
   clearConnectionTimers();
   const ws=socket;socket=null;
   if(ws){ws.onmessage=ws.onerror=ws.onclose=null;ws.close();}
  }
  function connect(){
   if(stopped||socket||!navigator.onLine)return;
   let ws:WebSocket;
   try{ws=new WebSocket(socketUrl);}catch{schedule();return;}
   socket=ws;
   let subscribed=false,authStarted=false,activityMs=60000,retryFloor=0;
   const fail=(floor=0)=>{
    if(!current(ws))return;
    retryFloor=Math.max(retryFloor,floor);
    disconnect();schedule(retryFloor);
   };
   const activity=()=>{
    clear(heartbeat);clear(pong);pong=undefined;
    heartbeat=window.setTimeout(()=>{
     if(!current(ws)||ws.readyState!==WebSocket.OPEN)return;
     try{ws.send(JSON.stringify({event:'pusher:ping',data:{}}));}
     catch{fail();return;}
     pong=window.setTimeout(()=>fail(),10000);
    },activityMs);
   };
   handshake=window.setTimeout(()=>fail(),15000);
   ws.onmessage=async event=>{
    if(!current(ws))return;
    try{
     const frame=JSON.parse(event.data);
     activity();
     if(frame.event==='pusher:connection_established'){
      if(authStarted)return;
      authStarted=true;
      const data=typeof frame.data==='string'?JSON.parse(frame.data):frame.data;
      if(typeof data.socket_id!=='string'||!/^[0-9]+\.[0-9]+$/.test(data.socket_id)){fail();return;}
      if(typeof data.activity_timeout==='number'&&Number.isFinite(data.activity_timeout))activityMs=Math.max(10000,Math.min(120000,data.activity_timeout*1000));
      activity();
      const result=await requestJson<{auth:string}>('/hotels/'+encodeURIComponent(hotelKey)+'/staff-messaging/realtime/auth',{method:'POST',body:{socket_id:data.socket_id,channel_name:channel}});
      if(current(ws)&&ws.readyState===WebSocket.OPEN)ws.send(JSON.stringify({event:'pusher:subscribe',data:{channel,auth:result.auth}}));
     }else if(frame.event==='pusher:ping'){
      ws.send(JSON.stringify({event:'pusher:pong',data:{}}));
     }else if(frame.event==='pusher_internal:subscription_succeeded'&&frame.channel===channel){
      subscribed=true;clear(handshake);handshake=undefined;attempt=0;refresh();
     }else if(subscribed&&frame.event==='staff-messaging.changed'&&frame.channel===channel){
      refresh();
     }else if(frame.event==='pusher:error'){fail(30000);}
    }catch{fail(authStarted&&!subscribed?60000:0);}
   };
   ws.onerror=()=>fail();
   ws.onclose=event=>fail(event.code>=4000&&event.code<4100?60000:0);
  }
  const offline=()=>{clear(retry);retry=undefined;disconnect();};
  const online=()=>{clear(retry);retry=undefined;attempt=0;refresh();connect();};
  const visible=()=>{if(document.visibilityState==='visible'){refresh();if(!socket&&retry===undefined)connect();}};
  window.addEventListener('offline',offline);window.addEventListener('online',online);
  document.addEventListener('visibilitychange',visible);
  connect();
  return ()=>{
   stopped=true;clear(retry);clear(refreshTimer);disconnect();
   window.removeEventListener('offline',offline);window.removeEventListener('online',online);
   document.removeEventListener('visibilitychange',visible);
  };
 },[hotel,user,client]);
}
