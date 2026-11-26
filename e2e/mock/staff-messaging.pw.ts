import {test,expect,type Page} from '@playwright/test';

const origin='http://127.0.0.1:5174';
const staff=[{id:'1',name:'QA Manager',role:'admin',last_read_message_id:0},{id:'2',name:'QA Reception',role:'front_desk',last_read_message_id:0}];
type Payload={reply_to_id?:number;attachment?:{filename:string;content:string};body?:string;client_id:string;record_type?:string;record_id?:string;is_announcement?:boolean;handover?:{incoming_shift:string;outstanding:string;reminders:string}};
async function setup(page:Page,role='admin',options:{failFirst?:boolean;seed?:Record<string,unknown>[]}={}){
 const sent:Payload[]=[];
 const requests:string[]=[];
 const threads:Record<string,Record<string,unknown>[]>={'10':options.seed??[],'11':[]};
 const me=role==='admin'?'1':'2';
 await page.addInitScript(()=>{sessionStorage.setItem('foh.staff.bearer.v1','synthetic-test-token');sessionStorage.setItem('foh.staff.hotel.v1','1');});
 // Every API request is intercepted; this suite never contacts a live hotel.
 await page.route('**/api/v1/**',async route=>{
  const url=new URL(route.request().url());
  const path=url.pathname;
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
    if(options.failFirst&&sent.length===1)return route.fulfill({status:503,json:{message:'Temporary delivery failure'}});
    const message={id:threads[id].length+1,sender_id:me,reply_body:threads[id].find(m=>m.id===payload.reply_to_id)?.body,attachment:payload.attachment?{id:99,filename:payload.attachment.filename,mime:'application/pdf',size:20}:null,body:payload.body??'',created_at:'2026-11-26 12:00:00',is_announcement:payload.is_announcement,handover:payload.handover,record:payload.record_type?{type:'room',id:'203',label:'Room QA203',target:'QA203'}:null};
    threads[id].push(message);return respond(message);
   }
   if(suffix==='/attachments/99')return route.fulfill({contentType:'application/octet-stream',body:'%PDF-1.4 QA file'});
   if(method==='POST'&&suffix.endsWith('/acknowledge')){const mid=Number(suffix.split('/')[2]);const row=threads[id].find(m=>m.id===mid);if(row)row.acknowledgement={required:true,acknowledged_at:'2026-11-26T12:00:00Z'};return respond(true);}
   if(method==='POST')return respond(true);
   const q=url.searchParams.get('q')?.toLowerCase();
   return respond(threads[id].filter(m=>!q||String(m.body).toLowerCase().includes(q)));
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

test('failed delivery preserves the draft and retries with the same client ID',async ({page})=>{
 const {sent}=await setup(page,'admin',{failFirst:true});
 await page.getByRole('button',{name:/QA Conversation/}).click();
 const draft=page.getByRole('textbox',{name:'Write a message'});
 await draft.fill('Retry this message');
 await page.getByRole('button',{name:'Send',exact:true}).click();
 await expect(page.getByText('Temporary delivery failure',{exact:true})).toBeVisible();
 await expect(draft).toHaveValue('Retry this message');
 await page.getByRole('button',{name:'Send',exact:true}).click();
 await expect(page.getByLabel('Message history').getByText('Retry this message')).toBeVisible();
 expect(sent).toHaveLength(2);
 expect(sent[1].client_id).toBe(sent[0].client_id);
});

test('validates attachments and downloads through the protected API',async ({page})=>{
 const {sent}=await setup(page);
 await page.getByRole('button',{name:/QA Conversation/}).click();
 const file=page.locator('input[type=file]');
 await file.setInputFiles({name:'invalid.exe',mimeType:'application/octet-stream',buffer:Buffer.from('QA')});
 await expect(page.getByText(/Choose a JPEG, PNG, WebP or PDF/)).toBeVisible();
 await expect(page.getByRole('button',{name:'Send',exact:true})).toBeDisabled();
 await file.setInputFiles({name:'report.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.4 QA file')});
 await expect(page.getByRole('button',{name:'Remove',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Send',exact:true}).click();
 const attachment=page.getByLabel('Message history').getByRole('button',{name:/report.pdf/});
 await expect(attachment).toBeVisible();
 expect(sent[0].attachment?.filename).toBe('report.pdf');
 const [download]=await Promise.all([page.waitForEvent('download'),attachment.click()]);
 expect(download.suggestedFilename()).toBe('report.pdf');
});

test('supports replies and filters message history',async ({page})=>{
 const {sent}=await setup(page);
 await page.getByRole('button',{name:/QA Conversation/}).click();
 const draft=page.getByRole('textbox',{name:'Write a message'});
 await draft.fill('Original QA question');
 await page.getByRole('button',{name:'Send',exact:true}).click();
 const history=page.getByLabel('Message history');
 await history.getByRole('button',{name:'Reply',exact:true}).click();
 await expect(page.getByRole('button',{name:'Cancel reply'})).toBeVisible();
 await draft.fill('QA answer');
 await page.getByRole('button',{name:'Send',exact:true}).click();
 await expect(history.getByText('QA answer',{exact:true})).toBeVisible();
 expect(sent[1].reply_to_id).toBe(1);
 await page.getByRole('textbox',{name:'Search messages'}).fill('Original QA question');
 await expect(history.getByText('QA answer',{exact:true})).toHaveCount(0);
 await expect(history.getByText('Original QA question',{exact:true})).toBeVisible();
});

test('requires explicit acknowledgement and isolates drafts on property switch',async ({page})=>{
 const {requests}=await setup(page,'front_desk',{seed:[{id:1,sender_id:'1',sender_name:'QA Manager',body:'QA private notice',created_at:'2026-11-26T12:00:00Z',is_announcement:true,acknowledgement:{required:true,acknowledged_at:null}}]});
 await page.getByRole('button',{name:/All Staff/}).click();
 const history=page.getByLabel('Message history');
 await history.getByRole('button',{name:'Acknowledge announcement'}).click();
 await expect(history.getByText('Acknowledged',{exact:true})).toBeVisible();
 expect(requests.some(p=>p.endsWith('/announcements/1/acknowledge'))).toBe(true);
 await page.getByRole('textbox',{name:'Write a message'}).fill('Private draft');
 // The property selector belongs to AppShell; use its accessible label.
 const property=page.getByLabel('Property',{exact:true});
 if(!await property.isVisible()){
  const menu=page.getByRole('button',{name:/open navigation|menu/i}).first();
  if(await menu.isVisible())await menu.click();
 }
 await property.selectOption('2');
 await expect(page.getByText('No conversations yet.',{exact:true})).toBeVisible();
 await expect(page.getByText('QA private notice',{exact:true})).toHaveCount(0);
 await expect(page.getByRole('textbox',{name:'Write a message'})).toHaveCount(0);
 expect(requests.some(p=>p.includes('/hotels/2/staff-messaging/conversations'))).toBe(true);
});
