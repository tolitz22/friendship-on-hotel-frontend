/** Pure positioning helpers for the room-rack timeline.
 * Dates use [check-in, check-out): departure is not an occupied night.
 */
export type RackPeriod={start:string;end:string};
export type RackSource={
 id:string;roomId:string;checkIn:string;checkOut:string;
};
export type RackBar<T extends RackSource>={
 item:T;startColumn:number;span:number;lane:number;
 clippedStart:boolean;clippedEnd:boolean;overlap:boolean;
};
export const dayIndex=(start:string,end:string)=>Math.round((
 Date.parse(end+'T00:00:00Z')-Date.parse(start+'T00:00:00Z')
)/86400000);
export function projectRackBars<T extends RackSource>(
 entries:T[], period:RackPeriod,
):RackBar<T>[]{
 const visible=entries.filter(item=>item.checkIn<period.end&&item.checkOut>period.start)
  .sort((a,b)=>a.checkIn.localeCompare(b.checkIn)||a.checkOut.localeCompare(b.checkOut)||a.id.localeCompare(b.id));
 const lanes:string[]=[];
 return visible.map((item,index)=>{
  const clippedStart=item.checkIn<period.start;
  const clippedEnd=item.checkOut>period.end;
  const start=clippedStart?period.start:item.checkIn;
  const end=clippedEnd?period.end:item.checkOut;
  let lane=lanes.findIndex(lastEnd=>lastEnd<=start);
  if(lane===-1){lane=lanes.length;lanes.push(end);}
  else lanes[lane]=end;
  return {
   item,startColumn:dayIndex(period.start,start)+2,
   span:dayIndex(start,end),lane,clippedStart,clippedEnd,
   overlap:visible.some((other,j)=>j!==index
    &&other.checkIn<item.checkOut&&other.checkOut>item.checkIn),
  };
 });
}
