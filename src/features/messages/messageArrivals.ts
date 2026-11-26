export type ArrivalConversation={id:number;unread:number;latest:{id:number;sender_id:number|string|null}|null};

// Snapshot IDs rather than unread totals: an open thread can be read before
// the inbox refresh, and one unread count can replace another.
export function messageArrivals(previous:ReadonlyMap<number,number>|null,conversations:readonly ArrivalConversation[],userId:string){
 const next=new Map(previous??[]);
 const arrivals:number[]=[];
 for(const conversation of conversations){
  const latest=conversation.latest;
  if(!latest)continue;
  const old=next.get(conversation.id);
  if(old!==undefined&&latest.id<=old)continue;
  next.set(conversation.id,latest.id);
  if(previous!==null&&String(latest.sender_id)!==userId&&
    (old!==undefined||Number(conversation.unread)>0))arrivals.push(conversation.id);
 }
 return {next,arrivals};
}
