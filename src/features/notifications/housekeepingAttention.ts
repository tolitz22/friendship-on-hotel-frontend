export type HousekeepingAlert={id:string;kind:string;reference:string;taskId?:string};
export function newHousekeepingAlerts(previous:ReadonlySet<string>|null,items:readonly HousekeepingAlert[],read:ReadonlySet<string>){
 return {seen:new Set(items.map(item=>item.id)),arrivals:previous===null?[]:items.filter(item=>!previous.has(item.id)&&!read.has(item.id))};
}
export function selectHousekeepingAttention(items:readonly HousekeepingAlert[],read:ReadonlySet<string>){
 const priority=(kind:string)=>kind==='hk_arrival_urgent'?0:kind==='hk_assigned'?1:2;
 return items.filter(item=>!read.has(item.id)&&!!item.taskId).sort((a,b)=>priority(a.kind)-priority(b.kind));
}

// Dismissals are separate from read receipts: the bell retains the unread item.
export function readDismissedHousekeepingAlerts(raw:string|null):string[]{
 try{
  const values:unknown=JSON.parse(raw??'[]');
  if(!Array.isArray(values))return [];
  return [...new Set(values.filter((id):id is string=>typeof id==='string'&&id.length>0&&id.length<=160))].slice(0,1000);
 }catch{return [];}
}
export function dismissHousekeepingAlert(previous:readonly string[],id:string):string[]{
 return [...new Set([id,...previous])].slice(0,1000);
}
