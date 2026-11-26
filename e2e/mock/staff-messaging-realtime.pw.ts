import {test,expect,type Page,type WebSocketRoute} from '@playwright/test';

const origin='http://127.0.0.1:5175';
const channel='private-staff.hotel.1.user.1';
async function setup(page:Page){
 const sockets:WebSocketRoute[]=[];
 const subscriptions:string[]=[];
 const authRequests:unknown[]=[];
 const frames:string[]=[];
 const messages:{id:number;sender_id:string;sender_name:string;body:string;created_at:string}[]=[];
 let reads=0;
 await page.addInitScript(()=>{sessionStorage.setItem('foh.staff.bearer.v1','qa-token');sessionStorage.setItem('foh.staff.hotel.v1','1');});
 await page.route('**/api/v1/**',async route=>{
  const path=new URL(route.request().url()).pathname;
  const respond=(data:unknown)=>route.fulfill({json:{data}});
  if(path.endsWith('/auth/me'))return respond({id:'1',name:'QA Manager',email:'qa@example.test',hotels:[{id:'1',name:'QA Hotel',role:'admin'}]});
  if(path.endsWith('/realtime/auth')){authRequests.push(route.request().postDataJSON());return route.fulfill({json:{auth:'qa-key:qa-signature'}});}
  if(path.endsWith('/staff-messaging/conversations'))return respond([{id:10,kind:'channel',title:'All Staff',members:[],latest:messages.at(-1)??null,unread:0}]);
  if(path.endsWith('/conversations/10')){reads++;return respond(messages);}
  return respond([]);
 });
 await page.routeWebSocket('wss://realtime.example.test/**',socket=>{
  sockets.push(socket);
  socket.onMessage(raw=>{
   const frame=JSON.parse(String(raw));frames.push(frame.event);
   if(frame.event==='pusher:subscribe'){
    subscriptions.push(frame.data.channel);
    socket.send(JSON.stringify({event:'pusher_internal:subscription_succeeded',channel:frame.data.channel,data:'{}'}));
   }
  });
  socket.send(JSON.stringify({event:'pusher:connection_established',data:JSON.stringify({socket_id:'123.'+sockets.length,activity_timeout:10})}));
 });
 await page.goto(origin+'/messages');
 await expect(page.getByRole('button',{name:/All Staff/})).toBeVisible();
 await expect.poll(()=>subscriptions.length).toBeGreaterThan(0);
 await page.getByRole('button',{name:/All Staff/}).click();
 await expect(page.getByLabel('Message history').getByText('Say hello!')).toBeVisible();
 const add=(body:string)=>messages.push({id:messages.length+1,sender_id:'2',sender_name:'QA Reception',body,created_at:'2026-11-26T12:00:00Z'});
 const notify=(target=channel)=>sockets.at(-1)?.send(JSON.stringify({event:'staff-messaging.changed',channel:target,data:'{}'}));
 return {sockets,subscriptions,authRequests,frames,add,notify,reads:()=>reads};
}

test('authenticates the private channel and refreshes after incoming events',async ({page})=>{
 const qa=await setup(page);
 expect(qa.authRequests).toContainEqual({socket_id:expect.stringMatching(/^123\.\d+$/),channel_name:channel});
 expect(qa.subscriptions.every(value=>value===channel)).toBe(true);
 const before=qa.reads();
 qa.add('Incoming realtime message');
 qa.notify();qa.notify();qa.notify();
 await expect(page.getByLabel('Message history').getByText('Incoming realtime message')).toBeVisible({timeout:2500});
 expect(qa.reads()).toBeGreaterThan(before);
 qa.sockets.at(-1)?.send(JSON.stringify({event:'pusher:ping',data:{}}));
 await expect.poll(()=>qa.frames.includes('pusher:pong')).toBe(true);
});

test('reconnects after a socket closes and keeps messages available through polling',async ({page})=>{
 const qa=await setup(page);
 const count=qa.sockets.length;
 qa.sockets.at(-1)?.close({code:1011,reason:'QA outage'});
 qa.add('Available through polling');
 await expect(page.getByLabel('Message history').getByText('Available through polling')).toBeVisible({timeout:8000});
 await expect.poll(()=>qa.sockets.length).toBeGreaterThan(count);
 await expect.poll(()=>qa.subscriptions.length).toBeGreaterThan(1);
 qa.add('Recovered realtime message');qa.notify();
 await expect(page.getByLabel('Message history').getByText('Recovered realtime message')).toBeVisible();
});

test('recovers when a provider stops answering heartbeats',async ({page})=>{
 test.setTimeout(45000);
 const qa=await setup(page);
 const count=qa.sockets.length;
 // The simulated provider intentionally never returns a pong.
 await expect.poll(()=>qa.frames.includes('pusher:ping'),{timeout:15000}).toBe(true);
 await expect.poll(()=>qa.sockets.length,{timeout:15000}).toBeGreaterThan(count);
 await expect.poll(()=>qa.subscriptions.length).toBeGreaterThan(1);
});
