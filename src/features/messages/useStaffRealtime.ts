import {useEffect} from 'react';
import {useQueryClient} from '@tanstack/react-query';
import {requestJson} from '../../api/http';

export function useStaffRealtime(hotel:string|null,user:string|undefined){
 const client=useQueryClient();
 useEffect(()=>{
  const key=import.meta.env.VITE_STAFF_REALTIME_KEY as string|undefined;
  const endpoint=import.meta.env.VITE_STAFF_REALTIME_WS_URL as string|undefined;
  if(!hotel||!user||!key||!endpoint)return;
  let stopped=false,socket:WebSocket|null=null,timer:number|undefined,attempt=0;
  const channel='private-staff.hotel.'+hotel+'.user.'+user;
  const refresh=()=>{
   void client.invalidateQueries({queryKey:['staff-messages',hotel,user]});
   void client.invalidateQueries({queryKey:['staff-thread',hotel,user]});
  };
  function connect(){
   if(stopped)return;
   let url:URL;
   try{url=new URL(endpoint);if(url.protocol!=='wss:')return;url.pathname=url.pathname.replace(/\/$/,'')+'/app/'+encodeURIComponent(key);url.searchParams.set('protocol','7');url.searchParams.set('client','js');url.searchParams.set('version','1.0');}
   catch{return;}
   const ws=new WebSocket(url.toString());socket=ws;
   ws.onmessage=async event=>{
    if(stopped||socket!==ws)return;
    try{
     const frame=JSON.parse(event.data);
     if(frame.event==='pusher:connection_established'){
      const data=typeof frame.data==='string'?JSON.parse(frame.data):frame.data;
      const result=await requestJson<{auth:string}>('/hotels/'+encodeURIComponent(hotel!)+'/staff-messaging/realtime/auth',{method:'POST',body:{socket_id:data.socket_id,channel_name:channel}});
      if(!stopped&&socket===ws&&ws.readyState===WebSocket.OPEN)ws.send(JSON.stringify({event:'pusher:subscribe',data:{channel,auth:result.auth}}));
     }else if(frame.event==='pusher:ping'){
      ws.send(JSON.stringify({event:'pusher:pong',data:{}}));
     }else if(frame.event==='pusher_internal:subscription_succeeded'&&frame.channel===channel){
      attempt=0;refresh();
     }else if(frame.event==='staff-messaging.changed'&&frame.channel===channel){
      refresh();
     }else if(frame.event==='pusher:error'){ws.close();}
    }catch{ws.close();}
   };
   ws.onerror=()=>ws.close();
   ws.onclose=()=>{
    if(stopped||socket!==ws)return;
    timer=window.setTimeout(connect,Math.min(60000,1000*2**Math.min(attempt++,6)));
   };
  }
  connect();
  return ()=>{stopped=true;if(timer!==undefined)window.clearTimeout(timer);socket?.close();};
 },[hotel,user,client]);
}
