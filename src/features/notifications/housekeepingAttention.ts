export type HousekeepingAlert={id:string;kind:string;reference:string;taskId?:string};
export function newHousekeepingAlerts(previous:ReadonlySet<string>|null,items:readonly HousekeepingAlert[],read:ReadonlySet<string>){
 return {seen:new Set(items.map(item=>item.id)),arrivals:previous===null?[]:items.filter(item=>!previous.has(item.id)&&!read.has(item.id))};
}
export function selectHousekeepingAttention(items:readonly HousekeepingAlert[],read:ReadonlySet<string>){
 const priority=(kind:string)=>kind==='hk_arrival_urgent'?0:kind==='hk_assigned'?1:2;
 return items.filter(item=>!read.has(item.id)&&!!item.taskId).sort((a,b)=>priority(a.kind)-priority(b.kind));
}
