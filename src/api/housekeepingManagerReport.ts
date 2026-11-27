import {z} from 'zod';
import {getJson} from './http';
import {hotelPath,readSession} from './session';
const count=z.number().int().nonnegative();
const average=z.number().nonnegative().nullable();
const cleaning=z.object({checkoutCompleted:count,stayoverCompleted:count,cleaningSamples:count,averageCleaningMinutes:average});
const durations=cleaning.extend({inspectionsCompleted:count,turnoverSamples:count,averageTurnoverMinutes:average});
const schema=z.object({data:z.object({hotelId:z.string(),hotelDate:z.iso.date(),days:z.number().int().min(1).max(14),
 summary:durations.extend({todo:count,inProgress:count,overdue:count,unassigned:count,pendingInspection:count}),
 staff:z.array(cleaning.extend({userId:z.string().regex(/^[1-9]\d*$/).nullable(),todo:count,inProgress:count,overdue:count,completed:count})),
 daily:z.array(durations.extend({date:z.iso.date()}))}),
 meta:z.object({snapshotOnly:z.literal(true),durationBasis:z.literal('recorded_events')})});
export function parseHousekeepingManagerReport(value:unknown,hotelId:string,days:number){
 const {data}=schema.parse(value);const s=data.summary;
 const total=(key:'checkoutCompleted'|'stayoverCompleted'|'inspectionsCompleted'|'cleaningSamples'|'turnoverSamples')=>data.daily.reduce((n,row)=>n+row[key],0);
 if(data.hotelId!==hotelId||data.days!==days||data.daily.length!==days||data.daily.at(-1)?.date!==data.hotelDate||
  new Set(data.daily.map(row=>row.date)).size!==days||new Set(data.staff.map(row=>row.userId)).size!==data.staff.length||
  (['checkoutCompleted','stayoverCompleted','inspectionsCompleted','cleaningSamples','turnoverSamples'] as const).some(key=>total(key)!==s[key])||
  [s,...data.daily,...data.staff].some(row=>row.cleaningSamples>row.checkoutCompleted+row.stayoverCompleted||(row.cleaningSamples===0)!==(row.averageCleaningMinutes===null))||
  [s,...data.daily].some(row=>(row.turnoverSamples===0)!==(row.averageTurnoverMinutes===null))||
  (['todo','inProgress','overdue','checkoutCompleted','stayoverCompleted','cleaningSamples'] as const).some(key=>data.staff.reduce((n,row)=>n+row[key],0)!==s[key]))
  throw new Error('Housekeeping report totals or scope do not reconcile.');
 return data;
}
export async function getHousekeepingManagerReport(hotelId:string,days:number){
 if(readSession().hotelId!==hotelId)throw new Error('Hotel changed. Refresh the report.');
 return parseHousekeepingManagerReport(await getJson<unknown>(hotelPath('/housekeeping/manager-report'),{days}),hotelId,days);
}
