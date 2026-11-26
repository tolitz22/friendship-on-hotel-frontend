export type PushPromptState='enable'|'repair'|'blocked'|null;
type Decision='disabled'|number|null;
const week=7*24*60*60*1000;
const memory=new Map<string,Decision>();
const storageKey=(userId:string,hotelId:string)=>'pms.push-prompt:v1:'+userId+':'+hotelId;
function readDecision(key:string):Decision{
 if(memory.has(key))return memory.get(key)??null;
 try{
  const value=localStorage.getItem(key);
  if(value==='disabled')return value;
  const until=Number(value);
  return Number.isFinite(until)&&until>0?until:null;
 }catch{return null;}
}
function writeDecision(userId:string,hotelId:string,value:Decision){
 const key=storageKey(userId,hotelId);
 memory.set(key,value);
 try{if(value===null)localStorage.removeItem(key);else localStorage.setItem(key,String(value));}catch{/* In-memory fallback for restricted storage. */}
}
export function snoozePushPrompt(userId:string,hotelId:string,now=Date.now()){writeDecision(userId,hotelId,now+week);}
export function suppressPushPrompt(userId:string,hotelId:string){writeDecision(userId,hotelId,'disabled');}
export function resetPushPrompt(userId:string,hotelId:string){writeDecision(userId,hotelId,null);}
export function pushPromptState(input:{admin:boolean;supported:boolean;configured:boolean;registered:boolean;permission:NotificationPermission;decision:Decision;now:number}):PushPromptState{
 if(!input.admin||!input.supported||!input.configured||input.decision==='disabled'||(typeof input.decision==='number'&&input.decision>input.now))return null;
 if(input.permission==='denied')return 'blocked';
 if(input.registered)return input.permission==='granted'?null:'repair';
 return 'enable';
}
export function currentPushPrompt(userId:string,hotelId:string,input:Omit<Parameters<typeof pushPromptState>[0],'decision'|'now'>){
 return pushPromptState({...input,decision:readDecision(storageKey(userId,hotelId)),now:Date.now()});
}
