import {test,expect,type Page} from '@playwright/test';

const origin='http://127.0.0.1:5174';
const staff=[{id:'1',name:'QA Manager',role:'admin',last_read_message_id:0},{id:'2',name:'QA Reception',role:'front_desk',last_read_message_id:0}];
type Payload={body?:string;client_id:string;record_type?:string;record_id?:string;is_announcement?:boolean;handover?:{incoming_shift:string;outstanding:string;reminders:string}};
async function setup(page:Page,role='admin'){
 const sent:Payload[]=[];
 const requests:string[]=[];
 const threads:Record<string,Record<string,unknown>[]>={'10':[],'11':[]};
 const me=role==='admin'?'1':'2';
 await page.addInitScript(()=>{sessionStorage.setItem('foh.staff.bearer.v1','synthetic-test-token');sessionStorage.setItem('foh.staff.hotel.v1','1');});
 // Every API request is intercepted; this suite never contacts a live hotel.
 await page.route('**/api/v1/**',async route=>{
  const path=new URL(route.request().url()).pathname;
  const method=route.request().method();
  requests.push(path);
  const respond=(data:unknown)=>route.fulfill({json:{data}});
  if(path.endsWith('/auth/me'))return respond({id:me,name:role==='admin'?'QA Manager':'QA Reception',email:'qa@example.test',hotels:[{id:'1',name:'QA Hotel',role,permissions:['reservation.read']},{id:'2',name:'Other QA Hotel',role,permissions:['reservation.read']}]});
  if(path.includes('/hotels/2/staff-messaging'))return respond([]);
  if(path.endsWith('/staff-messaging/directory'))return respond(staff.filter(s=>s.id!==me));
  if(path.endsWith('/staff-messaging/records'))return respond([{type:'room',id:'203',label:'Room QA203',target:'QA203'}]);
  if(path.endsWith('/staff-messaging/conversations')){
   if(method==='POST')return respond({id:11});
   return respond([{id:10,kind:'channel',title:'All Staff',members:staff,latest:threads['10'].at(-1)??null,unread:0},{id:11,kind:'direct',title:'QA Conversation',members:staff,latest:threads['11'].at(-1)??null,unread:0}]);
  }
  const match=path.match(/\/staff-messaging\/conversations\/(10|11)(.*)$/);
  if(match){
   const [,id,suffix]=match;
   if(method==='POST'&&suffix==='/messages'){
    const payload=route.request().postDataJSON() as Payload;sent.push(payload);
    const message={id:threads[id].length+1,sender_id:me,body:payload.body??'',created_at:'2026-11-26 12:00:00',is_announcement:payload.is_announcement,handover:payload.handover,record:payload.record_type?{type:'room',id:'203',label:'Room QA203',target:'QA203'}:null};
    threads[id].push(message);return respond(message);
   }
   if(method==='POST')return respond(true);
   return respond(threads[id]);
  }
  return respond([]);
 });
 await page.goto(origin+'/messages');
 await expect(page.getByRole('button',{name:/All Staff/})).toBeVisible();
 return {sent,requests,threads};
}

test('message composer sends text and clears the draft',async ({page})=>{
 const {sent}=await setup(page);
 await page.getByRole('button',{name:/QA Conversation/}).click();
 const send=page.getByRole('button',{name:'Send',exact:true});
 await expect(send).toBeDisabled();
 await page.getByRole('textbox',{name:'Write a message'}).fill('QA message');
 await send.click();
 await expect(page.getByLabel('Message history').getByText('QA message')).toBeVisible();
 await expect(page.getByRole('textbox',{name:'Write a message'})).toHaveValue('');
 expect(sent).toHaveLength(1);
 expect(sent[0].body).toBe('QA message');
});

test('allows a record-only message and discards drafts when switching conversation',async ({page})=>{
 const {sent}=await setup(page);
 await page.getByRole('button',{name:/QA Conversation/}).click();
 await page.getByRole('button',{name:'Share PMS record'}).click();
 await page.getByRole('button',{name:'Room QA203',exact:true}).click();
 await page.getByRole('button',{name:'Send',exact:true}).click();
 await expect(page.getByLabel('Message history').getByText('Room QA203')).toBeVisible();
 expect(sent[0].record_id).toBe('203');
 await page.getByRole('textbox',{name:'Write a message'}).fill('Do not leak this draft');
 if(await page.getByRole('button',{name:'Inbox',exact:true}).isVisible())await page.getByRole('button',{name:'Inbox',exact:true}).click();
 await page.getByRole('button',{name:/All Staff/}).click();
 await expect(page.getByRole('textbox',{name:'Write a message'})).toHaveValue('');
});

test('manager can publish an announcement only with text',async ({page})=>{
 const {sent}=await setup(page);
 await page.getByRole('button',{name:/All Staff/}).click();
 await page.getByRole('checkbox',{name:/Publish as manager announcement/}).check();
 const publish=page.getByRole('button',{name:'Publish',exact:true});
 await expect(publish).toBeDisabled();
 await page.getByRole('textbox',{name:'Write a message'}).fill('QA official notice');
 await publish.click();
 await expect(page.getByLabel('Message history').getByText('Manager announcement')).toBeVisible();
 expect(sent[0].is_announcement).toBe(true);
});

test('ordinary staff cannot publish announcements but can create validated handovers',async ({page})=>{
 const {sent}=await setup(page,'front_desk');
 await page.getByRole('button',{name:/All Staff/}).click();
 await expect(page.getByRole('checkbox',{name:/Publish as manager announcement/})).toHaveCount(0);
 await page.getByRole('checkbox',{name:/Create shift handover/}).check();
 const send=page.getByRole('button',{name:'Send handover'});
 await expect(send).toBeDisabled();
 await page.getByLabel('Incoming shift').fill('Morning');
 await page.getByLabel('Outstanding work').fill('Inspect room QA203');
 await send.click();
 await expect(page.getByLabel('Message history').getByText('Shift handover · Morning')).toBeVisible();
 expect(sent[0].handover?.outstanding).toBe('Inspect room QA203');
});
