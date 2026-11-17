import type {ManifestEntry,ManifestKind} from '../../api/liveFrontDesk';

export type DeskAction={label:string;hint:string;kind:'assign'|'check-in'|'check-out'|'view'};
/** Actions navigate to the guarded reservation detail workflow. They never execute a write. */
export function recommendedDeskAction(kind:ManifestKind,entry:ManifestEntry):DeskAction{
 if(kind==='arrivals'&&entry.status==='confirmed'){
  if(!entry.assignedRoomId)return {
   kind:'assign',label:'Assign room',hint:'Room assignment required before check-in',
  };
  return {kind:'check-in',label:'Review check-in',
   hint:'Verify identity, readiness and arrival eligibility before confirming'};
 }
 if(kind==='departures'&&entry.status==='checked_in')return {
  kind:'check-out',label:'Review checkout',
  hint:'Review departure date and financial follow-up before confirming',
 };
 return {kind:'view',label:'View stay',hint:'Open the current reservation details'};
}
export function pageAttentionCount(entries:ManifestEntry[]):number{
 return entries.filter(item=>item.status==='confirmed'&&!item.assignedRoomId).length;
}
